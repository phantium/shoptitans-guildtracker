/**
 * Queue manager for processing player snapshots
 * Allows capturing multiple screenshots while processing them sequentially
 */
class CaptureQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentItem = null;
    this.listeners = [];
  }

  /**
   * Add a capture to the queue
   * @param {Object} captureData - The capture data to process
   * @param {string} captureData.imageDataUrl - The captured image
   * @param {Object} captureData.metadata - Optional metadata (source, region, etc.)
   * @returns {string} Unique ID for this capture
   */
  enqueue(captureData) {
    const id = `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const item = {
      id,
      imageDataUrl: captureData.imageDataUrl,
      metadata: captureData.metadata || {},
      status: 'queued',
      enqueuedAt: new Date(),
      error: null
    };
    
    this.queue.push(item);
    this.notifyListeners();
    
    // Start processing if not already processing
    if (!this.isProcessing) {
      this.processNext();
    }
    
    return id;
  }

  /**
   * Process the next item in the queue
   */
  async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.currentItem = this.queue.shift();
    this.currentItem.status = 'processing';
    this.currentItem.startedAt = new Date();
    this.notifyListeners();

    try {
      // Import modules dynamically
      const textExtractorModule = await import('../ocr/textExtractor.js');
      const statsParserModule = await import('../ocr/statsParser.js');

      const textExtractor = textExtractorModule.default;
      const statsParser = statsParserModule.default;

      // Extract text using OCR
      console.log(`Processing queue item ${this.currentItem.id}...`);
      const ocrResult = await textExtractor.extractTextWithPreprocessing(this.currentItem.imageDataUrl);
      console.log('OCR extracted text:', ocrResult.text);

      // Parse statistics
      const stats = statsParser.parseFromOCR(ocrResult);
      console.log('Parsed stats:', stats);

      // Validate stats
      if (!statsParser.isValid(stats)) {
        const missing = [];
        if (!stats.name && !stats.id) missing.push('player name/ID');
        if (!stats.guild_name) missing.push('guild name');
        const keyStats = [stats.net_worth, stats.prestige, stats.invested].filter(v => v).length;
        if (keyStats < 2) missing.push(`key stats (found ${keyStats}/3, need at least 2)`);
        
        throw new Error(`Incomplete data extracted. Missing: ${missing.join(', ')}`);
      }

      // Save to database
      await window.electronAPI.savePlayerStats(stats);

      this.currentItem.status = 'completed';
      this.currentItem.completedAt = new Date();
      this.currentItem.result = stats;
      
      console.log(`✅ Queue item ${this.currentItem.id} completed successfully`);

    } catch (error) {
      console.error(`❌ Queue item ${this.currentItem.id} failed:`, error);
      this.currentItem.status = 'failed';
      this.currentItem.error = error.message;
    }

    // Notify listeners about completion
    this.notifyListeners();

    // Clear current item after a delay to show result
    setTimeout(() => {
      this.currentItem = null;
      this.isProcessing = false;
      this.notifyListeners();
      
      // Process next item
      this.processNext();
    }, 1000);
  }

  /**
   * Get the current queue state
   */
  getState() {
    return {
      queue: this.queue,
      currentItem: this.currentItem,
      isProcessing: this.isProcessing,
      queueLength: this.queue.length
    };
  }

  /**
   * Clear all queued items (not the current processing item)
   */
  clearQueue() {
    this.queue = [];
    this.notifyListeners();
  }

  /**
   * Register a listener for queue state changes
   * @param {Function} callback - Called when queue state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in queue listener:', error);
      }
    });
  }
}

// Export singleton instance
const captureQueue = new CaptureQueue();
export default captureQueue;



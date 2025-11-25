/**
 * OCR text extraction using PaddleOCR (primary) with Tesseract.js fallback
 */

const { createWorker } = require('tesseract.js');

class TextExtractor {
  constructor() {
    this.worker = null;
    this.initialized = false;
  }

  /**
   * Initialize Tesseract worker
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Use local worker and core files with absolute paths
      const workerPath = new URL('dist/tesseract/worker.min.js', window.location.href).href;
      const corePath = new URL('dist/tesseract/tesseract-core-lstm.wasm.js', window.location.href).href;
      
      console.log('Worker path:', workerPath);
      console.log('Core path:', corePath);
      
      this.worker = await createWorker('eng', 1, {
        logger: m => console.log(m),
        workerPath: workerPath,
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        corePath: corePath
      });
      
      // Configure for better accuracy with game text
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ,.:#-',
        tessedit_pageseg_mode: '6', // Assume uniform block of text - better for structured UI
        tessedit_ocr_engine_mode: '1', // Use LSTM neural net mode for better accuracy
        preserve_interword_spaces: '1',
        // Additional quality improvements
        tessedit_create_hocr: '0',
        tessedit_create_tsv: '0',
        // Better line detection
        textord_heavy_nr: '1',
        // Improve word/line detection
        edges_max_children_per_outline: '40'
      });
      
      this.initialized = true;
      console.log('Tesseract initialized successfully');
    } catch (error) {
      console.error('Error initializing Tesseract:', error);
      throw error;
    }
  }

  /**
   * Extract text from image data URL
   */
  async extractText(imageDataUrl) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { data } = await this.worker.recognize(imageDataUrl);
      return {
        text: data.text,
        confidence: data.confidence,
        lines: data.lines.map(line => ({
          text: line.text,
          confidence: line.confidence,
          bbox: line.bbox
        }))
      };
    } catch (error) {
      console.error('Error extracting text:', error);
      throw error;
    }
  }

  /**
   * Merge OCR lines that are on the same horizontal level
   * PaddleOCR 3.x detects individual words, but we want phrases like "Bounty Trophies"
   */
  mergeHorizontalLines(lines) {
    if (!lines || lines.length === 0) return lines;
    
    // Helper to get max X (rightmost point) of a bounding box
    const getMaxX = (bbox) => Math.max(...bbox.map(pt => pt[0]));
    const getMinX = (bbox) => Math.min(...bbox.map(pt => pt[0]));
    
    // Sort by Y position first, then by X position
    const sorted = [...lines].sort((a, b) => {
      if (!a.bbox || !b.bbox) return 0;
      
      // Calculate center Y for each line
      const aY = a.bbox.reduce((sum, pt) => sum + pt[1], 0) / a.bbox.length;
      const bY = b.bbox.reduce((sum, pt) => sum + pt[1], 0) / b.bbox.length;
      
      // If Y difference is small, sort by X
      if (Math.abs(aY - bY) < 10) {
        const aX = a.bbox.reduce((sum, pt) => sum + pt[0], 0) / a.bbox.length;
        const bX = b.bbox.reduce((sum, pt) => sum + pt[0], 0) / b.bbox.length;
        return aX - bX;
      }
      
      return aY - bY;
    });
    
    // Merge lines that are on the same horizontal level AND close together horizontally
    const merged = [];
    let currentGroup = null;
    
    for (const line of sorted) {
      if (!line.bbox) {
        merged.push(line);
        continue;
      }
      
      const lineY = line.bbox.reduce((sum, pt) => sum + pt[1], 0) / line.bbox.length;
      const lineMinX = getMinX(line.bbox);
      
      if (!currentGroup) {
        currentGroup = { ...line };
      } else {
        const groupY = currentGroup.bbox.reduce((sum, pt) => sum + pt[1], 0) / currentGroup.bbox.length;
        const groupMaxX = getMaxX(currentGroup.bbox);
        
        // Calculate horizontal gap between end of current group and start of new line
        const horizontalGap = lineMinX - groupMaxX;
        
        // Merge if:
        // 1. On roughly the same Y level (within 15 pixels)
        // 2. Horizontal gap is reasonable (< 50 pixels)
        //    This prevents merging UI indicators that are far to the right
        //    Normal word spacing is < 10 pixels, so 50 gives margin for multi-column layouts
        if (Math.abs(lineY - groupY) < 15 && horizontalGap < 50) {
          currentGroup.text += ' ' + line.text;
          currentGroup.confidence = (currentGroup.confidence + line.confidence) / 2;
          // Expand bounding box to include both
          currentGroup.bbox = [...currentGroup.bbox, ...line.bbox];
        } else {
          // Different Y level or too far apart horizontally, save current group and start new one
          merged.push(currentGroup);
          currentGroup = { ...line };
        }
      }
    }
    
    // Don't forget the last group
    if (currentGroup) {
      merged.push(currentGroup);
    }
    
    return merged;
  }

  /**
   * Extract text using PaddleOCR (via Python script)
   */
  async extractTextWithPaddleOCR(imageDataUrl) {
    try {
      console.log('🐍 Attempting PaddleOCR extraction...');
      const result = await window.electronAPI.paddleOCRExtract(imageDataUrl);
      
      if (result.success) {
        // Merge lines that are on the same horizontal level
        // PaddleOCR 3.x detects individual words, but we want phrases
        const mergedLines = this.mergeHorizontalLines(result.lines || []);
        
        // Reconstruct full text from merged lines
        const fullText = mergedLines.map(l => l.text).join('\n');
        
        console.log('✅ PaddleOCR extraction successful!');
        console.log('   Device:', result.device === 'gpu' ? '🎮 GPU (Accelerated)' : '💻 CPU');
        console.log('   Confidence:', result.confidence + '%');
        console.log('   Lines extracted:', result.lines?.length || 0, '→ merged to', mergedLines.length);
        
        return {
          text: fullText,
          confidence: result.confidence,
          lines: mergedLines,
          engine: 'PaddleOCR',
          device: result.device
        };
      } else {
        console.warn('⚠️ PaddleOCR failed:', result.error);
        return null;
      }
    } catch (error) {
      console.warn('⚠️ PaddleOCR error:', error.message);
      return null;
    }
  }

  /**
   * Mask title/badge area in top-left corner with a rectangle
   * This prevents OCR from reading the player title while preserving all stat data
   * @param {string} imageDataUrl - The image data URL
   */
  async maskTitleArea(imageDataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the full original image first
        ctx.drawImage(img, 0, 0);
        
        // Calculate mask dimensions for title/badge area (top-left corner only)
        // The badge and title are roughly in the top 20% height and left 25% width
        // Carefully balanced to mask badge/title but not player name
        const maskWidth = Math.floor(img.width * 0.25);  // Left 25% width (covers badge area)
        const maskHeight = Math.floor(img.height * 0.20); // Top 20% height (covers badge/title)
        
        console.log(`🎭 Masking title/badge area: ${maskWidth}x${maskHeight}px (top-left corner)`);
        console.log(`   Image size: ${img.width}x${img.height}`);
        
        // Draw a rectangle matching the background color to hide title/badge
        // Using the background purple color from the game UI
        ctx.fillStyle = '#3d2645'; // Dark purple from Shop Titans UI
        ctx.fillRect(0, 0, maskWidth, maskHeight);
        
        resolve(canvas.toDataURL());
      };
      img.onerror = reject;
      img.src = imageDataUrl;
    });
  }

  /**
   * Extract text with preprocessing for better accuracy
   */
  async extractTextWithPreprocessing(imageDataUrl) {
    // First, mask the title/badge area in top-left corner only
    // This preserves all stat data while hiding the player title
    const maskedImage = await this.maskTitleArea(imageDataUrl);
    
    // Try PaddleOCR first (best accuracy)
    console.log('Strategy: Try PaddleOCR first, fallback to Tesseract');
    const paddleResult = await this.extractTextWithPaddleOCR(maskedImage);
    
    if (paddleResult && paddleResult.confidence > 60) {
      console.log('✅ Using PaddleOCR result (high confidence)');
      return paddleResult;
    }
    
    if (paddleResult) {
      console.log('⚠️ PaddleOCR confidence low:', paddleResult.confidence);
    }
    
    // Fallback to Tesseract
    console.log('📝 Falling back to Tesseract...');
    
    // Try OCR without preprocessing first (but with masked image)
    console.log('Attempting Tesseract without preprocessing...');
    const resultNoPreprocess = await this.extractText(maskedImage);
    console.log('Tesseract confidence without preprocessing:', resultNoPreprocess.confidence);
    
    // If confidence is low, try with preprocessing
    if (resultNoPreprocess.confidence < 60) {
      console.log('Low confidence, trying with preprocessing...');
      const preprocessed = await this.preprocessImage(maskedImage);
      const resultWithPreprocess = await this.extractText(preprocessed);
      console.log('Tesseract confidence with preprocessing:', resultWithPreprocess.confidence);
      
      // Return whichever has better confidence
      const tesseractResult = resultWithPreprocess.confidence > resultNoPreprocess.confidence 
        ? resultWithPreprocess 
        : resultNoPreprocess;
      
      tesseractResult.engine = 'Tesseract';
      
      // Compare with PaddleOCR if we have it
      if (paddleResult && paddleResult.confidence > tesseractResult.confidence) {
        console.log('✅ Using PaddleOCR result (better than Tesseract)');
        return paddleResult;
      }
      
      console.log('✅ Using Tesseract result');
      return tesseractResult;
    }
    
    resultNoPreprocess.engine = 'Tesseract';
    
    // Compare with PaddleOCR if we have it
    if (paddleResult && paddleResult.confidence > resultNoPreprocess.confidence) {
      console.log('✅ Using PaddleOCR result (better than Tesseract)');
      return paddleResult;
    }
    
    console.log('✅ Using Tesseract result');
    return resultNoPreprocess;
  }

  /**
   * Preprocess image for better OCR results
   */
  async preprocessImage(imageDataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Scale up ALL images by 2x for better OCR (text will be clearer)
        const scale = 2;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        console.log(`Preprocessing: original size ${img.width}x${img.height}, scaled to ${canvas.width}x${canvas.height}`);
        
        // Use bilinear smoothing for better text rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Enhanced preprocessing for game UI:
        // 1. Convert to grayscale
        // 2. Increase contrast significantly
        // 3. Apply adaptive thresholding
        
        // First pass: convert to grayscale with contrast boost
        const grayData = [];
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Grayscale conversion
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          
          // Extreme contrast boost for game UI
          const contrast = 2.0; // Very aggressive
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          let result = factor * (gray - 128) + 128;
          
          // Clamp to 0-255
          result = Math.max(0, Math.min(255, result));
          grayData.push(result);
        }
        
        // Second pass: apply adaptive threshold for sharp text
        // This makes white text on dark background very clear
        for (let i = 0; i < grayData.length; i++) {
          const gray = grayData[i];
          
          // Adaptive threshold: if pixel is bright enough, make it white, else black
          // This creates high contrast black/white image perfect for OCR
          const threshold = 140; // Adjust based on game UI brightness
          const result = gray > threshold ? 255 : 0;
          
          const pixelIndex = i * 4;
          data[pixelIndex] = result;
          data[pixelIndex + 1] = result;
          data[pixelIndex + 2] = result;
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL());
      };
      img.onerror = reject;
      img.src = imageDataUrl;
    });
  }

  /**
   * Cleanup worker
   */
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.initialized = false;
      this.worker = null;
    }
  }
}

// Export singleton instance
const textExtractor = new TextExtractor();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = textExtractor;
}


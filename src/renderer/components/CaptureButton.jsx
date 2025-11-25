import React, { useState } from 'react';

function CaptureButton({ settings, selectedSource, captureRegion, onStatusChange, onMessageChange, onCaptureComplete }) {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async () => {
    if (!selectedSource) {
      onMessageChange('Please select a capture region first');
      return;
    }

    // Check if game window dimensions have changed
    if (captureRegion && settings.source_width && settings.source_height) {
      try {
        const currentDimensions = await window.electronAPI.getSourceDimensions(selectedSource.id);
        
        if (currentDimensions.width !== settings.source_width || 
            currentDimensions.height !== settings.source_height) {
          onMessageChange(
            `⚠️ Game window dimensions have changed! ` +
            `(Was: ${settings.source_width}×${settings.source_height}, ` +
            `Now: ${currentDimensions.width}×${currentDimensions.height}). ` +
            `Please reconfigure the capture region.`
          );
          console.warn('Game window dimensions changed:', {
            saved: { width: settings.source_width, height: settings.source_height },
            current: currentDimensions
          });
          return;
        }
      } catch (error) {
        console.warn('Could not verify game window dimensions:', error);
        // Continue with capture anyway if we can't check dimensions
      }
    }

    setIsCapturing(true);
    onStatusChange('capturing');
    
    // Show window name in status message if available
    const sourceName = selectedSource.name || 'screen';
    onMessageChange(`Capturing from ${sourceName}...`);

    try {
      // Import modules dynamically
      const screenCaptureModule = await import('../../capture/screenCapture.js');
      const textExtractorModule = await import('../../ocr/textExtractor.js');
      const statsParserModule = await import('../../ocr/statsParser.js');

      const screenCapture = screenCaptureModule.default;
      const textExtractor = textExtractorModule.default;
      const statsParser = statsParserModule.default;

      // Set capture configuration
      console.log('Setting capture configuration:', { selectedSource, captureRegion });
      screenCapture.setSelectedSource(selectedSource);
      if (captureRegion) {
        screenCapture.setCaptureRegion(captureRegion);
        console.log('Capture region set:', captureRegion);
      } else {
        console.log('No capture region - using full screen');
      }

      // Capture screen
      console.log('Calling screenCapture.captureRegion()...');
      const imageDataUrl = await screenCapture.captureRegion();
      console.log('Capture complete, image data URL length:', imageDataUrl.length);
      
      // Save captured image for debugging
      const debugLink = document.createElement('a');
      debugLink.href = imageDataUrl;
      debugLink.download = `capture-debug-${Date.now()}.png`;
      console.log('📸 Debug: Click to save captured image:', debugLink);
      console.log('To save, run in console: document.querySelector("a[download^=\'capture-debug\']").click()');
      document.body.appendChild(debugLink);
      
      onMessageChange('Screen captured, processing with OCR...');

      // Extract text using OCR
      const ocrResult = await textExtractor.extractTextWithPreprocessing(imageDataUrl);
      console.log('OCR extracted text:', ocrResult.text);
      console.log('OCR lines:', ocrResult.lines.map(l => l.text));
      
      // Auto-save OCR results to debug file with capture info - DISABLED
      // console.log('🔍 Attempting to save OCR debug...');
      // try {
      //   const debugInfo = {
      //     text: ocrResult.text,
      //     confidence: ocrResult.confidence,
      //     captureRegion: captureRegion || 'Full screen',
      //     selectedSource: selectedSource?.name || selectedSource?.id || 'Unknown',
      //     timestamp: new Date().toISOString()
      //   };
      //   const result = await window.electronAPI.saveOCRDebug(debugInfo);
      //   console.log('✅ OCR text saved to:', result.filepath);
      // } catch (err) {
      //   console.error('❌ Failed to save OCR debug:', err);
      // }
      
      onMessageChange('OCR complete, parsing statistics...');

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
        
        onMessageChange(`Incomplete data extracted. Missing: ${missing.join(', ')}. Please ensure the player profile panel is fully visible and try again.`);
        console.error('Validation failed - missing:', missing);
        setIsCapturing(false);
        onStatusChange('idle');
        return;
      }

      onMessageChange('Saving player statistics...');

      // Save to database
      await window.electronAPI.savePlayerStats(stats);

      onMessageChange(`Successfully captured and saved stats for ${stats.name || stats.id}`);
      setIsCapturing(false);
      onStatusChange('success');

      // Notify parent component
      if (onCaptureComplete) {
        onCaptureComplete(stats);
      }

      // Reset status after a delay
      setTimeout(() => {
        onStatusChange('idle');
      }, 3000);

    } catch (error) {
      console.error('Capture error:', error);
      onMessageChange(`Error: ${error.message}`);
      setIsCapturing(false);
      onStatusChange('error');
    }
  };

  return (
    <div className="capture-button-container">
      <button 
        className={`btn btn-primary btn-large ${isCapturing ? 'btn-loading' : ''}`}
        onClick={handleCapture}
        disabled={isCapturing}
      >
        {isCapturing ? 'Capturing...' : 'Capture Player Stats'}
      </button>
      
      {selectedSource && (
        <div className="capture-info">
          <p>✓ Capture source: {selectedSource.name || selectedSource.id || 'Unknown'}</p>
          {captureRegion && <p>✓ Custom region configured</p>}
        </div>
      )}
    </div>
  );
}

export default CaptureButton;


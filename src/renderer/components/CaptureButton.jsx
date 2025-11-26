import React, { useState, useEffect } from 'react';
import captureQueue from '../../utils/captureQueue.js';

function CaptureButton({ settings, selectedSource, captureRegion, onStatusChange, onMessageChange, onCaptureComplete }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [queueState, setQueueState] = useState(captureQueue.getState());

  useEffect(() => {
    // Subscribe to queue state changes
    const unsubscribe = captureQueue.subscribe((state) => {
      setQueueState(state);
      
      // Update status messages based on queue state
      if (state.currentItem) {
        const itemStatus = state.currentItem.status;
        const playerInfo = state.currentItem.result ? 
          ` for ${state.currentItem.result.name || state.currentItem.result.id}` : '';
        
        if (itemStatus === 'processing') {
          onMessageChange(`Processing snapshot with OCR...${state.queueLength > 0 ? ` (${state.queueLength} in queue)` : ''}`);
          onStatusChange('processing');
        } else if (itemStatus === 'completed') {
          onMessageChange(`✅ Successfully saved stats${playerInfo}${state.queueLength > 0 ? ` (${state.queueLength} remaining)` : ''}`);
          onStatusChange('success');
          
          // Notify parent component
          if (onCaptureComplete && state.currentItem.result) {
            onCaptureComplete(state.currentItem.result);
          }
        } else if (itemStatus === 'failed') {
          onMessageChange(`❌ Error: ${state.currentItem.error}${state.queueLength > 0 ? ` (${state.queueLength} in queue)` : ''}`);
          onStatusChange('error');
        }
      } else if (state.queueLength === 0 && !state.isProcessing) {
        // Queue is empty and nothing is processing
        if (onStatusChange) {
          setTimeout(() => onStatusChange('idle'), 2000);
        }
      }
    });

    return () => unsubscribe();
  }, [onStatusChange, onMessageChange, onCaptureComplete]);

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
    
    // Show window name in status message if available
    const sourceName = selectedSource.name || 'screen';
    onMessageChange(`Capturing screenshot from ${sourceName}...`);

    try {
      // Import screen capture module
      const screenCaptureModule = await import('../../capture/screenCapture.js');
      const screenCapture = screenCaptureModule.default;

      // Set capture configuration
      console.log('Setting capture configuration:', { selectedSource, captureRegion });
      screenCapture.setSelectedSource(selectedSource);
      if (captureRegion) {
        screenCapture.setCaptureRegion(captureRegion);
        console.log('Capture region set:', captureRegion);
      } else {
        console.log('No capture region - using full screen');
      }

      // Capture screen (this is fast)
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
      
      // Add to processing queue
      const captureId = captureQueue.enqueue({
        imageDataUrl,
        metadata: {
          sourceName,
          captureRegion,
          capturedAt: new Date()
        }
      });
      
      console.log(`✅ Snapshot captured and added to queue (ID: ${captureId})`);
      onMessageChange(`📸 Snapshot captured! ${queueState.queueLength + 1 > 1 ? `Added to queue (position ${queueState.queueLength + 1})` : 'Processing...'}`);
      
      setIsCapturing(false);

    } catch (error) {
      console.error('Capture error:', error);
      onMessageChange(`Error capturing: ${error.message}`);
      setIsCapturing(false);
      onStatusChange('error');
    }
  };

  const handleClearQueue = () => {
    captureQueue.clearQueue();
    onMessageChange('Queue cleared');
  };

  return (
    <div className="capture-button-container">
      <button 
        className={`btn btn-primary btn-large ${isCapturing ? 'btn-loading' : ''}`}
        onClick={handleCapture}
        disabled={isCapturing}
      >
        {isCapturing ? 'Capturing Screenshot...' : 'Capture Player Stats'}
      </button>
      
      {selectedSource && (
        <div className="capture-info">
          <p>✓ Capture source: {selectedSource.name || selectedSource.id || 'Unknown'}</p>
          {captureRegion && <p>✓ Custom region configured</p>}
        </div>
      )}
      
      {(queueState.isProcessing || queueState.queueLength > 0) && (
        <div className="queue-status">
          <div className="queue-info">
            {queueState.currentItem && (
              <div className="processing-status">
                <span className="processing-indicator">⚙️</span>
                <span>Processing snapshot...</span>
              </div>
            )}
            {queueState.queueLength > 0 && (
              <div className="queue-length">
                <span className="queue-badge">{queueState.queueLength}</span>
                <span>in queue</span>
                <button 
                  className="btn btn-small btn-secondary"
                  onClick={handleClearQueue}
                  title="Clear queue"
                >
                  Clear Queue
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CaptureButton;


/**
 * Screen capture utilities for capturing game window
 */

class ScreenCapture {
  constructor() {
    this.selectedSource = null;
    this.region = null;
    this.captureWidth = null;
    this.captureHeight = null;
  }

  /**
   * Get available sources (windows and screens)
   */
  async getSources() {
    try {
      const sources = await window.electronAPI.getSources();
      return sources;
    } catch (error) {
      console.error('Error getting sources:', error);
      throw error;
    }
  }

  /**
   * Set the selected source
   */
  setSelectedSource(source) {
    // Handle multiple formats:
    // - String: just the ID (legacy format)
    // - Object with id property: { id: 'window:123', name: 'Window Title' }
    // - Object with id and name: { id: 'window:123', name: 'Window Title' }
    if (typeof source === 'string') {
      this.selectedSource = source;
    } else if (source && source.id) {
      this.selectedSource = source.id;
    } else {
      throw new Error('Invalid source format: must be string or object with id property');
    }
  }

  /**
   * Set capture region (x, y, width, height)
   */
  setCaptureRegion(region) {
    this.region = region;
  }

  /**
   * Capture screenshot from selected source
   */
  async captureScreen() {
    if (!this.selectedSource) {
      throw new Error('No source selected');
    }

    try {
      const result = await window.electronAPI.captureScreen(this.selectedSource);
      // Handle both old format (string) and new format (object with dataUrl, width, height)
      if (typeof result === 'string') {
        return result;
      } else {
        this.captureWidth = result.width;
        this.captureHeight = result.height;
        return result.dataUrl;
      }
    } catch (error) {
      console.error('Error capturing screen:', error);
      throw error;
    }
  }

  /**
   * Capture and crop to specific region
   */
  async captureRegion() {
    const fullScreenshot = await this.captureScreen();
    
    if (!this.region) {
      return fullScreenshot;
    }

    // Create image element to crop
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log('🖼️ Full screenshot size:', img.width, 'x', img.height);
        console.log('📏 Region from selection (based on thumbnail):', this.region);
        
        // Recalculate region if thumbnail size != actual capture size
        let { x, y, width, height } = this.region;
        const { thumbnailWidth, thumbnailHeight } = this.region;
        
        if (thumbnailWidth && thumbnailHeight) {
          // If thumbnail dimensions were stored, rescale the region
          const scaleX = img.width / thumbnailWidth;
          const scaleY = img.height / thumbnailHeight;
          
          if (scaleX !== 1 || scaleY !== 1) {
            console.log('🔄 Rescaling region from thumbnail to capture size');
            console.log('   Thumbnail size:', thumbnailWidth, 'x', thumbnailHeight);
            console.log('   Capture size:', img.width, 'x', img.height);
            console.log('   Scale factors:', scaleX.toFixed(3), 'x', scaleY.toFixed(3));
            
            x = Math.round(x * scaleX);
            y = Math.round(y * scaleY);
            width = Math.round(width * scaleX);
            height = Math.round(height * scaleY);
            
            console.log('   Adjusted region:', {x, y, width, height});
          }
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Validate region is within bounds
        if (x < 0 || y < 0 || x + width > img.width || y + height > img.height) {
          console.error('⚠️ Region exceeds image bounds!');
          console.error('   Image size:', img.width, 'x', img.height);
          console.error('   Region:', `${x},${y} to ${x+width},${y+height}`);
          console.error('   Clamping to image bounds...');
          
          // Clamp to bounds
          x = Math.max(0, Math.min(x, img.width - 1));
          y = Math.max(0, Math.min(y, img.height - 1));
          width = Math.min(width, img.width - x);
          height = Math.min(height, img.height - y);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
        
        console.log('✂️ Cropped to:', width, 'x', height);
        resolve(canvas.toDataURL());
      };
      img.onerror = reject;
      img.src = fullScreenshot;
    });
  }

  /**
   * Convert data URL to Image element for processing
   */
  dataUrlToImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }
}

// Export singleton instance
const screenCapture = new ScreenCapture();

// Support both CommonJS and ES6 module imports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = screenCapture;
  module.exports.default = screenCapture;
}

export default screenCapture;

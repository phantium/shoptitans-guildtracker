import React, { useState, useEffect, useRef } from 'react';

function RegionSelector({ onRegionSelected, onClose }) {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [startPoint, setStartPoint] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      const availableSources = await window.electronAPI.getSources();
      setSources(availableSources);
      
      // Auto-select "Shop Titans" window if available
      const shopTitansWindow = availableSources.find(s => s.name === 'Shop Titans');
      if (shopTitansWindow) {
        console.log('🎮 Auto-selecting Shop Titans window');
        setSelectedSource(shopTitansWindow);
        setIsSelecting(true);
      }
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  };

  const handleSourceSelect = (source) => {
    setSelectedSource(source);
    setIsSelecting(true);
  };

  const handleMouseDown = (e) => {
    if (!isSelecting || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setStartPoint({ x, y });
    setSelection({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!startPoint || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const width = currentX - startPoint.x;
    const height = currentY - startPoint.y;
    
    setSelection({
      x: width < 0 ? currentX : startPoint.x,
      y: height < 0 ? currentY : startPoint.y,
      width: Math.abs(width),
      height: Math.abs(height)
    });
  };

  const handleMouseUp = () => {
    console.log('Mouse up - startPoint:', startPoint, 'selection:', selection);
    
    if (startPoint && selection.width > 10 && selection.height > 10) {
      // Calculate scale factor from displayed thumbnail to actual capture
      const imgElement = canvasRef.current;
      if (!imgElement) {
        console.error('Canvas ref is null');
        setStartPoint(null);
        return;
      }
      
      const displayWidth = imgElement.getBoundingClientRect().width;
      const displayHeight = imgElement.getBoundingClientRect().height;
      
      // Get the natural (actual) size of the thumbnail image
      const naturalWidth = imgElement.naturalWidth;
      const naturalHeight = imgElement.naturalHeight;
      
      // Calculate scale factors
      const scaleX = naturalWidth / displayWidth;
      const scaleY = naturalHeight / displayHeight;
      
      // Scale the selection coordinates to match the thumbnail's natural size
      const scaledRegion = {
        x: Math.round(selection.x * scaleX),
        y: Math.round(selection.y * scaleY),
        width: Math.round(selection.width * scaleX),
        height: Math.round(selection.height * scaleY),
        // Store thumbnail dimensions for recalculation during capture
        thumbnailWidth: naturalWidth,
        thumbnailHeight: naturalHeight
      };
      
      console.log('✓ Region selected successfully!');
      console.log('Display size:', displayWidth, 'x', displayHeight);
      console.log('Natural size (thumbnail):', naturalWidth, 'x', naturalHeight);
      console.log('Scale factors:', scaleX, scaleY);
      console.log('Original selection:', selection);
      console.log('Scaled selection:', scaledRegion);
      
      // Pass source info (id and name) for persistent identification
      onRegionSelected({ id: selectedSource.id, name: selectedSource.name }, scaledRegion);
    } else {
      console.log('Selection too small or no start point');
    }
    setStartPoint(null);
  };

  const handleSkipRegion = () => {
    if (selectedSource) {
      // Pass source info (id and name) for persistent identification
      onRegionSelected({ id: selectedSource.id, name: selectedSource.name }, null);
    }
  };

  return (
    <div className="region-selector-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Select Capture Source and Region</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        {!isSelecting ? (
          <div className="source-list">
            <p>Select the window or screen to capture from:</p>
            <div className="source-grid">
              {sources.map((source) => (
                <div 
                  key={source.id} 
                  className="source-item"
                  onClick={() => handleSourceSelect(source)}
                >
                  <img src={source.thumbnail} alt={source.name} />
                  <p>{source.name}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="region-selection">
            <p>Draw a rectangle around the player profile area (or skip to capture full screen):</p>
            <div className="canvas-container">
              <img 
                ref={canvasRef}
                src={selectedSource.thumbnail} 
                alt="Selected source"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onDragStart={(e) => e.preventDefault()}
                draggable={false}
                style={{ cursor: 'crosshair', userSelect: 'none' }}
              />
              {selection.width > 0 && selection.height > 0 && (
                <div 
                  className="selection-box"
                  style={{
                    left: selection.x,
                    top: selection.y,
                    width: selection.width,
                    height: selection.height
                  }}
                />
              )}
            </div>
            <div className="region-actions">
              <button className="btn btn-primary" onClick={handleSkipRegion}>
                Use Full Screen
              </button>
              <button className="btn btn-secondary" onClick={() => setIsSelecting(false)}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RegionSelector;


import React, { useState, useEffect } from 'react';
import CaptureButton from './components/CaptureButton';
import SettingsPanel from './components/SettingsPanel';
import DataDisplay from './components/DataDisplay';
import RegionSelector from './components/RegionSelector';

function App() {
  const [settings, setSettings] = useState({ guild_name: '' });
  const [players, setPlayers] = useState([]);
  const [captureStatus, setCaptureStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [captureRegion, setCaptureRegion] = useState(null);

  useEffect(() => {
    loadSettings();
    loadPlayers();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await window.electronAPI.getSettings();
      setSettings(loadedSettings);
      
      // Check if we have saved capture configuration
      if (loadedSettings.capture_source) {
        // Verify screen resolution hasn't changed
        const currentResolution = await window.electronAPI.getScreenResolution();
        
        if (loadedSettings.screen_width === currentResolution.width && 
            loadedSettings.screen_height === currentResolution.height) {
          // Try to find the source by name first (persistent across reboots), then by ID
          try {
            const sources = await window.electronAPI.getSources();
            
            // Get saved source info (handle both old string format and new object format)
            const savedSource = typeof loadedSettings.capture_source === 'string' 
              ? { id: loadedSettings.capture_source, name: null }
              : loadedSettings.capture_source;
            
            // Try to find by name first (more reliable across reboots)
            let matchedSource = null;
            if (savedSource.name) {
              matchedSource = sources.find(s => s.name === savedSource.name);
              if (matchedSource) {
                console.log(`✓ Found source by name: "${savedSource.name}" (ID may have changed)`);
              }
            }
            
            // Fall back to ID match if name match failed
            if (!matchedSource) {
              matchedSource = sources.find(s => s.id === savedSource.id);
              if (matchedSource) {
                console.log('✓ Found source by ID');
              }
            }
            
            if (matchedSource) {
              // Source found, restore capture configuration
              const sourceInfo = { id: matchedSource.id, name: matchedSource.name };
              setSelectedSource(sourceInfo);
              setCaptureRegion(loadedSettings.capture_region);
              console.log('✓ Restored saved capture configuration');
              setStatusMessage(`Capture region restored: ${matchedSource.name}`);
              
              // Update saved source with current ID (in case it changed)
              if (matchedSource.id !== savedSource.id) {
                await window.electronAPI.saveSettings({
                  ...loadedSettings,
                  capture_source: sourceInfo
                });
                console.log('✓ Updated source ID in settings');
              }
            } else {
              // Source no longer exists, try auto-detection
              await tryAutoDetectShopTitans(loadedSettings);
            }
          } catch (error) {
            console.error('Error verifying capture source:', error);
          }
        } else {
          // Resolution changed, clear the saved capture configuration
          console.log('⚠️ Screen resolution changed, clearing saved capture configuration');
          console.log(`  Previous: ${loadedSettings.screen_width}x${loadedSettings.screen_height}`);
          console.log(`  Current: ${currentResolution.width}x${currentResolution.height}`);
          setStatusMessage('Screen resolution changed - please reconfigure capture region');
          
          // Clear the saved settings
          await window.electronAPI.saveSettings({
            ...loadedSettings,
            capture_source: null,
            capture_region: null,
            screen_width: null,
            screen_height: null
          });
        }
      } else {
        // No saved configuration, try auto-detection
        await tryAutoDetectShopTitans(loadedSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setStatusMessage('Error loading settings');
    }
  };

  const tryAutoDetectShopTitans = async (currentSettings) => {
    try {
      const sources = await window.electronAPI.getSources();
      
      // Look for "Shop Titans" window
      const shopTitansWindow = sources.find(s => s.name === 'Shop Titans');
      
      if (shopTitansWindow) {
        console.log('🎮 Auto-detected Shop Titans window!');
        const sourceInfo = { id: shopTitansWindow.id, name: shopTitansWindow.name };
        setSelectedSource(sourceInfo);
        
        // Save the source (but not region yet - user needs to set that)
        const currentResolution = await window.electronAPI.getScreenResolution();
        await window.electronAPI.saveSettings({
          ...currentSettings,
          capture_source: sourceInfo,
          screen_width: currentResolution.width,
          screen_height: currentResolution.height
        });
        
        setStatusMessage('Shop Titans window detected! Please select the capture region for player stats.');
        console.log('💡 Tip: Click "Select Capture Region" to define where to capture from');
      } else {
        console.log('ℹ️ Shop Titans window not found - user will need to select source manually');
        setStatusMessage('Please select "Select Capture Region" to choose the Shop Titans window');
      }
    } catch (error) {
      console.error('Error during auto-detection:', error);
    }
  };

  const loadPlayers = async () => {
    try {
      const loadedPlayers = await window.electronAPI.getAllPlayers();
      setPlayers(loadedPlayers);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };


  const handleCaptureComplete = async (stats) => {
    // Reload players list
    await loadPlayers();
  };

  const handleExport = async (format) => {
    try {
      setStatusMessage(`Exporting data as ${format.toUpperCase()}...`);
      
      let data;
      if (format === 'json') {
        const dataExporter = await import('../utils/dataExporter.js');
        data = dataExporter.default.exportToJSON(players);
      } else if (format === 'csv') {
        const dataExporter = await import('../utils/dataExporter.js');
        data = dataExporter.default.exportToCSV(players);
      }
      
      const result = await window.electronAPI.exportData(format, data);
      if (result.success) {
        setStatusMessage(`Data exported successfully to ${result.filepath}`);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      setStatusMessage('Error exporting data');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Shop Titans Guild Tracker</h1>
        <div className="header-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => setShowSettings(!showSettings)}
          >
            Settings
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowRegionSelector(!showRegionSelector)}
          >
            Select Capture Region
          </button>
        </div>
      </header>

      {statusMessage && (
        <div className="status-bar">
          {statusMessage}
        </div>
      )}

      <div className="app-content">
        {showSettings && (
          <SettingsPanel 
            onClose={() => setShowSettings(false)}
          />
        )}

        {showRegionSelector && (
          <RegionSelector
            onRegionSelected={async (source, region) => {
              console.log('App received region selection:', { source, region });
              setSelectedSource(source);
              setCaptureRegion(region);
              setShowRegionSelector(false);
              
              // Save capture configuration to settings
              try {
                const currentResolution = await window.electronAPI.getScreenResolution();
                
                // Get source dimensions for dimension change detection
                let sourceDimensions = null;
                try {
                  sourceDimensions = await window.electronAPI.getSourceDimensions(source.id);
                  console.log('✓ Got source dimensions:', sourceDimensions);
                } catch (error) {
                  console.warn('Could not get source dimensions:', error);
                }
                
                const updatedSettings = {
                  ...settings,
                  capture_source: source,
                  capture_region: region,
                  screen_width: currentResolution.width,
                  screen_height: currentResolution.height,
                  source_width: sourceDimensions?.width || null,
                  source_height: sourceDimensions?.height || null
                };
                
                await window.electronAPI.saveSettings(updatedSettings);
                setSettings(updatedSettings); // Update local state with new dimensions
                console.log('✓ Saved capture configuration to settings');
                setStatusMessage(region ? 'Capture region configured and saved' : 'Full screen capture configured and saved');
              } catch (error) {
                console.error('Error saving capture configuration:', error);
                setStatusMessage(region ? 'Capture region configured (save failed)' : 'Full screen capture configured (save failed)');
              }
            }}
            onClose={() => setShowRegionSelector(false)}
          />
        )}

        <div className="capture-section">
          <CaptureButton
            settings={settings}
            selectedSource={selectedSource}
            captureRegion={captureRegion}
            onStatusChange={(status) => setCaptureStatus(status)}
            onMessageChange={(message) => setStatusMessage(message)}
            onCaptureComplete={handleCaptureComplete}
          />
        </div>

        <div className="data-section">
          <DataDisplay 
            players={players}
            onExport={handleExport}
            onRefresh={loadPlayers}
          />
        </div>
      </div>
    </div>
  );
}

export default App;


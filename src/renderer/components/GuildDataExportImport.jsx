import React, { useState, useRef, useEffect } from 'react';
import './GuildDataExportImport.css';

function GuildDataExportImport({ guildName, selectedDate, onImportComplete }) {
  const [showDialog, setShowDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('export'); // 'export' or 'import'
  const [exportData, setExportData] = useState(null);
  const [importJson, setImportJson] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [availableSnapshots, setAvailableSnapshots] = useState([]);
  const [selectedExportDate, setSelectedExportDate] = useState('');
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (showDialog && guildName) {
      loadAvailableSnapshots();
    }
  }, [showDialog, guildName]);

  const loadAvailableSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const snapshots = await window.electronAPI.getGuildSnapshots(guildName);
      setAvailableSnapshots(snapshots);
      
      // Auto-select the most recent snapshot
      if (snapshots.length > 0) {
        setSelectedExportDate(snapshots[0].captured_at);
      }
    } catch (error) {
      console.error('Error loading snapshots:', error);
      setMessage({ type: 'error', text: 'Failed to load available snapshots' });
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const handleExport = async () => {
    if (!selectedExportDate) {
      setMessage({ type: 'error', text: 'Please select a date to export' });
      return;
    }

    setIsExporting(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await window.electronAPI.exportGuildSnapshot(guildName, selectedExportDate);
      
      if (result.success) {
        setExportData(result.data);
        setMessage({ 
          type: 'success', 
          text: `Successfully exported ${result.data.player_count} players from ${formatDate(result.data.snapshot_date)}` 
        });
      } else {
        setMessage({ type: 'error', text: result.error || 'Export failed' });
      }
    } catch (error) {
      console.error('Export error:', error);
      setMessage({ type: 'error', text: `Export failed: ${error.message}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (!exportData) return;

    const jsonString = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      setMessage({ type: 'success', text: '✓ Copied to clipboard! Share this with your guild members.' });
      
      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      setMessage({ type: 'error', text: 'Failed to copy to clipboard' });
    });
  };

  const handleSelectAllJson = () => {
    if (textareaRef.current) {
      textareaRef.current.select();
    }
  };

  const handlePreviewImport = async () => {
    if (!importJson.trim()) {
      setMessage({ type: 'error', text: 'Please paste JSON data to import' });
      return;
    }

    setMessage({ type: '', text: '' });

    try {
      const importData = JSON.parse(importJson);
      const result = await window.electronAPI.previewImportSnapshot(importData);
      
      if (result.success) {
        setImportPreview(result.preview);
        if (!result.preview.valid) {
          setMessage({ 
            type: 'error', 
            text: `Invalid import data: ${result.preview.errors.join(', ')}` 
          });
        } else {
          setMessage({ 
            type: 'info', 
            text: 'Preview loaded. Review the details below before importing.' 
          });
        }
      } else {
        setMessage({ type: 'error', text: result.error || 'Preview failed' });
      }
    } catch (error) {
      console.error('Preview error:', error);
      if (error instanceof SyntaxError) {
        setMessage({ type: 'error', text: 'Invalid JSON format. Please check the pasted data.' });
      } else {
        setMessage({ type: 'error', text: `Preview failed: ${error.message}` });
      }
    }
  };

  const handleImport = async () => {
    if (!importPreview || !importPreview.valid) {
      setMessage({ type: 'error', text: 'Please preview the import first' });
      return;
    }

    setIsImporting(true);
    setMessage({ type: '', text: '' });

    try {
      const importData = JSON.parse(importJson);
      const result = await window.electronAPI.importGuildSnapshot(importData, {
        skipDuplicates: true,
        updateExisting: true
      });
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `✓ Import complete! Added ${result.stats_added} stats, ${result.players_added} new players. ${result.duplicates_skipped} duplicates skipped.` 
        });
        
        // Clear import data
        setImportJson('');
        setImportPreview(null);
        
        // Notify parent to refresh data
        if (onImportComplete) {
          onImportComplete();
        }
        
        // Auto-close dialog after 3 seconds
        setTimeout(() => {
          setShowDialog(false);
          setMessage({ type: '', text: '' });
        }, 3000);
      } else {
        setMessage({ type: 'error', text: result.error || 'Import failed' });
      }
    } catch (error) {
      console.error('Import error:', error);
      setMessage({ type: 'error', text: `Import failed: ${error.message}` });
    } finally {
      setIsImporting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.length === 10) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  return (
    <>
      <button 
        className="export-import-button"
        onClick={() => setShowDialog(true)}
        title="Export/Import guild data"
      >
        📤📥 Share/Import Data
      </button>

      {showDialog && (
        <div className="modal-overlay" onClick={() => setShowDialog(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Guild Data Export/Import</h2>
              <button className="close-button" onClick={() => setShowDialog(false)}>×</button>
            </div>

            <div className="modal-tabs">
              <button 
                className={`tab-button ${activeTab === 'export' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('export');
                  setMessage({ type: '', text: '' });
                }}
              >
                📤 Export
              </button>
              <button 
                className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('import');
                  setMessage({ type: '', text: '' });
                }}
              >
                📥 Import
              </button>
            </div>

            <div className="modal-body">
              {message.text && (
                <div className={`message message-${message.type}`}>
                  {message.text}
                </div>
              )}

              {activeTab === 'export' && (
                <div className="export-tab">
                  <div className="export-info">
                    <p><strong>Guild:</strong> {guildName}</p>
                  </div>

                  <div className="date-selection">
                    <label htmlFor="export-date-select">
                      <strong>Select Snapshot Date to Export:</strong>
                    </label>
                    {loadingSnapshots ? (
                      <p className="loading-text">Loading available snapshots...</p>
                    ) : availableSnapshots.length === 0 ? (
                      <p className="no-data-text">No snapshots available to export</p>
                    ) : (
                      <select 
                        id="export-date-select"
                        className="date-select"
                        value={selectedExportDate}
                        onChange={(e) => {
                          setSelectedExportDate(e.target.value);
                          setExportData(null); // Clear previous export data
                          setMessage({ type: '', text: '' });
                        }}
                      >
                        {availableSnapshots.map(snapshot => (
                          <option key={snapshot.captured_at} value={snapshot.captured_at}>
                            {formatDate(snapshot.captured_at)} ({snapshot.player_count} players)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button 
                    className="action-button primary"
                    onClick={handleExport}
                    disabled={isExporting || !selectedExportDate || loadingSnapshots}
                  >
                    {isExporting ? '⏳ Exporting...' : '📤 Export Snapshot'}
                  </button>

                  {exportData && (
                    <div className="export-result">
                      <div className="export-stats">
                        <p>✓ Exported {exportData.player_count} players</p>
                        <p>Snapshot Date: {formatDate(exportData.snapshot_date)}</p>
                      </div>

                      <div className="json-display">
                        <div className="json-header">
                          <span>JSON Data (ready to share)</span>
                          <button 
                            className="action-button small"
                            onClick={handleSelectAllJson}
                          >
                            Select All
                          </button>
                        </div>
                        <textarea 
                          ref={textareaRef}
                          className="json-textarea"
                          value={JSON.stringify(exportData, null, 2)}
                          readOnly
                        />
                      </div>

                      <button 
                        className="action-button success"
                        onClick={handleCopyToClipboard}
                      >
                        📋 Copy to Clipboard
                      </button>

                      <div className="export-instructions">
                        <h4>How to share:</h4>
                        <ol>
                          <li>Click "Copy to Clipboard"</li>
                          <li>Share the copied data with your guild members (Discord, text file, etc.)</li>
                          <li>They can import it using the Import tab</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'import' && (
                <div className="import-tab">
                  <div className="import-instructions">
                    <h4>How to import:</h4>
                    <ol>
                      <li>Get exported JSON data from a guild member</li>
                      <li>Paste it in the box below</li>
                      <li>Click "Preview Import" to check what will be imported</li>
                      <li>Click "Import Data" to add it to your database</li>
                    </ol>
                  </div>

                  <div className="json-input">
                    <label>Paste JSON data here:</label>
                    <textarea 
                      className="json-textarea"
                      placeholder='Paste exported JSON data here...'
                      value={importJson}
                      onChange={(e) => {
                        setImportJson(e.target.value);
                        setImportPreview(null);
                      }}
                    />
                  </div>

                  <button 
                    className="action-button primary"
                    onClick={handlePreviewImport}
                    disabled={!importJson.trim()}
                  >
                    🔍 Preview Import
                  </button>

                  {importPreview && importPreview.valid && (
                    <div className="import-preview">
                      <h4>Import Preview:</h4>
                      <div className="preview-stats">
                        <p><strong>Guild:</strong> {importPreview.guild_name}</p>
                        <p><strong>Snapshot Date:</strong> {formatDate(importPreview.snapshot_date)}</p>
                        <p><strong>Total Players:</strong> {importPreview.total_players}</p>
                        <p><strong>New Players:</strong> {importPreview.new_players}</p>
                        <p><strong>Existing Players:</strong> {importPreview.existing_players}</p>
                        <p><strong>Duplicate Entries:</strong> {importPreview.duplicate_entries} (will be skipped)</p>
                      </div>

                      {importPreview.new_players > 0 && (
                        <details className="player-details">
                          <summary>New Players ({importPreview.new_players})</summary>
                          <ul>
                            {importPreview.new_player_names.map((name, i) => (
                              <li key={i}>{name}</li>
                            ))}
                          </ul>
                        </details>
                      )}

                      <button 
                        className="action-button success large"
                        onClick={handleImport}
                        disabled={isImporting}
                      >
                        {isImporting ? '⏳ Importing...' : '✓ Import Data'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="action-button" onClick={() => setShowDialog(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GuildDataExportImport;


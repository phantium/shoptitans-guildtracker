import React from 'react';

function SettingsPanel({ onClose }) {
  return (
    <div className="settings-panel">
      <div className="panel-header">
        <h2>Settings</h2>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>
      
      <div className="settings-form">
        <div className="form-group">
          <p className="form-help">
            <strong>Multi-Guild Tracking Enabled</strong>
          </p>
          <p className="form-help">
            You can now capture and track players from any guild. Players will be automatically grouped by their guild name in the display.
          </p>
          <p className="form-help">
            Additional settings may be added here in future updates.
          </p>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;


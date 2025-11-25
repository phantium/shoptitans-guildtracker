import React, { useState, useEffect, useRef } from 'react';

function RenamePlayerDialog({ player, onClose, onRename }) {
  const [newName, setNewName] = useState(player.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [allPlayerNames, setAllPlayerNames] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Load all player names for autocomplete
  useEffect(() => {
    const loadPlayerNames = async () => {
      try {
        const names = await window.electronAPI.getAllPlayerNames(player.guild_name);
        // Filter out the current player name
        setAllPlayerNames(names.filter(name => name !== player.name));
      } catch (error) {
        console.error('Error loading player names:', error);
      }
    };
    loadPlayerNames();
  }, [player.guild_name, player.name]);

  // Update suggestions when input changes
  useEffect(() => {
    if (newName.trim() === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = allPlayerNames.filter(name =>
      name.toLowerCase().includes(newName.toLowerCase())
    ).slice(0, 10); // Limit to 10 suggestions

    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setSelectedSuggestionIndex(-1);
  }, [newName, allPlayerNames]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newName.trim()) {
      alert('Please enter a new name');
      return;
    }

    if (newName.trim() === player.name) {
      alert('The new name is the same as the current name');
      return;
    }

    // Check if merging will occur
    const willMerge = allPlayerNames.some(name => 
      name.toLowerCase() === newName.trim().toLowerCase()
    );

    if (willMerge) {
      const confirmed = window.confirm(
        `A player named "${newName}" already exists. This will merge all statistics from "${player.name}" into "${newName}".\n\nThis cannot be undone. Continue?`
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(
        `Rename "${player.name}" to "${newName}"?\n\nThis will update all historical records.`
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);

    try {
      await onRename(player.id, newName.trim());
      onClose();
    } catch (error) {
      console.error('Error renaming player:', error);
      alert('Failed to rename player: ' + error.message);
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          setNewName(suggestions[selectedSuggestionIndex]);
          setShowSuggestions(false);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setNewName(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleClickOutside = (e) => {
    if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)) {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal-content rename-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Rename Player</h2>
        <p className="current-name">
          Current: <strong>{player.name || player.id}</strong>
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label htmlFor="newName">New Name:</label>
            <input
              ref={inputRef}
              type="text"
              id="newName"
              value={newName || ''}
              onChange={(e) => setNewName(e.target.value || '')}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Enter new player name"
              autoComplete="off"
              disabled={isSubmitting}
              autoFocus
            />
            
            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} className="autocomplete-suggestions">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion}
                    className={`suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dialog-actions">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>

        <div className="dialog-help">
          <p><strong>Tips:</strong></p>
          <ul>
            <li>Use arrow keys to navigate suggestions</li>
            <li>Press Enter to select a suggestion</li>
            <li>If the name already exists, data will be merged</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default RenamePlayerDialog;


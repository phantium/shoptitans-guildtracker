import React, { useState } from 'react';
import PlayerGraphs from './PlayerGraphs';
import RenamePlayerDialog from './RenamePlayerDialog';
import GuildStatistics from './GuildStatistics';

function DataDisplay({ players, onExport, onRefresh }) {
  const [sortBy, setSortBy] = useState('invested');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerHistory, setPlayerHistory] = useState([]);
  const [expandedGuilds, setExpandedGuilds] = useState({});
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showStatistics, setShowStatistics] = useState({});

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const toggleGuild = (guildName) => {
    setExpandedGuilds(prev => ({
      ...prev,
      [guildName]: !prev[guildName]
    }));
  };

  const toggleStatistics = (guildName) => {
    setShowStatistics(prev => ({
      ...prev,
      [guildName]: !prev[guildName]
    }));
  };

  // Group players by guild
  const playersByGuild = players.reduce((acc, player) => {
    const guild = player.guild_name || 'Unknown Guild';
    if (!acc[guild]) {
      acc[guild] = [];
    }
    acc[guild].push(player);
    return acc;
  }, {});

  // Sort players within each guild
  const sortedPlayersByGuild = Object.keys(playersByGuild).reduce((acc, guild) => {
    acc[guild] = [...playersByGuild[guild]].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle numeric fields (including the large numbers stored as strings)
      if (['net_worth', 'prestige', 'invested', 'registered', 'helped', 'ascensions', 'bounty_trophies', 'collection_score'].includes(sortBy)) {
        // Remove commas and parse as number
        aVal = parseFloat(String(aVal).replace(/,/g, '')) || 0;
        bVal = parseFloat(String(bVal).replace(/,/g, '')) || 0;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    return acc;
  }, {});

  // Sort guilds alphabetically
  const sortedGuilds = Object.keys(sortedPlayersByGuild).sort();

  const handlePlayerClick = async (player) => {
    setSelectedPlayer(player);
    try {
      const history = await window.electronAPI.getPlayerHistory(player.id);
      setPlayerHistory(history);
    } catch (error) {
      console.error('Error loading player history:', error);
    }
  };

  const handleDeleteHistory = async (event, entryId) => {
    event.stopPropagation(); // Prevent row click event
    
    if (!window.confirm('Are you sure you want to delete this history entry?')) {
      return;
    }

    try {
      await window.electronAPI.deleteHistoryEntry(entryId);
      // Refresh the history after deletion
      const updatedHistory = await window.electronAPI.getPlayerHistory(selectedPlayer.id);
      setPlayerHistory(updatedHistory);
      
      // If no history left, refresh the player list to update last_seen
      if (updatedHistory.length === 0) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting history entry:', error);
      alert('Failed to delete history entry');
    }
  };

  const handleDeleteAllPlayerHistory = async (event) => {
    event.stopPropagation(); // Prevent any event bubbling
    
    const playerName = selectedPlayer.name || selectedPlayer.id;
    if (!window.confirm(`Are you sure you want to delete ALL history entries for ${playerName}? This cannot be undone.`)) {
      return;
    }

    try {
      // Delete all history entries for this player
      for (const record of playerHistory) {
        await window.electronAPI.deleteHistoryEntry(record.id);
      }
      
      // Close the history view and refresh
      setSelectedPlayer(null);
      setPlayerHistory([]);
      onRefresh();
    } catch (error) {
      console.error('Error deleting all history entries:', error);
      alert('Failed to delete all history entries');
    }
  };

  const handleRenamePlayer = async (playerId, newName) => {
    try {
      const result = await window.electronAPI.renamePlayer(playerId, newName);
      
      if (result.success) {
        // Close dialogs and refresh
        setShowRenameDialog(false);
        setSelectedPlayer(null);
        setPlayerHistory([]);
        onRefresh();
        
        if (result.merged) {
          alert(`Player renamed and merged successfully! All data from "${selectedPlayer.name}" has been merged into "${newName}".`);
        } else {
          alert(`Player renamed successfully to "${newName}".`);
        }
      } else {
        throw new Error('Rename failed');
      }
    } catch (error) {
      console.error('Error renaming player:', error);
      throw error;
    }
  };

  const handleOpenRenameDialog = (event) => {
    event.stopPropagation();
    setShowRenameDialog(true);
  };

  const handleCleanupDuplicates = async () => {
    if (!window.confirm('This will merge duplicate players (same name in same guild) into a single entry. Statistics will be preserved. Continue?')) {
      return;
    }

    try {
      const result = await window.electronAPI.cleanupDuplicatePlayers();
      if (result.success) {
        if (result.mergedCount > 0) {
          alert(`Successfully merged ${result.mergedCount} duplicate player(s).`);
        } else {
          alert('No duplicate players found.');
        }
        onRefresh();
      }
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      alert('Failed to cleanup duplicates: ' + error.message);
    }
  };

  const formatNumber = (num) => {
    if (!num) return '-';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <div className="data-display">
      <div className="data-header">
        <h2>All Players ({players.length})</h2>
        <div className="data-actions">
          <button className="btn btn-secondary" onClick={onRefresh}>
            Refresh
          </button>
          {/* <button className="btn btn-warning" onClick={handleCleanupDuplicates} title="Merge duplicate players with the same name">
            Cleanup Duplicates
          </button> */}
          <button className="btn btn-secondary" onClick={() => onExport('json')}>
            Export JSON
          </button>
          <button className="btn btn-secondary" onClick={() => onExport('csv')}>
            Export CSV
          </button>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="empty-state">
          <p>No player data yet. Capture some player statistics to get started!</p>
        </div>
      ) : (
        <>
          {sortedGuilds.map(guildName => {
            const guildPlayers = sortedPlayersByGuild[guildName];
            const isExpanded = expandedGuilds[guildName] === true; // Default to collapsed

            const showStats = showStatistics[guildName] === true;

            return (
              <div key={guildName} className="guild-section">
                <div 
                  className="guild-header"
                  style={{ 
                    padding: '1rem', 
                    background: 'linear-gradient(135deg, #5C2F3E 0%, #6E3848 100%)', 
                    marginTop: '10px', 
                    borderRadius: '8px',
                    border: '2px solid #6E3848',
                    boxShadow: '0 3px 6px rgba(0, 0, 0, 0.4)',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div 
                    onClick={() => toggleGuild(guildName)}
                    style={{ 
                      cursor: 'pointer',
                      flex: 1
                    }}
                  >
                    <h3 style={{ 
                      margin: 0, 
                      display: 'flex', 
                      alignItems: 'center', 
                      color: '#F5B942',
                      textShadow: '2px 2px 4px rgba(0, 0, 0, 0.6)',
                      fontWeight: '700'
                    }}>
                      <span style={{ marginRight: '10px' }}>{isExpanded ? '▼' : '▶'}</span>
                      {guildName} - Guild Members ({guildPlayers.length})
                    </h3>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStatistics(guildName);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: showStats ? 'linear-gradient(135deg, #8B4F8B 0%, #6E3848 100%)' : 'rgba(110, 56, 72, 0.6)',
                      color: showStats ? '#F5B942' : '#E8E8E8',
                      border: showStats ? '2px solid #F5B942' : '2px solid #6E3848',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      transition: 'all 0.3s ease',
                      boxShadow: showStats ? '0 2px 8px rgba(245, 185, 66, 0.3)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!showStats) {
                        e.currentTarget.style.background = 'rgba(110, 56, 72, 0.8)';
                        e.currentTarget.style.borderColor = '#8B4F8B';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!showStats) {
                        e.currentTarget.style.background = 'rgba(110, 56, 72, 0.6)';
                        e.currentTarget.style.borderColor = '#6E3848';
                      }
                    }}
                  >
                    {showStats ? '📊 Hide Rankings' : '📊 Show Rankings'}
                  </button>
                </div>

                {showStats && (
                  <div style={{ marginTop: '1rem' }}>
                    <GuildStatistics guildName={guildName} />
                  </div>
                )}

                {isExpanded && (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th onClick={() => handleSort('name')}>Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th onClick={() => handleSort('net_worth')}>Net Worth {sortBy === 'net_worth' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th onClick={() => handleSort('prestige')}>Prestige {sortBy === 'prestige' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th onClick={() => handleSort('invested')}>Invested {sortBy === 'invested' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th onClick={() => handleSort('registered')}>Mastered {sortBy === 'registered' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th onClick={() => handleSort('helped')}>Helped {sortBy === 'helped' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th onClick={() => handleSort('ascensions')}>Ascensions {sortBy === 'ascensions' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th onClick={() => handleSort('bounty_trophies')}>Bounty {sortBy === 'bounty_trophies' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th onClick={() => handleSort('collection_score')}>Collection {sortBy === 'collection_score' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                          <th onClick={() => handleSort('last_seen')}>Last Seen {sortBy === 'last_seen' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {guildPlayers.map((player) => (
                          <tr 
                            key={player.id} 
                            onClick={() => handlePlayerClick(player)}
                            className={selectedPlayer?.id === player.id ? 'selected' : ''}
                          >
                            <td>{player.name || player.id}</td>
                            <td>{player.net_worth || '-'}</td>
                            <td>{player.prestige || '-'}</td>
                            <td>{player.invested || '-'}</td>
                            <td>{formatNumber(player.registered)}</td>
                            <td>{formatNumber(player.helped)}</td>
                            <td>{formatNumber(player.ascensions)}</td>
                            <td>{formatNumber(player.bounty_trophies)}</td>
                            <td>{formatNumber(player.collection_score)}</td>
                            <td>{player.last_seen ? new Date(player.last_seen).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {selectedPlayer && playerHistory.length > 0 && (
        <>
          <div className="player-history">
            <h3>
              History for {selectedPlayer.name || selectedPlayer.id}
              <button 
                className="btn-rename" 
                onClick={handleOpenRenameDialog}
                title="Rename this player"
                style={{ marginLeft: '10px' }}
              >
                ✏️
              </button>
              <button 
                className="btn-delete" 
                onClick={handleDeleteAllPlayerHistory}
                title="Delete all history for this user"
                style={{ marginLeft: '10px' }}
              >
                🗑️
              </button>
            </h3>
            <button className="btn-close" onClick={() => setSelectedPlayer(null)}>×</button>
            <div className="history-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Captured At</th>
                    <th>Net Worth</th>
                    <th>Prestige</th>
                    <th>Invested</th>
                    <th>Mastered</th>
                    <th>Helped</th>
                    <th>Ascensions</th>
                    <th>Bounty</th>
                    <th>Collection</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {playerHistory.map((record, index) => (
                    <tr key={index}>
                      <td>{new Date(record.captured_at).toLocaleString()}</td>
                      <td>{record.net_worth || '-'}</td>
                      <td>{record.prestige || '-'}</td>
                      <td>{record.invested || '-'}</td>
                      <td>{formatNumber(record.registered)}</td>
                      <td>{formatNumber(record.helped)}</td>
                      <td>{formatNumber(record.ascensions)}</td>
                      <td>{formatNumber(record.bounty_trophies)}</td>
                      <td>{formatNumber(record.collection_score)}</td>
                      <td>
                        <button 
                          className="btn-delete" 
                          onClick={(e) => handleDeleteHistory(e, record.id)}
                          title="Delete this entry"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <PlayerGraphs player={selectedPlayer} history={playerHistory} />
        </>
      )}

      {showRenameDialog && selectedPlayer && (
        <RenamePlayerDialog
          player={selectedPlayer}
          onClose={() => setShowRenameDialog(false)}
          onRename={handleRenamePlayer}
        />
      )}
    </div>
  );
}

export default DataDisplay;


import React, { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import './GuildStatistics.css';
import GuildDataExportImport from './GuildDataExportImport';

function GuildStatistics({ guildName }) {
  const [statistics, setStatistics] = useState(null);
  const [selectedStat, setSelectedStat] = useState('invested');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summarySortBy, setSummarySortBy] = useState('invested');
  const [summarySortOrder, setSummarySortOrder] = useState('desc');
  const [isExporting, setIsExporting] = useState(false);
  const rankingsRef = useRef(null);
  const summaryRef = useRef(null);
  const [isExportingSummary, setIsExportingSummary] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef(null);

  const statLabels = {
    net_worth: 'Net Worth',
    prestige: 'Prestige',
    invested: 'Invested',
    mastered: 'Mastered',
    helped: 'Helped',
    ascensions: 'Ascensions',
    bounty_trophies: 'Bounty',
    collection_score: 'Collection'
  };

  const rankColors = {
    1: '#FFD700', // Gold
    2: '#C0C0C0', // Silver
    3: '#CD7F32', // Bronze
  };

  const getRankBadgeColor = (rank) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#4A9FD8';
    if (rank === 3) return '#CD7F32';
    return '#8B4F8B';
  };

  useEffect(() => {
    loadSnapshots();
  }, [guildName]);

  useEffect(() => {
    if (selectedEndDate) {
      loadStatistics();
    }
  }, [selectedStartDate, selectedEndDate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    };

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);

  const loadSnapshots = async () => {
    if (!guildName) return;
    
    console.log('[GuildStatistics] Loading snapshots for guild:', guildName);
    setLoading(true);
    setError(null);
    
    try {
      const snapshotList = await window.electronAPI.getGuildSnapshots(guildName);
      console.log('[GuildStatistics] Received snapshots:', snapshotList);
      setSnapshots(snapshotList);
      
      // Auto-select earliest and most recent snapshots for comparison
      if (snapshotList.length >= 2) {
        const startDate = snapshotList[snapshotList.length - 1].captured_at;
        const endDate = snapshotList[0].captured_at;
        console.log('[GuildStatistics] Auto-selecting dates:');
        console.log('  Start (earliest):', startDate, 'Type:', typeof startDate);
        console.log('  End (most recent):', endDate, 'Type:', typeof endDate);
        setSelectedEndDate(endDate); // Most recent (first in DESC order)
        setSelectedStartDate(startDate); // Earliest (last in DESC order)
      } else if (snapshotList.length === 1) {
        const endDate = snapshotList[0].captured_at;
        console.log('[GuildStatistics] Single snapshot:', endDate, 'Type:', typeof endDate);
        setSelectedEndDate(endDate);
        setSelectedStartDate('');
      } else {
        console.log('[GuildStatistics] No snapshots found!');
      }
    } catch (err) {
      console.error('Error loading snapshots:', err);
      setError('Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  };

  const handleImportComplete = () => {
    console.log('[GuildStatistics] Import completed, refreshing data...');
    loadSnapshots();
  };

  const loadStatistics = async () => {
    if (!guildName) return;
    
    console.log('[GuildStatistics] Loading statistics for guild:', guildName);
    console.log('[GuildStatistics] Date range - Start:', selectedStartDate, 'End:', selectedEndDate);
    setLoading(true);
    setError(null);
    
    try {
      const stats = await window.electronAPI.getGuildStatistics(
        guildName,
        selectedStartDate || null,
        selectedEndDate || null
      );
      console.log('[GuildStatistics] Received statistics:', stats);
      setStatistics(stats);
    } catch (err) {
      console.error('Error loading guild statistics:', err);
      setError('Failed to load guild statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '-';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const formatChange = (change) => {
    if (!change || change === 0) return null;
    const sign = change > 0 ? '+' : '';
    return `${sign}${formatNumber(change)}`;
  };

  const getRankChangeIndicator = (rankChange) => {
    if (!rankChange || rankChange.previous === null) return null;
    
    const change = rankChange.change;
    const baseStyle = {
      display: 'inline-flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.15rem',
      minHeight: '24px',
      lineHeight: 1.2,
      fontSize: '0.8rem',
      padding: '0.2rem 0.4rem',
      verticalAlign: 'middle',
      whiteSpace: 'nowrap'
    };
    
    if (change > 0) {
      return <span className="rank-change rank-up" title={`Rank improved from ${rankChange.previous} to ${rankChange.current}`} style={baseStyle}>
        ↑{change}
      </span>;
    } else if (change < 0) {
      return <span className="rank-change rank-down" title={`Rank dropped from ${rankChange.previous} to ${rankChange.current}`} style={baseStyle}>
        ↓{Math.abs(change)}
      </span>;
    }
    return <span className="rank-change rank-same" title="Rank unchanged" style={baseStyle}>━</span>;
  };

  const handleSummarySort = (field) => {
    if (summarySortBy === field) {
      setSummarySortOrder(summarySortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSummarySortBy(field);
      setSummarySortOrder('desc');
    }
  };

  const handleExportImage = async () => {
    if (!rankingsRef.current || isExporting) return;
    
    setIsExporting(true);
    try {
      const rankingsDisplay = rankingsRef.current;
      const rankingsList = rankingsDisplay.querySelector('.rankings-list');
      
      // Store original styles
      const originalListStyles = {
        maxHeight: rankingsList.style.maxHeight,
        overflow: rankingsList.style.overflow,
        display: rankingsList.style.display,
        gridTemplateColumns: rankingsList.style.gridTemplateColumns,
        gap: rankingsList.style.gap,
        padding: rankingsList.style.padding
      };
      
      const originalDisplayWidth = rankingsDisplay.style.width;
      const originalDisplayMaxWidth = rankingsDisplay.style.maxWidth;
      
      // Apply export styles directly via inline styles (overrides CSS)
      rankingsList.style.maxHeight = 'none';
      rankingsList.style.overflow = 'visible';
      
      // Add compact class for export
      rankingsDisplay.classList.add('export-mode');
      
      // Wait longer for layout to fully update and render all items
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Convert the rankings display to PNG
      const dataUrl = await toPng(rankingsDisplay, {
        quality: 1.0,
        pixelRatio: 2, // Higher resolution for better quality
        backgroundColor: '#2A1520', // Match the background color
        cacheBust: true,
      });
      
      // Restore original styles completely
      rankingsDisplay.classList.remove('export-mode');
      
      // Reset all modified styles
      rankingsList.style.maxHeight = originalListStyles.maxHeight;
      rankingsList.style.overflow = originalListStyles.overflow;
      rankingsList.style.display = originalListStyles.display;
      rankingsList.style.gridTemplateColumns = originalListStyles.gridTemplateColumns;
      rankingsList.style.gap = originalListStyles.gap;
      rankingsList.style.padding = originalListStyles.padding;
      
      rankingsDisplay.style.width = originalDisplayWidth;
      rankingsDisplay.style.maxWidth = originalDisplayMaxWidth;
      
      // Force a reflow to ensure styles are applied
      rankingsDisplay.offsetHeight;
      
      // Save the image
      const statLabel = statLabels[selectedStat] || selectedStat;
      const result = await window.electronAPI.saveRankingImage(
        dataUrl, 
        guildName, 
        statLabel
      );
      
      if (result.success) {
        alert(`✅ Rankings saved!\n\nFile: ${result.filepath}\n\nYou can now share this image on Discord!`);
      }
    } catch (err) {
      console.error('Error exporting image:', err);
      alert('Failed to export rankings image. Please try again.');
      
      // Make sure we restore styles even on error
      if (rankingsRef.current) {
        rankingsRef.current.classList.remove('export-mode');
        const rankingsList = rankingsRef.current.querySelector('.rankings-list');
        if (rankingsList) {
          // Clear all inline styles to let CSS take over
          rankingsList.style.cssText = '';
        }
        rankingsRef.current.style.width = '';
        rankingsRef.current.style.maxWidth = '';
        // Force reflow
        rankingsRef.current.offsetHeight;
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSummary = async () => {
    if (!summaryRef.current || isExportingSummary) return;
    
    setIsExportingSummary(true);
    try {
      const summaryElement = summaryRef.current;
      
      // Store original styles
      const originalStyles = {
        maxHeight: summaryElement.style.maxHeight,
        overflow: summaryElement.style.overflow,
      };
      
      // Apply export styles
      summaryElement.style.maxHeight = 'none';
      summaryElement.style.overflow = 'visible';
      
      // Add export mode class
      summaryElement.classList.add('export-mode');
      
      // Wait for layout to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Convert to PNG
      const dataUrl = await toPng(summaryElement, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#2A1520',
        cacheBust: true,
      });
      
      // Restore original styles
      summaryElement.classList.remove('export-mode');
      summaryElement.style.maxHeight = originalStyles.maxHeight;
      summaryElement.style.overflow = originalStyles.overflow;
      
      // Force reflow
      summaryElement.offsetHeight;
      
      // Save the image
      const result = await window.electronAPI.saveRankingImage(
        dataUrl, 
        guildName, 
        'Player-Progress-Summary'
      );
      
      if (result.success) {
        alert(`✅ Player Progress Summary saved!\n\nFile: ${result.filepath}\n\nYou can now share this image on Discord!`);
      }
    } catch (err) {
      console.error('Error exporting summary:', err);
      alert('Failed to export Player Progress Summary. Please try again.');
      
      // Restore styles on error
      if (summaryRef.current) {
        summaryRef.current.classList.remove('export-mode');
        summaryRef.current.style.maxHeight = '';
        summaryRef.current.style.overflow = '';
        summaryRef.current.offsetHeight;
      }
    } finally {
      setIsExportingSummary(false);
    }
  };

  if (loading) {
    return <div className="guild-statistics loading">Loading guild statistics...</div>;
  }

  if (error) {
    return <div className="guild-statistics error">{error}</div>;
  }

  if (!statistics || !statistics.players || statistics.players.length === 0) {
    return <div className="guild-statistics empty">
      <p>No statistics available yet. Capture player data to see guild rankings!</p>
    </div>;
  }

  // Sort players by selected stat
  const rankedPlayers = [...statistics.players].sort((a, b) => b[selectedStat] - a[selectedStat]);

  const formatSnapshotDate = (timestamp) => {
    // Check if timestamp is date-only format (YYYY-MM-DD)
    if (timestamp.length === 10 && timestamp.includes('-')) {
      // Convert YYYY-MM-DD to DD/MM/YYYY
      const [year, month, day] = timestamp.split('-');
      return `${day}/${month}/${year}`;
    }
    
    // Otherwise parse as full timestamp
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return dateStr;
  };

  return (
    <div className="guild-statistics">
      <div className="statistics-header">
        <div className="header-left">
          <h2>{guildName} - Guild Rankings</h2>
        </div>
        <div className="header-right">
          <GuildDataExportImport 
            guildName={guildName}
            selectedDate={selectedEndDate}
            onImportComplete={handleImportComplete}
          />
        </div>
      </div>
      
      <div className="statistics-controls">
        <div className="snapshot-info">
          <div className="date-range-selector" ref={datePickerRef}>
            <button 
              className="date-picker-toggle"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              📅 {selectedStartDate && selectedEndDate ? (
                `Comparing: ${formatSnapshotDate(selectedStartDate)} → ${formatSnapshotDate(selectedEndDate)}`
              ) : selectedEndDate ? (
                `Data from: ${formatSnapshotDate(selectedEndDate)}`
              ) : (
                'Select Date Range'
              )}
            </button>
            
            {showDatePicker && (
              <div className="date-picker-dropdown">
                <div className="date-picker-content">
                  <div className="date-picker-row">
                    <label>Start Date:</label>
                    <select 
                      value={selectedStartDate} 
                      onChange={(e) => setSelectedStartDate(e.target.value)}
                    >
                      <option value="">None (Single snapshot)</option>
                      {snapshots.map(snapshot => (
                        <option key={snapshot.captured_at} value={snapshot.captured_at}>
                          {formatSnapshotDate(snapshot.captured_at)} ({snapshot.player_count} players)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="date-picker-row">
                    <label>End Date:</label>
                    <select 
                      value={selectedEndDate} 
                      onChange={(e) => setSelectedEndDate(e.target.value)}
                    >
                      <option value="">Select...</option>
                      {snapshots.map(snapshot => (
                        <option key={snapshot.captured_at} value={snapshot.captured_at}>
                          {formatSnapshotDate(snapshot.captured_at)} ({snapshot.player_count} players)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button 
                    className="date-picker-close"
                    onClick={() => setShowDatePicker(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="stat-selector">
        <label>View Rankings By:</label>
        <div className="stat-buttons">
          {Object.keys(statLabels).map(stat => (
            <button
              key={stat}
              className={`stat-button ${selectedStat === stat ? 'active' : ''}`}
              onClick={() => setSelectedStat(stat)}
            >
              {statLabels[stat]}
            </button>
          ))}
        </div>
      </div>

      <div className="rankings-display" ref={rankingsRef}>
        <div className="rankings-header" style={{
          background: 'linear-gradient(135deg, #5C2F3E 0%, #6E3848 100%)',
          padding: '1rem',
          borderRadius: '8px 8px 0 0',
          borderBottom: '2px solid #6E3848'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem'
          }}>
            <h3 style={{
              margin: 0,
              color: '#F5B942',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.6)',
              fontSize: '1.5rem'
            }}>
              {guildName} - {statLabels[selectedStat]} Rankings
            </h3>
            <button 
              className="camera-button"
              onClick={handleExportImage}
              disabled={isExporting}
              title="Save as image for Discord"
            >
              {isExporting ? '⏳' : '📸'}
            </button>
          </div>
          <div className="export-snapshot-info" style={{
            color: '#B8B8B8',
            fontSize: '0.9rem'
          }}>
            {statistics.previous_snapshot && (
              <span>
                {new Date(statistics.previous_snapshot).toLocaleDateString()} 
                {' → '}
                {new Date(statistics.current_snapshot).toLocaleDateString()}
              </span>
            )}
            {!statistics.previous_snapshot && (
              <span>
                Data from: {new Date(statistics.current_snapshot).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="rankings-list">
          {rankedPlayers.map((player, index) => {
            const rank = index + 1;
            const rankChange = player.rank_changes[selectedStat];
            const valueChange = player.changes[selectedStat];
            const hasPreviousData = statistics.previous_snapshot && valueChange !== undefined;

            return (
              <div 
                key={player.id} 
                className={`ranking-item rank-${rank <= 3 ? rank : 'other'}`}
                style={{
                  background: rank <= 3 ? `linear-gradient(135deg, rgba(${
                    rank === 1 ? '255,215,0' : rank === 2 ? '192,192,192' : '205,127,50'
                  }, 0.15) 0%, rgba(110,56,72,0.3) 100%)` : 'rgba(110,56,72,0.2)',
                  border: `2px solid ${rank <= 3 ? getRankBadgeColor(rank) : '#6E3848'}`,
                  borderRadius: '8px',
                  padding: '0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.3s ease'
                }}
              >
                <div className="rank-badge" style={{
                  background: getRankBadgeColor(rank),
                  color: '#2A1520',
                  fontWeight: 'bold',
                  fontSize: rank <= 3 ? '1.5rem' : '1.2rem',
                  width: rank <= 3 ? '50px' : '40px',
                  height: rank <= 3 ? '50px' : '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '1rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  border: '2px solid rgba(255,255,255,0.3)'
                }}>
                  {rank}
                </div>

                <div className="player-info" style={{ flex: 1 }}>
                  <div className="player-name" style={{
                    fontSize: rank <= 3 ? '1.3rem' : '1.1rem',
                    fontWeight: '600',
                    color: '#F5B942',
                    marginBottom: '0.25rem'
                  }}>
                    {player.name}
                  </div>
                  
                  <div className="player-stats" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    <div className="stat-value" style={{
                      fontSize: rank <= 3 ? '1.2rem' : '1rem',
                      color: '#E8E8E8',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {formatNumber(player[selectedStat])}
                    </div>

                    {hasPreviousData && valueChange !== 0 && (
                      <div className={`value-change ${valueChange > 0 ? 'positive' : 'negative'}`} style={{
                        fontSize: '0.8rem',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '4px',
                        background: valueChange > 0 ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)',
                        color: valueChange > 0 ? '#4CAF50' : '#F44336',
                        border: `1px solid ${valueChange > 0 ? '#4CAF50' : '#F44336'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        lineHeight: 1.2,
                        minHeight: '24px'
                      }}>
                        {formatChange(valueChange)}
                      </div>
                    )}

                    {getRankChangeIndicator(rankChange)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {statistics.previous_snapshot && (
        <div className="all-stats-summary" ref={summaryRef}>
          <div className="summary-header" style={{
            background: 'linear-gradient(135deg, #5C2F3E 0%, #6E3848 100%)',
            padding: '1rem',
            borderRadius: '8px 8px 0 0',
            borderBottom: '2px solid #6E3848',
            marginBottom: '1rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem'
            }}>
              <h3 style={{
                margin: 0,
                color: '#F5B942',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.6)',
                fontSize: '1.5rem'
              }}>
                Player Progress Summary
              </h3>
              <button 
                className="camera-button"
                onClick={handleExportSummary}
                disabled={isExportingSummary}
                title="Save as image for Discord"
              >
                {isExportingSummary ? '⏳' : '📸'}
              </button>
            </div>
            <div className="export-snapshot-info" style={{
              color: '#B8B8B8',
              fontSize: '0.9rem'
            }}>
              <span>
                {formatSnapshotDate(selectedStartDate)} 
                {' → '}
                {formatSnapshotDate(selectedEndDate)}
              </span>
            </div>
          </div>
          <div className="summary-table-container">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th onClick={() => handleSummarySort('net_worth')} style={{ cursor: 'pointer' }}>
                    Net Worth {summarySortBy === 'net_worth' && (summarySortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSummarySort('prestige')} style={{ cursor: 'pointer' }}>
                    Prestige {summarySortBy === 'prestige' && (summarySortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSummarySort('invested')} style={{ cursor: 'pointer' }}>
                    Invested {summarySortBy === 'invested' && (summarySortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSummarySort('mastered')} style={{ cursor: 'pointer' }}>
                    Mastered {summarySortBy === 'mastered' && (summarySortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSummarySort('helped')} style={{ cursor: 'pointer' }}>
                    Helped {summarySortBy === 'helped' && (summarySortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSummarySort('ascensions')} style={{ cursor: 'pointer' }}>
                    Ascensions {summarySortBy === 'ascensions' && (summarySortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSummarySort('bounty_trophies')} style={{ cursor: 'pointer' }}>
                    Bounty {summarySortBy === 'bounty_trophies' && (summarySortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSummarySort('collection_score')} style={{ cursor: 'pointer' }}>
                    Collection {summarySortBy === 'collection_score' && (summarySortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...statistics.players].sort((a, b) => {
                  // Parse as numbers to ensure proper numeric sorting
                  const aVal = parseFloat(a[summarySortBy]) || 0;
                  const bVal = parseFloat(b[summarySortBy]) || 0;
                  return summarySortOrder === 'desc' ? bVal - aVal : aVal - bVal;
                }).map(player => (
                  <tr key={player.id}>
                    <td className="player-name-cell">{player.name}</td>
                    {Object.keys(statLabels).map(stat => {
                      const change = player.changes[stat];
                      const rankChange = player.rank_changes[stat];
                      return (
                        <td key={stat} className="stat-cell">
                          <div className="stat-cell-content">
                            <span className="stat-value">{formatNumber(player[stat])}</span>
                            {change !== undefined && (
                              <>
                                <span className={`stat-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'}`}>
                                  {change !== 0 ? formatChange(change) : '━'}
                                </span>
                                <span className="stat-rank" title={`Rank: ${rankChange.current}${rankChange.previous ? ` (was ${rankChange.previous})` : ''}`}>
                                  #{rankChange.current}
                                  {rankChange.change !== 0 && (
                                    <span className={rankChange.change > 0 ? 'rank-improved' : 'rank-dropped'}>
                                      {rankChange.change > 0 ? '↑' : '↓'}
                                    </span>
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default GuildStatistics;


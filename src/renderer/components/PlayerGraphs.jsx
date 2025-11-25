import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

function PlayerGraphs({ player, history }) {
  // State for date range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStats, setSelectedStats] = useState({
    net_worth: false,
    prestige: false,
    invested: true,
    registered: false,
    helped: false,
    ascensions: false,
    bounty_trophies: false,
    collection_score: false
  });

  // Get date range from history
  const dateRange = useMemo(() => {
    if (!history || history.length === 0) return { min: null, max: null };
    
    const dates = history.map(h => new Date(h.captured_at));
    return {
      min: new Date(Math.min(...dates)),
      max: new Date(Math.max(...dates))
    };
  }, [history]);

  // Filter history based on date range
  const filteredHistory = useMemo(() => {
    if (!history) return [];
    
    let filtered = [...history];
    
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(h => new Date(h.captured_at) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include entire end date
      filtered = filtered.filter(h => new Date(h.captured_at) <= end);
    }
    
    return filtered.sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
  }, [history, startDate, endDate]);

  // Format data for charts
  const formatChartData = (statKey) => {
    return filteredHistory.map(record => ({
      timestamp: new Date(record.captured_at).toLocaleString(),
      date: new Date(record.captured_at).toLocaleDateString(),
      value: parseValue(record[statKey]),
      rawValue: record[statKey]
    }));
  };

  const parseValue = (value) => {
    if (value === null || value === undefined || value === '-') return 0;
    if (typeof value === 'number') return value;
    // Remove commas and parse
    const cleaned = String(value).replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatNumber = (num) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(0);
  };

  const formatYAxis = (value) => {
    return formatNumber(value);
  };

  const formatTooltip = (value) => {
    if (value >= 1000) {
      return value.toLocaleString();
    }
    return value;
  };

  const statConfigs = {
    net_worth: { name: 'Net Worth', color: '#82ca9d', unit: '' },
    prestige: { name: 'Prestige', color: '#ffc658', unit: '' },
    invested: { name: 'Invested', color: '#ff7c7c', unit: '' },
    registered: { name: 'Mastered', color: '#8dd1e1', unit: '' },
    helped: { name: 'Helped', color: '#d084d0', unit: '' },
    ascensions: { name: 'Ascensions', color: '#a4de6c', unit: '' },
    bounty_trophies: { name: 'Bounty Trophies', color: '#d0a044', unit: '' },
    collection_score: { name: 'Collection Score', color: '#8e44ad', unit: '' }
  };

  const handleStatToggle = (statKey) => {
    setSelectedStats(prev => ({ ...prev, [statKey]: !prev[statKey] }));
  };

  const handleSelectAll = () => {
    const newState = {};
    Object.keys(selectedStats).forEach(key => {
      newState[key] = true;
    });
    setSelectedStats(newState);
  };

  const handleDeselectAll = () => {
    const newState = {};
    Object.keys(selectedStats).forEach(key => {
      newState[key] = false;
    });
    setSelectedStats(newState);
  };

  const handleResetDates = () => {
    setStartDate('');
    setEndDate('');
  };

  if (!history || history.length === 0) {
    return (
      <div className="player-graphs">
        <h3>No Historical Data</h3>
        <p>Capture more data points to see graphs and trends.</p>
      </div>
    );
  }

  const formatDateForInput = (date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="player-graphs">
      <div className="graphs-header">
        <h3>Statistics History for {player.name || player.id}</h3>
        <p className="data-points">{filteredHistory.length} data points</p>
      </div>

      <div className="date-range-controls">
        <div className="date-inputs">
          <div className="date-input-group">
            <label>Start Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={dateRange.min ? formatDateForInput(dateRange.min) : ''}
              max={dateRange.max ? formatDateForInput(dateRange.max) : ''}
            />
          </div>
          <div className="date-input-group">
            <label>End Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={dateRange.min ? formatDateForInput(dateRange.min) : ''}
              max={dateRange.max ? formatDateForInput(dateRange.max) : ''}
            />
          </div>
          <button className="btn btn-secondary btn-small" onClick={handleResetDates}>
            Reset Range
          </button>
        </div>
        {dateRange.min && dateRange.max && (
          <p className="date-range-info">
            Available data: {dateRange.min.toLocaleDateString()} to {dateRange.max.toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="stat-toggles">
        <div className="toggle-header">
          <span>Select Statistics to Display:</span>
          <div className="toggle-actions">
            <button className="btn-link" onClick={handleSelectAll}>Select All</button>
            <button className="btn-link" onClick={handleDeselectAll}>Deselect All</button>
          </div>
        </div>
        <div className="toggle-buttons">
          {Object.entries(statConfigs).map(([key, config]) => (
            <button
              key={key}
              className={`btn-toggle ${selectedStats[key] ? 'active' : ''}`}
              onClick={() => handleStatToggle(key)}
              style={{ borderColor: selectedStats[key] ? config.color : '#ccc' }}
            >
              <span className="color-dot" style={{ backgroundColor: config.color }}></span>
              {config.name}
            </button>
          ))}
        </div>
      </div>

      <div className="graphs-container">
        {Object.entries(statConfigs).map(([statKey, config]) => {
          if (!selectedStats[statKey]) return null;

          const data = formatChartData(statKey);
          
          // Skip if no valid data
          if (data.every(d => d.value === 0)) {
            return (
              <div key={statKey} className="graph-card">
                <h4>{config.name}</h4>
                <p className="no-data">No data available for this statistic</p>
              </div>
            );
          }

          return (
            <div key={statKey} className="graph-card">
              <h4>{config.name}</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value) => [formatTooltip(value), config.name]}
                    labelStyle={{ color: '#333' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={config.color}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name={config.name}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>

      {Object.values(selectedStats).every(v => !v) && (
        <div className="no-stats-selected">
          <p>Select at least one statistic to display graphs.</p>
        </div>
      )}
    </div>
  );
}

export default PlayerGraphs;


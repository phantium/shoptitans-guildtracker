/**
 * Data export utilities for CSV and JSON formats
 */

class DataExporter {
  /**
   * Export player data to JSON format
   */
  exportToJSON(players) {
    const data = {
      exported_at: new Date().toISOString(),
      total_players: players.length,
      players: players
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export player data to CSV format
   */
  exportToCSV(players) {
    if (!players || players.length === 0) {
      return 'No data to export';
    }

    // Define CSV headers
    const headers = [
      'Player ID',
      'Player Name',
      'Guild Name',
      'Net Worth',
      'Prestige',
      'Invested',
      'Mastered',
      'Helped',
      'Ascensions',
      'Bounty Trophies',
      'Collection Score',
      'First Seen',
      'Last Seen',
      'Captured At'
    ];

    // Create CSV rows
    const rows = players.map(player => [
      this.escapeCsvField(player.id || ''),
      this.escapeCsvField(player.name || ''),
      this.escapeCsvField(player.guild_name || ''),
      this.escapeCsvField(player.net_worth || ''),
      this.escapeCsvField(player.prestige || ''),
      this.escapeCsvField(player.invested || ''),
      player.registered || '',
      player.helped || '',
      player.ascensions || '',
      player.bounty_trophies || '',
      player.collection_score || '',
      player.first_seen || '',
      player.last_seen || '',
      player.captured_at || ''
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Export historical data with multiple timestamps per player
   */
  exportHistoricalToCSV(historyData) {
    if (!historyData || historyData.length === 0) {
      return 'No historical data to export';
    }

    const headers = [
      'Timestamp',
      'Player ID',
      'Player Name',
      'Guild Name',
      'Net Worth',
      'Prestige',
      'Invested',
      'Mastered',
      'Helped',
      'Ascensions',
      'Bounty Trophies',
      'Collection Score'
    ];

    const rows = historyData.map(record => [
      record.captured_at || '',
      this.escapeCsvField(record.player_id || record.id || ''),
      this.escapeCsvField(record.name || ''),
      this.escapeCsvField(record.guild_name || ''),
      this.escapeCsvField(record.net_worth || ''),
      this.escapeCsvField(record.prestige || ''),
      this.escapeCsvField(record.invested || ''),
      record.registered || '',
      record.helped || '',
      record.ascensions || '',
      record.bounty_trophies || '',
      record.collection_score || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Escape CSV field if it contains special characters
   */
  escapeCsvField(field) {
    if (field === null || field === undefined) {
      return '';
    }
    
    const fieldStr = String(field);
    
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
      return `"${fieldStr.replace(/"/g, '""')}"`;
    }
    
    return fieldStr;
  }

  /**
   * Create download blob for browser
   */
  createDownloadBlob(content, type) {
    const mimeTypes = {
      'json': 'application/json',
      'csv': 'text/csv'
    };
    
    return new Blob([content], { type: mimeTypes[type] || 'text/plain' });
  }

  /**
   * Trigger download in browser (for renderer process)
   */
  triggerDownload(content, filename, type) {
    const blob = this.createDownloadBlob(content, type);
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export using Electron's file system (via IPC)
   */
  async exportViaElectron(data, format) {
    let content;
    
    if (format === 'json') {
      content = this.exportToJSON(data);
    } else if (format === 'csv') {
      content = this.exportToCSV(data);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
    
    try {
      const result = await window.electronAPI.exportData(format, content);
      return result;
    } catch (error) {
      console.error('Error exporting via Electron:', error);
      throw error;
    }
  }
}

// Export singleton instance
const dataExporter = new DataExporter();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = dataExporter;
}


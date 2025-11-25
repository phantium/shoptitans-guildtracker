const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  captureScreen: (sourceId) => ipcRenderer.invoke('capture-screen', sourceId),
  getScreenResolution: () => ipcRenderer.invoke('get-screen-resolution'),
  getSourceDimensions: (sourceId) => ipcRenderer.invoke('get-source-dimensions', sourceId),
  savePlayerStats: (data) => ipcRenderer.invoke('save-player-stats', data),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getAllPlayers: () => ipcRenderer.invoke('get-all-players'),
  getPlayerHistory: (playerId) => ipcRenderer.invoke('get-player-history', playerId),
  deleteHistoryEntry: (entryId) => ipcRenderer.invoke('delete-history-entry', entryId),
  getAllPlayerNames: (guildName) => ipcRenderer.invoke('get-all-player-names', guildName),
  renamePlayer: (oldPlayerId, newPlayerName) => ipcRenderer.invoke('rename-player', oldPlayerId, newPlayerName),
  cleanupOrphanedPlayers: () => ipcRenderer.invoke('cleanup-orphaned-players'),
  cleanupDuplicatePlayers: () => ipcRenderer.invoke('cleanup-duplicate-players'),
  getGuildStatistics: (guildName, previousSnapshotId, currentSnapshotId) => ipcRenderer.invoke('get-guild-statistics', guildName, previousSnapshotId, currentSnapshotId),
  getGuildSnapshots: (guildName) => ipcRenderer.invoke('get-guild-snapshots', guildName),
  exportData: (format, data) => ipcRenderer.invoke('export-data', format, data),
  saveOCRDebug: (ocrText) => ipcRenderer.invoke('save-ocr-debug', ocrText),
  paddleOCRExtract: (imageDataUrl) => ipcRenderer.invoke('paddle-ocr-extract', imageDataUrl),
  saveRankingImage: (imageData, guildName, statName) => ipcRenderer.invoke('save-ranking-image', imageData, guildName, statName),
  exportGuildSnapshot: (guildName, snapshotDate) => ipcRenderer.invoke('export-guild-snapshot', guildName, snapshotDate),
  previewImportSnapshot: (importData) => ipcRenderer.invoke('preview-import-snapshot', importData),
  importGuildSnapshot: (importData, options) => ipcRenderer.invoke('import-guild-snapshot', importData, options)
});


const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get data directory from environment variable (set by main.js)
// Fallback to local path for development
const dataDir = process.env.APP_DATA_DIR || path.join(__dirname, '../../data');
const dbPath = path.join(dataDir, 'shop-titans.db');

console.log('Database path:', dbPath);

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Split and execute each statement
  const statements = schema.split(';').filter(stmt => stmt.trim());
  statements.forEach(statement => {
    if (statement.trim()) {
      db.exec(statement);
    }
  });
  
  // Migrate existing databases - add window bounds columns if they don't exist
  try {
    // Check if window_x column exists
    const tableInfo = db.prepare('PRAGMA table_info(settings)').all();
    const hasWindowColumns = tableInfo.some(col => col.name === 'window_x');
    
    if (!hasWindowColumns) {
      console.log('Migrating database: Adding window bounds columns...');
      db.exec(`
        ALTER TABLE settings ADD COLUMN window_x INTEGER;
        ALTER TABLE settings ADD COLUMN window_y INTEGER;
        ALTER TABLE settings ADD COLUMN window_width INTEGER;
        ALTER TABLE settings ADD COLUMN window_height INTEGER;
      `);
      console.log('Migration complete!');
    }
    
    // Check if source dimensions columns exist
    const hasSourceDimensions = tableInfo.some(col => col.name === 'source_width');
    
    if (!hasSourceDimensions) {
      console.log('Migrating database: Adding source dimensions columns...');
      db.exec(`
        ALTER TABLE settings ADD COLUMN source_width INTEGER;
        ALTER TABLE settings ADD COLUMN source_height INTEGER;
      `);
      console.log('Source dimensions migration complete!');
    }
  } catch (error) {
    console.error('Database migration error:', error);
    // Continue anyway - the columns might already exist
  }
}

// Initialize on load
initializeDatabase();

// Settings operations
function getSettings() {
  const stmt = db.prepare('SELECT * FROM settings WHERE id = 1');
  const settings = stmt.get();
  
  if (!settings) {
    // Return default settings if none exist
    return {
      guild_name: '',
      capture_source: null,
      capture_region: null,
      screen_width: null,
      screen_height: null,
      window_x: null,
      window_y: null,
      window_width: null,
      window_height: null,
      source_width: null,
      source_height: null
    };
  }
  
  // Parse capture_source from JSON if it exists (handle both old string format and new object format)
  if (settings.capture_source) {
    try {
      // Check if it's already an object (legacy format) or needs parsing
      if (typeof settings.capture_source === 'string' && settings.capture_source.startsWith('{')) {
        settings.capture_source = JSON.parse(settings.capture_source);
      }
      // If it's already a plain string ID, leave it as is for backward compatibility
    } catch (e) {
      console.error('Error parsing capture_source:', e);
      // Keep as is if parsing fails (might be old format with just ID string)
    }
  }
  
  // Parse capture_region from JSON if it exists
  if (settings.capture_region) {
    try {
      settings.capture_region = JSON.parse(settings.capture_region);
    } catch (e) {
      console.error('Error parsing capture_region:', e);
      settings.capture_region = null;
    }
  }
  
  return settings;
}

function saveSettings(settings) {
  // Stringify capture_source if it's an object
  let captureSourceStr = settings.capture_source;
  if (captureSourceStr && typeof captureSourceStr === 'object') {
    captureSourceStr = JSON.stringify(captureSourceStr);
  }
  
  // Stringify capture_region if it's an object
  let captureRegionStr = settings.capture_region;
  if (captureRegionStr && typeof captureRegionStr === 'object') {
    captureRegionStr = JSON.stringify(captureRegionStr);
  }
  
  const stmt = db.prepare(`
    INSERT INTO settings (id, guild_name, capture_source, capture_region, screen_width, screen_height, window_x, window_y, window_width, window_height, source_width, source_height, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      guild_name = excluded.guild_name,
      capture_source = excluded.capture_source,
      capture_region = excluded.capture_region,
      screen_width = excluded.screen_width,
      screen_height = excluded.screen_height,
      window_x = excluded.window_x,
      window_y = excluded.window_y,
      window_width = excluded.window_width,
      window_height = excluded.window_height,
      source_width = excluded.source_width,
      source_height = excluded.source_height,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  stmt.run(
    settings.guild_name || '',
    captureSourceStr || null,
    captureRegionStr || null,
    settings.screen_width || null,
    settings.screen_height || null,
    settings.window_x || null,
    settings.window_y || null,
    settings.window_width || null,
    settings.window_height || null,
    settings.source_width || null,
    settings.source_height || null
  );
  return { success: true };
}

function saveWindowBounds(bounds) {
  const stmt = db.prepare(`
    INSERT INTO settings (id, guild_name, window_x, window_y, window_width, window_height, updated_at)
    VALUES (1, '', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      window_x = excluded.window_x,
      window_y = excluded.window_y,
      window_width = excluded.window_width,
      window_height = excluded.window_height,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  stmt.run(
    bounds.x || null,
    bounds.y || null,
    bounds.width || null,
    bounds.height || null
  );
  return { success: true };
}

// Player operations
function savePlayerStats(data) {
  const insertPlayer = db.prepare(`
    INSERT INTO players (id, name, guild_name, last_seen)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      guild_name = excluded.guild_name,
      last_seen = CURRENT_TIMESTAMP
  `);
  
  const insertStats = db.prepare(`
    INSERT INTO statistics (
      player_id, level, net_worth, prestige, invested,
      registered, helped, ascensions, bounty_trophies,
      collection_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((playerData) => {
    insertPlayer.run(
      playerData.id,
      playerData.name,
      playerData.guild_name
    );
    
    insertStats.run(
      playerData.id,
      playerData.level,
      playerData.net_worth,
      playerData.prestige,
      playerData.invested,
      playerData.registered,
      playerData.helped,
      playerData.ascensions,
      playerData.bounty_trophies,
      playerData.collection_score
    );
  });
  
  transaction(data);
  return { success: true };
}

function getAllPlayers() {
  const stmt = db.prepare(`
    SELECT 
      p.*,
      s.level,
      s.net_worth,
      s.prestige,
      s.invested,
      s.registered,
      s.helped,
      s.ascensions,
      s.bounty_trophies,
      s.collection_score,
      s.captured_at
    FROM players p
    LEFT JOIN statistics s ON p.id = s.player_id
    WHERE s.id IN (
      SELECT MAX(id)
      FROM statistics
      GROUP BY player_id
    )
    ORDER BY p.last_seen DESC
  `);
  
  return stmt.all();
}

function getPlayerHistory(playerId) {
  const stmt = db.prepare(`
    SELECT * FROM statistics
    WHERE player_id = ?
    ORDER BY captured_at DESC
  `);
  
  return stmt.all(playerId);
}

function deleteHistoryEntry(entryId) {
  const transaction = db.transaction(() => {
    // Get the player_id before deleting the entry
    const getPlayerStmt = db.prepare('SELECT player_id FROM statistics WHERE id = ?');
    const entry = getPlayerStmt.get(entryId);
    
    if (!entry) {
      return { success: false, changes: 0 };
    }
    
    const playerId = entry.player_id;
    
    // Delete the statistics entry
    const deleteStmt = db.prepare('DELETE FROM statistics WHERE id = ?');
    const result = deleteStmt.run(entryId);
    
    if (result.changes > 0) {
      // Check if the player has any remaining statistics
      const checkStmt = db.prepare('SELECT COUNT(*) as count FROM statistics WHERE player_id = ?');
      const remaining = checkStmt.get(playerId);
      
      // If no statistics remain, delete the player record
      if (remaining.count === 0) {
        const deletePlayerStmt = db.prepare('DELETE FROM players WHERE id = ?');
        deletePlayerStmt.run(playerId);
      }
    }
    
    return { success: result.changes > 0, changes: result.changes };
  });
  
  return transaction();
}

// Export data functions
function getAllPlayersForExport() {
  return getAllPlayers();
}

function getHistoricalData(startDate, endDate) {
  let query = `
    SELECT 
      p.id,
      p.name,
      p.guild_name,
      s.*
    FROM statistics s
    JOIN players p ON s.player_id = p.id
  `;
  
  const conditions = [];
  const params = [];
  
  if (startDate) {
    conditions.push('s.captured_at >= ?');
    params.push(startDate);
  }
  
  if (endDate) {
    conditions.push('s.captured_at <= ?');
    params.push(endDate);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY s.captured_at DESC';
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// Get all unique player names for autocomplete
function getAllPlayerNames(guildName = null) {
  let query = 'SELECT DISTINCT name FROM players';
  const params = [];
  
  if (guildName) {
    query += ' WHERE guild_name = ?';
    params.push(guildName);
  }
  
  query += ' ORDER BY name ASC';
  
  const stmt = db.prepare(query);
  const results = stmt.all(...params);
  return results.map(row => row.name);
}

// Clean up orphaned players (players with no statistics)
function cleanupOrphanedPlayers() {
  const stmt = db.prepare(`
    DELETE FROM players
    WHERE id NOT IN (SELECT DISTINCT player_id FROM statistics)
  `);
  
  const result = stmt.run();
  return { success: true, deleted: result.changes };
}

// Get guild statistics with rankings and comparisons
function getGuildStatistics(guildName, previousSnapshotTimestamp = null, currentSnapshotTimestamp = null) {
  // console.log('===== getGuildStatistics called =====');
  // console.log('Guild:', guildName);
  // console.log('Previous timestamp:', previousSnapshotTimestamp);
  // console.log('Current timestamp:', currentSnapshotTimestamp);
  
  // Get current stats (either specified snapshot or latest)
  let currentStatsStmt;
  let currentStats;
  
  if (currentSnapshotTimestamp) {
    // Check if timestamp is date-only (YYYY-MM-DD) or full timestamp
    const isDateOnly = currentSnapshotTimestamp.length === 10;
    
    if (isDateOnly) {
      // Query for latest stats from that specific day
      // console.log('Using date-only query for:', currentSnapshotTimestamp);
      currentStatsStmt = db.prepare(`
        SELECT 
          p.id,
          p.name,
          p.guild_name,
          s.net_worth,
          s.prestige,
          s.invested,
          s.registered as mastered,
          s.helped,
          s.ascensions,
          s.bounty_trophies,
          s.collection_score,
          s.captured_at
        FROM players p
        JOIN statistics s ON p.id = s.player_id
        WHERE p.guild_name = ? 
          AND DATE(s.captured_at) = ?
          AND s.id IN (
            SELECT MAX(s2.id)
            FROM statistics s2
            WHERE s2.player_id = p.id
              AND DATE(s2.captured_at) = ?
          )
        ORDER BY p.name
      `);
      currentStats = currentStatsStmt.all(guildName, currentSnapshotTimestamp, currentSnapshotTimestamp);
    } else {
      // Query for specific timestamp (rounded to 10 minutes)
      // console.log('Using timestamp query for:', currentSnapshotTimestamp);
      currentStatsStmt = db.prepare(`
        SELECT 
          p.id,
          p.name,
          p.guild_name,
          s.net_worth,
          s.prestige,
          s.invested,
          s.registered as mastered,
          s.helped,
          s.ascensions,
          s.bounty_trophies,
          s.collection_score,
          s.captured_at
        FROM players p
        JOIN statistics s ON p.id = s.player_id
        WHERE p.guild_name = ? 
          AND datetime((strftime('%s', s.captured_at) / 600) * 600, 'unixepoch') = ?
          AND s.id IN (
            SELECT MAX(s2.id)
            FROM statistics s2
            WHERE s2.player_id = p.id
              AND datetime((strftime('%s', s2.captured_at) / 600) * 600, 'unixepoch') = ?
          )
        ORDER BY p.name
      `);
      currentStats = currentStatsStmt.all(guildName, currentSnapshotTimestamp, currentSnapshotTimestamp);
    }
  } else {
    // Get latest snapshot for each player
    currentStatsStmt = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.guild_name,
        s.net_worth,
        s.prestige,
        s.invested,
        s.registered as mastered,
        s.helped,
        s.ascensions,
        s.bounty_trophies,
        s.collection_score,
        s.captured_at
      FROM players p
      JOIN statistics s ON p.id = s.player_id
      WHERE p.guild_name = ? 
        AND s.id IN (
          SELECT MAX(id)
          FROM statistics
          WHERE player_id = p.id
        )
      ORDER BY p.name
    `);
    currentStats = currentStatsStmt.all(guildName);
  }
  
  if (currentStats.length === 0) {
    // console.log('No current stats found - returning empty result');
    // console.log('===== getGuildStatistics end =====\n');
    return {
      guild_name: guildName,
      current_snapshot: null,
      previous_snapshot: null,
      players: [],
      rankings: {}
    };
  }
  
  // console.log('Found', currentStats.length, 'current stats');
  
  // Get the timestamp range for current data
  const currentCaptureTime = currentStats[0].captured_at;
  
  // Get previous stats (either specified snapshot or second-to-last)
  let previousStatsStmt;
  let previousStats;
  let previousCaptureTime = null;
  
  if (previousSnapshotTimestamp) {
    // Check if timestamp is date-only (YYYY-MM-DD) or full timestamp
    const isPreviousDateOnly = previousSnapshotTimestamp.length === 10;
    
    if (isPreviousDateOnly) {
      // Query for latest stats from that specific day
      // console.log('Using date-only query for previous:', previousSnapshotTimestamp);
      previousStatsStmt = db.prepare(`
        SELECT 
          p.id,
          p.name,
          s.net_worth,
          s.prestige,
          s.invested,
          s.registered as mastered,
          s.helped,
          s.ascensions,
          s.bounty_trophies,
          s.collection_score,
          s.captured_at
        FROM players p
        JOIN statistics s ON p.id = s.player_id
        WHERE p.guild_name = ?
          AND DATE(s.captured_at) = ?
          AND s.id IN (
            SELECT MAX(s2.id)
            FROM statistics s2
            WHERE s2.player_id = p.id
              AND DATE(s2.captured_at) = ?
          )
      `);
      previousStats = previousStatsStmt.all(guildName, previousSnapshotTimestamp, previousSnapshotTimestamp);
      previousCaptureTime = previousStats.length > 0 ? previousStats[0].captured_at : null;
    } else {
      // Query for specific timestamp (rounded to 10 minutes)
      // console.log('Using timestamp query for previous:', previousSnapshotTimestamp);
      previousStatsStmt = db.prepare(`
        SELECT 
          p.id,
          p.name,
          s.net_worth,
          s.prestige,
          s.invested,
          s.registered as mastered,
          s.helped,
          s.ascensions,
          s.bounty_trophies,
          s.collection_score,
          s.captured_at
        FROM players p
        JOIN statistics s ON p.id = s.player_id
        WHERE p.guild_name = ?
          AND datetime((strftime('%s', s.captured_at) / 600) * 600, 'unixepoch') = ?
          AND s.id IN (
            SELECT MAX(s2.id)
            FROM statistics s2
            WHERE s2.player_id = p.id
              AND datetime((strftime('%s', s2.captured_at) / 600) * 600, 'unixepoch') = ?
          )
      `);
      previousStats = previousStatsStmt.all(guildName, previousSnapshotTimestamp, previousSnapshotTimestamp);
      previousCaptureTime = previousStats.length > 0 ? previousStats[0].captured_at : null;
    }
  } else {
    // Get second-to-last snapshot for each player
    previousStatsStmt = db.prepare(`
      SELECT 
        p.id,
        p.name,
        s.net_worth,
        s.prestige,
        s.invested,
        s.registered as mastered,
        s.helped,
        s.ascensions,
        s.bounty_trophies,
        s.collection_score,
        s.captured_at
      FROM players p
      JOIN statistics s ON p.id = s.player_id
      WHERE p.guild_name = ?
        AND s.id IN (
          SELECT s2.id
          FROM statistics s2
          WHERE s2.player_id = p.id
          ORDER BY s2.id DESC
          LIMIT 1 OFFSET 1
        )
    `);
    previousStats = previousStatsStmt.all(guildName);
    previousCaptureTime = previousStats.length > 0 ? previousStats[0].captured_at : null;
  }
  
  // Convert to map for easy lookup
  const previousStatsMap = {};
  previousStats.forEach(stat => {
    previousStatsMap[stat.id] = stat;
  });
  
  // Parse numeric values and calculate changes
  const statsWithChanges = currentStats.map(current => {
    const previous = previousStatsMap[current.id];
    
    // Helper to parse numeric values (handle commas and large numbers)
    const parseValue = (val) => {
      if (!val) return 0;
      return parseFloat(String(val).replace(/,/g, '')) || 0;
    };
    
    const result = {
      id: current.id,
      name: current.name,
      guild_name: current.guild_name,
      captured_at: current.captured_at,
      net_worth: parseValue(current.net_worth),
      prestige: parseValue(current.prestige),
      invested: parseValue(current.invested),
      mastered: parseValue(current.mastered),
      helped: parseValue(current.helped),
      ascensions: parseValue(current.ascensions),
      bounty_trophies: parseValue(current.bounty_trophies),
      collection_score: parseValue(current.collection_score),
      changes: {}
    };
    
    // Calculate changes if previous data exists
    if (previous) {
      const stats = ['net_worth', 'prestige', 'invested', 'mastered', 'helped', 'ascensions', 'bounty_trophies', 'collection_score'];
      stats.forEach(stat => {
        const prevVal = parseValue(previous[stat]);
        const currVal = result[stat];
        result.changes[stat] = currVal - prevVal;
      });
    }
    
    return result;
  });
  
  // Calculate rankings for each stat
  const statTypes = ['net_worth', 'prestige', 'invested', 'mastered', 'helped', 'ascensions', 'bounty_trophies', 'collection_score'];
  const rankings = {};
  
  statTypes.forEach(statType => {
    // Sort by stat value (descending)
    const sorted = [...statsWithChanges].sort((a, b) => b[statType] - a[statType]);
    
    // Assign ranks (handle ties)
    let currentRank = 1;
    let previousValue = null;
    let playersWithSameRank = 0;
    
    rankings[statType] = {};
    sorted.forEach((player, index) => {
      if (previousValue !== null && player[statType] === previousValue) {
        // Same value as previous, same rank
        rankings[statType][player.id] = currentRank;
        playersWithSameRank++;
      } else {
        // Different value, new rank (skip ranks if there were ties)
        currentRank = index + 1;
        rankings[statType][player.id] = currentRank;
        playersWithSameRank = 0;
      }
      previousValue = player[statType];
    });
  });
  
  // Calculate previous rankings if we have previous data
  let previousRankings = {};
  if (previousStats.length > 0) {
    const previousParsed = previousStats.map(stat => ({
      id: stat.id,
      net_worth: parseFloat(String(stat.net_worth).replace(/,/g, '')) || 0,
      prestige: parseFloat(String(stat.prestige).replace(/,/g, '')) || 0,
      invested: parseFloat(String(stat.invested).replace(/,/g, '')) || 0,
      mastered: parseFloat(String(stat.mastered).replace(/,/g, '')) || 0,
      helped: parseFloat(String(stat.helped).replace(/,/g, '')) || 0,
      ascensions: parseFloat(String(stat.ascensions).replace(/,/g, '')) || 0,
      bounty_trophies: parseFloat(String(stat.bounty_trophies).replace(/,/g, '')) || 0,
      collection_score: parseFloat(String(stat.collection_score).replace(/,/g, '')) || 0,
    }));
    
    statTypes.forEach(statType => {
      const sorted = [...previousParsed].sort((a, b) => b[statType] - a[statType]);
      previousRankings[statType] = {};
      
      let currentRank = 1;
      let previousValue = null;
      
      sorted.forEach((player, index) => {
        if (previousValue !== null && player[statType] === previousValue) {
          previousRankings[statType][player.id] = currentRank;
        } else {
          currentRank = index + 1;
          previousRankings[statType][player.id] = currentRank;
        }
        previousValue = player[statType];
      });
    });
  }
  
  // Add rank changes to each player
  statsWithChanges.forEach(player => {
    player.rank_changes = {};
    statTypes.forEach(statType => {
      const currentRank = rankings[statType][player.id];
      const previousRank = previousRankings[statType] ? previousRankings[statType][player.id] : null;
      
      player.rank_changes[statType] = {
        current: currentRank,
        previous: previousRank,
        change: previousRank ? (previousRank - currentRank) : 0 // Positive = rank improved (lower number)
      };
    });
  });
  
  // console.log('Returning', statsWithChanges.length, 'players with stats');
  // console.log('===== getGuildStatistics end =====\n');
  
  return {
    guild_name: guildName,
    current_snapshot: currentCaptureTime,
    previous_snapshot: previousCaptureTime,
    players: statsWithChanges,
    rankings: rankings
  };
}

// Clean up duplicate players with the same name in the same guild
function cleanupDuplicatePlayers() {
  const transaction = db.transaction(() => {
    // Find all duplicate player names within the same guild
    const duplicatesStmt = db.prepare(`
      SELECT name, guild_name, COUNT(*) as count
      FROM players
      GROUP BY LOWER(name), guild_name
      HAVING count > 1
    `);
    
    const duplicates = duplicatesStmt.all();
    console.log(`Found ${duplicates.length} groups of duplicate players`);
    
    let mergedCount = 0;
    
    for (const dup of duplicates) {
      // Get all players with this name in this guild
      const playersStmt = db.prepare(
        'SELECT * FROM players WHERE LOWER(name) = LOWER(?) AND guild_name = ? ORDER BY first_seen ASC, last_seen DESC'
      );
      const players = playersStmt.all(dup.name, dup.guild_name);
      
      if (players.length < 2) continue;
      
      // Keep the first player (oldest record), merge others into it
      const keepPlayer = players[0];
      console.log(`Keeping player: ${keepPlayer.name} (${keepPlayer.id}), first_seen: ${keepPlayer.first_seen}`);
      
      for (let i = 1; i < players.length; i++) {
        const duplicatePlayer = players[i];
        console.log(`  Merging duplicate: ${duplicatePlayer.name} (${duplicatePlayer.id})`);
        
        // Move all statistics to the kept player
        const updateStats = db.prepare('UPDATE statistics SET player_id = ? WHERE player_id = ?');
        updateStats.run(keepPlayer.id, duplicatePlayer.id);
        
        // Update last_seen if the duplicate was seen more recently
        if (new Date(duplicatePlayer.last_seen) > new Date(keepPlayer.last_seen)) {
          const updateLastSeen = db.prepare('UPDATE players SET last_seen = ? WHERE id = ?');
          updateLastSeen.run(duplicatePlayer.last_seen, keepPlayer.id);
        }
        
        // Delete the duplicate player
        const deletePlayer = db.prepare('DELETE FROM players WHERE id = ?');
        deletePlayer.run(duplicatePlayer.id);
        
        mergedCount++;
      }
    }
    
    console.log(`Cleanup complete: merged ${mergedCount} duplicate player records`);
    return { success: true, mergedCount };
  });
  
  return transaction();
}

// Rename a player and merge data if target player exists
function renamePlayer(oldPlayerId, newPlayerName) {
  const transaction = db.transaction(() => {
    // Get the old player record
    const oldPlayer = db.prepare('SELECT * FROM players WHERE id = ?').get(oldPlayerId);
    
    if (!oldPlayer) {
      throw new Error('Player not found');
    }
    
    // Check if a player with the new name already exists in the same guild (case-insensitive)
    // We check by name, not ID, because IDs include game tags that may differ
    const targetPlayer = db.prepare(
      'SELECT * FROM players WHERE LOWER(name) = LOWER(?) AND guild_name = ? AND id != ?'
    ).get(newPlayerName, oldPlayer.guild_name, oldPlayerId);
    
    if (targetPlayer) {
      // Target player exists - merge statistics
      console.log(`Merging player "${oldPlayer.name}" (${oldPlayerId}) into "${targetPlayer.name}" (${targetPlayer.id})`);
      
      // Update all statistics to point to the target player_id
      const updateStats = db.prepare('UPDATE statistics SET player_id = ? WHERE player_id = ?');
      updateStats.run(targetPlayer.id, oldPlayerId);
      
      // Update the target player's name (use the new capitalization) and last_seen
      const updatePlayer = db.prepare(`
        UPDATE players 
        SET name = ?,
            last_seen = MAX(last_seen, ?)
        WHERE id = ?
      `);
      updatePlayer.run(newPlayerName, oldPlayer.last_seen, targetPlayer.id);
      
      // Delete the old player record
      const deletePlayer = db.prepare('DELETE FROM players WHERE id = ?');
      deletePlayer.run(oldPlayerId);
      
      return { success: true, merged: true, mergedWith: targetPlayer.name };
    } else {
      // Target player doesn't exist - simple rename
      // Just update the name, keep the same ID (preserves game tag)
      console.log(`Renaming player "${oldPlayer.name}" to "${newPlayerName}" (keeping ID: ${oldPlayerId})`);
      
      const updatePlayer = db.prepare('UPDATE players SET name = ? WHERE id = ?');
      updatePlayer.run(newPlayerName, oldPlayerId);
      
      return { success: true, merged: false };
    }
  });
  
  return transaction();
}

module.exports = {
  db,
  getSettings,
  saveSettings,
  saveWindowBounds,
  savePlayerStats,
  getAllPlayers,
  getPlayerHistory,
  deleteHistoryEntry,
  getAllPlayersForExport,
  getHistoricalData,
  getAllPlayerNames,
  renamePlayer,
  cleanupOrphanedPlayers,
  cleanupDuplicatePlayers,
  getGuildStatistics,
};


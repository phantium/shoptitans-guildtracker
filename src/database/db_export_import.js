/**
 * Guild snapshot export/import functionality
 * Allows sharing guild data between members
 */

/**
 * Export guild snapshot for a specific date
 * @param {Database} db - Better-sqlite3 database instance
 * @param {string} guildName - Guild name to export
 * @param {string} snapshotDate - Date to export (YYYY-MM-DD format or full timestamp)
 * @returns {object} - Export data package
 */
function exportGuildSnapshot(db, guildName, snapshotDate) {
  console.log(`[Export] Exporting guild snapshot for ${guildName} on ${snapshotDate}`);
  
  // Determine if we have a date-only or full timestamp
  const isDateOnly = snapshotDate.length === 10;
  
  let query;
  let params;
  
  if (isDateOnly) {
    // Query for all stats from that specific day
    query = db.prepare(`
      SELECT 
        p.id as player_id,
        p.name as player_name,
        p.guild_name,
        s.level,
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
    params = [guildName, snapshotDate, snapshotDate];
  } else {
    // Query for specific timestamp (rounded to 10 minutes)
    query = db.prepare(`
      SELECT 
        p.id as player_id,
        p.name as player_name,
        p.guild_name,
        s.level,
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
    params = [guildName, snapshotDate, snapshotDate];
  }
  
  const players = query.all(...params);
  
  if (players.length === 0) {
    throw new Error(`No data found for ${guildName} on ${snapshotDate}`);
  }
  
  console.log(`[Export] Found ${players.length} players to export`);
  
  // Create export package
  const exportPackage = {
    format_version: '1.0',
    export_type: 'guild_snapshot',
    exported_at: new Date().toISOString(),
    guild_name: guildName,
    snapshot_date: snapshotDate,
    player_count: players.length,
    players: players.map(p => ({
      player_id: p.player_id,
      player_name: p.player_name,
      guild_name: p.guild_name,
      captured_at: p.captured_at,
      stats: {
        level: p.level,
        net_worth: p.net_worth,
        prestige: p.prestige,
        invested: p.invested,
        mastered: p.mastered,
        helped: p.helped,
        ascensions: p.ascensions,
        bounty_trophies: p.bounty_trophies,
        collection_score: p.collection_score
      }
    }))
  };
  
  return exportPackage;
}

/**
 * Validate import data structure
 * @param {object} importData - Data to validate
 * @returns {object} - { valid: boolean, errors: string[] }
 */
function validateImportData(importData) {
  const errors = [];
  
  // Check required fields
  if (!importData.format_version) {
    errors.push('Missing format_version field');
  }
  
  if (importData.export_type !== 'guild_snapshot') {
    errors.push('Invalid export_type. Expected "guild_snapshot"');
  }
  
  if (!importData.guild_name) {
    errors.push('Missing guild_name field');
  }
  
  if (!importData.snapshot_date) {
    errors.push('Missing snapshot_date field');
  }
  
  if (!Array.isArray(importData.players)) {
    errors.push('Missing or invalid players array');
  } else if (importData.players.length === 0) {
    errors.push('No players in import data');
  } else {
    // Validate player structure
    importData.players.forEach((player, index) => {
      if (!player.player_id) {
        errors.push(`Player ${index}: missing player_id`);
      }
      if (!player.player_name) {
        errors.push(`Player ${index}: missing player_name`);
      }
      if (!player.stats) {
        errors.push(`Player ${index}: missing stats object`);
      }
      if (!player.captured_at) {
        errors.push(`Player ${index}: missing captured_at timestamp`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Preview import data (analyze what would be imported)
 * @param {Database} db - Better-sqlite3 database instance
 * @param {object} importData - Data to preview
 * @returns {object} - Preview information
 */
function previewImport(db, importData) {
  const validation = validateImportData(importData);
  
  if (!validation.valid) {
    return {
      valid: false,
      errors: validation.errors
    };
  }
  
  const guildName = importData.guild_name;
  const snapshotDate = importData.snapshot_date;
  
  // Check if this snapshot already exists
  const isDateOnly = snapshotDate.length === 10;
  let existingQuery;
  
  if (isDateOnly) {
    existingQuery = db.prepare(`
      SELECT COUNT(DISTINCT s.player_id) as count
      FROM statistics s
      JOIN players p ON s.player_id = p.id
      WHERE p.guild_name = ? AND DATE(s.captured_at) = ?
    `);
  } else {
    existingQuery = db.prepare(`
      SELECT COUNT(DISTINCT s.player_id) as count
      FROM statistics s
      JOIN players p ON s.player_id = p.id
      WHERE p.guild_name = ? 
        AND datetime((strftime('%s', s.captured_at) / 600) * 600, 'unixepoch') = ?
    `);
  }
  
  const existingCount = existingQuery.get(guildName, snapshotDate)?.count || 0;
  
  // Count how many players would be new vs. updated
  const newPlayers = [];
  const existingPlayers = [];
  const duplicateEntries = [];
  
  importData.players.forEach(player => {
    // Check if player exists
    const playerCheck = db.prepare('SELECT id, name FROM players WHERE id = ?').get(player.player_id);
    
    if (!playerCheck) {
      newPlayers.push(player.player_name);
    } else {
      existingPlayers.push(player.player_name);
    }
    
    // Check if this specific stat entry already exists (same player, same capture time)
    const statCheck = db.prepare(`
      SELECT id FROM statistics 
      WHERE player_id = ? AND captured_at = ?
    `).get(player.player_id, player.captured_at);
    
    if (statCheck) {
      duplicateEntries.push(player.player_name);
    }
  });
  
  return {
    valid: true,
    guild_name: guildName,
    snapshot_date: snapshotDate,
    total_players: importData.players.length,
    new_players: newPlayers.length,
    existing_players: existingPlayers.length,
    duplicate_entries: duplicateEntries.length,
    existing_snapshot_player_count: existingCount,
    new_player_names: newPlayers,
    existing_player_names: existingPlayers,
    duplicate_player_names: duplicateEntries
  };
}

/**
 * Import guild snapshot data
 * @param {Database} db - Better-sqlite3 database instance
 * @param {object} importData - Data to import
 * @param {object} options - Import options
 * @param {boolean} options.skipDuplicates - Skip duplicate entries (default: true)
 * @param {boolean} options.updateExisting - Update existing player info (default: true)
 * @returns {object} - Import results
 */
function importGuildSnapshot(db, importData, options = {}) {
  const { skipDuplicates = true, updateExisting = true } = options;
  
  console.log(`[Import] Starting import for ${importData.guild_name}`);
  
  // Validate first
  const validation = validateImportData(importData);
  if (!validation.valid) {
    throw new Error(`Invalid import data: ${validation.errors.join(', ')}`);
  }
  
  let playersAdded = 0;
  let playersUpdated = 0;
  let statsAdded = 0;
  let duplicatesSkipped = 0;
  
  const transaction = db.transaction(() => {
    const insertPlayer = db.prepare(`
      INSERT INTO players (id, name, guild_name, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        guild_name = excluded.guild_name,
        last_seen = MAX(last_seen, excluded.last_seen)
    `);
    
    const checkStatExists = db.prepare(`
      SELECT id FROM statistics 
      WHERE player_id = ? AND captured_at = ?
    `);
    
    const insertStats = db.prepare(`
      INSERT INTO statistics (
        player_id, level, net_worth, prestige, invested,
        registered, helped, ascensions, bounty_trophies,
        collection_score, captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    importData.players.forEach(player => {
      // Check if player exists
      const playerExists = db.prepare('SELECT id FROM players WHERE id = ?').get(player.player_id);
      
      // Insert/update player
      insertPlayer.run(
        player.player_id,
        player.player_name,
        player.guild_name,
        player.captured_at,
        player.captured_at
      );
      
      if (playerExists) {
        if (updateExisting) playersUpdated++;
      } else {
        playersAdded++;
      }
      
      // Check if this stat entry already exists
      const statExists = checkStatExists.get(player.player_id, player.captured_at);
      
      if (statExists && skipDuplicates) {
        duplicatesSkipped++;
        console.log(`[Import] Skipping duplicate stat for ${player.player_name}`);
      } else if (!statExists) {
        // Insert statistics
        insertStats.run(
          player.player_id,
          player.stats.level,
          player.stats.net_worth,
          player.stats.prestige,
          player.stats.invested,
          player.stats.mastered,
          player.stats.helped,
          player.stats.ascensions,
          player.stats.bounty_trophies,
          player.stats.collection_score,
          player.captured_at
        );
        statsAdded++;
      }
    });
  });
  
  transaction();
  
  console.log(`[Import] Complete: ${playersAdded} new players, ${playersUpdated} updated, ${statsAdded} stats added, ${duplicatesSkipped} duplicates skipped`);
  
  return {
    success: true,
    players_added: playersAdded,
    players_updated: playersUpdated,
    stats_added: statsAdded,
    duplicates_skipped: duplicatesSkipped
  };
}

module.exports = {
  exportGuildSnapshot,
  validateImportData,
  previewImport,
  importGuildSnapshot
};





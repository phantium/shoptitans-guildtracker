// Snapshot grouping function - groups by full day

function getGuildSnapshots(db, guildName) {
  const query = db.prepare(`
    SELECT s.captured_at, s.player_id
    FROM statistics s
    JOIN players p ON s.player_id = p.id
    WHERE p.guild_name = ?
    ORDER BY s.captured_at DESC
  `);
  
  const rawData = query.all(guildName);
  const snapshotBuckets = {};
  
  // Group by full day (date only, no time)
  for (const record of rawData) {
    const dateOnly = record.captured_at.substring(0, 10); // YYYY-MM-DD
    
    if (!snapshotBuckets[dateOnly]) {
      snapshotBuckets[dateOnly] = new Set();
    }
    snapshotBuckets[dateOnly].add(record.player_id);
  }
  
  const snapshots = [];
  for (const [date, playerSet] of Object.entries(snapshotBuckets)) {
    snapshots.push({
      captured_at: date,
      player_count: playerSet.size
    });
  }
  
  snapshots.sort((a, b) => b.captured_at.localeCompare(a.captured_at));
  return snapshots;
}

module.exports = { getGuildSnapshots };


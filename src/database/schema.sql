-- Settings table for guild configuration
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  guild_name TEXT NOT NULL,
  capture_source TEXT,
  capture_region TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  window_x INTEGER,
  window_y INTEGER,
  window_width INTEGER,
  window_height INTEGER,
  source_width INTEGER,
  source_height INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Players table for basic player information
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  guild_name TEXT NOT NULL,
  first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Statistics table for historical tracking
CREATE TABLE IF NOT EXISTS statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  level INTEGER,
  net_worth TEXT,
  prestige TEXT,
  invested TEXT,
  registered INTEGER,  -- NOTE: This stores "Mastered" (blueprints mastered). Named "registered" for backward compatibility.
  helped INTEGER,
  ascensions INTEGER,
  bounty_trophies INTEGER,
  collection_score INTEGER,
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_statistics_player_id ON statistics(player_id);
CREATE INDEX IF NOT EXISTS idx_statistics_captured_at ON statistics(captured_at);
CREATE INDEX IF NOT EXISTS idx_players_guild_name ON players(guild_name);


# Shop Titans Guild Statistics Tracker

An Electron desktop application that uses OCR (Optical Character Recognition) to capture and track player statistics for Shop Titans.  
Perfect for guild leaders who want to monitor member activity and progress over time.

## 📥 Download

**[Download Latest Release](https://github.com/phantium/shoptitans-guildtracker/releases/latest)**

### Choose Your Version

#### 🖥️ CPU Version (Recommended for Most Users)
Works on any Windows PC without special hardware requirements.

- **Installer**: `Shop Titans Guild Tracker CPU Setup X.X.X.exe`
- **Portable**: `Shop Titans Guild Tracker CPU-X.X.X-portable.exe`

#### ⚡ GPU Version (For NVIDIA GPU Owners)
3-4x faster OCR processing with GPU acceleration.

- **Installer**: `Shop Titans Guild Tracker GPU Setup X.X.X.exe`
- **Portable**: `Shop Titans Guild Tracker GPU-X.X.X-portable.exe`

**Requirements:** NVIDIA GPU with CUDA support

> **Note:** Windows may show a SmartScreen warning. This is normal for unsigned applications. Click "More info" then "Run anyway" to proceed. The app is open-source and safe.

---

## For Developers

Want to build from source or contribute? See the [Development](#development) section below.

## Features

- 🖼️ **Screen Capture**: Capture player profile screens from the running game
- 🔍 **OCR Text Extraction**: Automatically extracts player statistics using PaddleOCR with fallback to Tesseract.js
- 📊 **Historical Tracking**: Stores all captures with timestamps for trend analysis
- 📤 **Data Export**: Export current snapshots or historical data to CSV/JSON
- 🎨 **Modern UI**: Clean interface built with React

## Captured Statistics

The app captures the following player statistics:
- Player Name and ID
- Level
- Net Worth
- Prestige
- Invested Amount
- Mastered Count (blueprints)
- Helped Count
- Ascensions
- Bounty Trophies
- Collection Score

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm

### Setup

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Build the React frontend:
```bash
npm run build
```

## Usage

### Starting the Application

```bash
npm start
```

### First-Time Setup

1. When you first launch the app, you'll be prompted to configure the screen capture region
2. Click "Select Capture Region" to choose which window/screen to capture from, it will automatically select Shop Titans when running
3. Draw a rectangle around the player profile area

### Capturing Player Statistics

1. Open Shop Titans and navigate to your guild member list
2. Click on a guild member to open their profile
3. Make sure their full profile is visible on screen
4. Click the "Capture Player Stats" button in the tracker app
5. Wait for the OCR processing to complete
6. The player's statistics will be saved to the database
7. Continue to next player using arrow keys and repeat previous steps

### Viewing Data

- The main table shows all captured players with their latest statistics
- Click on a player row to view their historical data
- Use the column headers to sort by different fields
- Click "Refresh" to reload the data from the database

### Exporting Data

- Click "Export JSON" to export all player data in JSON format
- Click "Export CSV" to export all player data in CSV format for Excel/spreadsheet analysis
- Click "Show Rankings" for a guild and click the photo camera button for desired rankings or player progress summary.
- Exported files are saved to the `exports/` directory with timestamps

## Development

### Project Structure

```
shop-titans-tracker/
├── main.js                 # Electron main process
├── preload.js             # IPC bridge
├── index.html             # HTML entry point
├── package.json           # Dependencies
├── webpack.config.js      # Webpack configuration
├── src/
│   ├── renderer/          # React UI components
│   │   ├── App.jsx
│   │   ├── components/
│   │   └── styles/
│   ├── ocr/              # OCR and parsing logic
│   ├── database/         # SQLite database
│   ├── capture/          # Screen capture utilities
│   └── utils/            # Helper utilities
├── data/                 # SQLite database storage
└── exports/              # Exported CSV/JSON/screenshot files
```

### Development Mode

Run webpack in watch mode:
```bash
npm run dev
```

In another terminal, start Electron:
```bash
npm start
```

### Building for Distribution

```bash
npm run dist
```

This will create an installer in the `release/` directory.

## Tips for Best Results

1. **Screen Resolution**: Higher resolution screenshots produce better OCR results
2. **Lighting**: Ensure the game window has good contrast and visibility
3. **Profile Visibility**: Make sure the entire player profile card is visible
4. **Capture Region**: Setting a custom capture region around just the profile card improves speed and accuracy
5. **Guild Name**: Ensure your configured guild name matches exactly (case-insensitive comparison is used)

## Troubleshooting

### OCR Not Extracting Data

- Ensure the player profile is fully visible
- Try adjusting the capture region to focus on just the profile card
- Check that the game window is not being overlapped by other windows

### Database Errors

- The database file is created automatically in the `data/` directory
- If you encounter database issues, you can delete the database file to start fresh
- Located at: `data/shop-titans.db`

### Performance Issues

- Close unnecessary applications to free up system resources
- OCR processing can take a while depending on your system
- Consider setting a smaller capture region for faster processing

### Database Schema

The app uses SQLite with three main tables:
- `settings`: Guild configuration
- `players`: Player basic information
- `statistics`: Historical statistics with timestamps

## Privacy & Data

- All data is stored locally on your computer
- No data is sent to external servers
- The database can be deleted at any time
- Exports are saved locally to the `exports/` directory

## Contributing

This is an open-source project. Feel free to submit issues or pull requests for improvements!

## Disclaimer

This tool is not affiliated with or endorsed by Kabam or Shop Titans.  
It is a community-created tool for guild management purposes.  
Use at your own discretion and in accordance with the game's terms of service.


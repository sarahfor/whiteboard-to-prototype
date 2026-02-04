# Quick Start Guide

Get up and running in under 2 minutes.

## Prerequisites

- Node.js 18+ installed
- Anthropic API key ([get one here](https://console.anthropic.com))

## Quick Start

```bash
# 1. Navigate to project directory
cd whiteboard-to-prototype

# 2. Run the startup script
./start.sh

# The script will:
# - Check Node.js installation
# - Create .env file if missing
# - Install dependencies
# - Start the server
```

## Manual Start (Alternative)

If you prefer to start manually:

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env

# 3. Edit .env and add your API key
nano .env  # or use any text editor

# 4. Start server
npm start
```

## Using the App

1. **Open in browser**: http://localhost:3000
2. **On mobile**: Use your phone's browser with same URL (must be on same network)
3. **Take/upload photo**: Click the upload area
4. **Add instructions** (optional): Specify any requirements
5. **Build**: Click "Build Prototype"
6. **View**: See your live prototype in the iframe
7. **Access files**: Check `__output__/prototype-[timestamp]/`

## Viewing History

Visit http://localhost:3000/history to see:
- All previous whiteboard sessions
- Thumbnails of each whiteboard
- Cost and token usage per session
- Direct links to generated prototypes

## Common Commands

```bash
# Start server
npm start

# Development mode (auto-reload)
npm run dev

# View server logs
# (logs display in terminal with [PREFIX] format)
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main upload interface |
| `/upload` | POST | Process whiteboard image |
| `/history` | GET | Get session history (JSON) |
| `/health` | GET | Server health check |
| `/demos/[prototype]/index.html` | GET | View generated prototype |

## Cost Estimates

Claude Opus 4.5 pricing:
- Input: $15 per million tokens
- Output: $75 per million tokens

Typical costs per prototype:
- Simple sketch: $0.10 - $0.25
- Complex app: $0.30 - $0.50

## Troubleshooting

**Server won't start:**
```bash
# Check if port 3000 is in use
lsof -ti:3000 | xargs kill -9

# Then restart
npm start
```

**"API key not found" error:**
```bash
# Verify .env file exists
cat .env

# Should contain:
# ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Image upload fails:**
- Check file size (max 10MB)
- Ensure file is an image (JPG, PNG, etc.)
- Check console logs for detailed error

## What Gets Created

When you upload a whiteboard, the system creates:

```
__output__/
└── prototype-2024-01-15T10-30-00/
    ├── index.html     # Your generated prototype
    └── thumbnail.jpg  # Whiteboard thumbnail

history/
└── whiteboard-history.json  # Complete session log
```

## Next Steps

- See [GETTING_STARTED.md](GETTING_STARTED.md) for detailed setup
- See [SUMMARY.md](SUMMARY.md) for architecture details
- See [README.md](README.md) for full documentation

## Support

If you encounter issues:
1. Check console logs (they use `[PREFIX]` format for easy filtering)
2. Visit `/health` endpoint to check server status
3. Review the `history/whiteboard-history.json` for session details

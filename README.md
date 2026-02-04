# Whiteboard to Prototype

Transform your whiteboard sketches into working prototypes using Claude Code SDK.

## How It Works

```
[Whiteboard] → [Phone photo] → [Upload to local app]
                                        ↓
                          [Claude Code SDK receives image]
                                        ↓
                   [Claude Code READS the whiteboard]
                                        ↓
                   [Claude Code BUILDS the prototype]
                      (creates files, runs, iterates)
                                        ↓
                   [Prototype lands in your local folder]
```

This is NOT just a Messages API integration that returns code as text. This uses the **Claude Code SDK** to spin up Claude as an actual agent that autonomously:
- Reads and understands your whiteboard sketch
- Creates real files on your machine
- Builds a complete, functional prototype
- Saves everything to `__output__/` organized by timestamp

## Features

- **Mobile-optimized interface** for capturing whiteboard photos
- **Automatic image compression** (max 1024x1024) for faster processing
- **One-tap photo upload** from your phone
- **Live functional demo preview** in the browser
- **Claude Code SDK** autonomously builds prototypes
- **Organized output** by timestamp in `__output__/` folder
- **Real-time cost tracking** based on token usage
- **Beautiful UI** with animated particle background

## Prerequisites

- Node.js 18 or higher
- Anthropic API key (already configured in `.env`)

## Setup

1. **Install dependencies:**
   ```bash
   cd whiteboard-to-prototype
   npm install
   ```

2. **Your API key is already configured** in the `.env` file

3. **Start the server:**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

## Usage

1. Open `http://localhost:3000` on your phone or computer
2. Tap "Take photo" or upload an existing whiteboard image
3. Optionally add specific instructions (e.g., "Make it a dark mode app")
4. Tap "Build Prototype" and wait for Claude to analyze and build
5. View your live functional demo directly in the browser
6. Open in a new tab or find files in `__output__/prototype-[timestamp]/`

## Project Structure

```
whiteboard-to-prototype/
├── server.js              # Main server with Claude Code SDK integration
├── package.json           # Dependencies
├── .env                   # API key configuration
├── public/
│   └── index.html         # Frontend UI
├── uploads/               # Uploaded whiteboard images
└── __output__/            # Generated prototypes (organized by timestamp)
    ├── prototype-2024-01-15T10-30-00/
    ├── prototype-2024-01-15T14-22-15/
    └── ...
```

## How the Claude Code SDK Works

Unlike the basic Messages API that just returns code as text, the Claude Code SDK:

1. **Spins up Claude as an agent** with autonomous capabilities
2. **Reads and analyzes** your whiteboard image using vision
3. **Creates real files** in your `__output__` directory
4. **Builds complete prototypes** with HTML, CSS, and JavaScript
5. **Organizes by timestamp** so you have a complete history

Each prototype is self-contained in its own timestamped folder with all necessary files.

## API Endpoints

- `GET /` - Main upload interface (mobile-optimized)
- `POST /upload` - Upload and process whiteboard image
- `GET /demos/:prototype-folder/index.html` - View generated prototypes

## Configuration

The server uses **Claude Opus 4.5** by default. This is the most powerful model for understanding sketches and building prototypes. You can modify the model in `server.js`:

```javascript
model: 'claude-opus-4-5-20251101'  // or 'claude-sonnet-4-5'
```

## Tips

- Take clear, well-lit photos of your whiteboard
- Include all relevant details, labels, and notes in the photo
- Use the custom prompt field to specify technologies or requirements
- Check the `__output__` folder to see your generated prototypes
- Each prototype is completely self-contained in its timestamp folder

## Cost Information

Claude Opus 4.5 pricing:
- Input: $15 per million tokens
- Output: $75 per million tokens

Each prototype generation typically costs $0.10-0.50 depending on complexity.

## Troubleshooting

**"ANTHROPIC_API_KEY not set"**
- Your API key is already configured in the `.env` file
- Make sure the `.env` file exists in the project root

**"Files not generating"**
- Check the server console logs for detailed error messages
- Ensure you have write permissions in the project directory

**High API costs**
- Opus 4.5 is powerful but expensive
- Consider using Sonnet 4.5 for simpler prototypes
- Each session cost is logged in the console

## What Makes This Different

Most whiteboard-to-code demos use the Messages API and return code as text that you have to manually save. This uses the **Claude Code SDK** which means:

- Claude acts as an autonomous agent
- Files are created automatically on your machine
- Complete project structure is generated
- No manual copy-pasting required
- Full build history maintained

This is the real deal - whiteboard to working prototype with zero manual file management.

## License

MIT

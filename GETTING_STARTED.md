# Getting Started - Complete Setup Guide

Step-by-step instructions to get your Whiteboard to Prototype system running.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [First Run](#first-run)
5. [Usage Guide](#usage-guide)
6. [Understanding Output](#understanding-output)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

**Node.js 18 or higher**
```bash
# Check your version
node --version

# Should output: v18.0.0 or higher
```

Don't have Node.js? Download from https://nodejs.org

### Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy it (starts with `sk-ant-api03-...`)

---

## Installation

### Step 1: Clone or Download

If you have this project folder, navigate to it:
```bash
cd whiteboard-to-prototype
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web server
- `multer` - File uploads
- `sharp` - Image processing
- `@anthropic-ai/sdk` - Claude API client
- `dotenv` - Environment configuration
- `uuid` - Session ID generation

You should see output like:
```
added 121 packages in 6s
```

---

## Configuration

### Step 1: Create .env File

Copy the example:
```bash
cp .env.example .env
```

Or create it manually:
```bash
touch .env
```

### Step 2: Add Your API Key

Open `.env` in your text editor:
```bash
nano .env
# or
code .env  # VS Code
# or
open .env  # macOS default editor
```

Add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE
PORT=3000
```

**Important:**
- Replace `YOUR_KEY_HERE` with your actual API key
- Do NOT add quotes around the key
- Do NOT commit .env to git (it's already in .gitignore)

### Step 3: Verify Configuration

Check that your key is set:
```bash
cat .env
```

Should show:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
PORT=3000
```

---

## First Run

### Option 1: Using the Startup Script (Recommended)

```bash
./start.sh
```

This script will:
1. ✅ Check Node.js installation
2. ✅ Verify .env file exists
3. ✅ Install dependencies if needed
4. ✅ Validate API key format
5. ✅ Start the server

### Option 2: Manual Start

```bash
npm start
```

### Expected Output

You should see:
```
======================================================================
🚀 WHITEBOARD TO PROTOTYPE - Claude Agent SDK
======================================================================
📱 Mobile:   http://localhost:3000
💻 Desktop:  http://localhost:3000
📊 History:  http://localhost:3000/history
🏥 Health:   http://localhost:3000/health
======================================================================
🤖 Model:    claude-opus-4-5-20251101
📁 Uploads:  /path/to/uploads
📦 Output:   /path/to/__output__
======================================================================

2024-01-15T10:30:00.000Z [SERVER] Server started successfully
```

---

## Usage Guide

### Basic Workflow

#### 1. Open the Interface

**On your computer:**
```
http://localhost:3000
```

**On your phone:**
1. Make sure your phone is on the same WiFi network
2. Find your computer's IP address:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "

   # Windows
   ipconfig
   ```
3. Open in phone browser: `http://[YOUR_IP]:3000`

#### 2. Upload a Whiteboard Photo

- **Tap** the upload area to capture/select
- **Drag and drop** an image file
- Supported formats: JPG, PNG, etc.
- Max size: 10MB

#### 3. Add Custom Instructions (Optional)

Examples:
- "Make it dark mode"
- "Add animations"
- "Use a card layout"
- "Include a contact form"
- "Make it look like Apple's website"

#### 4. Build the Prototype

Click **"Build Prototype"**

You'll see:
1. Status: "Processing... Claude is analyzing"
2. Progress bar animation
3. Success message with:
   - Token usage
   - Cost breakdown
   - Processing duration
4. Live preview in iframe
5. "Open in New Tab" button

#### 5. Find Your Files

Generated prototypes are saved to:
```
__output__/prototype-[timestamp]/
├── index.html      # Your prototype
└── thumbnail.jpg   # Whiteboard preview
```

Example:
```
__output__/prototype-2024-01-15T10-30-00/
```

### Viewing History

Visit http://localhost:3000/history

You'll see JSON with all sessions:
```json
{
  "success": true,
  "total": 5,
  "sessions": [
    {
      "sessionId": "uuid-here",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "originalFilename": "whiteboard-2024-01-15T10-30-00.jpg",
      "customPrompt": "Make it dark mode",
      "prototypeUrl": "/demos/prototype-2024-01-15T10-30-00/index.html",
      "thumbnailUrl": "/demos/prototype-2024-01-15T10-30-00/thumbnail.jpg",
      "tokens": {
        "input": 1523,
        "output": 2847
      },
      "cost": 0.2360,
      "duration": 12.45,
      "model": "claude-opus-4-5-20251101",
      "success": true
    }
  ]
}
```

---

## Understanding Output

### Server Logs

Logs use **[PREFIX]** format for easy filtering:

```bash
# All logs
npm start

# Filter by type
npm start 2>&1 | grep "\[CLAUDE\]"   # Claude-specific
npm start 2>&1 | grep "\[ERROR\]"    # Errors only
npm start 2>&1 | grep "\[SUCCESS\]"  # Success messages
```

**Log Prefixes:**
- `[SERVER]` - Server operations
- `[UPLOAD]` - File uploads
- `[CLAUDE]` - Claude API calls
- `[BUILD]` - Prototype building
- `[HISTORY]` - History operations
- `[ERROR]` - Errors
- `[SUCCESS]` - Success messages
- `[INFO]` - General info

### File Structure

After running a few sessions:
```
whiteboard-to-prototype/
├── uploads/
│   ├── whiteboard-2024-01-15T10-30-00.jpg
│   ├── compressed-whiteboard-2024-01-15T10-30-00.jpg
│   ├── whiteboard-2024-01-15T11-15-00.jpg
│   └── compressed-whiteboard-2024-01-15T11-15-00.jpg
│
├── __output__/
│   ├── prototype-2024-01-15T10-30-00/
│   │   ├── index.html
│   │   └── thumbnail.jpg
│   └── prototype-2024-01-15T11-15-00/
│       ├── index.html
│       └── thumbnail.jpg
│
└── history/
    └── whiteboard-history.json
```

### Cost Tracking

Each session logs detailed costs:

```
[INFO] Session cost calculated {
  "inputCost": "0.022845",
  "outputCost": "0.213525",
  "totalCost": "0.236370"
}
```

**Understanding the costs:**
- Input tokens: Whiteboard image + prompt (charged at $15 per million)
- Output tokens: Generated HTML code (charged at $75 per million)

---

## Troubleshooting

### Server Won't Start

**Problem:** Port 3000 already in use
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Then restart
npm start
```

---

**Problem:** API key not found
```
⚠️  ERROR: ANTHROPIC_API_KEY not set
```

**Solution:**
1. Check .env file exists: `ls -la .env`
2. Check contents: `cat .env`
3. Verify key format: `ANTHROPIC_API_KEY=sk-ant-api03-...`
4. No quotes, no spaces around =

---

### Upload Fails

**Problem:** "Only image files are allowed"

**Solution:**
- Upload JPG, PNG, GIF, or other image formats
- Do not upload PDFs, documents, or other file types

---

**Problem:** File too large

**Solution:**
- Max size is 10MB
- Compress your image before uploading
- Or modify the limit in server.js:
  ```javascript
  limits: { fileSize: 10 * 1024 * 1024 }  // Change this
  ```

---

### Claude API Errors

**Problem:** Invalid API key
```
[ERROR] Claude Agent SDK build failed {
  "error": "invalid x-api-key"
}
```

**Solution:**
1. Verify key at https://console.anthropic.com
2. Ensure key starts with `sk-ant-api03-`
3. No extra spaces or characters in .env
4. Restart server after changing .env

---

**Problem:** Rate limit exceeded
```
[ERROR] 429 Too Many Requests
```

**Solution:**
- Wait a few minutes
- Check your usage at https://console.anthropic.com
- Consider upgrading your plan

---

**Problem:** Token limit exceeded
```
[ERROR] tokens exceeds max 4096
```

**Solution:**
- Your image + generated code is too large
- Try a simpler whiteboard sketch
- Or increase MAX_TOKENS in server.js CONFIG

---

### Missing Dependencies

**Problem:** Module not found
```
Error: Cannot find module '@anthropic-ai/sdk'
```

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

### Permission Errors

**Problem:** Cannot create directories
```
[ERROR] EACCES: permission denied, mkdir '/path/to/uploads'
```

**Solution:**
```bash
# Fix permissions
chmod 755 .
mkdir -p uploads __output__ history
chmod 755 uploads __output__ history
```

---

## Next Steps

Once everything is running:

1. **Test with a simple sketch** - Draw something basic to verify the system works
2. **Review the generated code** - Open the `__output__/prototype-*/index.html` files
3. **Check the history** - Visit `/history` to see your session data
4. **Monitor costs** - Watch the console logs for cost tracking
5. **Experiment** - Try different custom prompts and sketches

## Advanced Configuration

### Change the Model

Edit `server.js` CONFIG:
```javascript
MODEL: 'claude-sonnet-4-5-20250514',  // Cheaper, faster
// or
MODEL: 'claude-opus-4-5-20251101',    // More powerful (default)
```

### Change the Port

Edit `.env`:
```
PORT=8080
```

### Adjust Image Compression

Edit `server.js` CONFIG:
```javascript
MAX_IMAGE_SIZE: 2048,  // Larger images (higher cost)
// or
MAX_IMAGE_SIZE: 512,   // Smaller images (lower cost)
```

---

## Getting Help

If you're still stuck:

1. Check **console logs** for detailed error messages
2. Test the **/health** endpoint: http://localhost:3000/health
3. Review **SUMMARY.md** for architecture details
4. Check **QUICK_START.md** for common commands

---

## Success Checklist

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] .env file created with valid API key
- [ ] Server starts without errors
- [ ] Can access http://localhost:3000
- [ ] Can upload an image
- [ ] Can see generated prototype
- [ ] Files appear in `__output__/`
- [ ] History logs to `history/whiteboard-history.json`

If all boxes are checked, you're ready to go! 🚀

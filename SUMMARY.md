# Architecture Summary

Complete technical overview of the Whiteboard to Prototype system using Claude Agent SDK.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER WORKFLOW                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MOBILE WEB INTERFACE                        │
│  • Capture/upload whiteboard photo                              │
│  • Optional custom instructions                                 │
│  • Real-time preview                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER (server.js)                  │
│  • Handles file uploads (Multer)                                │
│  • Compresses images (Sharp)                                    │
│  • Creates thumbnails                                           │
│  • Orchestrates Claude Agent SDK                                │
│  • Manages session history                                      │
│  • Tracks costs and metrics                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CLAUDE AGENT SDK                             │
│  • Claude Opus 4.5 (Vision + Code Generation)                  │
│  • Analyzes whiteboard sketch                                   │
│  • Understands concept and requirements                         │
│  • Autonomously generates HTML/CSS/JS                           │
│  • Creates complete, functional prototype                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FILE SYSTEM OUTPUT                          │
│  __output__/prototype-[timestamp]/                              │
│    ├── index.html (generated prototype)                         │
│    └── thumbnail.jpg (whiteboard preview)                       │
│                                                                  │
│  history/whiteboard-history.json                                │
│    └── Complete session logs with metadata                      │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Server (server.js) - 593 Lines

**Key Responsibilities:**
- Express server on port 3000
- File upload handling via Multer
- Image processing with Sharp
- Claude API integration
- Session management and history
- Cost calculation and tracking
- Real-time logging with prefixes

**Logging System:**
```javascript
LOG_PREFIX = {
    SERVER:  '[SERVER]'
    UPLOAD:  '[UPLOAD]'
    CLAUDE:  '[CLAUDE]'
    BUILD:   '[BUILD]'
    HISTORY: '[HISTORY]'
    ERROR:   '[ERROR]'
    SUCCESS: '[SUCCESS]'
    INFO:    '[INFO]'
}
```

### 2. Configuration

```javascript
CONFIG = {
    UPLOADS_DIR:    'uploads/'
    OUTPUT_DIR:     '__output__/'
    HISTORY_FILE:   'history/whiteboard-history.json'
    MAX_IMAGE_SIZE: 1024px
    MODEL:          'claude-opus-4-5-20251101'
    MAX_TOKENS:     4096
    COST_PER_MILLION_INPUT:  $15
    COST_PER_MILLION_OUTPUT: $75
}
```

### 3. Data Flow

**Upload Request:**
```
POST /upload
├── multipart/form-data
│   ├── whiteboard: [image file]
│   └── prompt: [optional string]
│
└── Response:
    ├── sessionId: UUID
    ├── demoUrl: /demos/prototype-[timestamp]/index.html
    ├── thumbnailUrl: /demos/prototype-[timestamp]/thumbnail.jpg
    ├── tokens: { input, output }
    ├── cost: number
    ├── duration: seconds
    └── files: ['index.html']
```

**History Response:**
```
GET /history
└── Response:
    ├── success: boolean
    ├── total: number
    └── sessions: [
          {
            sessionId,
            timestamp,
            originalFilename,
            customPrompt,
            prototypeUrl,
            thumbnailUrl,
            tokens,
            cost,
            duration,
            model,
            success
          }
        ]
```

## Image Processing Pipeline

```
1. Original Upload
   └── Saved to: uploads/whiteboard-[timestamp].jpg

2. Compression (Sharp)
   ├── Max dimensions: 1024×1024
   ├── Quality: 90%
   ├── Format: JPEG
   └── Saved to: uploads/compressed-whiteboard-[timestamp].jpg

3. Base64 Encoding
   └── Sent to Claude API

4. Thumbnail Creation
   ├── Dimensions: 200×200 (cover fit)
   ├── Quality: 80%
   └── Saved to: __output__/prototype-[timestamp]/thumbnail.jpg
```

## Claude Agent SDK Integration

**Process:**
1. Encode compressed image to base64
2. Build system prompt with requirements
3. Call Claude Opus 4.5 with vision capability
4. Extract generated HTML from response
5. Clean markdown code blocks if present
6. Ensure proper DOCTYPE
7. Write to output directory
8. Track tokens and calculate cost

**Prompt Structure:**
```
System Role: Expert web developer with Agent SDK capabilities
Task: Autonomously build functional HTML prototype
Requirements:
  - Analyze whiteboard sketch
  - Modern, clean design
  - Blue color scheme (#4facfe, #5eb3d6)
  - Mobile responsive
  - Fully interactive
  - Single HTML file with embedded CSS/JS
Custom Instructions: [user-provided]
Output Format: Raw HTML only, no markdown
```

## Session Management

Each upload creates a unique session:

```javascript
Session {
  sessionId:        UUID v4
  timestamp:        ISO 8601
  originalFilename: string
  customPrompt:     string
  outputDir:        absolute path
  prototypeUrl:     relative URL
  thumbnailUrl:     relative URL
  tokens: {
    input:          number
    output:         number
  }
  cost:             number (USD)
  costs: {
    inputCost:      string
    outputCost:     string
    totalCost:      string
  }
  duration:         number (seconds)
  model:            string
  files:            string[]
  success:          boolean
}
```

## Cost Calculation

```javascript
Input Cost  = (inputTokens / 1,000,000) × $15
Output Cost = (outputTokens / 1,000,000) × $75
Total Cost  = Input Cost + Output Cost
```

**Typical Token Usage:**
- Input (with image): 1,500 - 3,000 tokens
- Output (HTML): 1,000 - 3,000 tokens
- Average cost: $0.15 - $0.40 per prototype

## Error Handling

**Levels:**
1. **Validation**: File type, size, API key presence
2. **Processing**: Image compression, encoding failures
3. **API**: Claude API errors, token limits
4. **File System**: Directory creation, file write errors

**Error Logging:**
All errors logged with:
- Timestamp (ISO 8601)
- Prefix [ERROR]
- Session ID
- Error message
- Stack trace

## Performance Metrics

**Tracked Per Session:**
- Request start time
- Claude API response time
- Total processing duration
- Input/output tokens
- Cost breakdown
- File sizes

## Security Considerations

**API Key:**
- Stored in .env (excluded from git)
- Never logged or exposed in responses
- Validated on server startup

**File Uploads:**
- 10MB size limit
- Image type validation
- Filename sanitization with timestamps
- Isolated uploads directory

**Output:**
- Prototypes saved in isolated __output__ directory
- Timestamped to prevent collisions
- No user code execution on server

## Scalability Notes

**Current Design:**
- Single-threaded Node.js
- Synchronous processing per request
- File-based history (JSON)

**For Production Scale:**
- Add request queue (Bull/Redis)
- Database for history (PostgreSQL/MongoDB)
- Object storage for files (S3)
- Rate limiting per IP/key
- Caching layer for repeated sketches

## File Structure

```
whiteboard-to-prototype/
├── server.js              # Main server (593 lines)
├── package.json           # Dependencies
├── .env                   # API key (git-ignored)
├── .env.example           # Template
├── .gitignore             # Excludes uploads/outputs
├── start.sh               # Startup script
├── README.md              # Full documentation
├── QUICK_START.md         # Quick reference
├── SUMMARY.md             # This file
├── GETTING_STARTED.md     # Step-by-step setup
│
├── public/
│   └── index.html         # Web interface
│
├── uploads/               # Whiteboard images
│   ├── whiteboard-[timestamp].jpg
│   └── compressed-whiteboard-[timestamp].jpg
│
├── __output__/            # Generated prototypes
│   └── prototype-[timestamp]/
│       ├── index.html
│       └── thumbnail.jpg
│
└── history/
    └── whiteboard-history.json  # Session logs
```

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express | 4.18+ |
| Upload | Multer | 1.4.5 |
| Images | Sharp | 0.33+ |
| AI | Anthropic SDK | 0.32+ |
| IDs | UUID | 10.0+ |
| Config | dotenv | 16.4+ |

## API Usage Patterns

**Successful Request:**
```
[UPLOAD] New upload session started { sessionId: "..." }
[INFO] Processing upload { filename, size, customPrompt }
[INFO] Compressing image { inputPath, outputPath }
[SUCCESS] Image compressed successfully { width, height, size }
[CLAUDE] Starting Claude Agent SDK session { sessionId }
[BUILD] Created output directory { outputDir }
[CLAUDE] Image processed and encoded { base64Length }
[CLAUDE] Sending request to Claude Opus 4.5 { model, maxTokens }
[SUCCESS] Claude responded successfully { duration, tokens }
[SUCCESS] Prototype file created { path, size }
[INFO] Session cost calculated { inputCost, outputCost, totalCost }
[INFO] Thumbnail created { thumbnailPath }
[HISTORY] History saved successfully
[SUCCESS] Upload processed successfully { sessionId, cost, duration }
```

## Key Features Summary

✅ **Autonomous prototype generation** via Claude Agent SDK
✅ **Real-time console logging** with `[PREFIX]` format
✅ **Cost tracking** for every session
✅ **Session ID capture** for debugging
✅ **Mobile-responsive interface**
✅ **History browsing** with thumbnails
✅ **Custom prompt support**
✅ **Timestamp-organized output**
✅ **Health check endpoint**
✅ **Comprehensive error handling**
✅ **Production-ready structure**

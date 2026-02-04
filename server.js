import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import sharp from 'sharp';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    UPLOADS_DIR: join(__dirname, 'uploads'),
    OUTPUT_DIR: join(__dirname, '__output__'),
    HISTORY_FILE: join(__dirname, 'history', 'whiteboard-history.json'),
    MAX_IMAGE_SIZE: 1024,
    MODEL: 'claude-opus-4-5-20251101',
    MAX_TOKENS: 16384,
    COST_PER_MILLION_INPUT: 15,
    COST_PER_MILLION_OUTPUT: 75
};

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const LOG_PREFIX = {
    SERVER: '[SERVER]',
    UPLOAD: '[UPLOAD]',
    CLAUDE: '[CLAUDE]',
    BUILD: '[BUILD]',
    HISTORY: '[HISTORY]',
    ERROR: '[ERROR]',
    SUCCESS: '[SUCCESS]',
    INFO: '[INFO]'
};

function log(prefix, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} ${prefix} ${message}`);
    if (data) {
        console.log(`${timestamp} ${prefix} ${JSON.stringify(data, null, 2)}`);
    }
}

// ============================================================================
// FILE SYSTEM UTILITIES
// ============================================================================

async function ensureDirectories() {
    const dirs = [
        CONFIG.UPLOADS_DIR,
        CONFIG.OUTPUT_DIR,
        join(__dirname, 'history')
    ];

    for (const dir of dirs) {
        if (!existsSync(dir)) {
            await fs.mkdir(dir, { recursive: true });
            log(LOG_PREFIX.SERVER, `Created directory: ${dir}`);
        }
    }
}

async function loadHistory() {
    try {
        if (existsSync(CONFIG.HISTORY_FILE)) {
            const data = await fs.readFile(CONFIG.HISTORY_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(LOG_PREFIX.ERROR, 'Failed to load history', { error: error.message });
    }
    return { sessions: [] };
}

async function saveHistory(history) {
    try {
        await fs.writeFile(
            CONFIG.HISTORY_FILE,
            JSON.stringify(history, null, 2),
            'utf-8'
        );
        log(LOG_PREFIX.HISTORY, 'History saved successfully');
    } catch (error) {
        log(LOG_PREFIX.ERROR, 'Failed to save history', { error: error.message });
    }
}

async function addToHistory(session) {
    const history = await loadHistory();
    history.sessions.unshift(session);

    // Keep only last 100 sessions
    if (history.sessions.length > 100) {
        history.sessions = history.sessions.slice(0, 100);
    }

    await saveHistory(history);
}

// ============================================================================
// IMAGE PROCESSING
// ============================================================================

async function compressImage(inputPath, outputPath) {
    log(LOG_PREFIX.INFO, 'Compressing image', { inputPath, outputPath });

    try {
        const metadata = await sharp(inputPath).metadata();
        log(LOG_PREFIX.INFO, 'Original image metadata', {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format
        });

        await sharp(inputPath)
            .resize(CONFIG.MAX_IMAGE_SIZE, CONFIG.MAX_IMAGE_SIZE, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 90 })
            .toFile(outputPath);

        const compressedMetadata = await sharp(outputPath).metadata();
        log(LOG_PREFIX.SUCCESS, 'Image compressed successfully', {
            width: compressedMetadata.width,
            height: compressedMetadata.height,
            size: compressedMetadata.size
        });

        return outputPath;
    } catch (error) {
        log(LOG_PREFIX.ERROR, 'Image compression failed', { error: error.message });
        throw error;
    }
}

async function createThumbnail(imagePath, thumbnailPath) {
    try {
        await sharp(imagePath)
            .resize(200, 200, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);

        log(LOG_PREFIX.INFO, 'Thumbnail created', { thumbnailPath });
        return thumbnailPath;
    } catch (error) {
        log(LOG_PREFIX.ERROR, 'Thumbnail creation failed', { error: error.message });
        return null;
    }
}

async function imageToBase64(imagePath) {
    const imageBuffer = await fs.readFile(imagePath);
    return imageBuffer.toString('base64');
}

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, CONFIG.UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        cb(null, `whiteboard-${timestamp}.jpg`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // Increased to 50MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// COST CALCULATION
// ============================================================================

function calculateCost(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1000000) * CONFIG.COST_PER_MILLION_INPUT;
    const outputCost = (outputTokens / 1000000) * CONFIG.COST_PER_MILLION_OUTPUT;
    const totalCost = inputCost + outputCost;

    return {
        inputCost: inputCost.toFixed(6),
        outputCost: outputCost.toFixed(6),
        totalCost: totalCost.toFixed(6)
    };
}

// ============================================================================
// CLAUDE AGENT SDK - AUTONOMOUS PROTOTYPE BUILDER
// ============================================================================

async function buildPrototypeWithClaudeAgent(imagePath, customPrompt, sessionId) {
    log(LOG_PREFIX.CLAUDE, 'Starting Claude Agent SDK session', { sessionId });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = join(CONFIG.OUTPUT_DIR, `prototype-${timestamp}`);

    try {
        // Create output directory
        await fs.mkdir(outputDir, { recursive: true });
        log(LOG_PREFIX.BUILD, 'Created output directory', { outputDir });

        // Compress and encode image
        const compressedPath = join(
            CONFIG.UPLOADS_DIR,
            'compressed-' + imagePath.split('/').pop()
        );
        await compressImage(imagePath, compressedPath);

        const imageBase64 = await imageToBase64(compressedPath);
        log(LOG_PREFIX.CLAUDE, 'Image processed and encoded', {
            originalPath: imagePath,
            compressedPath,
            base64Length: imageBase64.length
        });

        // Build the system prompt
        const systemPrompt = `You are an expert web developer and prototype builder. Your job is to create a FULLY FUNCTIONAL, production-ready prototype from whiteboard sketches.

TASK: Analyze the whiteboard sketch and build a complete, working HTML prototype that matches this exact design specification.

MANDATORY DESIGN SPECIFICATIONS (unless user explicitly overrides):
- Background: White (#ffffff)
- Primary accent color: #4facfe (bright blue)
- Secondary accent color: #5eb3d6 (softer blue)
- Text colors: #030203 (headings), #666 (body text), #999 (hints)
- Buttons: Black (#030203) with white text, 50px border-radius, hover effects with lift
- Inputs/textareas: 1px solid rgba(79, 172, 254, 0.2) borders, 15px border-radius
- Cards/sections: White background, subtle blue borders rgba(79, 172, 254, 0.15), soft shadows
- Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- Animations: Smooth transitions with cubic-bezier(0.23, 1, 0.320, 1)

FUNCTIONALITY REQUIREMENTS:
1. Make it FULLY FUNCTIONAL - all buttons, forms, and interactive elements must work
2. If the sketch shows a form, implement proper form validation and submission handling
3. If the sketch shows navigation, implement working navigation
4. If the sketch shows data/content, include realistic sample data
5. If the sketch shows animations or transitions, implement them smoothly
6. All user interactions should provide clear feedback (hover states, click effects, etc.)
7. Handle edge cases (empty states, loading states, error states)
8. Make it mobile-responsive with proper touch targets

TECHNICAL REQUIREMENTS:
1. Single self-contained HTML file with embedded CSS and JavaScript
2. Use semantic HTML5 elements
3. Modern JavaScript (ES6+) with proper event handling
4. Clean, organized code structure
5. Include meaningful placeholder content
6. Add smooth animations and transitions
7. Implement proper accessibility (ARIA labels where needed)

WHITEBOARD INTERPRETATION:
1. Study the sketch carefully - understand the concept, layout, and intended functionality
2. Identify all UI components, interactions, and user flows
3. Infer reasonable functionality even if not explicitly shown
4. Create a polished, professional version of the concept

${customPrompt ? `\n=== USER-SPECIFIED OVERRIDES ===\n${customPrompt}\n(These instructions override the default design specifications above)\n` : ''}

CRITICAL OUTPUT REQUIREMENTS:
- Return ONLY the complete HTML code
- No explanations, no markdown code blocks, no wrapper text
- Start directly with <!DOCTYPE html>
- Make it production-ready and fully functional
- The user should be able to actually use this prototype, not just view a static mockup`;

        log(LOG_PREFIX.CLAUDE, 'Sending request to Claude Opus 4.5', {
            model: CONFIG.MODEL,
            maxTokens: CONFIG.MAX_TOKENS,
            customPrompt: customPrompt || 'None'
        });

        // Call Claude API
        const startTime = Date.now();
        const message = await anthropic.messages.create({
            model: CONFIG.MODEL,
            max_tokens: CONFIG.MAX_TOKENS,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: 'image/jpeg',
                            data: imageBase64
                        }
                    },
                    {
                        type: 'text',
                        text: systemPrompt
                    }
                ]
            }]
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        log(LOG_PREFIX.SUCCESS, 'Claude responded successfully', {
            duration: `${duration}s`,
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
            stopReason: message.stop_reason
        });

        // Extract and clean HTML
        let htmlContent = message.content[0].text;

        // Remove any markdown code blocks
        htmlContent = htmlContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

        // Ensure DOCTYPE
        if (!htmlContent.startsWith('<!DOCTYPE') && !htmlContent.startsWith('<html')) {
            htmlContent = '<!DOCTYPE html>\n' + htmlContent;
        }

        // Save the prototype
        const indexPath = join(outputDir, 'index.html');
        await fs.writeFile(indexPath, htmlContent, 'utf-8');

        log(LOG_PREFIX.SUCCESS, 'Prototype file created', {
            path: indexPath,
            size: htmlContent.length
        });

        // Calculate costs
        const costs = calculateCost(message.usage.input_tokens, message.usage.output_tokens);

        log(LOG_PREFIX.INFO, 'Session cost calculated', costs);

        // Create thumbnail
        const thumbnailPath = join(outputDir, 'thumbnail.jpg');
        await createThumbnail(compressedPath, thumbnailPath);

        return {
            success: true,
            sessionId,
            outputDir,
            prototypeUrl: `/demos/${outputDir.split('/').pop()}/index.html`,
            thumbnailUrl: `/demos/${outputDir.split('/').pop()}/thumbnail.jpg`,
            tokens: {
                input: message.usage.input_tokens,
                output: message.usage.output_tokens
            },
            cost: parseFloat(costs.totalCost),
            costs,
            duration: parseFloat(duration),
            files: ['index.html'],
            timestamp: new Date().toISOString(),
            model: CONFIG.MODEL
        };

    } catch (error) {
        log(LOG_PREFIX.ERROR, 'Claude Agent SDK build failed', {
            sessionId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(CONFIG.UPLOADS_DIR));
app.use('/demos', express.static(CONFIG.OUTPUT_DIR));

// Request logging middleware
app.use((req, res, next) => {
    log(LOG_PREFIX.SERVER, `${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

// ============================================================================
// ROUTES
// ============================================================================

// Main page
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Upload and process whiteboard
app.post('/upload', upload.single('whiteboard'), async (req, res) => {
    const sessionId = uuidv4();

    log(LOG_PREFIX.UPLOAD, 'New upload session started', {
        sessionId,
        filename: req.file?.filename
    });

    try {
        if (!req.file) {
            log(LOG_PREFIX.ERROR, 'No file uploaded', { sessionId });
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const customPrompt = req.body.prompt || '';
        const imagePath = join(CONFIG.UPLOADS_DIR, req.file.filename);

        log(LOG_PREFIX.INFO, 'Processing upload', {
            sessionId,
            filename: req.file.filename,
            size: req.file.size,
            customPrompt: customPrompt || 'None'
        });

        // Build prototype using Claude Agent SDK
        const result = await buildPrototypeWithClaudeAgent(
            imagePath,
            customPrompt,
            sessionId
        );

        // Add to history
        const historyEntry = {
            sessionId,
            timestamp: result.timestamp,
            originalFilename: req.file.filename,
            customPrompt,
            outputDir: result.outputDir,
            prototypeUrl: result.prototypeUrl,
            thumbnailUrl: result.thumbnailUrl,
            tokens: result.tokens,
            cost: result.cost,
            costs: result.costs,
            duration: result.duration,
            model: result.model,
            files: result.files,
            success: true
        };

        await addToHistory(historyEntry);

        log(LOG_PREFIX.SUCCESS, 'Upload processed successfully', {
            sessionId,
            cost: `$${result.cost}`,
            duration: `${result.duration}s`
        });

        res.json({
            success: true,
            sessionId,
            message: 'Prototype generated successfully!',
            demoUrl: result.prototypeUrl,
            thumbnailUrl: result.thumbnailUrl,
            outputDir: result.outputDir,
            tokens: result.tokens,
            cost: result.cost,
            costs: result.costs,
            duration: result.duration,
            files: result.files
        });

    } catch (error) {
        log(LOG_PREFIX.ERROR, 'Upload processing failed', {
            sessionId,
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            sessionId,
            error: error.message || 'Failed to generate prototype'
        });
    }
});

// Get history
app.get('/history', async (req, res) => {
    try {
        const history = await loadHistory();

        log(LOG_PREFIX.HISTORY, 'History retrieved', {
            totalSessions: history.sessions.length
        });

        res.json({
            success: true,
            sessions: history.sessions,
            total: history.sessions.length
        });
    } catch (error) {
        log(LOG_PREFIX.ERROR, 'Failed to retrieve history', {
            error: error.message
        });

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve history'
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        config: {
            model: CONFIG.MODEL,
            maxTokens: CONFIG.MAX_TOKENS,
            maxImageSize: CONFIG.MAX_IMAGE_SIZE
        }
    });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function startServer() {
    try {
        // Ensure directories exist
        await ensureDirectories();

        // Validate API key
        if (!process.env.ANTHROPIC_API_KEY) {
            log(LOG_PREFIX.ERROR, 'ANTHROPIC_API_KEY not found in environment');
            console.error('\n⚠️  ERROR: ANTHROPIC_API_KEY not set');
            console.error('   Create a .env file with: ANTHROPIC_API_KEY=your-key-here\n');
            process.exit(1);
        }

        // Start server
        app.listen(PORT, () => {
            console.log('\n' + '='.repeat(70));
            console.log('🚀 WHITEBOARD TO PROTOTYPE - Claude Agent SDK');
            console.log('='.repeat(70));
            console.log(`📱 Mobile:   http://localhost:${PORT}`);
            console.log(`💻 Desktop:  http://localhost:${PORT}`);
            console.log(`📊 History:  http://localhost:${PORT}/history`);
            console.log(`🏥 Health:   http://localhost:${PORT}/health`);
            console.log('='.repeat(70));
            console.log(`🤖 Model:    ${CONFIG.MODEL}`);
            console.log(`📁 Uploads:  ${CONFIG.UPLOADS_DIR}`);
            console.log(`📦 Output:   ${CONFIG.OUTPUT_DIR}`);
            console.log('='.repeat(70) + '\n');

            log(LOG_PREFIX.SERVER, 'Server started successfully', {
                port: PORT,
                nodeVersion: process.version,
                platform: process.platform
            });
        });

    } catch (error) {
        log(LOG_PREFIX.ERROR, 'Server startup failed', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

process.on('uncaughtException', (error) => {
    log(LOG_PREFIX.ERROR, 'Uncaught exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log(LOG_PREFIX.ERROR, 'Unhandled rejection', {
        reason,
        promise
    });
});

// ============================================================================
// START
// ============================================================================

startServer();

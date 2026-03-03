import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { basename, dirname, join, resolve } from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import sharp from 'sharp';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.disable('x-powered-by');

const PORT = process.env.PORT || 3000;
const DATA_ROOT = resolve(process.env.DATA_ROOT || __dirname);

const CONFIG = {
    DATA_ROOT,
    UPLOADS_DIR: join(DATA_ROOT, 'uploads'),
    OUTPUT_DIR: join(DATA_ROOT, '__output__'),
    HISTORY_DIR: join(DATA_ROOT, 'history'),
    HISTORY_FILE: join(DATA_ROOT, 'history', 'whiteboard-history.json'),
    ASSETS_DIR: join(__dirname, 'assets'),
    MAX_IMAGE_SIZE: 768,
    MAX_UPLOAD_SIZE: 25 * 1024 * 1024,
    MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    MAX_TOKENS: 8192,
    FALLBACK_MODEL: process.env.ANTHROPIC_FALLBACK_MODEL || '',
    COST_PER_MILLION_INPUT: 3,
    COST_PER_MILLION_OUTPUT: 15
};

const LOG_PREFIX = {
    SERVER: '[SERVER]',
    UPLOAD: '[UPLOAD]',
    JOB: '[JOB]',
    MODEL: '[MODEL]',
    HISTORY: '[HISTORY]',
    ERROR: '[ERROR]',
    SUCCESS: '[SUCCESS]',
    INFO: '[INFO]'
};

const inFlightJobs = new Map();

function log(prefix, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} ${prefix} ${message}`);
    if (data) {
        console.log(`${timestamp} ${prefix} ${JSON.stringify(data, null, 2)}`);
    }
}

async function ensureDirectories() {
    const directories = [
        CONFIG.UPLOADS_DIR,
        CONFIG.OUTPUT_DIR,
        CONFIG.HISTORY_DIR
    ];

    for (const directory of directories) {
        if (!existsSync(directory)) {
            await fs.mkdir(directory, { recursive: true });
            log(LOG_PREFIX.SERVER, 'Created directory', { directory });
        }
    }
}

function buildPreviewUrl(demoId) {
    return `/preview/${demoId}`;
}

function buildEmbedUrl(demoId) {
    return `/embed/${demoId}`;
}

function buildDownloadUrl(demoId) {
    return `/download/${demoId}`;
}

function buildThumbnailUrl(demoId) {
    return `/thumbnail/${demoId}`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getDemoIdFromSession(session) {
    if (typeof session?.demoId === 'string' && session.demoId) {
        return session.demoId;
    }

    if (typeof session?.outputDir === 'string' && session.outputDir) {
        return session.outputDir.split('/').pop();
    }

    if (typeof session?.prototypeUrl === 'string' && session.prototypeUrl) {
        const segments = session.prototypeUrl.split('/').filter(Boolean);
        if (segments[0] === 'demos' && segments[1]) {
            return segments[1];
        }
        if (segments[0] === 'preview' && segments[1]) {
            return segments[1];
        }
    }

    return null;
}

function normalizeHistorySession(session) {
    const demoId = getDemoIdFromSession(session);

    return {
        sessionId: session.sessionId || uuidv4(),
        timestamp: session.timestamp || new Date().toISOString(),
        originalFilename: session.originalFilename || '',
        customPrompt: session.customPrompt || '',
        demoId,
        previewUrl: demoId ? buildPreviewUrl(demoId) : null,
        embedUrl: demoId ? buildEmbedUrl(demoId) : null,
        downloadUrl: demoId ? buildDownloadUrl(demoId) : null,
        thumbnailUrl: demoId ? buildThumbnailUrl(demoId) : null,
        tokens: {
            input: Number(session.tokens?.input || 0),
            output: Number(session.tokens?.output || 0)
        },
        cost: Number(session.cost || 0),
        costs: {
            inputCost: session.costs?.inputCost || '0.000000',
            outputCost: session.costs?.outputCost || '0.000000',
            totalCost: session.costs?.totalCost || '0.000000'
        },
        duration: Number(session.duration || 0),
        model: session.model || CONFIG.MODEL,
        files: Array.isArray(session.files) ? session.files : ['index.html'],
        success: session.success !== false
    };
}

async function loadHistory() {
    try {
        if (!existsSync(CONFIG.HISTORY_FILE)) {
            return { sessions: [] };
        }

        const raw = await fs.readFile(CONFIG.HISTORY_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        const sessions = Array.isArray(parsed.sessions)
            ? parsed.sessions.map(normalizeHistorySession)
            : [];

        return { sessions };
    } catch (error) {
        log(LOG_PREFIX.ERROR, 'Failed to load history', { error: error.message });
        return { sessions: [] };
    }
}

async function saveHistory(history) {
    await fs.writeFile(CONFIG.HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
    log(LOG_PREFIX.HISTORY, 'History saved', { totalSessions: history.sessions.length });
}

async function addToHistory(session) {
    const history = await loadHistory();
    history.sessions.unshift(normalizeHistorySession(session));
    history.sessions = history.sessions.slice(0, 100);
    await saveHistory(history);
}

async function safeUnlink(filePath) {
    if (!filePath) {
        return;
    }

    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            log(LOG_PREFIX.ERROR, 'Failed to remove file', {
                filePath,
                error: error.message
            });
        }
    }
}

async function compressImage(inputPath, outputPath) {
    await sharp(inputPath)
        .resize(CONFIG.MAX_IMAGE_SIZE, CONFIG.MAX_IMAGE_SIZE, {
            fit: 'inside',
            withoutEnlargement: true
        })
        .jpeg({ quality: 78 })
        .toFile(outputPath);

    return outputPath;
}

async function createThumbnail(imagePath, thumbnailPath) {
    const thumbnailDir = dirname(thumbnailPath);
    await fs.mkdir(thumbnailDir, { recursive: true });

    try {
        await sharp(imagePath)
            .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 84 })
            .toFile(thumbnailPath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }

        await fs.mkdir(thumbnailDir, { recursive: true });
        await sharp(imagePath)
            .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 84 })
            .toFile(thumbnailPath);
    }

    return thumbnailPath;
}

async function writeFileWithDirectoryRetry(filePath, content, encoding = 'utf-8') {
    const parentDir = dirname(filePath);
    await fs.mkdir(parentDir, { recursive: true });

    try {
        await fs.writeFile(filePath, content, encoding);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }

        log(LOG_PREFIX.INFO, 'Recreating missing output directory before retry', {
            filePath,
            parentDir
        });
        await fs.mkdir(parentDir, { recursive: true });
        await fs.writeFile(filePath, content, encoding);
    }
}

async function imageToBase64(imagePath) {
    const buffer = await fs.readFile(imagePath);
    return buffer.toString('base64');
}

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

function assertDemoId(demoId) {
    if (!/^[A-Za-z0-9-]+$/.test(demoId)) {
        throw new Error('Invalid demo id');
    }
    return demoId;
}

function getDemoPaths(demoId) {
    const safeDemoId = assertDemoId(demoId);
    const demoDir = join(CONFIG.OUTPUT_DIR, safeDemoId);

    return {
        demoId: safeDemoId,
        demoDir,
        indexPath: join(demoDir, 'index.html'),
        thumbnailPath: join(demoDir, 'thumbnail.jpg')
    };
}

function isCanceledError(error, signal) {
    return Boolean(
        signal?.aborted ||
        error?.name === 'AbortError' ||
        error?.name === 'APIUserAbortError' ||
        error?.message === 'Generation canceled by user'
    );
}

function createSystemPrompt(customPrompt) {
    return `You are an expert product designer and frontend engineer. Turn any whiteboard sketch into a clickable product demo.

GOAL:
- Produce a single self-contained HTML file with embedded CSS and JavaScript.
- The output should feel like a realistic product demo, not a static mock.
- Match the whiteboard's intent while filling in missing details with sensible UX.
- Work from rough, low-fidelity, or partially annotated whiteboard sketches and still produce a coherent clickable demo.

DEFAULT UX DESIGN BEHAVIOR:
- Always improve the sketch like a strong UX designer would.
- Do not mirror the roughness of the whiteboard literally.
- Upgrade the information hierarchy, spacing, typography, layout, states, and calls to action.
- Make the result feel polished, intentional, and demo-ready even when the sketch is sparse.
- Preserve the product idea from the sketch, but improve the user experience by default unless the user explicitly asks for something raw or lo-fi.

REQUIRED BEHAVIOR:
1. All visible controls must work.
2. Include realistic sample content and meaningful empty/loading/error states.
3. Make the layout responsive on desktop and mobile.
4. Use semantic HTML and accessible labels.
5. Keep everything inside one HTML file.

VISUAL DIRECTION:
- Clean product-demo quality.
- White or light background unless the whiteboard strongly suggests otherwise.
- Use a consistent accent system and clear hierarchy.
- Choose stronger visual structure than the sketch provides when needed.
- Use polished component patterns, clear grouping, and better visual rhythm.
- Add motion only when it improves comprehension.
- Do not invent decorative filler that is not explained by the sketch or product concept.
- Do not add generic gray image placeholders, avatar ovals, empty hero art, random blobs, or fake mock content.
- Every prominent visible shape should either represent a real part of the product, a meaningful control, or a clear explanation of the sketch.

IMPLEMENTATION RULES:
- Return only raw HTML.
- No markdown fences or explanations.
- Start with <!DOCTYPE html>.
- Do not rely on external assets, libraries, or network calls.
- Keep the implementation compact and fast to generate.
- Prefer one polished primary flow over many secondary screens.
- Avoid unnecessary complexity, oversized datasets, or long blocks of copy.
- Use concise HTML, CSS, and JavaScript while still delivering a strong demo.

${customPrompt ? `USER OVERRIDES:\n${customPrompt}` : ''}`.trim();
}

function extractResponseText(response) {
    if (!Array.isArray(response?.content)) {
        return '';
    }

    const textParts = [];

    for (const content of response.content) {
        if (content?.type === 'text' && typeof content.text === 'string' && content.text.trim()) {
            textParts.push(content.text.trim());
        }
    }

    return textParts.join('\n').trim();
}

function extractRefusal(response) {
    if (!Array.isArray(response?.content)) {
        return '';
    }

    for (const content of response.content) {
        if (content?.type === 'text' && typeof content.text === 'string' && /cannot|can't|unable|won't|refuse/i.test(content.text)) {
            return content.text.trim();
        }
    }

    return '';
}

function buildResponseDiagnostics(response) {
    return {
        id: response?.id || null,
        type: response?.type || null,
        model: response?.model || null,
        stopReason: response?.stop_reason || null,
        contentTypes: Array.isArray(response?.content)
            ? response.content.map((content) => content?.type || null)
            : []
    };
}

function getUsageMetrics(response) {
    return {
        input: Number(response?.usage?.input_tokens || 0) + Number(response?.usage?.cache_creation_input_tokens || 0) + Number(response?.usage?.cache_read_input_tokens || 0),
        output: Number(response?.usage?.output_tokens || 0)
    };
}

function getModelCandidates() {
    return [...new Set([CONFIG.MODEL, CONFIG.FALLBACK_MODEL].filter(Boolean))];
}

function getAnthropicApiKey(req) {
    const headerValue = req.get('x-anthropic-api-key');

    if (typeof headerValue === 'string' && headerValue.trim()) {
        return headerValue.trim();
    }

    if (typeof process.env.ANTHROPIC_API_KEY === 'string' && process.env.ANTHROPIC_API_KEY.trim()) {
        return process.env.ANTHROPIC_API_KEY.trim();
    }

    return '';
}

async function createAnthropicMessage({ apiKey, model, systemPrompt, imageBase64, signal }) {
    if (!apiKey) {
        throw new Error('Add an Anthropic API key to run the demo.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': apiKey
        },
        body: JSON.stringify({
            model,
            max_tokens: CONFIG.MAX_TOKENS,
            system: systemPrompt,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: 'Analyze this whiteboard sketch and return a single self-contained HTML file for a clickable product demo.'
                    },
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: 'image/jpeg',
                            data: imageBase64
                        }
                    }
                ]
            }]
        }),
        signal
    });

    const payload = await response.json().catch(async () => {
        const fallbackText = await response.text();
        return {
            error: {
                message: fallbackText || `Anthropic request failed with status ${response.status}`
            }
        };
    });

    if (!response.ok) {
        throw new Error(payload?.error?.message || `Anthropic request failed with status ${response.status}`);
    }

    return payload;
}

async function buildPrototypeWithAnthropic({ apiKey, imagePath, customPrompt, sessionId, signal }) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const demoId = `prototype-${timestamp}`;
    const outputDir = join(CONFIG.OUTPUT_DIR, demoId);
    const compressedPath = join(CONFIG.UPLOADS_DIR, `compressed-${basename(imagePath)}`);

    await fs.mkdir(outputDir, { recursive: true });
    await compressImage(imagePath, compressedPath);

    const imageBase64 = await imageToBase64(compressedPath);
    const systemPrompt = createSystemPrompt(customPrompt);
    const startedAt = Date.now();
    const modelCandidates = getModelCandidates();
    let response = null;
    let htmlContent = '';

    for (const model of modelCandidates) {
        log(LOG_PREFIX.MODEL, 'Starting generation', {
            sessionId,
            demoId,
            model
        });

        response = await createAnthropicMessage({
            apiKey,
            model,
            systemPrompt,
            imageBase64,
            signal
        });

        htmlContent = extractResponseText(response);

        if (htmlContent) {
            break;
        }

        const refusal = extractRefusal(response);
        const diagnostics = buildResponseDiagnostics(response);
        log(LOG_PREFIX.MODEL, 'Anthropic response missing HTML output', diagnostics);

        if (refusal) {
            throw new Error(`Model refused the request: ${refusal}`);
        }

        if (response?.stop_reason === 'max_tokens' && model === modelCandidates[modelCandidates.length - 1]) {
            throw new Error('Model response incomplete: max_tokens');
        }
    }

    if (!response || !htmlContent) {
        throw new Error('Model did not return HTML output');
    }

    htmlContent = htmlContent.replace(/```html\s*/gi, '').replace(/```\s*/g, '').trim();

    if (!htmlContent.startsWith('<!DOCTYPE') && !htmlContent.startsWith('<html')) {
        htmlContent = `<!DOCTYPE html>\n${htmlContent}`;
    }

    await fs.mkdir(outputDir, { recursive: true });

    const indexPath = join(outputDir, 'index.html');
    await writeFileWithDirectoryRetry(indexPath, htmlContent, 'utf-8');

    const thumbnailPath = join(outputDir, 'thumbnail.jpg');
    await createThumbnail(compressedPath, thumbnailPath);

    const duration = Number(((Date.now() - startedAt) / 1000).toFixed(2));
    const usage = getUsageMetrics(response);
    const costs = calculateCost(usage.input, usage.output);

    return {
        success: true,
        sessionId,
        demoId,
        previewUrl: buildPreviewUrl(demoId),
        embedUrl: buildEmbedUrl(demoId),
        downloadUrl: buildDownloadUrl(demoId),
        thumbnailUrl: buildThumbnailUrl(demoId),
        tokens: usage,
        cost: Number(costs.totalCost),
        costs,
        duration,
        files: ['index.html'],
        timestamp: new Date().toISOString(),
        model: response?.model || CONFIG.MODEL,
        compressedPath
    };
}

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
    limits: {
        fileSize: CONFIG.MAX_UPLOAD_SIZE
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
            return;
        }

        cb(new Error('Only image files are allowed'));
    }
});

app.use((req, res, next) => {
    log(LOG_PREFIX.SERVER, `${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

app.use((req, res, next) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));
app.use('/assets', express.static(CONFIG.ASSETS_DIR));

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.single('whiteboard'), async (req, res) => {
    const sessionId = typeof req.body?.sessionId === 'string' && req.body.sessionId
        ? req.body.sessionId
        : uuidv4();
    const imagePath = req.file ? join(CONFIG.UPLOADS_DIR, req.file.filename) : null;
    const compressedPath = req.file ? join(CONFIG.UPLOADS_DIR, `compressed-${req.file.filename}`) : null;
    const controller = new AbortController();

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Upload a whiteboard photo to continue.'
            });
        }

        if (inFlightJobs.has(sessionId)) {
            return res.status(409).json({
                success: false,
                sessionId,
                error: 'A build is already running for this session.'
            });
        }

        const customPrompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
        const apiKey = getAnthropicApiKey(req);

        inFlightJobs.set(sessionId, {
            controller,
            startedAt: new Date().toISOString()
        });

        log(LOG_PREFIX.UPLOAD, 'Accepted upload', {
            sessionId,
            filename: req.file.filename,
            size: req.file.size
        });

        const result = await buildPrototypeWithAnthropic({
            apiKey,
            imagePath,
            customPrompt,
            sessionId,
            signal: controller.signal
        });

        await addToHistory({
            sessionId,
            timestamp: result.timestamp,
            originalFilename: req.file.filename,
            customPrompt,
            demoId: result.demoId,
            tokens: result.tokens,
            cost: result.cost,
            costs: result.costs,
            duration: result.duration,
            model: result.model,
            files: result.files,
            success: true
        });

        log(LOG_PREFIX.SUCCESS, 'Generation completed', {
            sessionId,
            demoId: result.demoId,
            duration: result.duration,
            totalCost: result.cost
        });

        res.json({
            success: true,
            sessionId,
            message: 'Prototype generated successfully.',
            demoId: result.demoId,
            previewUrl: result.previewUrl,
            embedUrl: result.embedUrl,
            downloadUrl: result.downloadUrl,
            thumbnailUrl: result.thumbnailUrl,
            tokens: result.tokens,
            cost: result.cost,
            costs: result.costs,
            duration: result.duration,
            files: result.files,
            model: result.model
        });
    } catch (error) {
        if (isCanceledError(error, controller.signal)) {
            log(LOG_PREFIX.JOB, 'Generation canceled', { sessionId });
            res.status(499).json({
                success: false,
                canceled: true,
                sessionId,
                error: 'Generation canceled.'
            });
            return;
        }

        log(LOG_PREFIX.ERROR, 'Upload processing failed', {
            sessionId,
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            sessionId,
            error: error.message || 'Failed to generate prototype.'
        });
    } finally {
        inFlightJobs.delete(sessionId);
        await safeUnlink(imagePath);
        await safeUnlink(compressedPath);
    }
});

app.post('/jobs/:sessionId/cancel', (req, res) => {
    const { sessionId } = req.params;
    const job = inFlightJobs.get(sessionId);

    if (!job) {
        res.status(404).json({
            success: false,
            sessionId,
            error: 'No active job found for this session.'
        });
        return;
    }

    job.controller.abort(new Error('Generation canceled by user'));
    inFlightJobs.delete(sessionId);

    log(LOG_PREFIX.JOB, 'Cancel requested', { sessionId });

    res.json({
        success: true,
        sessionId,
        message: 'Generation canceled.'
    });
});

app.get('/history', async (req, res) => {
    try {
        const history = await loadHistory();
        res.json({
            success: true,
            sessions: history.sessions,
            total: history.sessions.length
        });
    } catch (error) {
        log(LOG_PREFIX.ERROR, 'Failed to retrieve history', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve history.'
        });
    }
});

app.get('/thumbnail/:demoId', async (req, res) => {
    try {
        const { thumbnailPath } = getDemoPaths(req.params.demoId);
        await fs.access(thumbnailPath);
        res.sendFile(thumbnailPath);
    } catch (error) {
        res.status(404).json({
            success: false,
            error: 'Thumbnail not found.'
        });
    }
});

app.get('/download/:demoId', async (req, res) => {
    try {
        const { demoId, indexPath } = getDemoPaths(req.params.demoId);
        await fs.access(indexPath);
        res.download(indexPath, `${demoId}.html`);
    } catch (error) {
        res.status(404).json({
            success: false,
            error: 'Prototype not found.'
        });
    }
});

app.get('/embed/:demoId', async (req, res) => {
    try {
        const { indexPath } = getDemoPaths(req.params.demoId);
        const prototypeHtml = await fs.readFile(indexPath, 'utf-8');
        res.type('html').send(prototypeHtml);
    } catch (error) {
        res.status(404).sendFile(join(__dirname, 'public', 'not-found.html'));
    }
});

app.get('/preview/:demoId', async (req, res) => {
    try {
        const { demoId, indexPath } = getDemoPaths(req.params.demoId);
        const prototypeHtml = await fs.readFile(indexPath, 'utf-8');

        res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(demoId)} Preview</title>
    <style>
        :root {
            color-scheme: light;
            font-family: "Avenir Next", "Segoe UI", sans-serif;
            --bg: #f2f6fb;
            --panel: rgba(255, 255, 255, 0.84);
            --text: #10213a;
            --muted: #5e728f;
            --border: rgba(38, 96, 196, 0.12);
            --accent: #2563eb;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            background:
                radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 34%),
                radial-gradient(circle at top right, rgba(14, 165, 233, 0.16), transparent 28%),
                var(--bg);
            color: var(--text);
        }

        .shell {
            width: min(1280px, calc(100vw - 32px));
            margin: 20px auto;
            border: 1px solid var(--border);
            border-radius: 24px;
            background: var(--panel);
            backdrop-filter: blur(18px);
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
            overflow: hidden;
        }

        .topbar {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: center;
            padding: 18px 22px;
            border-bottom: 1px solid var(--border);
        }

        .title {
            font-size: 14px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--muted);
        }

        .actions {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .button {
            border: none;
            border-radius: 999px;
            padding: 12px 18px;
            text-decoration: none;
            font-weight: 700;
            font-size: 14px;
            transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }

        .button:hover {
            transform: translateY(-1px);
        }

        .button.primary {
            background: var(--accent);
            color: white;
            box-shadow: 0 12px 30px rgba(37, 99, 235, 0.24);
        }

        .button.secondary {
            background: rgba(37, 99, 235, 0.08);
            color: var(--text);
        }

        .frame {
            padding: 18px;
            height: calc(100vh - 108px);
            min-height: 680px;
        }

        iframe {
            width: 100%;
            height: 100%;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 18px;
            background: white;
        }

        @media (max-width: 720px) {
            .shell {
                width: calc(100vw - 20px);
                margin: 10px auto;
            }

            .topbar {
                align-items: flex-start;
                flex-direction: column;
            }

            .frame {
                height: calc(100vh - 164px);
                min-height: 560px;
                padding: 12px;
            }

            .actions {
                width: 100%;
            }

            .button {
                flex: 1;
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="shell">
        <div class="topbar">
            <div>
                <div class="title">Whiteboard to Prototype</div>
                <strong>${escapeHtml(demoId)}</strong>
            </div>
            <div class="actions">
                <a class="button secondary" href="/">Build another</a>
                <a class="button primary" href="${buildDownloadUrl(demoId)}">Download HTML</a>
            </div>
        </div>
        <div class="frame">
            <iframe id="prototypeFrame" sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts" title="${escapeHtml(demoId)} prototype preview"></iframe>
        </div>
    </div>
    <script>
        document.getElementById('prototypeFrame').srcdoc = ${JSON.stringify(prototypeHtml)};
    </script>
</body>
</html>`);
    } catch (error) {
        res.status(404).sendFile(join(__dirname, 'public', 'not-found.html'));
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activeJobs: inFlightJobs.size,
        config: {
            model: CONFIG.MODEL,
            maxTokens: CONFIG.MAX_TOKENS,
            maxImageSize: CONFIG.MAX_IMAGE_SIZE,
            maxUploadSize: CONFIG.MAX_UPLOAD_SIZE,
            defaultAnthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim())
        }
    });
});

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
            success: false,
            error: `Upload images up to ${Math.round(CONFIG.MAX_UPLOAD_SIZE / 1024 / 1024)}MB.`
        });
        return;
    }

    if (error?.message === 'Only image files are allowed') {
        res.status(400).json({
            success: false,
            error: error.message
        });
        return;
    }

    next(error);
});

process.on('uncaughtException', (error) => {
    log(LOG_PREFIX.ERROR, 'Uncaught exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    log(LOG_PREFIX.ERROR, 'Unhandled rejection', { reason });
});

async function startServer() {
    await ensureDirectories();

    app.listen(PORT, () => {
        console.log('');
        console.log('WHITEBOARD TO PROTOTYPE');
        console.log(`App:     http://localhost:${PORT}`);
        console.log(`History: http://localhost:${PORT}/history.html`);
        console.log(`Health:  http://localhost:${PORT}/health`);
        console.log('');

        log(LOG_PREFIX.SERVER, 'Server started', {
            port: PORT,
            nodeVersion: process.version,
            platform: process.platform,
            dataRoot: CONFIG.DATA_ROOT,
            defaultAnthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim())
        });
    });
}

startServer().catch((error) => {
    log(LOG_PREFIX.ERROR, 'Server startup failed', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

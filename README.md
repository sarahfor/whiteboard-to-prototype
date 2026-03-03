# Whiteboard to Prototype

Turn a whiteboard sketch into a product demo.

Whiteboard to Prototype is a Node/Express app that takes a whiteboard photo, sends it to Anthropic, and returns a self-contained HTML prototype you can preview, open in a browser, and download.

## What the product does

- Upload a whiteboard sketch or start from a built-in sample
- Add optional product direction before generation
- Generate a clickable HTML demo from the sketch
- Preview the result inside the app or open the raw HTML in a new tab
- Download the generated file
- Review completed builds in session history

## Project structure

- [public/index.html](public/index.html): real app UI
- [public/history.html](public/history.html): history page
- [public/not-found.html](public/not-found.html): missing preview fallback
- [server.js](server.js): Express server, generation flow, previews, downloads, history
- [index.html](index.html): static GitHub Pages landing page
- [render.yaml](render.yaml): Render deployment blueprint
- [DEPLOY_RENDER.md](DEPLOY_RENDER.md): Render deployment notes

## Local development

1. Install dependencies

```bash
npm install
```

2. Create a local env file

```bash
cp .env.example .env
```

3. Add your Anthropic configuration

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-sonnet-4-5
PORT=3000
```

Optional:

```env
# store uploads, generated demos, and history outside the repo
DATA_ROOT=/absolute/path/to/persistent/storage
```

4. Start the app

```bash
npm start
```

5. Open the app

- `http://localhost:3000`
- `http://localhost:3000/history.html`
- `http://localhost:3000/health`

## Anthropic key behavior

The app supports two ways to run builds:

- Default server key via `ANTHROPIC_API_KEY` in `.env`
- Per-session browser key supplied by the user in the UI

If no default server key is set, the server still starts. Users can add their own Anthropic key during their browser session to run demos.

## API routes

- `GET /`: main app
- `POST /upload`: generate a prototype from an uploaded whiteboard
- `POST /jobs/:sessionId/cancel`: cancel an in-flight generation
- `GET /history`: session history JSON
- `GET /preview/:demoId`: sandboxed preview wrapper
- `GET /embed/:demoId`: raw generated HTML for browser preview
- `GET /download/:demoId`: download generated HTML
- `GET /thumbnail/:demoId`: generated thumbnail
- `GET /health`: app health and config status

## Deployment

GitHub Pages can only host the static landing page in [index.html](index.html). It cannot run the live generation flow.

To deploy the real app, use a host that runs Node and can keep the Anthropic key private. This repo includes Render configuration:

- [render.yaml](render.yaml)
- [DEPLOY_RENDER.md](DEPLOY_RENDER.md)

## Notes

- Generated demos, uploads, and local history are app data, not source code.
- Temporary upload files are cleaned up after generation.
- The real product experience lives in [public/index.html](public/index.html), not the root landing page.

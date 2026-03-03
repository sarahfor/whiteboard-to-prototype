# Whiteboard to Prototype

Turn a whiteboard sketch into a product demo.

This repo contains the real web app, a lightweight GitHub Pages landing page, and the deployment config for running the live Node service.

## What matters

- Main product app: [public/index.html](public/index.html)
- Server and API routes: [server.js](server.js)
- Static GitHub Pages landing page: [index.html](index.html)
- Deploy config for Render: [render.yaml](render.yaml)

## Local development

1. Install dependencies:
```bash
npm install
```

2. Create `.env` from the example:
```bash
cp .env.example .env
```

3. Add your Anthropic key:
```env
ANTHROPIC_API_KEY=your_anthropic_key_here
ANTHROPIC_MODEL=claude-sonnet-4-5
PORT=3000
```

4. Start the app:
```bash
npm start
```

5. Open:
- `http://localhost:3000`
- `http://localhost:3000/history.html`

## Repo structure

```text
public/
  index.html        Real app UI
  history.html      Session history UI
  not-found.html    Missing preview fallback

assets/
  algebra-whiteboard.jpg
  box-search-whiteboard.jpg

server.js           Express server, uploads, generation, previews
index.html          Static GitHub Pages landing page
render.yaml         Render deployment blueprint
DEPLOY_RENDER.md    Deployment steps
```

## Notes

- The real app requires Node and a server-side Anthropic key.
- The root [index.html](index.html) is only the static GitHub Pages entry.
- Local uploads, generated demos, and session history are not product source code and should not be committed.

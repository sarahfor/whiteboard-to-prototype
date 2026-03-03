# Whiteboard to Prototype

Turn a whiteboard sketch into a working prototype.

This repo contains two different surfaces:

- The real product app in [public/index.html](/Users/sarahforrest/whiteboard-to-prototype/public/index.html)
- The static GitHub Pages landing page in [index.html](/Users/sarahforrest/whiteboard-to-prototype/index.html)

The live product is a Node/Express app that accepts a whiteboard photo, sends it to Anthropic, and saves a generated self-contained HTML demo into `__output__/`.

## What the product does

- Upload a whiteboard photo from desktop or phone
- Preview the whiteboard before building
- Add optional build direction
- Generate a working HTML prototype
- Open the finished prototype in a new browser tab
- Review previous generations in the history page
- Let users supply their own Anthropic API key for the current browser session

## Current product structure

- [server.js](/Users/sarahforrest/whiteboard-to-prototype/server.js): Express server, Anthropic generation flow, history API
- [public/index.html](/Users/sarahforrest/whiteboard-to-prototype/public/index.html): actual upload/build interface
- [public/history.html](/Users/sarahforrest/whiteboard-to-prototype/public/history.html): history UI
- [index.html](/Users/sarahforrest/whiteboard-to-prototype/index.html): static GitHub Pages marketing/demo page
- [start.sh](/Users/sarahforrest/whiteboard-to-prototype/start.sh): local startup helper
- [uploads/](/Users/sarahforrest/whiteboard-to-prototype/uploads): temporary uploaded whiteboard images
- [__output__/](/Users/sarahforrest/whiteboard-to-prototype/__output__): generated demos
- [history/](/Users/sarahforrest/whiteboard-to-prototype/history): saved generation history

## Local setup

1. Install dependencies

```bash
npm install
```

2. Create a local env file

```bash
cp .env.example .env
```

3. Add an Anthropic key if you want a default server key

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PORT=3000
```

4. Start the app

```bash
npm start
```

Or:

```bash
./start.sh
```

## Anthropic key behavior

The app supports two ways to run builds:

- A default server key from `.env`
- A user-provided Anthropic key stored only in the current browser session

That means the app can still start even if `.env` does not contain a key. In that case, a user can enter their own Anthropic key in the UI and use the tool with their own credits.

## Main routes

- `GET /`: main builder UI
- `GET /history.html`: history page
- `POST /upload`: upload a whiteboard and generate a prototype
- `GET /history`: history JSON
- `GET /health`: app health and key availability status
- `GET /demos/:demoId/index.html`: generated prototype output
- `GET /demos/:demoId/thumbnail.jpg`: generated thumbnail

## GitHub Pages vs product app

The root [index.html](/Users/sarahforrest/whiteboard-to-prototype/index.html) is the static GitHub Pages version.

It is not the real builder.

The actual product experience lives in [public/index.html](/Users/sarahforrest/whiteboard-to-prototype/public/index.html) and requires the Node server in [server.js](/Users/sarahforrest/whiteboard-to-prototype/server.js).

## Notes

- Generated demos and history are app data, not source assets.
- Uploaded originals and compressed copies are cleaned up after generation.
- The current builder is the restored Claude Agent SDK style product flow, not the newer preview-wrapper version.

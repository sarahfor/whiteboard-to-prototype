# Deploy To Render

This app needs a real Node host because it:

- accepts uploads
- calls the Anthropic API from the server
- writes generated demos and history to disk

GitHub Pages can only host the static shell. It cannot run the live build flow.

## Recommended setup

Use a Render web service with a persistent disk.

The repo includes [render.yaml](/Users/sarahforrest/whiteboard-to-prototype/render.yaml), which configures:

- a Node web service
- `npm install` and `npm start`
- a `/health` health check
- a persistent disk mounted at `/var/data/whiteboard-to-prototype`
- `DATA_ROOT=/var/data/whiteboard-to-prototype` so uploads, output files, and history survive restarts

## Deploy steps

1. Push this repo to GitHub.
2. In Render, choose `New +` -> `Blueprint`.
3. Select this GitHub repository.
4. Review the generated `whiteboard-to-prototype` service.
5. Set `ANTHROPIC_API_KEY` in the Render dashboard when prompted.
6. Create the service and wait for the first deploy.
7. Open the deployed URL and verify `/health` returns JSON.

## Environment variables

Required:

- `ANTHROPIC_API_KEY`

Configured by `render.yaml`:

- `ANTHROPIC_MODEL=claude-sonnet-4-5`
- `DATA_ROOT=/var/data/whiteboard-to-prototype`
- `NODE_ENV=production`

## What persists

Because the app uses `DATA_ROOT`, these directories will live on the Render disk instead of disappearing on restart:

- `uploads/`
- `__output__/`
- `history/`

## Point people to the new URL

After Render gives you a live URL, use that as the real app link.

If you still want to keep `https://sarahfor.github.io/whiteboard-to-prototype/`, turn that Pages site into a simple redirect page that forwards users to the Render URL.

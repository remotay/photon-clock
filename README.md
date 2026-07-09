# Photon Clock

An interactive visualization of special-relativistic time dilation using two photon clocks. One clock stays in the laboratory frame while the other moves horizontally, forcing its photon to follow a longer diagonal path.

The experiment includes:

- live, diverging tick counters
- an adjustable velocity gauge from `0` to `0.95c`
- a continuously updated Lorentz factor (`γ`)
- pause, resume, and reset controls
- responsive canvas animation

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Render

This repository includes a Render Blueprint. In Render, choose **New → Blueprint**, connect this repository, and approve the detected `photon-clock` web service.

For a manual Render web service, use:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Node version: `22.14.0`

The production server automatically reads Render's `PORT` environment variable.

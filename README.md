# Visual Atlas

A growing collection of interactive explainers for physics, computing, and other invisible systems. A responsive navigation shell makes each experiment independently accessible while keeping the collection easy to extend.

## Current visualizations

- **Time dilation:** paired photon clocks, a tracking camera, live tick drift, adjustable velocity, and a Lorentz-factor curve.
- **Memory speed:** an illustrative slowest-to-fastest race across HDD, SSD, DDR5, and L3/L2/L1 cache. The displayed multipliers drive the motion literally: a visible 0.8-second L1 trip makes the matching HDD trip take 92.6 days.

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

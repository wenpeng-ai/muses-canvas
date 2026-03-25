# Muses Canvas

<p align="center">
  English |
  <a href="./README.zh-CN.md">简体中文</a> |
  <a href="./README.zh-TW.md">繁體中文</a> |
  <a href="./README.ja.md">日本語</a> |
  <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <img src="./public/logo.svg" alt="Muses Canvas logo" width="160" />
</p>

<p align="center">
  <strong>A standalone AI creation workspace for generating images and videos on an infinite canvas.</strong>
</p>

<p align="center">
  <video src="./public/demo.mp4" controls width="960"></video>
</p>

## Overview

Muses Canvas is a standalone AI creation workspace built around an infinite canvas. It gives you one visual surface for text, image, and video generation, so prompts, references, outputs, and iteration all stay connected in the same place.

This project is designed to be local-first and self-contained. It runs without login, does not require a hosted backend for the core canvas flow, and stores project data plus media files locally on disk.

## Highlights

- Infinite canvas workflow for AI-assisted image and video creation
- Text, image, and video nodes in one connected workspace
- Local-first storage with no login requirement for the core experience
- Asset import, prompt chaining, and reference management inside the same graph
- Open-source structure that is easier to understand, modify, and extend

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
npm start
```

## Validate

```bash
npm run lint
npx tsc --noEmit
```

## Local Storage

- Canvas graph data: `data/projects/*.json`
- Imported and generated media: `data/media/*`
- Asset library index: `data/library.json`

## Project Structure

- `app/`: Next.js App Router pages and API routes
- `components/canvas/`: canvas-specific UI
- `components/canvas/workspace/`: flow surface, node rendering, toolbars, and workspace chrome
- `lib/canvas/`: shared canvas APIs and workspace domain logic
- `lib/provider/`: provider settings and browser-facing provider helpers
- `lib/server/`: local persistence, provider execution, and media storage
- `store/`: lightweight Zustand stores

## Runtime Flow

1. The page layer renders the workspace and delegates mutations to shared client APIs.
2. API routes stay thin and pass work to shared server modules.
3. Server-side services read and write local JSON and media files under `data/`.
4. Provider responses are normalized before the graph updates in the UI.

## Notes

- This repository focuses on the standalone canvas experience.
- Project data and media are stored locally instead of depending on a hosted backend.
- The codebase is organized so future contributors can customize or replace pieces without rewriting the whole app.

#!/usr/bin/env bash
set -euo pipefail

# Production Vercel build script for Qual a boa?
# Executed from app/ (see app/vercel.json).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${APP_DIR}"

echo "[vercel-build] 1/4 Verifying catalog & deterministic media assets..."
node -e "
const fs = require('node:fs');
const feed = JSON.parse(fs.readFileSync('public/feed/v1/events.json', 'utf8'));
if (!Array.isArray(feed.venues) || feed.venues.length < 200) {
  throw new Error('Catalog gate failed: expected >= 200 venues in public/feed/v1/events.json, got ' + (feed.venues ? feed.venues.length : 0));
}
if (!fs.existsSync('public/covers/generic.svg')) {
  throw new Error('Missing deterministic fallback cover asset public/covers/generic.svg');
}
if (!fs.existsSync('public/maplibre-gl-worker.mjs')) {
  throw new Error('Missing MapLibre worker public/maplibre-gl-worker.mjs');
}
console.log('[vercel-build] Catalog verified:', feed.venues.length, 'venues,', feed.events.length, 'events');
"

echo "[vercel-build] 2/4 Running TypeScript typecheck..."
npm run typecheck

echo "[vercel-build] 3/4 Exporting Expo web bundle..."
npx expo export --platform web

echo "[vercel-build] 4/4 Verifying dist/ static assets (feed, covers, MapLibre worker)..."
mkdir -p dist/feed/v1 dist/covers
cp -R public/feed/v1/. dist/feed/v1/
cp -R public/covers/. dist/covers/
cp public/maplibre-gl-worker.mjs dist/maplibre-gl-worker.mjs

echo "[vercel-build] Build complete -> ${APP_DIR}/dist"

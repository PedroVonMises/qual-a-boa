/* eslint-disable @typescript-eslint/no-require-imports */
// The self-hosted worker (public/maplibre-gl-worker.mjs) must match the installed maplibre-gl version.
// After upgrading maplibre-gl: cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs public/
describe('maplibre-gl worker', () => {
  it('matches the installed maplibre-gl version', () => {
    const fs = require('fs') as { readFileSync: (p: string, enc: string) => string };
    const root = process.cwd(); // jest runs from app/
    const version = JSON.parse(fs.readFileSync(`${root}/node_modules/maplibre-gl/package.json`, 'utf8')).version as string;
    const head = fs.readFileSync(`${root}/public/maplibre-gl-worker.mjs`, 'utf8').slice(0, 400);
    expect(head).toContain(`/v${version}/`);
  });
});

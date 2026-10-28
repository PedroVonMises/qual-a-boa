/** @jest-environment node */
import React from 'react';

import { useFeedStatus } from './feedStatus';

// No @types/react-dom in this project; only this test needs the server renderer.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToString } = require('react-dom/server') as { renderToString: (el: React.ReactElement) => string };

function Probe() {
  const { enabled, source } = useFeedStatus();
  return React.createElement('span', null, `${enabled}:${source}`);
}

describe('useFeedStatus', () => {
  // The static web export server-renders every route; useSyncExternalStore throws there without a server snapshot.
  it('renders on the server without a feed', () => {
    expect(renderToString(React.createElement(Probe))).toContain('false:seed');
  });
});

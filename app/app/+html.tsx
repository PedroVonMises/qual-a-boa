import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Keyboard focus ring for every interactive element (PressableScale, Chip, Switch, IconButton, TabBar, inputs).
const FOCUS_CSS =
  'body{background-color:#121110;}' +
  ':focus-visible{outline:2px solid #FF4F81 !important;outline-offset:2px !important;}' +
  '@media (prefers-color-scheme: light){:focus-visible{outline-color:#D01B58 !important;}}';

// Web-only root HTML for static rendering. Runs in Node: no DOM or browser APIs here.
// SDK 58+: must render headNodes (styles, metadata) and bodyNodes (fonts, JS bundles) or the app never hydrates.
export default function Root({ children }: PropsWithChildren) {
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } = useServerDocumentContext();

  return (
    <html lang="pt-BR" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#121110" />
        <title>Qual a boa?</title>
        <ScrollViewStyleReset />
        {/* Raw CSS so the background never flashes light before JS loads. */}
        <style dangerouslySetInnerHTML={{ __html: FOCUS_CSS }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}

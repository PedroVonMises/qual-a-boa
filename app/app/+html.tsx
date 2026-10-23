import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

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
        <style dangerouslySetInnerHTML={{ __html: 'body{background-color:#121110;}' }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}

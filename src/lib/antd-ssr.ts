/**
 * Per-island antd SSR helper.
 *
 * Renders a React tree to string + extracts antd's cssinjs styles
 * so hydration doesn't FOUC. Each Astro file that mounts an antd
 * island with client:load wraps the tree with renderAntdIsland()
 * and emits the returned <style> tag inline next to the mount
 * point.
 *
 * We use per-island extraction (not Layout-wide) so each page only
 * ships the styles its mounted islands actually use. Per Scout's
 * blast-radius call: Layout-wide extraction would regress pages
 * that have no antd island (tools.astro, future static pages).
 */

import { renderToString } from 'react-dom/server';
import { createCache, extractStyle, StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider } from 'antd';
import { createElement, type ReactNode } from 'react';
import { cartoonTheme } from './theme';

export interface AntdIslandResult {
  readonly html: string;
  readonly styles: string;
}

export function renderAntdIsland(tree: ReactNode): AntdIslandResult {
  const cache = createCache();
  const html = renderToString(
    createElement(
      StyleProvider,
      { cache, hashPriority: 'high' },
      createElement(ConfigProvider, { theme: cartoonTheme }, tree),
    ),
  );
  return { html, styles: extractStyle(cache) };
}

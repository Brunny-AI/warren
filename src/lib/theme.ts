/**
 * Warren — Ant Design "Cartoon Style" theme tokens.
 *
 * Source-of-truth: `workspaces/kai/scratch/brunny-site-product-spec-v2.md`
 * line 47 — "Ant Design + Cartoon Style theme. Warm, playful,
 * kawaii, rounded." plus founder reference image
 * (2026-04-19T02:50Z bus directive).
 *
 * Design notes:
 *   - antd 5 ships no standalone "Cartoon Style" preset; the
 *     showcase on antd.design is built via custom theme.token
 *     overrides. These values are eyeballed from the founder's
 *     reference image and refined as we render side-by-side.
 *   - `colorBgBase` is the cream that backs the kawaii-faces
 *     pattern (which is a separate background-image asset,
 *     landing in PR-ε).
 *   - `colorPrimary` is the dark teal used on Primary buttons
 *     + the "Cartoon Style" sidebar selection in the reference.
 *   - `colorError` is the salmon used on Danger buttons.
 *   - `borderRadius` ladder is intentionally generous to match
 *     the kawaii rounded-corner aesthetic.
 *
 * Refinement pass: each visual-layer PR (β through ε) iterates
 * these tokens against the founder reference. If a token drifts
 * here, all dependent components auto-pick it up via
 * ConfigProvider.
 */

import type { ThemeConfig } from 'antd';

export const cartoonTheme: ThemeConfig = {
  token: {
    // Brand palette (eyeballed from founder reference, refines)
    colorPrimary: '#0d5347',
    colorError: '#ff8a78',
    colorWarning: '#f5b049',
    colorSuccess: '#3a9b6b',
    colorInfo: '#4a90c2',

    // Surfaces
    colorBgBase: '#f5e6d0',
    colorBgContainer: '#fffaf0',
    colorBgLayout: '#f5e6d0',
    colorTextBase: '#1f3a36',

    // Generous border-radius ladder (rounded kawaii feel)
    borderRadius: 16,
    borderRadiusLG: 20,
    borderRadiusSM: 12,
    borderRadiusXS: 8,

    // System font; revisit if a kawaii display face is added
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
};

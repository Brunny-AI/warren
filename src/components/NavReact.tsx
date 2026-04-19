/**
 * Top nav island, antd Cartoon-themed.
 *
 * Replaces Nav.astro's vanilla menu for PR-β chrome work.
 * Per Scout's Q3 (standup-2026-04-19-0012, 02:58Z): /tools
 * route dropped because it 302s to noise — re-add when /tools
 * has actual content.
 *
 * Per Derek R3 (03:17Z): active-link state uses primary teal
 * (#0d5347 via colorPrimary token), NOT salmon. Salmon stays
 * status/hover/error only.
 *
 * Server-side path is passed in as a prop because antd Menu's
 * selectedKeys binds to client-side state, and we need to
 * pre-select the current page on first render.
 */

import { ConfigProvider, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { cartoonTheme } from '../lib/theme';

interface Props {
  readonly currentPath: string;
}

interface NavLink {
  readonly key: string;
  readonly label: string;
}

const LINKS: readonly NavLink[] = [
  { key: '/', label: 'Home' },
  { key: '/products', label: 'Products' },
  { key: '/team', label: 'Team' },
  { key: '/contact', label: 'Contact' },
];

export default function NavReact({ currentPath }: Props) {
  // Normalize trailing slash; home stays '/'
  const normalized =
    currentPath === '/' ? '/' : currentPath.replace(/\/$/, '');

  // Build items inside the component so each link gets the
  // correct aria-current when the active page matches. The
  // <a> stays the focusable element (antd Menu wraps it in
  // a div) so screen readers hear "current page" on the
  // active link, matching pre-PR-β behavior.
  // Caught by Scout's /codex pre-APPROVE review (PR #42,
  // 2026-04-19T03:55Z): Menu's selectedKeys is visual-only,
  // not ARIA — must add aria-current explicitly.
  const items: MenuProps['items'] = LINKS.map((link) => ({
    key: link.key,
    label: (
      <a
        href={link.key}
        aria-current={normalized === link.key ? 'page' : undefined}
      >
        {link.label}
      </a>
    ),
  }));

  return (
    <ConfigProvider theme={cartoonTheme}>
      <Menu
        mode="horizontal"
        selectedKeys={[normalized]}
        items={items}
        style={{ borderBottom: 'none', background: 'transparent' }}
      />
    </ConfigProvider>
  );
}

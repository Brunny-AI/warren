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

const ITEMS: MenuProps['items'] = [
  { key: '/', label: <a href="/">Home</a> },
  { key: '/products', label: <a href="/products">Products</a> },
  { key: '/team', label: <a href="/team">Team</a> },
  { key: '/contact', label: <a href="/contact">Contact</a> },
];

export default function NavReact({ currentPath }: Props) {
  // Normalize trailing slash; home stays '/'
  const normalized =
    currentPath === '/' ? '/' : currentPath.replace(/\/$/, '');

  return (
    <ConfigProvider theme={cartoonTheme}>
      <Menu
        mode="horizontal"
        selectedKeys={[normalized]}
        items={ITEMS}
        style={{ borderBottom: 'none', background: 'transparent' }}
      />
    </ConfigProvider>
  );
}

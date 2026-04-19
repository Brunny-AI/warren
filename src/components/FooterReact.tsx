/**
 * Site footer island, antd Cartoon-themed.
 *
 * PR-β scope: minimal copyright line. Real copy from Derek's
 * landing-copy-v1.md lands in PR-δ alongside page restyle
 * (per Scout's clarification, 03:36Z).
 */

import { ConfigProvider, Layout, Typography } from 'antd';
import { cartoonTheme } from '../lib/theme';

const { Footer: AntdFooter } = Layout;
const { Text } = Typography;

export default function FooterReact() {
  const year = new Date().getFullYear();
  return (
    <ConfigProvider theme={cartoonTheme}>
      <AntdFooter
        style={{ textAlign: 'center', background: 'transparent' }}
      >
        <Text type="secondary">
          © {year} Brunny AI LLC. All rights reserved.
        </Text>
      </AntdFooter>
    </ConfigProvider>
  );
}

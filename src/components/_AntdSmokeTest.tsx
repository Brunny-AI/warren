/**
 * Smoke-test island for the antd + Cartoon-theme foundation.
 *
 * Renders one of each: Primary button, Default button, Dashed
 * button, Danger button, and Input. Lets us eyeball that:
 *   - antd is loading + bundling correctly
 *   - ConfigProvider is propagating the cartoonTheme tokens
 *   - Border-radius, color-primary, color-error all look right
 *
 * NOT shipped to production. The page that mounts this island
 * is `src/pages/_antd-smoke.astro` — prefixed `_` so it doesn't
 * accidentally route in production builds (Astro skips `_`
 * files). When PR-β starts replacing real components, this
 * file + the smoke page get deleted in the same commit.
 *
 * Underscore-prefix convention: documented at
 * https://docs.astro.build/en/core-concepts/routing/#excluding-pages
 */

import { Button, ConfigProvider, Input, Space } from 'antd';
import { cartoonTheme } from '../lib/theme';

export default function AntdSmokeTest() {
  return (
    <ConfigProvider theme={cartoonTheme}>
      <Space direction="vertical" size="large">
        <Space wrap>
          <Button type="primary">Primary</Button>
          <Button>Default</Button>
          <Button type="dashed">Dashed</Button>
          <Button danger>Danger</Button>
        </Space>
        <Input placeholder="Smoke-test input" style={{ width: 300 }} />
      </Space>
    </ConfigProvider>
  );
}

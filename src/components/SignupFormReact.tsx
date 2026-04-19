/**
 * SignupForm React island — antd Cartoon themed.
 *
 * Replaces the vanilla SignupForm.astro JS overlay with antd
 * Form. The host Astro file mounts this island via
 * `client:load` (NOT client:only) so the SSR HTML still
 * contains a native <form action method=post> for no-JS users.
 *
 * Per Scout 03:17Z: per-island ConfigProvider + StyleProvider
 * (not Layout-wide). StyleProvider needs the cssinjs cache from
 * the SSR pass — host Astro file uses renderAntdIsland() helper
 * (src/lib/antd-ssr.ts) and emits the extracted style tag inline.
 *
 * Props mirror the existing SignupForm.astro contract so the
 * host page (products.astro / contact.astro) doesn't need to
 * change query-param handling.
 */

import { Form, Input, Button, ConfigProvider } from 'antd';
import { useState } from 'react';
import { cartoonTheme } from '../lib/theme';

export interface SignupFormProps {
  readonly id?: string;
  readonly source?: string;
  readonly submitLabel?: string;
  readonly initialStatus?: { text: string; kind: 'ok' | 'err' } | null;
}

interface SignupValues {
  email: string;
}

export default function SignupFormReact({
  id = 'signup',
  source = 'products',
  submitLabel = 'notify me',
  initialStatus = null,
}: SignupFormProps) {
  const [status, setStatus] = useState(initialStatus);
  const [submitting, setSubmitting] = useState(false);

  async function handleFinish(values: SignupValues) {
    setSubmitting(true);
    setStatus({ text: 'sending…', kind: 'ok' });
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: values.email, source }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (res.ok) {
        setStatus({
          text:
            data.message ?? "check your email to confirm — we sent a link.",
          kind: 'ok',
        });
      } else {
        setStatus({
          text: data.message ?? 'signup failed. try again in a moment?',
          kind: 'err',
        });
      }
    } catch {
      setStatus({
        text: 'network error. try again in a moment?',
        kind: 'err',
      });
    } finally {
      setSubmitting(false);
    }
  }

  // action + method on the underlying <form> are present so no-JS
  // visitors get a working native POST. With client:load (NOT
  // client:only) the SSR HTML carries these attributes; on
  // hydration, our onFinish handler intercepts via preventDefault.
  return (
    <ConfigProvider theme={cartoonTheme}>
      <Form<SignupValues>
        id={`${id}-form`}
        layout="inline"
        onFinish={handleFinish}
        autoComplete="on"
        action="/api/signup"
        method="post"
      >
        <input type="hidden" name="source" value={source} />
        <Form.Item
          name="email"
          rules={[
            { required: true, message: 'email required.' },
            { type: 'email', message: 'invalid email format.' },
          ]}
        >
          <Input
            id={`${id}-email`}
            type="email"
            name="email"
            placeholder="you@example.com"
            autoComplete="email"
            aria-label="email"
          />
        </Form.Item>
        <Form.Item>
          <Button
            id={`${id}-submit`}
            type="primary"
            htmlType="submit"
            loading={submitting}
          >
            {submitLabel}
          </Button>
        </Form.Item>
        {status && (
          <p
            id={`${id}-status`}
            className={`signup-status signup-status--${status.kind}`}
            role="status"
            aria-live="polite"
          >
            {status.text}
          </p>
        )}
      </Form>
    </ConfigProvider>
  );
}

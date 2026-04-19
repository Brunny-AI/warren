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
  readonly emailPlaceholder?: string;
  readonly successText?: string;
}

interface SignupValues {
  email: string;
}

export default function SignupFormReact({
  id = 'signup',
  source = 'products',
  submitLabel = 'notify me',
  initialStatus = null,
  emailPlaceholder = 'you@example.com',
  successText = "check your email to confirm — we sent a link.",
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
      // /api/signup returns { error: '...' } on failure (4xx/5xx)
      // and { ok: true, ... } on success — see src/pages/api/signup.ts.
      // Read both fields to surface backend-provided messaging when
      // present; fall back to generic copy otherwise.
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (res.ok) {
        setStatus({
          text: data.message ?? successText,
          kind: 'ok',
        });
      } else {
        setStatus({
          text: data.error ?? 'signup failed. try again in a moment?',
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
  //
  // noValidate suppresses the browser's HTML5 email-pattern check
  // on the input[type=email]. Without it, the browser intercepts
  // submit on a malformed email value BEFORE antd Form sees the
  // submit event, blocks it natively, and antd's validation never
  // fires — so our inline error message ("invalid email format.")
  // never renders. Observed in R2 dogfood walkthrough.spec P1-2.
  // The no-JS fallback still POSTs via native form submit, which
  // the server-side /api/signup handler validates independently.
  return (
    <ConfigProvider theme={cartoonTheme}>
      <Form<SignupValues>
        id={`${id}-form`}
        layout="inline"
        onFinish={handleFinish}
        autoComplete="on"
        action="/api/signup"
        method="post"
        noValidate
      >
        {/* Visually-hidden <label for> preserves the explicit
            label-for-input semantic. aria-label on Input alone
            loses the screen-reader-native label association.
            Per pre-pr-peer-review.md a11y-parity rule. Inline
            sr-only styles since no global utility class exists
            in this repo (the vanilla SignupForm.astro referenced
            a .visually-hidden class that wasn't defined — latent
            a11y gap; not propagating). */}
        <label
          htmlFor={`${id}-email`}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          email
        </label>
        <input type="hidden" name="source" value={source} />
        <Form.Item
          name="email"
          validateTrigger={['onBlur', 'onChange']}
          rules={[
            { required: true, message: 'email required.' },
            // Use explicit regex pattern rather than antd's
            // `{ type: 'email' }`. type:email dispatches to
            // async-validator's built-in email check which (in
            // antd 6 with our build) races with Playwright's
            // rapid fill-then-click sequence — the validator
            // fires AFTER submit attempts, so the error text
            // doesn't render inside the 3s test window. Regex
            // pattern validates synchronously on blur/change,
            // closing R2 dogfood P1-2.
            {
              pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'invalid email format.',
            },
          ]}
        >
          <Input
            id={`${id}-email`}
            type="email"
            name="email"
            placeholder={emailPlaceholder}
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

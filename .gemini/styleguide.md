# warren Style Guide

This style guide governs all code in the warren repository.
Gemini Code Assist must enforce these rules during pull request
reviews. Contributors (human and AI) must follow them when
writing code.

Based on:
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html)
- [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html)

---

## TypeScript

### Formatting
- **2 spaces** per indentation level. Never tabs.
- **Maximum 80 characters** per line for code; up to 100 acceptable
  for HTML/JSX inside `.astro` files where forced wraps hurt
  readability.
- Trailing comma in multi-line lists, objects, function arguments.
- Single quotes for string literals; backticks for templates.
- Semicolons at end of every statement (Prettier default).

### Imports
- Import order: stdlib (none in TS), third-party, then local.
- Sort imports lexicographically within each group.
- Use named imports when importing 3 or fewer symbols; namespace
  imports otherwise (`import * as foo from 'bar'`).
- Never use default exports for new code; prefer named exports
  (defaults degrade tree-shaking and make grep harder).
- No relative parent-traversal beyond two levels (`../../foo` is
  the absolute limit; deeper means restructure).

### Naming
- `camelCase` for variables, parameters, properties, functions,
  methods.
- `PascalCase` for types, interfaces, classes, enums, type
  parameters.
- `SCREAMING_SNAKE_CASE` for module-level constants only.
- File names: `kebab-case.ts` for utilities, `PascalCase.tsx` for
  React-style components, `kebab-case.astro` for Astro components.
- Boolean variables/properties: prefix with `is`, `has`, `can`,
  `should`, etc. (e.g., `isLoading`, `hasError`).

### Type Annotations
- `strict: true` in tsconfig — non-negotiable. No opt-outs per
  file.
- Annotate all exported function signatures (parameters + return).
- Inferred types acceptable for local variables and private
  members where the type is obvious from initialization.
- Prefer `interface` over `type` for object shapes; `type` for
  unions, intersections, primitives.
- Never use `any` without an inline `// reason: ...` comment
  explaining why a more precise type isn't possible.
- Prefer `unknown` over `any` when the shape is genuinely
  uncertain at the boundary; narrow with type guards.
- Use `readonly` aggressively for properties that don't mutate.

### Astro components
- Single-file `.astro` components. Frontmatter (---) at top, then
  HTML, then `<style>` if scoped CSS is needed.
- Props typed via `interface Props` in the frontmatter.
- Server-only logic in frontmatter (runs on Worker); client logic
  in `<script>` blocks (opt-in via Astro directives like
  `client:only`, `client:visible`).
- No `process.env` access. Use `Astro.locals.runtime.env` for
  Cloudflare bindings.

### Functions
- Use arrow functions for callbacks/local helpers. Use `function`
  declarations for top-level named functions (better stack traces).
- Maximum 4 parameters; pack into an options object beyond that.
- Pure functions wherever possible. Side effects belong in
  explicit boundary modules (API routes, lifecycle hooks).

### Async / Promises
- Always `await` returned Promises or explicitly chain `.then()`.
  Never leave a Promise unhandled.
- Prefer `async/await` over `.then()` chains for readability.
- Errors from async code must be caught with try/catch or
  `.catch()`. Never swallow errors silently.

### Disallowed
- No `var`. Use `const` by default; `let` only when reassignment
  is necessary.
- No `==`/`!=`. Use `===`/`!==` exclusively.
- No `eval`, `new Function(...)`, `setTimeout(string, ...)`.
- No mutable default arguments (mirrors the Python guide;
  applies to default parameter object literals being shared).

---

## HTML / CSS (in `.astro` files)

### HTML
- Lowercase element names, attribute names.
- Double quotes for attribute values.
- Self-closing void elements: `<br />`, `<img />`, `<input />`.
- Use semantic elements (`<nav>`, `<main>`, `<article>`,
  `<aside>`) over `<div>` where applicable.
- Always include `alt` for `<img>`. Use `alt=""` for decorative
  images.
- Always include `lang` on `<html>`.

### CSS
- 2 spaces per indentation level.
- One declaration per line.
- Lowercase hex colors, shortest form (`#fff` over `#ffffff`).
- Single quotes for strings, no quotes for URL paths in `url()`.
- Use logical properties (`margin-block`, `padding-inline`) when
  the directionality matters and you might localize.
- Avoid `!important` — flag in PR review if used.
- Custom properties (CSS vars) for theme tokens; namespace with
  `--brunny-` prefix.

---

## Shell (Bash, in scripts/)

### Formatting
- **2 spaces** per indentation level. Never tabs (except in `<<-`
  here-documents).
- **Maximum 80 characters** per line.
- Place `; then` and `; do` on the same line as `if`/`for`/`while`.

### Language
- Bash is the only permitted shell scripting language for
  executables. `#!/usr/bin/env bash` shebang.
- Scripts exceeding 100 lines should be considered for rewrite
  in TypeScript (run via `tsx` or compiled).

### Naming
- `lowercase_with_underscores` for functions and variables.
- `UPPERCASE_WITH_UNDERSCORES` for constants and environment
  variables, declared at file top with `readonly`.
- Declare local variables with `local` to prevent global
  namespace pollution.

### Quoting
- Quote all variables and command substitutions: `"${var}"` over
  `"$var"`.
- Always use `"$@"` when passing arguments, never `$*`.

### Error Handling
- All error messages to STDERR (`>&2`).
- Always check return values; `set -euo pipefail` at top of every
  script.
- Use `PIPESTATUS` to check pipe segment exit codes when needed.

---

## General Rules (All Languages)

### Security
- Never hardcode secrets, API keys, or credentials. Use Cloudflare
  Workers Secrets or Astro env bindings.
- Validate all external input at system boundaries (API routes,
  form handlers, query string parsing).
- No injection vulnerabilities — use parameterized D1 queries,
  escape user input before HTML output, never construct shell
  commands from user input.
- No `dangerouslySetInnerHTML` or equivalent without an inline
  comment explaining the trust source.

### Code Review Focus Areas
When reviewing pull requests, prioritize in this order:
1. **Correctness** — Does the code do what it claims?
2. **Security** — Injection, credential, access control issues?
3. **Maintainability** — Readable, well-structured?
4. **Efficiency** — Unnecessary operations, render-blocking JS,
   bundle bloat?
5. **Accessibility** — Semantic HTML, keyboard nav, alt text,
   color contrast (this is a public website).
6. **Testing** — Edge cases covered? Tests added/updated?

### Cloudflare-specific
- No Node-only APIs (`fs`, `child_process`, `crypto` Node version,
  native modules). Use Web APIs (`fetch`, `crypto.subtle`,
  `Request`/`Response`).
- No `process.env`. Read bindings via `Astro.locals.runtime.env`
  or the platform's binding API.
- `wrangler dev` (not just `astro dev`) is the source of truth
  for "does it work in the Worker runtime?" — manual visual
  testing must hit the wrangler-dev port.

### Commit Messages
- Format: `[agent] verb: description`
- Verbs: add, fix, update, remove, refactor
- Include a `Now possible:` line describing what the change
  enables next.

### PR Requirements
- Every PR must be under 1000 lines changed.
- Every PR must include a summary and test plan in the body
  (template at `.github/pull_request_template.md`).
- Branch naming: `{agent}/{description}` (e.g.,
  `kai/scaffold-astro`, `scout/add-virtual-office`).
- Code Owner APPROVE required (the OTHER agent — GitHub blocks
  self-approval, so author's review never counts).

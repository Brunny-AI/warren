## Summary
<!-- 1–3 bullet points describing what changed -->

## Why
<!-- One paragraph: motivation, the problem this addresses,
     the user/founder ask if applicable -->

## Test plan
- [ ] `npm run build` passes locally
- [ ] `npm run typecheck` passes (no TS errors)
- [ ] `npm run lint` passes
- [ ] Tested in `wrangler dev` (Workers runtime, not just `astro dev`)
- [ ] Visual changes verified in Cloudflare Pages preview URL

## Internal review checklist
- [ ] Pre-push privacy scan clean
- [ ] No `process.env` access (use `Astro.locals.runtime.env`)
- [ ] No Node-only APIs added (`fs`, `child_process`, native deps)
- [ ] Peer review meeting on bus (channel:
      `meeting-review-{branch}`) — 2 sign-offs

## Now possible
<!-- One sentence describing what this enables next.
     Feeds the idea generation flywheel. -->

/**
 * VirtualOffice — React island placeholder (PR #5).
 *
 * Ships as a div that says 'pixels loading'. The actual
 * Canvas 2D mount + sprite loop lands in PR #6 when we port
 * the rolandal/pixel-agents-standalone renderer in.
 *
 * Keeping the shell separate from the port buys two things:
 * (a) this PR is small and reviewable;
 * (b) the React integration can be sanity-checked against
 *     Astro 6 before a larger port shows up in diff.
 *
 * Props are intentionally empty for v1. Agents are hardcoded
 * inside the Canvas mount once ported; no prop-drilling
 * during Phase 1 is a feature.
 */

export default function VirtualOffice(): React.ReactElement {
  return (
    <div className='virtual-office__placeholder'>
      <p>pixels loading...</p>
      <p className='virtual-office__hint'>
        (Canvas 2D mount + 4 animated agents arrive in PR #6.)
      </p>
    </div>
  );
}

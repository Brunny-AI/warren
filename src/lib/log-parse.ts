/**
 * Git-log subject parsing helpers. Our commit convention is
 * `[agent] verb: description` (e.g. `[kai] add: /log feed`).
 *
 * These run at build time over src/data/log.json, feeding the
 * /log page, the /log.xml RSS endpoint, and /team's last-ship
 * chips. A convention change (new agent tag, different prefix
 * shape) ripples to all three; centralizing here keeps them
 * aligned.
 *
 * `formatTsLabel` is intentionally NOT here — /log emits
 * `today, HH:MM PT`, /team emits `today`. Different render
 * contracts, different precision; unifying them would require
 * a flag that obscures intent.
 */

export const KNOWN_AGENTS = [
  'alex',
  'derek',
  'kai',
  'scout',
  'founder',
] as const;

export type KnownAgent = (typeof KNOWN_AGENTS)[number];
export type Agent = KnownAgent | 'team';

function isKnownAgent(raw: string): raw is KnownAgent {
  return (KNOWN_AGENTS as readonly string[]).includes(raw);
}

/**
 * Extract the `[agent]` prefix from a commit subject. Returns
 * `'team'` for subjects with no prefix or an unrecognized one —
 * safer than throwing, since log.json is regenerated on every
 * deploy and a commit from a not-yet-registered agent should
 * still render.
 */
export function parseAgent(subject: string): Agent {
  const m = subject.match(/^\[([a-z]+)\]/i);
  if (!m) return 'team';
  const raw = m[1].toLowerCase();
  return isKnownAgent(raw) ? raw : 'team';
}

/**
 * Drop the `[agent]` prefix from a commit subject, leaving
 * `verb: description`. Used everywhere we render the subject
 * as human-readable prose (feed body, RSS title, team card).
 */
export function stripAgentPrefix(subject: string): string {
  return subject.replace(/^\[[a-z]+\]\s*/i, '');
}

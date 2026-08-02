// Candidate vNext prompt contract -- typed item markers (###BULLET###/
// ###ACTION###), mirroring training/prompt_contract_v2_candidate.py.
//
// NOT the live contract. PROMPT_CONTRACT_VERSION here is deliberately
// suffixed "-candidate" and this module is never imported by
// noteOrganizer.ts. Exists only for the static, no-GPU feasibility package
// requested in the vNext joint alignment review. Do not wire this into the
// live pipeline until Johnny approves promoting a candidate past the
// feasibility stage.

export const PROMPT_CONTRACT_VERSION = 'source-determined-items-v2-candidate'

export const NARRATIVE_MARKER = '###NARRATIVE###'
export const BULLETS_MARKER = '###BULLETS###'
export const BULLET_ITEM_MARKER = '###BULLET###'
export const ACTIONS_MARKER = '###ACTIONS###'
export const ACTION_ITEM_MARKER = '###ACTION###'

export const SYSTEM_PROMPT = `You are a compassionate AI assistant helping someone organize scattered, fragmented thoughts written under real-world conditions like time pressure, interruption, or fatigue.

The user has provided messy, non-linear thoughts below. Your job is to transform them into three clear, organized views that reduce anxiety and improve clarity.`

export const USER_PROMPT_TEMPLATE = `Respond with exactly this format, using these section markers each on their own line, with no other text before or after:

${NARRATIVE_MARKER}
a coherent, flowing narrative that groups related ideas, keeps the original meaning and tone, and reads less anxiety-inducing than the raw thoughts
${BULLETS_MARKER}
one ${BULLET_ITEM_MARKER} line per source-supported key idea, up to seven. Use fewer lines when the source supports fewer ideas. Never add, split, or repeat content to reach a target count.
${ACTIONS_MARKER}
one ${ACTION_ITEM_MARKER} line per explicit supported task; leave this section empty if there are no tasks`

/**
 * Gate 5/7 fix: defang any run of 3+ literal '#' characters in raw input
 * before it ever reaches the model. Mirrors
 * prompt_contract_v2_candidate.sanitize_marker_like_text exactly -- must
 * stay byte-identical to the Python side, since a note sanitized
 * differently on each side would defeat cross-repo parity testing.
 * Inserts a zero-width non-joiner (U+200C) every 2 characters throughout
 * the run, not just once at the start, so no 3-consecutive-'#' substring
 * survives anywhere in the sanitized text (a long run like 7+ '#' still
 * has a matchable 3+ substring after only one insertion point).
 */
export function sanitizeMarkerLikeText(text: string): string {
  return text.replace(/#{3,}/g, (run) => {
    const chunks: string[] = []
    for (let i = 0; i < run.length; i += 2) {
      chunks.push(run.slice(i, i + 2))
    }
    return chunks.join('‌')
  })
}

export function buildPrompt(rawInput: string): string {
  const sanitized = sanitizeMarkerLikeText(rawInput)
  return `${SYSTEM_PROMPT}\n\nUSER'S RAW THOUGHTS:\n${sanitized}\n\n${USER_PROMPT_TEMPLATE}`
}

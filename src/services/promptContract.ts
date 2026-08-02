// Single source of truth for the prompt shape the fine-tuned model expects.
// Mirrors intent-recovery-model's training/prepare_data.py SYSTEM_PROMPT /
// USER_PROMPT_TEMPLATE / build_prompt exactly -- the model is fine-tuned to
// expect this exact prompt shape at inference time, so a mismatch here is a
// quality risk, not a documentation nit.
//
// PROMPT_CONTRACT_VERSION must be identical on both sides. Any change to
// SYSTEM_PROMPT/USER_PROMPT_TEMPLATE must land in the same coordinated
// change as the matching training-side edit and a version bump -- see
// scripts/verify-prompt-contract.mjs, which pins a fixed fixture's
// SHA-256 to catch drift.
export const PROMPT_CONTRACT_VERSION = 'source-determined-bullets-v1'

export const NARRATIVE_MARKER = '###NARRATIVE###'
export const BULLETS_MARKER = '###BULLETS###'
export const ACTIONS_MARKER = '###ACTIONS###'

export const SYSTEM_PROMPT = `You are a compassionate AI assistant helping someone organize scattered, fragmented thoughts written under real-world conditions like time pressure, interruption, or fatigue.

The user has provided messy, non-linear thoughts below. Your job is to transform them into three clear, organized views that reduce anxiety and improve clarity.`

// Plain delimited text, not JSON: testing showed FLAN-T5-base reliably gets
// the *content* right after fine-tuning, but a small model frequently loses
// track of bracket/quote nesting on a JSON array (fails ~50% of the time
// even on memorized training examples). Marker lines degrade gracefully —
// a mistake in one section doesn't invalidate the whole response the way an
// unbalanced bracket does.
export const USER_PROMPT_TEMPLATE = `Respond with exactly this format, using these three section markers each on their own line, with no other text before or after:

${NARRATIVE_MARKER}
a coherent, flowing narrative that groups related ideas, keeps the original meaning and tone, and reads less anxiety-inducing than the raw thoughts
${BULLETS_MARKER}
One source-supported key idea per line, up to 7 lines. Use fewer lines when the source supports fewer ideas. Never add, split, or repeat content to reach a target count.
${ACTIONS_MARKER}
one task per line; leave this section empty if there are no tasks`

export function buildPrompt(rawInput: string): string {
  return `${SYSTEM_PROMPT}\n\nUSER'S RAW THOUGHTS:\n${rawInput}\n\n${USER_PROMPT_TEMPLATE}`
}

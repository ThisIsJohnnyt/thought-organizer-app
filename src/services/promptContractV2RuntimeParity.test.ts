// Static feasibility items 2 and 7 (real browser-runtime parity, cross-repo
// prompt fingerprint parity) for the vNext prompt-contract candidate.
// Mirrors training/test_prompt_contract_v2_fingerprint_parity.py plus the
// tokenizer-round-trip tests in training/test_prompt_contract_v2_candidate.py.
//
// Finding 6 fix (prompt_contract_vnext_static_package_chatgpt_review.md):
// earlier verification of this parity used a throwaway `_test_v2_fingerprint.ts`
// script that was deleted after one manual run -- not a permanent, repeatable,
// committed test. This file replaces that one-time claim with a committed
// test that actually loads the real production tokenizer (the same deployed
// files @xenova/transformers reads in the browser, not a mock) every time
// it runs.
//
// Kept out of promptContractV2Parser.test.ts because it's meaningfully
// heavier (loads real tokenizer files from public/models/), matching that
// file's own no-framework convention. Run with (from the app repo root):
//   node_modules/.bin/esbuild src/services/promptContractV2RuntimeParity.test.ts --bundle --platform=node --format=esm --external:@xenova/transformers --outfile=.v2-runtime-parity-bundle.mjs && node .v2-runtime-parity-bundle.mjs
// Bundle as ESM with @xenova/transformers left external, not CJS: bundling
// that package itself (its pre-bundled internals reference import.meta.url
// and onnxruntime-node's platform-specific .node binaries in ways esbuild's
// CJS transform can't resolve -- confirmed directly, both --format=cjs and
// a fully-bundled --format=esm throw before a single check runs). Leaving
// it external and letting Node's own loader resolve the real installed
// package avoids both failure modes and exercises the actual dependency,
// not a bundled reimplementation of it. The outfile must land inside the
// repo (not a system temp dir) so Node's module resolution can walk up to
// this repo's own node_modules to satisfy that external import at runtime.

import * as crypto from 'crypto'
import * as path from 'path'
import { AutoTokenizer, env } from '@xenova/transformers'
import {
  PROMPT_CONTRACT_VERSION,
  NARRATIVE_MARKER,
  BULLETS_MARKER,
  BULLET_ITEM_MARKER,
  ACTIONS_MARKER,
  ACTION_ITEM_MARKER,
  buildPrompt,
  sanitizeMarkerLikeText,
} from './promptContractV2Candidate'
import { parseOutput } from './promptContractV2Parser'

const FAILURES: string[] = []

function check(name: string, condition: boolean, detail = ''): void {
  const status = condition ? 'PASS' : 'FAIL'
  console.log(`[${status}] ${name}` + (detail && !condition ? ` -- ${detail}` : ''))
  if (!condition) FAILURES.push(name)
}

// process.cwd()-relative, not the browser-facing '/models/' URL path
// modelLoader.ts uses -- that path is meant to be resolved by the bundler's
// dev-server/static-file layer, not Node's filesystem. This test runs under
// plain Node, so it needs a real filesystem path to the same deployed
// tokenizer files, matching this repo's established cwd-relative convention
// (see promptContractV2Parser.test.ts's FIXTURES_PATH comment).
env.allowLocalModels = true
env.allowRemoteModels = false
env.localModelPath = path.resolve(process.cwd(), 'public', 'models') + path.sep
const MODEL_NAME = 'thoughtorganizer-flan-t5'

const PROMPT_CONTRACT_FIXTURE = 'Prompt contract fixture: review the blue folder tomorrow?'
const MARKER_BEARING_FIXTURE =
  'Note that already has ###BULLET### pasted in it, plus a run of ##### hashes: review by Friday?'

// Must stay in lockstep with training/test_prompt_contract_v2_fingerprint_parity.py's
// EXPECTED_VERSION/EXPECTED_FINGERPRINT/EXPECTED_MARKER_BEARING_FINGERPRINT.
const EXPECTED_VERSION = 'source-determined-items-v2-candidate'
const EXPECTED_FINGERPRINT = 'e691fd12ee51b322b93311cf483d2fbb4bb921ac8a1319e07420fae098ea0cb9'
const EXPECTED_MARKER_BEARING_FINGERPRINT = 'e3aeac7b8331953631d65bf292c91ec70a75c21e6b6d3bdb06e156dcca3822a5'

const MARKER_COLLISION_MARKERS = [NARRATIVE_MARKER, BULLETS_MARKER, BULLET_ITEM_MARKER, ACTIONS_MARKER, ACTION_ITEM_MARKER]
const MARKER_COLLISION_HASH_RUN_LENGTHS = [3, 4, 5, 7, 22]
const MARKER_COLLISION_RAW = [
  ...MARKER_COLLISION_MARKERS.map((m) => `copied literally: ${m}`),
  ...MARKER_COLLISION_HASH_RUN_LENGTHS.map((n) => `hash run: ${'#'.repeat(n)} end`),
].join(' | ')

// Must stay in lockstep with training/test_prompt_contract_v2_candidate.py's
// EXPECTED_MARKER_COLLISION_DECODED -- confirmed byte-identical to the real
// Python (seed-17 checkpoint) tokenizer's decode of the same sanitized
// string at lock time (2026-08-02). If either tokenizer's vocabulary or
// normalization ever changes, both values must change together.
const EXPECTED_MARKER_COLLISION_DECODED =
  'copied literally: ## #NARRATIVE## # | copied literally: ## #BULLETS## # ' +
  '| copied literally: ## #BULLET## # | copied literally: ## #ACTIONS## # ' +
  '| copied literally: ## #ACTION## # | hash run: ## # end | hash run: ## ## end ' +
  '| hash run: ## ## # end | hash run: ## ## ## # end ' +
  '| hash run: ## ## ## ## ## ## ## ## ## ## ## end'

function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

function testVersionMatchesLockedCandidateString(): void {
  check('PROMPT_CONTRACT_VERSION matches the locked candidate string', PROMPT_CONTRACT_VERSION === EXPECTED_VERSION, PROMPT_CONTRACT_VERSION)
}

function testRenderedFixtureFingerprintMatchesLockedCrossRepoValue(): void {
  const rendered = buildPrompt(PROMPT_CONTRACT_FIXTURE)
  const fingerprint = sha256Hex(rendered)
  check('rendered fixture SHA-256 matches the locked cross-repo value', fingerprint === EXPECTED_FINGERPRINT, fingerprint)
}

function testMarkerBearingFixtureFingerprintMatchesLockedCrossRepoValue(): void {
  const rendered = buildPrompt(MARKER_BEARING_FIXTURE)
  const fingerprint = sha256Hex(rendered)
  check(
    'marker-bearing fixture SHA-256 matches the locked cross-repo value',
    fingerprint === EXPECTED_MARKER_BEARING_FINGERPRINT,
    fingerprint
  )
}

async function testTokenizerRoundTripPreservesTypedMarkers(): Promise<void> {
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_NAME)
  const rendered = `${NARRATIVE_MARKER}\ntext\n${BULLETS_MARKER}\n${BULLET_ITEM_MARKER} one\n${BULLET_ITEM_MARKER} two\n${ACTIONS_MARKER}\n${ACTION_ITEM_MARKER} three`
  const encoded = await tokenizer(rendered)
  const ids = Array.from(encoded.input_ids.data as Iterable<bigint>).map(Number)
  const decoded = tokenizer.decode(ids, { skip_special_tokens: true })
  check(
    'tokenizer round-trip preserves exact marker count/spelling',
    (decoded.match(new RegExp(BULLET_ITEM_MARKER, 'g')) ?? []).length === 2 &&
      (decoded.match(new RegExp(ACTION_ITEM_MARKER, 'g')) ?? []).length === 1,
    decoded
  )
  const result = parseOutput(decoded)
  check(
    'decoded (newline-collapsed) round-tripped text still parses correctly',
    result.narrative === 'text' && JSON.stringify(result.bullets) === JSON.stringify(['one', 'two']) && JSON.stringify(result.actions) === JSON.stringify(['three']),
    JSON.stringify(result)
  )
}

async function testSanitizedMarkerCollisionsSurviveRealTokenizerRoundTrip(): Promise<void> {
  const sanitized = sanitizeMarkerLikeText(MARKER_COLLISION_RAW)
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_NAME)
  const encoded = await tokenizer(sanitized)
  const ids = Array.from(encoded.input_ids.data as Iterable<bigint>).map(Number)
  const decoded = tokenizer.decode(ids, { skip_special_tokens: true })

  check(
    'no real marker substring survives sanitized-input tokenizer round-trip',
    !MARKER_COLLISION_MARKERS.some((m) => decoded.includes(m)),
    decoded
  )
  check('no 3+ \'#\' run survives sanitized-input tokenizer round-trip', !/#{3,}/.test(decoded), decoded)
  check(
    'decoded sanitized text matches the locked cross-runtime value (Python/JS parity)',
    decoded === EXPECTED_MARKER_COLLISION_DECODED,
    decoded
  )
}

async function main(): Promise<void> {
  testVersionMatchesLockedCandidateString()
  testRenderedFixtureFingerprintMatchesLockedCrossRepoValue()
  testMarkerBearingFixtureFingerprintMatchesLockedCrossRepoValue()
  await testTokenizerRoundTripPreservesTypedMarkers()
  await testSanitizedMarkerCollisionsSurviveRealTokenizerRoundTrip()

  console.log()
  if (FAILURES.length) {
    console.log(`${FAILURES.length} FAILURE(S): ${JSON.stringify(FAILURES)}`)
    process.exit(1)
  }
  console.log('All promptContractV2RuntimeParity tests passed.')
}

main()

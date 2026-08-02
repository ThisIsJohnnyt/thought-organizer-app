#!/usr/bin/env node
/**
 * Verifies the app's rendered prompt (for a fixed fixture input) against a
 * pinned SHA-256, so src/services/promptContract.ts can't silently drift
 * from what intent-recovery-model's training/prepare_data.py expects (the
 * model is fine-tuned to expect this exact prompt shape at inference time).
 *
 * Both sides render the SAME fixture text below through their own
 * buildPrompt/build_prompt function and must produce byte-identical
 * (UTF-8, LF) output. This script only verifies the app side -- the
 * training side runs the equivalent check against the same fixture and its
 * own pinned hash.
 *
 * Usage: node scripts/verify-prompt-contract.mjs
 *        npm run verify-prompt-contract
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import ts from 'typescript'

const EXPECTED_CONTRACT_VERSION = 'source-determined-bullets-v1'

// Fixed fixture (UTF-8, LF line endings). Do not change this string without
// coordinating the identical change to the training-side fixture -- the
// SHA-256 comparison is only meaningful if both sides render the same input.
const FIXTURE_RAW_INPUT =
  'worried about the project deadline tomorrow\nneed to call mom this week'

// Pinned against the current promptContract.ts. Update this only in the
// same change that intentionally updates the prompt contract, alongside a
// PROMPT_CONTRACT_VERSION bump and the matching training-side change.
const EXPECTED_SHA256 =
  'b3a7b9e8ddaaa390ab656028276ee0ab8e07700b8b531859a53735c1b59b2e01'

async function loadPromptContract() {
  const sourcePath = path.resolve('src/services/promptContract.ts')
  const source = readFileSync(sourcePath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  })
  const tempPath = path.join(os.tmpdir(), `prompt-contract-${process.pid}-${Date.now()}.mjs`)
  writeFileSync(tempPath, outputText)
  try {
    return await import(`file://${tempPath}`)
  } finally {
    unlinkSync(tempPath)
  }
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

async function main() {
  const { PROMPT_CONTRACT_VERSION, buildPrompt } = await loadPromptContract()

  if (PROMPT_CONTRACT_VERSION !== EXPECTED_CONTRACT_VERSION) {
    throw new Error(
      `PROMPT_CONTRACT_VERSION is "${PROMPT_CONTRACT_VERSION}", expected "${EXPECTED_CONTRACT_VERSION}". ` +
        'If this change is intentional, update EXPECTED_CONTRACT_VERSION and EXPECTED_SHA256 together here, ' +
        'and coordinate the matching change in intent-recovery-model\'s training/prepare_data.py before deploying.'
    )
  }

  const rendered = buildPrompt(FIXTURE_RAW_INPUT)
  if (rendered.includes('\r')) {
    throw new Error(
      'Rendered prompt contains a carriage return -- the contract requires pure LF. ' +
        '(JS template literals normalize source CRLF to LF automatically, so this would ' +
        'indicate an explicit \\r somewhere in promptContract.ts, not a git checkout artifact.)'
    )
  }

  const actualHash = sha256(rendered)
  console.log(`PROMPT_CONTRACT_VERSION: ${PROMPT_CONTRACT_VERSION}`)
  console.log(`Rendered prompt SHA-256: ${actualHash}`)

  if (actualHash !== EXPECTED_SHA256) {
    console.error(
      '\nMismatch: rendered prompt does not match the pinned hash.\n' +
        `Expected: ${EXPECTED_SHA256}\n` +
        `Actual:   ${actualHash}\n\n` +
        'If this is an intentional prompt change, update EXPECTED_SHA256 here AND confirm the ' +
        'matching change lands in intent-recovery-model\'s training/prepare_data.py -- run that ' +
        "side's equivalent check against the same fixture before deploying either side."
    )
    process.exit(1)
  }

  console.log('OK: rendered prompt matches the pinned contract hash.')
}

main().catch((err) => {
  console.error(`verify-prompt-contract failed: ${err.message}`)
  process.exit(1)
})

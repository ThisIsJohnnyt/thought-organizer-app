// Static, no-GPU feasibility tests for the vNext prompt-contract candidate
// parser, mirroring training/test_prompt_contract_v2_candidate.py. Not
// wired into the live app -- feasibility package only. Run with:
//   node_modules/.bin/esbuild src/services/promptContractV2Parser.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/out.cjs && node /tmp/out.cjs
// (no test runner configured in this project yet -- see package.json.
// This file uses the same check()/FAILURES pattern as the training repo's
// test scripts for consistency, not a framework this project doesn't have.)

import * as fs from 'fs'
import * as path from 'path'
import { parseOutput, ParseError } from './promptContractV2Parser'
import { sanitizeMarkerLikeText, NARRATIVE_MARKER, BULLETS_MARKER, BULLET_ITEM_MARKER, ACTIONS_MARKER } from './promptContractV2Candidate'

const FAILURES: string[] = []

function check(name: string, condition: boolean, detail = ''): void {
  const status = condition ? 'PASS' : 'FAIL'
  console.log(`[${status}] ${name}` + (detail && !condition ? ` -- ${detail}` : ''))
  if (!condition) FAILURES.push(name)
}

// process.cwd()-relative, not __dirname-relative: esbuild's bundled output
// rewrites __dirname to the *bundle's* emitted location, not this source
// file's location -- confirmed directly (the bundled test failed to find
// its own fixture file until this was fixed). This script is always run
// from the app repo root (see the usage comment above), so cwd is stable.
const FIXTURES_PATH = path.resolve(process.cwd(), 'src', 'services', 'prompt_contract_v2_parser_fixtures.json')
const TRAINING_FIXTURES_PATH = path.resolve(
  process.cwd(), '..', 'DeepThoughts', 'training', 'prompt_contract_v2_parser_fixtures.json'
)

interface Fixtures {
  valid_cases: { id: string; input: string; expected: { narrative: string; bullets: string[]; actions: string[] } }[]
  error_cases: { id: string; input: string; expect_error_contains: string }[]
}

function testFixtureFileContentIdenticalAcrossRepos(): void {
  // Structural (parsed JSON) comparison, not raw bytes: the training
  // repo's committed copy gets CRLF-normalized by Windows git autocrlf on
  // checkout while this repo's copy stays LF -- confirmed directly, a real
  // line-ending difference, not a content one. Compares parsed content,
  // which is what actually needs to match.
  if (!fs.existsSync(TRAINING_FIXTURES_PATH)) {
    check('fixture file content-identical across repos', false, `training-side copy not found at ${TRAINING_FIXTURES_PATH}`)
    return
  }
  const appData = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'))
  const trainingData = JSON.parse(fs.readFileSync(TRAINING_FIXTURES_PATH, 'utf8'))
  check('fixture file content-identical across repos', JSON.stringify(appData) === JSON.stringify(trainingData))
}

function testValidFixtureCases(): void {
  const fixtures: Fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'))
  for (const c of fixtures.valid_cases) {
    const result = parseOutput(c.input)
    const matches =
      result.narrative === c.expected.narrative &&
      JSON.stringify(result.bullets) === JSON.stringify(c.expected.bullets) &&
      JSON.stringify(result.actions) === JSON.stringify(c.expected.actions)
    check(`valid fixture '${c.id}' parses as expected`, matches, JSON.stringify(result))
  }
}

function testErrorFixtureCases(): void {
  const fixtures: Fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'))
  for (const c of fixtures.error_cases) {
    try {
      parseOutput(c.input)
      check(`error fixture '${c.id}' throws ParseError`, false, 'did not throw')
    } catch (e) {
      if (e instanceof ParseError) {
        check(`error fixture '${c.id}' throws ParseError`, e.message.includes(c.expect_error_contains), e.message)
      } else {
        throw e
      }
    }
  }
}

function testSanitizerDefangsAllRunLengths(): void {
  for (const runLen of [3, 4, 5, 7, 22]) {
    const text = `note with ${'#'.repeat(runLen)} hashes`
    const sanitized = sanitizeMarkerLikeText(text)
    check(`sanitizer defangs a ${runLen}-char '#' run`, !/#{3,}/.test(sanitized), sanitized)
    check(`sanitizer preserves visible content for a ${runLen}-char run`, sanitized.replace(/‌/g, '') === text)
  }
}

function testSanitizedInputCannotReachParserAsRealMarker(): void {
  const rawInput = 'I copied this: ###BULLET### as an example'
  const sanitized = sanitizeMarkerLikeText(rawInput)
  const fakeOutput = `${NARRATIVE_MARKER} ${sanitized} ${BULLETS_MARKER} ${BULLET_ITEM_MARKER} a real bullet ${ACTIONS_MARKER}`
  const result = parseOutput(fakeOutput)
  check(
    "sanitized echoed input doesn't corrupt parsing (still exactly one real bullet)",
    JSON.stringify(result.bullets) === JSON.stringify(['a real bullet']),
    JSON.stringify(result)
  )
}

testFixtureFileContentIdenticalAcrossRepos()
testValidFixtureCases()
testErrorFixtureCases()
testSanitizerDefangsAllRunLengths()
testSanitizedInputCannotReachParserAsRealMarker()

console.log()
if (FAILURES.length) {
  console.log(`${FAILURES.length} FAILURE(S): ${JSON.stringify(FAILURES)}`)
  process.exit(1)
}
console.log('All promptContractV2Parser tests passed.')

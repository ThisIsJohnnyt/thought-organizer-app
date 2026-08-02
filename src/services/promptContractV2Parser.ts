// Candidate vNext output parser -- fail-closed structural parsing for the
// typed-item-marker contract in promptContractV2Candidate.ts. Mirrors
// training/prompt_contract_v2_parser.py; must produce byte-equivalent
// parsed structures for the same decoded input (verified in the fixture
// test suite, not just asserted here).
//
// Not wired into any live pipeline -- static feasibility package only.

import {
  ACTION_ITEM_MARKER,
  ACTIONS_MARKER,
  BULLET_ITEM_MARKER,
  BULLETS_MARKER,
  NARRATIVE_MARKER,
} from './promptContractV2Candidate'

export class ParseError extends Error {}

export interface ParsedOutput {
  narrative: string
  bullets: string[]
  actions: string[]
}

function requireSingle(text: string, marker: string): number {
  const first = text.indexOf(marker)
  if (first === -1) {
    throw new ParseError(`missing required marker: ${marker}`)
  }
  const last = text.lastIndexOf(marker)
  if (first !== last) {
    throw new ParseError(`duplicated marker (expected exactly once): ${marker}`)
  }
  return first
}

function splitItems(
  sectionText: string,
  itemMarker: string,
  otherItemMarker: string,
  sectionName: string
): string[] {
  if (sectionText.includes(otherItemMarker)) {
    throw new ParseError(`cross-section leakage: ${otherItemMarker} found inside the ${sectionName} section`)
  }
  if (!sectionText.includes(itemMarker)) {
    if (sectionText.trim()) {
      throw new ParseError(
        `${sectionName} section has content but no ${itemMarker} markers ` +
          `(malformed -- content must be wrapped in item markers, not left bare)`
      )
    }
    return []
  }
  const parts = sectionText.split(itemMarker)
  const preamble = parts[0]
  if (preamble.trim()) {
    throw new ParseError(`unexpected text before the first ${itemMarker} in the ${sectionName} section: ${JSON.stringify(preamble)}`)
  }
  const items: string[] = []
  for (const rawItem of parts.slice(1)) {
    const item = rawItem.trim()
    if (!item) {
      throw new ParseError(`empty ${itemMarker} item in the ${sectionName} section`)
    }
    items.push(item)
  }
  return items
}

/** Fail-closed parse of a fully-decoded model output string under the
 * v2-candidate contract. Throws ParseError on any structural violation
 * rather than returning a best-effort guess. */
export function parseOutput(decodedText: string): ParsedOutput {
  const narrativePos = requireSingle(decodedText, NARRATIVE_MARKER)
  const bulletsPos = requireSingle(decodedText, BULLETS_MARKER)
  const actionsPos = requireSingle(decodedText, ACTIONS_MARKER)

  if (!(narrativePos < bulletsPos && bulletsPos < actionsPos)) {
    throw new ParseError(
      `section markers out of order (narrative=${narrativePos}, bullets=${bulletsPos}, actions=${actionsPos})`
    )
  }

  const preamble = decodedText.slice(0, narrativePos)
  if (preamble.trim()) {
    throw new ParseError(`unexpected text before ${NARRATIVE_MARKER}: ${JSON.stringify(preamble)}`)
  }

  const narrative = decodedText.slice(narrativePos + NARRATIVE_MARKER.length, bulletsPos).trim()
  if (!narrative) {
    throw new ParseError('narrative section is empty')
  }

  const bulletsSection = decodedText.slice(bulletsPos + BULLETS_MARKER.length, actionsPos)
  const bullets = splitItems(bulletsSection, BULLET_ITEM_MARKER, ACTION_ITEM_MARKER, 'bullets')

  const actionsSection = decodedText.slice(actionsPos + ACTIONS_MARKER.length)
  const actions = splitItems(actionsSection, ACTION_ITEM_MARKER, BULLET_ITEM_MARKER, 'actions')

  return { narrative, bullets, actions }
}

interface ParsedOutput {
  narrative: string
  bullets: string[]
  actionItems: string[]
  rawOutput?: string
}

// Plain delimited markers, not JSON: a small model frequently loses track of
// bracket/quote nesting on structured formats, but rarely drops a marker
// line. See src/services/noteOrganizer.ts for why.
const NARRATIVE_MARKER = '###NARRATIVE###'
const BULLETS_MARKER = '###BULLETS###'
const ACTIONS_MARKER = '###ACTIONS###'

export function parseModelOutput(modelOutput: string): ParsedOutput {
  const narrativeIdx = modelOutput.indexOf(NARRATIVE_MARKER)
  const bulletsIdx = modelOutput.indexOf(BULLETS_MARKER)
  const actionsIdx = modelOutput.indexOf(ACTIONS_MARKER)

  if (narrativeIdx === -1 || bulletsIdx === -1 || actionsIdx === -1) {
    throw new Error('Model output is missing one or more section markers')
  }
  if (!(narrativeIdx < bulletsIdx && bulletsIdx < actionsIdx)) {
    throw new Error('Model output section markers are out of order')
  }

  const narrative = modelOutput.slice(narrativeIdx + NARRATIVE_MARKER.length, bulletsIdx).trim()
  const bulletsText = modelOutput.slice(bulletsIdx + BULLETS_MARKER.length, actionsIdx).trim()
  const actionsText = modelOutput.slice(actionsIdx + ACTIONS_MARKER.length).trim()

  if (!narrative) {
    throw new Error('Model output has an empty narrative section')
  }

  return {
    narrative,
    bullets: splitLines(bulletsText),
    actionItems: splitLines(actionsText),
    rawOutput: modelOutput,
  }
}

function splitLines(text: string): string[] {
  if (!text) {
    return []
  }
  return text
    .split('\n')
    .map((line) => line.replace(/^[\s]*[-•*]\s*/, '').trim())
    .filter((line) => line.length > 0)
}

export function formatForDisplay(output: ParsedOutput): string {
  const lines = [NARRATIVE_MARKER, output.narrative, BULLETS_MARKER, ...output.bullets, ACTIONS_MARKER, ...output.actionItems]
  return lines.join('\n')
}

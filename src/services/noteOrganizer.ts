import { loadModel, streamFromModel } from './modelLoader'
import { parseModelOutput } from '../utils/outputParser'
import { intelligentChunk, estimateTokens } from '../utils/tokenization'
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE, buildPrompt } from './promptContract'

export { PROMPT_CONTRACT_VERSION } from './promptContract'

interface OrganizedNote {
  narrative: string
  bullets: string[]
  actionItems: string[]
  rawOutput?: string
}

export async function* streamOrganizedNotes(
  rawInput: string,
  onProgress: (progress: number, message: string) => void
): AsyncGenerator<OrganizedNote> {
  try {
    const model = await loadModel()
    onProgress(10, 'Model loaded. Analyzing your thoughts...')

    // Estimate tokens
    const inputTokens = estimateTokens(rawInput)
    const maxInputTokens = 6000

    if (inputTokens <= maxInputTokens) {
      // Single pass processing
      onProgress(20, 'Organizing your thoughts into clarity...')
      yield* processSinglePass(model, rawInput, onProgress)
    } else {
      // Multi-chunk processing
      onProgress(20, 'Your thoughts are quite detailed. Processing in sections...')
      yield* processMultiChunk(model, rawInput, onProgress)
    }
  } catch (err) {
    console.error('Error in streamOrganizedNotes:', err)
    throw err
  }
}

async function* processSinglePass(
  model: any,
  input: string,
  onProgress: (progress: number, message: string) => void
): AsyncGenerator<OrganizedNote> {
  onProgress(30, 'Generating organized narrative...')

  const prompt = buildPrompt(input)

  let fullOutput = ''
  let tokenCount = 0

  try {
    for await (const chunk of streamFromModel(model, prompt)) {
      fullOutput += chunk
      tokenCount++

      // Update progress (simulate streaming)
      const progress = 30 + Math.min((tokenCount / 100) * 60, 60)
      onProgress(progress, 'Processing...')

      // Try to parse incremental output
      try {
        const parsed = parseModelOutput(fullOutput)
        yield parsed
      } catch {
        // Incomplete output, keep collecting
      }
    }

    onProgress(95, 'Finalizing your organized thoughts...')

    // Final parse
    const finalOutput = parseModelOutput(fullOutput)
    finalOutput.rawOutput = fullOutput
    yield finalOutput

    onProgress(100, 'Done! Your thoughts are organized.')
  } catch (err) {
    console.error('Error in processSinglePass:', err)
    throw err
  }
}

async function* processMultiChunk(
  model: any,
  input: string,
  onProgress: (progress: number, message: string) => void
): AsyncGenerator<OrganizedNote> {
  try {
    // Split input into chunks
    const chunks = intelligentChunk(input)
    onProgress(
      25,
      `Split into ${chunks.length} sections. Processing section 1...`
    )

    const outputs: string[] = []

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunkNumber = i + 1
      const chunk = chunks[i]

      // Add context header for later chunks
      let contextPrefix = ''
      if (i > 0 && outputs.length > 0) {
        // Extract brief summary from previous chunk for context
        const prevSummary = outputs[i - 1].substring(0, 100) + '...'
        contextPrefix = `[Context from previous section: ${prevSummary}]\n\n`
      }

      const prompt = `${SYSTEM_PROMPT}\n\nUSER'S RAW THOUGHTS (Section ${chunkNumber}/${chunks.length}):\n${contextPrefix}${chunk}\n\n${USER_PROMPT_TEMPLATE}`

      onProgress(
        25 + (i / chunks.length) * 60,
        `Processing section ${chunkNumber} of ${chunks.length}...`
      )

      let chunkOutput = ''

      for await (const token of streamFromModel(model, prompt)) {
        chunkOutput += token
      }

      outputs.push(chunkOutput)

      // Yield incremental result
      try {
        const parsed = parseModelOutput(chunkOutput)
        yield parsed
      } catch {
        // Continue collecting
      }
    }

    // Merge pass: combine all outputs into coherent narrative
    onProgress(90, 'Combining sections into coherent narrative...')

    const mergePrompt = `You are organizing scattered thoughts. Here are multiple processed sections that came from a single raw input.

Combine all these sections into ONE unified result:

${outputs.map((out, idx) => `SECTION ${idx + 1}:\n${out}`).join('\n\n---\n\n')}

Respond with exactly this format, using these three section markers each on their own line, with no other text before or after:

###NARRATIVE###
a single coherent narrative combining all sections
###BULLETS###
consolidated key points from all sections, one per line, duplicates removed
###ACTIONS###
all action items from all sections, one per line, duplicates removed`

    let mergedOutput = ''
    for await (const token of streamFromModel(model, mergePrompt)) {
      mergedOutput += token
    }

    onProgress(98, 'Finalizing your organized thoughts...')

    const finalOutput = parseModelOutput(mergedOutput)
    finalOutput.rawOutput = mergedOutput
    yield finalOutput

    onProgress(100, 'Done! Your thoughts are organized.')
  } catch (err) {
    console.error('Error in processMultiChunk:', err)
    throw err
  }
}

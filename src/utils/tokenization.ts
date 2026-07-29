// Simple token estimation: roughly 4 characters = 1 token
// This is a heuristic approximation
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Maximum tokens for input before chunking is needed
const MAX_INPUT_TOKENS = 6000
const TARGET_CHUNK_TOKENS = 4500

export interface ChunkInfo {
  text: string
  startIdx: number
  endIdx: number
  tokenCount: number
}

export function intelligentChunk(text: string): string[] {
  const totalTokens = estimateTokens(text)

  if (totalTokens <= MAX_INPUT_TOKENS) {
    return [text]
  }

  // Need to split
  const chunks: string[] = []
  const lines = text.split('\n')

  let currentChunk = ''
  let currentTokens = 0

  for (const line of lines) {
    const lineTokens = estimateTokens(line)

    // If adding this line exceeds limit, save current chunk and start new one
    if (currentTokens + lineTokens > TARGET_CHUNK_TOKENS && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = line
      currentTokens = lineTokens
    } else {
      if (currentChunk) {
        currentChunk += '\n'
      }
      currentChunk += line
      currentTokens += lineTokens + 1 // +1 for newline
    }
  }

  // Add remaining chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }

  // If we somehow got just one chunk, but it's over the limit, force split
  if (chunks.length === 1 && estimateTokens(chunks[0]) > MAX_INPUT_TOKENS) {
    return forceChunkByCharacter(text)
  }

  return chunks.length === 0 ? [text] : chunks
}

function forceChunkByCharacter(text: string): string[] {
  const maxChars = TARGET_CHUNK_TOKENS * 4 // Convert tokens back to approximate chars
  const chunks: string[] = []

  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.substring(i, i + maxChars))
  }

  return chunks
}

export function detectTopics(text: string): string[] {
  const topicKeywords = [
    'about',
    'regarding',
    'concerning',
    'thinking about',
    'worried about',
    'excited about',
    'need to',
    'should',
    'want to',
    'question about',
    'problem',
    'issue',
    'task',
    'project',
  ]

  const topics: string[] = []
  const lowerText = text.toLowerCase()

  topicKeywords.forEach((keyword) => {
    if (lowerText.includes(keyword)) {
      topics.push(keyword)
    }
  })

  return topics
}

export function mergeChunkOutputs(outputs: string[]): string {
  // Simple merge: concatenate with markers
  return outputs
    .map((out, idx) => `--- SECTION ${idx + 1} ---\n${out}`)
    .join('\n\n')
}

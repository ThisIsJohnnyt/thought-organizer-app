import { pipeline, env } from '@xenova/transformers'
import type {
  TranscriptionErrorCode,
  WhisperWorkerRequest,
  WhisperWorkerResponse,
} from './whisperProtocol'

// Workers get their own module evaluation -- this env config is not shared
// with the main thread's modelLoader.ts, so it has to be set here too.
env.allowLocalModels = true
env.allowRemoteModels = false
env.localModelPath = '/models/'
env.backends.onnx.wasm.wasmPaths = '/ort-wasm/'

const MODEL_NAME = 'whisper-base.en'
const CHUNK_LENGTH_S = 30
const STRIDE_LENGTH_S = 5

// `self` is ambiguous under this project's tsconfig (DOM lib only, no
// "webworker" lib -- and TS doesn't allow mixing the two, since they
// define conflicting globals). Casting once to the minimal shape this file
// actually uses sidesteps that instead of fighting the ambient types.
const ctx = self as unknown as {
  postMessage: (message: WhisperWorkerResponse) => void
  onmessage: ((event: MessageEvent<WhisperWorkerRequest>) => void) | null
}

class TypedTranscriptionError extends Error {
  code: TranscriptionErrorCode
  constructor(code: TranscriptionErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

let cachedPipeline: any = null
let pipelineLoadingPromise: Promise<any> | null = null

async function getPipeline(id: string): Promise<any> {
  if (cachedPipeline) return cachedPipeline
  if (pipelineLoadingPromise) return pipelineLoadingPromise

  pipelineLoadingPromise = (async () => {
    ctx.postMessage({ type: 'model-loading', id, message: 'Loading speech-to-text model...' })
    try {
      const loaded = await pipeline('automatic-speech-recognition', MODEL_NAME, {
        quantized: true,
      })
      cachedPipeline = loaded
      return loaded
    } catch (err) {
      pipelineLoadingPromise = null
      throw new TypedTranscriptionError('model-load-failed', describeError(err))
    }
  })()

  return pipelineLoadingPromise
}

ctx.onmessage = async (event) => {
  const request = event.data
  if (request.type !== 'transcribe') return

  const { id, pcm, sampleRate } = request

  try {
    const transcriber = await getPipeline(id)

    const durationS = pcm.length / sampleRate
    const totalChunks = Math.max(
      1,
      Math.ceil(durationS / (CHUNK_LENGTH_S - STRIDE_LENGTH_S))
    )
    let chunksDone = 0
    let textSoFar = ''

    const result = await transcriber(pcm, {
      chunk_length_s: CHUNK_LENGTH_S,
      stride_length_s: STRIDE_LENGTH_S,
      return_timestamps: true,
      chunk_callback: (chunk: unknown) => {
        chunksDone += 1
        const chunkText =
          typeof chunk === 'object' &&
          chunk !== null &&
          'text' in chunk &&
          typeof (chunk as { text: unknown }).text === 'string'
            ? (chunk as { text: string }).text.trim()
            : ''
        if (chunkText) {
          textSoFar = textSoFar ? `${textSoFar} ${chunkText}` : chunkText
        }

        const clampedChunks = Math.min(chunksDone, totalChunks)
        ctx.postMessage({
          type: 'transcribe-progress',
          id,
          progress: Math.min(95, Math.round((clampedChunks / totalChunks) * 100)),
          message:
            totalChunks > 1
              ? `Transcribing... section ${clampedChunks} of ${totalChunks}`
              : 'Transcribing...',
          textSoFar,
        })
      },
    })

    const finalText =
      typeof result?.text === 'string' && result.text.trim().length > 0
        ? result.text.trim()
        : textSoFar.trim()

    ctx.postMessage({ type: 'transcribe-result', id, text: finalText })
  } catch (err) {
    if (err instanceof TypedTranscriptionError) {
      ctx.postMessage({ type: 'transcribe-error', id, code: err.code, message: err.message })
      return
    }
    ctx.postMessage({
      type: 'transcribe-error',
      id,
      code: 'inference-failed',
      message: describeError(err),
    })
  }
}

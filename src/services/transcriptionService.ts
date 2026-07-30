import { decodeAudioToPCM } from '../utils/audioDecode'
import type {
  TranscriptionErrorCode,
  WhisperWorkerRequest,
  WhisperWorkerResponse,
} from '../workers/whisperProtocol'

export type TranscriptionProgress = (progress: number, message: string) => void

export class TranscriptionError extends Error {
  constructor(public code: TranscriptionErrorCode, message: string) {
    super(message)
  }
}

// Same lazy-singleton shape as modelLoader.ts's cachedModel/modelLoadingPromise,
// just holding a Worker handle instead of a pipeline.
let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/whisperWorker.ts', import.meta.url), {
      type: 'module',
    })
  }
  return worker
}

// ONNX Runtime WASM can't abort a call mid-flight, so "cancel" means
// terminating the worker outright and letting the next call spawn a fresh
// one (accepting the cost of reloading the model).
let activeRequestId: string | null = null

export function terminateWorker(): void {
  worker?.terminate()
  worker = null
  activeRequestId = null
}

export function cancelTranscription(): void {
  terminateWorker()
}

export async function* streamTranscription(
  audioBlob: Blob,
  onProgress: TranscriptionProgress
): AsyncGenerator<string> {
  let pcm: Float32Array
  try {
    onProgress(0, 'Reading audio...')
    pcm = await decodeAudioToPCM(audioBlob)
  } catch (err) {
    throw new TranscriptionError(
      'decode-failed',
      err instanceof Error ? err.message : String(err)
    )
  }

  const id = crypto.randomUUID()
  activeRequestId = id
  const w = getWorker()

  const chunks: string[] = []
  let done = false
  let error: TranscriptionError | null = null
  let notify: (() => void) | null = null

  const handleMessage = (event: MessageEvent<WhisperWorkerResponse>) => {
    const response = event.data
    if (response.id !== id || activeRequestId !== id) return

    switch (response.type) {
      case 'model-loading':
        onProgress(0, response.message)
        break
      case 'transcribe-progress':
        onProgress(response.progress, response.message)
        chunks.push(response.textSoFar)
        notify?.()
        break
      case 'transcribe-result':
        onProgress(100, 'Done')
        chunks.push(response.text)
        done = true
        notify?.()
        break
      case 'transcribe-error':
        error = new TranscriptionError(response.code, response.message)
        done = true
        notify?.()
        break
    }
  }

  w.addEventListener('message', handleMessage)

  try {
    const request: WhisperWorkerRequest = { type: 'transcribe', id, pcm, sampleRate: 16000 }
    w.postMessage(request, [pcm.buffer])

    while (true) {
      if (chunks.length > 0) {
        yield chunks.shift() as string
        continue
      }
      if (done) {
        if (error) throw error
        return
      }
      await new Promise<void>((resolve) => {
        notify = resolve
      })
    }
  } finally {
    w.removeEventListener('message', handleMessage)
  }
}

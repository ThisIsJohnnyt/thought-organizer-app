// Message protocol shared between transcriptionService.ts (main thread) and
// whisperWorker.ts. Every response is tagged with the request `id` so the
// service can ignore stray messages from a cancelled/superseded call.

export type TranscriptionErrorCode =
  | 'model-load-failed'
  | 'decode-failed'
  | 'inference-failed'
  | 'cancelled'
  | 'unknown'

// There is no in-band 'cancel' request: ONNX Runtime WASM can't abort a
// mid-flight call cleanly, so cancellation is done by terminating the
// worker outright (see transcriptionService.cancelTranscription) rather
// than asking it to stop.
export type WhisperWorkerRequest =
  | { type: 'transcribe'; id: string; pcm: Float32Array; sampleRate: number }

export type WhisperWorkerResponse =
  | { type: 'model-loading'; id: string; message: string }
  | { type: 'transcribe-progress'; id: string; progress: number; message: string; textSoFar: string }
  | { type: 'transcribe-result'; id: string; text: string }
  | { type: 'transcribe-error'; id: string; code: TranscriptionErrorCode; message: string }

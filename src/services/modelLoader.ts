import { pipeline, env } from '@xenova/transformers'

// Self-hosted, fine-tuned model served from public/models/ (see
// training/export_onnx.py), not a Hugging Face Hub id — this model was
// fine-tuned specifically on this app's ###NARRATIVE###/###BULLETS###/
// ###ACTIONS### output format and Xenova/flan-t5-base can't produce it.
const MODEL_NAME = 'thoughtorganizer-flan-t5'

env.allowLocalModels = true
env.allowRemoteModels = false
env.localModelPath = '/models/'

let cachedModel: any = null
let modelLoadingPromise: Promise<any> | null = null

export async function loadModel(): Promise<any> {
  // Return cached model if available
  if (cachedModel) {
    return cachedModel
  }

  // If already loading, wait for the existing promise
  if (modelLoadingPromise) {
    return modelLoadingPromise
  }

  // Start loading the model
  modelLoadingPromise = loadModelInternal()
  return modelLoadingPromise
}

async function loadModelInternal(): Promise<any> {
  try {
    console.log('Loading fine-tuned text-to-text generation model...')

    const model = await pipeline('text2text-generation', MODEL_NAME, {
      quantized: true,
    })

    console.log('Model loaded successfully')
    cachedModel = model
    return model
  } catch (err) {
    console.error('Failed to load model:', err)
    throw new Error('Failed to load the text generation model')
  }
}

export function clearModel(): void {
  cachedModel = null
  modelLoadingPromise = null
}

export async function* streamFromModel(
  model: any,
  prompt: string,
  // Bounds worst-case runaway generation: a model that fails to emit EOS at
  // the right point (more likely on a small/undertrained checkpoint) will
  // otherwise loop until it exhausts this budget. parseModelOutput tolerates
  // a truncated ACTIONS section gracefully, so this is a safety cap, not a
  // quality lever — no_repeat_ngram_size was tried and rejected here because
  // it corrupts the literal ###MARKER### delimiters instead of stopping the
  // loop.
  maxNewTokens = 300
): AsyncGenerator<string> {
  const tokenizer = model.tokenizer
  const chunks: string[] = []
  let lastText = ''
  let done = false
  let error: unknown = null
  let notify: (() => void) | null = null

  model(prompt, {
    max_new_tokens: maxNewTokens,
    repetition_penalty: 1.3,
    callback_function: (beams: any[]) => {
      const decoded = tokenizer.decode(beams[0].output_token_ids, {
        skip_special_tokens: true,
      })
      if (decoded.length > lastText.length) {
        chunks.push(decoded.slice(lastText.length))
        lastText = decoded
        notify?.()
      }
    },
  })
    .catch((err: unknown) => {
      error = err
    })
    .finally(() => {
      done = true
      notify?.()
    })

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
}

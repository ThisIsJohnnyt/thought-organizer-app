// Decodes a recorded audio Blob into mono 16kHz PCM, the format Whisper
// expects. Runs on the main thread rather than in the transcription worker:
// AudioContext/OfflineAudioContext support inside dedicated Workers is
// inconsistent across current browser engines, so decoding here and
// transferring the resulting Float32Array into the worker (zero-copy, via
// postMessage's transfer list) is the safer, more portable choice.
export async function decodeAudioToPCM(
  blob: Blob,
  targetSampleRate = 16000
): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioContext = new AudioContext()

  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer)
    const mono = downmixToMono(decoded)

    if (decoded.sampleRate === targetSampleRate) {
      return mono
    }

    return await resample(mono, decoded.sampleRate, targetSampleRate)
  } finally {
    await audioContext.close()
  }
}

function downmixToMono(buffer: AudioBuffer): Float32Array<ArrayBuffer> {
  if (buffer.numberOfChannels === 1) {
    // Copied (not returned directly) so the result is always backed by a
    // plain ArrayBuffer, not the wider ArrayBufferLike AudioBuffer.getChannelData
    // returns -- needed for copyToChannel below and for postMessage transfer.
    return new Float32Array(buffer.getChannelData(0))
  }

  const mixed = new Float32Array(buffer.length)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel)
    for (let i = 0; i < buffer.length; i++) {
      mixed[i] += channelData[i] / buffer.numberOfChannels
    }
  }
  return mixed
}

async function resample(
  mono: Float32Array<ArrayBuffer>,
  sourceSampleRate: number,
  targetSampleRate: number
): Promise<Float32Array<ArrayBuffer>> {
  const targetLength = Math.ceil(
    (mono.length * targetSampleRate) / sourceSampleRate
  )
  const offlineContext = new OfflineAudioContext(1, targetLength, targetSampleRate)

  const sourceBuffer = offlineContext.createBuffer(1, mono.length, sourceSampleRate)
  sourceBuffer.copyToChannel(mono, 0)

  const source = offlineContext.createBufferSource()
  source.buffer = sourceBuffer
  source.connect(offlineContext.destination)
  source.start(0)

  const rendered = await offlineContext.startRendering()
  return new Float32Array(rendered.getChannelData(0))
}

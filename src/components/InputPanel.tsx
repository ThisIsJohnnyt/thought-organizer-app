import { useState, useRef } from 'react'
import '../styles/InputPanel.css'

export type TranscriptionStatus = 'idle' | 'transcribing' | 'error'

interface InputPanelProps {
  value: string
  onChange: (text: string) => void
  onAudioCapture: (audio: Blob) => void
  hasAudio: boolean
  onProcess: () => void
  isProcessing: boolean
  transcriptionStatus: TranscriptionStatus
  transcriptionProgress: number
  transcriptionMessage: string
  transcriptionError: string | null
  onRetryTranscription: () => void
  onDismissTranscriptionError: () => void
  onRecordingChange: (isRecording: boolean) => void
}

export default function InputPanel({
  value,
  onChange,
  onAudioCapture,
  hasAudio,
  onProcess,
  isProcessing,
  transcriptionStatus,
  transcriptionProgress,
  transcriptionMessage,
  transcriptionError,
  onRetryTranscription,
  onDismissTranscriptionError,
  onRecordingChange,
}: InputPanelProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isTranscribing = transcriptionStatus === 'transcribing'

  const startRecording = async () => {
    setRecordingError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      const stopTimer = () => {
        if (recordingIntervalRef.current !== null) {
          clearInterval(recordingIntervalRef.current)
          recordingIntervalRef.current = null
        }
      }

      mediaRecorder.onstop = () => {
        stopTimer()
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        onAudioCapture(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.onerror = (event) => {
        stopTimer()
        setIsRecording(false)
        onRecordingChange(false)
        const mediaError = (event as unknown as { error?: DOMException }).error
        setRecordingError(
          `Recording stopped unexpectedly. ${mediaError?.message || 'Please try again.'}`
        )
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      onRecordingChange(true)
      setRecordingTime(0)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
    } catch (err) {
      setRecordingError(describeRecordingError(err))
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      onRecordingChange(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="input-panel">
      <div className="input-mode-selector">
        <h2>Share Your Thoughts</h2>
        <p>Type or record your scattered thoughts. We'll organize them for you.</p>
      </div>

      <div className="input-area">
        <textarea
          className="thought-input"
          placeholder="Type or paste your scattered thoughts here... They don't need to be organized or coherent. Just get them out!"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isRecording || isTranscribing}
        />

        {hasAudio && transcriptionStatus === 'idle' && (
          <div className="audio-indicator">
            🎙️ Voice note recorded
          </div>
        )}

        {isTranscribing && (
          <div className="transcription-status">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(transcriptionProgress, 100)}%` }}
              ></div>
            </div>
            <p>{transcriptionMessage || 'Transcribing your recording...'}</p>
          </div>
        )}

        {transcriptionStatus === 'error' && transcriptionError && (
          <div className="transcription-error">
            <p>🎙️ {transcriptionError}</p>
            <div className="transcription-error-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onRetryTranscription}
              >
                Retry Transcription
              </button>
              <button
                type="button"
                className="btn btn-text"
                onClick={onDismissTranscriptionError}
              >
                Type it yourself
              </button>
            </div>
          </div>
        )}

        {recordingError && (
          <div className="recording-error">
            <p>⚠️ {recordingError}</p>
          </div>
        )}
      </div>

      <div className="input-controls">
        <div className="recording-controls">
          {!isRecording ? (
            <button
              className="btn btn-voice"
              onClick={startRecording}
              disabled={isProcessing || isTranscribing}
            >
              🎤 Record Voice Note
            </button>
          ) : (
            <>
              <div className="recording-indicator">
                <span className="pulse"></span>
                Recording: {formatTime(recordingTime)}
              </div>
              <button className="btn btn-stop" onClick={stopRecording}>
                Stop Recording
              </button>
            </>
          )}
        </div>

        <button
          className="btn btn-primary"
          onClick={onProcess}
          disabled={!value.trim() || isProcessing || isRecording || isTranscribing}
        >
          ✨ Organize My Thoughts
        </button>
      </div>
    </div>
  )
}

function describeRecordingError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Microphone access was denied. Allow microphone permissions for this site and try again.'
      case 'NotFoundError':
        return 'No microphone was found. Connect a microphone and try again.'
      case 'NotReadableError':
        return 'Your microphone is already in use by another application. Close it and try again.'
      case 'OverconstrainedError':
        return "Your microphone doesn't support the requested settings."
      default:
        return 'Unable to access microphone. Please check your browser and device settings.'
    }
  }
  return 'Unable to access microphone. Please check your browser and device settings.'
}

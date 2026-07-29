import { useState, useRef } from 'react'
import '../styles/InputPanel.css'

interface InputPanelProps {
  value: string
  onChange: (text: string) => void
  onAudioCapture: (audio: Blob) => void
  hasAudio: boolean
  onProcess: () => void
  isProcessing: boolean
}

export default function InputPanel({
  value,
  onChange,
  onAudioCapture,
  hasAudio,
  onProcess,
  isProcessing,
}: InputPanelProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        onAudioCapture(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      const interval = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)

      const stopInterval = () => clearInterval(interval)
      mediaRecorderRef.current.onstop = () => {
        stopInterval()
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        })
        onAudioCapture(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
      }
    } catch (err) {
      console.error('Failed to access microphone:', err)
      alert('Unable to access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
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
          disabled={isRecording}
        />

        {hasAudio && (
          <div className="audio-indicator">
            🎙️ Voice note recorded
          </div>
        )}
      </div>

      <div className="input-controls">
        <div className="recording-controls">
          {!isRecording ? (
            <button
              className="btn btn-voice"
              onClick={startRecording}
              disabled={isProcessing}
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
          disabled={!value.trim() || isProcessing || isRecording}
        >
          ✨ Organize My Thoughts
        </button>
      </div>
    </div>
  )
}

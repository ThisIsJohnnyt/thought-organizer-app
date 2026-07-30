import { useState, useEffect } from 'react'
import InputPanel from './components/InputPanel'
import type { TranscriptionStatus } from './components/InputPanel'
import ProcessingView from './components/ProcessingView'
import OrganizedNotesView from './components/OrganizedNotesView'
import HistoryPanel from './components/HistoryPanel'
import type { TranscriptionErrorCode } from './workers/whisperProtocol'
import './App.css'

interface OrganizedNote {
  narrative: string
  bullets: string[]
  actionItems: string[]
  rawOutput?: string
}

interface SavedNote {
  id: string
  timestamp: Date
  rawInput: string
  audioBlob?: Blob
  organized: OrganizedNote
}

export default function App() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentInput, setCurrentInput] = useState('')
  const [currentAudio, setCurrentAudio] = useState<Blob | null>(null)
  const [organizedNotes, setOrganizedNotes] = useState<OrganizedNote | null>(null)
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([])
  const [activeTab, setActiveTab] = useState<'input' | 'history'>('input')
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingMessage, setProcessingMessage] = useState('')

  // Voice recording state lives in InputPanel; App only needs to know
  // whether it's active so it can keep the History tab from unmounting
  // InputPanel (and orphaning the recording/transcription) mid-flight.
  const [isRecording, setIsRecording] = useState(false)
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus>('idle')
  const [transcriptionProgress, setTranscriptionProgress] = useState(0)
  const [transcriptionMessage, setTranscriptionMessage] = useState('')
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)

  useEffect(() => {
    loadSavedNotes()
  }, [])

  const loadSavedNotes = async () => {
    try {
      const db = await openDatabase()
      const notes = await getAllNotes(db)
      setSavedNotes(notes)
    } catch (err) {
      console.error('Failed to load notes:', err)
    }
  }

  const handleInputChange = (text: string) => {
    setCurrentInput(text)
  }

  const runTranscription = async (audio: Blob) => {
    // Computed once, up front -- never re-prepended as later partial
    // transcripts stream in, so an already-typed note is preserved rather
    // than duplicated on every progress update.
    const prefix = currentInput.trim() ? `${currentInput}\n\n` : ''

    setTranscriptionStatus('transcribing')
    setTranscriptionProgress(0)
    setTranscriptionMessage('')
    setTranscriptionError(null)

    const { streamTranscription, TranscriptionError } = await import(
      './services/transcriptionService'
    )

    try {
      for await (const partial of streamTranscription(audio, (progress, message) => {
        setTranscriptionProgress(progress)
        setTranscriptionMessage(message)
      })) {
        setCurrentInput(prefix + partial)
      }
      setTranscriptionStatus('idle')
    } catch (err) {
      console.error('Transcription failed:', err)
      if (err instanceof TranscriptionError && err.code === 'cancelled') {
        setTranscriptionStatus('idle')
        return
      }
      setTranscriptionStatus('error')
      setTranscriptionError(
        err instanceof TranscriptionError
          ? describeTranscriptionError(err.code)
          : describeTranscriptionError('unknown')
      )
      // currentAudio is intentionally left untouched here -- the recording
      // must never be lost just because transcription failed.
    }
  }

  const handleAudioCapture = (audio: Blob) => {
    setCurrentAudio(audio)
    runTranscription(audio)
  }

  const handleRetryTranscription = () => {
    if (currentAudio) {
      runTranscription(currentAudio)
    }
  }

  const handleDismissTranscriptionError = () => {
    setTranscriptionStatus('idle')
    setTranscriptionError(null)
  }

  const handleProcess = async () => {
    if (!currentInput.trim()) {
      alert('Please enter or record some thoughts first')
      return
    }

    setIsProcessing(true)
    setProcessingProgress(0)
    setProcessingMessage('')

    try {
      // Import the organizer service
      const { streamOrganizedNotes } = await import('./services/noteOrganizer')

      let finalOutput: OrganizedNote | null = null

      for await (const output of streamOrganizedNotes(
        currentInput,
        (progress, message) => {
          setProcessingProgress(progress)
          setProcessingMessage(message)
        }
      )) {
        finalOutput = output
        setOrganizedNotes(output)
      }

      if (finalOutput) {
        // Save to IndexedDB
        const note: SavedNote = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          rawInput: currentInput,
          audioBlob: currentAudio || undefined,
          organized: finalOutput
        }

        await saveNote(note)
        setSavedNotes([note, ...savedNotes])

        // Clear input
        setCurrentInput('')
        setCurrentAudio(null)
        setTranscriptionStatus('idle')
        setTranscriptionError(null)
      }
    } catch (err) {
      console.error('Processing failed:', err)
      alert('Failed to process notes. Please try again.')
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
      setProcessingMessage('')
    }
  }

  const handleClear = () => {
    setCurrentInput('')
    setCurrentAudio(null)
    setOrganizedNotes(null)
    setTranscriptionStatus('idle')
    setTranscriptionError(null)
  }

  const isVoiceBusy = isRecording || transcriptionStatus === 'transcribing'

  return (
    <div className="app">
      <header className="app-header">
        <h1>💭 ThoughtOrganizer</h1>
        <p>Transform scattered thoughts into clear, organized notes</p>
      </header>

      <main className="app-main">
        <div className="tab-buttons">
          <button
            className={`tab-btn ${activeTab === 'input' ? 'active' : ''}`}
            onClick={() => setActiveTab('input')}
          >
            New Note
          </button>
          <button
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            disabled={isVoiceBusy}
            title={isVoiceBusy ? 'Finish recording/transcribing before switching tabs' : undefined}
          >
            History ({savedNotes.length})
          </button>
        </div>

        {activeTab === 'input' ? (
          <div className="input-section">
            {!isProcessing && !organizedNotes ? (
              <InputPanel
                value={currentInput}
                onChange={handleInputChange}
                onAudioCapture={handleAudioCapture}
                hasAudio={!!currentAudio}
                onProcess={handleProcess}
                isProcessing={isProcessing}
                transcriptionStatus={transcriptionStatus}
                transcriptionProgress={transcriptionProgress}
                transcriptionMessage={transcriptionMessage}
                transcriptionError={transcriptionError}
                onRetryTranscription={handleRetryTranscription}
                onDismissTranscriptionError={handleDismissTranscriptionError}
                onRecordingChange={setIsRecording}
              />
            ) : isProcessing ? (
              <ProcessingView
                progress={processingProgress}
                message={processingMessage}
              />
            ) : organizedNotes ? (
              <>
                <OrganizedNotesView notes={organizedNotes} />
                <button className="btn btn-primary" onClick={handleClear}>
                  Create Another Note
                </button>
              </>
            ) : null}
          </div>
        ) : (
          <HistoryPanel notes={savedNotes} />
        )}
      </main>

      <footer className="app-footer">
        <p>All processing happens on your device. No data is sent to servers.</p>
      </footer>
    </div>
  )
}

function describeTranscriptionError(code: TranscriptionErrorCode): string {
  switch (code) {
    case 'decode-failed':
      return "We couldn't read that recording. You can still play it back, or type your thoughts manually below."
    case 'model-load-failed':
      return "Speech-to-text isn't available right now. You can type your thoughts manually below."
    case 'inference-failed':
      return 'Something went wrong while transcribing. You can retry, or type your thoughts manually below.'
    case 'cancelled':
    case 'unknown':
    default:
      return 'Something went wrong while transcribing. You can retry, or type your thoughts manually below.'
  }
}

// IndexedDB helpers
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('thoughtorganizer', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' })
      }
    }
  })
}

async function saveNote(note: SavedNote): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notes'], 'readwrite')
    const store = transaction.objectStore('notes')
    const request = store.add(note)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

async function getAllNotes(db: IDBDatabase): Promise<SavedNote[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['notes'], 'readonly')
    const store = transaction.objectStore('notes')
    const request = store.getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const notes = request.result as SavedNote[]
      // Sort by timestamp descending
      resolve(notes.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ))
    }
  })
}

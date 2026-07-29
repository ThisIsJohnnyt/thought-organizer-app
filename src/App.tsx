import { useState, useEffect } from 'react'
import InputPanel from './components/InputPanel'
import ProcessingView from './components/ProcessingView'
import OrganizedNotesView from './components/OrganizedNotesView'
import HistoryPanel from './components/HistoryPanel'
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

  const handleAudioCapture = (audio: Blob) => {
    setCurrentAudio(audio)
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
  }

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

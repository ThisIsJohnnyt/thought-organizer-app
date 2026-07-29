import { useState } from 'react'
import '../styles/HistoryPanel.css'

interface OrganizedNote {
  narrative: string
  bullets: string[]
  actionItems: string[]
}

interface SavedNote {
  id: string
  timestamp: Date
  rawInput: string
  audioBlob?: Blob
  organized: OrganizedNote
}

interface HistoryPanelProps {
  notes: SavedNote[]
}

export default function HistoryPanel({ notes }: HistoryPanelProps) {
  const [selectedNote, setSelectedNote] = useState<SavedNote | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredNotes = notes.filter(
    (note) =>
      note.rawInput.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.organized.narrative
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  )

  const formatDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="history-panel">
      <div className="history-header">
        <h2>📚 Your Notes History</h2>
        <input
          type="text"
          className="search-input"
          placeholder="Search your notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="history-layout">
        <div className="notes-list">
          {filteredNotes.length > 0 ? (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
                onClick={() => setSelectedNote(note)}
              >
                <div className="note-date">{formatDate(note.timestamp)}</div>
                <div className="note-preview">
                  {note.rawInput.substring(0, 100)}...
                </div>
                {note.audioBlob && <span className="audio-badge">🎙️</span>}
              </div>
            ))
          ) : (
            <div className="empty-state">
              {searchTerm
                ? 'No notes match your search'
                : 'No saved notes yet. Create your first organized note!'}
            </div>
          )}
        </div>

        <div className="note-detail">
          {selectedNote ? (
            <>
              <div className="detail-header">
                <h3>Note from {formatDate(selectedNote.timestamp)}</h3>
                {selectedNote.audioBlob && (
                  <audio controls>
                    <source
                      src={URL.createObjectURL(selectedNote.audioBlob)}
                      type="audio/webm"
                    />
                  </audio>
                )}
              </div>

              <div className="detail-tabs">
                <div className="detail-section">
                  <h4>💭 Raw Input</h4>
                  <p className="raw-text">{selectedNote.rawInput}</p>
                </div>

                <div className="detail-section">
                  <h4>📖 Organized Narrative</h4>
                  <p>{selectedNote.organized.narrative}</p>
                </div>

                <div className="detail-section">
                  <h4>📝 Key Points</h4>
                  <ul>
                    {selectedNote.organized.bullets.map((bullet, idx) => (
                      <li key={idx}>{bullet}</li>
                    ))}
                  </ul>
                </div>

                <div className="detail-section">
                  <h4>✅ Action Items</h4>
                  <ul>
                    {selectedNote.organized.actionItems.length > 0 ? (
                      selectedNote.organized.actionItems.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))
                    ) : (
                      <li className="empty-state">None identified</li>
                    )}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              Select a note to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

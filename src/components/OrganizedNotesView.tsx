import { useState } from 'react'
import '../styles/OrganizedNotesView.css'

interface OrganizedNote {
  narrative: string
  bullets: string[]
  actionItems: string[]
  rawOutput?: string
}

interface OrganizedNotesViewProps {
  notes: OrganizedNote
}

type TabType = 'narrative' | 'bullets' | 'actions'

export default function OrganizedNotesView({ notes }: OrganizedNotesViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('narrative')

  const exportAsMarkdown = () => {
    let markdown = '# Organized Thoughts\n\n'

    markdown += '## Narrative\n\n'
    markdown += notes.narrative + '\n\n'

    markdown += '## Key Points\n\n'
    notes.bullets.forEach((bullet) => {
      markdown += `- ${bullet}\n`
    })

    markdown += '\n## Action Items\n\n'
    notes.actionItems.forEach((item) => {
      markdown += `- [ ] ${item}\n`
    })

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thoughts-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportAsJSON = () => {
    const json = JSON.stringify(notes, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thoughts-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = () => {
    let text = 'Narrative:\n' + notes.narrative + '\n\n'
    text += 'Key Points:\n' + notes.bullets.join('\n') + '\n\n'
    text += 'Action Items:\n' + notes.actionItems.join('\n')

    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!')
    })
  }

  return (
    <div className="organized-notes-view">
      <h2>✨ Your Organized Thoughts</h2>

      <div className="notes-tabs">
        <button
          className={`tab ${activeTab === 'narrative' ? 'active' : ''}`}
          onClick={() => setActiveTab('narrative')}
        >
          📖 Narrative
        </button>
        <button
          className={`tab ${activeTab === 'bullets' ? 'active' : ''}`}
          onClick={() => setActiveTab('bullets')}
        >
          📝 Key Points ({notes.bullets.length})
        </button>
        <button
          className={`tab ${activeTab === 'actions' ? 'active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >
          ✅ Action Items ({notes.actionItems.length})
        </button>
      </div>

      <div className="notes-content">
        {activeTab === 'narrative' && (
          <div className="content-section">
            <p>{notes.narrative}</p>
          </div>
        )}

        {activeTab === 'bullets' && (
          <div className="content-section">
            {notes.bullets.length > 0 ? (
              <ul className="bullet-list">
                {notes.bullets.map((bullet, idx) => (
                  <li key={idx}>{bullet}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No key points identified.</p>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="content-section">
            {notes.actionItems.length > 0 ? (
              <ul className="action-list">
                {notes.actionItems.map((item, idx) => (
                  <li key={idx}>
                    <input type="checkbox" id={`action-${idx}`} />
                    <label htmlFor={`action-${idx}`}>{item}</label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No action items identified.</p>
            )}
          </div>
        )}
      </div>

      <div className="export-controls">
        <button className="btn btn-secondary" onClick={copyToClipboard}>
          📋 Copy
        </button>
        <button className="btn btn-secondary" onClick={exportAsMarkdown}>
          📄 Export as MD
        </button>
        <button className="btn btn-secondary" onClick={exportAsJSON}>
          💾 Export as JSON
        </button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import '../styles/ProcessingView.css'

interface ProcessingViewProps {
  progress: number
  message: string
}

const SUPPORTIVE_MESSAGES = [
  '🧘 Take a deep breath while I work. You\'re doing great.',
  '😌 Relax—I\'m handling the messy part for you.',
  '😊 Smile! Your thoughts are about to make more sense.',
  '🌟 No rush. Let\'s take this at a calm pace.',
  '💚 You\'re not alone in having scattered thoughts. I\'ve got this.',
  '✨ Your thoughts are being organized into something clearer...',
  '🎯 Almost there. Stay calm, I\'m organizing everything.',
  '💭 Let\'s transform chaos into clarity together.',
]

export default function ProcessingView({
  progress,
  message,
}: ProcessingViewProps) {
  const [displayMessage, setDisplayMessage] = useState(SUPPORTIVE_MESSAGES[0])

  useEffect(() => {
    const interval = setInterval(() => {
      const randomMessage =
        SUPPORTIVE_MESSAGES[
          Math.floor(Math.random() * SUPPORTIVE_MESSAGES.length)
        ]
      setDisplayMessage(randomMessage)
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="processing-view">
      <div className="processing-container">
        <div className="spinner"></div>

        <h2>Organizing Your Thoughts</h2>

        {message && (
          <div className="status-message" role="status" aria-live="polite">
            {message}
          </div>
        )}

        <div className="supportive-message" role="status" aria-live="polite">
          {displayMessage}
        </div>

        {progress > 0 && (
          <div className="progress-section">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
            <p className="progress-text">
              {progress < 100 ? `Processing... ${Math.round(progress)}%` : 'Finalizing...'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

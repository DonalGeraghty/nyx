import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import { useAuth } from '../context/AuthContext'
import { analyzeMeal, logMeal } from '../services/nutrition'
import { aiRequestError } from '../utils/aiErrors'

function NyxHome() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [message, setMessage] = useState('')
  const [sourceMessage, setSourceMessage] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [showAISettingsLink, setShowAISettingsLink] = useState(false)
  const [notice, setNotice] = useState('')
  const [logged, setLogged] = useState(false)

  const handleUnauthorized = (requestError) => {
    if (requestError.status !== 401) return false
    logout()
    navigate('/', { replace: true })
    return true
  }

  const runAnalysis = async (submittedMessage) => {
    setBusy('analyze')
    setError('')
    setShowAISettingsLink(false)
    setNotice('')
    setAnalysis(null)
    setLogged(false)
    try {
      const result = await analyzeMeal(submittedMessage)
      setAnalysis(result)
      setSourceMessage(submittedMessage)
      setMessage('')
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        const errorDetails = aiRequestError(
          requestError,
          'analyzing food',
          'Could not analyze that meal.'
        )
        setError(errorDetails.message)
        setShowAISettingsLink(errorDetails.showAccountLink)
      }
    } finally {
      setBusy('')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const submittedMessage = message.trim()
    if (!submittedMessage) return
    await runAnalysis(submittedMessage)
  }

  const handleLog = async () => {
    if (!analysis?.items?.length || logged) return
    setBusy('log')
    setError('')
    setShowAISettingsLink(false)
    setNotice('')
    const eatenAt = new Date().toISOString()
    const clientRequestId = globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    try {
      await logMeal(analysis.items, sourceMessage, user?.accountId, {
        clientRequestId,
        eatenAt,
      })
      setLogged(true)
      setNotice('Meal logged successfully.')
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        setError(requestError.message || 'Could not log this meal.')
      }
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="hub-page nyx-home">
      <div className="hub-inner">
        <Brand />
        <header className="food-log-hero">
          <p className="home-eyebrow">Natural language nutrition record</p>
          <h1 className="hub-title">Food log.</h1>
          <p>
            Describe what you ate. Nyx will estimate the nutrition and structure it
            for you to review before anything is saved.
          </p>
        </header>

        <form className="message-composer" onSubmit={handleSubmit}>
          <label htmlFor="message">Tell Nyx about your meal</label>
          <textarea
            id="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                event.currentTarget.form.requestSubmit()
              }
            }}
            placeholder="I had a bowl of porridge with banana and honey, plus a coffee with milk…"
            rows="6"
            maxLength="2000"
            disabled={Boolean(busy)}
          />
          <div className="message-composer-actions">
            <span>Ctrl/⌘ + Enter to send</span>
            <button type="submit" disabled={Boolean(busy) || !message.trim()}>
              {busy === 'analyze' ? 'Analyzing…' : 'Analyze meal'}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>

        {error && (
          <div className="message-error" role="alert">
            <p>{error}</p>
            {showAISettingsLink && (
              <Link to="/account">Open Account</Link>
            )}
          </div>
        )}

        {analysis && (
          <section className="message-response" aria-live="polite">
            <div className="meal-result-heading">
              <div>
                <p className="home-eyebrow">Ready to review</p>
                <h2>Estimated nutrition</h2>
                <p className="meal-confidence">Confidence: {analysis.confidence}</p>
              </div>
              <div className="meal-totals">
                <strong>{analysis.total_calories.toLocaleString()} kcal</strong>
                <span>{analysis.total_protein_g} g protein</span>
              </div>
            </div>

            <ul className="meal-items">
              {analysis.items.map((item, index) => (
                <li key={`${item.food}-${index}`}>
                  <div>
                    <strong>{item.food}</strong>
                    <span>{item.portion}</span>
                  </div>
                  <div className="meal-item-nutrition">
                    <span>{item.calories} kcal</span>
                    <span>{item.protein_g} g protein</span>
                  </div>
                </li>
              ))}
            </ul>

            {analysis.assumptions?.length > 0 && (
              <details className="meal-assumptions">
                <summary>Assumptions</summary>
                <ul>
                  {analysis.assumptions.map((assumption, index) => (
                    <li key={index}>{assumption}</li>
                  ))}
                </ul>
              </details>
            )}

            {analysis.needs_clarification && analysis.clarification_question && (
              <p className="meal-clarification">{analysis.clarification_question}</p>
            )}

            <footer className="meal-review-footer">
              <p className={logged ? 'meal-log-success' : undefined} role={notice ? 'status' : undefined}>
                {notice || 'Nothing is saved until you confirm.'}
              </p>
              <button
                type="button"
                className="meal-log-button"
                onClick={handleLog}
                disabled={Boolean(busy) || logged}
              >
                {busy === 'log' ? 'Logging…' : logged ? 'Meal logged' : 'Log meal'}
                <span aria-hidden="true">✓</span>
              </button>
            </footer>
          </section>
        )}
      </div>
    </main>
  )
}

export default NyxHome

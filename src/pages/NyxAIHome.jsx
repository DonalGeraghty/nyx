import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Lightfall from '../components/Lightfall'
import { useAuth } from '../context/AuthContext'
import { analyzeMeal, logMeal } from '../services/nutrition'
import { aiRequestError } from '../utils/aiErrors'

const LIGHTFALL_COLORS = ['#ffffff', '#b8b8b8', '#6f6f6f']

function NyxAIHome() {
  const navigate = useNavigate()
  const { logout } = useAuth()
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

  const handleSubmit = async (event) => {
    event.preventDefault()
    const submittedMessage = message.trim()
    if (!submittedMessage) return

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

  const handleLog = async () => {
    if (!analysis?.items?.length || logged) return
    setBusy('log')
    setError('')
    setShowAISettingsLink(false)
    setNotice('')
    try {
      await logMeal(analysis.items, sourceMessage)
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
    <main className="hub-page nyxai-home">
      <Lightfall
        colors={LIGHTFALL_COLORS}
        backgroundColor="#000000"
        speed={0.3}
        streakCount={4}
        streakWidth={0.7}
        streakLength={1.4}
        glow={0.55}
        density={0.5}
        twinkle={0.45}
        backgroundGlow={0.05}
        opacity={0.6}
        mouseStrength={0.25}
      />
      <div className="hub-inner">
        <header className="hub-header">
          <h1 className="hub-title">NYX//AI</h1>
        </header>

        <form className="message-composer" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="message">Describe what you ate</label>
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
            placeholder="I ate an apple…"
            rows="5"
            maxLength="2000"
            disabled={Boolean(busy)}
          />
          <button type="submit" disabled={Boolean(busy) || !message.trim()}>
            {busy === 'analyze' ? 'Analyzing…' : 'Send'}
          </button>
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

            <button
              type="button"
              className="meal-log-button"
              onClick={handleLog}
              disabled={Boolean(busy) || logged}
            >
              {busy === 'log' ? 'Logging…' : logged ? 'Logged' : 'Log meal'}
            </button>
            {notice && <p className="meal-log-success" role="status">{notice}</p>}
          </section>
        )}
      </div>
    </main>
  )
}

export default NyxAIHome

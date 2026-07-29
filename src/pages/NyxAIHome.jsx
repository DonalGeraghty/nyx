import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Lightfall from '../components/Lightfall'
import { useAuth } from '../context/AuthContext'
import { analyzeMeal, logMeal } from '../services/nutrition'
import {
  deleteMealDraft,
  enqueueNutritionEntry,
  listMealDrafts,
  saveMealDraft,
} from '../services/offlineStore'
import { aiRequestError } from '../utils/aiErrors'

const LIGHTFALL_COLORS = ['#ffffff', '#b8b8b8', '#6f6f6f']

function NyxAIHome() {
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
  const [drafts, setDrafts] = useState([])

  const refreshDrafts = useCallback(async () => {
    setDrafts(await listMealDrafts(user?.accountId))
  }, [user?.accountId])

  useEffect(() => {
    refreshDrafts()
  }, [refreshDrafts])

  const handleUnauthorized = (requestError) => {
    if (requestError.status !== 401) return false
    logout()
    navigate('/', { replace: true })
    return true
  }

  const runAnalysis = async (submittedMessage, draftId = null) => {
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
      if (draftId) {
        await deleteMealDraft(user?.accountId, draftId)
        await refreshDrafts()
      }
    } catch (requestError) {
      if (requestError instanceof TypeError && user?.accountId) {
        if (!draftId) await saveMealDraft(user.accountId, submittedMessage)
        await refreshDrafts()
        setMessage('')
        setNotice(
          draftId
            ? 'Connection lost. The existing draft is still saved.'
            : 'Connection lost. The meal description was saved as a draft.'
        )
      } else if (!handleUnauthorized(requestError)) {
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
    if (!navigator.onLine && user?.accountId) {
      await saveMealDraft(user.accountId, submittedMessage)
      await refreshDrafts()
      setMessage('')
      setNotice('Saved as a draft. Analyze it explicitly when you are back online.')
      return
    }
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
      if (requestError instanceof TypeError && user?.accountId) {
        await enqueueNutritionEntry(user.accountId, {
          items: analysis.items,
          sourceMessage,
          eatenAt,
          clientRequestId,
        })
        setLogged(true)
        setNotice('Saved to the sync queue. It will log when your connection returns.')
      } else if (!handleUnauthorized(requestError)) {
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
          <p className="hub-eyebrow">NyxAI</p>
          <h1 className="hub-title">Food Log</h1>
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

        {notice && !analysis && (
          <p className="meal-log-success" role="status">{notice}</p>
        )}

        {drafts.length > 0 && (
          <section className="offline-drafts" aria-labelledby="offline-drafts-heading">
            <div>
              <h2 id="offline-drafts-heading">Meal drafts</h2>
              <p>Drafts never call an AI provider until you choose Analyze.</p>
            </div>
            <ul>
              {drafts.map((draft) => (
                <li key={draft.id}>
                  <span>{draft.message}</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => runAnalysis(draft.message, draft.id)}
                      disabled={Boolean(busy) || !navigator.onLine}
                    >
                      Analyze
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={async () => {
                        await deleteMealDraft(user?.accountId, draft.id)
                        await refreshDrafts()
                      }}
                      disabled={Boolean(busy)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
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

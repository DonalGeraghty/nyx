import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAISettings, saveAISelection } from '../services/aiSettings'
import ProviderKeySettings from './ProviderKeySettings'

function validModelFor(provider, ...candidates) {
  const models = provider?.models || []
  for (const candidate of candidates) {
    if (models.some((model) => model.id === candidate)) return candidate
  }
  return models[0]?.id || ''
}

function selectionFor(settings) {
  const providers = settings.providers || []
  const selectedProvider = (
    providers.find((provider) => provider.id === settings.selection?.provider)
    || providers[0]
  )
  return {
    provider: selectedProvider?.id || '',
    model: validModelFor(selectedProvider, settings.selection?.model),
  }
}

function settingsErrorMessage(error) {
  if (error.code === 'provider_key_required') {
    return 'Add an API key for that provider before selecting it.'
  }
  if (error.code === 'provider_key_invalid') {
    return 'That provider’s API key is no longer valid. Replace it below.'
  }
  if (error.code === 'provider_access_denied') {
    return 'That API key does not have the required provider access.'
  }
  if (error.code === 'provider_billing_required') {
    return 'That provider account needs API credit or a higher spending limit.'
  }
  if (error.code === 'provider_unavailable') {
    return 'That AI provider is temporarily unavailable. Try again later.'
  }
  if (error.code === 'credential_service_unavailable') {
    return 'Secure key storage is temporarily unavailable. Try again later.'
  }
  return error.message || 'Could not update your AI profile.'
}

function AISettings() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [settings, setSettings] = useState(null)
  const [draftSelection, setDraftSelection] = useState({ provider: '', model: '' })
  const [draftModelsByProvider, setDraftModelsByProvider] = useState({})
  const [loading, setLoading] = useState(!user?.isDemo)
  const [loadFailed, setLoadFailed] = useState(false)
  const [savingSelection, setSavingSelection] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const handleUnauthorized = useCallback((requestError) => {
    if (requestError.status !== 401) return false
    logout()
    navigate('/', { replace: true })
    return true
  }, [logout, navigate])

  useEffect(() => {
    if (user?.isDemo) return undefined

    let active = true
    getAISettings()
      .then((nextSettings) => {
        if (!active) return
        const initialSelection = selectionFor(nextSettings)
        setSettings(nextSettings)
        setDraftSelection(initialSelection)
        setDraftModelsByProvider(
          initialSelection.provider
            ? { [initialSelection.provider]: initialSelection.model }
            : {}
        )
        setLoadFailed(false)
      })
      .catch((requestError) => {
        if (!active || handleUnauthorized(requestError)) return
        setLoadFailed(true)
        setError(settingsErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [handleUnauthorized, user?.isDemo])

  const selectedProvider = useMemo(
    () => settings?.providers.find((provider) => provider.id === draftSelection.provider),
    [draftSelection.provider, settings?.providers]
  )
  const selectedModel = selectedProvider?.models?.find(
    (model) => model.id === draftSelection.model
  )
  const savedSelection = settings?.selection || {}
  const selectionChanged = (
    draftSelection.provider !== savedSelection.provider
    || draftSelection.model !== savedSelection.model
  )
  const selectionReady = Boolean(
    selectedProvider?.credential?.configured
    && selectedModel
  )

  const handleProviderChange = (providerId) => {
    const provider = settings.providers.find((candidate) => candidate.id === providerId)
    const savedModel = settings.selection?.provider === providerId
      ? settings.selection.model
      : ''
    const model = validModelFor(
      provider,
      draftModelsByProvider[providerId],
      savedModel
    )
    setDraftSelection({
      provider: providerId,
      model,
    })
    setDraftModelsByProvider((current) => ({ ...current, [providerId]: model }))
    setError('')
    setNotice('')
  }

  const handleModelChange = (event) => {
    const model = event.target.value
    const providerId = draftSelection.provider
    setDraftSelection((current) => ({ ...current, model }))
    if (providerId) {
      setDraftModelsByProvider((current) => ({ ...current, [providerId]: model }))
    }
    setError('')
    setNotice('')
  }

  const handleSelectionSave = async (event) => {
    event.preventDefault()
    if (!selectionReady || !selectionChanged || savingSelection) return
    setSavingSelection(true)
    setError('')
    setNotice('')
    try {
      const selection = await saveAISelection(draftSelection)
      setSettings((current) => ({ ...current, selection }))
      setDraftSelection(selection)
      setDraftModelsByProvider((current) => ({
        ...current,
        [selection.provider]: selection.model,
      }))
      setNotice('Your AI provider and model have been updated.')
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        setError(settingsErrorMessage(requestError))
      }
    } finally {
      setSavingSelection(false)
    }
  }

  const handleCredentialChange = useCallback((providerId, credential) => {
    setSettings((current) => {
      if (!current) return current
      return {
        ...current,
        providers: current.providers.map((provider) => (
          provider.id === providerId ? { ...provider, credential } : provider
        )),
      }
    })
  }, [])

  if (user?.isDemo) {
    return (
      <section className="account-section" aria-labelledby="ai-profile-heading">
        <h2 id="ai-profile-heading">AI profile</h2>
        <p className="account-section-copy">
          Provider selection and API-key storage are unavailable for the local demo account.
        </p>
      </section>
    )
  }

  return (
    <>
      <section className="account-section ai-profile-section" aria-labelledby="ai-profile-heading">
        <div className="account-section-heading">
          <div>
            <h2 id="ai-profile-heading">AI profile</h2>
            <p className="account-key-status" aria-live="polite">
              {loading
                ? 'Loading providers…'
                : loadFailed
                  ? 'AI providers could not be loaded.'
                  : settings?.providers.length
                    ? 'Choose which provider and model Nyx uses.'
                    : 'No AI providers are available.'}
            </p>
          </div>
        </div>

        {!loading && settings?.providers.length > 0 && (
          <form className="ai-profile-form" onSubmit={handleSelectionSave}>
            <fieldset className="ai-provider-fieldset" disabled={savingSelection}>
              <legend>Provider</legend>
              <div className="ai-provider-options">
                {settings.providers.map((provider) => {
                  const checked = provider.id === draftSelection.provider
                  const configured = Boolean(provider.credential?.configured)
                  const disabled = !configured && !checked
                  return (
                    <label
                      key={provider.id}
                      className={`ai-provider-option${checked ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                    >
                      <input
                        type="radio"
                        name="ai-provider"
                        value={provider.id}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => handleProviderChange(provider.id)}
                      />
                      <span>
                        <strong>{provider.name || provider.id}</strong>
                        <small>
                          {configured ? 'API key configured' : 'Add an API key below to select'}
                        </small>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <label className="ai-model-field" htmlFor="ai-model">
              Model
              <select
                id="ai-model"
                value={draftSelection.model}
                onChange={handleModelChange}
                disabled={savingSelection || !selectedProvider?.models?.length}
              >
                {(selectedProvider?.models || []).map((model) => (
                  <option key={model.id} value={model.id}>{model.name || model.id}</option>
                ))}
              </select>
            </label>
            {selectedModel?.description && (
              <p className="ai-model-description">{selectedModel.description}</p>
            )}
            {!selectedProvider?.credential?.configured && (
              <p className="ai-provider-guidance">
                Add a {selectedProvider?.name || 'provider'} API key below before saving this selection.
              </p>
            )}

            <button
              type="submit"
              className="ai-profile-submit"
              disabled={!selectionReady || !selectionChanged || savingSelection}
            >
              {savingSelection ? 'Saving…' : 'Save AI profile'}
            </button>
          </form>
        )}

        {error && <p className="account-key-message account-key-error" role="alert">{error}</p>}
        {notice && <p className="account-key-message account-key-success" role="status">{notice}</p>}
      </section>

      {!loading && settings?.providers.length > 0 && (
        <div className="ai-key-grid" aria-label="Provider API keys">
          {settings.providers.map((provider) => (
            <ProviderKeySettings
              key={provider.id}
              provider={provider}
              selected={provider.id === settings.selection?.provider}
              onCredentialChange={handleCredentialChange}
              onUnauthorized={handleUnauthorized}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default AISettings

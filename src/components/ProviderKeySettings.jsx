import React, { useState } from 'react'
import {
  deleteAIProviderCredential,
  saveAIProviderCredential,
} from '../services/aiSettings'

const PROVIDER_LINKS = {
  openai: {
    href: 'https://platform.openai.com/api-keys',
    label: 'Create an OpenAI API key',
    placeholder: 'sk-…',
  },
  mistral: {
    href: 'https://console.mistral.ai/api-keys/',
    label: 'Create a Mistral API key',
    placeholder: 'Enter your Mistral API key',
  },
  anthropic: {
    href: 'https://console.anthropic.com/settings/keys',
    label: 'Create a Claude API key',
    placeholder: 'sk-ant-…',
  },
}

function credentialErrorMessage(error, providerName) {
  if (error.code === 'invalid_api_key') return `Enter a valid ${providerName} API key.`
  if (error.code === 'provider_key_invalid') {
    return `${providerName} rejected this key. Check that it is active and has API access.`
  }
  if (error.code === 'provider_access_denied') {
    return `${providerName} accepted the key, but it does not have the required API access.`
  }
  if (error.code === 'provider_billing_required') {
    return `${providerName} accepted the key, but the account needs API credit or a higher spending limit.`
  }
  if (error.code === 'provider_rate_limited') {
    return `${providerName} could not verify the key because it is currently rate limited.`
  }
  if (error.code === 'provider_unavailable') {
    return `${providerName} is temporarily unavailable. Try again later.`
  }
  if (error.code === 'credential_service_unavailable') {
    return 'Secure key storage is temporarily unavailable. Try again later.'
  }
  return error.message || `Could not update your ${providerName} API key.`
}

function ProviderKeySettings({
  provider,
  selected = false,
  onCredentialChange,
  onUnauthorized,
}) {
  const [apiKey, setApiKey] = useState('')
  const [action, setAction] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const providerId = String(provider.id)
  const providerName = provider.name || providerId
  const fieldId = `${providerId.replace(/[^a-z0-9_-]/gi, '-')}-api-key`
  const headingId = `${fieldId}-heading`
  const presentation = PROVIDER_LINKS[providerId.toLowerCase()]
  const configured = Boolean(provider.credential?.configured)
  const busy = Boolean(action)

  const handleSave = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    const submittedKey = apiKey.trim()
    if (!submittedKey) {
      setError(`Enter your ${providerName} API key.`)
      return
    }

    setAction('save')
    try {
      const result = await saveAIProviderCredential(providerId, submittedKey)
      const credential = result?.credential || result
      onCredentialChange(providerId, credential)
      setApiKey('')
      setNotice(
        result?.warning?.message
        || `Your ${providerName} API key is configured. API credit will be checked when you use AI.`
      )
    } catch (requestError) {
      if (!onUnauthorized(requestError)) {
        setError(credentialErrorMessage(requestError, providerName))
      }
    } finally {
      setAction('')
    }
  }

  const handleRemove = async () => {
    const selectedWarning = selected
      ? ` ${providerName} is your selected provider, so AI features will be unavailable until you replace the key or select another provider.`
      : ''
    const confirmed = window.confirm(
      `Remove your ${providerName} API key?${selectedWarning}`
    )
    if (!confirmed) return

    setError('')
    setNotice('')
    setAction('delete')
    try {
      await deleteAIProviderCredential(providerId)
      onCredentialChange(providerId, { configured: false })
      setApiKey('')
      setNotice(`Your ${providerName} API key was removed.`)
    } catch (requestError) {
      if (!onUnauthorized(requestError)) {
        setError(credentialErrorMessage(requestError, providerName))
      }
    } finally {
      setAction('')
    }
  }

  return (
    <section
      className={`account-section ai-key-panel${selected ? ' ai-key-panel-selected' : ''}`}
      aria-labelledby={headingId}
    >
      <div className="account-section-heading">
        <div>
          <div className="ai-key-title-row">
            <h2 id={headingId}>{providerName} API key</h2>
            {selected && <span className="ai-selected-badge">Selected</span>}
          </div>
          <p className="account-key-status" aria-live="polite">
            {configured
              ? `Configured ••••${provider.credential.last_four || ''}`
              : 'Not configured'}
          </p>
        </div>
        {configured && (
          <button
            type="button"
            className="account-key-remove"
            onClick={handleRemove}
            disabled={busy}
          >
            {action === 'delete' ? 'Removing…' : 'Remove'}
          </button>
        )}
      </div>

      <p className="account-section-copy">
        Your key is checked with {providerName}, encrypted by Janus Gate, and never shown again.
        {presentation && (
          <>
            {' '}
            <a href={presentation.href} target="_blank" rel="noreferrer">
              {presentation.label}
            </a>
          </>
        )}
      </p>

      <form className="account-key-form" onSubmit={handleSave}>
        <label htmlFor={fieldId}>
          {configured ? `Replace ${providerName} API key` : `Enter ${providerName} API key`}
        </label>
        <input
          id={fieldId}
          name={fieldId}
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={presentation?.placeholder || 'Enter API key'}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !apiKey.trim()}>
          {action === 'save' ? 'Checking key…' : configured ? 'Replace key' : 'Save key'}
        </button>
      </form>

      {error && <p className="account-key-message account-key-error" role="alert">{error}</p>}
      {notice && <p className="account-key-message account-key-success" role="status">{notice}</p>}
    </section>
  )
}

export default ProviderKeySettings

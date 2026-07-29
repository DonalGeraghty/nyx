const PROVIDER_NAMES = {
  openai: 'OpenAI',
  mistral: 'Mistral AI',
  anthropic: 'Claude (Anthropic)',
}

function providerName(provider) {
  if (provider && typeof provider === 'object') {
    return provider.name || PROVIDER_NAMES[provider.id] || provider.id || ''
  }
  return PROVIDER_NAMES[provider] || provider || ''
}

export function aiRequestError(error, purpose, fallbackMessage) {
  const name = providerName(error?.provider)
  const providerSubject = name || 'Your selected AI provider'
  const providerPossessive = name ? name : 'your selected AI provider'

  if (error?.code === 'provider_key_required' || error?.code === 'openai_key_required') {
    return {
      message: `Add an API key for ${providerPossessive} in Account before ${purpose}.`,
      showAccountLink: true,
    }
  }
  if (error?.code === 'provider_key_invalid' || error?.code === 'openai_key_invalid') {
    return {
      message: `The API key for ${providerPossessive} is no longer valid. Replace it in Account.`,
      showAccountLink: true,
    }
  }
  if (error?.code === 'provider_access_denied' || error?.code === 'openai_access_denied') {
    return {
      message: `The API key for ${providerPossessive} does not have the required API access.`,
      showAccountLink: true,
    }
  }
  if (error?.code === 'provider_billing_required' || error?.code === 'openai_billing_required') {
    return {
      message: `The API key for ${providerPossessive} is valid, but the account needs API credit or a higher spending limit.`,
      showAccountLink: false,
    }
  }
  if (error?.code === 'provider_rate_limited' || error?.status === 429) {
    return {
      message: `${providerSubject} is temporarily rate limited. Try again shortly.`,
      showAccountLink: false,
    }
  }
  if (error?.code === 'provider_unavailable') {
    return {
      message: `${providerSubject} is temporarily unavailable. Try again later.`,
      showAccountLink: false,
    }
  }
  if (error?.code === 'credential_service_unavailable') {
    return {
      message: 'Secure key storage is temporarily unavailable. Try again later.',
      showAccountLink: false,
    }
  }
  return {
    message: error?.message || fallbackMessage,
    showAccountLink: false,
  }
}

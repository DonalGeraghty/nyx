import { describe, expect, it } from 'vitest'
import { aiRequestError } from './aiErrors'

describe('aiRequestError', () => {
  it.each([
    [
      'provider_key_invalid',
      'The API key for Mistral AI is no longer valid. Replace it in Account.',
      true,
    ],
    [
      'provider_rate_limited',
      'Mistral AI is temporarily rate limited. Try again shortly.',
      false,
    ],
    [
      'provider_unavailable',
      'Mistral AI is temporarily unavailable. Try again later.',
      false,
    ],
  ])('maps %s with provider metadata', (code, message, showAccountLink) => {
    expect(aiRequestError(
      { code, provider: { id: 'mistral', name: 'Mistral AI' } },
      'continuing',
      'Fallback'
    )).toEqual({ message, showAccountLink })
  })

  it('uses the Claude display name when Anthropic is returned as a provider ID', () => {
    expect(aiRequestError(
      { code: 'provider_key_required', provider: 'anthropic' },
      'analyzing food',
      'Fallback'
    )).toEqual({
      message: 'Add an API key for Claude (Anthropic) in Account before analyzing food.',
      showAccountLink: true,
    })
  })
})

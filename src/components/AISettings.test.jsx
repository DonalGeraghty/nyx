import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AISettings from './AISettings'
import {
  deleteAIProviderCredential,
  getAISettings,
  saveAIProviderCredential,
  saveAISelection,
} from '../services/aiSettings'

const { authState, logoutMock } = vi.hoisted(() => ({
  authState: { user: { email: 'user@example.com' } },
  logoutMock: vi.fn(),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    logout: logoutMock,
  }),
}))

vi.mock('../services/aiSettings', () => ({
  deleteAIProviderCredential: vi.fn(),
  getAISettings: vi.fn(),
  saveAIProviderCredential: vi.fn(),
  saveAISelection: vi.fn(),
}))

function providerSettings() {
  return {
    selection: { provider: 'openai', model: 'gpt-4.1-mini' },
    providers: [
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          {
            id: 'gpt-4.1-mini',
            name: 'GPT-4.1 mini',
            description: 'Fast, efficient meal analysis.',
          },
        ],
        credential: { configured: true, last_four: '1234' },
      },
      {
        id: 'mistral',
        name: 'Mistral AI',
        models: [
          {
            id: 'mistral-small-latest',
            name: 'Mistral Small',
            description: 'A balanced Mistral model.',
          },
        ],
        credential: { configured: false },
      },
      {
        id: 'anthropic',
        name: 'Claude (Anthropic)',
        models: [
          {
            id: 'claude-sonnet-5',
            name: 'Claude Sonnet 5',
            description: 'A balanced Claude model.',
          },
        ],
        credential: { configured: false },
      },
    ],
  }
}

function renderSettings() {
  return render(
    <MemoryRouter>
      <AISettings />
    </MemoryRouter>
  )
}

describe('AISettings', () => {
  beforeEach(() => {
    authState.user = { email: 'user@example.com' }
    vi.clearAllMocks()
    getAISettings.mockResolvedValue(providerSettings())
    saveAIProviderCredential.mockResolvedValue({
      credential: {
        configured: true,
        last_four: '9876',
      },
      warning: null,
    })
    saveAISelection.mockImplementation(async (selection) => selection)
    deleteAIProviderCredential.mockResolvedValue(undefined)
  })

  it('configures Mistral independently and selects its model', async () => {
    renderSettings()

    expect(await screen.findByRole('heading', { name: 'OpenAI API key' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mistral AI API key' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Claude (Anthropic) API key' })).toBeInTheDocument()
    expect(screen.getByText('Configured ••••1234')).toBeInTheDocument()

    const openAIInput = screen.getByLabelText('Replace OpenAI API key')
    const mistralInput = screen.getByLabelText('Enter Mistral AI API key')
    fireEvent.change(openAIInput, { target: { value: 'openai-replacement' } })
    fireEvent.change(mistralInput, { target: { value: 'mistral-secret' } })

    const mistralPanel = screen.getByRole('heading', { name: 'Mistral AI API key' }).closest('section')
    fireEvent.click(within(mistralPanel).getByRole('button', { name: 'Save key' }))

    await waitFor(() => {
      expect(saveAIProviderCredential).toHaveBeenCalledWith('mistral', 'mistral-secret')
    })
    expect(mistralInput).toHaveValue('')
    expect(openAIInput).toHaveValue('openai-replacement')
    expect(within(mistralPanel).getByText('Configured ••••9876')).toBeInTheDocument()

    const mistralOption = screen.getByRole('radio', { name: /Mistral AI/ })
    expect(mistralOption).toBeEnabled()
    fireEvent.click(mistralOption)
    expect(screen.getByLabelText('Model')).toHaveValue('mistral-small-latest')
    fireEvent.click(screen.getByRole('button', { name: 'Save AI profile' }))

    await waitFor(() => {
      expect(saveAISelection).toHaveBeenCalledWith({
        provider: 'mistral',
        model: 'mistral-small-latest',
      })
    })
    expect(await screen.findByText('Your AI provider and model have been updated.')).toBeInTheDocument()
  })

  it('supports the Claude key lifecycle and selects its model independently', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderSettings()

    const claudeHeading = await screen.findByRole('heading', {
      name: 'Claude (Anthropic) API key',
    })
    const claudePanel = claudeHeading.closest('section')
    const claudeInput = within(claudePanel).getByLabelText(
      'Enter Claude (Anthropic) API key'
    )
    expect(claudeInput).toHaveAttribute('placeholder', 'sk-ant-…')
    expect(within(claudePanel).getByRole('link', {
      name: 'Create a Claude API key',
    })).toHaveAttribute('href', 'https://console.anthropic.com/settings/keys')

    fireEvent.change(claudeInput, {
      target: { value: '  sk-ant-api03-user-secret  ' },
    })
    fireEvent.click(within(claudePanel).getByRole('button', { name: 'Save key' }))

    await waitFor(() => {
      expect(saveAIProviderCredential).toHaveBeenCalledWith(
        'anthropic',
        'sk-ant-api03-user-secret'
      )
    })
    expect(claudeInput).toHaveValue('')
    expect(within(claudePanel).getByText('Configured ••••9876')).toBeInTheDocument()
    expect(screen.getByText('Configured ••••1234')).toBeInTheDocument()

    const claudeOption = screen.getByRole('radio', { name: /Claude \(Anthropic\)/ })
    expect(claudeOption).toBeEnabled()
    fireEvent.click(claudeOption)
    expect(screen.getByLabelText('Model')).toHaveValue('claude-sonnet-5')
    fireEvent.click(screen.getByRole('button', { name: 'Save AI profile' }))

    await waitFor(() => {
      expect(saveAISelection).toHaveBeenCalledWith({
        provider: 'anthropic',
        model: 'claude-sonnet-5',
      })
    })

    fireEvent.click(within(claudePanel).getByRole('button', { name: 'Remove' }))
    await waitFor(() => {
      expect(deleteAIProviderCredential).toHaveBeenCalledWith('anthropic')
    })
    expect(within(claudePanel).getByText('Not configured')).toBeInTheDocument()
    expect(screen.getByText('Configured ••••1234')).toBeInTheDocument()
  })

  it('names Claude when Anthropic rejects a submitted key', async () => {
    saveAIProviderCredential.mockRejectedValueOnce({
      code: 'provider_key_invalid',
      status: 422,
    })
    renderSettings()

    const claudePanel = (await screen.findByRole('heading', {
      name: 'Claude (Anthropic) API key',
    })).closest('section')
    fireEvent.change(
      within(claudePanel).getByLabelText('Enter Claude (Anthropic) API key'),
      { target: { value: 'sk-ant-invalid-test-key' } }
    )
    fireEvent.click(within(claudePanel).getByRole('button', { name: 'Save key' }))

    expect(await within(claudePanel).findByRole('alert')).toHaveTextContent(
      'Claude (Anthropic) rejected this key. Check that it is active and has API access.'
    )
    expect(deleteAIProviderCredential).not.toHaveBeenCalled()
  })

  it('configures a key and displays a non-fatal billing warning', async () => {
    saveAIProviderCredential.mockResolvedValueOnce({
      credential: {
        configured: true,
        last_four: '2468',
      },
      warning: {
        code: 'provider_billing_required',
        message: 'The key was saved, but Claude API billing must be enabled.',
      },
    })
    renderSettings()

    const claudePanel = (await screen.findByRole('heading', {
      name: 'Claude (Anthropic) API key',
    })).closest('section')
    fireEvent.change(
      within(claudePanel).getByLabelText('Enter Claude (Anthropic) API key'),
      { target: { value: 'sk-ant-valid-no-credit' } }
    )
    fireEvent.click(within(claudePanel).getByRole('button', { name: 'Save key' }))

    expect(await within(claudePanel).findByRole('status')).toHaveTextContent(
      'The key was saved, but Claude API billing must be enabled.'
    )
    expect(within(claudePanel).getByText('Configured ••••2468')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Claude \(Anthropic\)/ })).toBeEnabled()
  })

  it('removes one provider key without changing the other credential', async () => {
    const settings = providerSettings()
    settings.providers[1].credential = { configured: true, last_four: '5678' }
    getAISettings.mockResolvedValue(settings)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderSettings()

    const mistralHeading = await screen.findByRole('heading', { name: 'Mistral AI API key' })
    const mistralPanel = mistralHeading.closest('section')
    fireEvent.click(within(mistralPanel).getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(deleteAIProviderCredential).toHaveBeenCalledWith('mistral')
    })
    expect(within(mistralPanel).getByText('Not configured')).toBeInTheDocument()
    expect(screen.getByText('Configured ••••1234')).toBeInTheDocument()
  })

  it('preserves each provider saved or last draft model when toggling providers', async () => {
    const settings = providerSettings()
    settings.selection.model = 'gpt-4.1'
    settings.providers[0].models.push({
      id: 'gpt-4.1',
      name: 'GPT-4.1',
      description: 'A higher-capability OpenAI model.',
    })
    settings.providers[1].models.push({
      id: 'mistral-large-latest',
      name: 'Mistral Large',
      description: 'A higher-capability Mistral model.',
    })
    settings.providers[1].credential = { configured: true, last_four: '5678' }
    settings.providers[2].models.push({
      id: 'claude-haiku-4-5-20251001',
      name: 'Claude Haiku 4.5',
      description: 'A faster Claude model.',
    })
    settings.providers[2].credential = { configured: true, last_four: '2468' }
    getAISettings.mockResolvedValue(settings)
    renderSettings()

    const modelSelect = await screen.findByLabelText('Model')
    const openAIOption = screen.getByRole('radio', { name: /OpenAI/ })
    const mistralOption = screen.getByRole('radio', { name: /Mistral AI/ })
    const claudeOption = screen.getByRole('radio', { name: /Claude \(Anthropic\)/ })

    expect(modelSelect).toHaveValue('gpt-4.1')

    fireEvent.click(mistralOption)
    expect(modelSelect).toHaveValue('mistral-small-latest')
    fireEvent.change(modelSelect, { target: { value: 'mistral-large-latest' } })

    fireEvent.click(claudeOption)
    expect(modelSelect).toHaveValue('claude-sonnet-5')
    fireEvent.change(modelSelect, {
      target: { value: 'claude-haiku-4-5-20251001' },
    })

    fireEvent.click(openAIOption)
    expect(modelSelect).toHaveValue('gpt-4.1')
    fireEvent.change(modelSelect, { target: { value: 'gpt-4.1-mini' } })

    fireEvent.click(mistralOption)
    expect(modelSelect).toHaveValue('mistral-large-latest')
    fireEvent.click(claudeOption)
    expect(modelSelect).toHaveValue('claude-haiku-4-5-20251001')
    fireEvent.click(openAIOption)
    expect(modelSelect).toHaveValue('gpt-4.1-mini')
  })

  it('shows a load failure without also reporting that no providers exist', async () => {
    getAISettings.mockRejectedValueOnce(new Error('Could not load AI settings.'))
    renderSettings()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load AI settings.')
    expect(screen.getByText('AI providers could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByText('No AI providers are available.')).not.toBeInTheDocument()
  })

  it('keeps provider controls unavailable for the demo account', () => {
    authState.user = { email: 'demo@nyxai.local', isDemo: true }
    renderSettings()

    expect(screen.getByRole('heading', { name: 'AI profile' })).toBeInTheDocument()
    expect(screen.getByText(/unavailable for the local demo account/)).toBeInTheDocument()
    expect(getAISettings).not.toHaveBeenCalled()
  })
})

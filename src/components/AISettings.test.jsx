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
      configured: true,
      last_four: '9876',
    })
    saveAISelection.mockImplementation(async (selection) => selection)
    deleteAIProviderCredential.mockResolvedValue(undefined)
  })

  it('configures Mistral independently and selects its model', async () => {
    renderSettings()

    expect(await screen.findByRole('heading', { name: 'OpenAI API key' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mistral AI API key' })).toBeInTheDocument()
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
    getAISettings.mockResolvedValue(settings)
    renderSettings()

    const modelSelect = await screen.findByLabelText('Model')
    const openAIOption = screen.getByRole('radio', { name: /OpenAI/ })
    const mistralOption = screen.getByRole('radio', { name: /Mistral AI/ })

    expect(modelSelect).toHaveValue('gpt-4.1')

    fireEvent.click(mistralOption)
    expect(modelSelect).toHaveValue('mistral-small-latest')
    fireEvent.change(modelSelect, { target: { value: 'mistral-large-latest' } })

    fireEvent.click(openAIOption)
    expect(modelSelect).toHaveValue('gpt-4.1')
    fireEvent.change(modelSelect, { target: { value: 'gpt-4.1-mini' } })

    fireEvent.click(mistralOption)
    expect(modelSelect).toHaveValue('mistral-large-latest')
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

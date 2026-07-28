import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NyxAIHome from './NyxAIHome'
import { analyzeMeal } from '../services/nutrition'

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ logout: logoutMock }),
}))

vi.mock('../services/nutrition', () => ({
  analyzeMeal: vi.fn(),
  logMeal: vi.fn(),
}))

vi.mock('../components/Lightfall', () => ({
  default: () => <div data-testid="lightfall" />,
}))

function renderHome() {
  return render(
    <MemoryRouter>
      <NyxAIHome />
    </MemoryRouter>
  )
}

function submitMeal(message) {
  fireEvent.change(screen.getByLabelText('Describe what you ate'), {
    target: { value: message },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
}

describe('NyxAIHome provider errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the analysis body provider-independent and names an unavailable provider', async () => {
    analyzeMeal.mockRejectedValueOnce({
      code: 'provider_unavailable',
      provider: { id: 'mistral', name: 'Mistral AI' },
    })
    renderHome()

    submitMeal('A bowl of porridge')

    expect(analyzeMeal).toHaveBeenCalledWith('A bowl of porridge')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Mistral AI is temporarily unavailable. Try again later.'
    )
    expect(screen.queryByRole('link', { name: 'Open Account' })).not.toBeInTheDocument()
  })

  it('links to Account when the selected provider needs a key', async () => {
    analyzeMeal.mockRejectedValueOnce({
      code: 'provider_key_required',
      provider: 'mistral',
    })
    renderHome()

    submitMeal('An apple')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add an API key for Mistral AI in Account before analyzing food.'
    )
    expect(screen.getByRole('link', { name: 'Open Account' })).toHaveAttribute(
      'href',
      '/account'
    )
  })
})

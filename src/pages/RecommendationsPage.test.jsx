import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RecommendationsPage from './RecommendationsPage'
import { listMeals, recommendMeals } from '../services/nutrition'

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'user@example.com' },
    logout: logoutMock,
  }),
}))

vi.mock('../services/nutrition', () => ({
  listMeals: vi.fn(),
  recommendMeals: vi.fn(),
  toDisplayEntries: (entries) => entries.map((entry) => ({
    datetime: entry.eaten_at,
    calories: entry.total_calories,
    protein: entry.total_protein_g,
  })),
}))

const recommendation = {
  summary: 'Two protein-focused meals fit the remaining budget.',
  meals: [
    {
      name: 'Chicken salad',
      items: [
        { food: 'Chicken breast', portion: '150 g', calories: 250, protein_g: 46 },
      ],
      rationale: 'A lean, high-protein meal.',
      total_calories: 250,
      total_protein_g: 46,
    },
    {
      name: 'Greek yoghurt',
      items: [
        { food: 'Greek yoghurt', portion: '200 g', calories: 150, protein_g: 20 },
      ],
      rationale: 'A light final meal.',
      total_calories: 150,
      total_protein_g: 20,
    },
  ],
  assumptions: [],
  plan_total_calories: 400,
  plan_total_protein_g: 66,
  projected_daily_calories: 1220,
  projected_daily_protein_g: 122,
}

describe('RecommendationsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    listMeals.mockResolvedValue([
      {
        eaten_at: new Date().toISOString(),
        total_calories: 820,
        total_protein_g: 56,
      },
    ])
    recommendMeals.mockResolvedValue(recommendation)
  })

  it('refreshes today totals and submits the selected targets', async () => {
    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('820 kcal')).toBeInTheDocument()
    expect(screen.getByText('56 g')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Daily calorie target'), {
      target: { value: '1800' },
    })
    fireEvent.change(screen.getByLabelText(/Daily protein target/), {
      target: { value: '140' },
    })
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.change(screen.getByLabelText(/Preferences or restrictions/), {
      target: { value: 'No shellfish' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Recommend meals' }))

    await waitFor(() => {
      expect(recommendMeals).toHaveBeenCalledWith({
        current_calories: 820,
        current_protein_g: 56,
        target_calories: 1800,
        target_protein_g: 140,
        meals_remaining: 2,
        preferences: 'No shellfish',
      })
    })
    expect(await screen.findByText('Chicken salad')).toBeInTheDocument()
    expect(screen.getByText('1,220 kcal')).toBeInTheDocument()
    expect(listMeals).toHaveBeenCalledTimes(2)
  })

  it('requires user targets before enabling recommendations', async () => {
    render(
      <MemoryRouter>
        <RecommendationsPage />
      </MemoryRouter>,
    )

    await screen.findByText('820 kcal')
    expect(screen.getByRole('button', { name: 'Recommend meals' })).toBeDisabled()
  })
})

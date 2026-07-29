import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DataPage from './DataPage'
import {
  createMealEntry,
  deleteMeal,
  listMealsForPeriod,
  updateMealEntry,
} from '../services/nutrition'
import { localDateKey } from '../utils/nutrition'

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'user@example.com' },
    logout: logoutMock,
  }),
}))

vi.mock('../services/nutrition', async () => {
  const actual = await vi.importActual('../services/nutrition')
  return {
    ...actual,
    createMealEntry: vi.fn(),
    deleteMeal: vi.fn(),
    listMealsForPeriod: vi.fn(),
    updateMealEntry: vi.fn(),
  }
})

function apiEntry({
  id,
  date,
  food,
  calories,
  protein,
}) {
  return {
    id,
    eaten_at: date.toISOString(),
    items: [{
      food,
      portion: '1 serving',
      calories,
      protein_g: protein,
    }],
    total_calories: calories,
    total_protein_g: protein,
    source_message: null,
  }
}

function periodResponse(entries = [], truncated = false) {
  return {
    entries,
    pagination: { truncated },
  }
}

describe('DataPage weekly history', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 6, 29, 12, 0))
    vi.clearAllMocks()
    listMealsForPeriod.mockResolvedValue(periodResponse())
    createMealEntry.mockResolvedValue({})
    updateMealEntry.mockResolvedValue({})
    deleteMeal.mockResolvedValue()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requests one local week and groups entries under local day headings', async () => {
    listMealsForPeriod.mockResolvedValue(periodResponse([
      apiEntry({
        id: 'lunch',
        date: new Date(2026, 6, 28, 12, 30),
        food: 'Chicken salad',
        calories: 480,
        protein: 42,
      }),
      apiEntry({
        id: 'breakfast',
        date: new Date(2026, 6, 28, 8, 15),
        food: 'Porridge',
        calories: 340,
        protein: 14,
      }),
      apiEntry({
        id: 'monday',
        date: new Date(2026, 6, 27, 19, 0),
        food: 'Salmon',
        calories: 620,
        protein: 46,
      }),
    ]))

    render(
      <MemoryRouter initialEntries={['/data?week=2026-07-27']}>
        <DataPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /Tuesday, 28 July/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Monday, 27 July' })).toBeInTheDocument()
    expect(screen.getByText('3', { selector: '.data-period-summary strong' })).toBeInTheDocument()
    expect(screen.getByText('1,440 kcal')).toBeInTheDocument()
    expect(screen.getByText('102 g', { selector: '.data-period-summary strong' })).toBeInTheDocument()

    const tuesdayTable = screen.getByRole('table', { name: 'Entries for Tuesday, 28 July' })
    expect(within(tuesdayTable).getByText('Chicken salad (1 serving)')).toBeInTheDocument()
    expect(within(tuesdayTable).getByText('Porridge (1 serving)')).toBeInTheDocument()

    const request = listMealsForPeriod.mock.calls[0][0]
    expect(localDateKey(request.start)).toBe('2026-07-27')
    expect(localDateKey(request.end)).toBe('2026-08-03')
  })

  it('moves backward in non-overlapping seven-day periods', async () => {
    render(
      <MemoryRouter initialEntries={['/data']}>
        <DataPage />
      </MemoryRouter>,
    )
    await screen.findByText('No entries in this period')

    fireEvent.click(screen.getByRole('button', { name: /Previous week/ }))

    await waitFor(() => expect(listMealsForPeriod).toHaveBeenCalledTimes(2))
    const previousRequest = listMealsForPeriod.mock.calls[1][0]
    expect(localDateKey(previousRequest.start)).toBe('2026-07-20')
    expect(localDateKey(previousRequest.end)).toBe('2026-07-27')
    expect(screen.getByRole('button', { name: /Next week/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'This week' })).toBeInTheDocument()
  })

  it('returns to the current period and disables future navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/data?week=2026-07-20']}>
        <DataPage />
      </MemoryRouter>,
    )
    await screen.findByText('No entries in this period')

    fireEvent.click(screen.getByRole('button', { name: 'This week' }))

    await waitFor(() => expect(listMealsForPeriod).toHaveBeenCalledTimes(2))
    expect(localDateKey(listMealsForPeriod.mock.calls[1][0].start)).toBe('2026-07-27')
    expect(screen.getByRole('button', { name: /Next week/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'This week' })).not.toBeInTheDocument()
  })

  it('shows an explicit warning when a period response is truncated', async () => {
    listMealsForPeriod.mockResolvedValue(periodResponse([], true))

    render(
      <MemoryRouter>
        <DataPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This period has more than 500 entries'
    )
  })
})

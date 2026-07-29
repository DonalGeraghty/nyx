import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  cacheNutritionEntries,
  clearOfflineAccount,
  deleteMealDraft,
  deleteOutboxItem,
  enqueueNutritionEntry,
  getCachedNutritionEntries,
  listMealDrafts,
  listOutbox,
  saveMealDraft,
  saveOfflineProfile,
} from './offlineStore'

const ACCOUNT_A = 'offline-test-account-a'
const ACCOUNT_B = 'offline-test-account-b'

function entry(id, eatenAt) {
  return {
    id,
    eaten_at: eatenAt,
    items: [],
    total_calories: 100,
    total_protein_g: 5,
  }
}

describe('offline store account boundaries', () => {
  afterEach(async () => {
    await clearOfflineAccount(ACCOUNT_A)
    await clearOfflineAccount(ACCOUNT_B)
  })

  it('never returns another account generation’s nutrition cache', async () => {
    await saveOfflineProfile({
      accountId: ACCOUNT_A,
      email: 'same@example.com',
    })
    await saveOfflineProfile({
      accountId: ACCOUNT_B,
      email: 'same@example.com',
    })
    await cacheNutritionEntries(ACCOUNT_A, [
      entry('a-entry', '2026-07-28T12:00:00.000Z'),
    ])
    await cacheNutritionEntries(ACCOUNT_B, [
      entry('b-entry', '2026-07-28T13:00:00.000Z'),
    ])

    const accountA = await getCachedNutritionEntries(ACCOUNT_A)
    const accountB = await getCachedNutritionEntries(ACCOUNT_B)

    expect(accountA.entries.map((row) => row.id)).toEqual(['a-entry'])
    expect(accountB.entries.map((row) => row.id)).toEqual(['b-entry'])
  })

  it('keeps raw descriptions as drafts and reviewed entries in a separate outbox', async () => {
    const draft = await saveMealDraft(ACCOUNT_A, 'Two eggs and toast')
    const queued = await enqueueNutritionEntry(ACCOUNT_A, {
      items: [{ food: 'Eggs', portion: '2', calories: 180, protein_g: 13 }],
      eatenAt: '2026-07-29T12:00:00.000Z',
      clientRequestId: '149f4f32-8440-42fe-b980-060cabf15c9c',
    })

    expect(await listMealDrafts(ACCOUNT_A)).toMatchObject([
      { id: draft.id, message: 'Two eggs and toast' },
    ])
    expect(await listOutbox(ACCOUNT_A)).toMatchObject([
      {
        id: queued.id,
        type: 'create_nutrition_entry',
        payload: {
          clientRequestId: '149f4f32-8440-42fe-b980-060cabf15c9c',
        },
      },
    ])

    await deleteMealDraft(ACCOUNT_A, draft.id)
    await deleteOutboxItem(ACCOUNT_A, queued.id)
    expect(await listMealDrafts(ACCOUNT_A)).toEqual([])
    expect(await listOutbox(ACCOUNT_A)).toEqual([])
  })

  it('requires a complete cached history before offline export', async () => {
    await cacheNutritionEntries(ACCOUNT_A, [
      entry('partial', '2026-07-28T12:00:00.000Z'),
    ])
    expect(
      (await getCachedNutritionEntries(ACCOUNT_A, { requireComplete: true }))
        .complete
    ).toBe(false)

    await cacheNutritionEntries(
      ACCOUNT_A,
      [entry('complete', '2026-07-29T12:00:00.000Z')],
      { allComplete: true }
    )
    const cached = await getCachedNutritionEntries(ACCOUNT_A, {
      requireComplete: true,
    })
    expect(cached.complete).toBe(true)
    expect(cached.entries.map((row) => row.id)).toEqual(['complete'])
  })
})

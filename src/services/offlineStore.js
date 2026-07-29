import { openDB } from 'idb'

const DATABASE_NAME = 'nyxai-offline'
const DATABASE_VERSION = 1
const ACTIVE_ACCOUNT_KEY = 'nyxai_active_account_id'
let databasePromise

function newId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function database() {
  if (!globalThis.indexedDB) return Promise.resolve(null)
  if (databasePromise) return databasePromise
  databasePromise = openDB(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'accountId' })
      }
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: 'cacheKey' })
        store.createIndex('accountId', 'accountId')
      }
      if (!db.objectStoreNames.contains('drafts')) {
        const store = db.createObjectStore('drafts', { keyPath: 'id' })
        store.createIndex('accountId', 'accountId')
      }
      if (!db.objectStoreNames.contains('outbox')) {
        const store = db.createObjectStore('outbox', { keyPath: 'id' })
        store.createIndex('accountId', 'accountId')
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'accountId' })
      }
    },
  }).catch(() => null)
  return databasePromise
}

function activeAccountId() {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY) || ''
  } catch {
    return ''
  }
}

function setActiveAccountId(accountId) {
  try {
    if (accountId) localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId)
    else localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
  } catch {
    /* IndexedDB remains isolated even if localStorage is unavailable. */
  }
}

export async function saveOfflineProfile({ accountId, email }) {
  if (!accountId || !email) return
  const db = await database()
  if (!db) return
  await db.put('profiles', {
    accountId,
    email,
    lastVerifiedAt: new Date().toISOString(),
  })
  setActiveAccountId(accountId)
}

export async function getActiveOfflineProfile() {
  const accountId = activeAccountId()
  if (!accountId) return null
  const db = await database()
  return db ? (await db.get('profiles', accountId)) || null : null
}

async function deleteAccountRows(db, storeName, accountId) {
  const transaction = db.transaction(storeName, 'readwrite')
  const index = transaction.store.index('accountId')
  let cursor = await index.openCursor(accountId)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await transaction.done
}

export async function clearOfflineAccount(accountId, { preserveProfile = false } = {}) {
  if (!accountId) return
  const db = await database()
  if (db) {
    await Promise.all([
      deleteAccountRows(db, 'entries', accountId),
      deleteAccountRows(db, 'drafts', accountId),
      deleteAccountRows(db, 'outbox', accountId),
      db.delete('metadata', accountId),
      preserveProfile ? Promise.resolve() : db.delete('profiles', accountId),
    ])
  }
  if (!preserveProfile && activeAccountId() === accountId) setActiveAccountId('')
}

export async function cacheNutritionEntries(
  accountId,
  entries,
  { rangeStart = null, rangeEnd = null, allComplete = false } = {}
) {
  if (!accountId) return
  const db = await database()
  if (!db) return
  const transaction = db.transaction(['entries', 'metadata'], 'readwrite')
  const entryStore = transaction.objectStore('entries')
  const index = entryStore.index('accountId')
  let cursor = await index.openCursor(accountId)
  while (cursor) {
    const eatenAt = new Date(cursor.value.eaten_at)
    const replace = allComplete || (
      rangeStart
      && rangeEnd
      && eatenAt >= rangeStart
      && eatenAt < rangeEnd
    )
    if (replace) await cursor.delete()
    cursor = await cursor.continue()
  }
  for (const entry of entries) {
    if (!entry?.id) continue
    await entryStore.put({
      ...entry,
      accountId,
      cacheKey: `${accountId}:${entry.id}`,
    })
  }
  const existing = await transaction.objectStore('metadata').get(accountId)
  const now = new Date().toISOString()
  await transaction.objectStore('metadata').put({
    ...existing,
    accountId,
    lastSyncedAt: now,
    allCompleteAt: allComplete ? now : existing?.allCompleteAt || null,
  })
  await transaction.done
}

export async function upsertCachedNutritionEntry(accountId, entry) {
  if (!accountId || !entry?.id) return
  const db = await database()
  if (!db) return
  await db.put('entries', {
    ...entry,
    accountId,
    cacheKey: `${accountId}:${entry.id}`,
  })
}

export async function deleteCachedNutritionEntry(accountId, entryId) {
  if (!accountId || !entryId) return
  const db = await database()
  if (db) await db.delete('entries', `${accountId}:${entryId}`)
}

export async function getCachedNutritionEntries(
  accountId,
  { start = null, end = null, requireComplete = false } = {}
) {
  if (!accountId) return { entries: [], lastSyncedAt: null, complete: false }
  const db = await database()
  if (!db) return { entries: [], lastSyncedAt: null, complete: false }
  const [rows, metadata] = await Promise.all([
    db.getAllFromIndex('entries', 'accountId', accountId),
    db.get('metadata', accountId),
  ])
  const complete = Boolean(metadata?.allCompleteAt)
  if (requireComplete && !complete) {
    return { entries: [], lastSyncedAt: metadata?.lastSyncedAt || null, complete }
  }
  const entries = rows
    .filter((entry) => {
      const eatenAt = new Date(entry.eaten_at)
      return (!start || eatenAt >= start) && (!end || eatenAt < end)
    })
    .sort((left, right) => new Date(right.eaten_at) - new Date(left.eaten_at))
    .map(({ accountId: _accountId, cacheKey: _cacheKey, ...entry }) => entry)
  return {
    entries,
    lastSyncedAt: metadata?.lastSyncedAt || null,
    complete,
  }
}

export async function saveMealDraft(accountId, message) {
  if (!accountId || !message?.trim()) return null
  const db = await database()
  if (!db) return null
  const draft = {
    id: newId(),
    accountId,
    message: message.trim(),
    createdAt: new Date().toISOString(),
  }
  await db.put('drafts', draft)
  return draft
}

export async function listMealDrafts(accountId) {
  if (!accountId) return []
  const db = await database()
  if (!db) return []
  const drafts = await db.getAllFromIndex('drafts', 'accountId', accountId)
  return drafts.sort((left, right) => (
    new Date(right.createdAt) - new Date(left.createdAt)
  ))
}

export async function deleteMealDraft(accountId, draftId) {
  if (!accountId || !draftId) return
  const db = await database()
  const draft = db ? await db.get('drafts', draftId) : null
  if (draft?.accountId === accountId) await db.delete('drafts', draftId)
}

export async function enqueueNutritionEntry(accountId, payload) {
  if (!accountId) return null
  const db = await database()
  if (!db) return null
  const requestId = payload.clientRequestId || newId()
  const item = {
    id: requestId,
    accountId,
    type: 'create_nutrition_entry',
    payload: { ...payload, clientRequestId: requestId },
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
    lastError: '',
  }
  await db.put('outbox', item)
  window.dispatchEvent(new CustomEvent('nyx-outbox-changed'))
  return item
}

export async function listOutbox(accountId) {
  if (!accountId) return []
  const db = await database()
  if (!db) return []
  const items = await db.getAllFromIndex('outbox', 'accountId', accountId)
  return items.sort((left, right) => (
    new Date(left.createdAt) - new Date(right.createdAt)
  ))
}

export async function markOutboxAttempt(
  accountId,
  item,
  error,
  status = 'pending'
) {
  if (!accountId || item.accountId !== accountId) return
  const db = await database()
  if (!db) return
  await db.put('outbox', {
    ...item,
    status,
    attempts: item.attempts + 1,
    lastError: error?.message || 'Sync failed',
    lastAttemptAt: new Date().toISOString(),
  })
}

export async function deleteOutboxItem(accountId, itemId) {
  if (!accountId || !itemId) return
  const db = await database()
  const item = db ? await db.get('outbox', itemId) : null
  if (item?.accountId === accountId) await db.delete('outbox', itemId)
}

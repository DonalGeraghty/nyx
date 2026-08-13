// Compatibility shims retained while callers are simplified to online-only behavior.
// Nyx AI no longer stores profiles, nutrition history, drafts, or sync queues locally.

export async function saveOfflineProfile() {}
export async function getActiveOfflineProfile() { return null }
export async function clearOfflineAccount() {}
export async function cacheNutritionEntries() {}
export async function upsertCachedNutritionEntry() {}
export async function deleteCachedNutritionEntry() {}
export async function getCachedNutritionEntries() {
  return { entries: [], lastSyncedAt: null, complete: false }
}
export async function saveMealDraft() { return null }
export async function listMealDrafts() { return [] }
export async function deleteMealDraft() {}
export async function enqueueNutritionEntry() { return null }
export async function listOutbox() { return [] }
export async function markOutboxAttempt() {}
export async function deleteOutboxItem() {}

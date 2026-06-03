import { resetForTesting } from '../services/storageService'

const DB_NAME = 'study-app-db'

export async function resetDb(): Promise<void> {
  await resetForTesting()

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete ${DB_NAME}`))
    request.onblocked = () => reject(new Error(`Deleting ${DB_NAME} was blocked`))
  })
}

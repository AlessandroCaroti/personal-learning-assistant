import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { v4 as uuidv4 } from 'uuid'
import type {
  Esame,
  FileRecord,
  FlashcardStats,
  PausedSession,
  QuestionStats,
  QuizSession,
} from '../types'
import { encodeFileRecord } from './sync/serialization'
import {
  SYNC_SCHEMA_VERSION,
  type LocalSyncRecordMetadata,
  type RemoteSyncState,
  type SyncDirtyStore,
  type SyncMetadata,
  type SyncTombstone,
} from './sync/types'

const DB_NAME = 'study-app-db'
const DB_VERSION = 3
const SYNC_METADATA_ID = 'sync'

interface LocalSyncQuestionCounter {
  id: string
  questionStatId: string
  deviceId: string
  timesShown: number
  timesCorrect: number
}

interface StudyAppDB extends DBSchema {
  esami: {
    key: string
    value: Esame
  }
  quizSessions: {
    key: string
    value: QuizSession
    indexes: { 'by-examId': string }
  }
  questionStats: {
    key: string
    value: QuestionStats
    indexes: { 'by-examId': string }
  }
  flashcardStats: {
    key: string
    value: FlashcardStats
    indexes: { 'by-examId': string }
  }
  pausedSessions: {
    key: string
    value: PausedSession
    indexes: { 'by-examId': string }
  }
  syncMetadata: {
    key: string
    value: SyncMetadata
  }
  syncRecordMetadata: {
    key: string
    value: LocalSyncRecordMetadata
    indexes: { 'by-store': SyncDirtyStore }
  }
  syncTombstones: {
    key: string
    value: SyncTombstone
  }
  syncQuestionCounters: {
    key: string
    value: LocalSyncQuestionCounter
    indexes: { 'by-questionStatId': string }
  }
}

type ExamScopedStoreName =
  | 'quizSessions'
  | 'questionStats'
  | 'flashcardStats'
  | 'pausedSessions'
type SyncMetadataTransaction = {
  objectStore(name: 'syncMetadata'): {
    get(key: typeof SYNC_METADATA_ID): Promise<SyncMetadata | undefined>
    put(value: SyncMetadata): Promise<unknown>
  }
}
type SyncDirtyTransaction = SyncMetadataTransaction & {
  objectStore(name: 'syncRecordMetadata'): {
    put(value: LocalSyncRecordMetadata): Promise<unknown>
    delete(key: string): Promise<unknown>
  }
}

let dbPromise: Promise<IDBPDatabase<StudyAppDB>> | null = null

export async function resetForTesting(): Promise<void> {
  const existingDbPromise = dbPromise
  dbPromise = null

  if (!existingDbPromise) {
    return
  }

  const db = await existingDbPromise
  db.close()
}

function getDB(): Promise<IDBPDatabase<StudyAppDB>> {
  dbPromise ??= openDB<StudyAppDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('esami', { keyPath: 'id' })

        const quizSessions = db.createObjectStore('quizSessions', { keyPath: 'id' })
        quizSessions.createIndex('by-examId', 'examId')

        const questionStats = db.createObjectStore('questionStats', { keyPath: 'id' })
        questionStats.createIndex('by-examId', 'examId')

        const flashcardStats = db.createObjectStore('flashcardStats', { keyPath: 'id' })
        flashcardStats.createIndex('by-examId', 'examId')
      }

      if (oldVersion < 2) {
        const pausedSessions = db.createObjectStore('pausedSessions', { keyPath: 'id' })
        pausedSessions.createIndex('by-examId', 'examId')
      }

      if (oldVersion < 3) {
        db.createObjectStore('syncMetadata', { keyPath: 'id' })

        const syncRecordMetadata = db.createObjectStore('syncRecordMetadata', { keyPath: 'id' })
        syncRecordMetadata.createIndex('by-store', 'store')

        db.createObjectStore('syncTombstones', { keyPath: 'id' })

        const syncQuestionCounters = db.createObjectStore('syncQuestionCounters', { keyPath: 'id' })
        syncQuestionCounters.createIndex('by-questionStatId', 'questionStatId')
      }
    },
  })

  return dbPromise
}

function newSyncMetadata(): SyncMetadata {
  return {
    id: SYNC_METADATA_ID,
    deviceId: uuidv4(),
    lastSyncedAt: null,
    lastRemoteRevision: null,
    pendingLocalChanges: false,
    syncSchemaVersion: SYNC_SCHEMA_VERSION,
    account: null,
  }
}

function syncRecordMetadataId(store: SyncDirtyStore, recordId: string): string {
  return `${store}__${recordId}`
}

function syncQuestionCounterId(questionStatId: string, deviceId: string): string {
  return `${questionStatId}__${deviceId}`
}

async function getOrCreateSyncMetadataInTransaction(
  tx: SyncMetadataTransaction,
): Promise<SyncMetadata> {
  const metadataStore = tx.objectStore('syncMetadata')
  const existing = await metadataStore.get(SYNC_METADATA_ID)

  if (existing) {
    return existing
  }

  const metadata = newSyncMetadata()
  await metadataStore.put(metadata)
  return metadata
}

async function markRecordDirtyInTransaction(
  tx: SyncDirtyTransaction,
  store: SyncDirtyStore,
  recordId: string,
  nowIso = new Date().toISOString(),
): Promise<SyncMetadata> {
  const metadata = await getOrCreateSyncMetadataInTransaction(tx)
  const dirtyMetadata: SyncMetadata = {
    ...metadata,
    pendingLocalChanges: true,
    syncSchemaVersion: SYNC_SCHEMA_VERSION,
  }

  await Promise.all([
    tx.objectStore('syncMetadata').put(dirtyMetadata),
    tx.objectStore('syncRecordMetadata').put({
      id: syncRecordMetadataId(store, recordId),
      store,
      recordId,
      updatedAt: nowIso,
      updatedByDeviceId: metadata.deviceId,
    }),
  ])

  return dirtyMetadata
}

export async function getSyncMetadata(): Promise<SyncMetadata> {
  const db = await getDB()
  const tx = db.transaction('syncMetadata', 'readwrite')
  const metadata = await getOrCreateSyncMetadataInTransaction(tx)
  await tx.done
  return metadata
}

async function deleteExamScopedRecordsFromStore(
  db: IDBPDatabase<StudyAppDB>,
  storeName: ExamScopedStoreName,
  examId: string,
): Promise<void> {
  const tx = db.transaction(storeName, 'readwrite')
  const records = await tx.store.index('by-examId').getAll(examId)
  await Promise.all(records.map((record) => tx.store.delete(record.id)))
  await tx.done
}

async function deleteExamScopedRecords(
  storeName: ExamScopedStoreName,
  examId: string,
): Promise<void> {
  const db = await getDB()
  await deleteExamScopedRecordsFromStore(db, storeName, examId)
}

export async function getAllEsami(): Promise<Esame[]> {
  return (await getDB()).getAll('esami')
}

export async function getEsame(id: string): Promise<Esame | undefined> {
  return (await getDB()).get('esami', id)
}

export async function saveEsame(esame: Esame): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['esami', 'syncMetadata', 'syncRecordMetadata'], 'readwrite')

  await tx.objectStore('esami').put(esame)
  await markRecordDirtyInTransaction(tx, 'esami', esame.id)
  await tx.done
}

export async function replaceQuizFileForExam(examId: string, file: FileRecord): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    [
      'esami',
      'quizSessions',
      'questionStats',
      'pausedSessions',
      'syncMetadata',
      'syncRecordMetadata',
      'syncQuestionCounters',
    ],
    'readwrite',
  )

  const examStore = tx.objectStore('esami')
  const quizSessions = tx.objectStore('quizSessions')
  const questionStats = tx.objectStore('questionStats')
  const pausedSessions = tx.objectStore('pausedSessions')
  const syncQuestionCounters = tx.objectStore('syncQuestionCounters')
  const existingExam = await examStore.get(examId)

  if (!existingExam) {
    throw new Error(`Exam ${examId} not found`)
  }

  const [quizRecords, questionRecords] = await Promise.all([
    quizSessions.index('by-examId').getAll(examId),
    questionStats.index('by-examId').getAll(examId),
  ])
  const questionCounterKeys = (
    await Promise.all(
      questionRecords.map((record) =>
        syncQuestionCounters.index('by-questionStatId').getAllKeys(record.id),
      ),
    )
  ).flat()

  await examStore.put({
    ...existingExam,
    files: {
      ...existingExam.files,
      quiz: file,
    },
  })
  await markRecordDirtyInTransaction(tx, 'esami', examId)
  await Promise.all([
    ...quizRecords.map((record) => quizSessions.delete(record.id)),
    ...questionRecords.map((record) => questionStats.delete(record.id)),
    ...questionCounterKeys.map((key) => syncQuestionCounters.delete(key)),
    pausedSessions.delete(`${examId}__quiz`),
  ])
  await tx.done
}

export async function replaceFlashcardFileForExam(
  examId: string,
  file: FileRecord,
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['esami', 'flashcardStats', 'pausedSessions', 'syncMetadata', 'syncRecordMetadata'],
    'readwrite',
  )

  const examStore = tx.objectStore('esami')
  const flashcardStats = tx.objectStore('flashcardStats')
  const pausedSessions = tx.objectStore('pausedSessions')
  const existingExam = await examStore.get(examId)

  if (!existingExam) {
    throw new Error(`Exam ${examId} not found`)
  }

  const statsRecords = await flashcardStats.index('by-examId').getAll(examId)

  await examStore.put({
    ...existingExam,
    files: {
      ...existingExam.files,
      flashcard: file,
    },
  })
  await markRecordDirtyInTransaction(tx, 'esami', examId)
  await Promise.all([
    ...statsRecords.map((record) => flashcardStats.delete(record.id)),
    pausedSessions.delete(`${examId}__flashcard`),
  ])
  await tx.done
}

export async function deleteEsame(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    [
      'esami',
      'quizSessions',
      'questionStats',
      'flashcardStats',
      'pausedSessions',
      'syncMetadata',
      'syncRecordMetadata',
      'syncTombstones',
      'syncQuestionCounters',
    ],
    'readwrite',
  )

  const quizSessions = tx.objectStore('quizSessions')
  const questionStats = tx.objectStore('questionStats')
  const flashcardStats = tx.objectStore('flashcardStats')
  const pausedSessions = tx.objectStore('pausedSessions')
  const syncQuestionCounters = tx.objectStore('syncQuestionCounters')

  const [quizRecords, questionRecords, flashcardRecords, pausedRecords] = await Promise.all([
    quizSessions.index('by-examId').getAll(id),
    questionStats.index('by-examId').getAll(id),
    flashcardStats.index('by-examId').getAll(id),
    pausedSessions.index('by-examId').getAll(id),
  ])
  const questionCounterKeys = (
    await Promise.all(
      questionRecords.map((record) =>
        syncQuestionCounters.index('by-questionStatId').getAllKeys(record.id),
      ),
    )
  ).flat()

  await tx.objectStore('esami').delete(id)
  const metadata = await markRecordDirtyInTransaction(tx, 'esami', id)
  await tx.objectStore('syncRecordMetadata').delete(syncRecordMetadataId('esami', id))
  await tx.objectStore('syncTombstones').put({
    id,
    kind: 'exam',
    deletedAt: new Date().toISOString(),
    deletedByDeviceId: metadata.deviceId,
  })
  await Promise.all([
    ...quizRecords.map((record) => quizSessions.delete(record.id)),
    ...questionRecords.map((record) => questionStats.delete(record.id)),
    ...questionCounterKeys.map((key) => syncQuestionCounters.delete(key)),
    ...flashcardRecords.map((record) => flashcardStats.delete(record.id)),
    ...pausedRecords.map((record) => pausedSessions.delete(record.id)),
  ])
  await tx.done
}

export async function getQuizSessions(examId: string): Promise<QuizSession[]> {
  return (await getDB()).getAllFromIndex('quizSessions', 'by-examId', examId)
}

export async function saveQuizSession(session: QuizSession): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['quizSessions', 'syncMetadata', 'syncRecordMetadata'], 'readwrite')

  await tx.objectStore('quizSessions').put(session)
  await markRecordDirtyInTransaction(tx, 'quizSessions', session.id)
  await tx.done
}

export async function deleteQuizSessionsForExam(examId: string): Promise<void> {
  await deleteExamScopedRecords('quizSessions', examId)
}

export async function getQuestionStats(examId: string): Promise<QuestionStats[]> {
  return (await getDB()).getAllFromIndex('questionStats', 'by-examId', examId)
}

export async function saveQuestionStat(stat: QuestionStats): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['questionStats', 'syncMetadata', 'syncRecordMetadata', 'syncQuestionCounters'],
    'readwrite',
  )
  const questionStats = tx.objectStore('questionStats')
  const previousStat = await questionStats.get(stat.id)
  const metadata = await markRecordDirtyInTransaction(tx, 'questionStats', stat.id)
  const counterStore = tx.objectStore('syncQuestionCounters')
  const counterId = syncQuestionCounterId(stat.id, metadata.deviceId)
  const previousCounter = await counterStore.get(counterId)
  const shownDelta = Math.max(0, stat.timesShown - (previousStat?.timesShown ?? 0))
  const correctDelta = Math.max(0, stat.timesCorrect - (previousStat?.timesCorrect ?? 0))

  await Promise.all([
    questionStats.put(stat),
    counterStore.put({
      id: counterId,
      questionStatId: stat.id,
      deviceId: metadata.deviceId,
      timesShown: (previousCounter?.timesShown ?? 0) + shownDelta,
      timesCorrect: (previousCounter?.timesCorrect ?? 0) + correctDelta,
    }),
  ])
  await tx.done
}

export async function deleteQuestionStatsForExam(examId: string): Promise<void> {
  await deleteExamScopedRecords('questionStats', examId)
}

export async function getFlashcardStats(examId: string): Promise<FlashcardStats[]> {
  return (await getDB()).getAllFromIndex('flashcardStats', 'by-examId', examId)
}

export async function saveFlashcardStat(stat: FlashcardStats): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['flashcardStats', 'syncMetadata', 'syncRecordMetadata'], 'readwrite')

  await tx.objectStore('flashcardStats').put(stat)
  await markRecordDirtyInTransaction(tx, 'flashcardStats', stat.id)
  await tx.done
}

export async function deleteFlashcardStatsForExam(examId: string): Promise<void> {
  await deleteExamScopedRecords('flashcardStats', examId)
}

export async function getPausedSession(id: string): Promise<PausedSession | undefined> {
  return (await getDB()).get('pausedSessions', id)
}

export async function savePausedSession(ps: PausedSession): Promise<void> {
  await (await getDB()).put('pausedSessions', ps)
}

export async function deletePausedSession(id: string): Promise<void> {
  await (await getDB()).delete('pausedSessions', id)
}

export async function getPausedSessionsForExam(examId: string): Promise<PausedSession[]> {
  return (await getDB()).getAllFromIndex('pausedSessions', 'by-examId', examId)
}

export async function exportLocalSyncState(): Promise<{
  state: RemoteSyncState
  revision: string | null
}> {
  const db = await getDB()
  await getSyncMetadata()

  const tx = db.transaction(
    [
      'syncMetadata',
      'esami',
      'quizSessions',
      'questionStats',
      'flashcardStats',
      'syncRecordMetadata',
      'syncTombstones',
      'syncQuestionCounters',
    ],
    'readonly',
  )
  const [metadata, esami, quizSessions, questionStats, flashcardStats, recordMetadata, tombstones, questionCounters] =
    await Promise.all([
      tx.objectStore('syncMetadata').get(SYNC_METADATA_ID),
      tx.objectStore('esami').getAll(),
      tx.objectStore('quizSessions').getAll(),
      tx.objectStore('questionStats').getAll(),
      tx.objectStore('flashcardStats').getAll(),
      tx.objectStore('syncRecordMetadata').getAll(),
      tx.objectStore('syncTombstones').getAll(),
      tx.objectStore('syncQuestionCounters').getAll(),
    ])
  await tx.done
  const syncMetadata = metadata ?? newSyncMetadata()
  const metadataByRecord = new Map(recordMetadata.map((entry) => [entry.id, entry]))
  const questionCountersByStat = new Map<string, LocalSyncQuestionCounter[]>()
  const getRecordMetadata = (store: SyncDirtyStore, recordId: string) =>
    metadataByRecord.get(syncRecordMetadataId(store, recordId))

  for (const counter of questionCounters) {
    const existing = questionCountersByStat.get(counter.questionStatId) ?? []
    existing.push(counter)
    questionCountersByStat.set(counter.questionStatId, existing)
  }

  return {
    state: {
      syncVersion: SYNC_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      writerDeviceId: syncMetadata.deviceId,
      data: {
        esami: esami.map((esame) => {
          const recordMetadataEntry = getRecordMetadata('esami', esame.id)

          return {
            ...esame,
            files: Object.fromEntries(
              Object.entries(esame.files).map(([slot, file]) => [slot, encodeFileRecord(file)]),
            ),
            updatedAt: recordMetadataEntry?.updatedAt ?? esame.createdAt,
            updatedByDeviceId: recordMetadataEntry?.updatedByDeviceId ?? syncMetadata.deviceId,
          }
        }),
        quizSessions: quizSessions.map((session) => ({
          ...session,
          updatedByDeviceId:
            getRecordMetadata('quizSessions', session.id)?.updatedByDeviceId ?? syncMetadata.deviceId,
        })),
        questionStats: questionStats.map(({ timesShown, timesCorrect, ...stat }) => {
          const counters = questionCountersByStat.get(stat.id) ?? [
            {
              id: syncQuestionCounterId(stat.id, syncMetadata.deviceId),
              questionStatId: stat.id,
              deviceId: syncMetadata.deviceId,
              timesShown,
              timesCorrect,
            },
          ]

          return {
            ...stat,
            deviceCounters: Object.fromEntries(
              counters.map((counter) => [
                counter.deviceId,
                {
                  timesShown: counter.timesShown,
                  timesCorrect: counter.timesCorrect,
                },
              ]),
            ),
          }
        }),
        flashcardStats: flashcardStats.map((stat) => ({
          ...stat,
          updatedByDeviceId:
            getRecordMetadata('flashcardStats', stat.id)?.updatedByDeviceId ?? syncMetadata.deviceId,
        })),
      },
      tombstones,
    },
    revision: syncMetadata.lastRemoteRevision,
  }
}

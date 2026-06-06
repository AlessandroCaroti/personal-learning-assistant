import {
  SYNC_SCHEMA_VERSION,
  type MergeResult,
  type RemoteSyncState,
  type SyncConflict,
  type SyncExamRecord,
  type SyncFlashcardStatRecord,
  type SyncQuestionStatRecord,
  type SyncQuizSessionRecord,
  type SyncTombstone,
} from './types'

export function mergeSyncStates(
  local: RemoteSyncState,
  remote: RemoteSyncState,
  writerDeviceId: string,
  nowIso: string,
): MergeResult {
  const conflicts: SyncConflict[] = []
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones)
  const esami = mergeExams(local.data.esami, remote.data.esami, tombstones, conflicts)

  return {
    state: {
      syncVersion: SYNC_SCHEMA_VERSION,
      updatedAt: nowIso,
      writerDeviceId,
      data: {
        esami,
        quizSessions: mergeQuizSessions(local.data.quizSessions, remote.data.quizSessions, conflicts),
        questionStats: mergeQuestionStats(local.data.questionStats, remote.data.questionStats),
        flashcardStats: mergeFlashcardStats(local.data.flashcardStats, remote.data.flashcardStats),
      },
      tombstones,
    },
    conflicts,
  }
}

function mergeQuizSessions(
  local: SyncQuizSessionRecord[],
  remote: SyncQuizSessionRecord[],
  conflicts: SyncConflict[],
): SyncQuizSessionRecord[] {
  const merged = new Map<string, SyncQuizSessionRecord>()

  for (const session of local) {
    merged.set(session.id, session)
  }

  for (const session of remote) {
    const existing = merged.get(session.id)
    if (!existing) {
      merged.set(session.id, session)
      continue
    }

    if (areEqual(existing, session)) {
      continue
    }

    conflicts.push({
      kind: 'duplicate-quiz-session',
      id: session.id,
      localUpdatedAt: existing.date,
      remoteUpdatedAt: session.date,
      localDeviceId: existing.updatedByDeviceId,
      remoteDeviceId: session.updatedByDeviceId,
    })
    merged.set(session.id, newestByIso(existing, session, (value) => value.date))
  }

  return sortById([...merged.values()])
}

function mergeQuestionStats(
  local: SyncQuestionStatRecord[],
  remote: SyncQuestionStatRecord[],
): SyncQuestionStatRecord[] {
  const merged = new Map<string, SyncQuestionStatRecord>()

  for (const stat of [...local, ...remote]) {
    const existing = merged.get(stat.id)
    if (!existing) {
      merged.set(stat.id, { ...stat, deviceCounters: { ...stat.deviceCounters } })
      continue
    }

    merged.set(stat.id, {
      ...existing,
      ...stat,
      deviceCounters: {
        ...existing.deviceCounters,
        ...stat.deviceCounters,
      },
    })
  }

  return sortById([...merged.values()])
}

function mergeFlashcardStats(
  local: SyncFlashcardStatRecord[],
  remote: SyncFlashcardStatRecord[],
): SyncFlashcardStatRecord[] {
  return mergeNewestById(local, remote, (stat) => stat.lastSeen)
}

function mergeTombstones(local: SyncTombstone[], remote: SyncTombstone[]): SyncTombstone[] {
  return mergeNewestById(local, remote, (tombstone) => tombstone.deletedAt)
}

function mergeExams(
  local: SyncExamRecord[],
  remote: SyncExamRecord[],
  tombstones: SyncTombstone[],
  conflicts: SyncConflict[],
): SyncExamRecord[] {
  const examTombstones = new Map(
    tombstones.filter((tombstone) => tombstone.kind === 'exam').map((tombstone) => [tombstone.id, tombstone]),
  )
  const merged = mergeNewestById(local, remote, (exam) => exam.updatedAt)
  const kept: SyncExamRecord[] = []

  for (const exam of merged) {
    const tombstone = examTombstones.get(exam.id)
    if (!tombstone) {
      kept.push(exam)
      continue
    }

    if (compareIso(exam.updatedAt, tombstone.deletedAt) <= 0) {
      continue
    }

    conflicts.push({
      kind: 'exam-delete-vs-update',
      id: exam.id,
      localUpdatedAt: tombstone.deletedAt,
      remoteUpdatedAt: exam.updatedAt,
      localDeviceId: tombstone.deletedByDeviceId,
      remoteDeviceId: exam.updatedByDeviceId,
    })
    kept.push(exam)
  }

  return sortById(kept)
}

function mergeNewestById<T extends { id: string }>(local: T[], remote: T[], getIso: (value: T) => string): T[] {
  const merged = new Map<string, T>()

  for (const value of [...local, ...remote]) {
    const existing = merged.get(value.id)
    merged.set(value.id, existing ? newestByIso(existing, value, getIso) : value)
  }

  return sortById([...merged.values()])
}

function newestByIso<T>(left: T, right: T, getIso: (value: T) => string): T {
  return compareIso(getIso(right), getIso(left)) > 0 ? right : left
}

function compareIso(left: string, right: string): number {
  return left.localeCompare(right)
}

function sortById<T extends { id: string }>(values: T[]): T[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id))
}

function areEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

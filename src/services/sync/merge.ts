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

type MergeSide = 'local' | 'remote'
type OriginRecord<T> = {
  value: T
  side: MergeSide
}

export function mergeSyncStates(
  local: RemoteSyncState,
  remote: RemoteSyncState,
  writerDeviceId: string,
  nowIso: string,
): MergeResult {
  const conflicts: SyncConflict[] = []
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones)
  const esami = mergeExams(local.data.esami, remote.data.esami, local.tombstones, remote.tombstones, conflicts)

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
    mergeQuizSession(merged, session, conflicts)
  }

  for (const session of remote) {
    mergeQuizSession(merged, session, conflicts)
  }

  return sortById([...merged.values()])
}

function mergeQuizSession(
  merged: Map<string, SyncQuizSessionRecord>,
  session: SyncQuizSessionRecord,
  conflicts: SyncConflict[],
): void {
  const existing = merged.get(session.id)
  if (!existing) {
    merged.set(session.id, session)
    return
  }

  if (areEqual(existing, session)) {
    return
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
  localTombstones: SyncTombstone[],
  remoteTombstones: SyncTombstone[],
  conflicts: SyncConflict[],
): SyncExamRecord[] {
  const examTombstones = newestByIdWithOrigin(
    localTombstones.filter((tombstone) => tombstone.kind === 'exam'),
    remoteTombstones.filter((tombstone) => tombstone.kind === 'exam'),
    (tombstone) => tombstone.deletedAt,
  )
  const merged = newestByIdWithOrigin(local, remote, (exam) => exam.updatedAt)
  const kept: SyncExamRecord[] = []

  for (const exam of merged.values()) {
    const tombstone = examTombstones.get(exam.value.id)
    if (!tombstone) {
      kept.push(exam.value)
      continue
    }

    if (compareIso(exam.value.updatedAt, tombstone.value.deletedAt) <= 0) {
      continue
    }

    conflicts.push(examDeleteVsUpdateConflict(exam, tombstone))
    kept.push(exam.value)
  }

  return sortById(kept)
}

function examDeleteVsUpdateConflict(
  exam: OriginRecord<SyncExamRecord>,
  tombstone: OriginRecord<Extract<SyncTombstone, { kind: 'exam' }>>,
): SyncConflict {
  if (exam.side === 'local' && tombstone.side === 'remote') {
    return {
      kind: 'exam-delete-vs-update',
      id: exam.value.id,
      localUpdatedAt: exam.value.updatedAt,
      remoteUpdatedAt: tombstone.value.deletedAt,
      localDeviceId: exam.value.updatedByDeviceId,
      remoteDeviceId: tombstone.value.deletedByDeviceId,
    }
  }

  if (exam.side === 'remote' && tombstone.side === 'local') {
    return {
      kind: 'exam-delete-vs-update',
      id: exam.value.id,
      localUpdatedAt: tombstone.value.deletedAt,
      remoteUpdatedAt: exam.value.updatedAt,
      localDeviceId: tombstone.value.deletedByDeviceId,
      remoteDeviceId: exam.value.updatedByDeviceId,
    }
  }

  return {
    kind: 'exam-delete-vs-update',
    id: exam.value.id,
    localUpdatedAt: tombstone.value.deletedAt,
    remoteUpdatedAt: exam.value.updatedAt,
    localDeviceId: tombstone.value.deletedByDeviceId,
    remoteDeviceId: exam.value.updatedByDeviceId,
  }
}

function mergeNewestById<T extends { id: string }>(local: T[], remote: T[], getIso: (value: T) => string): T[] {
  const merged = new Map<string, T>()

  for (const value of [...local, ...remote]) {
    const existing = merged.get(value.id)
    merged.set(value.id, existing ? newestByIso(existing, value, getIso) : value)
  }

  return sortById([...merged.values()])
}

function newestByIdWithOrigin<T extends { id: string }>(
  local: T[],
  remote: T[],
  getIso: (value: T) => string,
): Map<string, OriginRecord<T>> {
  const merged = new Map<string, OriginRecord<T>>()

  for (const record of local) {
    mergeOriginRecord(merged, { value: record, side: 'local' }, getIso)
  }

  for (const record of remote) {
    mergeOriginRecord(merged, { value: record, side: 'remote' }, getIso)
  }

  return merged
}

function mergeOriginRecord<T extends { id: string }>(
  merged: Map<string, OriginRecord<T>>,
  record: OriginRecord<T>,
  getIso: (value: T) => string,
): void {
  const existing = merged.get(record.value.id)
  merged.set(record.value.id, existing ? newestOriginByIso(existing, record, getIso) : record)
}

function newestOriginByIso<T>(
  left: OriginRecord<T>,
  right: OriginRecord<T>,
  getIso: (value: T) => string,
): OriginRecord<T> {
  return compareIso(getIso(right.value), getIso(left.value)) > 0 ? right : left
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

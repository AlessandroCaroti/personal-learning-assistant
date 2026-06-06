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
type ExamTombstone = Extract<SyncTombstone, { kind: 'exam' }>
type FileTombstone = Extract<SyncTombstone, { kind: 'file' }>

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

  if (areQuizSessionsEqual(existing, session)) {
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
  merged.set(
    session.id,
    newestByStableTieBreak(
      existing,
      session,
      (value) => value.date,
      (value) => value.updatedByDeviceId,
    ),
  )
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
      deviceCounters: mergeDeviceCounters(existing.deviceCounters, stat.deviceCounters),
    })
  }

  return sortById([...merged.values()])
}

function mergeDeviceCounters(
  left: SyncQuestionStatRecord['deviceCounters'],
  right: SyncQuestionStatRecord['deviceCounters'],
): SyncQuestionStatRecord['deviceCounters'] {
  const merged: SyncQuestionStatRecord['deviceCounters'] = { ...left }

  for (const [deviceId, counter] of Object.entries(right)) {
    const existing = merged[deviceId]
    merged[deviceId] = existing
      ? {
          timesShown: Math.max(existing.timesShown, counter.timesShown),
          timesCorrect: Math.max(existing.timesCorrect, counter.timesCorrect),
        }
      : counter
  }

  return merged
}

function mergeFlashcardStats(
  local: SyncFlashcardStatRecord[],
  remote: SyncFlashcardStatRecord[],
): SyncFlashcardStatRecord[] {
  return mergeNewestById(
    local,
    remote,
    (stat) => stat.lastSeen,
    (stat) => stat.updatedByDeviceId,
  )
}

function mergeTombstones(local: SyncTombstone[], remote: SyncTombstone[]): SyncTombstone[] {
  return mergeNewestById(
    local,
    remote,
    (tombstone) => tombstone.deletedAt,
    (tombstone) => tombstone.deletedByDeviceId,
  )
}

function mergeExams(
  local: SyncExamRecord[],
  remote: SyncExamRecord[],
  localTombstones: SyncTombstone[],
  remoteTombstones: SyncTombstone[],
  conflicts: SyncConflict[],
): SyncExamRecord[] {
  const examTombstones = newestByIdWithOrigin(
    localTombstones.filter(isExamTombstone),
    remoteTombstones.filter(isExamTombstone),
    (tombstone) => tombstone.deletedAt,
    (tombstone) => tombstone.deletedByDeviceId,
  )
  const fileTombstones = newestFileTombstonesBySlot(
    localTombstones.filter(isFileTombstone),
    remoteTombstones.filter(isFileTombstone),
  )
  const merged = newestByIdWithOrigin(
    local,
    remote,
    (exam) => exam.updatedAt,
    (exam) => exam.updatedByDeviceId,
  )
  const kept: SyncExamRecord[] = []

  for (const exam of merged.values()) {
    const tombstone = examTombstones.get(exam.value.id)
    if (!tombstone) {
      kept.push(applyFileTombstones(exam, fileTombstones, conflicts))
      continue
    }

    if (compareIso(exam.value.updatedAt, tombstone.value.deletedAt) <= 0) {
      continue
    }

    conflicts.push(examDeleteVsUpdateConflict(exam, tombstone))
    kept.push(applyFileTombstones(exam, fileTombstones, conflicts))
  }

  return sortById(kept)
}

function examDeleteVsUpdateConflict(
  exam: OriginRecord<SyncExamRecord>,
  tombstone: OriginRecord<ExamTombstone>,
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

function newestFileTombstonesBySlot(
  local: FileTombstone[],
  remote: FileTombstone[],
): Map<string, OriginRecord<FileTombstone>> {
  const merged = new Map<string, OriginRecord<FileTombstone>>()

  for (const tombstone of local) {
    mergeFileTombstone(merged, { value: tombstone, side: 'local' })
  }

  for (const tombstone of remote) {
    mergeFileTombstone(merged, { value: tombstone, side: 'remote' })
  }

  return merged
}

function mergeFileTombstone(
  merged: Map<string, OriginRecord<FileTombstone>>,
  tombstone: OriginRecord<FileTombstone>,
): void {
  const key = fileTombstoneKey(tombstone.value)
  const existing = merged.get(key)
  merged.set(
    key,
    existing
      ? newestOriginByStableTieBreak(
          existing,
          tombstone,
          (value) => value.deletedAt,
          (value) => value.deletedByDeviceId,
        )
      : tombstone,
  )
}

function applyFileTombstones(
  exam: OriginRecord<SyncExamRecord>,
  fileTombstones: Map<string, OriginRecord<FileTombstone>>,
  conflicts: SyncConflict[],
): SyncExamRecord {
  let files = exam.value.files

  for (const tombstone of fileTombstones.values()) {
    if (tombstone.value.examId !== exam.value.id || !files[tombstone.value.fileSlot]) {
      continue
    }

    if (compareIso(exam.value.updatedAt, tombstone.value.deletedAt) <= 0) {
      files = { ...files }
      delete files[tombstone.value.fileSlot]
      continue
    }

    conflicts.push(fileDeleteVsUpdateConflict(exam, tombstone))
  }

  return files === exam.value.files ? exam.value : { ...exam.value, files }
}

function fileDeleteVsUpdateConflict(
  exam: OriginRecord<SyncExamRecord>,
  tombstone: OriginRecord<FileTombstone>,
): SyncConflict {
  if (exam.side === 'local' && tombstone.side === 'remote') {
    return {
      kind: 'file-delete-vs-update',
      id: tombstone.value.id,
      localUpdatedAt: exam.value.updatedAt,
      remoteUpdatedAt: tombstone.value.deletedAt,
      localDeviceId: exam.value.updatedByDeviceId,
      remoteDeviceId: tombstone.value.deletedByDeviceId,
    }
  }

  if (exam.side === 'remote' && tombstone.side === 'local') {
    return {
      kind: 'file-delete-vs-update',
      id: tombstone.value.id,
      localUpdatedAt: tombstone.value.deletedAt,
      remoteUpdatedAt: exam.value.updatedAt,
      localDeviceId: tombstone.value.deletedByDeviceId,
      remoteDeviceId: exam.value.updatedByDeviceId,
    }
  }

  return {
    kind: 'file-delete-vs-update',
    id: tombstone.value.id,
    localUpdatedAt: tombstone.value.deletedAt,
    remoteUpdatedAt: exam.value.updatedAt,
    localDeviceId: tombstone.value.deletedByDeviceId,
    remoteDeviceId: exam.value.updatedByDeviceId,
  }
}

function fileTombstoneKey(tombstone: FileTombstone): string {
  return `${tombstone.examId}__${tombstone.fileSlot}`
}

function mergeNewestById<T extends { id: string }>(
  local: T[],
  remote: T[],
  getIso: (value: T) => string,
  getOwnerId: (value: T) => string,
): T[] {
  const merged = new Map<string, T>()

  for (const value of [...local, ...remote]) {
    const existing = merged.get(value.id)
    merged.set(value.id, existing ? newestByStableTieBreak(existing, value, getIso, getOwnerId) : value)
  }

  return sortById([...merged.values()])
}

function newestByIdWithOrigin<T extends { id: string }>(
  local: T[],
  remote: T[],
  getIso: (value: T) => string,
  getOwnerId: (value: T) => string,
): Map<string, OriginRecord<T>> {
  const merged = new Map<string, OriginRecord<T>>()

  for (const record of local) {
    mergeOriginRecord(merged, { value: record, side: 'local' }, getIso, getOwnerId)
  }

  for (const record of remote) {
    mergeOriginRecord(merged, { value: record, side: 'remote' }, getIso, getOwnerId)
  }

  return merged
}

function mergeOriginRecord<T extends { id: string }>(
  merged: Map<string, OriginRecord<T>>,
  record: OriginRecord<T>,
  getIso: (value: T) => string,
  getOwnerId: (value: T) => string,
): void {
  const existing = merged.get(record.value.id)
  merged.set(
    record.value.id,
    existing ? newestOriginByStableTieBreak(existing, record, getIso, getOwnerId) : record,
  )
}

function newestOriginByStableTieBreak<T>(
  left: OriginRecord<T>,
  right: OriginRecord<T>,
  getIso: (value: T) => string,
  getOwnerId: (value: T) => string,
): OriginRecord<T> {
  return compareNewest(right.value, left.value, getIso, getOwnerId) > 0 ? right : left
}

function newestByStableTieBreak<T>(
  left: T,
  right: T,
  getIso: (value: T) => string,
  getOwnerId: (value: T) => string,
): T {
  return compareNewest(right, left, getIso, getOwnerId) > 0 ? right : left
}

function compareNewest<T>(
  left: T,
  right: T,
  getIso: (value: T) => string,
  getOwnerId: (value: T) => string,
): number {
  const timestampComparison = compareIso(getIso(left), getIso(right))
  if (timestampComparison !== 0) {
    return timestampComparison
  }

  const ownerComparison = getOwnerId(left).localeCompare(getOwnerId(right))
  if (ownerComparison !== 0) {
    return ownerComparison
  }

  return canonicalSerialize(left).localeCompare(canonicalSerialize(right))
}

function compareIso(left: string, right: string): number {
  return left.localeCompare(right)
}

function canonicalSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)]),
    )
  }

  return value
}

function sortById<T extends { id: string }>(values: T[]): T[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id))
}

function isExamTombstone(tombstone: SyncTombstone): tombstone is ExamTombstone {
  return tombstone.kind === 'exam'
}

function isFileTombstone(tombstone: SyncTombstone): tombstone is FileTombstone {
  return tombstone.kind === 'file'
}

function areQuizSessionsEqual(left: SyncQuizSessionRecord, right: SyncQuizSessionRecord): boolean {
  return (
    left.id === right.id &&
    left.examId === right.examId &&
    left.date === right.date &&
    left.score === right.score &&
    left.total === right.total &&
    left.totalTime === right.totalTime &&
    left.timeLimitSeconds === right.timeLimitSeconds &&
    left.completedByTimeout === right.completedByTimeout &&
    arraysEqual(left.macroargomenti, right.macroargomenti) &&
    arraysEqual(left.errors, right.errors) &&
    arraysEqual(left.unanswered, right.unanswered) &&
    left.isReview === right.isReview &&
    left.updatedByDeviceId === right.updatedByDeviceId
  )
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

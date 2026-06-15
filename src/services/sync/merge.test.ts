import { describe, expect, it } from 'vitest'
import { mergeSyncStates } from './merge'
import { SYNC_SCHEMA_VERSION, type RemoteSyncState, type SyncExamRecord, type SyncQuizSessionRecord } from './types'

function emptyState(writerDeviceId: string): RemoteSyncState {
  return {
    syncVersion: SYNC_SCHEMA_VERSION,
    updatedAt: '2026-06-01T09:00:00.000Z',
    writerDeviceId,
    data: {
      esami: [],
      quizSessions: [],
      questionStats: [],
      flashcardStats: [],
    },
    tombstones: [],
  }
}

function examRecord(overrides: Partial<SyncExamRecord> = {}): SyncExamRecord {
  return {
    id: 'exam-1',
    name: 'Exam 1',
    createdAt: '2026-06-01T08:00:00.000Z',
    files: {},
    attachments: [],
    examDates: [],
    updatedAt: '2026-06-01T09:00:00.000Z',
    updatedByDeviceId: 'device-1',
    ...overrides,
  }
}

function encodedFileRecord(name: string) {
  return {
    name,
    type: 'application/json',
    dataBase64: 'e30=',
  }
}

function quizSession(overrides: Partial<SyncQuizSessionRecord> = {}): SyncQuizSessionRecord {
  return {
    id: 'session-1',
    examId: 'exam-1',
    date: '2026-06-01T10:00:00.000Z',
    score: 1,
    total: 2,
    totalTime: 30,
    timeLimitSeconds: null,
    completedByTimeout: false,
    macroargomenti: [],
    errors: [],
    unanswered: [],
    isReview: false,
    updatedByDeviceId: 'device-1',
    ...overrides,
  }
}

describe('mergeSyncStates', () => {
  it('unions quiz sessions by id', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.quizSessions.push(quizSession({ id: 'session-local', updatedByDeviceId: 'local-device' }))
    remote.data.quizSessions.push(
      quizSession({
        id: 'session-remote',
        date: '2026-06-01T11:00:00.000Z',
        score: 2,
        totalTime: 25,
        updatedByDeviceId: 'remote-device',
      }),
    )

    const result = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(result.state.data.quizSessions.map((session) => session.id)).toEqual([
      'session-local',
      'session-remote',
    ])
    expect(result.conflicts).toEqual([])
  })

  it('detects duplicate unequal quiz session ids within one input', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.quizSessions.push(
      quizSession({
        id: 'session-1',
        date: '2026-06-01T10:00:00.000Z',
        score: 1,
        updatedByDeviceId: 'local-device-a',
      }),
      quizSession({
        id: 'session-1',
        date: '2026-06-01T11:00:00.000Z',
        score: 2,
        updatedByDeviceId: 'local-device-b',
      }),
    )

    const result = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(result.state.data.quizSessions).toEqual([
      quizSession({
        id: 'session-1',
        date: '2026-06-01T11:00:00.000Z',
        score: 2,
        updatedByDeviceId: 'local-device-b',
      }),
    ])
    expect(result.conflicts).toEqual([
      {
        kind: 'duplicate-quiz-session',
        id: 'session-1',
        localUpdatedAt: '2026-06-01T10:00:00.000Z',
        remoteUpdatedAt: '2026-06-01T11:00:00.000Z',
        localDeviceId: 'local-device-a',
        remoteDeviceId: 'local-device-b',
      },
    ])
  })

  it('converges duplicate quiz session winners by stable device id independent of merge order', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.quizSessions.push(
      quizSession({
        id: 'session-1',
        date: '2026-06-01T10:00:00.000Z',
        score: 1,
        updatedByDeviceId: 'device-a',
      }),
    )
    remote.data.quizSessions.push(
      quizSession({
        id: 'session-1',
        date: '2026-06-01T10:00:00.000Z',
        score: 2,
        updatedByDeviceId: 'device-z',
      }),
    )

    const localFirst = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')
    const remoteFirst = mergeSyncStates(remote, local, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(localFirst.state.data.quizSessions).toEqual(remoteFirst.state.data.quizSessions)
    expect(localFirst.conflicts).toEqual(remoteFirst.conflicts)
    expect(localFirst.state.data.quizSessions).toEqual([
      quizSession({
        id: 'session-1',
        date: '2026-06-01T10:00:00.000Z',
        score: 2,
        updatedByDeviceId: 'device-z',
      }),
    ])
    expect(localFirst.conflicts).toEqual([
      {
        kind: 'duplicate-quiz-session',
        id: 'session-1',
        localUpdatedAt: '2026-06-01T10:00:00.000Z',
        remoteUpdatedAt: '2026-06-01T10:00:00.000Z',
        localDeviceId: 'device-a',
        remoteDeviceId: 'device-z',
      },
    ])
  })

  it('merges question stats by preserving per-device counters and aggregate totals', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.questionStats.push({
      id: 'exam-1__q1',
      examId: 'exam-1',
      questionId: 'q1',
      deviceCounters: {
        'local-device': { timesShown: 2, timesCorrect: 1 },
      },
    })
    remote.data.questionStats.push({
      id: 'exam-1__q1',
      examId: 'exam-1',
      questionId: 'q1',
      deviceCounters: {
        'remote-device': { timesShown: 3, timesCorrect: 2 },
      },
    })

    const result = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(result.state.data.questionStats).toEqual([
      {
        id: 'exam-1__q1',
        examId: 'exam-1',
        questionId: 'q1',
        deviceCounters: {
          'local-device': { timesShown: 2, timesCorrect: 1 },
          'remote-device': { timesShown: 3, timesCorrect: 2 },
        },
      },
    ])
    expect(result.conflicts).toEqual([])
  })

  it('keeps maximum question stat counters when the same device has stale remote data', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.questionStats.push({
      id: 'exam-1__q1',
      examId: 'exam-1',
      questionId: 'q1',
      deviceCounters: {
        'shared-device': { timesShown: 5, timesCorrect: 4 },
      },
    })
    remote.data.questionStats.push({
      id: 'exam-1__q1',
      examId: 'exam-1',
      questionId: 'q1',
      deviceCounters: {
        'shared-device': { timesShown: 3, timesCorrect: 2 },
      },
    })

    const result = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(result.state.data.questionStats).toEqual([
      {
        id: 'exam-1__q1',
        examId: 'exam-1',
        questionId: 'q1',
        deviceCounters: {
          'shared-device': { timesShown: 5, timesCorrect: 4 },
        },
      },
    ])
    expect(result.conflicts).toEqual([])
  })

  it('keeps the newest flashcard stat by lastSeen', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.flashcardStats.push({
      id: 'exam-1__f1',
      examId: 'exam-1',
      cardId: 'f1',
      lastEval: 'No',
      lastSeen: '2026-06-01T10:00:00.000Z',
      updatedByDeviceId: 'local-device',
    })
    remote.data.flashcardStats.push({
      id: 'exam-1__f1',
      examId: 'exam-1',
      cardId: 'f1',
      lastEval: 'Sì',
      lastSeen: '2026-06-01T11:00:00.000Z',
      updatedByDeviceId: 'remote-device',
    })

    const result = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(result.state.data.flashcardStats).toEqual([
      {
        id: 'exam-1__f1',
        examId: 'exam-1',
        cardId: 'f1',
        lastEval: 'Sì',
        lastSeen: '2026-06-01T11:00:00.000Z',
        updatedByDeviceId: 'remote-device',
      },
    ])
    expect(result.conflicts).toEqual([])
  })

  it('converges flashcard stat ties by stable device id independent of merge order', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.flashcardStats.push({
      id: 'exam-1__f1',
      examId: 'exam-1',
      cardId: 'f1',
      lastEval: 'No',
      lastSeen: '2026-06-01T10:00:00.000Z',
      updatedByDeviceId: 'device-a',
    })
    remote.data.flashcardStats.push({
      id: 'exam-1__f1',
      examId: 'exam-1',
      cardId: 'f1',
      lastEval: 'Sì',
      lastSeen: '2026-06-01T10:00:00.000Z',
      updatedByDeviceId: 'device-z',
    })

    const localFirst = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')
    const remoteFirst = mergeSyncStates(remote, local, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(localFirst.state.data.flashcardStats).toEqual(remoteFirst.state.data.flashcardStats)
    expect(localFirst.state.data.flashcardStats).toEqual([
      {
        id: 'exam-1__f1',
        examId: 'exam-1',
        cardId: 'f1',
        lastEval: 'Sì',
        lastSeen: '2026-06-01T10:00:00.000Z',
        updatedByDeviceId: 'device-z',
      },
    ])
    expect(localFirst.conflicts).toEqual([])
    expect(remoteFirst.conflicts).toEqual([])
  })

  it('marks delete versus newer exam update as a conflict', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.tombstones.push({
      kind: 'exam',
      id: 'exam-1',
      deletedAt: '2026-06-01T10:00:00.000Z',
      deletedByDeviceId: 'local-device',
    })
    remote.data.esami.push(
      examRecord({
        id: 'exam-1',
        updatedAt: '2026-06-01T11:00:00.000Z',
        updatedByDeviceId: 'remote-device',
      }),
    )

    const result = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(result.state.data.esami.map((exam) => exam.id)).toEqual(['exam-1'])
    expect(result.conflicts).toEqual([
      {
        kind: 'exam-delete-vs-update',
        id: 'exam-1',
        localUpdatedAt: '2026-06-01T10:00:00.000Z',
        remoteUpdatedAt: '2026-06-01T11:00:00.000Z',
        localDeviceId: 'local-device',
        remoteDeviceId: 'remote-device',
      },
    ])
  })

  it('converges exam ties by stable device id independent of merge order', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.esami.push(
      examRecord({
        id: 'exam-1',
        name: 'Local exam',
        updatedAt: '2026-06-01T10:00:00.000Z',
        updatedByDeviceId: 'device-a',
      }),
    )
    remote.data.esami.push(
      examRecord({
        id: 'exam-1',
        name: 'Remote exam',
        updatedAt: '2026-06-01T10:00:00.000Z',
        updatedByDeviceId: 'device-z',
      }),
    )

    const localFirst = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')
    const remoteFirst = mergeSyncStates(remote, local, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(localFirst.state.data.esami).toEqual(remoteFirst.state.data.esami)
    expect(localFirst.state.data.esami).toEqual([
      examRecord({
        id: 'exam-1',
        name: 'Remote exam',
        updatedAt: '2026-06-01T10:00:00.000Z',
        updatedByDeviceId: 'device-z',
      }),
    ])
    expect(localFirst.conflicts).toEqual([])
    expect(remoteFirst.conflicts).toEqual([])
  })

  it('preserves exam dates when a newer legacy exam record omits the field', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.esami.push(
      examRecord({
        id: 'exam-1',
        name: 'Local exam',
        examDates: [
          {
            id: 'written',
            date: '2026-07-15',
            createdAt: '2026-06-14T10:00:00.000Z',
            label: 'Scritto',
          },
        ],
        updatedAt: '2026-06-01T10:00:00.000Z',
        updatedByDeviceId: 'device-a',
      }),
    )
    remote.data.esami.push({
      ...examRecord({
        id: 'exam-1',
        name: 'Legacy remote exam',
        updatedAt: '2026-06-01T11:00:00.000Z',
        updatedByDeviceId: 'device-z',
      }),
      examDates: undefined,
    } as SyncExamRecord)

    const result = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(result.state.data.esami).toEqual([
      examRecord({
        id: 'exam-1',
        name: 'Legacy remote exam',
        examDates: [
          {
            id: 'written',
            date: '2026-07-15',
            createdAt: '2026-06-14T10:00:00.000Z',
            label: 'Scritto',
          },
        ],
        updatedAt: '2026-06-01T11:00:00.000Z',
        updatedByDeviceId: 'device-z',
      }),
    ])
    expect(result.conflicts).toEqual([])
  })

  it('keeps an explicit empty examDates array when the newer record clears dates', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.esami.push(
      examRecord({
        id: 'exam-1',
        name: 'Local exam',
        examDates: [
          {
            id: 'written',
            date: '2026-07-15',
            createdAt: '2026-06-14T10:00:00.000Z',
            label: 'Scritto',
          },
        ],
        updatedAt: '2026-06-01T10:00:00.000Z',
        updatedByDeviceId: 'device-a',
      }),
    )
    remote.data.esami.push(
      examRecord({
        id: 'exam-1',
        name: 'Remote cleared exam',
        examDates: [],
        updatedAt: '2026-06-01T11:00:00.000Z',
        updatedByDeviceId: 'device-z',
      }),
    )

    const result = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(result.state.data.esami).toEqual([
      examRecord({
        id: 'exam-1',
        name: 'Remote cleared exam',
        examDates: [],
        updatedAt: '2026-06-01T11:00:00.000Z',
        updatedByDeviceId: 'device-z',
      }),
    ])
    expect(result.conflicts).toEqual([])
  })

  it('converges exam tombstone ties by stable device id independent of merge order', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.tombstones.push({
      kind: 'exam',
      id: 'exam-1',
      deletedAt: '2026-06-01T10:00:00.000Z',
      deletedByDeviceId: 'device-a',
    })
    remote.tombstones.push({
      kind: 'exam',
      id: 'exam-1',
      deletedAt: '2026-06-01T10:00:00.000Z',
      deletedByDeviceId: 'device-z',
    })

    const localFirst = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')
    const remoteFirst = mergeSyncStates(remote, local, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(localFirst.state.tombstones).toEqual(remoteFirst.state.tombstones)
    expect(localFirst.state.tombstones).toEqual([
      {
        kind: 'exam',
        id: 'exam-1',
        deletedAt: '2026-06-01T10:00:00.000Z',
        deletedByDeviceId: 'device-z',
      },
    ])
    expect(localFirst.conflicts).toEqual([])
    expect(remoteFirst.conflicts).toEqual([])
  })

  it('marks local newer exam update versus remote delete with accurate conflict provenance', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.esami.push(
      examRecord({
        id: 'exam-1',
        updatedAt: '2026-06-01T11:00:00.000Z',
        updatedByDeviceId: 'local-device',
      }),
    )
    remote.tombstones.push({
      kind: 'exam',
      id: 'exam-1',
      deletedAt: '2026-06-01T10:00:00.000Z',
      deletedByDeviceId: 'remote-device',
    })

    const result = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(result.state.data.esami.map((exam) => exam.id)).toEqual(['exam-1'])
    expect(result.conflicts).toEqual([
      {
        kind: 'exam-delete-vs-update',
        id: 'exam-1',
        localUpdatedAt: '2026-06-01T11:00:00.000Z',
        remoteUpdatedAt: '2026-06-01T10:00:00.000Z',
        localDeviceId: 'local-device',
        remoteDeviceId: 'remote-device',
      },
    ])
  })

  it('removes exam file slots deleted by newer file tombstones', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.esami.push(
      examRecord({
        id: 'exam-1',
        files: {
          quiz: encodedFileRecord('quiz.json'),
          flashcard: encodedFileRecord('flashcard.json'),
        },
        updatedAt: '2026-06-01T10:00:00.000Z',
        updatedByDeviceId: 'local-device',
      }),
    )
    remote.tombstones.push({
      kind: 'file',
      id: 'exam-1__quiz',
      examId: 'exam-1',
      fileSlot: 'quiz',
      deletedAt: '2026-06-01T11:00:00.000Z',
      deletedByDeviceId: 'remote-device',
    })

    const result = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(result.state.data.esami).toEqual([
      examRecord({
        id: 'exam-1',
        files: {
          flashcard: encodedFileRecord('flashcard.json'),
        },
        updatedAt: '2026-06-01T10:00:00.000Z',
        updatedByDeviceId: 'local-device',
      }),
    ])
    expect(result.conflicts).toEqual([])
  })

  it('converges file tombstone ties by stable device id independent of merge order', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.esami.push(
      examRecord({
        id: 'exam-1',
        files: {
          quiz: encodedFileRecord('quiz.json'),
        },
        updatedAt: '2026-06-01T09:00:00.000Z',
        updatedByDeviceId: 'local-device',
      }),
    )
    local.tombstones.push({
      kind: 'file',
      id: 'exam-1__quiz',
      examId: 'exam-1',
      fileSlot: 'quiz',
      deletedAt: '2026-06-01T10:00:00.000Z',
      deletedByDeviceId: 'device-a',
    })
    remote.tombstones.push({
      kind: 'file',
      id: 'exam-1__quiz',
      examId: 'exam-1',
      fileSlot: 'quiz',
      deletedAt: '2026-06-01T10:00:00.000Z',
      deletedByDeviceId: 'device-z',
    })

    const localFirst = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')
    const remoteFirst = mergeSyncStates(remote, local, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(localFirst.state.tombstones).toEqual(remoteFirst.state.tombstones)
    expect(localFirst.state.data.esami).toEqual(remoteFirst.state.data.esami)
    expect(localFirst.state.tombstones).toEqual([
      {
        kind: 'file',
        id: 'exam-1__quiz',
        examId: 'exam-1',
        fileSlot: 'quiz',
        deletedAt: '2026-06-01T10:00:00.000Z',
        deletedByDeviceId: 'device-z',
      },
    ])
    expect(localFirst.state.data.esami[0].files.quiz).toBeUndefined()
    expect(localFirst.conflicts).toEqual([])
    expect(remoteFirst.conflicts).toEqual([])
  })

  it('marks local newer file update versus remote file delete with accurate conflict provenance', () => {
    const local = emptyState('local-device')
    const remote = emptyState('remote-device')
    local.data.esami.push(
      examRecord({
        id: 'exam-1',
        files: {
          quiz: encodedFileRecord('quiz.json'),
        },
        updatedAt: '2026-06-01T11:00:00.000Z',
        updatedByDeviceId: 'local-device',
      }),
    )
    remote.tombstones.push({
      kind: 'file',
      id: 'exam-1__quiz',
      examId: 'exam-1',
      fileSlot: 'quiz',
      deletedAt: '2026-06-01T10:00:00.000Z',
      deletedByDeviceId: 'remote-device',
    })

    const result = mergeSyncStates(local, remote, 'writer-device', '2026-06-01T12:00:00.000Z')

    expect(result.state.data.esami.map((exam) => exam.files.quiz?.name)).toEqual(['quiz.json'])
    expect(result.conflicts).toEqual([
      {
        kind: 'file-delete-vs-update',
        id: 'exam-1__quiz',
        localUpdatedAt: '2026-06-01T11:00:00.000Z',
        remoteUpdatedAt: '2026-06-01T10:00:00.000Z',
        localDeviceId: 'local-device',
        remoteDeviceId: 'remote-device',
      },
    ])
  })
})

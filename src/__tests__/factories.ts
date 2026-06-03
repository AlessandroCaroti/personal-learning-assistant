import type {
  Esame,
  FlashCard,
  FlashcardFile,
  PausedSession,
  QuizDomanda,
  QuizFile,
  QuizSession,
} from '../types'

const DEFAULT_DATE = '2026-01-01T00:00:00.000Z'

const encodeJson = (value: unknown): ArrayBuffer => {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

export const makeQuizDomanda = (overrides: Partial<QuizDomanda> = {}): QuizDomanda => ({
  id: 'q1',
  macroargomenti: ['Macroargomento 1'],
  tipo: 'multipla',
  testo: 'Qual è la risposta corretta?',
  opzioni: ['Risposta corretta', 'Distrattore A', 'Distrattore B'],
  risposta_corretta: 'Risposta corretta',
  spiegazione: 'Spiegazione della risposta.',
  ...overrides,
})

export const makeVeroFalso = (overrides: Partial<QuizDomanda> = {}): QuizDomanda => {
  const { opzioni: _opzioni, ...rest } = overrides
  const base: QuizDomanda = {
    id: 'vf1',
    macroargomenti: ['Macroargomento 1'],
    tipo: 'vero_falso',
    testo: 'Questa affermazione è vera.',
    risposta_corretta: 'Vero',
    spiegazione: 'Spiegazione della risposta.',
  }

  return {
    ...base,
    ...rest,
    tipo: 'vero_falso',
  }
}

export const makeQuizFile = (domande: QuizDomanda[] = [makeQuizDomanda()]): QuizFile => ({
  esame: 'Esame di Test',
  domande,
})

export const makeFlashCard = (overrides: Partial<FlashCard> = {}): FlashCard => ({
  id: 'f1',
  macroargomenti: ['Macroargomento 1'],
  fronte: 'Domanda della flashcard',
  retro: 'Risposta della flashcard',
  ...overrides,
})

export const makeFlashcardFile = (carte: FlashCard[] = [makeFlashCard()]): FlashcardFile => ({
  esame: 'Esame di Test',
  carte,
})

export const makeEsame = (overrides: Partial<Esame> = {}): Esame => ({
  id: 'exam-1',
  name: 'Esame di Test',
  createdAt: DEFAULT_DATE,
  files: {},
  ...overrides,
})

export const makeEsameWithQuiz = (
  domande: QuizDomanda[] = [makeQuizDomanda()],
): Esame =>
  makeEsame({
    files: {
      quiz: {
        name: 'quiz.json',
        type: 'application/json',
        data: encodeJson(makeQuizFile(domande)),
      },
    },
  })

export const makeEsameWithFlashcard = (
  carte: FlashCard[] = [makeFlashCard()],
): Esame =>
  makeEsame({
    files: {
      flashcard: {
        name: 'flashcard.json',
        type: 'application/json',
        data: encodeJson(makeFlashcardFile(carte)),
      },
    },
  })

export const makeQuizSession = (overrides: Partial<QuizSession> = {}): QuizSession => ({
  id: 'quiz-session-1',
  examId: 'exam-1',
  date: DEFAULT_DATE,
  score: 1,
  total: 1,
  totalTime: 60,
  timeLimitSeconds: null,
  completedByTimeout: false,
  macroargomenti: ['Macroargomento 1'],
  errors: [],
  unanswered: [],
  isReview: false,
  ...overrides,
})

export const makePausedQuiz = (overrides: Partial<PausedSession> = {}): PausedSession => ({
  ...{
    id: 'exam-1__quiz',
    examId: 'exam-1',
    mode: 'quiz',
    savedAt: DEFAULT_DATE,
    elapsedSeconds: 30,
    timeLimitSeconds: null,
    macroargomenti: ['Macroargomento 1'],
    questionIds: ['q1'],
    currentQuestionIndex: 0,
    confirmedAnswers: {},
    isReview: false,
  },
  ...overrides,
  mode: 'quiz',
})

export const makePausedFlash = (overrides: Partial<PausedSession> = {}): PausedSession => ({
  ...{
    id: 'exam-1__flashcard',
    examId: 'exam-1',
    mode: 'flashcard',
    savedAt: DEFAULT_DATE,
    elapsedSeconds: 30,
    timeLimitSeconds: null,
    macroargomenti: ['Macroargomento 1'],
    cardIds: ['f1'],
    currentCardIndex: 0,
    cardEvals: {},
    reviewQueue: [],
  },
  ...overrides,
  mode: 'flashcard',
})

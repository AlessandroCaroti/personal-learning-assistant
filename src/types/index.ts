export interface ExamDate {
  id: string
  date: string
  label?: string
  notes?: string
  createdAt: string
}

export interface Esame {
  id: string
  name: string
  createdAt: string
  files: {
    riassunto?: FileRecord
    quiz?: FileRecord
    flashcard?: FileRecord
  }
  attachments?: ExamAttachment[]
  examDates?: ExamDate[]
}

export interface FileRecord {
  name: string
  type: string
  data: ArrayBuffer
}

export interface ExamAttachment extends FileRecord {
  id: string
  createdAt: string
}

export interface QuizSession {
  id: string
  examId: string
  date: string
  score: number
  total: number
  totalTime: number
  timeLimitSeconds: number | null
  completedByTimeout: boolean
  macroargomenti: string[]
  errors: string[]
  unanswered: string[]
  isReview: boolean
}

export interface QuestionStats {
  id: string
  examId: string
  questionId: string
  timesShown: number
  timesCorrect: number
}

export interface FlashcardStats {
  id: string
  examId: string
  cardId: string
  lastEval: 'Sì' | 'In parte' | 'No' | 'Non risposta'
  lastSeen: string
}

export type CardEval = 'Sì' | 'In parte' | 'No'

export interface PausedSession {
  id: string
  examId: string
  mode: 'quiz' | 'flashcard'
  savedAt: string
  elapsedSeconds: number
  timeLimitSeconds: number | null
  macroargomenti: string[]
  questionIds?: string[]
  currentQuestionIndex?: number
  confirmedAnswers?: Record<string, string>
  isReview?: boolean
  cardIds?: string[]
  currentCardIndex?: number
  cardEvals?: Record<string, CardEval>
  reviewQueue?: string[]
}

export interface QuizDomanda {
  id: string
  macroargomenti: string[]
  tipo: 'multipla' | 'vero_falso'
  testo: string
  opzioni?: string[]
  risposta_corretta: string
  spiegazione: string
}

export interface QuizFile {
  esame: string
  domande: QuizDomanda[]
}

export interface FlashCard {
  id: string
  macroargomenti: string[]
  fronte: string
  retro: string
}

export interface FlashcardFile {
  esame: string
  carte: FlashCard[]
}

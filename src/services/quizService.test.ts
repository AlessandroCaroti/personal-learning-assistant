import { describe, expect, it } from 'vitest'
import {
  makeFlashCard,
  makeFlashcardFile,
  makeQuizDomanda,
  makeQuizFile,
  makeVeroFalso,
} from '../__tests__/factories'
import type { FlashcardFile, QuizDomanda, QuizFile } from '../types'
import {
  buildSessionQuestions,
  filterDomande,
  validateFlashcardFile,
  validateQuizFile,
} from './quizService'

const multiplaLimiti = makeQuizDomanda({
  id: 'q1',
  macroargomenti: ['Limiti'],
  testo: 'Quanto fa 2 + 2?',
  opzioni: ['3', '4', '5'],
  risposta_corretta: '4',
  spiegazione: '2 + 2 = 4.',
})

const veroFalsoDerivate = makeVeroFalso({
  id: 'q2',
  macroargomenti: ['Derivate'],
  testo: 'La derivata di una costante e zero.',
  risposta_corretta: 'Vero',
  spiegazione: 'Le costanti hanno derivata nulla.',
})

const multiplaLimitiContinuita = makeQuizDomanda({
  id: 'q3',
  macroargomenti: ['Limiti', 'Continuita'],
  testo: 'Una funzione continua ammette limite uguale al valore?',
  opzioni: ['Si', 'No'],
  risposta_corretta: 'Si',
  spiegazione: 'Per definizione di continuita.',
})

const validQuiz: QuizFile = makeQuizFile([
  multiplaLimiti,
  veroFalsoDerivate,
  multiplaLimitiContinuita,
])

const validFlashcards: FlashcardFile = makeFlashcardFile([
  makeFlashCard({
    id: 'c1',
    macroargomenti: ['Limiti'],
    fronte: 'Definizione di limite',
    retro: 'Valore a cui tende una funzione.',
  }),
])

describe('validateQuizFile', () => {
  it('accepts valid quiz file', () => {
    expect(validateQuizFile(validQuiz)).toEqual(validQuiz)
  })

  it('rejects absent domande', () => {
    expect(() => validateQuizFile({ esame: 'Analisi 1' })).toThrow(/domande/i)
  })

  it('rejects multipla without opzioni', () => {
    const bad = makeQuizFile([{ ...multiplaLimiti, opzioni: undefined }])

    expect(() => validateQuizFile(bad)).toThrow(/opzioni/i)
  })

  it('rejects risposta_corretta not in opzioni', () => {
    const bad = makeQuizFile([{ ...multiplaLimiti, risposta_corretta: '42' }])

    expect(() => validateQuizFile(bad)).toThrow(/risposta_corretta/i)
  })

  it('rejects vero_falso answer not Vero/Falso', () => {
    const bad = makeQuizFile([{ ...veroFalsoDerivate, risposta_corretta: 'Forse' }])

    expect(() => validateQuizFile(bad)).toThrow(/Vero.*Falso|Falso.*Vero/)
  })

  it('accepts risposta_corretta Falso for vero_falso', () => {
    const quiz = makeQuizFile([makeVeroFalso({ risposta_corretta: 'Falso' })])

    expect(validateQuizFile(quiz)).toEqual(quiz)
  })

  it('rejects unknown tipo', () => {
    const bad = makeQuizFile([{ ...multiplaLimiti, tipo: 'aperta' } as QuizDomanda])

    expect(() => validateQuizFile(bad)).toThrow(/tipo/i)
  })

  it('rejects missing testo', () => {
    const bad = makeQuizFile([{ ...multiplaLimiti, testo: '' }])

    expect(() => validateQuizFile(bad)).toThrow(/testo/i)
  })

  it('rejects empty macroargomenti', () => {
    const bad = makeQuizFile([{ ...multiplaLimiti, macroargomenti: [] }])

    expect(() => validateQuizFile(bad)).toThrow(/macroargomenti/i)
  })

  it('rejects multipla with fewer than 2 options', () => {
    const bad = makeQuizFile([
      { ...multiplaLimiti, opzioni: ['4'], risposta_corretta: '4' },
    ])

    expect(() => validateQuizFile(bad)).toThrow(/2.*5/)
  })

  it('rejects multipla with more than 5 options', () => {
    const bad = makeQuizFile([
      {
        ...multiplaLimiti,
        opzioni: ['1', '2', '3', '4', '5', '6'],
        risposta_corretta: '1',
      },
    ])

    expect(() => validateQuizFile(bad)).toThrow(/2.*5/)
  })

  it('rejects missing spiegazione', () => {
    const bad = makeQuizFile([{ ...multiplaLimiti, spiegazione: '' }])

    expect(() => validateQuizFile(bad)).toThrow(/spiegazione/i)
  })
})

describe('validateFlashcardFile', () => {
  it('accepts valid flashcard file', () => {
    expect(validateFlashcardFile(validFlashcards)).toEqual(validFlashcards)
  })

  it('rejects missing carte', () => {
    expect(() => validateFlashcardFile({ esame: 'Analisi 1' })).toThrow(/carte/i)
  })

  it('rejects non-array carte', () => {
    expect(() =>
      validateFlashcardFile({ esame: 'Analisi 1', carte: 'not-array' }),
    ).toThrow(/carte/i)
  })

  it('rejects missing card id', () => {
    const bad = makeFlashcardFile([{ ...validFlashcards.carte[0], id: '' }])

    expect(() => validateFlashcardFile(bad)).toThrow(/id/i)
  })

  it('rejects missing fronte or retro', () => {
    const missingFronte = makeFlashcardFile([{ ...validFlashcards.carte[0], fronte: '' }])
    const missingRetro = makeFlashcardFile([{ ...validFlashcards.carte[0], retro: '' }])

    expect(() => validateFlashcardFile(missingFronte)).toThrow(/fronte/i)
    expect(() => validateFlashcardFile(missingRetro)).toThrow(/retro/i)
  })

  it('rejects empty macroargomenti', () => {
    const bad = makeFlashcardFile([{ ...validFlashcards.carte[0], macroargomenti: [] }])

    expect(() => validateFlashcardFile(bad)).toThrow(/macroargomenti/i)
  })
})

describe('filterDomande', () => {
  it('returns all questions when selected macroargomenti is empty', () => {
    expect(filterDomande(validQuiz.domande, [])).toEqual(validQuiz.domande)
  })

  it('filters by single macro using OR logic', () => {
    const result = filterDomande(validQuiz.domande, ['Derivate'])

    expect(result.map((domanda) => domanda.id)).toEqual(['q2'])
  })

  it("matches a multi-macro question when filtering by one of the question's macros", () => {
    const result = filterDomande(validQuiz.domande, ['Continuita'])

    expect(result.map((domanda) => domanda.id)).toEqual(['q3'])
  })

  it('returns an empty array when no question matches the selected macro', () => {
    expect(filterDomande(validQuiz.domande, ['Integrali'])).toEqual([])
  })

  it('includes questions with any matching macro when both question and filter have multiple macros', () => {
    const result = filterDomande(validQuiz.domande, ['Integrali', 'Limiti'])

    expect(result.map((domanda) => domanda.id)).toEqual(['q1', 'q3'])
  })
})

describe('buildSessionQuestions', () => {
  it('returns at most N questions', () => {
    expect(buildSessionQuestions(validQuiz.domande, 2)).toHaveLength(2)
  })

  it('shuffles multiple-choice options with the same elements', () => {
    const [built] = buildSessionQuestions([multiplaLimiti], 1)

    expect([...(built.opzioniShuffled ?? [])].sort()).toEqual(
      [...(multiplaLimiti.opzioni ?? [])].sort(),
    )
  })

  it('returns all available questions without error when N is greater than available', () => {
    expect(buildSessionQuestions(validQuiz.domande, 10)).toHaveLength(3)
  })

  it('leaves vero_falso opzioniShuffled undefined', () => {
    const [built] = buildSessionQuestions([veroFalsoDerivate], 1)

    expect(built.opzioniShuffled).toBeUndefined()
  })

  it('does not mutate original questions or options', () => {
    const originalOptions = [...multiplaLimiti.opzioni!]

    buildSessionQuestions([multiplaLimiti], 1)

    expect(multiplaLimiti.opzioni).toEqual(originalOptions)
    expect(multiplaLimiti).not.toHaveProperty('opzioniShuffled')
  })
})

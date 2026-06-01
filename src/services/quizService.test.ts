import { describe, expect, it } from 'vitest'
import type { FlashcardFile, QuizFile } from '../types'
import {
  buildSessionQuestions,
  filterDomande,
  validateFlashcardFile,
  validateQuizFile,
} from './quizService'

const validQuiz: QuizFile = {
  esame: 'Analisi 1',
  domande: [
    {
      id: 'q1',
      macroargomenti: ['Limiti'],
      tipo: 'multipla',
      testo: 'Quanto fa 2 + 2?',
      opzioni: ['3', '4', '5'],
      risposta_corretta: '4',
      spiegazione: '2 + 2 = 4.',
    },
    {
      id: 'q2',
      macroargomenti: ['Derivate'],
      tipo: 'vero_falso',
      testo: 'La derivata di una costante e zero.',
      risposta_corretta: 'Vero',
      spiegazione: 'Le costanti hanno derivata nulla.',
    },
    {
      id: 'q3',
      macroargomenti: ['Limiti', 'Continuita'],
      tipo: 'multipla',
      testo: 'Una funzione continua ammette limite uguale al valore?',
      opzioni: ['Si', 'No'],
      risposta_corretta: 'Si',
      spiegazione: 'Per definizione di continuita.',
    },
  ],
}

const validFlashcards: FlashcardFile = {
  esame: 'Analisi 1',
  carte: [
    {
      id: 'c1',
      macroargomenti: ['Limiti'],
      fronte: 'Definizione di limite',
      retro: 'Valore a cui tende una funzione.',
    },
  ],
}

describe('validateQuizFile', () => {
  it('accepts valid quiz', () => {
    expect(validateQuizFile(validQuiz)).toEqual(validQuiz)
  })

  it('rejects missing domande', () => {
    expect(() => validateQuizFile({ esame: 'Analisi 1' })).toThrow(/domande/i)
  })

  it('rejects multipla without opzioni', () => {
    const bad = {
      ...validQuiz,
      domande: [{ ...validQuiz.domande[0], opzioni: undefined }],
    }

    expect(() => validateQuizFile(bad)).toThrow(/opzioni/i)
  })

  it('rejects risposta_corretta not present in options', () => {
    const bad = {
      ...validQuiz,
      domande: [{ ...validQuiz.domande[0], risposta_corretta: '42' }],
    }

    expect(() => validateQuizFile(bad)).toThrow(/risposta_corretta/i)
  })

  it('rejects vero_falso answer not Vero/Falso', () => {
    const bad = {
      ...validQuiz,
      domande: [{ ...validQuiz.domande[1], risposta_corretta: 'Forse' }],
    }

    expect(() => validateQuizFile(bad)).toThrow(/Vero.*Falso|Falso.*Vero/)
  })

  it('rejects multipla with more than five options', () => {
    const bad = {
      ...validQuiz,
      domande: [
        {
          ...validQuiz.domande[0],
          opzioni: ['1', '2', '3', '4', '5', '6'],
          risposta_corretta: '1',
        },
      ],
    }

    expect(() => validateQuizFile(bad)).toThrow(/2.*5/)
  })

  it('rejects empty macroargomenti', () => {
    const bad = {
      ...validQuiz,
      domande: [{ ...validQuiz.domande[0], macroargomenti: [] }],
    }

    expect(() => validateQuizFile(bad)).toThrow(/macroargomenti/i)
  })
})

describe('validateFlashcardFile', () => {
  it('accepts valid flashcard file', () => {
    expect(validateFlashcardFile(validFlashcards)).toEqual(validFlashcards)
  })

  it('rejects cards without non-empty macroargomenti', () => {
    const bad = {
      ...validFlashcards,
      carte: [{ ...validFlashcards.carte[0], macroargomenti: [] }],
    }

    expect(() => validateFlashcardFile(bad)).toThrow(/macroargomenti/i)
  })
})

describe('filterDomande', () => {
  it('returns all questions when selected macroargomenti is empty', () => {
    expect(filterDomande(validQuiz.domande, [])).toEqual(validQuiz.domande)
  })

  it('filters questions using OR logic by macroargomento', () => {
    const result = filterDomande(validQuiz.domande, ['Derivate', 'Continuita'])

    expect(result.map((domanda) => domanda.id)).toEqual(['q2', 'q3'])
  })
})

describe('buildSessionQuestions', () => {
  it('returns at most N questions', () => {
    expect(buildSessionQuestions(validQuiz.domande, 2)).toHaveLength(2)
    expect(buildSessionQuestions(validQuiz.domande, 10)).toHaveLength(3)
  })

  it('shuffles multiple-choice options with the same elements', () => {
    const [built] = buildSessionQuestions([validQuiz.domande[0]], 1)

    expect([...(built.opzioniShuffled ?? [])].sort()).toEqual(
      [...(validQuiz.domande[0].opzioni ?? [])].sort(),
    )
  })

  it('does not mutate original questions or options', () => {
    const originalOptions = [...validQuiz.domande[0].opzioni!]

    buildSessionQuestions([validQuiz.domande[0]], 1)

    expect(validQuiz.domande[0].opzioni).toEqual(originalOptions)
    expect(validQuiz.domande[0]).not.toHaveProperty('opzioniShuffled')
  })
})

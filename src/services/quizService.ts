import type { FlashcardFile, QuizDomanda, QuizFile } from '../types'
import { shuffle } from '../utils/shuffle'

export interface SessionQuestion extends QuizDomanda {
  opzioniShuffled?: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireString(record: Record<string, unknown>, field: string, label: string): void {
  if (typeof record[field] !== 'string' || record[field].trim() === '') {
    throw new Error(`${label}: campo "${field}" mancante o non valido`)
  }
}

function validateMacroargomenti(value: unknown, label: string): void {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((item) => typeof item === 'string' && item.trim() !== '')
  ) {
    throw new Error(`${label}: "macroargomenti" deve essere un array non vuoto`)
  }
}

export function validateQuizFile(data: unknown): QuizFile {
  if (!isRecord(data)) {
    throw new Error('Quiz non valido: il contenuto deve essere un oggetto')
  }

  if (!Array.isArray(data.domande)) {
    throw new Error('Quiz non valido: campo "domande" mancante o non è un array')
  }

  data.domande.forEach((domanda, index) => {
    if (!isRecord(domanda)) {
      throw new Error(`Domanda ${index + 1}: deve essere un oggetto`)
    }

    const label =
      typeof domanda.id === 'string' && domanda.id.trim() !== ''
        ? `Domanda ${domanda.id}`
        : `Domanda ${index + 1}`

    requireString(domanda, 'id', label)
    requireString(domanda, 'tipo', label)
    requireString(domanda, 'testo', label)
    requireString(domanda, 'risposta_corretta', label)
    requireString(domanda, 'spiegazione', label)
    validateMacroargomenti(domanda.macroargomenti, label)

    if (domanda.tipo !== 'multipla' && domanda.tipo !== 'vero_falso') {
      throw new Error(`${label}: "tipo" deve essere "multipla" o "vero_falso"`)
    }

    if (domanda.tipo === 'multipla') {
      if (
        !Array.isArray(domanda.opzioni) ||
        domanda.opzioni.length < 2 ||
        domanda.opzioni.length > 5 ||
        !domanda.opzioni.every((option) => typeof option === 'string' && option.trim() !== '')
      ) {
        throw new Error(`${label}: "opzioni" deve contenere da 2 a 5 stringhe`)
      }

      const matchingAnswers = domanda.opzioni.filter(
        (option) => option === domanda.risposta_corretta,
      )
      if (matchingAnswers.length !== 1) {
        throw new Error(
          `${label}: "risposta_corretta" deve essere presente esattamente una volta in "opzioni"`,
        )
      }
    }

    if (
      domanda.tipo === 'vero_falso' &&
      domanda.risposta_corretta !== 'Vero' &&
      domanda.risposta_corretta !== 'Falso'
    ) {
      throw new Error(`${label}: "risposta_corretta" deve essere "Vero" o "Falso"`)
    }
  })

  return data as unknown as QuizFile
}

export function validateFlashcardFile(data: unknown): FlashcardFile {
  if (!isRecord(data)) {
    throw new Error('Flashcard non valide: il contenuto deve essere un oggetto')
  }

  if (!Array.isArray(data.carte)) {
    throw new Error('Flashcard non valide: campo "carte" mancante o non è un array')
  }

  data.carte.forEach((card, index) => {
    if (!isRecord(card)) {
      throw new Error(`Carta ${index + 1}: deve essere un oggetto`)
    }

    const label =
      typeof card.id === 'string' && card.id.trim() !== ''
        ? `Carta ${card.id}`
        : `Carta ${index + 1}`

    requireString(card, 'id', label)
    requireString(card, 'fronte', label)
    requireString(card, 'retro', label)
    validateMacroargomenti(card.macroargomenti, label)
  })

  return data as unknown as FlashcardFile
}

export function filterDomande(
  domande: QuizDomanda[],
  macroargomenti: string[],
): QuizDomanda[] {
  if (macroargomenti.length === 0) return domande

  const selected = new Set(macroargomenti)
  return domande.filter((domanda) =>
    domanda.macroargomenti.some((macroargomento) => selected.has(macroargomento)),
  )
}

export function buildSessionQuestions(
  domande: QuizDomanda[],
  n: number,
): SessionQuestion[] {
  return shuffle(domande)
    .slice(0, Math.max(0, n))
    .map((domanda) => {
      if (domanda.tipo !== 'multipla' || !domanda.opzioni) {
        return { ...domanda }
      }

      return {
        ...domanda,
        opzioni: [...domanda.opzioni],
        opzioniShuffled: shuffle(domanda.opzioni),
      }
    })
}

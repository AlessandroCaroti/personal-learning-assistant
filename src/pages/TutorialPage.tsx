import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export const PROMPT_QUIZ_FLASHCARD = `Ho allegato i miei documenti di studio per l'esame di [NOME ESAME].
Analizza tutto il contenuto e genera due file JSON.

━━━ FILE 1: quiz.json ━━━
Schema:
{
  "esame": "[NOME ESAME]",
  "domande": [
    {
      "id": "q1",
      "macroargomenti": ["Argomento A", "Argomento B"],
      "tipo": "multipla",
      "testo": "testo della domanda",
      "opzioni": ["opzione 1", "opzione 2", "opzione 3", "opzione 4"],
      "risposta_corretta": "testo esatto dell'opzione corretta",
      "spiegazione": "spiegazione dettagliata della risposta"
    },
    {
      "id": "q2",
      "macroargomenti": ["Argomento A"],
      "tipo": "vero_falso",
      "testo": "affermazione da valutare",
      "risposta_corretta": "Vero",
      "spiegazione": "spiegazione dettagliata"
    }
  ]
}
Regole:
- Genera il maggior numero possibile di domande (minimo 50)
- Alterna domande multipla e vero/falso
- Per multipla: da 3 a 5 opzioni, testo puro senza prefissi A/B/C
- risposta_corretta per multipla = testo esatto di una delle opzioni (non una lettera)
- risposta_corretta per vero_falso = "Vero" oppure "Falso"
- macroargomenti: argomenti tematici coerenti, riutilizzati tra le domande
- Copri uniformemente tutti gli argomenti del materiale
- id sequenziale: q1, q2, q3...

━━━ FILE 2: flashcard.json ━━━
Schema:
{
  "esame": "[NOME ESAME]",
  "carte": [
    {
      "id": "f1",
      "macroargomenti": ["Argomento A"],
      "fronte": "domanda, termine o concetto",
      "retro": "risposta o definizione completa e autosufficiente"
    }
  ]
}
Regole:
- Genera il maggior numero possibile di carte (minimo 60)
- Il fronte è una domanda aperta, un termine chiave, o una formula
- Il retro è la risposta completa, comprensibile da sola
- macroargomenti: coerenti con quelli usati in quiz.json
- id sequenziale: f1, f2, f3...

Rispondi con due blocchi di codice separati e ben etichettati:
il primo per quiz.json, il secondo per flashcard.json. Nient'altro.`

export const PROMPT_RIASSUNTO = `Ho allegato i miei documenti di studio per l'esame di [NOME ESAME].
Crea un riassunto completo in formato HTML con queste caratteristiche:

- File HTML autocontenuto (CSS inline o in un tag <style> nell'<head>)
- <h1> per il titolo dell'esame, <h2> per i macroargomenti, <h3> per i sottotemi
- Usa tabelle per confronti, elenchi puntati per definizioni o passaggi
- Formule scritte in forma testuale leggibile
- Stile: sfondo bianco, font sans-serif, margini comodi, leggibile su schermo
- Copri tutto il materiale in modo esaustivo senza tralasciare nulla

Rispondi con solo il file HTML completo, nient'altro.`

interface StepProps {
  number: number
  title: string
  children: ReactNode
  prompt?: string
}

function setTutorialSeen() {
  try {
    window.localStorage?.setItem('tutorialSeen', 'true')
  } catch {
    // Tests or privacy settings may make localStorage unavailable.
  }
}

function Step({ number, title, children, prompt }: StepProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const promptLabel = `Prompt: ${title}`

  async function handleCopy() {
    if (!prompt) return

    try {
      await navigator.clipboard.writeText(prompt)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }

    window.setTimeout(() => setCopyStatus('idle'), 2000)
  }

  const copied = copyStatus === 'copied'

  return (
    <section
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '1.25rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span
          aria-hidden="true"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.9rem',
            flexShrink: 0,
          }}
        >
          {number}
        </span>
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
      </div>

      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{children}</div>

      {prompt && (
        <div style={{ marginTop: '1rem' }}>
          <textarea
            readOnly
            aria-label={promptLabel}
            value={prompt}
            style={{
              width: '100%',
              minHeight: '180px',
              maxHeight: '320px',
              resize: 'vertical',
              overflow: 'auto',
              padding: '0.85rem',
              borderRadius: '8px',
              background: 'var(--bg-elevated)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '0.82rem',
              lineHeight: 1.5,
              whiteSpace: 'pre',
            }}
          />
          <button
            type="button"
            onClick={handleCopy}
            style={{
              marginTop: '0.75rem',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              background: copied ? 'var(--success)' : 'var(--bg-elevated)',
              color: copied ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)',
              minHeight: '40px',
            }}
          >
            {copied ? 'Copiato!' : 'Copia prompt'}
          </button>
          {copyStatus === 'error' && (
            <p role="status" style={{ color: 'var(--danger)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Copia automatica non riuscita. Seleziona il testo nel riquadro del prompt e copialo manualmente.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export function TutorialPage({ isOnboarding = false }: { isOnboarding?: boolean }) {
  const navigate = useNavigate()

  function handleSkip() {
    setTutorialSeen()
    navigate('/')
  }

  function handleGoHome() {
    if (isOnboarding) setTutorialSeen()
    navigate('/')
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Guida</h1>
        {isOnboarding && (
          <button
            type="button"
            onClick={handleSkip}
            style={{
              padding: '0.65rem 1.1rem',
              borderRadius: '8px',
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 700,
              minHeight: '44px',
            }}
          >
            Salta
          </button>
        )}
      </div>

      <Step number={1} title="Prepara i tuoi documenti">
        <p>Raccogli tutti i materiali dell'esame: PDF, DOCX, file di testo.</p>
        <p style={{ marginTop: '0.5rem' }}>
          Più materiale fornisci all'AI, più domande e flashcard verranno generate. Formati supportati da
          ChatGPT e Claude: PDF, DOCX, TXT.
        </p>
      </Step>

      <Step number={2} title="Genera quiz e flashcard" prompt={PROMPT_QUIZ_FLASHCARD}>
        <p>
          Apri <strong>ChatGPT</strong> o <strong>Claude</strong>, carica tutti i file dell'esame, poi incolla il
          prompt qui sotto. Sostituisci <code>[NOME ESAME]</code> con il nome reale prima di inviare.
        </p>
      </Step>

      <Step number={3} title="(Facoltativo) Genera il riassunto" prompt={PROMPT_RIASSUNTO}>
        <p>
          Se non hai già un riassunto, puoi chiederlo all'AI. Il file generato sarà in formato HTML,
          importabile direttamente nell'app.
        </p>
      </Step>

      <Step number={4} title="Importa nell'app">
        <p>
          Salva i file generati sul tuo dispositivo, poi crea un nuovo esame e importa ciascun file nella
          sezione corrispondente.
        </p>
        <button
          type="button"
          onClick={handleGoHome}
          style={{
            marginTop: '1rem',
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            minHeight: '44px',
          }}
        >
          Vai a "Crea nuovo esame"
        </button>
      </Step>
    </div>
  )
}

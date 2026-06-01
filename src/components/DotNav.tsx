export type DotState = 'unanswered' | 'selected' | 'correct' | 'wrong'

interface DotNavProps {
  total: number
  current: number
  states: DotState[]
  onSelect: (index: number) => void
}

const dotColor: Record<DotState, string> = {
  unanswered: 'var(--border)',
  selected: 'var(--accent)',
  correct: 'var(--success)',
  wrong: 'var(--danger)',
}

const statusLabel: Record<DotState, string> = {
  unanswered: 'non risposta',
  selected: 'risposta selezionata',
  correct: 'risposta corretta',
  wrong: 'risposta errata',
}

const statusGlyph: Partial<Record<DotState, string>> = {
  correct: '✓',
  wrong: '×',
}

export function DotNav({ total, current, states, onSelect }: DotNavProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px' }}>
      {Array.from({ length: total }, (_, index) => {
        const state = states[index] ?? 'unanswered'
        const isCurrent = index === current
        const label = `Domanda ${index + 1}, ${isCurrent ? 'corrente, ' : ''}${statusLabel[state]}`

        return (
          <button
            key={index}
            type="button"
            aria-label={label}
            aria-current={isCurrent ? 'step' : undefined}
            title={label}
            onClick={() => onSelect(index)}
            style={{
              width: '44px',
              height: '44px',
              padding: 0,
              border: '0',
              borderRadius: '50%',
              background: 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: '16px',
                height: '16px',
                border: isCurrent ? '2px solid var(--text)' : '2px solid transparent',
                borderRadius: '50%',
                background: dotColor[state],
                boxSizing: 'border-box',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              <StatusCue state={state} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

function StatusCue({ state }: { state: DotState }) {
  if (state === 'unanswered') {
    return (
      <span
        data-status-cue={state}
        style={{
          width: '8px',
          height: '2px',
          borderRadius: '999px',
          background: 'var(--text-muted)',
        }}
      />
    )
  }

  if (state === 'selected') {
    return (
      <span
        data-status-cue={state}
        style={{
          width: '6px',
          height: '6px',
          border: '2px solid #fff',
          borderRadius: '50%',
          boxSizing: 'border-box',
        }}
      />
    )
  }

  return <span data-status-cue={state}>{statusGlyph[state]}</span>
}

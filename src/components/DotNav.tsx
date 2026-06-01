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
              }}
            />
          </button>
        )
      })}
    </div>
  )
}

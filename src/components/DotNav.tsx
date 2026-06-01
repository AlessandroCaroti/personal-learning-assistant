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

export function DotNav({ total, current, states, onSelect }: DotNavProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px' }}>
      {Array.from({ length: total }, (_, index) => {
        const state = states[index] ?? 'unanswered'

        return (
          <button
            key={index}
            type="button"
            aria-label={`Vai alla domanda ${index + 1}`}
            title={`Domanda ${index + 1}`}
            onClick={() => onSelect(index)}
            style={{
              width: '16px',
              height: '16px',
              padding: 0,
              border: index === current ? '2px solid var(--text)' : '2px solid transparent',
              borderRadius: '50%',
              background: dotColor[state],
            }}
          />
        )
      })}
    </div>
  )
}

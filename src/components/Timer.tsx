import { formatTime } from '../utils/formatTime'

interface TimerProps {
  elapsed: number
  remaining: number | null
}

export function Timer({ elapsed, remaining }: TimerProps) {
  const displaySeconds = remaining !== null ? remaining : elapsed
  const isWarning = remaining !== null && remaining <= 60

  return (
    <span
      aria-label={remaining !== null ? 'Tempo rimanente' : 'Tempo trascorso'}
      style={{
        color: isWarning ? 'var(--danger)' : 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: isWarning ? 700 : 400,
      }}
    >
      {formatTime(displaySeconds)}
    </span>
  )
}

interface ProgressBarProps {
  current: number
  total: number
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      style={{
        height: '4px',
        overflow: 'hidden',
        borderRadius: '2px',
        background: 'var(--bg-elevated)',
      }}
    >
      <div
        style={{
          width: `${percentage}%`,
          height: '100%',
          background: 'var(--accent)',
          transition: 'width 0.2s ease',
        }}
      />
    </div>
  )
}

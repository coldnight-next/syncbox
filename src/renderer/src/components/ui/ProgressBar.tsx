interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
}

export function ProgressBar({
  value,
  max = 100,
  className = '',
  showLabel = false,
}: ProgressBarProps): React.JSX.Element {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-syncbox-500 transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-gray-500">{Math.round(percent)}%</span>}
    </div>
  )
}

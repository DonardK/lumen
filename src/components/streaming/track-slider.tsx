import { cn } from '@/lib/utils'

type TrackSliderProps = {
  label: string
  value: number
  max: number
  step?: number
  buffered?: number
  valueText?: string
  onChange: (value: number) => void
  className?: string
}

/**
 * Visual track driven by a transparent native range input on top,
 * so keyboard and screen reader support comes for free.
 */
export function TrackSlider({
  label,
  value,
  max,
  step = 0.1,
  buffered,
  valueText,
  onChange,
  className,
}: TrackSliderProps) {
  const safeMax = max > 0 ? max : 1
  const progress = Math.min(100, (value / safeMax) * 100)
  const bufferedPct =
    buffered === undefined ? 0 : Math.min(100, (buffered / safeMax) * 100)

  return (
    <div
      className={cn('group/track relative flex h-4 items-center', className)}
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-foreground/20 transition-[height] group-hover/track:h-1.5 group-has-focus-visible/track:h-1.5">
        {buffered !== undefined && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-foreground/25"
            style={{ width: `${bufferedPct}%` }}
          />
        )}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute size-3 -translate-x-1/2 scale-0 rounded-full bg-primary shadow-lg transition-transform group-hover/track:scale-100 group-has-focus-visible/track:scale-100"
        style={{ left: `${progress}%` }}
      />
      <input
        type="range"
        aria-label={label}
        aria-valuetext={valueText}
        min={0}
        max={safeMax}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  )
}

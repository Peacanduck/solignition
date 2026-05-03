export type DonutSegment = {
  value: number
  color: string
  label: string
}

type Props = {
  segments: DonutSegment[]
  size?: number
  strokeWidth?: number
  className?: string
}

export function PoolDonut({ segments, size = 180, strokeWidth = 18, className }: Props) {
  const r = size / 2 - strokeWidth / 2 - 1
  const cx = size / 2
  const cy = size / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let off = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-secondary" strokeWidth={strokeWidth} />
      {segments.map((s, i) => {
        const len = (s.value / total) * c
        const dash = `${len} ${c - len}`
        const dashoff = -off
        off += len
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            strokeDashoffset={dashoff}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )
      })}
    </svg>
  )
}

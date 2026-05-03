type Props = {
  data?: number[]
  height?: number
  className?: string
}

export function ApyLine({ data, height = 180, className }: Props) {
  // TODO: real 30d APY history once snapshot job exists. Default = flat at 0.
  const series = data && data.length > 0 ? data : Array(30).fill(0)
  const w = 600
  const h = height
  const p = 18
  const max = Math.max(...series) + 0.5
  const min = Math.max(0, Math.min(...series) - 0.5)
  const range = max - min || 1

  const path = series
    .map((v, i) => {
      const x = p + (i / Math.max(1, series.length - 1)) * (w - 2 * p)
      const y = h - p - ((v - min) / range) * (h - 2 * p)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  const area = `${path} L ${w - p} ${h - p} L ${p} ${h - p} Z`

  const avg = series.reduce((s, v) => s + v, 0) / series.length
  const avgY = h - p - ((avg - min) / range) * (h - 2 * p)

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
    >
      <defs>
        <linearGradient id="apygrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.78 0.17 150)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="oklch(0.78 0.17 150)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={p}
          x2={w - p}
          y1={p + g * (h - 2 * p)}
          y2={p + g * (h - 2 * p)}
          className="stroke-border"
          strokeDasharray="2 4"
        />
      ))}
      <line
        x1={p}
        x2={w - p}
        y1={avgY}
        y2={avgY}
        className="stroke-accent"
        strokeWidth="0.8"
        strokeDasharray="3 3"
        opacity="0.5"
      />
      <path d={area} fill="url(#apygrad)" />
      <path d={path} className="stroke-accent" strokeWidth="1.5" fill="none" />
      <text
        x={p - 2}
        y={p + 4}
        className="fill-muted-foreground"
        fontSize="9"
        textAnchor="end"
        fontFamily="var(--font-mono)"
      >
        {max.toFixed(1)}%
      </text>
      <text
        x={p - 2}
        y={h - p + 2}
        className="fill-muted-foreground"
        fontSize="9"
        textAnchor="end"
        fontFamily="var(--font-mono)"
      >
        {min.toFixed(1)}%
      </text>
    </svg>
  )
}

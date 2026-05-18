import { Link } from 'react-router-dom'

interface Step {
  title: string
  description: string
  to: string
}

export const NextSteps = ({ steps }: { steps: Step[] }) => (
  <div className="flex flex-col gap-2 my-4">
    {steps.map(s => (
      <Link
        key={s.to}
        to={s.to}
        className="flex justify-between items-center px-4 py-3.5 border border-line rounded-md
                   bg-bg-1 hover:border-[var(--accent-edge)] hover:bg-bg-2
                   transition-colors no-underline"
      >
        <div>
          <div className="text-[14px] font-semibold text-ink">{s.title}</div>
          <div className="text-[12px] text-ink-3 mt-0.5">{s.description}</div>
        </div>
        <span className="text-[16px] font-mono text-[var(--accent)]">→</span>
      </Link>
    ))}
  </div>
)

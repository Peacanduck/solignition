import { Link } from 'react-router'

export function Brand() {
  return (
    <Link to="/solignition" className="flex items-center gap-2 text-foreground hover:opacity-90">
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden>
        <path
          d="M3 3 L11 3 L11 11 L19 11 L19 19 L11 19 L11 11 L3 11 Z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="11" cy="11" r="2" className="fill-accent" />
      </svg>
      <span className="font-mono font-semibold text-sm tracking-tight">solignition</span>
    </Link>
  )
}

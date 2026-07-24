export function Brand() {
  return (
    <a
      href="https://www.solignition.xyz/"
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 text-foreground hover:opacity-90"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M14.25 6.63 A6 6 0 1 1 9.75 6.63"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M12 3.4 L13.3 9 L12 11.6 L10.7 9 Z" fill="#2ea957" />
      </svg>
      <span className="font-mono font-semibold text-sm tracking-tight">solignition</span>
    </a>
  )
}

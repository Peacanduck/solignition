export const Logo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden>
    <path
      d="M3 3 L11 3 L11 11 L19 11 L19 19 L11 19 L11 11 L3 11 Z"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <circle cx="11" cy="11" r="2" fill="var(--accent)" />
  </svg>
)

export const SearchIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
    <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M8 8 L11 11" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

export const MenuIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const CloseIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

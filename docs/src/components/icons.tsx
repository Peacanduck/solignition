export const Logo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M14.25 6.63 A6 6 0 1 1 9.75 6.63"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      fill="none"
    />
    <path d="M12 3.4 L13.3 9 L12 11.6 L10.7 9 Z" fill="var(--accent)" />
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

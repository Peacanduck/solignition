export function AppFooter() {
  return (
    <footer className="flex items-center justify-center gap-4 p-2 bg-card/50 text-xs text-center">
      <span>
        © 2025 Solignition.
      </span>

      {/* X / Twitter */}
      <a
        href="https://x.com/Solignition"
        target="_blank"
        rel="noopener noreferrer"
        className="opacity-80 hover:opacity-100 "
      >
         <svg
    viewBox="0 0 1200 1200"
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4 fill-current"
  >
    <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z" fill="currentColor"/>   
  </svg>
      </a>

      {/* Discord */}
      <a
        href="https://discord.gg/7yBEb7GUee"
        target="_blank"
        rel="noopener noreferrer"
        className="opacity-80 hover:opacity-100"
      >
        <img
          src="/Discord-Symbol-Blurple.svg" 
          alt="Discord"
          className="h-4 w-4"
        />
      </a>
    </footer>
  );
}

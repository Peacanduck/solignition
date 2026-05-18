import { useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { useChainData, type FeedRow, type ChainStats } from './data/use-chain-data';

const APP_URL = 'https://app.solignition.xyz';
const DOCS_URL = 'https://docs.solignition.xyz';
const EXPLORE_URL = 'https://app.solignition.xyz/explore';
const GITHUB_URL = 'https://github.com/Peacanduck/solignition';

// =====================================================================
// Shared primitives
// =====================================================================

const BtnPrimary = (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a
    {...props}
    className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-3
               font-mono text-[13px] font-medium text-black hover:bg-[var(--accent-2)]
               transition-colors"
  />
);

const BtnGhost = (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a
    {...props}
    className="inline-flex items-center gap-2 rounded-md border border-line-2 bg-transparent
               px-5 py-3 font-mono text-[13px] text-ink-2 hover:text-ink hover:border-line-3
               transition-colors"
  />
);

const Logo = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path
      d="M3 3 L11 3 L11 11 L19 11 L19 19 L11 19 L11 11 L3 11 Z"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <circle cx="11" cy="11" r="2" fill="var(--accent)" />
  </svg>
);

const PulseDot = () => (
  <span className="relative flex h-1.5 w-1.5">
    <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
    <span className="relative h-1.5 w-1.5 rounded-full bg-accent" />
  </span>
);

const Eyebrow = ({ children, pulse = false }: { children: ReactNode; pulse?: boolean }) => (
  <div
    className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-bg-1
               px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] text-ink-2 uppercase"
  >
    {pulse ? <PulseDot /> : <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
    <span>{children}</span>
  </div>
);

// =====================================================================
// Nav
// =====================================================================

const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
        scrolled ? 'bg-bg/85 backdrop-blur-md border-b border-line' : 'bg-transparent'
      }`}
    >
      <div className="max-w-page mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-semibold tracking-tight">solignition</span>
        </a>

        <div className="hidden md:flex items-center gap-7 font-mono text-[12px] text-ink-2">
          <a href="#how-it-works" className="hover:text-ink">how it works</a>
          <a href="#economics" className="hover:text-ink">economics</a>
          <a href="#live" className="hover:text-ink">live</a>
          <a href={DOCS_URL} className="hover:text-ink">docs ↗</a>
          <a href={GITHUB_URL} className="hover:text-ink">github ↗</a>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={APP_URL}
            className="hidden md:inline-flex font-mono text-[12px] text-ink-2 hover:text-ink px-3 py-2"
          >
            launch app →
          </a>
          <a
            href={APP_URL}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3.5 py-2
                       font-mono text-[12px] font-medium text-black hover:bg-[var(--accent-2)]
                       transition-colors"
          >
            connect wallet
          </a>
        </div>
      </div>
    </nav>
  );
};

// =====================================================================
// Hero
// =====================================================================

const StatusPill = () => (
  <div
    className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-bg-1
               px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] text-ink-2"
  >
    <PulseDot />
    LIVE · DEVNET · v0.4.2
  </div>
);

const PLACEHOLDER = '——';

const HeroMetrics = ({ stats }: { stats: ChainStats | null }) => {
  const rows: ReadonlyArray<readonly [string, string]> = [
    [stats ? stats.tvlSol : PLACEHOLDER, 'SOL pooled'],
    [stats ? stats.programsDeployed.toLocaleString() : PLACEHOLDER, 'programs deployed'],
    [stats ? `${stats.lpApy}%` : PLACEHOLDER, 'current LP APY'],
  ];
  return (
    <div className="mt-14 grid grid-cols-3 divide-x divide-line border-y border-line py-5">
      {rows.map(([v, l]) => (
        <div key={l} className="px-5 first:pl-0">
          <div className="font-mono tabular text-[28px] font-semibold tracking-tight">{v}</div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase mt-1">{l}</div>
        </div>
      ))}
    </div>
  );
};

const Terminal = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 7), 1200);
    return () => clearInterval(id);
  }, []);

  const lineCls = (n: number) =>
    `block transition-opacity duration-300 ${step >= n ? 'opacity-100' : 'opacity-20'}`;

  return (
    <div className="rounded-lg border border-line-2 bg-bg-1 overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-bg-2 border-b border-line">
        <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57] opacity-70" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e] opacity-70" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#28c840] opacity-70" />
        <span className="ml-3 font-mono text-[11px] text-ink-3">~/my-program — solignition</span>
      </div>
      <pre className="px-5 py-5 font-mono text-[13px] leading-[1.9] whitespace-pre">
        <span className="block">
          <span className="text-accent mr-2">$</span>solignition deploy ./target/deploy/program.so
        </span>
        <span className={lineCls(1)}>
          <span className="text-accent mr-1.5">✓</span>uploaded <span className="text-ink-3">· 247 KB · BPF valid</span>
        </span>
        <span className={lineCls(2)}>
          <span className="text-accent mr-1.5">✓</span>loan #148 <span className="text-ink-3">· 4.207 SOL @ 5.0% · 30d</span>
        </span>
        <span className={lineCls(3)}>
          <span className="text-accent mr-1.5">✓</span>signed <span className="text-ink-3">· 1.2s</span>
        </span>
        <span className={lineCls(4)}>
          <span className="text-warn mr-1.5">◌</span>deploying<span className="text-ink-3">...</span>
        </span>
        <span className={lineCls(5)}>
          <span className="text-accent mr-1.5">✓</span>live <span className="text-accent">B4dGz1q9PLm...</span>
        </span>
        <span className="block">
          <span className="text-accent mr-2">$</span>
          <span className="inline-block w-2 h-[14px] bg-accent align-middle animate-blink" />
        </span>
      </pre>
    </div>
  );
};

const Hero = ({ stats }: { stats: ChainStats | null }) => (
  <section className="relative pt-32 pb-20 px-6 md:px-8">
    <div className="max-w-page mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-16 items-center">
      <div>
        <StatusPill />

        <h1 className="mt-7 text-[56px] md:text-[72px] leading-[1.02] tracking-tightest font-semibold">
          ship your solana program.
          <br />
          we&apos;ll <span className="text-accent">front the SOL</span>.
        </h1>

        <p className="mt-5 max-w-[540px] text-[17px] leading-relaxed text-ink-2">
          Solignition lends you the rent + fees needed to deploy a program on-chain.
          Repay anytime to claim authority. Default and the protocol reclaims the slot.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <BtnPrimary href={APP_URL}>start a deployment →</BtnPrimary>
          <BtnGhost href={DOCS_URL}>read the docs ↗</BtnGhost>
        </div>

        <HeroMetrics stats={stats} />
      </div>

      <div className="lg:mt-0 mt-12">
        <Terminal />
      </div>
    </div>
  </section>
);

// =====================================================================
// How it works
// =====================================================================

const UploadIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="6" y="4" width="20" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M11 16 L16 11 L21 16 M16 11 L16 23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const LoanIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 16 L20 16 M16 12 L16 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M22 8 L24 6 L26 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </svg>
);

const DeployIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M6 22 L16 6 L26 22 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="16" cy="16" r="2" fill="currentColor" />
  </svg>
);

const RepayIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M6 16 A 10 10 0 0 1 26 16 A 10 10 0 0 1 6 16 Z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M11 16 L15 20 L21 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type Step = { title: string; desc: string; icon: ReactNode; code: string; meta: string };

const STEPS: Step[] = [
  {
    title: 'upload bytecode',
    desc: 'Drop your .so file. The protocol estimates rent + fees and quotes a principal.',
    icon: <UploadIcon />,
    code: '$ anchor build\n$ solignition upload my_program.so\n→ file_id: f_8aK2..pX',
    meta: '~5 seconds · client-side',
  },
  {
    title: 'request loan',
    desc: 'Pick term and rate. Sign one transaction. Pool disburses SOL to the deployer.',
    icon: <LoanIcon />,
    code: '$ solignition deploy --file my_program.so\n→ loan #148 created\n→ 4.20 SOL · 30d · 5.0%',
    meta: '1 transaction · 5–6% APR',
  },
  {
    title: 'auto-deploy',
    desc: 'Off-chain deployer ships the program. Authority is held by the protocol PDA.',
    icon: <DeployIcon />,
    code: '✓ deploying...\n✓ program live: B4dGz..LmXq\n✓ authority: protocol (escrow)',
    meta: '~30 seconds · automatic',
  },
  {
    title: 'repay & claim',
    desc: 'Anytime before expiry, repay principal + interest to take program authority.',
    icon: <RepayIcon />,
    code: '$ solignition repay 148\n→ paid 4.217 SOL\n✓ authority transferred',
    meta: 'no penalty for early repay',
  },
];

const StepCard = ({ title, desc, icon, code, meta, index }: Step & { index: number }) => (
  <div className="relative rounded-lg border border-line bg-bg-1 p-6 hover:border-line-2 transition-colors">
    <div className="flex items-center gap-3 mb-4">
      <span className="font-mono text-[11px] font-medium tracking-[0.1em] text-accent">
        STEP 0{index + 1}
      </span>
      <span className="flex-1 h-px bg-line-2" />
    </div>
    <div className="text-accent mb-4">{icon}</div>
    <h3 className="font-semibold text-[18px] tracking-tight mb-2">{title}</h3>
    <p className="text-[13px] leading-[1.6] text-ink-2">{desc}</p>
    <pre className="mt-4 rounded border border-line bg-bg px-3 py-2.5 font-mono text-[11px] leading-[1.7] text-ink-2 overflow-auto whitespace-pre">
      {code}
    </pre>
    <div className="font-mono text-[10px] text-ink-3 mt-4 pt-4 border-t border-line">
      {meta}
    </div>
  </div>
);

const HowItWorks = () => (
  <section id="how-it-works" className="px-6 md:px-8 py-24">
    <div className="max-w-page mx-auto">
      <div className="mb-14 max-w-[680px]">
        <div className="mb-4">
          <Eyebrow>// 01 — how it works</Eyebrow>
        </div>
        <h2 className="text-[44px] md:text-[56px] leading-[1.05] tracking-tighter font-semibold">
          from <code className="text-accent font-mono">.so</code> to deployed in{' '}
          <span className="text-accent">~60 seconds</span>.
        </h2>
        <p className="text-[16px] text-ink-2 mt-5 leading-relaxed">
          No keys held. No multi-sig. The protocol takes deployment authority during the loan term and transfers it back on repay.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map((s, i) => (
          <StepCard key={s.title} {...s} index={i} />
        ))}
      </div>
    </div>
  </section>
);

// =====================================================================
// Live deployments feed
// =====================================================================

type LoanState = 'active' | 'repaid' | 'recovered';

const StatePill = ({ state }: { state: LoanState }) => {
  const config = {
    active: {
      color: 'text-accent border-accent-edge bg-accent-soft',
      dot: 'bg-accent',
      label: 'active',
    },
    repaid: {
      color: 'text-ink-2 border-line-2 bg-bg-2',
      dot: 'bg-ink-3',
      label: 'repaid',
    },
    recovered: {
      color: 'text-warn border-[oklch(0.5_0.12_75/0.4)] bg-[oklch(0.3_0.07_75/0.18)]',
      dot: 'bg-warn',
      label: 'recovered',
    },
  }[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px]
                  font-mono uppercase tracking-wider border ${config.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

const FeedRowView = ({ row }: { row: FeedRow }) => (
  <div
    className="grid grid-cols-[60px_1fr_100px_60px_1fr_90px] gap-3 items-center
               px-4 py-3 border-t border-line first:border-t-0 hover:bg-bg-1 transition-colors"
  >
    <span className="font-mono text-[12px] text-ink-3">#{row.id}</span>
    <span className="font-mono text-[12px] text-ink-2">{row.borrower}</span>
    <span className="font-mono tabular text-[13px]">{row.amount} SOL</span>
    <span className="font-mono text-[10px] text-ink-3">{row.age}</span>
    <div className="flex items-center gap-3">
      <div className="flex-1 h-[3px] bg-bg-3 rounded-full overflow-hidden">
        <div
          className={`h-full ${row.state === 'recovered' ? 'bg-warn' : 'bg-accent'}`}
          style={{ width: `${row.progress * 100}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-ink-3 tabular w-14 text-right">{row.timeLeft}</span>
    </div>
    <StatePill state={row.state} />
  </div>
);

const FeedSkeleton = () => (
  <>
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="grid grid-cols-[60px_1fr_100px_60px_1fr_90px] gap-3 items-center
                   px-4 py-3 border-t border-line first:border-t-0"
      >
        <span className="h-3 w-10 rounded bg-bg-3 animate-pulse" />
        <span className="h-3 w-24 rounded bg-bg-3 animate-pulse" />
        <span className="h-3 w-16 rounded bg-bg-3 animate-pulse" />
        <span className="h-3 w-8 rounded bg-bg-3 animate-pulse" />
        <span className="h-3 w-full rounded bg-bg-3 animate-pulse" />
        <span className="h-3 w-16 rounded bg-bg-3 animate-pulse" />
      </div>
    ))}
  </>
);

// TODO: subscribe to loan account changes (RPC websocket) instead of polling,
// and animate new rows in with a brief flash. v1 polls every 30s.
const FeedTable = ({ feed, loading, error }: { feed: FeedRow[] | null; loading: boolean; error: string | null }) => {
  const showSkeleton = loading && !feed;
  const showEmpty = !loading && feed && feed.length === 0;
  return (
    <div className="rounded-lg border border-line bg-bg overflow-hidden">
      <div
        className="grid grid-cols-[60px_1fr_100px_60px_1fr_90px] gap-3 px-4 py-3
                   bg-bg-2 border-b border-line
                   font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase"
      >
        <span>loan</span>
        <span>borrower</span>
        <span>amount</span>
        <span>age</span>
        <span>progress</span>
        <span>state</span>
      </div>

      {showSkeleton && <FeedSkeleton />}

      {!showSkeleton && feed && feed.map((r) => <FeedRowView key={r.id} row={r} />)}

      {showEmpty && (
        <div className="px-4 py-10 text-center font-mono text-[12px] text-ink-3">
          no loans yet —{' '}
          <a href={APP_URL} className="text-accent hover:underline">
            be the first →
          </a>
        </div>
      )}

      {error && !showSkeleton && (
        <div
          className="border-t border-line px-4 py-3 flex items-center justify-between
                     font-mono text-[11px] text-warn"
        >
          <span>couldn&apos;t reach RPC · showing last successful read</span>
          <span className="text-ink-3">retrying every 30s</span>
        </div>
      )}
    </div>
  );
};

const LiveDeployments = ({ feed, loading, error }: { feed: FeedRow[] | null; loading: boolean; error: string | null }) => (
  <section id="live" className="px-6 md:px-8 py-24 bg-bg-1 border-y border-line">
    <div className="max-w-page mx-auto">
      <div className="mb-10 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="mb-3">
            <Eyebrow pulse>// 02 — live on devnet</Eyebrow>
          </div>
          <h2 className="text-[40px] md:text-[48px] leading-[1.05] tracking-tighter font-semibold">
            watch the protocol breathe.
          </h2>
          <p className="text-[15px] text-ink-2 mt-3 max-w-[520px]">
            Every loan, deploy, and repay — streamed from devnet in real time.
          </p>
        </div>
        <a href={EXPLORE_URL} className="font-mono text-[12px] text-ink-2 hover:text-ink">
          view all on explorer →
        </a>
      </div>

      <FeedTable feed={feed} loading={loading} error={error} />
    </div>
  </section>
);

// =====================================================================
// Economics (For builders / For LPs)
// =====================================================================

const StatCallout = ({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit: string;
  sub: string;
}) => (
  <div className="border-t border-line pt-6">
    <div className="font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase mb-2">{label}</div>
    <div className="flex items-baseline gap-2">
      <span className="font-mono tabular text-[44px] font-semibold tracking-tighter text-accent">
        {value}
      </span>
      <span className="font-mono text-[14px] text-ink-3">{unit}</span>
    </div>
    <div className="font-mono text-[11px] text-ink-3 mt-1">{sub}</div>
  </div>
);

const BUILDER_BULLETS: ReadonlyArray<readonly [string, string]> = [
  ['no upfront SOL', 'protocol covers rent + fees'],
  ['fixed terms', '5–6% APR · 7 to 90 day terms'],
  ['no penalty', 'repay any time to claim authority'],
];

const LP_BULLETS: ReadonlyArray<readonly [string, string]> = [
  ['8–11% APY', '7-day trailing avg'],
  ['liquid shares', 'withdraw anytime · no lockup'],
  ['real backing', 'every loan secured by a deployed program'],
];

const BuilderCol = ({ stats }: { stats: ChainStats | null }) => (
  <div className="bg-bg-1 p-8 md:p-10">
    <div className="font-mono text-[11px] tracking-[0.12em] text-accent uppercase mb-4">
      FOR BUILDERS →
    </div>
    <h3 className="text-[26px] font-semibold tracking-tight mb-3">ship without fronting capital.</h3>
    <p className="text-[14px] text-ink-2 leading-[1.65] mb-8">
      Solana program deployment costs 2–6 SOL up front. We lend it. You pay back from your treasury, your token, or your runway.
    </p>

    <ul className="space-y-3 mb-10">
      {BUILDER_BULLETS.map(([t, d]) => (
        <li key={t} className="flex gap-3">
          <span className="text-accent shrink-0 mt-1">→</span>
          <div>
            <span className="font-medium">{t}</span>
            <span className="text-ink-3 ml-2 text-[13px]">— {d}</span>
          </div>
        </li>
      ))}
    </ul>

    <StatCallout
      label="AVG LOAN SIZE"
      value={stats ? stats.avgLoanSizeSol : PLACEHOLDER}
      unit="SOL"
      sub={stats ? `across ${stats.programsDeployed.toLocaleString()} deployments` : 'loading…'}
    />
  </div>
);

const LPCol = ({ stats }: { stats: ChainStats | null }) => (
  <div className="bg-bg-1 p-8 md:p-10">
    <div className="font-mono text-[11px] tracking-[0.12em] text-accent uppercase mb-4">
      FOR LPs ←
    </div>
    <h3 className="text-[26px] font-semibold tracking-tight mb-3">earn yield from real deployments.</h3>
    <p className="text-[14px] text-ink-2 leading-[1.65] mb-8">
      Deposit SOL. Earn from loan interest. Withdraw anytime — even mid-loan, your shares accrue continuously.
    </p>

    <ul className="space-y-3 mb-10">
      {LP_BULLETS.map(([t, d]) => (
        <li key={t} className="flex gap-3">
          <span className="text-accent shrink-0 mt-1">→</span>
          <div>
            <span className="font-medium">{t}</span>
            <span className="text-ink-3 ml-2 text-[13px]">— {d}</span>
          </div>
        </li>
      ))}
    </ul>

    <StatCallout
      label="CURRENT APY"
      value={stats ? stats.lpApy : PLACEHOLDER}
      unit="%"
      sub={stats ? `cumulative · ${stats.lpCount ?? '——'} LPs` : 'loading…'}
    />
  </div>
);

const Economics = ({ stats }: { stats: ChainStats | null }) => (
  <section id="economics" className="px-6 md:px-8 py-24">
    <div className="max-w-page mx-auto">
      <div className="mb-14 max-w-[640px]">
        <div className="mb-3">
          <Eyebrow>// 03 — economics</Eyebrow>
        </div>
        <h2 className="text-[40px] md:text-[52px] leading-[1.05] tracking-tighter font-semibold">
          a two-sided market with <span className="text-accent">aligned incentives</span>.
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-line border border-line rounded-lg overflow-hidden">
        <BuilderCol stats={stats} />
        <LPCol stats={stats} />
      </div>
    </div>
  </section>
);

// =====================================================================
// FAQ
// =====================================================================

const FAQ_ITEMS: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'who holds program authority during the loan?',
    a: 'A protocol-owned PDA holds upgrade authority for the duration. On full repayment, authority transfers to your wallet atomically. If you default, the protocol closes the program and reclaims the rent.',
  },
  {
    q: "what happens if i don't repay?",
    a: 'After expiry plus a 24-hour grace period, the protocol can close the program account and reclaim the SOL to repay LPs. There is no credit penalty — only loss of the deployed program.',
  },
  {
    q: 'is the protocol audited?',
    a: 'On devnet today. A formal audit is scheduled before mainnet — see the docs for the security roadmap.',
  },
  {
    q: 'why not just use a deploy bot?',
    a: 'Solignition is the deploy bot — but funded by a permissionless lending pool instead of your treasury. LPs earn yield, builders ship faster, and the protocol takes a small spread.',
  },
  {
    q: 'can i prepay or extend?',
    a: 'Prepay anytime, no penalty — interest is charged only for the days held. Extension (rollover) once per loan is supported, max +30 days, must be activated before expiry.',
  },
  {
    q: 'does this work for upgrades, or only first deploys?',
    a: 'First deploys today. Upgrade-loan support (deploy v2 of an existing program with reclaimed rent) is on the roadmap.',
  },
];

const FAQRow = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-5 text-left
                   hover:text-ink transition-colors"
      >
        <span className="text-[16px] font-medium pr-4">{q}</span>
        <span
          className={`font-mono text-[20px] text-ink-3 transition-transform ${
            open ? 'rotate-45' : ''
          }`}
        >
          +
        </span>
      </button>
      {open && (
        <p className="pb-5 text-[14px] leading-[1.7] text-ink-2 max-w-[640px]">{a}</p>
      )}
    </div>
  );
};

const FAQ = () => (
  <section className="px-6 md:px-8 py-24 bg-bg-1 border-y border-line">
    <div className="max-w-[820px] mx-auto">
      <div className="mb-10">
        <div className="mb-3">
          <Eyebrow>// 04 — faq</Eyebrow>
        </div>
        <h2 className="text-[40px] md:text-[48px] leading-[1.05] tracking-tighter font-semibold">
          questions, answered.
        </h2>
      </div>

      <div className="border-t border-line">
        {FAQ_ITEMS.map((item) => (
          <FAQRow key={item.q} {...item} />
        ))}
      </div>
    </div>
  </section>
);

// =====================================================================
// CTA Band
// =====================================================================

const CTABand = () => (
  <section className="px-6 md:px-8 py-20">
    <div className="max-w-page mx-auto">
      <div className="rounded-xl border border-accent-edge bg-accent-soft p-12 md:p-16 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative">
          <div className="mb-4">
            <Eyebrow pulse>// 05 — ready when you are</Eyebrow>
          </div>
          <h2 className="text-[40px] md:text-[64px] leading-[1.02] tracking-tightest font-semibold mb-6 max-w-[820px]">
            your <code className="text-accent font-mono">.so</code> is sitting in{' '}
            <code className="font-mono text-ink">target/deploy/</code>.
            <br />
            let&apos;s ship it.
          </h2>
          <div className="flex flex-wrap gap-3 mt-10">
            <a
              href={APP_URL}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)]
                         px-6 py-3.5 font-mono text-[14px] font-medium text-black
                         hover:bg-[var(--accent-2)] transition-colors"
            >
              launch app →
            </a>
            <a
              href={DOCS_URL}
              className="inline-flex items-center gap-2 rounded-md border border-line-2
                         bg-bg px-6 py-3.5 font-mono text-[14px] text-ink-2 hover:text-ink hover:border-line-3
                         transition-colors"
            >
              read the docs ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// =====================================================================
// Footer
// =====================================================================

const FooterCol = ({ title, links }: { title: string; links: [string, string][] }) => (
  <div>
    <div className="font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase mb-4">{title}</div>
    <ul className="space-y-2.5">
      {links.map(([label, href]) => (
        <li key={href}>
          <a href={href} className="text-[13px] text-ink-2 hover:text-ink transition-colors">
            {label}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

const Footer = () => (
  <footer className="border-t border-line px-6 md:px-8 py-12">
    <div className="max-w-page mx-auto">
      <div className="grid md:grid-cols-[2fr_1fr_1fr_1fr] gap-8 mb-10">
        <div>
          <a href="/" className="flex items-center gap-2.5 mb-4">
            <Logo />
            <span className="font-semibold tracking-tight">solignition</span>
          </a>
          <p className="text-[13px] text-ink-3 leading-[1.7] max-w-[320px]">
            A lending protocol for solana program deployment. Built by humans, lent by code.
          </p>
        </div>

        <FooterCol
          title="product"
          links={[
            ['app', APP_URL],
            ['docs', DOCS_URL],
            ['explore', EXPLORE_URL],
            ['cli', 'https://github.com/solignition/cli'],
          ]}
        />
        <FooterCol
          title="protocol"
          links={[
            ['program', 'https://solscan.io/account/SoLignXxxxx?cluster=devnet'],
            ['audit', 'https://docs.solignition.xyz/security'],
            ['github', 'https://github.com/solignition'],
          ]}
        />
        <FooterCol
          title="community"
          links={[
            ['twitter', 'https://twitter.com/solignition'],
            ['discord', 'https://discord.gg/solignition'],
            ['contact', 'mailto:hello@solignition.xyz'],
          ]}
        />
      </div>

      <div
        className="border-t border-line pt-6 flex flex-wrap items-center justify-between gap-4
                   font-mono text-[11px] text-ink-3"
      >
        <div>© 2026 solignition · devnet · v0.4.2</div>
        <div className="flex items-center gap-2">
          <PulseDot />
          <span>all systems operational</span>
        </div>
      </div>
    </div>
  </footer>
);

// =====================================================================
// Page
// =====================================================================

const SolignitionLanding = () => {
  const { stats, feed, loading, error } = useChainData();
  return (
    <div className="min-h-screen bg-bg text-ink">
      <Nav />
      <Hero stats={stats} />
      <HowItWorks />
      <LiveDeployments feed={feed} loading={loading} error={error} />
      <Economics stats={stats} />
      <FAQ />
      <CTABand />
      <Footer />
    </div>
  );
};

export default SolignitionLanding;

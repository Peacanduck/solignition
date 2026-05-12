import type { ComponentType } from 'react'

export interface PageMeta {
  slug: string
  title: string
  description?: string
  Component: ComponentType
  headings: { id: string; label: string }[]
  rawText: string
}

interface MdxModule {
  default: ComponentType
  frontmatter?: { title?: string; description?: string }
  tableOfContents?: { id: string; label: string }[]
  rawText?: string
}

const modules = import.meta.glob<MdxModule>('./**/*.mdx', { eager: true })

// './get-started/intro.mdx' → '/get-started/intro'
// './get-started/index.mdx' → '/get-started'
const toSlug = (path: string) =>
  path.replace(/^\.\//, '/').replace(/\.mdx$/, '').replace(/\/index$/, '')

export const PAGES: Record<string, PageMeta> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => {
    const slug = toSlug(path)
    return [
      slug,
      {
        slug,
        title: mod.frontmatter?.title ?? slug,
        description: mod.frontmatter?.description,
        Component: mod.default,
        headings: mod.tableOfContents ?? [],
        rawText: mod.rawText ?? '',
      },
    ]
  }),
)

export interface NavItem {
  slug: string
  title: string
}

export interface NavGroup {
  section: string
  items: NavItem[]
}

export const NAV_TREE: NavGroup[] = [
  {
    section: 'Get started',
    items: [
      { slug: '/get-started/intro', title: 'Introduction' },
      { slug: '/get-started/quickstart', title: 'Quickstart' },
      { slug: '/get-started/cli-install', title: 'Install the CLI' },
    ],
  },
  {
    section: 'For builders',
    items: [
      { slug: '/builders/borrow-flow', title: 'Borrow & deploy' },
      { slug: '/builders/authority', title: 'Upgrade authority' },
      { slug: '/builders/repay', title: 'Repaying loans' },
      { slug: '/builders/default', title: 'What if I default?' },
    ],
  },
  {
    section: 'For LPs',
    items: [
      { slug: '/lps/deposit', title: 'Deposit SOL' },
      { slug: '/lps/shares', title: 'Shares & yield' },
      { slug: '/lps/withdraw', title: 'Withdrawing' },
    ],
  },
  {
    section: 'Protocol',
    items: [
      { slug: '/protocol/mechanics', title: 'How it works' },
      { slug: '/protocol/interest', title: 'Interest math' },
      { slug: '/protocol/lifecycle', title: 'Loan lifecycle' },
      { slug: '/protocol/fees', title: 'Fees & treasury' },
    ],
  },
  {
    section: 'Reference',
    items: [
      { slug: '/reference/program', title: 'On-chain program' },
      { slug: '/reference/accounts', title: 'Account types' },
      { slug: '/reference/errors', title: 'Error codes' },
    ],
  },
]

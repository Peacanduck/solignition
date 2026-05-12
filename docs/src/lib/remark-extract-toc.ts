import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import GithubSlugger from 'github-slugger'
import { parse } from 'acorn'
import type { Plugin } from 'unified'
import type { Root } from 'mdast'

interface TocItem { id: string; label: string }

// Walks H2 headings, builds a list, and injects:
//   export const tableOfContents = [...]
// at the top of the MDX module so each page exposes its own TOC.
export const remarkExtractToc: Plugin<[], Root> = () => tree => {
  const slugger = new GithubSlugger()
  const items: TocItem[] = []

  visit(tree, 'heading', node => {
    if (node.depth !== 2) return
    const label = toString(node)
    items.push({ id: slugger.slug(label), label })
  })

  const code = `export const tableOfContents = ${JSON.stringify(items)};`
  const estree = parse(code, { sourceType: 'module', ecmaVersion: 'latest' })

  tree.children.unshift({
    // mdxjsEsm is added by remark-mdx; cast to satisfy mdast's RootContent.
    type: 'mdxjsEsm',
    value: code,
    data: { estree },
  } as unknown as Root['children'][number])
}

import { toString } from 'mdast-util-to-string'
import { parse } from 'acorn'
import type { Plugin } from 'unified'
import type { Root } from 'mdast'

// Joins all text nodes into one string and injects:
//   export const rawText = "..."
// at the top of the MDX module. Used by the search index.
export const remarkExtractRawText: Plugin<[], Root> = () => tree => {
  const text = toString(tree).replace(/\s+/g, ' ').trim()

  const code = `export const rawText = ${JSON.stringify(text)};`
  const estree = parse(code, { sourceType: 'module', ecmaVersion: 'latest' })

  tree.children.unshift({
    type: 'mdxjsEsm',
    value: code,
    data: { estree },
  } as unknown as Root['children'][number])
}

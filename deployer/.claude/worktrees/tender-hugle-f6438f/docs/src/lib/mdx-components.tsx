import { Children, isValidElement, type ReactNode } from 'react'
import type { MDXComponents } from 'mdx/types'
import { Callout } from '../components/Callout'
import { CodeBlock } from '../components/CodeBlock'
import { DocCards, DocCard } from '../components/DocCards'
import { NextSteps } from '../components/NextSteps'

// rehype-pretty-code emits <pre data-language="bash" data-theme="...">
//   <code data-language="bash">...spans...</code>
// </pre>
// We unwrap it into our own <CodeBlock> chrome.
const flattenChildren = (node: ReactNode): string => {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flattenChildren).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return flattenChildren(node.props.children)
  }
  return ''
}

const PreToCodeBlock = (props: {
  children?: ReactNode
  ['data-language']?: string
  ['data-title']?: string
}) => {
  // The fenced code's <code> element is the single child of <pre>.
  const codeEl = Children.toArray(props.children).find(
    (c): c is React.ReactElement<{
      children?: ReactNode
      ['data-language']?: string
      ['data-title']?: string
    }> => isValidElement(c),
  )

  const lang = props['data-language'] ?? codeEl?.props['data-language']
  const title = props['data-title'] ?? codeEl?.props['data-title']
  const raw = codeEl ? flattenChildren(codeEl.props.children) : ''

  return (
    <CodeBlock title={title} lang={lang} rawCode={raw}>
      {codeEl ? codeEl.props.children : props.children}
    </CodeBlock>
  )
}

export const mdxComponents: MDXComponents = {
  Callout,
  CodeBlock,
  DocCards,
  DocCard,
  NextSteps,
  pre: PreToCodeBlock as MDXComponents['pre'],
}

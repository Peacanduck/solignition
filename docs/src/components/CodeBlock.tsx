import { useState, type ReactNode } from 'react'

interface Props {
  title?: string
  lang?: string
  rawCode?: string
  children: ReactNode
}

export const CodeBlock = ({ title, rawCode, children }: Props) => {
  const [copied, setCopied] = useState(false)

  const onCopy = () => {
    if (!rawCode) return
    navigator.clipboard.writeText(rawCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <div className="border border-line rounded-md overflow-hidden my-4 bg-bg-1">
      {(title || rawCode) && (
        <div className="flex justify-between items-center px-3 py-1.5 bg-bg-2 border-b border-line text-[11px] font-mono">
          <span className="text-ink-4">{title ?? ''}</span>
          {rawCode && (
            <button
              type="button"
              onClick={onCopy}
              className="px-2 py-0.5 border border-line-2 rounded text-[10px] text-ink-3
                         font-mono hover:text-ink hover:border-line-3 transition-colors"
            >
              {copied ? 'copied' : 'copy'}
            </button>
          )}
        </div>
      )}
      <pre className="m-0 px-4 py-4 font-mono text-[12.5px] leading-[1.7] text-ink-2 overflow-x-auto whitespace-pre">
        <code>{children}</code>
      </pre>
    </div>
  )
}

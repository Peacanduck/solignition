import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import { remarkExtractToc } from './src/lib/remark-extract-toc'
import { remarkExtractRawText } from './src/lib/remark-extract-raw-text'

// The yarn workspace hoists `vite` to multiple locations, so the rollup-Plugin
// types coming through @mdx-js/rollup and @vitejs/plugin-react don't compare
// equal even though runtime they're fine. Cast through `unknown` to bypass.
const plugins = [
  {
    enforce: 'pre' as const,
    ...mdx({
      remarkPlugins: [
        remarkGfm,
        remarkFrontmatter,
        [remarkMdxFrontmatter, { name: 'frontmatter' }],
        remarkExtractToc,
        remarkExtractRawText,
      ],
      rehypePlugins: [
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: 'wrap' }],
        [
          rehypePrettyCode,
          {
            theme: 'github-dark-default',
            keepBackground: false,
            defaultLang: { block: 'plain', inline: 'plain' },
          },
        ],
      ],
      providerImportSource: '@mdx-js/react',
    }),
  },
  react({
    babel: {
      plugins: [['babel-plugin-react-compiler']],
    },
  }),
] as unknown as Parameters<typeof defineConfig>[0]['plugins']

// https://vite.dev/config/
export default defineConfig({
  plugins,
  server: { port: 5174 },
})

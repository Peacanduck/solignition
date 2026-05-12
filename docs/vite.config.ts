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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
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
  ],
  server: { port: 5174 },
})

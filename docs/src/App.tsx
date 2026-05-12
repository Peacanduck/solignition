import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MDXProvider } from '@mdx-js/react'
import { DocsLayout } from './components/DocsLayout'
import { DocsArticle } from './components/DocsArticle'
import { NotFound } from './components/NotFound'
import { mdxComponents } from './lib/mdx-components'
import { PAGES } from './content'
import { SearchProvider } from './lib/search-context'

export default function App() {
  return (
    <BrowserRouter>
      <MDXProvider components={mdxComponents}>
        <SearchProvider>
          <Routes>
            <Route element={<DocsLayout />}>
              <Route index element={<Navigate to="/get-started/intro" replace />} />
              {Object.values(PAGES).map(page => {
                const Component = page.Component
                return (
                  <Route
                    key={page.slug}
                    path={page.slug}
                    element={
                      <DocsArticle slug={page.slug} headings={page.headings}>
                        <Component />
                      </DocsArticle>
                    }
                  />
                )
              })}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </SearchProvider>
      </MDXProvider>
    </BrowserRouter>
  )
}

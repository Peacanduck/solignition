import { Link } from 'react-router-dom'

export const NotFound = () => (
  <>
    <article className="min-w-0 max-w-article">
      <div className="prose-doc">
        <h1>Page not found</h1>
        <p>
          That URL doesn&apos;t exist in these docs. It may have been moved or never written.
        </p>
        <p>
          <Link to="/get-started/intro">← Back to Introduction</Link>
        </p>
      </div>
    </article>
    <div />
  </>
)

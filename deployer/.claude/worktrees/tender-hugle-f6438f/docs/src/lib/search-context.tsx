import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { SearchModal } from '../components/SearchModal'

interface SearchCtx {
  isOpen: boolean
  open: () => void
  close: () => void
}

const Ctx = createContext<SearchCtx | null>(null)

export const SearchProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setOpen] = useState(false)
  const open = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Ctx.Provider value={{ isOpen, open, close }}>
      {children}
      <SearchModal />
    </Ctx.Provider>
  )
}

export const useSearch = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSearch outside provider')
  return c
}

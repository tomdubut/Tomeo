"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, X, Loader2 } from "lucide-react"
import { importBook } from "@/app/(main)/books/actions"
import BookCover from "@/components/books/BookCover"

type LibraryStatus = "want_to_read" | "currently_reading" | "read"

const STATUS_LABELS: Record<LibraryStatus, string> = {
  read: "Lu",
  currently_reading: "En cours",
  want_to_read: "À lire",
}

type SearchResult =
  | { source: "tomeo"; id: string; title: string; authors: string[]; cover_url: string | null; libraryStatus?: string | null }
  | { source: "google"; google_books_id: string; title: string; authors: string[]; cover_url: string | null; isbn_13?: string | null; libraryStatus?: string | null }

export default function SearchModal() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [isMac, setIsMac] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC") || navigator.userAgent.includes("Mac"))
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery("")
      setResults([])
      setLoading(false)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const { results: data } = await res.json()
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(() => search(q), 350)
  }

  async function selectResult(book: SearchResult) {
    const key = book.source === "tomeo" ? book.id : book.google_books_id
    setImporting(key)
    try {
      if (book.source === "tomeo") {
        setOpen(false)
        router.push(`/books/${book.id}`)
      } else {
        const { id } = await importBook(book.google_books_id)
        setOpen(false)
        router.push(`/books/${id}`)
      }
    } finally {
      setImporting(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false)
  }

  const hasResults = results.length > 0
  const showEmpty = query.length >= 2 && !loading && !hasResults

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
        style={{ color: "rgba(245,239,230,0.85)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
        aria-label={`Rechercher (${isMac ? "⌘K" : "Ctrl+K"})`}
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Rechercher</span>
        <kbd className="hidden md:inline-flex items-center rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-mono text-white/40">
          {isMac ? "⌘K" : "Ctrl+K"}
        </kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
          onMouseDown={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Floating panel — no card background */}
          <div
            className="relative w-full max-w-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 backdrop-blur-xl" style={{ background: "rgba(30,20,10,0.55)", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.12)" }}>
              {loading ? (
                <Loader2 className="h-4 w-4 shrink-0 text-white/50 animate-spin" />
              ) : (
                <Search className="h-4 w-4 shrink-0 text-white/50" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={handleQueryChange}
                onKeyDown={handleKeyDown}
                placeholder="Titre, auteur, ISBN…"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                enterKeyHint="search"
              />
              {query ? (
                <button onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus() }} className="text-white/40 hover:text-white/80 transition-colors" aria-label="Effacer">
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white/80 transition-colors" aria-label="Fermer">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Results */}
            {(hasResults || showEmpty || (query.length < 2)) && (
              <div className="mt-2 rounded-2xl overflow-hidden backdrop-blur-xl" style={{ background: "rgba(30,20,10,0.55)", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.10)" }}>
                {hasResults && (
                  <div className="max-h-[55vh] overflow-y-auto p-4">
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                      {results.map((book) => {
                        const key = book.source === "tomeo" ? book.id : book.google_books_id
                        const isImporting = importing === key
                        return (
                          <button
                            key={key}
                            onClick={() => selectResult(book)}
                            disabled={importing !== null}
                            className="group text-left disabled:opacity-60"
                          >
                            <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden">
                              <BookCover
                                src={book.cover_url}
                                title={book.title}
                                author={book.authors[0]}
                                isbn={book.source === "google" ? book.isbn_13 ?? undefined : undefined}
                                googleBooksId={book.source === "google" ? book.google_books_id : undefined}
                                className="w-full h-full group-hover:opacity-80 transition-opacity"
                                sizes="120px"
                              />
                              {book.libraryStatus && !isImporting && (
                                <span
                                  className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none z-10"
                                  style={{ background: "#e8650a", color: "#fff" }}
                                >
                                  {STATUS_LABELS[book.libraryStatus as LibraryStatus] ?? book.libraryStatus}
                                </span>
                              )}
                              {isImporting && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                                </div>
                              )}
                            </div>
                            <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-tight text-white group-hover:underline">
                              {book.title}
                            </p>
                            {book.authors[0] && (
                              <p className="truncate text-[11px] text-white/50">{book.authors[0]}</p>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {showEmpty && (
                  <p className="px-4 py-10 text-center text-sm text-white/50">
                    Aucun résultat pour «&nbsp;{query}&nbsp;»
                  </p>
                )}

                {query.length < 2 && (
                  <p className="px-4 py-8 text-center text-xs text-white/40">
                    Recherchez parmi des millions de livres
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

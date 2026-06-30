"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, X, Loader2 } from "lucide-react"
import { importBook } from "@/app/(main)/books/actions"
import BookCover from "@/components/books/BookCover"

type SearchResult =
  | { source: "tomeo"; id: string; title: string; authors: string[]; cover_url: string | null }
  | { source: "google"; google_books_id: string; title: string; authors: string[]; cover_url: string | null; isbn_13?: string | null }

export default function SearchModal() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [importing, setImporting] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC") || navigator.userAgent.includes("Mac"))
  }, [])

  // Global keyboard shortcut ⌘K / Ctrl+K
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

  // Focus input when modal opens, reset state when it closes
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery("")
      setResults([])
      setActiveIndex(-1)
      setLoading(false)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
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
    setActiveIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
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
    if (e.key === "Enter") (e.target as HTMLInputElement).blur()
  }

  return (
    <>
      {/* Trigger button — shown in the navbar */}
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

          <div
            className="relative w-full max-w-xl rounded-2xl overflow-hidden"
            style={{ background: "var(--card)", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Search input row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[--border]">
              {loading ? (
                <Loader2 className="h-4 w-4 shrink-0 text-[--muted-foreground] animate-spin" />
              ) : (
                <Search className="h-4 w-4 shrink-0 text-[--muted-foreground]" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={handleQueryChange}
                onKeyDown={handleKeyDown}
                placeholder="Titre, auteur, ISBN…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[--muted-foreground]"
                enterKeyHint="search"
              />
              <button
                onClick={() => setOpen(false)}
                className="text-[--muted-foreground] transition-colors hover:text-[--foreground]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results grid */}
            {results.length > 0 && (
              <div className="max-h-[60vh] overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {results.map((book, i) => {
                    const key = book.source === "tomeo" ? book.id : book.google_books_id
                    const isImporting = importing === key
                    return (
                      <button
                        key={key}
                        onClick={() => selectResult(book)}
                        onMouseEnter={() => setActiveIndex(i)}
                        onMouseLeave={() => setActiveIndex(-1)}
                        disabled={importing !== null}
                        className="group text-left disabled:opacity-60"
                      >
                        <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                          <BookCover
                            src={book.cover_url}
                            title={book.title}
                            author={book.authors[0]}
                            isbn={book.source === "google" ? book.isbn_13 ?? undefined : undefined}
                            googleBooksId={book.source === "google" ? book.google_books_id : undefined}
                            className="w-full h-full group-hover:opacity-80 transition-opacity"
                            sizes="120px"
                          />
                          {book.source === "tomeo" && (
                            <div className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: "var(--primary)", color: "#fff" }}>
                              Tomeo
                            </div>
                          )}
                          {isImporting && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Loader2 className="h-5 w-5 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-tight group-hover:underline">
                          {book.title}
                        </p>
                        {book.authors[0] && (
                          <p className="truncate text-[11px] text-[--muted-foreground]">{book.authors[0]}</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* No results */}
            {query.length >= 2 && !loading && results.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-[--muted-foreground]">
                Aucun résultat pour «&nbsp;{query}&nbsp;»
              </p>
            )}

            {/* Empty prompt */}
            {query.length < 2 && (
              <p className="px-4 py-8 text-center text-xs text-[--muted-foreground]">
                Recherchez parmi des millions de livres
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

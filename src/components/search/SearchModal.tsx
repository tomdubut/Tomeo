"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Search, X, BookOpen, Loader2 } from "lucide-react"
import { importBook } from "@/app/(main)/books/actions"

type SearchResult = {
  google_books_id: string
  title: string
  authors: string[]
  cover_url: string | null
}

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
      const data: SearchResult[] = await res.json()
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

  async function selectResult(googleBooksId: string) {
    setImporting(googleBooksId)
    try {
      const { id } = await importBook(googleBooksId)
      setOpen(false)
      router.push(`/books/${id}`)
    } finally {
      setImporting(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      selectResult(results[activeIndex].google_books_id)
    }
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
        aria-label="Rechercher (⌘K)"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Rechercher</span>
        <kbd className="hidden md:inline-flex items-center rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-mono text-white/40">
          ⌘K
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
              />
              <button
                onClick={() => setOpen(false)}
                className="text-[--muted-foreground] transition-colors hover:text-[--foreground]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results list */}
            {results.length > 0 && (
              <ul className="max-h-[60vh] overflow-y-auto py-2">
                {results.map((book, i) => {
                  const isActive = i === activeIndex
                  const isImporting = importing === book.google_books_id
                  return (
                    <li key={book.google_books_id}>
                      <button
                        onClick={() => selectResult(book.google_books_id)}
                        onMouseEnter={() => setActiveIndex(i)}
                        disabled={importing !== null}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors disabled:opacity-60"
                        style={{ background: isActive ? "var(--secondary)" : undefined }}
                      >
                        <div className="h-11 w-8 shrink-0 overflow-hidden rounded bg-[--secondary]">
                          {book.cover_url ? (
                            <Image
                              src={book.cover_url}
                              alt={book.title}
                              width={32}
                              height={44}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <BookOpen className="h-3.5 w-3.5 text-[--muted-foreground]" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{book.title}</p>
                          {book.authors[0] && (
                            <p className="truncate text-xs text-[--muted-foreground]">{book.authors[0]}</p>
                          )}
                        </div>
                        {isImporting && (
                          <Loader2 className="h-4 w-4 shrink-0 text-[--muted-foreground] animate-spin" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
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

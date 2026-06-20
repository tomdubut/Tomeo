"use client"

import { useState, useTransition, useEffect } from "react"
import Image from "next/image"
import { importBook } from "@/app/(main)/books/actions"
import { addBookToList } from "@/app/(main)/lists/actions"
import { Input } from "@/components/ui/input"
import { BookOpen, Check, Loader2, Plus, Search } from "lucide-react"
import { useDebounce } from "@/hooks/useDebounce"

interface SearchResult {
  google_books_id: string
  title: string
  authors: string[]
  cover_url: string | null
}

interface Props {
  listId: string
  existingBookIds: string[]
}

function BookGrid({ books, addedIds, addingId, isPending, onAdd }: {
  books: SearchResult[]
  addedIds: Set<string>
  addingId: string | null
  isPending: boolean
  onAdd: (book: SearchResult) => void
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {books.map((book) => {
        const alreadyAdded = addedIds.has(book.google_books_id)
        const isAdding = addingId === book.google_books_id && isPending
        return (
          <button
            key={book.google_books_id}
            onClick={() => !alreadyAdded && !isPending && onAdd(book)}
            disabled={alreadyAdded || isPending}
            className="group relative text-left"
          >
            <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[--secondary]">
              {book.cover_url ? (
                <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized sizes="(max-width: 640px) 33vw, 25vw" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <BookOpen className="h-6 w-6 text-[--muted-foreground]" />
                </div>
              )}

              {/* Hover overlay — add */}
              {!alreadyAdded && !isAdding && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <Plus className="h-8 w-8 text-white" />
                </div>
              )}

              {/* Adding spinner */}
              {isAdding && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}

              {/* Already added */}
              {alreadyAdded && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                  <Check className="h-8 w-8 text-white" strokeWidth={3} />
                </div>
              )}
            </div>

            <p className="mt-1.5 text-xs font-medium line-clamp-2 leading-snug">{book.title}</p>
            {book.authors[0] && (
              <p className="text-xs text-[--muted-foreground] line-clamp-1">{book.authors[0]}</p>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function AddBookToListPanel({ listId, existingBookIds }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [fallback, setFallback] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const debouncedQuery = useDebounce(query, 400)

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); setFallback([]); return }
    setSearching(true)
    fetch(`/api/books/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data) => { setResults(data.results ?? []); setFallback(data.fallback ?? []) })
      .catch(() => { setResults([]); setFallback([]) })
      .finally(() => setSearching(false))
  }, [debouncedQuery])

  function add(book: SearchResult) {
    setAddingId(book.google_books_id)
    startTransition(async () => {
      const { id: bookId } = await importBook(book.google_books_id)
      await addBookToList(listId, bookId)
      setAddedIds((prev) => new Set([...prev, book.google_books_id]))
      setAddingId(null)
    })
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        {searching ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--muted-foreground] animate-spin" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--muted-foreground]" />
        )}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
          placeholder="Rechercher un livre à ajouter…"
          className="pl-9"
          enterKeyHint="search"
        />
      </div>

      {(results.length > 0 || fallback.length > 0) && (
        <div className="space-y-4">
          {results.length > 0 && (
            <BookGrid books={results} addedIds={addedIds} addingId={addingId} isPending={isPending} onAdd={add} />
          )}
          {fallback.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-[--border]" />
                <span className="text-xs text-[--muted-foreground]">Autres langues</span>
                <div className="h-px flex-1 bg-[--border]" />
              </div>
              <BookGrid books={fallback} addedIds={addedIds} addingId={addingId} isPending={isPending} onAdd={add} />
            </>
          )}
        </div>
      )}

      {!searching && query && results.length === 0 && fallback.length === 0 && (
        <p className="text-sm text-center text-[--muted-foreground] py-4">Aucun résultat pour &ldquo;{query}&rdquo;</p>
      )}
    </div>
  )
}

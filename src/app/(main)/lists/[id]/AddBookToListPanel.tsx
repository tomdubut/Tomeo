"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { searchGoogleBooks, normaliseVolume } from "@/lib/api/google-books"
import { importBook } from "@/app/(main)/books/actions"
import { addBookToList } from "@/app/(main)/lists/actions"
import { Input } from "@/components/ui/input"
import { BookOpen, Loader2, Plus, Search } from "lucide-react"
import { useDebounce } from "@/hooks/useDebounce"
import { useEffect, useState as useS } from "react"

interface Props {
  listId: string
  existingBookIds: string[]
}

type SearchResult = ReturnType<typeof normaliseVolume>

export default function AddBookToListPanel({ listId, existingBookIds }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const debouncedQuery = useDebounce(query, 400)

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return }
    setSearching(true)
    searchGoogleBooks(debouncedQuery, { maxResults: 8 })
      .then((data) => setResults((data.items ?? []).map(normaliseVolume)))
      .catch(() => setResults([]))
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
    <div className="space-y-3">
      <div className="relative">
        {searching ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--muted-foreground] animate-spin" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--muted-foreground]" />
        )}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un livre à ajouter…"
          className="pl-9"
        />
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border border-[--border] bg-[--card] divide-y divide-[--border] overflow-hidden">
          {results.map((book) => {
            const alreadyAdded = addedIds.has(book.google_books_id)
            const isAdding = addingId === book.google_books_id && isPending

            return (
              <div key={book.google_books_id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 aspect-[2/3] relative shrink-0 rounded overflow-hidden bg-[--secondary]">
                  {book.cover_url ? (
                    <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized sizes="32px" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-3 w-3 text-[--muted-foreground]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{book.title}</p>
                  {book.authors[0] && (
                    <p className="text-xs text-[--muted-foreground]">{book.authors[0]}</p>
                  )}
                </div>
                <button
                  onClick={() => !alreadyAdded && add(book)}
                  disabled={alreadyAdded || isAdding || isPending}
                  className="shrink-0 rounded-full p-1.5 transition-colors disabled:opacity-50 hover:bg-[--secondary]"
                  aria-label="Ajouter"
                >
                  {isAdding ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[--muted-foreground]" />
                  ) : alreadyAdded ? (
                    <span className="text-xs text-green-600 font-medium px-1">Ajouté</span>
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

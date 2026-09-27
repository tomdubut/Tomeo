"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import BookCover from "@/components/books/BookCover"

type GoogleBook = {
  source: "google"
  google_books_id: string
  title: string
  authors: string[]
  cover_url: string | null
  isbn_13?: string | null
}

interface Props {
  query: string
  initialOffset: number
  initialHasMore: boolean
  shownIds?: string[]
}

export default function SearchLoadMore({ query, initialOffset, initialHasMore, shownIds = [] }: Props) {
  const [offset, setOffset] = useState(initialOffset)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [books, setBooks] = useState<GoogleBook[]>([])
  const [loading, setLoading] = useState(false)
  const seenIds = useRef(new Set<string>(shownIds))
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setBooks([])
    setOffset(initialOffset)
    setHasMore(initialHasMore)
    seenIds.current = new Set<string>(shownIds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    if (!hasMore || loading) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: "400px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, offset])

  async function loadMore() {
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&offset=${offset}`)
      const { results, hasMore: more } = await res.json()
      const googleOnly = (results as (GoogleBook & { source: string })[])
        .filter((b) => b.source === "google" && !seenIds.current.has(b.google_books_id))
      googleOnly.forEach((b) => seenIds.current.add(b.google_books_id))
      setBooks((prev) => [...prev, ...googleOnly])
      setOffset((o) => o + 20)
      setHasMore(more)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {books.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {books.map((book) => (
            <Link
              key={book.google_books_id}
              href={`/books/preview/${book.google_books_id}`}
              className="group text-left"
            >
              <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-[--secondary] relative" style={{ boxShadow: "var(--shadow-sm)" }}>
                <BookCover
                  src={book.cover_url}
                  title={book.title}
                  author={book.authors[0]}
                  isbn={book.isbn_13 ?? undefined}
                  googleBooksId={book.google_books_id}
                  className="w-full h-full group-hover:opacity-80 transition-opacity"
                  sizes="160px"
                />
              </div>
              <p className="mt-2 text-xs font-semibold leading-tight line-clamp-2 group-hover:underline">{book.title}</p>
              {book.authors[0] && <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{book.authors[0]}</p>}
            </Link>
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading && <Loader2 className="h-5 w-5 animate-spin text-[--muted-foreground]" />}
        </div>
      )}
    </>
  )
}

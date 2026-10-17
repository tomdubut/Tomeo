"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import BookCover from "@/components/books/BookCover"
import { ReadingStatusBadge } from "@/components/ui/badge"
import { loadMoreLibraryBooks, type LibraryBookCard } from "@/app/(main)/users/[username]/library/actions"

function BookCard({ ub }: { ub: LibraryBookCard }) {
  const book = ub.book
  if (!book) return null
  const authors = (book.book_authors ?? [])
    .filter((ba) => ba.role === "author")
    .sort((a, b) => a.display_order - b.display_order)
    .map((ba) => ba.author?.name)
    .filter((n): n is string => !!n)

  return (
    <Link href={`/books/${book.id}`} className="group">
      <div className="relative mb-2 aspect-[2/3] overflow-hidden rounded-xl bg-secondary shadow-card">
        <BookCover
          src={book.cover_url}
          title={book.title}
          author={authors[0]}
          className="h-full w-full transition-opacity group-hover:opacity-90"
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
        />
        <ReadingStatusBadge status={ub.status} className="absolute bottom-1.5 left-1.5" />
      </div>
      <p className="text-xs font-semibold line-clamp-2 group-hover:underline leading-tight">{book.title}</p>
      {authors[0] && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{authors[0]}</p>}
      {ub.rating !== undefined && (
        <p className="mt-0.5 text-xs font-semibold text-primary">★ {ub.rating}</p>
      )}
      {ub.status === "read" && ub.finished_at && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {new Date(ub.finished_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
        </p>
      )}
    </Link>
  )
}

interface Props {
  initialBooks: LibraryBookCard[]
  profileId: string
  orderedBookIds: string[]
  ratingByBook: Record<string, number>
  pageSize: number
}

export default function LoadMoreLibrary({ initialBooks, profileId, orderedBookIds, ratingByBook, pageSize }: Props) {
  const [books, setBooks] = useState<LibraryBookCard[]>(initialBooks)
  const [offset, setOffset] = useState(initialBooks.length)
  const [isPending, startTransition] = useTransition()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const hasMore = offset < orderedBookIds.length

  useEffect(() => {
    if (!hasMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isPending) {
          startTransition(async () => {
            const next = await loadMoreLibraryBooks({ profileId, orderedBookIds, offset, pageSize, ratingByBook })
            setBooks((prev) => [...prev, ...next])
            setOffset((prev) => prev + next.length)
          })
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isPending, offset, orderedBookIds, pageSize, profileId, ratingByBook])

  return (
    <>
      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-5 lg:grid-cols-6">
        {books.map((ub) => (
          <BookCard key={ub.book_id} ub={ub} />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {isPending && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>
      )}
    </>
  )
}

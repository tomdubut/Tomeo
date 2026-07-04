"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { BookOpen, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { loadMoreLibraryBooks, type LibraryBookCard } from "@/app/(main)/users/[username]/library/actions"

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    read: { label: "Lu", className: "bg-green-600 text-white" },
    currently_reading: { label: "En cours", className: "bg-blue-600 text-white" },
    want_to_read: { label: "À lire", className: "bg-black/50 text-white" },
  }
  const badge = map[status]
  if (!badge) return null
  return (
    <span className={cn("rounded-lg px-1.5 py-0.5 text-[10px] font-bold", badge.className)}>
      {badge.label}
    </span>
  )
}

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
      <div className="aspect-[2/3] relative rounded-xl overflow-hidden bg-[--secondary] mb-2" style={{ boxShadow: "var(--shadow-sm)" }}>
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={`Couverture de ${book.title}`}
            fill
            className="object-cover group-hover:opacity-90 transition-opacity"
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-[--muted-foreground]" />
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5">
          <StatusBadge status={ub.status} />
        </div>
      </div>
      <p className="text-xs font-semibold line-clamp-2 group-hover:underline leading-tight">{book.title}</p>
      {authors[0] && <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{authors[0]}</p>}
      {ub.rating !== undefined && (
        <p className="text-xs text-[--primary] font-semibold mt-0.5">★ {ub.rating}</p>
      )}
      {ub.status === "read" && ub.finished_at && (
        <p className="text-xs text-[--muted-foreground] mt-0.5">
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
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {books.map((ub) => (
          <BookCard key={ub.book_id} ub={ub} />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {isPending && <Loader2 className="h-5 w-5 animate-spin text-[--muted-foreground]" />}
        </div>
      )}
    </>
  )
}

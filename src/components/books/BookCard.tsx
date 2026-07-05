"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { importBook } from "@/app/(main)/books/actions"
import BookCover from "./BookCover"
import { normaliseVolume } from "@/lib/api/google-books"
import { Loader2, AlertCircle } from "lucide-react"

type Book = ReturnType<typeof normaliseVolume>
type LibraryStatus = "want_to_read" | "currently_reading" | "read"

const STATUS_LABELS: Record<LibraryStatus, string> = {
  read: "Lu",
  currently_reading: "En cours",
  want_to_read: "À lire",
}

interface Props {
  book: Book
  status?: LibraryStatus
}

export default function BookCard({ book, status }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState(false)

  function handleClick() {
    if (error) setError(false)
    startTransition(async () => {
      try {
        const { id } = await importBook(book.google_books_id)
        router.push(`/books/${id}`)
      } catch {
        setError(true)
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="group text-left w-full disabled:opacity-60"
    >
      <div className="relative aspect-[2/3] w-full mb-2">
        <BookCover src={book.cover_url} title={book.title} author={book.authors[0]} isbn={book.isbn_13 ?? book.isbn_10 ?? undefined} googleBooksId={book.google_books_id} className="w-full h-full" />
        {status && !isPending && (
          <span
            className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none z-10"
            style={{ background: "#e8650a", color: "#fff" }}
          >
            {STATUS_LABELS[status]}
          </span>
        )}
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
        {error && !isPending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-md gap-1 px-2">
            <AlertCircle className="h-5 w-5 text-white" />
            <p className="text-white text-xs text-center font-medium">Réessayer</p>
          </div>
        )}
      </div>
      <p className="text-sm font-medium line-clamp-2 group-hover:underline leading-tight">
        {book.title}
      </p>
      {book.authors.length > 0 && (
        <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">
          {book.authors[0]}
        </p>
      )}
    </button>
  )
}

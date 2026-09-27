"use client"

import Link from "next/link"
import BookCover from "./BookCover"
import { normaliseVolume } from "@/lib/api/google-books"

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
  return (
    <Link href={`/books/preview/${book.google_books_id}`} className="group text-left w-full">
      <div className="relative aspect-[2/3] w-full mb-2">
        <BookCover src={book.cover_url} title={book.title} author={book.authors[0]} isbn={book.isbn_13 ?? book.isbn_10 ?? undefined} googleBooksId={book.google_books_id} className="w-full h-full" />
        {status && (
          <span
            className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none z-10"
            style={{ background: "#e8650a", color: "#fff" }}
          >
            {STATUS_LABELS[status]}
          </span>
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
    </Link>
  )
}

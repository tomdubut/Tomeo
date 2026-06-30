"use client"

import { useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { BookOpen, Trash2 } from "lucide-react"
import { removeBookFromList } from "@/app/(main)/lists/actions"
import type { BookSummary } from "@/lib/types"

interface Item {
  position: number
  note: string | null
  book: BookSummary | null
}

interface Props {
  listId: string
  items: Item[]
  isOwner: boolean
}

function ListBookCard({ listId, item, isOwner }: { listId: string; item: Item; isOwner: boolean }) {
  const [isPending, startTransition] = useTransition()
  const { book } = item
  if (!book) return null

  const authors = (book.book_authors ?? [])
    .filter((ba) => ba.role === "author")
    .sort((a, b) => a.display_order - b.display_order)
    .map((ba) => ba.author?.name)
    .filter((n): n is string => !!n)

  function remove() {
    startTransition(async () => {
      await removeBookFromList(listId, book!.id)
    })
  }

  return (
    <div className="group relative">
      <Link href={`/books/${book.id}`}>
        <div className="aspect-[2/3] relative rounded-xl overflow-hidden bg-[--secondary] mb-2">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={book.title}
              fill
              className="object-cover group-hover:opacity-90 transition-opacity"
              unoptimized
              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-8 w-8 text-[--muted-foreground]" />
            </div>
          )}
        </div>
        <p className="text-xs font-semibold line-clamp-2 leading-tight group-hover:underline">{book.title}</p>
        {authors[0] && <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{authors[0]}</p>}
        {item.note && <p className="text-xs text-[--muted-foreground] mt-0.5 italic line-clamp-1">&ldquo;{item.note}&rdquo;</p>}
      </Link>

      {isOwner && (
        <button
          onClick={remove}
          disabled={isPending}
          className="absolute top-1.5 right-1.5 h-7 w-7 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/70 disabled:opacity-30"
          aria-label="Retirer de la liste"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export default function ListBookGrid({ listId, items, isOwner }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {items.map((item, i) => (
        <ListBookCard key={item.book?.id ?? i} listId={listId} item={item} isOwner={isOwner} />
      ))}
    </div>
  )
}

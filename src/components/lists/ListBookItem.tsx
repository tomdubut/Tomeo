"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { removeBookFromList, updateBookNote } from "@/app/(main)/lists/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookOpen, Trash2, Pencil, Check, X } from "lucide-react"

interface Props {
  listId: string
  item: {
    position: number
    note: string | null
    book: {
      id: string
      title: string
      cover_url: string | null
      book_authors: Array<{ role: string; display_order: number; author: { name: string } }>
    }
  }
  isOwner: boolean
}

export default function ListBookItem({ listId, item, isOwner }: Props) {
  const [editingNote, setEditingNote] = useState(false)
  const [note, setNote] = useState(item.note ?? "")
  const [isPending, startTransition] = useTransition()

  const authors = (item.book.book_authors ?? [])
    .filter((ba) => ba.role === "author")
    .sort((a, b) => a.display_order - b.display_order)
    .map((ba) => ba.author.name)

  function saveNote() {
    startTransition(async () => {
      await updateBookNote(listId, item.book.id, note)
      setEditingNote(false)
    })
  }

  function remove() {
    startTransition(async () => {
      await removeBookFromList(listId, item.book.id)
    })
  }

  return (
    <div className="flex gap-4 py-4 border-b border-[--border] last:border-0">
      {/* Position */}
      <span className="text-sm text-[--muted-foreground] w-6 shrink-0 pt-1 text-right">
        {item.position + 1}
      </span>

      {/* Cover */}
      <Link href={`/books/${item.book.id}`} className="shrink-0">
        <div className="w-12 aspect-[2/3] relative rounded overflow-hidden bg-[--secondary]">
          {item.book.cover_url ? (
            <Image
              src={item.book.cover_url}
              alt={item.book.title}
              fill
              className="object-cover hover:opacity-90 transition-opacity"
              unoptimized
              sizes="48px"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-4 w-4 text-[--muted-foreground]" />
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/books/${item.book.id}`} className="font-medium text-sm hover:underline line-clamp-2">
          {item.book.title}
        </Link>
        {authors[0] && (
          <p className="text-xs text-[--muted-foreground] mt-0.5">{authors[0]}</p>
        )}

        {/* Note */}
        {editingNote ? (
          <div className="mt-2 flex gap-2 items-center">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ajouter une note…"
              maxLength={500}
              className="h-7 text-xs"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={saveNote} disabled={isPending}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setNote(item.note ?? ""); setEditingNote(false) }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            {item.note && (
              <p className="text-xs text-[--muted-foreground] mt-1 italic">&ldquo;{item.note}&rdquo;</p>
            )}
            {isOwner && (
              <button
                onClick={() => setEditingNote(true)}
                className="mt-1 text-xs text-[--muted-foreground] hover:text-[--foreground] underline underline-offset-2"
              >
                {item.note ? "Modifier la note" : "Ajouter une note"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Remove */}
      {isOwner && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-[--muted-foreground] hover:text-[--destructive]"
          onClick={remove}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

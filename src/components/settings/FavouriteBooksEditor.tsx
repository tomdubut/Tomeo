"use client"

import { useState, useTransition } from "react"
import { X, Plus, Search, Loader2, GripVertical } from "lucide-react"
import BookCover from "@/components/books/BookCover"
import { setFavouriteBook, removeFavouriteBook, swapFavouriteBooks } from "@/app/(main)/settings/actions"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type Book = { id: string; title: string; cover_url: string | null; authors: string[] }
type FavSlot = { position: 1 | 2 | 3 | 4; book: Book | null }

interface SlotProps {
  slot: FavSlot
  isPending: boolean
  onRemove: (position: 1 | 2 | 3 | 4) => void
  onAdd: (position: 1 | 2 | 3 | 4) => void
}

function SortableSlot({ slot, isPending, onRemove, onAdd }: SlotProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slot.position,
    disabled: !slot.book,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        className="aspect-[2/3] rounded-xl overflow-hidden bg-[--secondary]"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        {slot.book ? (
          <>
            <BookCover
              src={slot.book.cover_url}
              title={slot.book.title}
              author={slot.book.authors[0]}
              className="w-full h-full"
              sizes="120px"
            />
            {/* Grip handle — drag initiator */}
            <button
              {...listeners}
              {...attributes}
              className="absolute top-1 left-1 rounded bg-black/50 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity touch-none cursor-grab active:cursor-grabbing"
              aria-label="Réorganiser"
            >
              <GripVertical className="h-3 w-3 text-white" />
            </button>
            {/* Remove button */}
            <button
              onClick={() => onRemove(slot.position)}
              disabled={isPending}
              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Retirer"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </>
        ) : (
          <button
            onClick={() => onAdd(slot.position)}
            className="w-full h-full flex items-center justify-center text-[--muted-foreground] hover:text-[--foreground] transition-colors"
            aria-label="Ajouter un livre favori"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  )
}

interface Props {
  initialSlots: FavSlot[]
  userId: string
}

export default function FavouriteBooksEditor({ initialSlots, userId }: Props) {
  const [slots, setSlots] = useState<FavSlot[]>(initialSlots)
  const [activeSlot, setActiveSlot] = useState<1 | 2 | 3 | 4 | null>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Book[]>([])
  const [searching, setSearching] = useState(false)
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const fromPos = active.id as 1 | 2 | 3 | 4
    const toPos = over.id as 1 | 2 | 3 | 4
    setSlots((prev) => {
      const next = [...prev]
      const fromIdx = next.findIndex((s) => s.position === fromPos)
      const toIdx = next.findIndex((s) => s.position === toPos)
      const fromBook = next[fromIdx].book
      next[fromIdx] = { ...next[fromIdx], book: next[toIdx].book }
      next[toIdx] = { ...next[toIdx], book: fromBook }
      return next
    })
    startTransition(async () => {
      await swapFavouriteBooks(fromPos, toPos)
    })
  }

  async function search(q: string) {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    const res = await fetch(`/api/library-search?q=${encodeURIComponent(q)}&userId=${userId}`)
    const data = await res.json()
    setResults(data.books ?? [])
    setSearching(false)
  }

  function openModal(position: 1 | 2 | 3 | 4) {
    setActiveSlot(position)
    setQuery("")
    setResults([])
  }

  function closeModal() {
    setActiveSlot(null)
    setQuery("")
    setResults([])
  }

  function pickBook(book: Book) {
    if (!activeSlot) return
    const slot = activeSlot
    closeModal()
    startTransition(async () => {
      const result = await setFavouriteBook(slot, book.id)
      if (result?.success === false) {
        alert(`Erreur : ${result.error}`)
        return
      }
      setSlots((prev) => prev.map((s) => s.position === slot ? { ...s, book } : s))
    })
  }

  function removeBook(position: 1 | 2 | 3 | 4) {
    startTransition(async () => {
      await removeFavouriteBook(position)
      setSlots((prev) => prev.map((s) => s.position === position ? { ...s, book: null } : s))
    })
  }

  return (
    <div className="rounded-2xl bg-[--card] border border-[--border] p-6 space-y-4">
      <div>
        <p className="font-semibold">Livres favoris</p>
        <p className="text-sm text-[--muted-foreground] mt-0.5">Choisissez jusqu&apos;à 4 livres à afficher sur votre profil.</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={[1, 2, 3, 4]} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-3">
            {slots.map((slot) => (
              <SortableSlot
                key={slot.position}
                slot={slot}
                isPending={isPending}
                onRemove={removeBook}
                onAdd={openModal}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Modal — bottom sheet on mobile, centered dialog on sm+ */}
      {activeSlot !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50"
          onClick={closeModal}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center sm:hidden -mt-1 mb-1">
              <div className="w-10 h-1 rounded-full bg-[--border]" />
            </div>

            <div className="flex items-center justify-between">
              <p className="font-semibold">Choisir un livre favori</p>
              <button onClick={closeModal} className="text-[--muted-foreground] hover:text-[--foreground]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--muted-foreground]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => search(e.target.value)}
                placeholder="Rechercher dans votre bibliothèque…"
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[--secondary] border border-[--border] text-sm outline-none focus:border-[--primary]"
              />
            </div>

            {searching && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-[--muted-foreground]" />
              </div>
            )}

            {results.length > 0 && (
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
                {results.map((book) => (
                  <button key={book.id} onClick={() => pickBook(book)} className="group text-left">
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[--secondary] group-hover:ring-2 ring-[--primary] transition-all">
                      <BookCover src={book.cover_url} title={book.title} author={book.authors[0]} className="w-full h-full" sizes="80px" />
                    </div>
                    <p className="mt-1 text-[10px] line-clamp-2 leading-tight">{book.title}</p>
                  </button>
                ))}
              </div>
            )}

            {!searching && query.length >= 2 && results.length === 0 && (
              <p className="text-sm text-center text-[--muted-foreground] py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">Aucun résultat dans votre bibliothèque.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { X, Plus, Search, Loader2 } from "lucide-react"
import BookCover from "@/components/books/BookCover"
import { setFavouriteBook, removeFavouriteBook, swapFavouriteBooks } from "@/app/(main)/settings/actions"

type Book = { id: string; title: string; cover_url: string | null; authors: string[] }
type FavSlot = { position: 1 | 2 | 3 | 4; book: Book | null }

interface Props {
  initialSlots: FavSlot[]
  userId: string
}

export default function FavouriteBooksEditor({ initialSlots, userId }: Props) {
  const [slots, setSlots] = useState<FavSlot[]>(initialSlots)
  const [selectedPosition, setSelectedPosition] = useState<1 | 2 | 3 | 4 | null>(null)
  const [activeSlot, setActiveSlot] = useState<1 | 2 | 3 | 4 | null>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Book[]>([])
  const [searching, setSearching] = useState(false)
  const [isPending, startTransition] = useTransition()

  const filledCount = slots.filter((s) => s.book).length

  function handleSlotTap(slot: FavSlot) {
    if (slot.book) {
      if (selectedPosition === null) {
        // Select this slot
        setSelectedPosition(slot.position)
      } else if (selectedPosition === slot.position) {
        // Deselect
        setSelectedPosition(null)
      } else {
        // Swap with selected slot
        const fromPos = selectedPosition
        const toPos = slot.position
        setSelectedPosition(null)
        setSlots((prev) => {
          const next = [...prev]
          const fromIdx = next.findIndex((s) => s.position === fromPos)
          const toIdx = next.findIndex((s) => s.position === toPos)
          const fromBook = next[fromIdx].book
          next[fromIdx] = { ...next[fromIdx], book: next[toIdx].book }
          next[toIdx] = { ...next[toIdx], book: fromBook }
          return next
        })
        startTransition(async () => { await swapFavouriteBooks(fromPos, toPos) })
      }
    } else {
      if (selectedPosition !== null) {
        // Move selected book to this empty slot
        const fromPos = selectedPosition
        const toPos = slot.position
        setSelectedPosition(null)
        setSlots((prev) => {
          const next = [...prev]
          const fromIdx = next.findIndex((s) => s.position === fromPos)
          const toIdx = next.findIndex((s) => s.position === toPos)
          const fromBook = next[fromIdx].book
          next[fromIdx] = { ...next[fromIdx], book: null }
          next[toIdx] = { ...next[toIdx], book: fromBook }
          return next
        })
        startTransition(async () => { await swapFavouriteBooks(fromPos, toPos) })
      } else {
        // Open add modal
        openModal(slot.position)
      }
    }
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
      if (result?.success === false) { alert(`Erreur : ${result.error}`); return }
      setSlots((prev) => prev.map((s) => s.position === slot ? { ...s, book } : s))
    })
  }

  function removeBook(position: 1 | 2 | 3 | 4) {
    if (selectedPosition === position) setSelectedPosition(null)
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

      <div className="grid grid-cols-4 gap-3">
        {slots.map((slot) => {
          const isSelected = selectedPosition === slot.position
          const isSwapTarget = selectedPosition !== null && selectedPosition !== slot.position
          return (
            <div key={slot.position} className="relative group">
              <button
                onClick={() => handleSlotTap(slot)}
                disabled={isPending}
                className="w-full focus-visible:outline-none"
                aria-label={slot.book ? slot.book.title : "Ajouter un livre favori"}
              >
                <div
                  className="aspect-[2/3] rounded-xl overflow-hidden bg-[--secondary] transition-all"
                  style={{
                    boxShadow: "var(--shadow-sm)",
                    outline: isSelected
                      ? "2px solid var(--primary)"
                      : isSwapTarget && slot.book
                        ? "2px dashed var(--primary)"
                        : isSwapTarget && !slot.book
                          ? "2px dashed var(--primary)"
                          : undefined,
                    outlineOffset: "2px",
                    opacity: isSwapTarget ? 0.75 : 1,
                  }}
                >
                  {slot.book ? (
                    <BookCover
                      src={slot.book.cover_url}
                      title={slot.book.title}
                      author={slot.book.authors[0]}
                      className="w-full h-full"
                      sizes="120px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[--muted-foreground]">
                      <Plus className="h-6 w-6" />
                    </div>
                  )}
                </div>
              </button>

              {/* Remove button — only show when not in selection mode */}
              {slot.book && selectedPosition === null && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeBook(slot.position) }}
                  disabled={isPending}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Retirer"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Contextual hint */}
      {filledCount >= 2 && (
        <p className="text-xs text-[--muted-foreground]">
          {selectedPosition !== null
            ? "Appuyez sur un autre emplacement pour échanger, ou sur le même pour annuler."
            : "Appuyez sur un livre pour le déplacer."}
        </p>
      )}

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

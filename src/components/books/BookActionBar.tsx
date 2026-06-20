"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import Link from "next/link"
import { setReadingStatus } from "@/app/(main)/books/actions"
import { addBookToList } from "@/app/(main)/lists/actions"
import { toast } from "sonner"
import { BookOpen, BookMarked, BookCheck, Check, ChevronUp, ListPlus, Loader2, Plus, Trash2 } from "lucide-react"
import AddToLibraryButton from "./AddToLibraryButton"
import AddToListButton from "@/components/lists/AddToListButton"

type Status = "want_to_read" | "currently_reading" | "read" | null

const STATUS_OPTIONS: { key: NonNullable<Status>; label: string; icon: React.ReactNode }[] = [
  { key: "want_to_read", label: "À lire", icon: <BookMarked className="h-5 w-5" /> },
  { key: "currently_reading", label: "En cours", icon: <BookOpen className="h-5 w-5" /> },
  { key: "read", label: "Lu", icon: <BookCheck className="h-5 w-5" /> },
]

interface UserList { id: string; title: string; is_public: boolean }

interface Props {
  bookId: string
  initialStatus: Status
  initialFinishedAt: string | null
  lists: UserList[]
  initialListIds: string[]
}

function MobileActionBar({ bookId, initialStatus, initialFinishedAt, lists, initialListIds }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus)
  const [openStatus, setOpenStatus] = useState(false)
  const [openLists, setOpenLists] = useState(false)
  const [inLists, setInLists] = useState(new Set(initialListIds))
  const [isPending, startTransition] = useTransition()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [finishedAt, setFinishedAt] = useState(initialFinishedAt ?? new Date().toISOString().slice(0, 10))

  const current = status ? STATUS_OPTIONS.find((o) => o.key === status) : null

  function commitStatus(next: Status, date: string | null) {
    startTransition(async () => {
      await setReadingStatus(bookId, next, date)
      setStatus(next)
      if (next === null) toast.success("Livre retiré de la bibliothèque")
      else if (next === "want_to_read") toast.success("Ajouté à « À lire »")
      else if (next === "currently_reading") toast.success("Ajouté à « En cours »")
      else if (next === "read") toast.success("Marqué comme lu ✓")
    })
  }

  function chooseStatus(key: NonNullable<Status>) {
    setOpenStatus(false)
    if (key === "read") { setShowDatePicker(true); return }
    commitStatus(key, null)
  }

  function toggleList(list: UserList) {
    if (inLists.has(list.id)) return
    startTransition(async () => {
      await addBookToList(list.id, bookId)
      setInLists((prev) => new Set([...prev, list.id]))
    })
  }

  const CREAM = "#f5efe6"
  const CREAM_DIM = "rgba(245,239,230,0.6)"

  return (
    <>
      {/* Status panel */}
      {openStatus && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpenStatus(false)} />
          <div className="fixed left-0 right-0 z-40 mx-4 rounded-2xl overflow-hidden border border-white/10"
            style={{ bottom: "calc(7rem + env(safe-area-inset-bottom))", background: "#2a1f14" }}>
            {STATUS_OPTIONS.map(({ key, label, icon }) => (
              <button key={key} onClick={() => chooseStatus(key)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/5"
              >
                <span style={{ color: status === key ? "var(--primary)" : CREAM }}>{icon}</span>
                <span className="font-semibold text-base" style={{ color: status === key ? "var(--primary)" : CREAM }}>{label}</span>
                {status === key && <Check className="ml-auto h-4 w-4" style={{ color: "var(--primary)" }} />}
              </button>
            ))}
            {status && (
              <>
                <div className="border-t border-white/10" />
                <button onClick={() => { setOpenStatus(false); commitStatus(null, null) }}
                  className="flex w-full items-center gap-3 px-5 py-4 transition-colors hover:bg-white/5"
                >
                  <Trash2 className="h-5 w-5" style={{ color: "var(--destructive)" }} />
                  <span className="font-semibold text-base" style={{ color: "var(--destructive)" }}>Retirer de ma bibliothèque</span>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Lists panel */}
      {openLists && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpenLists(false)} />
          <div className="fixed left-0 right-0 z-40 mx-4 rounded-2xl overflow-hidden border border-white/10"
            style={{ bottom: "calc(7rem + env(safe-area-inset-bottom))", background: "#2a1f14" }}>
            {lists.length === 0 ? (
              <Link href="/me/lists" onClick={() => setOpenLists(false)}
                className="flex items-center gap-3 px-5 py-4 hover:bg-white/5"
              >
                <Plus className="h-5 w-5" style={{ color: CREAM }} />
                <span className="font-semibold text-base" style={{ color: CREAM }}>Créer une liste</span>
              </Link>
            ) : (
              <>
                {lists.map((list) => {
                  const isIn = inLists.has(list.id)
                  return (
                    <button key={list.id} onClick={() => toggleList(list)} disabled={isIn}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/5 disabled:opacity-60"
                    >
                      {isIn
                        ? <Check className="h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} />
                        : <div className="h-5 w-5 shrink-0 rounded border border-white/30" />
                      }
                      <span className="font-semibold text-base line-clamp-1" style={{ color: isIn ? CREAM_DIM : CREAM }}>{list.title}</span>
                    </button>
                  )
                })}
                <div className="border-t border-white/10" />
                <Link href="/me/lists" onClick={() => setOpenLists(false)}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-white/5"
                >
                  <Plus className="h-5 w-5" style={{ color: CREAM }} />
                  <span className="font-semibold text-base" style={{ color: CREAM }}>Nouvelle liste</span>
                </Link>
              </>
            )}
          </div>
        </>
      )}

      {/* Date picker */}
      {showDatePicker && (
        <div className="fixed left-0 right-0 z-40 mx-4 rounded-2xl p-5 border border-white/10 space-y-4"
          style={{ bottom: "calc(7rem + env(safe-area-inset-bottom))", background: "#2a1f14" }}>
          <p className="text-base font-semibold" style={{ color: CREAM }}>Date de fin de lecture</p>
          <input type="date" value={finishedAt} max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setFinishedAt(e.target.value)}
            style={{ fontSize: "16px", color: CREAM, background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)" }}
            className="w-full rounded-xl border px-4 py-2.5 font-medium focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <button onClick={() => { setShowDatePicker(false); commitStatus("read", finishedAt) }}
                className="text-base font-semibold" style={{ color: "var(--primary)" }}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
              </button>
              <button onClick={() => { setShowDatePicker(false); commitStatus("read", null) }}
                className="text-base font-semibold" style={{ color: CREAM_DIM }}>
                Passer
              </button>
            </div>
            <button onClick={() => setShowDatePicker(false)} className="text-base font-semibold" style={{ color: CREAM_DIM }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Sticky bar */}
      <div className="fixed left-0 right-0 z-30 px-4 pt-3 border-t border-white/10"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))", background: "#1c1208" }}>
        <div className="flex gap-3 pb-3">
          {/* Library status button */}
          <button onClick={() => { setOpenLists(false); setOpenStatus((v) => !v) }} disabled={isPending}
            className="flex-1 flex items-center justify-between gap-2 rounded-xl px-4 py-3 font-semibold text-sm transition-colors"
            style={{ background: current ? "var(--primary)" : "rgba(245,239,230,0.15)", color: CREAM }}
          >
            <span className="flex items-center gap-2">
              {current ? current.icon : <BookOpen className="h-5 w-5" />}
              {current ? current.label : "Ajouter à ma bibliothèque"}
            </span>
            <ChevronUp className="h-4 w-4 shrink-0 transition-transform" style={{ transform: openStatus ? "rotate(0deg)" : "rotate(180deg)", opacity: 0.7 }} />
          </button>

          {/* Lists button */}
          <button onClick={() => { setOpenStatus(false); setOpenLists((v) => !v) }}
            className="flex items-center gap-2 rounded-xl px-4 py-3 font-semibold text-sm transition-colors"
            style={{ background: "rgba(245,239,230,0.15)", color: CREAM }}
          >
            <ListPlus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </>
  )
}

export default function BookActionBar(props: Props) {
  return (
    <>
      {/* Desktop: existing components inline */}
      <div className="hidden sm:flex flex-row gap-2 pt-1">
        <AddToLibraryButton
          bookId={props.bookId}
          initialStatus={props.initialStatus as any}
          initialFinishedAt={props.initialFinishedAt}
        />
        <AddToListButton bookId={props.bookId} lists={props.lists} initialListIds={props.initialListIds} />
      </div>

      {/* Mobile: custom sticky bar */}
      <div className="sm:hidden">
        <MobileActionBar {...props} />
      </div>
    </>
  )
}

"use client"

import { useState, useTransition } from "react"
import { Flag, X, Loader2 } from "lucide-react"
import { submitMangaReport } from "@/app/(main)/manga/actions"

const REASONS = [
  { key: "wrong_cover",       label: "Couverture incorrecte" },
  { key: "wrong_metadata",    label: "Titre ou auteur incorrect" },
  { key: "wrong_edition",     label: "Mauvaise édition / doublon" },
  { key: "wrong_description", label: "Description incorrecte" },
  { key: "wrong_volume",      label: "Nombre de tomes incorrect" },
  { key: "other",             label: "Autre" },
]

export default function ReportMangaButton({ mangaId }: { mangaId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleOpen() {
    setReason("")
    setNote("")
    setSuccess(false)
    setErrorMsg("")
    setOpen(true)
  }

  function handleSubmit() {
    if (!reason) return
    setErrorMsg("")
    startTransition(async () => {
      try {
        await submitMangaReport(mangaId, reason, note || null)
        setSuccess(true)
        setTimeout(() => setOpen(false), 1800)
      } catch {
        setErrorMsg("Une erreur est survenue. Veuillez réessayer.")
      }
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs text-[--muted-foreground] hover:text-[--foreground] transition-colors"
      >
        <Flag className="h-3.5 w-3.5" />
        Signaler un problème
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onMouseDown={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md rounded-2xl p-6 space-y-5"
            style={{ background: "#F5EFE6", boxShadow: "0 16px 48px rgba(0,0,0,0.25)", color: "#1a1209" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Signaler un problème</h2>
              <button onClick={() => setOpen(false)} className="text-[--muted-foreground] hover:text-[--foreground] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {success ? (
              <p className="text-sm text-center py-4 font-medium" style={{ color: "var(--primary)" }}>
                Merci, votre signalement a été envoyé.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {REASONS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="reason"
                        value={key}
                        checked={reason === key}
                        onChange={() => setReason(key)}
                        className="accent-[--primary]"
                      />
                      <span className="text-sm group-hover:text-[--foreground] transition-colors">{label}</span>
                    </label>
                  ))}
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Détails supplémentaires… (optionnel)"
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ background: "rgba(0,0,0,0.06)", color: "#1a1209" }}
                />

                {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={!reason || isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Envoyer
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

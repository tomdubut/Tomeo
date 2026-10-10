"use client"

import { useState, useTransition } from "react"
import { deleteAccount } from "@/app/(main)/settings/actions"

export default function DeleteAccountButton() {
  const [step, setStep] = useState<"idle" | "confirm">("idle")
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      await deleteAccount()
    })
  }

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm")}
        className="rounded-xl px-4 py-2 text-sm font-semibold border transition-colors hover:opacity-80"
        style={{ color: "var(--destructive)", borderColor: "var(--destructive)" }}
      >
        Supprimer mon compte
      </button>
    )
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "color-mix(in srgb, var(--destructive) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--destructive) 40%, transparent)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--destructive)" }}>
        Cette action est irréversible.
      </p>
      <p className="text-sm text-[--muted-foreground]">
        Votre compte, bibliothèque, critiques et toutes vos données seront définitivement supprimés.
      </p>
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleConfirm}
          disabled={isPending}
          className="rounded-xl px-4 py-2 text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--destructive)", color: "var(--destructive-foreground)" }}
        >
          {isPending ? "Suppression…" : "Oui, supprimer définitivement"}
        </button>
        <button
          onClick={() => setStep("idle")}
          disabled={isPending}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:opacity-80"
          style={{ color: "var(--muted-foreground)" }}
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

"use client"

export default function BooksError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
      <p className="text-lg font-semibold">Une erreur est survenue</p>
      <p className="text-sm text-[--muted-foreground]">Impossible de charger cette page.</p>
      <button
        onClick={reset}
        className="rounded-xl px-4 py-2 text-sm font-semibold"
        style={{ background: "var(--primary)", color: "#fff" }}
      >
        Réessayer
      </button>
    </div>
  )
}

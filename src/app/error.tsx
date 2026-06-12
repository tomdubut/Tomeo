"use client"

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">Une erreur est survenue</h2>
      <button
        onClick={reset}
        className="rounded-md border px-4 py-2 text-sm hover:bg-[--secondary]"
      >
        Réessayer
      </button>
    </div>
  )
}

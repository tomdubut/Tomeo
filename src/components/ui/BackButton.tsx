"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export default function BackButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.back()}
      className="group flex items-center gap-2 transition-colors"
      aria-label="Retour"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[--card] border border-[--border] transition-colors group-hover:bg-[--secondary]">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      </span>
      <span className="hidden sm:block text-sm font-semibold text-[--muted-foreground] group-hover:text-[--foreground] transition-colors">
        Retour
      </span>
    </button>
  )
}

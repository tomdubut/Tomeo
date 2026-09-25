"use client"

import { BookOpen, BookMarked } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  activeType: "books" | "manga"
  currentQuery: string
}

export default function MediaTypeToggle({ activeType, currentQuery }: Props) {
  function navigate(type: "books" | "manga") {
    const params = new URLSearchParams()
    if (type === "manga") params.set("type", "manga")
    if (currentQuery) params.set("q", currentQuery)
    const qs = params.toString()
    window.location.assign(`/books${qs ? `?${qs}` : ""}`)
  }

  return (
    <div className="flex gap-1 rounded-xl bg-[--secondary] p-1 w-fit">
      <button
        onClick={() => navigate("books")}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
          activeType === "books"
            ? "text-white"
            : "text-[--muted-foreground] hover:text-[--foreground]"
        )}
        style={activeType === "books" ? { background: "var(--primary)" } : {}}
      >
        <BookOpen className="h-3.5 w-3.5" />
        Livres
      </button>
      <button
        onClick={() => navigate("manga")}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
          activeType === "manga"
            ? "text-white"
            : "text-[--muted-foreground] hover:text-[--foreground]"
        )}
        style={activeType === "manga" ? { background: "var(--primary)" } : {}}
      >
        <BookMarked className="h-3.5 w-3.5" />
        Manga
      </button>
    </div>
  )
}

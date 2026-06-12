"use client"

import { useRouter } from "next/navigation"

interface Genre {
  slug: string
  label: string
  count: number
}

interface Props {
  genres: Genre[]
  activeGenre: string
}

export default function GenreFilter({ genres, activeGenre }: Props) {
  const router = useRouter()

  function select(slug: string) {
    if (slug === activeGenre) {
      router.push("/books")
    } else {
      router.push(`/books?genre=${encodeURIComponent(slug)}`)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((g) => {
        const isActive = g.slug === activeGenre
        return (
          <button
            key={g.slug}
            onClick={() => select(g.slug)}
            className="rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors"
            style={
              isActive
                ? { background: "var(--primary)", color: "#fff" }
                : { background: "var(--secondary)", color: "var(--foreground)" }
            }
          >
            {g.label}
            <span
              className="ml-1.5 text-xs"
              style={{ opacity: isActive ? 0.8 : 0.5 }}
            >
              {g.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

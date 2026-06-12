import Link from "next/link"

interface Genre {
  slug: string
  label: string
}

interface Props {
  genres: Genre[]
  activeGenre: string
}

export default function GenreFilter({ genres, activeGenre }: Props) {
  return (
    <div>
      <p className="text-sm font-semibold mb-3">Parcourir par genre</p>
      <div className="flex flex-wrap gap-2">
        {genres.map((g) => {
          const isActive = g.slug === activeGenre
          return (
            <Link
              key={g.slug}
              href={isActive ? "/books" : `/books?genre=${encodeURIComponent(g.slug)}`}
              className="rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors"
              style={
                isActive
                  ? { background: "var(--primary)", color: "#fff" }
                  : { background: "var(--secondary)", color: "var(--foreground)" }
              }
            >
              {g.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

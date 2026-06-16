import Link from "next/link"

interface Item {
  slug: string
  label: string
}

interface Props {
  genres: Item[]
  formats: Item[]
  activeGenre: string
}

function ChipGroup({ items, activeGenre, label, accent }: { items: Item[]; activeGenre: string; label: string; accent?: boolean }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[--muted-foreground] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((g) => {
          const isActive = g.slug === activeGenre
          return (
            <Link
              key={g.slug}
              href={isActive ? "/books" : `/books?genre=${encodeURIComponent(g.slug)}`}
              className="rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors"
              style={
                isActive
                  ? accent
                    ? { background: "var(--secondary-accent)", color: "var(--secondary-accent-foreground)" }
                    : { background: "var(--primary)", color: "#fff" }
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

export default function GenreFilter({ genres, formats, activeGenre }: Props) {
  return (
    <div className="space-y-4">
      <ChipGroup items={formats} activeGenre={activeGenre} label="Format" />
      <ChipGroup items={genres} activeGenre={activeGenre} label="Genre" accent />
    </div>
  )
}

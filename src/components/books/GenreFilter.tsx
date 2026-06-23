import FilterChip from "@/components/ui/FilterChip"

interface Item {
  slug: string
  label: string
}

interface Props {
  genres: Item[]
  formats: Item[]
  activeGenre: string
}

function ChipGroup({ items, activeGenre, clearHref, label, accent }: {
  items: Item[]
  activeGenre: string
  clearHref: string
  label: string
  accent?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[--muted-foreground] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((g) => {
          const isActive = g.slug === activeGenre
          return (
            <FilterChip
              key={g.slug}
              label={g.label}
              href={isActive ? clearHref : `/books?genre=${encodeURIComponent(g.slug)}`}
              isActive={isActive}
              accent={accent}
            />
          )
        })}
      </div>
    </div>
  )
}

export default function GenreFilter({ genres, formats, activeGenre }: Props) {
  return (
    <div className="space-y-4">
      <ChipGroup items={formats} activeGenre={activeGenre} clearHref="/books" label="Format" />
      <ChipGroup items={genres} activeGenre={activeGenre} clearHref="/books" label="Genre" accent />
    </div>
  )
}

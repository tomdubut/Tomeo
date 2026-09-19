"use client"

import { Tag } from "lucide-react"

interface Genre {
  id: number
  slug: string
  label: string
  type: string
}

interface Props {
  username: string
  shelf: string
  sort: string
  genre: string
  search: string
  formatList: Genre[]
  genreList: Genre[]
}

export default function LibraryGenreSelect({ username, shelf, sort, genre, search, formatList, genreList }: Props) {
  function buildHref(nextGenre: string) {
    const p = new URLSearchParams()
    if (shelf !== "all") p.set("shelf", shelf)
    if (sort !== "recent") p.set("sort", sort)
    if (nextGenre) p.set("genre", nextGenre)
    if (search) p.set("search", search)
    const qs = p.toString()
    return `/users/${username}/library${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="relative">
      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[--muted-foreground] pointer-events-none" />
      <select
        value={genre}
        onChange={(e) => window.location.assign(buildHref(e.target.value))}
        className="appearance-none rounded-lg bg-[--secondary] pl-8 pr-3 py-1.5 text-sm font-semibold text-[--foreground] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
      >
        <option value="">Tous les genres</option>
        {formatList.length > 0 && (
          <optgroup label="Format">
            {formatList.map((g) => (
              <option key={g.id} value={g.slug}>{g.label}</option>
            ))}
          </optgroup>
        )}
        {genreList.length > 0 && (
          <optgroup label="Genre">
            {genreList.map((g) => (
              <option key={g.id} value={g.slug}>{g.label}</option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )
}

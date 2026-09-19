"use client"

import { Tag } from "lucide-react"

interface Genre {
  id: number
  slug: string
  label: string
}

interface Props {
  username: string
  shelf: string
  sort: string
  format: string
  activeGenres: string[]
  search: string
  genreList: Genre[]
}

export default function LibraryGenreSelect({ username, shelf, sort, format, activeGenres, search, genreList }: Props) {
  function buildHref(nextGenres: string[]) {
    const p = new URLSearchParams()
    if (shelf !== "all") p.set("shelf", shelf)
    if (sort !== "recent") p.set("sort", sort)
    if (format) p.set("format", format)
    if (nextGenres.length) p.set("genres", nextGenres.join(","))
    if (search) p.set("search", search)
    const qs = p.toString()
    return `/users/${username}/library${qs ? `?${qs}` : ""}`
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
    window.location.assign(buildHref(selected))
  }

  return (
    <div className="relative">
      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[--muted-foreground] pointer-events-none" />
      <select
        multiple
        value={activeGenres}
        onChange={handleChange}
        className="appearance-none rounded-lg bg-[--secondary] pl-8 pr-3 py-1.5 text-sm font-semibold text-[--foreground] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
        size={1}
      >
        <option value="" disabled>Genres</option>
        {genreList.map((g) => (
          <option key={g.id} value={g.slug}>{g.label}</option>
        ))}
      </select>
    </div>
  )
}

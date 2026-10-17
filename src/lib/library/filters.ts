// Library page filters: one definition of the shelves, sorts and URL format, shared by the
// server page and every control that changes a filter.

export const SHELVES = [
  { key: "all", label: "Tous" },
  { key: "read", label: "Lus" },
  { key: "currently_reading", label: "En cours" },
  { key: "want_to_read", label: "À lire" },
] as const

export type ShelfKey = (typeof SHELVES)[number]["key"]

export const SORT_OPTIONS = [
  { key: "recent", label: "Ajout récent" },
  { key: "date_read_desc", label: "Lu récemment" },
  { key: "date_read_asc", label: "Lu il y a longtemps" },
  { key: "rating_desc", label: "Meilleures notes" },
  { key: "rating_asc", label: "Moins bonnes notes" },
] as const

export type SortKey = (typeof SORT_OPTIONS)[number]["key"]

export interface LibraryFilters {
  shelf: ShelfKey
  sort: SortKey
  format: string
  genres: string[]
  search: string
}

export const DEFAULT_FILTERS: LibraryFilters = { shelf: "all", sort: "recent", format: "", genres: [], search: "" }

export function parseLibraryFilters(sp: { shelf?: string; sort?: string; format?: string; genres?: string; search?: string }): LibraryFilters {
  return {
    shelf: SHELVES.some((s) => s.key === sp.shelf) ? (sp.shelf as ShelfKey) : "all",
    sort: SORT_OPTIONS.some((s) => s.key === sp.sort) ? (sp.sort as SortKey) : "recent",
    format: sp.format?.trim() ?? "",
    genres: sp.genres ? sp.genres.split(",").filter(Boolean) : [],
    search: sp.search?.trim().toLowerCase() ?? "",
  }
}

/** URL of the library with `changes` applied; default values are left out of the query string. */
export function libraryHref(username: string, filters: LibraryFilters, changes: Partial<LibraryFilters> = {}): string {
  const f = { ...filters, ...changes }
  const p = new URLSearchParams()
  if (f.shelf !== "all") p.set("shelf", f.shelf)
  if (f.sort !== "recent") p.set("sort", f.sort)
  if (f.format) p.set("format", f.format)
  if (f.genres.length) p.set("genres", f.genres.join(","))
  if (f.search) p.set("search", f.search)
  const qs = p.toString()
  return `/users/${username}/library${qs ? `?${qs}` : ""}`
}

/** Filters set in the "Filtres" panel (shelf and search have their own controls). */
export function panelFilterCount(f: LibraryFilters): number {
  return (f.sort !== "recent" ? 1 : 0) + (f.format ? 1 : 0) + f.genres.length
}

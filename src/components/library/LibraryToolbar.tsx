"use client"

import { useLayoutEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Loader2, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PillTabs } from "@/components/ui/tabs"
import { SearchInput } from "@/components/ui/search-input"
import { Sheet } from "@/components/ui/sheet"
import { SHELVES, SORT_OPTIONS, DEFAULT_FILTERS, libraryHref, panelFilterCount, type LibraryFilters } from "@/lib/library/filters"

interface Tag {
  id: number
  slug: string
  label: string
}

interface Props {
  username: string
  filters: LibraryFilters
  countByShelf: Record<string, number>
  totalCount: number
  formatList: Tag[]
  genreList: Tag[]
}

/** Shelf tabs, search and the "Filtres" panel (sort, format, genres) of a user's library.
 *  Every change is a client-side navigation to the new URL: no full page reload. */
export default function LibraryToolbar({ username, filters: urlFilters, countByShelf, totalCount, formatList, genreList }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [panelOpen, setPanelOpen] = useState(false)
  // Applied right away, so quick successive taps build on each other before the page reloads
  const [filters, setFilters] = useState(urlFilters)
  const [search, setSearch] = useState(urlFilters.search)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Follow the URL when it changes from outside (chip link, back/forward)
  const urlKey = libraryHref(username, urlFilters)
  const [syncedKey, setSyncedKey] = useState(urlKey)
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey)
    setFilters(urlFilters)
    if (urlFilters.search !== search.trim().toLowerCase()) setSearch(urlFilters.search)
  }

  // Close the panel when the page is hidden by a navigation (Next keeps hidden pages' state)
  useLayoutEffect(() => () => setPanelOpen(false), [])

  function go(changes: Partial<LibraryFilters>) {
    const next = { ...filters, ...changes }
    setFilters(next)
    startTransition(() => router.push(libraryHref(username, next), { scroll: false }))
  }

  function onSearch(value: string) {
    setSearch(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const next = { ...filters, search: value.trim().toLowerCase() }
      setFilters(next)
      startTransition(() => router.replace(libraryHref(username, next), { scroll: false }))
    }, 300)
  }

  function toggleGenre(slug: string) {
    const genres = filters.genres.includes(slug) ? filters.genres.filter((g) => g !== slug) : [...filters.genres, slug]
    go({ genres })
  }

  const activeCount = panelFilterCount(filters)
  const sortLabel = SORT_OPTIONS.find((s) => s.key === filters.sort)?.label
  const tagLabel = (list: Tag[], slug: string) => list.find((t) => t.slug === slug)?.label ?? slug

  const chips = [
    ...(filters.sort !== "recent" ? [{ key: "sort", label: sortLabel ?? filters.sort, href: libraryHref(username, filters, { sort: "recent" }) }] : []),
    ...(filters.format ? [{ key: "format", label: tagLabel(formatList, filters.format), href: libraryHref(username, filters, { format: "" }) }] : []),
    ...filters.genres.map((g) => ({
      key: `genre-${g}`,
      label: tagLabel(genreList, g),
      href: libraryHref(username, filters, { genres: filters.genres.filter((x) => x !== g) }),
    })),
  ]

  return (
    <div className="space-y-3">
      <PillTabs
        items={SHELVES.map((s) => ({
          key: s.key,
          label: s.label,
          href: libraryHref(username, filters, { shelf: s.key }),
          active: filters.shelf === s.key,
          count: s.key === "all" ? totalCount : (countByShelf[s.key] ?? 0),
        }))}
      />

      <div className="flex items-center gap-2">
        <SearchInput value={search} onChange={onSearch} placeholder="Titre ou auteur…" className="flex-1" />
        {totalCount > 0 && (
          <Button variant="outline" onClick={() => setPanelOpen(true)} className="h-10 shrink-0 px-3.5" aria-label="Filtres et tri">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtres</span>
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">
                {activeCount}
              </span>
            )}
          </Button>
        )}
        {isPending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Chargement" />}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              scroll={false}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-secondary pl-3 pr-2 text-xs font-semibold hover:bg-muted"
            >
              {c.label}
              <X className="h-3.5 w-3.5 text-muted-foreground" aria-label="Retirer" />
            </Link>
          ))}
          <Link
            href={libraryHref(username, filters, { sort: DEFAULT_FILTERS.sort, format: "", genres: [] })}
            scroll={false}
            className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline"
          >
            Tout effacer
          </Link>
        </div>
      )}

      <Sheet
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title="Filtres et tri"
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" disabled={activeCount === 0} onClick={() => go({ sort: "recent", format: "", genres: [] })}>
              Réinitialiser
            </Button>
            <Button onClick={() => setPanelOpen(false)}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Voir les livres"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <PanelSection title="Trier par">
            {SORT_OPTIONS.map((o) => (
              <Option key={o.key} label={o.label} selected={filters.sort === o.key} onSelect={() => go({ sort: o.key })} />
            ))}
          </PanelSection>

          {formatList.length > 0 && (
            <PanelSection title="Format">
              <Option label="Tous les formats" selected={!filters.format} onSelect={() => go({ format: "" })} />
              {formatList.map((f) => (
                <Option key={f.id} label={f.label} selected={filters.format === f.slug} onSelect={() => go({ format: f.slug })} />
              ))}
            </PanelSection>
          )}

          {genreList.length > 0 && (
            <PanelSection title="Genres" hint="Plusieurs choix possibles">
              <div className="flex flex-wrap gap-2">
                {genreList.map((g) => {
                  const on = filters.genres.includes(g.slug)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGenre(g.slug)}
                      aria-pressed={on}
                      className={cn(
                        "inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-semibold transition-colors",
                        on ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"
                      )}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                      {g.label}
                    </button>
                  )
                })}
              </div>
            </PanelSection>
          )}
        </div>
      </Sheet>
    </div>
  )
}

function PanelSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
        {hint && <span className="ml-2 font-medium normal-case tracking-normal">· {hint}</span>}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function Option({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
        selected ? "bg-secondary font-semibold text-foreground" : "hover:bg-secondary/60"
      )}
    >
      {label}
      {selected && <Check className="h-4 w-4 text-primary" />}
    </button>
  )
}

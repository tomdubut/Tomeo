"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { Search, X } from "lucide-react"

interface Props {
  username: string
  initialSearch: string
  shelf: string
  sort: string
  genre: string
}

export default function LibrarySearchBar({ username, initialSearch, shelf, sort, genre }: Props) {
  const [value, setValue] = useState(initialSearch)
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function buildHref(search: string) {
    const p = new URLSearchParams()
    if (shelf !== "all") p.set("shelf", shelf)
    if (sort !== "recent") p.set("sort", sort)
    if (genre) p.set("genre", genre)
    if (search) p.set("search", search)
    const qs = p.toString()
    return `/users/${username}/library${qs ? `?${qs}` : ""}`
  }

  function handleChange(val: string) {
    setValue(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      router.push(buildHref(val.trim()))
    }, 300)
  }

  function clear() {
    setValue("")
    router.push(buildHref(""))
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--muted-foreground] pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Rechercher par titre ou auteur…"
        className="w-full h-11 rounded-xl border border-[--border] pl-9 pr-9 text-base sm:text-sm font-medium transition-colors placeholder:text-[--muted-foreground] placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
        style={{ background: "var(--card)" }}
      />
      {value && (
        <button
          onClick={clear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[--muted-foreground] hover:text-[--foreground]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

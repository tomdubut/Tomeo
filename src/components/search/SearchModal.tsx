"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

export default function SearchModal() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [isMac, setIsMac] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC") || navigator.userAgent.includes("Mac"))
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery("")
    }
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false)
    } else if (e.key === "Enter" && query.trim().length >= 2) {
      setOpen(false)
      router.push(`/books?q=${encodeURIComponent(query.trim())}`)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
  }

  function submit() {
    if (query.trim().length >= 2) {
      setOpen(false)
      router.push(`/books?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
        style={{ color: "rgba(245,239,230,0.85)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
        aria-label={`Rechercher (${isMac ? "⌘K" : "Ctrl+K"})`}
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Rechercher</span>
        <kbd className="hidden md:inline-flex items-center rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-mono text-white/40">
          {isMac ? "⌘K" : "Ctrl+K"}
        </kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
          onMouseDown={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Floating search bar — no card background */}
          <div
            className="relative w-full max-w-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 backdrop-blur-xl" style={{ background: "rgba(255,255,255,0.10)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <Search className="h-4 w-4 shrink-0 text-white/60" />
              <input
                ref={inputRef}
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Titre, auteur, ISBN… (Entrée pour rechercher)"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                enterKeyHint="search"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-white/40 hover:text-white/80 transition-colors"
                  aria-label="Effacer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white/80 transition-colors ml-1"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {query.trim().length >= 2 && (
              <p className="mt-3 text-center text-xs text-white/50">
                Appuyez sur Entrée pour rechercher «&nbsp;{query.trim()}&nbsp;»
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

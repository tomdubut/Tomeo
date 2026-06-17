"use client"

import { useRouter, usePathname } from "next/navigation"
import { useTransition, useRef } from "react"
import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/useDebounce"
import { useEffect, useState } from "react"

interface Props {
  initialQuery?: string
}

export default function BookSearchBar({ initialQuery = "" }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(initialQuery)
  const debouncedValue = useDebounce(value, 400)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    startTransition(() => {
      const params = new URLSearchParams()
      if (debouncedValue) params.set("q", debouncedValue)
      router.push(`${pathname}?${params.toString()}`)
    })
  }, [debouncedValue, pathname, router])

  return (
    <div className="relative max-w-xl">
      {isPending ? (
        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--muted-foreground] animate-spin" />
      ) : (
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--muted-foreground]" />
      )}
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur()
          }
        }}
        placeholder="Rechercher un titre, un auteur, un ISBN…"
        className="pl-9"
        enterKeyHint="search"
        autoFocus
      />
    </div>
  )
}

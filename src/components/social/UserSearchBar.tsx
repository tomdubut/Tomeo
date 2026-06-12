"use client"

import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useDebounce } from "@/hooks/useDebounce"
import { useState, useEffect } from "react"

export default function UserSearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [value, setValue] = useState(initialQuery)
  const debounced = useDebounce(value, 350)

  useEffect(() => {
    if (debounced.trim()) {
      router.push(`/users?q=${encodeURIComponent(debounced.trim())}`)
    } else {
      router.push("/users")
    }
  }, [debounced])

  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[--muted-foreground]" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Rechercher un lecteur…"
        className="pl-11"
        autoFocus
      />
    </div>
  )
}

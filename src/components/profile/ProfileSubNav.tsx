"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface Props {
  username: string
}

export default function ProfileSubNav({ username }: Props) {
  const pathname = usePathname()
  const tabs = [
    { label: "Profil", href: `/users/${username}` },
    { label: "Bibliothèque", href: `/users/${username}/library` },
    { label: "Critiques", href: `/users/${username}/reviews` },
    { label: "Listes", href: `/users/${username}/lists` },
  ]
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--secondary)" }}>
      {tabs.map(({ label, href }) => {
        const active = pathname === href
        return (
          <Link
            key={label}
            href={href}
            className={cn(
              "flex-1 text-center py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all",
              active
                ? "text-[--foreground] shadow-sm"
                : "text-[--muted-foreground] hover:text-[--foreground]"
            )}
            style={active ? { background: "var(--card)" } : undefined}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}

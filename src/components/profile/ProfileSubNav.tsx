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
    <div className="flex gap-4 border-b border-[--border] overflow-x-auto">
      {tabs.map(({ label, href }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0",
            pathname === href
              ? "text-[--foreground] border-[--primary]"
              : "text-[--muted-foreground] hover:text-[--foreground] border-transparent"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}

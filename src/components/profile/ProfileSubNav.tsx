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
    { label: "Bibliothèque", href: `/users/${username}/library` },
    { label: "Critiques", href: `/users/${username}/reviews` },
    { label: "Listes", href: `/users/${username}/lists` },
  ]
  return (
    <div className="flex gap-6 border-b border-[--border]">
      {tabs.map(({ label, href }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px",
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

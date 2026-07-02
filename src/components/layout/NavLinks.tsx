"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, Rss, BookMarked, Users } from "lucide-react"

interface Props {
  username: string
}

const links = (username: string) => [
  { href: "/books", label: "Catalogue", icon: Search, match: "/books" },
  { href: "/feed", label: "Fil", icon: Rss, match: "/feed" },
  { href: `/users/${username}/library`, label: "Bibliothèque", icon: BookMarked, match: `/users/${username}/library` },
  { href: "/users", label: "Lecteurs", icon: Users, match: "/users", exact: true },
]

export function DesktopNavLinks({ username }: Props) {
  const pathname = usePathname()

  return (
    <div className="hidden sm:flex items-center gap-0.5">
      {links(username).map(({ href, label, icon: Icon, match, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(match)
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors"
            style={{ color: active ? "var(--primary)" : "rgba(245,239,230,0.85)", background: active ? "rgba(255,255,255,0.1)" : undefined }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </div>
  )
}

export function MobileNavLinks({ username }: Props) {
  const pathname = usePathname()

  const mobileTabs = [
    { href: "/books", label: "Catalogue", icon: Search, match: "/books" },
    { href: "/feed", label: "Fil", icon: Rss, match: "/feed" },
    { href: `/users/${username}/library`, label: "Biblio.", icon: BookMarked, match: `/users/${username}/library` },
    { href: "/users", label: "Lecteurs", icon: Users, match: "/users", exact: true },
  ]

  return (
    <>
      {mobileTabs.map(({ href, label, icon: Icon, match, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(match)
        return (
          <Link
            key={href}
            href={href}
            className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 transition-colors relative"
            style={{ color: active ? "var(--primary)" : "rgba(245,239,230,0.85)" }}
          >
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full" style={{ background: "var(--primary)" }} />
            )}
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        )
      })}
    </>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, Rss, List, Users, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  username: string
}

const links = (username: string) => [
  { href: "/books", label: "Catalogue", icon: Search },
  { href: "/feed", label: "Fil", icon: Rss },
  { href: `/users/${username}/lists`, label: "Listes", icon: List, match: `/users/${username}` },
  { href: "/users", label: "Lecteurs", icon: Users, exact: true },
]

export function DesktopNavLinks({ username }: Props) {
  const pathname = usePathname()

  return (
    <div className="hidden sm:flex items-center gap-0.5">
      {links(username).map(({ href, label, icon: Icon, match, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(match ?? href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-[--secondary] text-[--foreground]"
                : "text-[--muted-foreground] hover:bg-[--secondary] hover:text-[--foreground]"
            )}
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
    { href: "/books", label: "Catalogue", icon: Search },
    { href: "/feed", label: "Fil", icon: Rss },
    { href: `/users/${username}/lists`, label: "Listes", icon: List, match: `/users/${username}/lists` },
    { href: "/users", label: "Lecteurs", icon: Users, exact: true },
    { href: `/users/${username}`, label: "Profil", icon: User, match: `/users/${username}`, exact: true },
  ]

  return (
    <>
      {mobileTabs.map(({ href, label, icon: Icon, match, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(match ?? href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 transition-colors",
              active ? "text-[--primary]" : "text-[--muted-foreground] hover:text-[--foreground]"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        )
      })}
    </>
  )
}

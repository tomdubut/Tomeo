"use client"

import { usePathname } from "next/navigation"
import { UnderlineTabs } from "@/components/ui/tabs"

interface Props {
  username: string
  hasManga?: boolean
}

export default function ProfileSubNav({ username, hasManga = false }: Props) {
  const pathname = usePathname()
  const tabs = [
    { key: "profile", label: "Profil", href: `/users/${username}` },
    { key: "library", label: "Bibliothèque", href: `/users/${username}/library` },
    ...(hasManga ? [{ key: "manga", label: "Manga", href: `/users/${username}/manga-library` }] : []),
    { key: "reviews", label: "Critiques", href: `/users/${username}/reviews` },
    { key: "lists", label: "Listes", href: `/users/${username}/lists` },
  ]
  return <UnderlineTabs items={tabs.map((t) => ({ ...t, active: pathname === t.href }))} />
}

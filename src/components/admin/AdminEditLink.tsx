import Link from "next/link"
import { Pencil } from "lucide-react"
import { isAdmin } from "@/lib/admin"

/** "Modifier" on book and manga pages, shown to admins only. */
export default async function AdminEditLink({ userId, href }: { userId: string; href: string }) {
  if (!(await isAdmin(userId))) return null
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
      <Pencil className="h-3.5 w-3.5" />
      Modifier (admin)
    </Link>
  )
}

import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ shelf?: string; sort?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params
  return { title: `Bibliothèque de @${username} — Tomeo` }
}

const SHELVES = [
  { key: "all", label: "Tous" },
  { key: "read", label: "Lus" },
  { key: "currently_reading", label: "En cours" },
  { key: "want_to_read", label: "À lire" },
] as const

type ShelfKey = (typeof SHELVES)[number]["key"]

export default async function UserLibraryPage({ params, searchParams }: Props) {
  const { username } = await params
  const { shelf = "all", sort = "recent" } = await searchParams
  const activeShelf = (SHELVES.some((s) => s.key === shelf) ? shelf : "all") as ShelfKey
  const activeSort = sort === "date_read" ? "date_read" : "recent"

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, is_public")
    .eq("username", username)
    .single()

  if (!profile) notFound()

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const isOwnProfile = currentUser?.id === profile.id

  let query = supabase
    .from("user_books")
    .select(`
      status, updated_at, finished_at,
      book:books(id, title, cover_url, avg_rating,
        book_authors(display_order, role, author:authors(name))
      )
    `)
    .eq("user_id", profile.id)

  if (activeShelf !== "all") {
    query = query.eq("status", activeShelf)
  }

  // Sort: by finish date (only meaningful on "read" shelf) or by recently added
  if (activeSort === "date_read" && (activeShelf === "read" || activeShelf === "all")) {
    query = query.order("finished_at", { ascending: false, nullsFirst: false })
  } else {
    query = query.order("updated_at", { ascending: false })
  }

  const { data: userBooks } = await query

  // Counts per shelf for tab badges
  const { data: counts } = await supabase
    .from("user_books")
    .select("status")
    .eq("user_id", profile.id)

  const countByShelf = (counts ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})
  const totalCount = counts?.length ?? 0

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">
            Bibliothèque de{" "}
            <Link href={`/users/${username}`} className="hover:underline">
              {displayName}
            </Link>
          </h1>
          <p className="text-sm text-[--muted-foreground] mt-0.5">
            {totalCount} livre{totalCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Sort control — only show when on the read shelf or all */}
        {(activeShelf === "read" || activeShelf === "all") && totalCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[--muted-foreground]">Trier par</span>
            <Link
              href={`/users/${username}/library?${new URLSearchParams({ ...(activeShelf !== "all" ? { shelf: activeShelf } : {}), sort: "recent" })}`}
              className={cn("px-2 py-1 rounded-md transition-colors", activeSort === "recent" ? "bg-[--secondary] font-medium" : "text-[--muted-foreground] hover:text-[--foreground]")}
            >
              Récents
            </Link>
            <Link
              href={`/users/${username}/library?${new URLSearchParams({ ...(activeShelf !== "all" ? { shelf: activeShelf } : {}), sort: "date_read" })}`}
              className={cn("px-2 py-1 rounded-md transition-colors", activeSort === "date_read" ? "bg-[--secondary] font-medium" : "text-[--muted-foreground] hover:text-[--foreground]")}
            >
              Date de lecture
            </Link>
          </div>
        )}
      </div>

      {/* Shelf tabs */}
      <div className="flex gap-1 border-b border-[--border]">
        {SHELVES.map(({ key, label }) => {
          const count = key === "all" ? totalCount : (countByShelf[key] ?? 0)
          return (
            <Link
              key={key}
              href={`/users/${username}/library${key !== "all" ? `?shelf=${key}` : ""}`}
              className={cn(
                "px-4 py-2 text-sm border-b-2 transition-colors",
                activeShelf === key
                  ? "border-[--foreground] font-medium"
                  : "border-transparent text-[--muted-foreground] hover:text-[--foreground]"
              )}
            >
              {label}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-[--secondary] px-1.5 py-0.5 text-xs">
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Book grid */}
      {!userBooks?.length ? (
        <div className="rounded-xl border border-[--border] bg-[--card] p-12 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-[--muted-foreground]" />
          <p className="font-medium">
            {isOwnProfile
              ? activeShelf === "all"
                ? "Votre bibliothèque est vide"
                : `Aucun livre dans "${SHELVES.find((s) => s.key === activeShelf)?.label}"`
              : `${displayName} n'a pas encore de livres ici`}
          </p>
          {isOwnProfile && activeShelf === "all" && (
            <p className="mt-1 text-sm text-[--muted-foreground]">
              <Link href="/books" className="underline underline-offset-4">
                Cherchez un livre
              </Link>{" "}
              pour commencer votre bibliothèque.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {userBooks.map((ub) => {
            const book = ub.book as any
            if (!book) return null

            const authors = (book.book_authors ?? [])
              .filter((ba: any) => ba.role === "author")
              .sort((a: any, b: any) => a.display_order - b.display_order)
              .map((ba: any) => ba.author?.name)
              .filter(Boolean)

            return (
              <Link key={book.id} href={`/books/${book.id}`} className="group">
                <div className="aspect-[2/3] relative rounded-md overflow-hidden bg-[--secondary] mb-2">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={`Couverture de ${book.title}`}
                      fill
                      className="object-cover group-hover:opacity-90 transition-opacity"
                      sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-8 w-8 text-[--muted-foreground]" />
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1">
                    <StatusBadge status={ub.status} />
                  </div>
                </div>
                <p className="text-xs font-medium line-clamp-2 group-hover:underline leading-tight">
                  {book.title}
                </p>
                {authors[0] && (
                  <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">
                    {authors[0]}
                  </p>
                )}
                {ub.status === "read" && (ub as any).finished_at && (
                  <p className="text-xs text-[--muted-foreground] mt-0.5">
                    {new Date((ub as any).finished_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    read: { label: "Lu", className: "bg-green-600 text-white" },
    currently_reading: { label: "En cours", className: "bg-blue-600 text-white" },
    want_to_read: { label: "À lire", className: "bg-[--secondary] text-[--foreground]" },
  }
  const badge = map[status]
  if (!badge) return null
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", badge.className)}>
      {badge.label}
    </span>
  )
}

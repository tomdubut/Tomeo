import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import ListCard from "@/components/lists/ListCard"
import { Button } from "@/components/ui/button"
import { BookOpen, Plus } from "lucide-react"

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params
  return { title: `Listes de @${username} — Tomeo` }
}

export default async function UserListsPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", username)
    .single()

  if (!profile) notFound()

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const isOwn = currentUser?.id === profile.id

  // Fetch lists — own profile sees private too
  const query = supabase
    .from("lists")
    .select("id, title, description, is_public, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })

  const { data: lists } = isOwn
    ? await query
    : await query.eq("is_public", true)

  // Get book counts and cover images per list
  const listIds = (lists ?? []).map((l) => l.id)
  const { data: listBooks } = listIds.length
    ? await supabase
        .from("list_books")
        .select("list_id, book:books(cover_url)")
        .in("list_id", listIds)
        .order("position", { ascending: true })
    : { data: [] }

  // Build per-list metadata
  const metaMap = (listBooks ?? []).reduce<Record<string, { count: number; covers: (string | null)[] }>>(
    (acc, lb) => {
      if (!acc[lb.list_id]) acc[lb.list_id] = { count: 0, covers: [] }
      acc[lb.list_id].count++
      if (acc[lb.list_id].covers.length < 4) {
        acc[lb.list_id].covers.push((lb.book as any)?.cover_url ?? null)
      }
      return acc
    },
    {}
  )

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Listes de{" "}
          <Link href={`/users/${username}`} className="hover:underline">
            {displayName}
          </Link>
        </h1>
        {isOwn && (
          <Button asChild size="sm">
            <Link href="/me/lists">
              <Plus className="h-4 w-4 mr-1.5" />
              Nouvelle liste
            </Link>
          </Button>
        )}
      </div>

      {!lists?.length ? (
        <div className="rounded-xl border border-[--border] bg-[--card] p-12 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-[--muted-foreground]" />
          <p className="font-medium">
            {isOwn ? "Vous n'avez pas encore créé de liste" : `${displayName} n'a pas encore de liste publique`}
          </p>
          {isOwn && (
            <div className="mt-3">
              <Button asChild size="sm">
                <Link href="/me/lists">Créer une liste</Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
          {lists.map((list) => {
            const meta = metaMap[list.id] ?? { count: 0, covers: [] }
            return (
              <ListCard
                key={list.id}
                list={{
                  ...list,
                  book_count: meta.count,
                  covers: meta.covers,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

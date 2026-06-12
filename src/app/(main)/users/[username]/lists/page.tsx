import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import ListCard from "@/components/lists/ListCard"
import FollowButton from "@/components/social/FollowButton"
import { BookOpen, MapPin, Globe, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

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

  const { data: profile } = await supabase.from("profiles").select("*").eq("username", username).single()
  if (!profile) notFound()

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const isOwn = currentUser?.id === profile.id

  let isFollowing = false
  if (currentUser && !isOwn) {
    const { data } = await supabase.from("follows").select("follower_id").eq("follower_id", currentUser.id).eq("following_id", profile.id).single()
    isFollowing = !!data
  }

  const [{ count: bookCount }, { count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from("user_books").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
  ])

  const query = supabase.from("lists").select("id, title, description, is_public, created_at").eq("user_id", profile.id).order("created_at", { ascending: false })
  const { data: lists } = isOwn ? await query : await query.eq("is_public", true)

  const listIds = (lists ?? []).map((l) => l.id)
  const { data: listBooks } = listIds.length
    ? await supabase.from("list_books").select("list_id, book:books(cover_url)").in("list_id", listIds).order("position", { ascending: true })
    : { data: [] }

  const metaMap = (listBooks ?? []).reduce<Record<string, { count: number; covers: (string | null)[] }>>((acc, lb) => {
    if (!acc[lb.list_id]) acc[lb.list_id] = { count: 0, covers: [] }
    acc[lb.list_id].count++
    if (acc[lb.list_id].covers.length < 4) acc[lb.list_id].covers.push((lb.book as any)?.cover_url ?? null)
    return acc
  }, {})

  const displayName = profile.display_name ?? profile.username
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Profile header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <div className="flex justify-center sm:block">
          <Avatar className="h-20 w-20 ring-4 ring-[--border]">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-[--secondary] text-2xl font-bold">{initials}</AvatarFallback>
          </Avatar>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold">{displayName}</h1>
              <p className="text-sm text-[--muted-foreground] font-medium">@{profile.username}</p>
            </div>
            {isOwn ? (
              <Button asChild variant="outline" size="sm"><a href="/settings">Modifier le profil</a></Button>
            ) : currentUser ? (
              <FollowButton targetUserId={profile.id} initialIsFollowing={isFollowing} />
            ) : null}
          </div>

          {profile.bio && <p className="mt-2 text-sm leading-relaxed">{profile.bio}</p>}

          <div className="mt-2 flex flex-wrap gap-3 text-sm text-[--muted-foreground]">
            {profile.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile.location}</span>}
            {profile.website_url && (
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                <Globe className="h-3.5 w-3.5" />{profile.website_url.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>

          <div className="mt-4 flex gap-5 text-sm">
            <div className="text-center">
              <p className="text-2xl font-extrabold leading-none">{bookCount ?? 0}</p>
              <p className="text-[--muted-foreground] mt-0.5">Livres</p>
            </div>
            <div className="w-px bg-[--border]" />
            <div className="text-center">
              <p className="text-2xl font-extrabold leading-none">{followerCount ?? 0}</p>
              <p className="text-[--muted-foreground] mt-0.5">Abonnés</p>
            </div>
            <div className="w-px bg-[--border]" />
            <div className="text-center">
              <p className="text-2xl font-extrabold leading-none">{followingCount ?? 0}</p>
              <p className="text-[--muted-foreground] mt-0.5">Abonnements</p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile sub-nav */}
      <div className="flex gap-1 rounded-2xl bg-[--secondary] p-1">
        {[
          { label: "Bibliothèque", href: `/users/${username}/library` },
          { label: "Critiques", href: `/users/${username}/reviews` },
          { label: "Listes", href: `/users/${username}/lists` },
        ].map(({ label, href }) => {
          const isActive = href.includes("/lists")
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex-1 rounded-xl py-2 text-center text-sm font-semibold transition-colors",
                isActive ? "bg-[--card] text-[--foreground]" : "text-[--muted-foreground] hover:text-[--foreground]"
              )}
              style={isActive ? { boxShadow: "var(--shadow-sm)" } : {}}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Lists header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[--muted-foreground] font-medium">{lists?.length ?? 0} liste{(lists?.length ?? 0) !== 1 ? "s" : ""}</p>
        {isOwn && (
          <Button asChild size="sm">
            <Link href="/me/lists"><Plus className="h-4 w-4" />Nouvelle liste</Link>
          </Button>
        )}
      </div>

      {!lists?.length ? (
        <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center" style={{ boxShadow: "var(--shadow)" }}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[--secondary]">
            <BookOpen className="h-8 w-8 text-[--primary]" />
          </div>
          <p className="text-lg font-bold">
            {isOwn ? "Vous n'avez pas encore créé de liste" : `${displayName} n'a pas encore de liste publique`}
          </p>
          {isOwn && (
            <div className="mt-4">
              <Button asChild size="sm"><Link href="/me/lists">Créer une liste</Link></Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
          {lists.map((list) => {
            const meta = metaMap[list.id] ?? { count: 0, covers: [] }
            return <ListCard key={list.id} list={{ ...list, book_count: meta.count, covers: meta.covers }} />
          })}
        </div>
      )}
    </div>
  )
}

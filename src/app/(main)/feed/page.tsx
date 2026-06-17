import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import BookCover from "@/components/books/BookCover"
import { Users } from "lucide-react"
import Link from "next/link"

type ActivityRow = {
  id: string
  activity_type: string
  created_at: string
  actor: { username: string; display_name: string | null; avatar_url: string | null } | null
  book: { id: string; title: string; cover_url: string | null } | null
  review: { id: string; body: string } | null
  list: { id: string; title: string } | null
}

type ActivityGroup = {
  key: string
  actor_id: string
  activity_type: string
  created_at: string
  actor: ActivityRow["actor"]
  items: ActivityRow[]
}

const HIDDEN_TYPES = new Set(["followed_user"])

function groupActivities(activities: ActivityRow[]): ActivityGroup[] {
  const groups: ActivityGroup[] = []
  for (const item of activities) {
    if (HIDDEN_TYPES.has(item.activity_type)) continue
    const last = groups[groups.length - 1]
    if (last && last.actor_id === (item.actor?.username ?? item.id) && last.activity_type === item.activity_type) {
      last.items.push(item)
    } else {
      groups.push({
        key: item.id,
        actor_id: item.actor?.username ?? item.id,
        activity_type: item.activity_type,
        created_at: item.created_at,
        actor: item.actor,
        items: [item],
      })
    }
  }
  return groups
}

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/onboarding")

  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)

  const followingIds = followRows?.map((r) => r.following_id) ?? []

  const { data: raw } = followingIds.length
    ? await supabase
        .from("activity_feed")
        .select(`
          id, activity_type, created_at,
          actor:profiles!actor_id(username, display_name, avatar_url),
          book:books(id, title, cover_url),
          review:reviews(id, body),
          list:lists(id, title),
          target_user:profiles!target_user_id(username, display_name)
        `)
        .in("actor_id", followingIds)
        .order("created_at", { ascending: false })
        .limit(60)
    : { data: [] }

  const groups = groupActivities((raw ?? []) as unknown as ActivityRow[])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">
        Bonjour, {profile.display_name ?? profile.username} 👋
      </h1>

      {!groups.length ? (
        <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[--secondary]">
            <Users className="h-8 w-8 text-[--primary]" />
          </div>
          <p className="text-lg font-bold">Votre fil est vide pour l&apos;instant</p>
          <p className="mt-2 text-sm text-[--muted-foreground]">
            Suivez des lecteurs pour voir leur activité ici.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.key}>
              <ActivityGroup group={group} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ActivityGroup({ group }: { group: ActivityGroup }) {
  const actor = group.actor
  const actorName = actor?.display_name ?? actor?.username ?? "Quelqu'un"
  const actorUsername = actor?.username
  const initials = actorName.slice(0, 2).toUpperCase()
  const count = group.items.length
  const first = group.items[0]

  return (
    <div className="flex gap-3 rounded-2xl bg-[--card] p-4">
      <Link href={`/users/${actorUsername}`} className="shrink-0 mt-0.5">
        <Avatar className="h-9 w-9">
          <AvatarImage src={actor?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <Link href={`/users/${actorUsername}`} className="font-semibold hover:underline">
            {actorName}
          </Link>
          {" "}
          {groupLabel(group)}
          <span className="ml-2 text-xs text-[--muted-foreground]">{formatRelative(group.created_at)}</span>
        </p>

        {/* Multiple books — horizontal cover row */}
        {count > 1 && group.items.some((i) => i.book) && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {group.items.filter((i) => i.book).map((i) => (
              <Link key={i.id} href={`/books/${i.book!.id}`} className="group">
                <div className="w-10 aspect-[2/3] shrink-0 rounded overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <BookCover
                    src={i.book!.cover_url}
                    title={i.book!.title}
                    className="w-full h-full"
                    sizes="40px"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Single book */}
        {count === 1 && first.book && (
          <Link href={`/books/${first.book.id}`} className="mt-2 flex items-center gap-2.5 group">
            <div className="w-8 aspect-[2/3] shrink-0 rounded overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              <BookCover
                src={first.book.cover_url}
                title={first.book.title}
                className="w-full h-full"
                sizes="32px"
              />
            </div>
            <span className="text-sm font-medium group-hover:underline line-clamp-1">{first.book.title}</span>
          </Link>
        )}

        {/* Review excerpt (single only) */}
        {count === 1 && group.activity_type === "reviewed_book" && first.review?.body && (
          <p className="mt-2 text-sm text-[--muted-foreground] line-clamp-3 italic">
            &ldquo;{first.review.body}&rdquo;
          </p>
        )}

        {/* List link */}
        {count === 1 && group.activity_type === "created_list" && first.list && (
          <Link href={`/lists/${first.list.id}`} className="mt-2 inline-block text-sm font-medium hover:underline">
            📋 {first.list.title}
          </Link>
        )}
      </div>
    </div>
  )
}

function groupLabel(group: ActivityGroup): string {
  const count = group.items.length
  switch (group.activity_type) {
    case "added_book":
      return count > 1
        ? `a ajouté ${count} livres à sa bibliothèque`
        : "a ajouté un livre à sa bibliothèque"
    case "rated_book":
      return count > 1
        ? `a noté ${count} livres`
        : "a noté un livre"
    case "reviewed_book":
      return count > 1
        ? `a écrit ${count} critiques`
        : "a écrit une critique"
    case "created_list":
      return count > 1
        ? `a créé ${count} listes`
        : "a créé une liste"
    default:
      return "a fait quelque chose"
  }
}

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

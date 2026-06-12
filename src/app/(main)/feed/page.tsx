import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import BookCover from "@/components/books/BookCover"
import { Users } from "lucide-react"
import Link from "next/link"

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

  const { data: activities } = followingIds.length
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
        .limit(40)
    : { data: [] }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">
        Bonjour, {profile.display_name ?? profile.username} 👋
      </h1>

      {!activities?.length ? (
        <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center" style={{ boxShadow: "var(--shadow)" }}>
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
          {activities.map((item) => (
            <li key={item.id}>
              <ActivityItem item={item as any} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ActivityItem({ item }: { item: any }) {
  const actor = item.actor
  const actorName = actor?.display_name ?? actor?.username ?? "Quelqu'un"
  const actorUsername = actor?.username
  const initials = actorName.slice(0, 2).toUpperCase()

  const action = activityLabel(item)

  return (
    <div className="flex gap-3 rounded-2xl bg-[--card] p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
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
          {action}
          <span className="ml-2 text-xs text-[--muted-foreground]">{formatRelative(item.created_at)}</span>
        </p>

        {item.book && (
          <Link href={`/books/${item.book.id}`} className="mt-2 flex items-center gap-2.5 group">
            <div className="w-8 aspect-[2/3] shrink-0">
              <BookCover
                src={item.book.cover_url}
                title={item.book.title}
                className="w-full h-full rounded shadow-sm"
                sizes="32px"
              />
            </div>
            <span className="text-sm font-medium group-hover:underline line-clamp-1">{item.book.title}</span>
          </Link>
        )}

        {item.activity_type === "reviewed_book" && item.review?.body && (
          <p className="mt-2 text-sm text-[--muted-foreground] line-clamp-3 italic">
            &ldquo;{item.review.body}&rdquo;
          </p>
        )}

        {item.activity_type === "created_list" && item.list && (
          <Link
            href={`/lists/${item.list.id}`}
            className="mt-2 inline-block text-sm font-medium hover:underline"
          >
            📋 {item.list.title}
          </Link>
        )}
      </div>
    </div>
  )
}

function activityLabel(item: any): React.ReactNode {
  switch (item.activity_type) {
    case "added_book":
      return "a ajouté un livre à sa bibliothèque"
    case "rated_book":
      return "a noté un livre"
    case "reviewed_book":
      return "a écrit une critique"
    case "created_list":
      return "a créé une liste"
    case "followed_user":
      return (
        <>
          {"suit maintenant "}
          {item.target_user && (
            <Link
              href={`/users/${item.target_user.username}`}
              className="font-semibold hover:underline"
            >
              {item.target_user.display_name ?? item.target_user.username}
            </Link>
          )}
        </>
      )
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

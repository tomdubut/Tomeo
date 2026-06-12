import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BookOpen, Users } from "lucide-react"

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

  // Step 1: get IDs of followed users
  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)

  const followingIds = followRows?.map((r) => r.following_id) ?? []

  // Step 2: fetch their activity
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
        <div className="rounded-xl border border-[--border] bg-[--card] p-12 text-center">
          <Users className="mx-auto mb-4 h-10 w-10 text-[--muted-foreground]" />
          <p className="font-medium">Votre fil est vide pour l&apos;instant</p>
          <p className="mt-1 text-sm text-[--muted-foreground]">
            Suivez des lecteurs pour voir leur activité ici.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {activities.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[--border] bg-[--card] p-4 text-sm"
            >
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
  const actorLink = `/users/${actor?.username}`
  const timeAgo = formatRelative(item.created_at)

  let text: React.ReactNode = null

  switch (item.activity_type) {
    case "added_book":
      text = (
        <>
          <a href={actorLink} className="font-medium hover:underline">{actorName}</a>
          {" a ajouté "}
          {item.book && (
            <a href={`/books/${item.book.id}`} className="font-medium hover:underline">
              {item.book.title}
            </a>
          )}
          {" à sa bibliothèque"}
        </>
      )
      break
    case "rated_book":
      text = (
        <>
          <a href={actorLink} className="font-medium hover:underline">{actorName}</a>
          {" a noté "}
          {item.book && (
            <a href={`/books/${item.book.id}`} className="font-medium hover:underline">
              {item.book.title}
            </a>
          )}
        </>
      )
      break
    case "reviewed_book":
      text = (
        <>
          <a href={actorLink} className="font-medium hover:underline">{actorName}</a>
          {" a écrit une critique de "}
          {item.book && (
            <a href={`/books/${item.book.id}`} className="font-medium hover:underline">
              {item.book.title}
            </a>
          )}
        </>
      )
      break
    case "created_list":
      text = (
        <>
          <a href={actorLink} className="font-medium hover:underline">{actorName}</a>
          {" a créé la liste "}
          {item.list && (
            <a href={`/lists/${item.list.id}`} className="font-medium hover:underline">
              {item.list.title}
            </a>
          )}
        </>
      )
      break
    case "followed_user":
      text = (
        <>
          <a href={actorLink} className="font-medium hover:underline">{actorName}</a>
          {" suit maintenant "}
          {item.target_user && (
            <a href={`/users/${item.target_user.username}`} className="font-medium hover:underline">
              {item.target_user.display_name ?? item.target_user.username}
            </a>
          )}
        </>
      )
      break
  }

  return (
    <div className="flex items-start gap-3">
      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[--muted-foreground]" />
      <div className="flex-1 leading-snug">
        {text}
        <span className="ml-2 text-xs text-[--muted-foreground]">{timeAgo}</span>
      </div>
    </div>
  )
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

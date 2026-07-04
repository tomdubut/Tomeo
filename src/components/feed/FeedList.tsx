"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import UserAvatar from "@/components/ui/UserAvatar"
import BookCover from "@/components/books/BookCover"
import { formatDate } from "@/lib/utils/date"
import { loadMoreFeedActivities, type ActivityRow } from "@/app/(main)/feed/actions"

type ActivityGroup = {
  key: string
  actor_id: string
  activity_type: string
  created_at: string
  actor: ActivityRow["actor"]
  items: ActivityRow[]
}

const HIDDEN_TYPES = new Set(["followed_user"])
const PAGE_SIZE = 20

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

function mergeGroups(existing: ActivityGroup[], incoming: ActivityGroup[]): ActivityGroup[] {
  if (!incoming.length) return existing
  const last = existing[existing.length - 1]
  const first = incoming[0]
  // Merge if same actor + type (group split across page boundary)
  if (last && first && last.actor_id === first.actor_id && last.activity_type === first.activity_type) {
    const merged = [...existing.slice(0, -1), { ...last, items: [...last.items, ...first.items] }, ...incoming.slice(1)]
    return merged
  }
  return [...existing, ...incoming]
}

function groupLabel(group: ActivityGroup): string {
  const count = group.items.length
  switch (group.activity_type) {
    case "added_book": return count > 1 ? `a ajouté ${count} livres à sa bibliothèque` : "a ajouté un livre à sa bibliothèque"
    case "rated_book": return count > 1 ? `a noté ${count} livres` : "a noté un livre"
    case "reviewed_book": return count > 1 ? `a écrit ${count} critiques` : "a écrit une critique"
    case "created_list": return count > 1 ? `a créé ${count} listes` : "a créé une liste"
    default: return "a fait quelque chose"
  }
}

function ActivityGroupCard({ group }: { group: ActivityGroup }) {
  const actor = group.actor
  const actorName = actor?.display_name ?? actor?.username ?? "Quelqu'un"
  const actorUsername = actor?.username
  const count = group.items.length
  const first = group.items[0]

  return (
    <div className="flex gap-3 rounded-2xl bg-[--card] p-4">
      <Link href={`/users/${actorUsername}`} className="shrink-0 mt-0.5">
        {actor ? (
          <UserAvatar profile={actor} className="h-9 w-9" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-[--secondary]" />
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <Link href={`/users/${actorUsername}`} className="font-semibold hover:underline">{actorName}</Link>
          {" "}
          {groupLabel(group)}
          <span className="ml-2 text-xs text-[--muted-foreground]">{formatDate(group.created_at)}</span>
        </p>

        {count > 1 && group.items.some((i) => i.book) && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {group.items.filter((i) => i.book).map((i) => (
              <Link key={i.id} href={`/books/${i.book!.id}`}>
                <div className="w-10 aspect-[2/3] shrink-0 rounded overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <BookCover src={i.book!.cover_url} title={i.book!.title} className="w-full h-full" sizes="40px" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {count === 1 && first.book && (
          <Link href={`/books/${first.book.id}`} className="mt-2 flex items-center gap-2.5 group">
            <div className="w-8 aspect-[2/3] shrink-0 rounded overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              <BookCover src={first.book.cover_url} title={first.book.title} className="w-full h-full" sizes="32px" />
            </div>
            <span className="text-sm font-medium group-hover:underline line-clamp-1">{first.book.title}</span>
          </Link>
        )}

        {count === 1 && group.activity_type === "reviewed_book" && first.review?.body && (
          first.review.is_spoiler ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-[--muted-foreground] italic">
              <span>⚠️</span> Critique masquée — contient des spoilers
            </p>
          ) : (
            <p className="mt-2 text-sm text-[--muted-foreground] line-clamp-3 italic">
              &ldquo;{first.review.body}&rdquo;
            </p>
          )
        )}

        {count === 1 && group.activity_type === "created_list" && first.list && (
          <Link href={`/lists/${first.list.id}`} className="mt-2 inline-block text-sm font-medium hover:underline">
            📋 {first.list.title}
          </Link>
        )}
      </div>
    </div>
  )
}

interface Props {
  initialActivities: ActivityRow[]
}

export default function FeedList({ initialActivities }: Props) {
  const [groups, setGroups] = useState<ActivityGroup[]>(() => groupActivities(initialActivities))
  const [lastCursor, setLastCursor] = useState<string | null>(
    initialActivities[initialActivities.length - 1]?.created_at ?? null
  )
  const [hasMore, setHasMore] = useState(initialActivities.length === PAGE_SIZE)
  const [isPending, startTransition] = useTransition()
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasMore || !lastCursor) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isPending) {
          startTransition(async () => {
            const next = await loadMoreFeedActivities({ cursor: lastCursor, limit: PAGE_SIZE })
            if (next.length < PAGE_SIZE) setHasMore(false)
            if (next.length > 0) {
              const newGroups = groupActivities(next)
              setGroups((prev) => mergeGroups(prev, newGroups))
              setLastCursor(next[next.length - 1].created_at)
            } else {
              setHasMore(false)
            }
          })
        }
      },
      { rootMargin: "300px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isPending, lastCursor])

  return (
    <>
      <ul className="space-y-3">
        {groups.map((group) => (
          <li key={group.key}>
            <ActivityGroupCard group={group} />
          </li>
        ))}
      </ul>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {isPending && <Loader2 className="h-5 w-5 animate-spin text-[--muted-foreground]" />}
        </div>
      )}
    </>
  )
}

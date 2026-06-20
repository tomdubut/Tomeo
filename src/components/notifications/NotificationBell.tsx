"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import Link from "next/link"
import { Bell, Loader2 } from "lucide-react"
import UserAvatar from "@/components/ui/UserAvatar"
import { getNotifications, markAllRead, type Notification } from "@/app/(main)/notifications/actions"
import { cn } from "@/lib/utils"

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return `il y a ${Math.floor(diff / 86400)} j`
}

function notificationLabel(n: Notification) {
  const name = n.actor?.display_name ?? n.actor?.username ?? "Quelqu'un"
  if (n.type === "new_follower") return <><span className="font-semibold">{name}</span> vous suit</>
  if (n.type === "new_comment") return <><span className="font-semibold">{name}</span> a commenté votre critique</>
  return null
}

function notificationHref(n: Notification) {
  if (n.type === "new_follower") return `/users/${n.actor?.username}`
  if (n.type === "new_comment" && n.book_id) return `/books/${n.book_id}`
  return null
}

export default function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    startTransition(async () => {
      if (!loaded) {
        const data = await getNotifications()
        setNotifications(data)
        setLoaded(true)
      }
      if (unreadCount > 0) {
        await markAllRead()
        setUnreadCount(0)
      }
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:opacity-70"
        style={{ color: "rgba(245,239,230,0.85)" }}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[--primary] text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-[--border] overflow-hidden z-50"
          style={{ background: "var(--background)", boxShadow: "var(--shadow-lg)" }}>

          <div className="flex items-center justify-between px-4 py-3 border-b border-[--border]">
            <p className="text-sm font-semibold">Notifications</p>
          </div>

          {isPending && !loaded ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-[--muted-foreground]" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[--muted-foreground]">
              Aucune notification pour l&apos;instant
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-[--border]">
              {notifications.map((n) => {
                const href = notificationHref(n)
                const label = notificationLabel(n)
                const content = (
                  <div className={cn(
                    "flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-[--secondary]",
                    !n.read_at && "bg-[--secondary]/60"
                  )}>
                    {n.actor ? (
                      <UserAvatar profile={n.actor} className="h-8 w-8 shrink-0 mt-0.5" />
                    ) : (
                      <div className="h-8 w-8 shrink-0 mt-0.5 rounded-full bg-[--secondary]" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="leading-snug">{label}</p>
                      <p className="text-xs text-[--muted-foreground] mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[--primary]" />}
                  </div>
                )
                return (
                  <li key={n.id}>
                    {href ? (
                      <Link href={href} onClick={() => setOpen(false)}>{content}</Link>
                    ) : content}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useTransition, useRef } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { addComment, deleteComment } from "@/app/(main)/reviews/actions"
import { MessageCircle, Trash2, SendHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

interface Comment {
  id: string
  body: string
  created_at: string
  user_id: string
  profile: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
}

interface Props {
  reviewId: string
  bookId: string
  initialComments: Comment[]
  currentUserId?: string
  currentUserProfile?: { username: string; display_name: string | null; avatar_url: string | null }
}

export default function CommentsSection({ reviewId, bookId, initialComments, currentUserId, currentUserProfile }: Props) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [body, setBody] = useState("")
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function submit() {
    const trimmed = body.trim()
    if (!trimmed || isPending || !currentUserId || !currentUserProfile) return
    const optimistic: Comment = {
      id: `optimistic-${Date.now()}`,
      body: trimmed,
      created_at: new Date().toISOString(),
      user_id: currentUserId,
      profile: currentUserProfile,
    }
    setComments((prev) => [...prev, optimistic])
    setBody("")
    startTransition(async () => {
      await addComment(reviewId, trimmed, bookId)
    })
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      await deleteComment(commentId, bookId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    })
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit()
  }

  return (
    <div className="border-t border-[--border] pt-3">
      {/* Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold text-[--muted-foreground] hover:text-[--foreground] transition-colors"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {comments.length > 0
          ? `${comments.length} commentaire${comments.length > 1 ? "s" : ""}`
          : "Commenter"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Existing comments */}
          {comments.map((c) => {
            const name = c.profile.display_name ?? c.profile.username
            const initials = name.slice(0, 2).toUpperCase()
            const isOwn = currentUserId === c.user_id
            return (
              <div key={c.id} className="flex gap-2.5 group">
                <Link href={`/users/${c.profile.username}`} className="shrink-0 mt-0.5">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={c.profile.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px] font-bold bg-[--secondary]">{initials}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0 rounded-xl bg-[--secondary] px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link href={`/users/${c.profile.username}`} className="text-xs font-bold hover:underline">
                      {name}
                    </Link>
                    <span className="text-[10px] text-[--muted-foreground] shrink-0">
                      {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5 leading-snug">{c.body}</p>
                </div>
                {isOwn && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={isPending}
                    className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[--muted-foreground] hover:text-[--destructive]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}

          {/* Input */}
          {currentUserId ? (
            <div className="flex gap-2.5 items-end">
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Votre commentaire… (Cmd+Entrée pour envoyer)"
                rows={2}
                maxLength={2000}
                className={cn(
                  "flex-1 rounded-xl border border-[--border] bg-[--card] px-3 py-2 text-sm resize-none",
                  "placeholder:text-[--muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
                )}
              />
              <Button
                size="icon"
                onClick={submit}
                disabled={!body.trim() || isPending}
                className="shrink-0 h-9 w-9"
              >
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-xs text-[--muted-foreground]">
              <Link href="/login" className="font-semibold text-[--primary] hover:underline">Connectez-vous</Link> pour commenter.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

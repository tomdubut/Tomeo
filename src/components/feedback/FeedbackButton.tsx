"use client"

import { useState, useTransition } from "react"
import { Bug, Lightbulb, MessageCircle, MessageSquareText } from "lucide-react"
import { Sheet } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { canSendFeedback, sendFeedback, type FeedbackKind } from "@/lib/feedback"

const KINDS: { value: FeedbackKind; label: string; icon: typeof Bug; placeholder: string }[] = [
  { value: "bug", label: "Un problème", icon: Bug, placeholder: "Qu'est-ce qui ne marche pas ? Que faisiez-vous à ce moment-là ?" },
  { value: "idea", label: "Une idée", icon: Lightbulb, placeholder: "Quelle fonctionnalité aimeriez-vous voir sur Tomesie ?" },
  { value: "other", label: "Autre", icon: MessageCircle, placeholder: "Dites-nous ce que vous en pensez…" },
]
const MAX = 2000

/**
 * "Donner mon avis": a trigger (navbar icon, footer link or settings button) that opens the feedback form.
 * The page and screen size are sent with the message so bug reports can be reproduced.
 */
export default function FeedbackButton({ variant }: { variant: "icon" | "link" | "button" }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<FeedbackKind>("bug")
  const [message, setMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [isPending, startTransition] = useTransition()

  function openForm() {
    setOpen(true)
    if (signedIn === null) canSendFeedback().then(setSignedIn).catch(() => setSignedIn(true))
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next && sent) {
      // Fresh form next time
      setSent(false)
      setMessage("")
      setKind("bug")
    }
    setError(null)
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await sendFeedback({
        kind,
        message,
        // Read when sending, not during render: the footer is prerendered on every route
        page: window.location.pathname,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      })
      if (result.error) setError(result.error)
      else setSent(true)
    })
  }

  const current = KINDS.find((k) => k.value === kind)!
  const tooShort = message.trim().length < 3

  return (
    <>
      {variant === "icon" && (
        <button
          type="button"
          onClick={openForm}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-dark-foreground/85 transition-colors hover:opacity-70"
          aria-label="Donner mon avis"
          title="Donner mon avis"
        >
          <MessageSquareText className="h-5 w-5" />
        </button>
      )}
      {variant === "link" && (
        <button type="button" onClick={openForm} className="font-semibold text-primary underline-offset-4 hover:underline">
          Donner mon avis
        </button>
      )}
      {variant === "button" && (
        <Button variant="outline" onClick={openForm}>
          <MessageSquareText className="h-4 w-4" />
          Donner mon avis
        </Button>
      )}

      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title="Donner mon avis"
        footer={
          signedIn === false ? undefined : sent ? (
            <Button className="w-full" onClick={() => onOpenChange(false)}>Fermer</Button>
          ) : (
            <Button className="w-full" onClick={submit} disabled={isPending || tooShort}>
              {isPending ? "Envoi…" : "Envoyer"}
            </Button>
          )
        }
      >
        {signedIn === false ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">Connectez-vous pour nous envoyer votre avis.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button asChild><Link href="/login">Connexion</Link></Button>
              <Button variant="outline" asChild><Link href="/register">S&apos;inscrire</Link></Button>
            </div>
          </div>
        ) : sent ? (
          <div className="py-6 text-center">
            <p className="text-lg font-extrabold">Merci !</p>
            <p className="mt-1 text-sm text-muted-foreground">Votre message a bien été envoyé. Il nous aide à améliorer Tomesie.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Type de message">
              {KINDS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => setKind(value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors",
                    kind === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
                placeholder={current.placeholder}
                rows={6}
                aria-label="Votre message"
                className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">{message.length} / {MAX}</p>
            </div>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </div>
        )}
      </Sheet>
    </>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { importBookFromPreview } from "@/app/(main)/books/actions"
import BookPageSkeleton from "@/components/books/BookPageSkeleton"
import { Button } from "@/components/ui/button"

type Failure = "not_found" | "not_authenticated" | "failed"

const MESSAGES: Record<Failure, string> = {
  not_found: "Ce livre est introuvable.",
  not_authenticated: "Votre session a expiré. Reconnectez-vous pour ajouter ce livre.",
  failed: "Impossible d'ajouter ce livre pour le moment.",
}

/** Imports a Google Books volume into the catalogue, then opens its page. */
export default function ImportBookPreview({ googleBooksId }: { googleBooksId: string }) {
  const router = useRouter()
  const [failure, setFailure] = useState<Failure | null>(null)
  const [attempt, setAttempt] = useState(0)
  const started = useRef(-1)

  useEffect(() => {
    // Once per attempt (React runs effects twice in development)
    if (started.current === attempt) return
    started.current = attempt
    importBookFromPreview(googleBooksId)
      .then((result) => {
        if ("id" in result) router.replace(`/books/${result.id}`)
        else setFailure(result.error)
      })
      .catch(() => setFailure("failed"))
  }, [googleBooksId, attempt, router])

  if (failure) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-card p-6 text-center shadow-card">
        <p className="font-semibold">{MESSAGES[failure]}</p>
        <div className="mt-5 flex justify-center gap-2">
          {failure === "failed" && (
            <Button onClick={() => { setFailure(null); setAttempt((a) => a + 1) }}>Réessayer</Button>
          )}
          {failure === "not_authenticated" ? (
            <Button asChild><Link href="/login">Connexion</Link></Button>
          ) : (
            <Button variant="outline" asChild><Link href="/books">Retour au catalogue</Link></Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <p className="mb-4 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        Ajout du livre à Tomesie…
      </p>
      <BookPageSkeleton />
    </div>
  )
}

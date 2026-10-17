"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { updateBook } from "@/app/(main)/admin/actions"

const field = "w-full rounded-xl border border-input bg-card px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"

export default function BookEditForm({
  book,
  allGenres,
}: {
  book: { id: string; title: string; subtitle: string | null; description: string | null; cover_url: string | null; genres: string[] }
  allGenres: { slug: string; label: string; type: string }[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState(book.title)
  const [subtitle, setSubtitle] = useState(book.subtitle ?? "")
  const [description, setDescription] = useState(book.description ?? "")
  const [cover, setCover] = useState(book.cover_url ?? "")
  const [genres, setGenres] = useState<string[]>(book.genres)
  const [isPending, startTransition] = useTransition()

  const toggle = (slug: string) => setGenres((g) => (g.includes(slug) ? g.filter((s) => s !== slug) : [...g, slug]))

  function save() {
    startTransition(async () => {
      const { error } = await updateBook(book.id, { title, subtitle, description, cover_url: cover, genres })
      if (error) toast.error(error)
      else {
        toast.success("Livre enregistré")
        router.refresh()
      }
    })
  }

  const formats = allGenres.filter((g) => g.type === "format")
  const themes = allGenres.filter((g) => g.type !== "format")

  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
      <div className="space-y-2">
        <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-secondary">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview of any pasted URL
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted-foreground">Pas de couverture</div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Aperçu de la couverture</p>
      </div>

      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Titre</span>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Sous-titre</span>
          <input className={field} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={300} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Couverture (adresse https de l&apos;image)</span>
          <input className={field} value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Résumé</span>
          <textarea className={cn(field, "min-h-48")} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={10000} />
        </label>

        {[{ title: "Format", items: formats }, { title: "Genres", items: themes }].map((group) => (
          <fieldset key={group.title} className="space-y-1.5">
            <legend className="text-sm font-semibold">{group.title}</legend>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((g) => (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() => toggle(g.slug)}
                  aria-pressed={genres.includes(g.slug)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    genres.includes(g.slug) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}

        <Button onClick={save} disabled={isPending || !title.trim()}>{isPending ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
    </div>
  )
}

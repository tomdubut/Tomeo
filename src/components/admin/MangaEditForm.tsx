"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { updateManga } from "@/app/(main)/admin/actions"

const field = "w-full rounded-xl border border-input bg-card px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"

export default function MangaEditForm({
  manga,
}: {
  manga: {
    id: string; title_fr: string; author: string | null; publisher: string | null; description: string | null
    cover_url: string | null; fr_volume_count: number | null; jp_volume_count: number | null; needs_review: boolean
  }
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    title_fr: manga.title_fr,
    author: manga.author ?? "",
    publisher: manga.publisher ?? "",
    description: manga.description ?? "",
    cover_url: manga.cover_url ?? "",
    fr_volume_count: manga.fr_volume_count?.toString() ?? "",
    jp_volume_count: manga.jp_volume_count?.toString() ?? "",
    needs_review: manga.needs_review,
  })
  const [isPending, startTransition] = useTransition()
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  function save() {
    startTransition(async () => {
      const { error } = await updateManga(manga.id, form)
      if (error) toast.error(error)
      else {
        toast.success("Série enregistrée")
        router.refresh()
      }
    })
  }

  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
      <div className="space-y-2">
        <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-secondary">
          {form.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview of any pasted URL
            <img src={form.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted-foreground">Pas de couverture</div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Aperçu de la couverture</p>
      </div>

      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Titre français</span>
          <input className={field} value={form.title_fr} onChange={set("title_fr")} maxLength={300} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Auteur</span>
            <input className={field} value={form.author} onChange={set("author")} maxLength={200} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Éditeur</span>
            <input className={field} value={form.publisher} onChange={set("publisher")} maxLength={200} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Tomes parus en France</span>
            <input className={field} inputMode="numeric" value={form.fr_volume_count} onChange={set("fr_volume_count")} placeholder="inconnu" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Tomes au Japon (série finie)</span>
            <input className={field} inputMode="numeric" value={form.jp_volume_count} onChange={set("jp_volume_count")} placeholder="inconnu / en cours" />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Couverture (adresse https de l&apos;image)</span>
          <input className={field} value={form.cover_url} onChange={set("cover_url")} placeholder="https://…" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Résumé</span>
          <textarea className={cn(field, "min-h-48")} value={form.description} onChange={set("description")} maxLength={10000} />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-primary"
            checked={form.needs_review}
            onChange={(e) => setForm((f) => ({ ...f, needs_review: e.target.checked }))}
          />
          <span>
            <span className="font-semibold">À vérifier</span>
            <span className="block text-xs text-muted-foreground">Décochez quand la fiche est correcte : la série apparaît alors dans le catalogue manga.</span>
          </span>
        </label>

        <Button onClick={save} disabled={isPending || !form.title_fr.trim()}>{isPending ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
    </div>
  )
}

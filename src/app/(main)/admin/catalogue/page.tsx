import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { PillTabs } from "@/components/ui/tabs"
import BookCover from "@/components/books/BookCover"
import AdminShell from "@/components/admin/AdminShell"
import ApproveMangaButton from "@/components/admin/ApproveMangaButton"

const PAGE_SIZE = 30

const CATALOGUE_ISSUES = [
  { key: "manga-review", label: "Manga à vérifier", hint: "Séries que l'import n'a pas pu confirmer (pas de correspondance AniList, donc pas de nombre de tomes japonais ni de titres alternatifs). Elles n'apparaissent pas dans le catalogue manga par défaut, mais restent trouvables par la recherche. Validez celles qui sont correctes." },
  { key: "book-no-genre", label: "Livres sans genre", hint: "Aucun genre : le livre n'apparaît dans aucun filtre du catalogue." },
  { key: "book-blurry", label: "Couvertures floues", hint: "Miniature Google de 128 px : collez l'adresse d'une meilleure image." },
  { key: "book-no-summary", label: "Livres sans résumé", hint: "Pas de description sur la page du livre." },
  { key: "manga-no-cover", label: "Manga sans couverture", hint: "Pas de couverture : la série est masquée du catalogue manga." },
] as const

type Item = { id: string; title: string; subtitle: string | null; cover_url: string | null; href: string; editHref: string; manga: boolean }

interface Props {
  searchParams: Promise<{ issue?: string; page?: string }>
}

export default async function AdminCataloguePage({ searchParams }: Props) {
  const { admin } = await requireAdmin()
  const sp = await searchParams
  const issue = CATALOGUE_ISSUES.find((i) => i.key === sp.issue) ?? CATALOGUE_ISSUES[0]
  const page = Math.max(1, Math.min(100, parseInt(sp.page ?? "1", 10) || 1))
  const from = (page - 1) * PAGE_SIZE

  let items: Item[] = []
  let total = 0

  const bookItem = (b: { id: string; title: string; cover_url: string | null; book_authors?: { author: { name: string } | null }[] | null }): Item => ({
    id: b.id,
    title: b.title,
    subtitle: (b.book_authors ?? []).map((ba) => ba.author?.name).filter(Boolean).join(", ") || null,
    cover_url: b.cover_url,
    href: `/books/${b.id}`,
    editHref: `/admin/books/${b.id}`,
    manga: false,
  })
  const mangaItem = (m: { id: string; title_fr: string; author: string | null; publisher: string | null; cover_url: string | null }): Item => ({
    id: m.id,
    title: m.title_fr,
    subtitle: [m.author, m.publisher].filter(Boolean).join(" · ") || null,
    cover_url: m.cover_url,
    href: `/manga/${m.id}`,
    editHref: `/admin/manga/${m.id}`,
    manga: true,
  })
  const BOOK_FIELDS = "id, title, cover_url, book_authors(author:authors(name))"
  const MANGA_FIELDS = "id, title_fr, author, publisher, cover_url"

  if (issue.key === "book-no-genre") {
    const [{ data: books }, { data: withGenre }] = await Promise.all([
      admin.from("books").select(BOOK_FIELDS).order("created_at", { ascending: false }).limit(20000),
      admin.from("book_genres").select("book_id").limit(50000),
    ])
    const has = new Set((withGenre ?? []).map((g) => g.book_id))
    const missing = (books ?? []).filter((b) => !has.has(b.id))
    total = missing.length
    items = missing.slice(from, from + PAGE_SIZE).map((b) => bookItem(b as never))
  } else if (issue.key === "book-blurry" || issue.key === "book-no-summary") {
    let q = admin.from("books").select(BOOK_FIELDS, { count: "exact" })
    q = issue.key === "book-blurry"
      ? q.like("cover_url", "%zoom=1%").not("cover_url", "like", "%fife=%")
      : q.is("description", null)
    const { data, count } = await q.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1)
    total = count ?? 0
    items = (data ?? []).map((b) => bookItem(b as never))
  } else {
    let q = admin.from("manga_series").select(MANGA_FIELDS, { count: "exact" })
    q = issue.key === "manga-review" ? q.eq("needs_review", true) : q.is("cover_url", null)
    const { data, count } = await q.order("title_fr").range(from, from + PAGE_SIZE - 1)
    total = count ?? 0
    items = (data ?? []).map(mangaItem)
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageHref = (p: number) => `/admin/catalogue?issue=${issue.key}${p > 1 ? `&page=${p}` : ""}`

  return (
    <AdminShell active="catalogue">
      <PillTabs items={CATALOGUE_ISSUES.map((i) => ({ key: i.key, label: i.label, href: `/admin/catalogue?issue=${i.key}`, active: i.key === issue.key }))} />
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{total}</span> élément{total > 1 ? "s" : ""}. {issue.hint}
      </p>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">Rien à corriger ici.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl bg-card shadow-card">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={it.href} className="relative block aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-md">
                <BookCover src={it.cover_url} title={it.title} className="h-full w-full" sizes="40px" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={it.href} className="block truncate text-sm font-semibold hover:underline">{it.title}</Link>
                {it.subtitle && <p className="truncate text-xs text-muted-foreground">{it.subtitle}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {issue.key === "manga-review" && <ApproveMangaButton id={it.id} />}
                <Link href={it.editHref} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-muted">Modifier</Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={pageHref(page - 1)} className="font-semibold text-primary hover:underline">← Précédent</Link>}
          <span className="text-muted-foreground">Page {page} / {pages}</span>
          {page < pages && <Link href={pageHref(page + 1)} className="font-semibold text-primary hover:underline">Suivant →</Link>}
        </nav>
      )}
    </AdminShell>
  )
}

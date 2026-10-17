import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/admin"
import { isUuid } from "@/lib/validation"
import AdminShell from "@/components/admin/AdminShell"
import BookEditForm from "@/components/admin/BookEditForm"

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminBookEditPage({ params }: Props) {
  const { admin } = await requireAdmin()
  const { id } = await params
  if (!isUuid(id)) notFound()

  const [{ data: book }, { data: genres }] = await Promise.all([
    admin
      .from("books")
      .select("id, title, subtitle, description, cover_url, isbn_13, book_authors(author:authors(name)), book_genres(genres(slug))")
      .eq("id", id)
      .maybeSingle(),
    admin.from("genres").select("slug, label, type").neq("slug", "litterature").order("label"),
  ])
  if (!book) notFound()

  const authors = ((book.book_authors ?? []) as unknown as { author: { name: string } | null }[]).map((ba) => ba.author?.name).filter(Boolean)
  const current = ((book.book_genres ?? []) as unknown as { genres: { slug: string } | null }[]).map((bg) => bg.genres?.slug).filter(Boolean) as string[]

  return (
    <AdminShell active="catalogue">
      <div className="rounded-2xl bg-card p-5 shadow-card sm:p-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold">Modifier le livre</h2>
            <p className="text-sm text-muted-foreground">{authors.join(", ")}{book.isbn_13 && ` · ISBN ${book.isbn_13}`}</p>
          </div>
          <Link href={`/books/${book.id}`} className="text-sm font-semibold text-primary hover:underline">Voir la page →</Link>
        </div>
        <BookEditForm
          book={{ id: book.id, title: book.title, subtitle: book.subtitle, description: book.description, cover_url: book.cover_url, genres: current }}
          allGenres={genres ?? []}
        />
      </div>
    </AdminShell>
  )
}

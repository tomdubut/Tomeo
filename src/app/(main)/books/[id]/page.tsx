import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import BookCover from "@/components/books/BookCover"
import AddToLibraryButton from "@/components/books/AddToLibraryButton"
import { Star, BookOpen, CalendarDays, Building2 } from "lucide-react"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("books").select("title").eq("id", id).single()
  return { title: data ? `${data.title} — Tomeo` : "Livre — Tomeo" }
}

export default async function BookDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: book } = await supabase
    .from("books")
    .select(`
      *,
      publisher:publishers(name),
      book_authors(
        role, display_order,
        author:authors(id, name)
      )
    `)
    .eq("id", id)
    .single()

  if (!book) notFound()

  const { data: { user } } = await supabase.auth.getUser()

  let userStatus: "want_to_read" | "currently_reading" | "read" | null = null
  if (user) {
    const { data: ub } = await supabase
      .from("user_books")
      .select("status")
      .eq("user_id", user.id)
      .eq("book_id", id)
      .single()
    userStatus = (ub?.status as typeof userStatus) ?? null
  }

  // Sort authors by display_order
  const authors = (book.book_authors ?? [])
    .sort((a: any, b: any) => a.display_order - b.display_order)
    .filter((ba: any) => ba.role === "author")
    .map((ba: any) => ba.author)

  const translators = (book.book_authors ?? [])
    .filter((ba: any) => ba.role === "translator")
    .map((ba: any) => ba.author)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex gap-8 flex-col sm:flex-row">
        {/* Cover */}
        <div className="shrink-0">
          <div className="w-40 sm:w-48 aspect-[2/3] relative mx-auto sm:mx-0">
            <BookCover
              src={book.cover_url}
              title={book.title}
              className="w-full h-full shadow-lg"
              sizes="192px"
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight">{book.title}</h1>
            {book.subtitle && (
              <p className="text-lg text-[--muted-foreground] mt-0.5">{book.subtitle}</p>
            )}
          </div>

          {authors.length > 0 && (
            <p className="text-base">
              <span className="text-[--muted-foreground]">Par </span>
              {authors.map((a: any, i: number) => (
                <span key={a.id}>
                  <span className="font-medium">{a.name}</span>
                  {i < authors.length - 1 && ", "}
                </span>
              ))}
            </p>
          )}

          {translators.length > 0 && (
            <p className="text-sm text-[--muted-foreground]">
              Traduit par {translators.map((t: any) => t.name).join(", ")}
            </p>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 text-sm text-[--muted-foreground]">
            {book.avg_rating && (
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-medium text-[--foreground]">
                  {Number(book.avg_rating).toFixed(1)}
                </span>
                /10
                <span className="ml-1">({book.rating_count} notes)</span>
              </span>
            )}
            {book.page_count && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {book.page_count} pages
              </span>
            )}
            {book.published_date && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                {book.published_date.slice(0, 4)}
              </span>
            )}
            {book.publisher?.name && (
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {book.publisher.name}
              </span>
            )}
          </div>

          {user && (
            <AddToLibraryButton bookId={book.id} initialStatus={userStatus} />
          )}
        </div>
      </div>

      {/* Description */}
      {book.description && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Résumé</h2>
          <div
            className="text-sm leading-relaxed text-[--foreground] prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: book.description }}
          />
        </div>
      )}

      {/* Metadata footer */}
      <div className="mt-8 pt-6 border-t border-[--border] grid grid-cols-2 gap-3 text-sm">
        {book.isbn_13 && (
          <div>
            <span className="text-[--muted-foreground]">ISBN-13 </span>
            <span className="font-mono">{book.isbn_13}</span>
          </div>
        )}
        {book.isbn_10 && (
          <div>
            <span className="text-[--muted-foreground]">ISBN-10 </span>
            <span className="font-mono">{book.isbn_10}</span>
          </div>
        )}
        {book.language && (
          <div>
            <span className="text-[--muted-foreground]">Langue </span>
            <span className="uppercase">{book.language}</span>
          </div>
        )}
      </div>
    </div>
  )
}

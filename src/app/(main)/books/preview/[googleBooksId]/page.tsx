import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getGoogleBookById, normaliseVolume } from "@/lib/api/google-books"
import BookCover from "@/components/books/BookCover"
import BackButton from "@/components/ui/BackButton"
import BookDescription from "@/components/books/BookDescription"
import AddToLibraryPreview from "./AddToLibraryPreview"
import { BookOpen, CalendarDays, Building2 } from "lucide-react"

interface Props {
  params: Promise<{ googleBooksId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { googleBooksId } = await params
  try {
    const volume = await getGoogleBookById(googleBooksId)
    return { title: `${volume.volumeInfo?.title ?? "Livre"} — Tomesie` }
  } catch {
    return { title: "Livre — Tomesie" }
  }
}

export default async function BookPreviewPage({ params }: Props) {
  const { googleBooksId } = await params

  // If already in DB, redirect to the real book page
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("books")
    .select("id")
    .eq("google_books_id", googleBooksId)
    .single()

  if (existing) redirect(`/books/${existing.id}`)

  let volume
  try {
    volume = await getGoogleBookById(googleBooksId)
  } catch {
    notFound()
  }

  if (!volume.volumeInfo?.title) notFound()

  const book = normaliseVolume(volume)
  const { data: { user } } = await supabase.auth.getUser()

  const info = volume.volumeInfo

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="rounded-2xl bg-[--card] p-6 sm:p-8 space-y-6">
        <div className="flex gap-5 sm:gap-8">
          <div className="shrink-0 w-28 sm:w-36">
            <div className="aspect-[2/3] rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-md)" }}>
              <BookCover
                src={book.cover_url}
                title={book.title}
                author={book.authors[0]}
                isbn={book.isbn_13 ?? book.isbn_10 ?? undefined}
                googleBooksId={book.google_books_id}
                className="w-full h-full"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{book.title}</h1>
              {book.subtitle && <p className="text-sm text-[--muted-foreground] mt-1">{book.subtitle}</p>}
            </div>
            {book.authors.length > 0 && (
              <p className="text-sm font-medium text-[--muted-foreground]">{book.authors.join(", ")}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[--muted-foreground]">
              {info.pageCount && (
                <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{info.pageCount} pages</span>
              )}
              {info.publishedDate && (
                <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{info.publishedDate.slice(0, 4)}</span>
              )}
              {info.publisher && (
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{info.publisher}</span>
              )}
            </div>
            {user && (
              <div className="pt-1">
                <AddToLibraryPreview googleBooksId={googleBooksId} />
              </div>
            )}
          </div>
        </div>
        {book.description && (
          <BookDescription description={book.description} />
        )}
      </div>
    </div>
  )
}

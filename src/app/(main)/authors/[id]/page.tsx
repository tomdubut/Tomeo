import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { searchGoogleBooks, normaliseVolume, dedupByIsbn } from "@/lib/api/google-books"
import { cacheTag, cacheLife } from "next/cache"
import { getAuthorDetail } from "@/lib/supabase/queries"
import BookCard from "@/components/books/BookCard"
import { BookOpen, User } from "lucide-react"

async function getAuthorMoreBooks(authorName: string, dbTitles: string[]) {
  "use cache"
  cacheLife("hours")
  cacheTag("author-google-books")
  const dbTitlesSet = new Set(dbTitles)
  try {
    const data = await searchGoogleBooks(`inauthor:${authorName}`, { maxResults: 40, langRestrict: "fr" })
    return dedupByIsbn(
      (data.items ?? [])
        .map(normaliseVolume)
        .filter((b) => b.title && !dbTitlesSet.has(b.title.toLowerCase().trim()))
    ).slice(0, 12)
  } catch {
    return []
  }
}

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const result = await getAuthorDetail(id)
  return { title: result ? `${result.author.name} — Tomeo` : "Tomeo" }
}

export default async function AuthorPage({ params }: Props) {
  const { id } = await params
  const result = await getAuthorDetail(id)

  if (!result) notFound()

  const { author, books } = result
  const moreBooks = await getAuthorMoreBooks(author.name, books.map((b: any) => b.title.toLowerCase().trim()))

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <div className="flex justify-center sm:block">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-[--secondary] flex items-center justify-center shrink-0">
            {author.photo_url ? (
              <Image src={author.photo_url} alt={author.name} width={96} height={96} className="object-cover h-full w-full" unoptimized />
            ) : (
              <User className="h-10 w-10 text-[--muted-foreground]" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h1 className="text-2xl font-extrabold">{author.name}</h1>
          {(author.birth_date || author.death_date) && (
            <p className="text-sm text-[--muted-foreground] mt-1">
              {author.birth_date ? new Date(author.birth_date).getFullYear() : "?"}
              {" – "}
              {author.death_date ? new Date(author.death_date).getFullYear() : ""}
            </p>
          )}
          {author.bio && <p className="mt-3 text-sm leading-relaxed">{author.bio}</p>}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-[--muted-foreground] font-medium">
          {books.length} livre{books.length !== 1 ? "s" : ""}
        </p>

        {books.length === 0 ? (
          <div className="rounded-2xl bg-[--card] px-6 py-10 text-center">
            <p className="text-sm text-[--muted-foreground]">Aucun livre de cet auteur dans le catalogue pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {books.map((book: any) => (
              <Link key={book.id} href={`/books/${book.id}`} className="group">
                <div className="aspect-[2/3] relative rounded-xl overflow-hidden bg-[--secondary] mb-2" style={{ boxShadow: "var(--shadow-sm)" }}>
                  {book.cover_url ? (
                    <Image src={book.cover_url} alt={book.title} fill className="object-cover group-hover:opacity-90 transition-opacity" sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-8 w-8 text-[--muted-foreground]" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold line-clamp-2 group-hover:underline leading-tight">{book.title}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {moreBooks.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-[--muted-foreground] font-medium">Plus de livres</p>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {moreBooks.map((book) => (
              <BookCard key={book.google_books_id} book={book} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

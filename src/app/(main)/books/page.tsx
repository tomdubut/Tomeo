import { searchGoogleBooks, normaliseVolume } from "@/lib/api/google-books"
import { createAdminClient } from "@/lib/supabase/server"
import BookSearchBar from "@/components/books/BookSearchBar"
import BookCard from "@/components/books/BookCard"
import GenreFilter from "@/components/books/GenreFilter"
import { BookOpen } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

const FR_THRESHOLD = 3

interface Props {
  searchParams: Promise<{ q?: string; genre?: string }>
}

export default async function BooksPage({ searchParams }: Props) {
  const { q, genre } = await searchParams
  const query = q?.trim() ?? ""
  const activeGenre = genre?.trim() ?? ""

  let results: ReturnType<typeof normaliseVolume>[] = []
  let fallback: ReturnType<typeof normaliseVolume>[] = []
  let totalItems = 0
  let apiError: string | null = null

  if (query) {
    try {
      const data = await searchGoogleBooks(query, { maxResults: 24, langRestrict: "fr" })
      results = (data.items ?? []).map(normaliseVolume).filter((b) => b.language === "fr")
      totalItems = data.totalItems

      if (results.length < FR_THRESHOLD) {
        const fallbackData = await searchGoogleBooks(query, { maxResults: 24 })
        const frIds = new Set(results.map((b) => b.google_books_id))
        fallback = (fallbackData.items ?? [])
          .map(normaliseVolume)
          .filter((b) => b.language !== "fr" && !frIds.has(b.google_books_id))
          .slice(0, 12)
      }
    } catch (e) {
      apiError = e instanceof Error ? e.message : "Erreur inconnue"
    }
  }

  // Browse mode: fetch from our DB
  let genreList: Array<{ id: number; slug: string; label: string; count: number }> = []
  let browseBooks: Array<{ id: string; title: string; cover_url: string | null; book_authors: any[] }> = []

  if (!query) {
    // Use admin client for public catalog reads (avoids RLS / cookie issues on public page)
    const admin = createAdminClient()

    // Get all genres
    const { data: genreRows, error: genreErr } = await admin
      .from("genres")
      .select("id, slug, label")
      .order("label")
    if (genreErr) console.error("[genres]", genreErr.message)
    genreList = (genreRows ?? []).map((g: any) => ({ ...g, count: 0 }))

    // Fetch books, optionally filtered by genre
    if (activeGenre) {
      const { data: genreRow } = await admin.from("genres").select("id").eq("slug", activeGenre).single()
      if (genreRow) {
        const { data: bookIds } = await admin
          .from("book_genres")
          .select("book_id")
          .eq("genre_id", genreRow.id)
        const ids = (bookIds ?? []).map((r: any) => r.book_id)
        if (ids.length) {
          const { data } = await admin
            .from("books")
            .select("id, title, cover_url, book_authors(display_order, role, author:authors(name))")
            .in("id", ids)
            .order("created_at", { ascending: false })
            .limit(24)
          browseBooks = (data ?? []) as any
        }
      }
    } else {
      const { data } = await admin
        .from("books")
        .select("id, title, cover_url, book_authors(display_order, role, author:authors(name))")
        .order("created_at", { ascending: false })
        .limit(24)
      browseBooks = (data ?? []) as any
    }
  }

  const hasAnyResults = results.length > 0 || fallback.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-4">Catalogue de livres</h1>
        <BookSearchBar initialQuery={query} />
      </div>

      {/* Browse mode (no search query) */}
      {!query && (
        <div className="space-y-6">
          {genreList.length > 0 && (
            <GenreFilter genres={genreList} activeGenre={activeGenre} />
          )}

          {browseBooks.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-[--muted-foreground] font-medium">
                {activeGenre
                  ? `${browseBooks.length} livre${browseBooks.length !== 1 ? "s" : ""} dans cette catégorie`
                  : "Derniers ajouts"}
              </p>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {browseBooks.map((book) => {
                  const authors = (book.book_authors ?? [])
                    .filter((ba: any) => ba.role === "author")
                    .sort((a: any, b: any) => a.display_order - b.display_order)
                    .map((ba: any) => ba.author?.name)
                    .filter(Boolean)
                  return (
                    <Link key={book.id} href={`/books/${book.id}`} className="group">
                      <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-[--secondary] relative" style={{ boxShadow: "var(--shadow-sm)" }}>
                        {book.cover_url ? (
                          <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized sizes="160px" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <BookOpen className="h-6 w-6 text-[--muted-foreground]" />
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-tight line-clamp-2 group-hover:underline">{book.title}</p>
                      {authors[0] && <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{authors[0]}</p>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center" style={{ boxShadow: "var(--shadow)" }}>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[--secondary]">
                <BookOpen className="h-8 w-8 text-[--primary]" />
              </div>
              <p className="text-lg font-bold">Recherchez un livre pour commencer</p>
              <p className="mt-2 text-sm text-[--muted-foreground]">
                Titre, auteur, ISBN — nous cherchons dans des millions de livres.
              </p>
            </div>
          )}
        </div>
      )}

      {apiError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Erreur Google Books API</p>
          <p className="mt-1 font-mono text-xs">{apiError}</p>
        </div>
      )}

      {query && !apiError && !hasAnyResults && (
        <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center" style={{ boxShadow: "var(--shadow)" }}>
          <p className="text-lg font-bold">Aucun résultat pour &ldquo;{query}&rdquo;</p>
          <p className="mt-2 text-sm text-[--muted-foreground]">
            Essayez un titre différent ou le nom de l&apos;auteur.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-[--muted-foreground]">
            Environ {totalItems.toLocaleString("fr-FR")} résultats pour &ldquo;{query}&rdquo;
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {results.map((book) => (
              <BookCard key={book.google_books_id} book={book} />
            ))}
          </div>
        </div>
      )}

      {fallback.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[--border]" />
            <p className="text-sm text-[--muted-foreground]">Autres langues</p>
            <div className="h-px flex-1 bg-[--border]" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {fallback.map((book) => (
              <BookCard key={book.google_books_id} book={book} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

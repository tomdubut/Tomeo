
import { searchGoogleBooks, normaliseVolume, dedupByIsbn } from "@/lib/api/google-books"
import { getGenresWithBooks, getRecentBooks, getBooksByGenre, searchLocalBooks } from "@/lib/supabase/queries"
import { scoreBook, isRelevant, extractQueryWords } from "@/lib/search/scoring"
import { createClient } from "@/lib/supabase/server"
import BookSearchBar from "@/components/books/BookSearchBar"
import BookCard from "@/components/books/BookCard"
import GenreFilter from "@/components/books/GenreFilter"
import SearchLoadMore from "@/components/books/SearchLoadMore"
import { BookOpen } from "lucide-react"
import Link from "next/link"
import BookCover from "@/components/books/BookCover"

type LibraryStatus = "want_to_read" | "currently_reading" | "read"

function LibraryBadge({ status }: { status: LibraryStatus | undefined }) {
  if (!status) return null
  const labels: Record<LibraryStatus, string> = {
    read: "Lu",
    currently_reading: "En cours",
    want_to_read: "À lire",
  }
  return (
    <span
      className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none"
      style={{ background: "#e8650a", color: "#fff" }}
    >
      {labels[status]}
    </span>
  )
}

const FR_THRESHOLD = 3
const normalizeTitle = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()

interface Props {
  searchParams: Promise<{ q?: string; genre?: string }>
}

export default async function BooksPage({ searchParams }: Props) {
  const { q, genre } = await searchParams
  const query = q?.trim() ?? ""
  const activeGenre = genre?.trim() ?? ""

  let results: ReturnType<typeof normaliseVolume>[] = []
  let fallback: ReturnType<typeof normaliseVolume>[] = []
  let localBooks: Awaited<ReturnType<typeof searchLocalBooks>> = []
  let totalItems = 0
  let apiError: string | null = null

  if (query) {
    try {
      const isISBN = /^\d[\d-]{8,}$/.test(query.trim())
      const queryWords = extractQueryWords(query)
      const titleQuery = isISBN ? query : `intitle:${query}`
      const authorQuery = isISBN ? query : `inauthor:${query}`

      const [titleData, authorData, localBooksResult] = await Promise.all([
        searchGoogleBooks(titleQuery, { maxResults: 40, langRestrict: "fr" }),
        isISBN ? Promise.resolve({ totalItems: 0, items: [] as import("@/lib/api/google-books").GoogleBooksVolume[] }) : searchGoogleBooks(authorQuery, { maxResults: 40, langRestrict: "fr" }),
        searchLocalBooks(query, 12),
      ])

      localBooks = localBooksResult
      const localTitles = new Set(localBooks.map((b) => normalizeTitle(b.title)))
      totalItems = titleData.totalItems

      const rawResults = dedupByIsbn(
        [...(titleData.items ?? []), ...(authorData.items ?? [])]
          .map(normaliseVolume)
          .filter((b) => b.language === "fr" && b.title && isRelevant(b, queryWords) && !localTitles.has(normalizeTitle(b.title)))
      )
        .sort((a, b) => scoreBook(b, queryWords) - scoreBook(a, queryWords))
        .slice(0, 24)

      async function verifyCover(url: string): Promise<boolean> {
        try {
          const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(1500) })
          const length = parseInt(res.headers.get("content-length") ?? "0", 10)
          return length > 10_000
        } catch {
          return false
        }
      }

      const resolved = await Promise.all(
        rawResults.map(async (b) => {
          if (b.cover_url) {
            // Verify existing cover isn't a placeholder
            if (await verifyCover(b.cover_url)) return b
          }
          // Try fife as fallback
          const fifeUrl = `https://books.google.com/books/publisher/content/images/frontcover/${b.google_books_id}?fife=w400-h600`
          if (await verifyCover(fifeUrl)) return { ...b, cover_url: fifeUrl }
          return null
        })
      )
      results = resolved.filter((b): b is NonNullable<typeof b> => b !== null)

      if (results.length < FR_THRESHOLD) {
        const [titleFallback, authorFallback] = await Promise.all([
          searchGoogleBooks(titleQuery, { maxResults: 40 }),
          isISBN ? Promise.resolve({ totalItems: 0, items: [] as import("@/lib/api/google-books").GoogleBooksVolume[] }) : searchGoogleBooks(authorQuery, { maxResults: 40 }),
        ])
        const frIds = new Set(results.map((b) => b.google_books_id))
        fallback = dedupByIsbn(
          [...(titleFallback.items ?? []), ...(authorFallback.items ?? [])]
            .map(normaliseVolume)
            .filter((b) => b.language !== "fr" && b.title && b.cover_url !== null && isRelevant(b, queryWords) && !frIds.has(b.google_books_id) && !localTitles.has(normalizeTitle(b.title)))
        )
          .sort((a, b) => scoreBook(b, queryWords) - scoreBook(a, queryWords))
          .slice(0, 12)
      }
    } catch (e) {
      apiError = e instanceof Error ? e.message : "Erreur inconnue"
    }
  }

  // Fetch user's library statuses for badge display
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const libraryStatusByGoogleId = new Map<string, LibraryStatus>()
  const libraryStatusById = new Map<string, LibraryStatus>()
  if (user) {
    const { data: userBooks } = await supabase
      .from("user_books")
      .select("status, book:books(id, google_books_id)")
      .eq("user_id", user.id)
    for (const ub of userBooks ?? []) {
      const book = ub.book as unknown as { id: string; google_books_id: string | null } | null
      if (!book) continue
      libraryStatusById.set(book.id, ub.status as LibraryStatus)
      if (book.google_books_id) libraryStatusByGoogleId.set(book.google_books_id, ub.status as LibraryStatus)
    }
  }

  // Browse mode: fetch from our DB
  let genreList: Array<{ id: number; slug: string; label: string; type: string }> = []
  let formatList: Array<{ id: number; slug: string; label: string; type: string }> = []
  type BrowseBook = { id: string; title: string; cover_url: string | null; book_authors: any[] }
  let browseBooks: BrowseBook[] = []

  if (!query) {
    const allGenres = await getGenresWithBooks()
    genreList = allGenres.filter((g) => g.type === "genre")
    formatList = allGenres.filter((g) => g.type === "format")
    browseBooks = activeGenre ? await getBooksByGenre(activeGenre) : await getRecentBooks()
  }

  const hasAnyResults = results.length > 0 || fallback.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Catalogue de livres</h1>
        <BookSearchBar initialQuery={query} />
      </div>

      {/* Browse mode (no search query) */}
      {!query && (
        <div className="space-y-6">
          {(genreList.length > 0 || formatList.length > 0) && (
            <GenreFilter genres={genreList} formats={formatList} activeGenre={activeGenre} />
          )}

          {browseBooks.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-[--muted-foreground] font-medium">
                {activeGenre
                  ? `${browseBooks.length} livre${browseBooks.length !== 1 ? "s" : ""} dans cette catégorie`
                  : "Livres récemment ajoutés par la communauté"}
              </p>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {browseBooks.map((book) => {
                  const authors = (book.book_authors ?? [])
                    .filter((ba) => ba.role === "author")
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((ba) => ba.author?.[0]?.name)
                    .filter(Boolean)
                  return (
                    <Link key={book.id} href={`/books/${book.id}`} className="group">
                      <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-[--secondary] relative" style={{ boxShadow: "var(--shadow-sm)" }}>
                        <BookCover
                          src={book.cover_url}
                          title={book.title}
                          author={authors[0]}
                          className="w-full h-full"
                          sizes="160px"
                        />
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-tight line-clamp-2 group-hover:underline">{book.title}</p>
                      {authors[0] && <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{authors[0]}</p>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center">
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
        <div className="rounded-2xl bg-[--card] px-6 py-10 sm:p-14 text-center">
          <p className="text-lg font-bold">Aucun résultat pour &ldquo;{query}&rdquo;</p>
          <p className="mt-2 text-sm text-[--muted-foreground]">
            Essayez un titre différent ou le nom de l&apos;auteur.
          </p>
        </div>
      )}

      {(localBooks.length > 0 || results.length > 0) && (
        <div className="space-y-4">
          <p className="text-sm text-[--muted-foreground]">
            Environ {totalItems.toLocaleString("fr-FR")} résultats pour &ldquo;{query}&rdquo;
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {localBooks.map((book) => (
              <Link key={book.id} href={`/books/${book.id}`} className="group relative">
                <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-[--secondary] relative" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <BookCover
                    src={book.cover_url}
                    title={book.title}
                    author={book.authors[0]}
                    className="w-full h-full group-hover:opacity-80 transition-opacity"
                    sizes="160px"
                  />
                  <LibraryBadge status={libraryStatusById.get(book.id)} />
                </div>
                <p className="mt-2 text-xs font-semibold leading-tight line-clamp-2 group-hover:underline">{book.title}</p>
                {book.authors[0] && <p className="text-xs text-[--muted-foreground] mt-0.5 line-clamp-1">{book.authors[0]}</p>}
              </Link>
            ))}
            {results.map((book) => (
              <BookCard key={book.google_books_id} book={book} status={libraryStatusByGoogleId.get(book.google_books_id)} />
            ))}
          </div>
          <SearchLoadMore
            query={query}
            initialOffset={results.length}
            initialHasMore={totalItems > results.length}
          />
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

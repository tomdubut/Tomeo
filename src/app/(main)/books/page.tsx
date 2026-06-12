import { searchGoogleBooks, normaliseVolume } from "@/lib/api/google-books"
import BookSearchBar from "@/components/books/BookSearchBar"
import BookCard from "@/components/books/BookCard"
import { BookOpen } from "lucide-react"

const FR_THRESHOLD = 3

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function BooksPage({ searchParams }: Props) {
  const { q } = await searchParams
  const query = q?.trim() ?? ""

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

  const hasAnyResults = results.length > 0 || fallback.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-4">Catalogue de livres</h1>
        <BookSearchBar initialQuery={query} />
      </div>

      {!query && (
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

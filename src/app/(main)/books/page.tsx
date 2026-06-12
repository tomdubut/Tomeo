import { searchGoogleBooks, normaliseVolume } from "@/lib/api/google-books"
import BookSearchBar from "@/components/books/BookSearchBar"
import BookCard from "@/components/books/BookCard"
import { BookOpen } from "lucide-react"

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function BooksPage({ searchParams }: Props) {
  const { q } = await searchParams
  const query = q?.trim() ?? ""

  let results: ReturnType<typeof normaliseVolume>[] = []
  let totalItems = 0

  if (query) {
    try {
      const data = await searchGoogleBooks(query, { maxResults: 24 })
      results = (data.items ?? []).map(normaliseVolume)
      totalItems = data.totalItems
    } catch {
      // Google Books API unavailable — show empty state
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-4">Catalogue de livres</h1>
        <BookSearchBar initialQuery={query} />
      </div>

      {!query && (
        <div className="rounded-xl border border-[--border] bg-[--card] p-12 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-[--muted-foreground]" />
          <p className="font-medium">Recherchez un livre pour commencer</p>
          <p className="mt-1 text-sm text-[--muted-foreground]">
            Titre, auteur, ISBN — nous cherchons dans des millions de livres.
          </p>
        </div>
      )}

      {query && results.length === 0 && (
        <div className="rounded-xl border border-[--border] bg-[--card] p-12 text-center">
          <p className="font-medium">Aucun résultat pour &ldquo;{query}&rdquo;</p>
          <p className="mt-1 text-sm text-[--muted-foreground]">
            Essayez un titre différent ou le nom de l&apos;auteur.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <p className="text-sm text-[--muted-foreground]">
            Environ {totalItems.toLocaleString("fr-FR")} résultats pour &ldquo;{query}&rdquo;
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {results.map((book) => (
              <BookCard key={book.google_books_id} book={book} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

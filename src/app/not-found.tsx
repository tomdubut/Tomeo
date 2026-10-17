import Link from "next/link"

/**
 * Shown for unknown addresses and every notFound() (missing book, user, admin page for non-admins).
 * Inside the main layout it sits between the navbar and the footer.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-5xl font-extrabold text-primary">404</p>
      <h1 className="mt-3 text-xl font-extrabold">Page introuvable</h1>
      <p className="mt-2 text-sm text-muted-foreground">Cette page n&apos;existe pas ou n&apos;est plus disponible.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Retour à l&apos;accueil
        </Link>
        <Link href="/books" className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold hover:bg-muted">
          Parcourir le catalogue
        </Link>
      </div>
    </div>
  )
}

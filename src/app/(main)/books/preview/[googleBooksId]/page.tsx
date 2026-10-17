import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ImportBookPreview from "./ImportBookPreview"

interface Props {
  params: Promise<{ googleBooksId: string }>
}

export default async function BookPreviewPage({ params }: Props) {
  const { googleBooksId } = await params

  const supabase = await createClient()
  const [{ data: existing }, { data: { user } }] = await Promise.all([
    supabase.from("books").select("id").eq("google_books_id", googleBooksId).maybeSingle(),
    supabase.auth.getUser(),
  ])

  // Already in the catalogue. (redirect() works by throwing: keep it out of any try/catch)
  if (existing) redirect(`/books/${existing.id}`)

  // Only signed-in users can add books to the catalogue
  if (!user) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-card p-6 text-center shadow-card">
        <h1 className="text-lg font-extrabold">Ce livre n&apos;est pas encore sur Tomesie</h1>
        <p className="mt-2 text-sm text-muted-foreground">Connectez-vous pour l&apos;ajouter au catalogue et à votre bibliothèque.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/login" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Connexion</Link>
          <Link href="/register" className="rounded-xl bg-secondary px-4 py-2 text-sm font-semibold">S&apos;inscrire</Link>
        </div>
      </div>
    )
  }

  // The import runs as a server action from the browser, not during this render: rendering a
  // page must not write to the database, and the import refreshes cached catalogue data
  // (updateTag), which Next.js only allows in server actions.
  return <ImportBookPreview googleBooksId={googleBooksId} />
}

import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { importBook } from "@/app/(main)/books/actions"

interface Props {
  params: Promise<{ googleBooksId: string }>
}

export default async function BookPreviewPage({ params }: Props) {
  const { googleBooksId } = await params

  // Check if already in DB
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("books")
    .select("id")
    .eq("google_books_id", googleBooksId)
    .single()

  if (existing) redirect(`/books/${existing.id}`)

  // Import and redirect to full book page
  try {
    const { id } = await importBook(googleBooksId)
    redirect(`/books/${id}`)
  } catch {
    notFound()
  }
}

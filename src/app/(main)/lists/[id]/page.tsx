
import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import ListBookGrid from "@/components/lists/ListBookGrid"
import AddBookCollapsible from "./AddBookCollapsible"
import { Button } from "@/components/ui/button"
import DeleteListButton from "@/components/lists/DeleteListButton"
import { Lock, Pencil, BookOpen } from "lucide-react"
import type { BookSummary } from "@/lib/types"

type ListOwner = { id: string; username: string; display_name: string | null }

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("lists").select("title").eq("id", id).single()
  return { title: data ? `${data.title} — Tomesie` : "Liste — Tomesie" }
}

export default async function ListDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: list } = await supabase
    .from("lists")
    .select(`
      *,
      owner:profiles!user_id(id, username, display_name)
    `)
    .eq("id", id)
    .single()

  if (!list) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === list.user_id

  if (!list.is_public && !isOwner) notFound()

  const { data: listBooks } = await supabase
    .from("list_books")
    .select(`
      position, note,
      book:books(
        id, title, cover_url,
        book_authors(role, display_order, author:authors(name))
      )
    `)
    .eq("list_id", id)
    .order("position", { ascending: true })

  const owner = list.owner as unknown as ListOwner

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{list.title}</h1>
              {!list.is_public && <Lock className="h-4 w-4 text-[--muted-foreground] shrink-0" />}
            </div>
            <p className="text-sm text-[--muted-foreground] mt-1">
              Liste de{" "}
              <Link href={`/users/${owner.username}`} className="hover:underline font-medium">
                {owner.display_name ?? owner.username}
              </Link>
              {" · "}
              {listBooks?.length ?? 0} livre{(listBooks?.length ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>

          {isOwner && (
            <div className="flex gap-2 shrink-0">
              <Button asChild variant="outline" size="sm">
                <Link href={`/me/lists/${id}/edit`}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Modifier
                </Link>
              </Button>
              <DeleteListButton listId={id} />
            </div>
          )}
        </div>

        {list.description && (
          <p className="text-sm text-[--muted-foreground] leading-relaxed">{list.description}</p>
        )}
      </div>

      {/* Add book collapsible — owner only, shown before the grid */}
      {isOwner && (
        <AddBookCollapsible listId={id} existingBookIds={(listBooks ?? []).map((lb) => (lb.book as unknown as BookSummary | null)?.id).filter((id): id is string => !!id)} />
      )}

      {/* Book list */}
      {!listBooks?.length ? (
        <div className="rounded-2xl bg-[--card] p-10 text-center border border-[--border]">
          <BookOpen className="mx-auto mb-4 h-8 w-8 text-[--muted-foreground]" />
          <p className="font-semibold">Cette liste est vide</p>
          {isOwner ? (
            <>
              <p className="mt-1 text-sm text-[--muted-foreground]">Ajoutez des livres depuis le catalogue.</p>
              <div className="mt-4">
                <Button asChild size="sm"><Link href="/books">Parcourir le catalogue</Link></Button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-[--muted-foreground]">Aucun livre n&apos;a encore été ajouté.</p>
          )}
        </div>
      ) : (
        <ListBookGrid listId={id} items={listBooks as unknown as { position: number; note: string | null; book: BookSummary | null }[]} isOwner={isOwner} />
      )}

    </div>
  )
}

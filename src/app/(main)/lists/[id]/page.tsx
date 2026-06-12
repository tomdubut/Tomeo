import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import ListBookItem from "@/components/lists/ListBookItem"
import AddBookToListPanel from "./AddBookToListPanel"
import { deleteList } from "../actions"
import { Button } from "@/components/ui/button"
import { Lock, Pencil, Trash2, BookOpen } from "lucide-react"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("lists").select("title").eq("id", id).single()
  return { title: data ? `${data.title} — Tomeo` : "Liste — Tomeo" }
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

  const owner = list.owner as any

  async function handleDelete() {
    "use server"
    await deleteList(id)
  }

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
              <form action={handleDelete}>
                <Button variant="ghost" size="sm" className="text-[--destructive]">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          )}
        </div>

        {list.description && (
          <p className="text-sm text-[--muted-foreground] leading-relaxed">{list.description}</p>
        )}
      </div>

      {/* Book list */}
      {!listBooks?.length ? (
        <div className="rounded-xl border border-[--border] bg-[--card] p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-[--muted-foreground]" />
          <p className="text-sm font-medium">Cette liste est vide</p>
          {isOwner && (
            <p className="text-xs text-[--muted-foreground] mt-1">
              Recherchez des livres ci-dessous pour les ajouter.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[--border] bg-[--card] px-4">
          {listBooks.map((item) => (
            <ListBookItem
              key={(item.book as any).id}
              listId={id}
              item={item as any}
              isOwner={isOwner}
            />
          ))}
        </div>
      )}

      {/* Add book panel — owner only */}
      {isOwner && (
        <div>
          <h2 className="text-sm font-medium mb-3">Ajouter un livre</h2>
          <AddBookToListPanel listId={id} existingBookIds={(listBooks ?? []).map((lb) => (lb.book as any).id)} />
        </div>
      )}
    </div>
  )
}

"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function createList(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const title = (formData.get("title") as string).trim()
  const description = (formData.get("description") as string).trim() || null
  const is_public = formData.get("is_public") !== "off"

  if (!title) throw new Error("Le titre est requis.")

  const { data: list, error } = await supabase
    .from("lists")
    .insert({ user_id: user.id, title, description, is_public })
    .select("id")
    .single()

  if (error || !list) throw new Error("Impossible de créer la liste.")

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single()

  revalidatePath(`/users/${profile?.username}/lists`)
  redirect(`/lists/${list.id}`)
}

export async function updateList(listId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const title = (formData.get("title") as string).trim()
  const description = (formData.get("description") as string).trim() || null
  const is_public = formData.get("is_public") !== "off"

  const { error } = await supabase
    .from("lists")
    .update({ title, description, is_public })
    .eq("id", listId)
    .eq("user_id", user.id)

  if (error) throw new Error("Impossible de modifier la liste.")

  revalidatePath(`/lists/${listId}`)
  revalidatePath(`/me/lists/${listId}/edit`)
  redirect(`/lists/${listId}`)
}

export async function deleteList(listId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single()

  await supabase.from("lists").delete().eq("id", listId).eq("user_id", user.id)

  revalidatePath(`/users/${profile?.username}/lists`)
  redirect(`/users/${profile?.username}/lists`)
}

export async function addBookToList(listId: string, bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Get current max position
  const { data: items } = await supabase
    .from("list_books")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)

  const nextPosition = items?.length ? (items[0].position + 1) : 0

  await supabase.from("list_books").upsert(
    { list_id: listId, book_id: bookId, position: nextPosition },
    { onConflict: "list_id,book_id" }
  )

  revalidatePath(`/lists/${listId}`)
}

export async function removeBookFromList(listId: string, bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase
    .from("list_books")
    .delete()
    .eq("list_id", listId)
    .eq("book_id", bookId)

  revalidatePath(`/lists/${listId}`)
}

export async function updateBookNote(listId: string, bookId: string, note: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  await supabase
    .from("list_books")
    .update({ note: note.trim() || null })
    .eq("list_id", listId)
    .eq("book_id", bookId)

  revalidatePath(`/lists/${listId}`)
}

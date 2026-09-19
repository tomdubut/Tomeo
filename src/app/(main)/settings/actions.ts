"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export async function updateProfile(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { error } = await supabase.from("profiles").update({
    display_name: (formData.get("display_name") as string).trim() || null,
    bio: (formData.get("bio") as string).trim() || null,
    location: (formData.get("location") as string).trim() || null,
    website_url: (formData.get("website_url") as string).trim() || null,
  }).eq("id", user.id)

  if (error) return { success: false, error: "Impossible de mettre à jour le profil." }

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single()
  revalidatePath("/", "layout")
  if (profile?.username) revalidatePath(`/users/${profile.username}`)
  return { success: true, error: null }
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const file = formData.get("file") as File | null
  if (!file || file.size === 0) return { success: false, error: "Aucun fichier sélectionné." }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return { success: false, error: "Format non supporté. Utilisez JPEG, PNG ou WebP." }
  if (file.size > 1 * 1024 * 1024)
    return { success: false, error: "L'image ne doit pas dépasser 1 Mo." }

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(user.id, file, { upsert: true, contentType: file.type })

  if (uploadError) return { success: false, error: `Impossible d'envoyer l'image. (${uploadError.message})` }

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(user.id)
  // Append cache-buster so browsers/CDN always fetch the new image
  const urlWithBust = `${publicUrl}?t=${Date.now()}`

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single()

  const { error: dbError } = await supabase.from("profiles").update({ avatar_url: urlWithBust }).eq("id", user.id)
  if (dbError) return { success: false, error: `Erreur base de données : ${dbError.message}` }

  revalidatePath("/settings")
  revalidatePath("/", "layout")
  if (profile?.username) revalidatePath(`/users/${profile.username}`)
  return { success: true, error: null, url: urlWithBust }
}

export async function setFavouriteBook(position: 1 | 2 | 3 | 4, bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single()

  const { error } = await supabase.from("profile_favourite_books").upsert(
    { user_id: user.id, book_id: bookId, position },
    { onConflict: "user_id,position" }
  )

  if (error) return { success: false, error: error.message }

  revalidatePath("/settings")
  if (profile?.username) revalidatePath(`/users/${profile.username}`)
  return { success: true, error: null }
}

export async function removeFavouriteBook(position: 1 | 2 | 3 | 4) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single()

  await supabase.from("profile_favourite_books")
    .delete()
    .eq("user_id", user.id)
    .eq("position", position)

  revalidatePath("/settings")
  if (profile?.username) revalidatePath(`/users/${profile.username}`)
}

export async function swapFavouriteBooks(posA: 1 | 2 | 3 | 4, posB: 1 | 2 | 3 | 4) {
  if (posA === posB) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: rows } = await supabase
    .from("profile_favourite_books")
    .select("position, book_id")
    .eq("user_id", user.id)
    .in("position", [posA, posB])

  const bookA = rows?.find((r: any) => r.position === posA)?.book_id ?? null
  const bookB = rows?.find((r: any) => r.position === posB)?.book_id ?? null

  if (bookA && bookB) {
    // Both filled: swap book_ids in-place — no delete, no data loss risk
    await supabase.from("profile_favourite_books").update({ book_id: bookB }).eq("user_id", user.id).eq("position", posA)
    await supabase.from("profile_favourite_books").update({ book_id: bookA }).eq("user_id", user.id).eq("position", posB)
  } else if (bookA) {
    await supabase.from("profile_favourite_books").update({ position: posB }).eq("user_id", user.id).eq("position", posA)
  } else if (bookB) {
    await supabase.from("profile_favourite_books").update({ position: posA }).eq("user_id", user.id).eq("position", posB)
  }

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single()
  if (profile?.username) revalidatePath(`/users/${profile.username}`)
}

export async function updateProfileColor(color: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  await supabase.from("profiles").update({ profile_color: color }).eq("id", user.id)

  revalidatePath("/settings")
  revalidatePath("/", "layout")
}

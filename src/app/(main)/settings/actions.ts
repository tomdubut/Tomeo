"use server"

import { createClient } from "@/lib/supabase/server"
import { getUserUsername } from "@/lib/supabase/queries"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export async function updateProfile(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const rawUrl = (formData.get("website_url") as string).trim()
  const website_url = rawUrl === "" ? null
    : /^https?:\/\/.+/.test(rawUrl) ? rawUrl
    : `https://${rawUrl}`

  const { error } = await supabase.from("profiles").update({
    display_name: (formData.get("display_name") as string).trim() || null,
    bio: (formData.get("bio") as string).trim() || null,
    location: (formData.get("location") as string).trim() || null,
    website_url,
  }).eq("id", user.id)

  if (error) return { success: false, error: "Impossible de mettre à jour le profil." }

  const username = await getUserUsername(user.id)
  revalidatePath("/", "layout")
  if (username) revalidatePath(`/users/${username}`)
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

  const { error: dbError } = await supabase.from("profiles").update({ avatar_url: urlWithBust }).eq("id", user.id)
  if (dbError) return { success: false, error: `Erreur base de données : ${dbError.message}` }

  const username = await getUserUsername(user.id)
  revalidatePath("/settings")
  revalidatePath("/", "layout")
  if (username) revalidatePath(`/users/${username}`)
  return { success: true, error: null, url: urlWithBust }
}

export async function setFavouriteBook(position: 1 | 2 | 3 | 4, bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { error } = await supabase.from("profile_favourite_books").upsert(
    { user_id: user.id, book_id: bookId, position },
    { onConflict: "user_id,position" }
  )

  if (error) return { success: false, error: error.message }

  const username = await getUserUsername(user.id)
  revalidatePath("/settings")
  if (username) revalidatePath(`/users/${username}`)
  return { success: true, error: null }
}

export async function removeFavouriteBook(position: 1 | 2 | 3 | 4) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  await supabase.from("profile_favourite_books")
    .delete()
    .eq("user_id", user.id)
    .eq("position", position)

  const username = await getUserUsername(user.id)
  revalidatePath("/settings")
  if (username) revalidatePath(`/users/${username}`)
}


export async function updateProfileColor(color: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Invalid color")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { error } = await supabase.from("profiles").update({ profile_color: color }).eq("id", user.id)
  if (error) throw new Error("Impossible de mettre à jour la couleur.")

  revalidatePath("/settings")
  revalidatePath("/", "layout")
}

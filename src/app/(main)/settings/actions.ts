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

  revalidatePath("/settings")
  revalidatePath("/", "layout")
  return { success: true, error: null }
}

export async function updateProfileColor(color: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  await supabase.from("profiles").update({ profile_color: color }).eq("id", user.id)

  revalidatePath("/settings")
  revalidatePath("/", "layout")
}

"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function createProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const username = (formData.get("username") as string).trim().toLowerCase()
  const display_name = (formData.get("display_name") as string).trim() || null

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    username,
    display_name,
  })

  if (error) {
    const msg = error.code === "23505"
      ? "Ce nom d'utilisateur est déjà pris."
      : "Une erreur est survenue. Veuillez réessayer."
    redirect(`/onboarding?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath("/", "layout")
  redirect("/feed")
}

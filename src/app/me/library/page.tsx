import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function MyLibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/onboarding")
  redirect(`/users/${profile.username}/library`)
}

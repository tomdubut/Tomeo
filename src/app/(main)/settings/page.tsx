import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import UserAvatar from "@/components/ui/UserAvatar"
import ProfileColorPicker from "@/components/settings/ProfileColorPicker"
import ProfileForm from "@/components/settings/ProfileForm"
import { Button } from "@/components/ui/button"
import { logout } from "@/app/(auth)/actions"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("*, profile_color").eq("id", user.id).single()
  if (!profile) redirect("/onboarding")

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Paramètres du profil</h1>
        <p className="mt-1 text-sm text-[--muted-foreground]">Gérez vos informations personnelles</p>
      </div>

      <div className="rounded-2xl bg-[--card] p-6 space-y-6 border border-[--border]">
        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          <UserAvatar profile={profile} className="h-16 w-16 ring-4 ring-[--border]" />
          <div>
            <p className="font-bold">{displayName}</p>
            <p className="text-sm text-[--muted-foreground]">@{profile.username}</p>
          </div>
        </div>

        <div className="h-px bg-[--border]" />

        {/* Profile color */}
        <div className="space-y-3">
          <div>
            <p className="font-semibold">Couleur du profil</p>
            <p className="text-sm text-[--muted-foreground]">Couleur affichée sur votre avatar quand vous n&apos;avez pas de photo</p>
          </div>
          <ProfileColorPicker currentColor={profile.profile_color ?? null} />
        </div>

        <div className="h-px bg-[--border]" />

        <ProfileForm profile={profile} />
      </div>

      <div className="rounded-2xl bg-[--card] p-6 border border-[--border]">
        <p className="font-semibold mb-1">Déconnexion</p>
        <p className="text-sm text-[--muted-foreground] mb-4">Vous serez redirigé vers la page de connexion.</p>
        <form>
          <Button formAction={logout} variant="outline" className="text-[--destructive] border-[--destructive]/30 hover:bg-[--destructive]/5">
            Se déconnecter
          </Button>
        </form>
      </div>
    </div>
  )
}

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import UserAvatar from "@/components/ui/UserAvatar"
import ProfileColorPicker from "@/components/settings/ProfileColorPicker"
import ProfileForm from "@/components/settings/ProfileForm"
import BackButton from "@/components/ui/BackButton"
import { logout } from "@/app/(auth)/actions"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("*, profile_color").eq("id", user.id).single()
  if (!profile) redirect("/onboarding")

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="max-w-5xl mx-auto pb-10 px-4">

      <div className="flex items-center gap-4 mb-6">
        <BackButton />
        <div>
          <h1 className="text-2xl font-extrabold">Mon profil</h1>
          <p className="text-sm text-[--muted-foreground]">Gérez vos informations publiques</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

        {/* Left column: preview + color */}
        <div className="space-y-6">

          {/* Identity card */}
          <div className="rounded-2xl bg-[--card] border border-[--border] overflow-hidden">
            <div className="h-20 w-full" style={{ background: profile.profile_color ?? "var(--secondary)" }} />
            <div className="px-6 pb-6">
              <div className="flex items-end justify-between -mt-10 mb-4">
                <UserAvatar profile={profile} className="h-20 w-20 ring-4 ring-[--card]" />
              </div>
              <p className="font-extrabold text-lg leading-tight">{displayName}</p>
              <p className="text-sm text-[--muted-foreground]">@{profile.username}</p>
              {profile.bio && <p className="mt-2 text-sm leading-relaxed text-[--muted-foreground]">{profile.bio}</p>}
            </div>
          </div>

          {/* Profile color */}
          <div className="rounded-2xl bg-[--card] border border-[--border] p-6 space-y-3">
            <div>
              <p className="font-semibold">Couleur du profil</p>
              <p className="text-sm text-[--muted-foreground] mt-0.5">Couleur de fond affichée sur votre avatar et votre profil.</p>
            </div>
            <ProfileColorPicker currentColor={profile.profile_color ?? null} />
          </div>

        </div>

        {/* Right column: form + danger zone */}
        <div className="space-y-6">

          {/* Profile form */}
          <div className="rounded-2xl bg-[--card] border border-[--border] p-6">
            <p className="font-semibold mb-5">Informations</p>
            <ProfileForm profile={profile} />
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border p-6 space-y-3" style={{ borderColor: "var(--destructive)", background: "color-mix(in srgb, var(--destructive) 5%, transparent)" }}>
            <div>
              <p className="font-semibold">Déconnexion</p>
              <p className="text-sm text-[--muted-foreground] mt-0.5">Vous serez redirigé vers la page de connexion.</p>
            </div>
            <form>
              <button
                formAction={logout}
                className="rounded-xl px-4 py-2 text-sm font-semibold border transition-colors hover:opacity-80"
                style={{ color: "var(--destructive)", borderColor: "var(--destructive)" }}
              >
                Se déconnecter
              </button>
            </form>
          </div>

        </div>
      </div>

    </div>
  )
}

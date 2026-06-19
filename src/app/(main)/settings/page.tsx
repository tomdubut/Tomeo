import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import UserAvatar from "@/components/ui/UserAvatar"
import ProfileColorPicker from "@/components/settings/ProfileColorPicker"
import { revalidatePath } from "next/cache"
import { Check } from "lucide-react"

async function updateProfile(formData: FormData) {
  "use server"
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  await supabase.from("profiles").update({
    display_name: (formData.get("display_name") as string).trim() || null,
    bio: (formData.get("bio") as string).trim() || null,
    location: (formData.get("location") as string).trim() || null,
    website_url: (formData.get("website_url") as string).trim() || null,
  }).eq("id", user.id)

  revalidatePath("/settings")
  revalidatePath("/", "layout")
  redirect("/settings?saved=1")
}

interface Props {
  searchParams: Promise<{ saved?: string }>
}

export default async function SettingsPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("*, profile_color").eq("id", user.id).single()
  if (!profile) redirect("/onboarding")

  const { saved } = await searchParams
  const displayName = profile.display_name ?? profile.username

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Paramètres du profil</h1>
        <p className="mt-1 text-sm text-[--muted-foreground]">Gérez vos informations personnelles</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700" style={{ boxShadow: "var(--shadow-sm)" }}>
          <Check className="h-4 w-4 shrink-0" />
          Profil mis à jour avec succès.
        </div>
      )}

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

        <form className="space-y-5">
          <div className="space-y-1.5">
            <Label className="font-semibold">Nom d&apos;utilisateur</Label>
            <Input value={`@${profile.username}`} disabled className="opacity-60" />
            <p className="text-xs text-[--muted-foreground]">Non modifiable pour l&apos;instant.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="display_name" className="font-semibold">Nom affiché</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile.display_name ?? ""}
              placeholder="Votre nom public"
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio" className="font-semibold">Bio</Label>
            <textarea
              id="bio"
              name="bio"
              defaultValue={profile.bio ?? ""}
              maxLength={500}
              rows={3}
              className="flex w-full rounded-xl border border-[--border] bg-[--card] px-4 py-2.5 text-sm font-medium transition-colors placeholder:text-[--muted-foreground] placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] resize-none"
              placeholder="Parlez de vous en quelques mots…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location" className="font-semibold">Lieu</Label>
            <Input
              id="location"
              name="location"
              defaultValue={profile.location ?? ""}
              placeholder="Paris, France"
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="website_url" className="font-semibold">Site web</Label>
            <Input
              id="website_url"
              name="website_url"
              type="url"
              defaultValue={profile.website_url ?? ""}
              placeholder="https://…"
            />
          </div>

          <div className="pt-2">
            <Button formAction={updateProfile} className="w-full">Enregistrer les modifications</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { revalidatePath } from "next/cache"

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
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/onboarding")

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Paramètres du profil</h1>
      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
          <CardDescription>Visibles sur votre profil public</CardDescription>
        </CardHeader>
        <form>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom d&apos;utilisateur</Label>
              <Input value={`@${profile.username}`} disabled />
              <p className="text-xs text-[--muted-foreground]">Non modifiable pour l&apos;instant.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="display_name">Nom affiché</Label>
              <Input
                id="display_name"
                name="display_name"
                defaultValue={profile.display_name ?? ""}
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                name="bio"
                defaultValue={profile.bio ?? ""}
                maxLength={500}
                rows={3}
                className="flex w-full rounded-md border border-[--border] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-[--muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] resize-none"
                placeholder="Parlez de vous en quelques mots…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Lieu</Label>
              <Input
                id="location"
                name="location"
                defaultValue={profile.location ?? ""}
                placeholder="Paris, France"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="website_url">Site web</Label>
              <Input
                id="website_url"
                name="website_url"
                type="url"
                defaultValue={profile.website_url ?? ""}
                placeholder="https://…"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button formAction={updateProfile}>Enregistrer</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createProfile } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function OnboardingPage({ searchParams }: Props) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single()

  if (profile) redirect("/feed")

  return (
    <div className="flex min-h-screen items-center justify-center bg-[--muted] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Bienvenue sur Tomeo !</CardTitle>
          <CardDescription>Choisissez votre nom d&apos;utilisateur pour commencer</CardDescription>
        </CardHeader>
        <form>
          <CardContent className="space-y-4">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {decodeURIComponent(error)}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="username">Nom d&apos;utilisateur</Label>
              <div className="flex items-center">
                <span className="flex h-9 items-center rounded-l-md border border-r-0 border-[--border] bg-[--secondary] px-3 text-sm text-[--muted-foreground]">
                  tomeo.fr/
                </span>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="votrepseudo"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="^[a-zA-Z0-9_-]+$"
                  className="rounded-l-none"
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-[--muted-foreground]">
                3-30 caractères, lettres, chiffres, _ et - uniquement
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="display_name">
                Nom affiché{" "}
                <span className="text-[--muted-foreground] font-normal">(facultatif)</span>
              </Label>
              <Input
                id="display_name"
                name="display_name"
                type="text"
                placeholder="Votre Nom"
                maxLength={50}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button formAction={createProfile} className="w-full">
              Commencer
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

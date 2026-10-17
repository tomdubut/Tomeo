import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createProfile } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookOpen } from "lucide-react"
import { PREFERRED_MEDIA_OPTIONS } from "@/lib/readingPreference"

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

  if (profile) redirect("/books")

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--primary)" }}>
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold">Bienvenue sur Tomesie</h1>
          <p className="text-sm text-muted-foreground">Choisissez votre nom d&apos;utilisateur pour commencer</p>
        </div>

        {/* Form */}
        <form className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {decodeURIComponent(error)}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-semibold">Nom d&apos;utilisateur</label>
            <div className="flex">
              <span className="flex h-11 items-center rounded-l-xl border border-r-0 border-border bg-secondary px-3 text-sm text-muted-foreground font-medium shrink-0">
                @
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
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">3–30 caractères, lettres, chiffres, _ et -</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="display_name" className="text-sm font-semibold">
              Nom affiché <span className="text-muted-foreground font-normal">(facultatif)</span>
            </label>
            <Input
              id="display_name"
              name="display_name"
              type="text"
              placeholder="Votre Nom"
              maxLength={50}
            />
          </div>

          <fieldset className="space-y-1.5">
            {/* Optional on purpose: the radios are visually hidden, so a "required" error would be invisible */}
            <legend className="text-sm font-semibold">Vous lisez surtout…</legend>
            <div className="grid grid-cols-3 gap-2 pt-1.5">
              {PREFERRED_MEDIA_OPTIONS.map((o) => (
                <label key={o.value} className="cursor-pointer">
                  <input type="radio" name="preferred_media" value={o.value} className="peer sr-only" />
                  <span className="flex h-11 items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold transition-colors hover:bg-secondary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    {o.label}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Pour vous montrer d&apos;abord ce qui vous intéresse. Modifiable dans les réglages.</p>
          </fieldset>

          <Button formAction={createProfile} className="w-full">
            Continuer →
          </Button>
        </form>
      </div>
    </div>
  )
}

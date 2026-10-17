"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateProfile } from "@/app/(main)/settings/actions"
import { PREFERRED_MEDIA_OPTIONS } from "@/lib/readingPreference"

interface Props {
  profile: {
    username: string
    display_name: string | null
    bio: string | null
    location: string | null
    website_url: string | null
    preferred_media: string | null
  }
}

export default function ProfileForm({ profile }: Props) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function saveField() {
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    startTransition(async () => {
      const result = await updateProfile(null, formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        setSaved(true)
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        savedTimerRef.current = setTimeout(() => setSaved(false), 2500)
      }
    })
  }

  return (
    <form ref={formRef} className="space-y-5">
      <div className="h-4 text-right">
        {isPending && (
          <p className="text-xs text-muted-foreground">Sauvegarde…</p>
        )}
        {!isPending && saved && (
          <p className="text-xs font-medium flex items-center justify-end gap-1" style={{ color: "#16a34a" }}>
            <Check className="h-3 w-3" />
            Sauvegardé
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="font-semibold">Nom d&apos;utilisateur</Label>
        <Input value={`@${profile.username}`} disabled className="opacity-60" />
        <p className="text-xs text-muted-foreground">Non modifiable pour l&apos;instant.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="display_name" className="font-semibold">Nom affiché</Label>
        <Input
          id="display_name"
          name="display_name"
          defaultValue={profile.display_name ?? ""}
          placeholder="Votre nom public"
          maxLength={50}
          onBlur={saveField}
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
          className="flex w-full rounded-xl border border-border bg-card px-4 py-2.5 text-base sm:text-sm font-medium transition-colors placeholder:text-muted-foreground placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          style={{ fontSize: "16px" }}
          placeholder="Parlez de vous en quelques mots…"
          onBlur={saveField}
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
          onBlur={saveField}
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
          onBlur={saveField}
        />
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-semibold">Vous lisez surtout…</legend>
        <div className="grid grid-cols-3 gap-2 pt-1.5">
          {PREFERRED_MEDIA_OPTIONS.map((o) => (
            <label key={o.value} className="cursor-pointer">
              <input
                type="radio"
                name="preferred_media"
                value={o.value}
                defaultChecked={(profile.preferred_media ?? "books") === o.value}
                onChange={saveField}
                className="peer sr-only"
              />
              <span className="flex h-10 items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold transition-colors hover:bg-secondary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                {o.label}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Le catalogue et la recherche s&apos;ouvrent sur ce choix.</p>
      </fieldset>
    </form>
  )
}

"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { updateProfile } from "@/app/(main)/settings/actions"

interface Props {
  profile: {
    username: string
    display_name: string | null
    bio: string | null
    location: string | null
    website_url: string | null
  }
}

export default function ProfileForm({ profile }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await updateProfile(formData)
      toast.success("Profil mis à jour")
    })
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
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
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer les modifications"}
        </Button>
      </div>
    </form>
  )
}

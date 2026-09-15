"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Camera } from "lucide-react"
import UserAvatar from "@/components/ui/UserAvatar"
import { uploadAvatar } from "@/app/(main)/settings/actions"
import { toast } from "sonner"

type Profile = { username: string; display_name: string | null; avatar_url: string | null; profile_color: string | null }

export default function AvatarUpload({ profile }: { profile: Profile }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format non supporté. Utilisez JPEG, PNG ou WebP.")
      e.target.value = ""
      return
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 1 Mo.")
      e.target.value = ""
      return
    }

    setPreview(URL.createObjectURL(file))
    setLoading(true)

    const formData = new FormData()
    formData.append("file", file)
    let result: Awaited<ReturnType<typeof uploadAvatar>> | null = null
    try {
      result = await uploadAvatar(formData)
    } catch (err: any) {
      setLoading(false)
      setPreview(null)
      toast.error(`Erreur inattendue : ${err?.message ?? String(err)}`)
      return
    }

    setLoading(false)
    if (!result.success) {
      setPreview(null)
      toast.error(result.error)
    } else {
      if (result.url) setPreview(result.url)
      toast.success("Photo de profil mise à jour.")
      router.refresh()
    }

    e.target.value = ""
  }

  const displayProfile = { ...profile, avatar_url: preview ?? profile.avatar_url }

  return (
    <div className="relative inline-block cursor-pointer group" onClick={() => inputRef.current?.click()}>
      <UserAvatar profile={displayProfile} className="h-20 w-20 ring-4 ring-[--card]" />
      <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
        {loading ? (
          <Loader2 className="h-5 w-5 text-white animate-spin" />
        ) : (
          <Camera className="h-5 w-5 text-white" />
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}

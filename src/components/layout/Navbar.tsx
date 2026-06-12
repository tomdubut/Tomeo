import Link from "next/link"
import { BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { logout } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", user.id)
      .single()
    profile = data
  }

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?"

  return (
    <header className="sticky top-0 z-50 border-b border-[--border] bg-[--background]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href={user ? "/feed" : "/"} className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5" />
          <span>Tomeo</span>
        </Link>

        <nav className="flex items-center gap-2">
          {user && profile ? (
            <>
              <Link href="/books" className="text-sm text-[--muted-foreground] hover:text-[--foreground] px-2">
                Catalogue
              </Link>
              <Link href="/feed" className="text-sm text-[--muted-foreground] hover:text-[--foreground] px-2">
                Fil
              </Link>
              <Link href={`/users/${profile.username}`}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Link>
              <form>
                <Button formAction={logout} variant="ghost" size="sm">
                  Déconnexion
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Connexion</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">S&apos;inscrire</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

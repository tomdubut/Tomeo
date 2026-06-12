import Link from "next/link"
import { BookOpen, Search } from "lucide-react"
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
    <header className="sticky top-0 z-50 border-b border-[--border] bg-[--background]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">

        {/* Logo */}
        <Link href={user ? "/feed" : "/"} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--primary]">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="font-serif text-lg font-semibold tracking-tight">Tomeo</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {user && profile ? (
            <>
              <Link href="/books" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[--muted-foreground] transition-colors hover:bg-[--secondary] hover:text-[--foreground]">
                <Search className="h-3.5 w-3.5" />
                Catalogue
              </Link>
              <Link href="/feed" className="rounded-lg px-3 py-2 text-sm text-[--muted-foreground] transition-colors hover:bg-[--secondary] hover:text-[--foreground]">
                Fil
              </Link>
              <Link href={`/users/${profile.username}/lists`} className="rounded-lg px-3 py-2 text-sm text-[--muted-foreground] transition-colors hover:bg-[--secondary] hover:text-[--foreground]">
                Listes
              </Link>

              <div className="ml-2 flex items-center gap-2 border-l border-[--border] pl-3">
                <Link href={`/users/${profile.username}`}>
                  <Avatar className="h-8 w-8 ring-2 ring-[--border] transition-all hover:ring-[--primary]">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-[--secondary] text-xs font-medium">{initials}</AvatarFallback>
                  </Avatar>
                </Link>
                <form>
                  <Button formAction={logout} variant="ghost" size="sm" className="text-[--muted-foreground]">
                    Déconnexion
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Connexion</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">S&apos;inscrire</Link>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

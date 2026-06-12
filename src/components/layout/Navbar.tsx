import Link from "next/link"
import { BookOpen, Search, Rss, List, Users } from "lucide-react"
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
    <header className="sticky top-0 z-50 border-b border-[--border] bg-[--background]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">

        <Link href={user ? "/feed" : "/"} className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[--primary]">
            <BookOpen className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">Tomeo</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {user && profile ? (
            <>
              <Link href="/books" className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-[--muted-foreground] transition-colors hover:bg-[--secondary] hover:text-[--foreground]">
                <Search className="h-4 w-4" />
                Catalogue
              </Link>
              <Link href="/feed" className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-[--muted-foreground] transition-colors hover:bg-[--secondary] hover:text-[--foreground]">
                <Rss className="h-4 w-4" />
                Fil
              </Link>
              <Link href={`/users/${profile.username}/lists`} className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-[--muted-foreground] transition-colors hover:bg-[--secondary] hover:text-[--foreground]">
                <List className="h-4 w-4" />
                Listes
              </Link>
              <Link href="/users" className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-[--muted-foreground] transition-colors hover:bg-[--secondary] hover:text-[--foreground]">
                <Users className="h-4 w-4" />
                Lecteurs
              </Link>

              <div className="ml-3 flex items-center gap-2 border-l border-[--border] pl-4">
                <Link href={`/users/${profile.username}`}>
                  <Avatar className="h-9 w-9 ring-2 ring-[--border] transition-all hover:ring-[--primary]">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-[--secondary] text-xs font-bold">{initials}</AvatarFallback>
                  </Avatar>
                </Link>
                <form>
                  <Button formAction={logout} variant="ghost" size="sm" className="text-[--muted-foreground] font-semibold">
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

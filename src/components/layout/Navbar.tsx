import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { logout } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import NotificationBell from "@/components/notifications/NotificationBell"
import { DesktopNavLinks, MobileNavLinks } from "@/components/layout/NavLinks"
import { BookOpen } from "lucide-react"

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let unreadCount = 0
  if (user) {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("profiles").select("username, display_name, avatar_url").eq("id", user.id).single(),
      supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    ])
    profile = data
    unreadCount = count ?? 0
  }

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?"

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[--border] bg-[--card]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">

          <Link href={user ? "/books" : "/"} className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[--primary]">
              <BookOpen className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight">Tomeo</span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {user && profile ? (
              <>
                {/* Desktop nav links — hidden on mobile */}
                <DesktopNavLinks username={profile.username} />

                <div className="ml-3 flex items-center gap-2 sm:border-l sm:border-[--border] sm:pl-4">
                  <NotificationBell initialUnreadCount={unreadCount} />
                  <Link href={`/users/${profile.username}`}>
                    <Avatar className="h-9 w-9 ring-2 ring-[--border] transition-all hover:ring-[--primary]">
                      <AvatarImage src={profile.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-[--secondary] text-xs font-bold">{initials}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <form className="hidden sm:block">
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

      {/* Mobile bottom tab bar */}
      {user && profile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[--border] bg-[--card]/95 backdrop-blur-sm sm:hidden pb-4">
          <div className="flex items-center justify-around">
            <MobileNavLinks username={profile.username} />
          </div>
        </nav>
      )}
    </>
  )
}

import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import NotificationBell from "@/components/notifications/NotificationBell"
import { DesktopNavLinks, MobileNavLinks } from "@/components/layout/NavLinks"
import UserAvatar from "@/components/ui/UserAvatar"
import SearchModal from "@/components/search/SearchModal"

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let unreadCount = 0
  if (user) {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("profiles").select("username, display_name, avatar_url, profile_color").eq("id", user.id).single(),
      supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    ])
    profile = data
    unreadCount = count ?? 0
  }

  return (
    <>
      <header className="sticky top-0 z-50" style={{ background: "#1c1208" }}>
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">

          <Link href={user ? "/books" : "/"} className="flex items-center gap-2.5">
            <span className="text-xl font-extrabold tracking-tight" style={{ color: "#f5efe6" }}>Tomeo</span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {user && profile ? (
              <>
                {/* Desktop nav links — hidden on mobile */}
                <DesktopNavLinks username={profile.username} />

                <div className="hidden sm:block"><SearchModal /></div>

                <div className="ml-3 flex items-center gap-2 sm:border-l sm:border-white/15 sm:pl-4">
                  <NotificationBell initialUnreadCount={unreadCount} />
                  <Link href={`/users/${profile.username}`}>
                    <UserAvatar profile={profile} className="h-9 w-9 ring-2 ring-[--border] transition-all hover:ring-[--primary]" />
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors" style={{ color: "rgba(245,239,230,0.85)" }}>
                  Connexion
                </Link>
                <Link href="/register" className="rounded-xl px-3.5 py-2 text-sm font-semibold" style={{ background: "#f5efe6", color: "#1c1208" }}>
                  S&apos;inscrire
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      {user && profile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden" style={{ background: "#1c1208", paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          <div className="flex items-center justify-around">
            <MobileNavLinks username={profile.username} />
          </div>
        </nav>
      )}
    </>
  )
}

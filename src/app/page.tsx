import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

async function AuthRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/home")
  return null
}

async function getCovers(): Promise<{ id: string; title: string; cover_url: string }[]> {
  "use cache"
  const admin = createAdminClient()
  const { data } = await admin
    .from("books")
    .select("id, title, cover_url, user_books!inner(book_id)")
    .not("cover_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(24)
  return (data ?? []).filter((b: any) => b.cover_url) as { id: string; title: string; cover_url: string }[]
}

const FEATURES = [
  {
    title: "Votre bibliothèque",
    desc: "Suivez vos lectures passées, en cours et à venir.",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#c04a15" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    title: "Notes & critiques",
    desc: "Notez et rédigez vos avis sur chaque livre lu.",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#c04a15" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    title: "Communauté",
    desc: "Suivez des lecteurs et découvrez leurs coups de cœur.",
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#c04a15" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
]

export default async function LandingPage() {
  const covers = await getCovers()
  const col1 = covers.filter((_, i) => i % 3 === 0).slice(0, 6)
  const col2 = covers.filter((_, i) => i % 3 === 1).slice(0, 6)
  const col3 = covers.filter((_, i) => i % 3 === 2).slice(0, 6)

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "#1a1008", color: "#f5efe6" }}>
      <Suspense>
        <AuthRedirect />
      </Suspense>

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-6" style={{ background: "linear-gradient(to bottom, rgba(26,16,8,0.96) 0%, rgba(26,16,8,0) 100%)" }}>
        <span className="text-xl font-extrabold tracking-tight" style={{ color: "#f5efe6" }}>Tomesie</span>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold transition-colors" style={{ color: "rgba(245,239,230,0.7)" }}>
            Connexion
          </Link>
          <Link href="/register" className="rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90" style={{ background: "#f5efe6", color: "#1a1008" }}>
            S&apos;inscrire
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 grid lg:grid-cols-2 min-h-screen" style={{ paddingTop: "0" }}>

        {/* Text side */}
        <div className="flex flex-col gap-6 justify-center px-6 lg:px-12 pt-24 pb-12 lg:py-24 relative z-10">

          {/* Eyebrow */}
          <div className="flex items-center gap-3">
            <span className="block w-6 h-px" style={{ background: "#c04a15", opacity: 0.7 }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#c04a15" }}>
              Votre journal de lecture
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight" style={{ color: "#f5efe6" }}>
            Lisez.<br />
            <em className="not-italic" style={{ color: "#c04a15", fontStyle: "italic" }}>Partagez.</em><br />
            Découvrez.
          </h1>

          <p className="text-base leading-relaxed max-w-sm" style={{ color: "rgba(245,239,230,0.6)" }}>
            Suivez vos lectures, notez vos impressions et échangez avec une communauté de lecteurs passionnés.
          </p>

          {/* CTAs */}
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center rounded-full px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ background: "#f5efe6", color: "#1a1008" }}
            >
              Créer un compte
            </Link>
            <Link
              href="/books"
              className="inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold transition-colors"
              style={{ color: "rgba(245,239,230,0.7)", border: "1px solid rgba(245,239,230,0.15)" }}
            >
              Explorer les livres
            </Link>
          </div>

          {/* Features */}
          <div className="flex flex-col gap-4 mt-2">
            {FEATURES.map(({ title, desc, icon }) => (
              <div key={title} className="flex items-start gap-3">
                <div
                  className="shrink-0 flex items-center justify-center rounded-lg mt-0.5"
                  style={{ width: 32, height: 32, border: "1px solid rgba(245,239,230,0.12)" }}
                >
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#f5efe6" }}>{title}</p>
                  <p className="text-sm" style={{ color: "rgba(245,239,230,0.5)" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vertical divider (desktop only) */}
        <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, rgba(245,239,230,0.08) 30%, rgba(245,239,230,0.08) 70%, transparent)" }} />

        {/* Mosaic — desktop vertical */}
        {covers.length >= 6 && (
          <div
            className="hidden lg:flex gap-3 h-screen overflow-hidden px-8"
            style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)" }}
          >
            {[
              { col: col1, duration: "21s", offset: "0px" },
              { col: col2, duration: "27s", offset: "-60px" },
              { col: col3, duration: "24s", offset: "-30px" },
            ].map(({ col, duration, offset }, ci) => (
              <div key={ci} className="flex-1 overflow-hidden">
              <div
                className="mosaic-col flex flex-col gap-3"
                style={{
                  marginTop: offset,
                  animation: `drift ${duration} linear infinite`,
                }}
              >
                {[...col, ...col, ...col, ...col].map((book, i) => (
                  <div key={`${book.id}-${i}`} className="w-full rounded-xl overflow-hidden shrink-0" style={{ aspectRatio: "2/3", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
                    <Image src={book.cover_url} alt={book.title} width={140} height={210} className="w-full h-full object-cover" unoptimized />
                  </div>
                ))}
              </div>
              </div>
            ))}
          </div>
        )}

        {/* Mosaic — mobile horizontal strip */}
        {covers.length >= 6 && (
          <div
            className="lg:hidden w-screen -ml-6 overflow-hidden"
            style={{ height: 200, maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)" }}
          >
            <div
              className="mosaic-col flex gap-3 px-6 h-full"
              style={{ animation: "drift-h 12s linear infinite", willChange: "transform" }}
            >
              {[...covers, ...covers, ...covers, ...covers].map((book, i) => (
                <div key={`${book.id}-${i}`} className="shrink-0 rounded-xl overflow-hidden h-full" style={{ aspectRatio: "2/3", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
                  <Image src={book.cover_url} alt={book.title} width={96} height={144} className="w-full h-full object-cover" unoptimized />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

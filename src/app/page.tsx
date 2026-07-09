import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BookMarked, Rss, Star } from "lucide-react"

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
    .select("id, title, cover_url")
    .not("cover_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(24)
  return (data ?? []).filter((b: any) => b.cover_url) as { id: string; title: string; cover_url: string }[]
}

const FEATURES = [
  { icon: BookMarked, title: "Votre bibliothèque", desc: "Suivez vos lectures passées, en cours et à venir." },
  { icon: Star, title: "Notes & critiques", desc: "Notez et rédigez vos avis sur chaque livre lu." },
  { icon: Rss, title: "Communauté", desc: "Suivez des lecteurs et découvrez leurs coups de cœur." },
]

export default async function LandingPage() {
  const covers = await getCovers()
  const col1 = covers.filter((_, i) => i % 3 === 0).slice(0, 6)
  const col2 = covers.filter((_, i) => i % 3 === 1).slice(0, 6)
  const col3 = covers.filter((_, i) => i % 3 === 2).slice(0, 6)

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "#1c1208" }}>
      <Suspense>
        <AuthRedirect />
      </Suspense>

      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between px-6" style={{ background: "#1c1208" }}>
        <span className="text-xl font-extrabold tracking-tight" style={{ color: "#f5efe6" }}>Tomesie</span>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl px-3.5 py-2 text-sm font-semibold" style={{ color: "rgba(245,239,230,0.75)" }}>
            Connexion
          </Link>
          <Link href="/register" className="rounded-xl px-3.5 py-2 text-sm font-semibold" style={{ background: "#f5efe6", color: "#1c1208" }}>
            S&apos;inscrire
          </Link>
        </div>
      </header>

      {/* Hero — stacks vertically on mobile, side by side on desktop */}
      <main className="flex-1 flex flex-col lg:flex-row lg:items-center gap-0 lg:gap-12 px-6 pt-12 pb-16 max-w-6xl mx-auto w-full">

        {/* Text block */}
        <div className="flex flex-col gap-6 lg:flex-1 lg:py-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight" style={{ color: "#f5efe6" }}>
            La bibliothèque<br />des lecteurs<br />français
          </h1>
          <p className="text-lg max-w-sm" style={{ color: "rgba(245,239,230,0.65)" }}>
            Notez vos lectures, découvrez de nouveaux livres et partagez vos coups de cœur avec votre communauté.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/register" className="inline-flex items-center rounded-2xl px-6 py-3 text-base font-bold transition-opacity hover:opacity-90" style={{ background: "#f5efe6", color: "#1c1208" }}>
              Créer un compte
            </Link>
            <Link href="/books" className="inline-flex items-center rounded-2xl px-6 py-3 text-base font-semibold" style={{ color: "rgba(245,239,230,0.75)", border: "1px solid rgba(245,239,230,0.2)" }}>
              Explorer les livres
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 mt-2">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(245,239,230,0.1)" }}>
                  <Icon className="h-4 w-4" style={{ color: "#f5efe6" }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: "#f5efe6" }}>{title}</p>
                  <p className="text-sm" style={{ color: "rgba(245,239,230,0.55)" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile/tablet: horizontal cover strip */}
        {covers.length >= 6 && (
          <div className="lg:hidden mt-10 w-screen -ml-6 overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)" }}>
            <div className="flex gap-3 px-6 pb-2 overflow-x-auto scrollbar-hide">
              {[...covers, ...covers.slice(0, 8)].map((book, i) => (
                <div key={`${book.id}-${i}`} className="w-24 aspect-[2/3] rounded-xl overflow-hidden shrink-0" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
                  <Image src={book.cover_url} alt={book.title} width={96} height={144} className="w-full h-full object-cover" unoptimized />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Desktop: vertical 3-column mosaic */}
        {covers.length >= 6 && (
          <div className="hidden lg:flex gap-3 h-[520px] overflow-hidden shrink-0" style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)" }}>
            {[col1, col2, col3].map((col, ci) => (
              <div key={ci} className="flex flex-col gap-3 w-28" style={{ transform: `translateY(${ci === 1 ? "-40px" : ci === 2 ? "-20px" : "0px"})` }}>
                {[...col, ...col].map((book, i) => (
                  <div key={`${book.id}-${i}`} className="w-28 aspect-[2/3] rounded-xl overflow-hidden shrink-0" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
                    <Image src={book.cover_url} alt={book.title} width={112} height={168} className="w-full h-full object-cover" unoptimized />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

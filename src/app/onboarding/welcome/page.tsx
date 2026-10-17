import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Library, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function OnboardingWelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, preferred_media")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/onboarding")

  const displayName = profile.display_name ?? profile.username

  const readsBooks = profile.preferred_media !== "manga" // books, both, or not answered
  const readsManga = profile.preferred_media === "manga" || profile.preferred_media === "both"

  const steps = [
    ...(readsBooks
      ? [{
          icon: Search,
          color: "#b95c2a",
          title: "Ajoutez votre premier livre",
          description: "Cherchez un titre ou un auteur et ajoutez-le à votre bibliothèque.",
          cta: "Parcourir les livres",
          href: "/books?type=books",
        }]
      : []),
    ...(readsManga
      ? [
          {
            icon: Search,
            color: "#b95c2a",
            title: "Ajoutez votre premier manga",
            description: "Plus de 1 000 séries, avec les couvertures et le nombre de tomes parus en France.",
            cta: "Parcourir les manga",
            href: "/books?type=manga",
          },
          {
            icon: Library,
            color: "#2e5234",
            title: "Suivez les tomes que vous possédez",
            description: "Sur la page d'une série, « Je collectionne cette série » affiche vos tomes : possédés, commandés, et les prochains à acheter.",
            cta: "Voir les manga",
            href: "/books?type=manga",
          },
        ]
      : []),
    {
      icon: Users,
      color: "#6366f1",
      title: "Trouvez des lecteurs",
      description: "Suivez d'autres lecteurs pour voir leurs critiques et découvrir de nouvelles lectures.",
      cta: "Trouver des lecteurs",
      href: "/users",
    },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-lg space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold">C&apos;est parti, {displayName} ! 🎉</h1>
          <p className="text-muted-foreground">Votre compte est prêt. Voici comment tirer le meilleur de Tomesie.</p>
        </div>

        {/* Step cards */}
        <div className="space-y-3">
          {steps.map(({ icon: Icon, color, title, description, cta, href }, i) => (
            <Link
              key={i}
              href={href}
              className="flex items-start gap-4 rounded-2xl p-5 transition-all hover:scale-[1.01]"
              style={{ background: "var(--card)", boxShadow: "var(--shadow-sm)" }}
            >
              <div
                className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `${color}18` }}
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm">{title}</p>
                  <span
                    className="shrink-0 text-xs font-semibold rounded-lg px-2.5 py-1"
                    style={{ background: `${color}15`, color }}
                  >
                    {cta} →
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Skip */}
        <div className="text-center">
          <Button asChild variant="ghost" size="sm">
            <Link href={readsBooks ? "/books" : "/books?type=manga"}>Passer et aller au catalogue</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

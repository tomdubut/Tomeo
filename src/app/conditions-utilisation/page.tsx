import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Conditions d'utilisation — Tomesie",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen px-4 py-12" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="max-w-2xl mx-auto space-y-8">

        <Link href="/" className="flex items-center gap-2 group w-fit text-sm" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Retour
        </Link>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Conditions d&apos;utilisation</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>Dernière mise à jour : octobre 2026</p>
        </div>

        <Section title="1. Objet">
          <p>
            Les présentes conditions d&apos;utilisation (CGU) régissent l&apos;accès et l&apos;utilisation de Tomesie,
            une plateforme permettant de suivre ses lectures, rédiger des critiques et échanger avec d&apos;autres lecteurs.
          </p>
        </Section>

        <Section title="2. Accès au service">
          <p>
            L&apos;inscription est gratuite et ouverte à toute personne majeure ou mineure avec autorisation parentale.
            Vous devez fournir une adresse e-mail valide et un mot de passe. Vous êtes responsable de la
            confidentialité de vos identifiants.
          </p>
        </Section>

        <Section title="3. Contenu utilisateur">
          <p>
            Vous êtes seul responsable des critiques, notes et contenus que vous publiez sur Tomesie.
            Sont interdits : les contenus illicites, diffamatoires, haineux ou portant atteinte aux droits de tiers.
          </p>
          <p>
            En publiant du contenu, vous accordez à Tomesie une licence non exclusive d&apos;affichage de ce contenu
            sur la plateforme.
          </p>
        </Section>

        <Section title="4. Disponibilité">
          <p>
            Tomesie est un service en cours de développement. Nous nous efforçons d&apos;assurer sa disponibilité
            mais ne pouvons garantir une accessibilité permanente. Des interruptions pour maintenance peuvent survenir.
          </p>
        </Section>

        <Section title="5. Suppression de compte">
          <p>
            Vous pouvez supprimer votre compte à tout moment depuis vos paramètres. Vos données personnelles
            seront supprimées conformément à notre{" "}
            <Link href="/politique-de-confidentialite" className="underline">Politique de confidentialité</Link>.
          </p>
        </Section>

        <Section title="6. Droit applicable">
          <p>
            Les présentes CGU sont soumises au droit français. En cas de litige, les tribunaux compétents
            seront ceux du ressort du domicile du défendeur.
          </p>
        </Section>

        <p className="text-sm pt-4 border-t" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          Pour toute question : <a href="mailto:contact@tomesie.com" className="underline">contact@tomesie.com</a>
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: "var(--muted-foreground)" }}>
        {children}
      </div>
    </section>
  )
}

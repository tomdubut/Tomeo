import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Politique de confidentialité — Tomesie",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen px-4 py-12" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="max-w-2xl mx-auto space-y-8">

        <Link href="/" className="flex items-center gap-2 group w-fit text-sm" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Retour
        </Link>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Politique de confidentialité</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>Dernière mise à jour : octobre 2026</p>
        </div>

        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement des données personnelles collectées sur Tomesie est Tom Mauri,
            joignable à l&apos;adresse : <a href="mailto:contact@tomesie.com" className="underline">contact@tomesie.com</a>.
          </p>
        </Section>

        <Section title="2. Données collectées">
          <p>Lors de la création d&apos;un compte, nous collectons :</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Adresse e-mail</li>
            <li>Mot de passe (stocké sous forme hachée, jamais en clair)</li>
            <li>Nom d&apos;utilisateur (choisi lors de l&apos;inscription)</li>
          </ul>
          <p className="mt-3">En utilisant Tomesie, vous générez également des données liées à votre activité :</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Livres ajoutés à votre bibliothèque et leur statut de lecture</li>
            <li>Notes et critiques rédigées</li>
            <li>Relations d&apos;abonnement entre utilisateurs</li>
          </ul>
        </Section>

        <Section title="3. Finalités et base légale">
          <p>Vos données sont utilisées pour :</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Créer et gérer votre compte</strong> — base légale : exécution du contrat (art. 6.1.b RGPD)</li>
            <li><strong>Vous permettre d&apos;utiliser les fonctionnalités de la plateforme</strong> (bibliothèque, notes, communauté) — base légale : exécution du contrat</li>
            <li><strong>Améliorer le service</strong> (analyse d&apos;usage agrégée et anonymisée) — base légale : intérêt légitime (art. 6.1.f RGPD)</li>
          </ul>
          <p className="mt-3">Nous ne vendons pas vos données personnelles à des tiers et ne les utilisons pas à des fins publicitaires.</p>
        </Section>

        <Section title="4. Durée de conservation">
          <p>
            Vos données sont conservées pendant toute la durée de vie de votre compte. Si vous supprimez votre compte,
            vos données personnelles sont supprimées dans un délai de 30 jours. Les données anonymisées ou agrégées
            peuvent être conservées sans limitation de durée.
          </p>
        </Section>

        <Section title="5. Destinataires des données">
          <p>Vos données sont hébergées et traitées par les sous-traitants suivants :</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Supabase</strong> (base de données et authentification) — hébergé en Europe (AWS eu-west-3, Paris)</li>
            <li><strong>Vercel</strong> (hébergement de l&apos;application) — serveurs en Europe</li>
          </ul>
          <p className="mt-3">Ces sous-traitants sont soumis à des garanties contractuelles conformes au RGPD.</p>
        </Section>

        <Section title="6. Vos droits">
          <p>Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits suivants :</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Droit d&apos;accès</strong> — obtenir une copie de vos données</li>
            <li><strong>Droit de rectification</strong> — corriger des données inexactes</li>
            <li><strong>Droit à l&apos;effacement</strong> — demander la suppression de votre compte et de vos données</li>
            <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format structuré</li>
            <li><strong>Droit d&apos;opposition</strong> — vous opposer à certains traitements</li>
          </ul>
          <p className="mt-3">
            Pour exercer ces droits, contactez-nous à{" "}
            <a href="mailto:contact@tomesie.com" className="underline">contact@tomesie.com</a>.
            Vous pouvez également introduire une réclamation auprès de la{" "}
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="underline">CNIL</a>.
          </p>
        </Section>

        <Section title="7. Cookies">
          <p>
            Tomesie utilise uniquement des cookies strictement nécessaires au fonctionnement du service
            (session d&apos;authentification). Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé.
            Ces cookies ne nécessitent pas de consentement préalable au titre de l&apos;article 82 de la loi
            Informatique et Libertés.
          </p>
        </Section>

        <Section title="8. Modifications">
          <p>
            Nous pouvons mettre à jour cette politique. En cas de modification substantielle, vous serez
            informé par e-mail ou via une notification dans l&apos;application. La date de dernière mise à jour
            est indiquée en haut de cette page.
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

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { forgotPassword } from "../actions"
import Turnstile from "@/components/auth/Turnstile"

interface Props {
  searchParams: Promise<{ error?: string; sent?: string }>
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { error, sent } = await searchParams

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ background: "var(--dark)" }}>
      <div className="w-full max-w-sm">

        <Link href="/login" className="mb-6 flex items-center gap-2 group w-fit" aria-label="Retour">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors" style={{ background: "color-mix(in srgb, var(--dark-foreground) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--dark-foreground) 15%, transparent)" }}>
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" style={{ color: "var(--dark-foreground)" }} />
          </span>
        </Link>

        <div className="mb-8">
          <p className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--dark-foreground)" }}>Mot de passe oublié</p>
          <p className="mt-1 text-sm" style={{ color: "color-mix(in srgb, var(--dark-foreground) 55%, transparent)" }}>
            Entrez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "color-mix(in srgb, var(--dark-foreground) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--dark-foreground) 10%, transparent)" }}>
          {sent ? (
            <div className="text-center space-y-2 py-2">
              <p className="font-semibold" style={{ color: "var(--dark-foreground)" }}>Email envoyé ✓</p>
              <p className="text-sm" style={{ color: "color-mix(in srgb, var(--dark-foreground) 55%, transparent)" }}>
                Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
              </p>
            </div>
          ) : (
            <form className="space-y-4">
              {error && (
                <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(220,60,60,0.15)", color: "#f87171", border: "1px solid rgba(220,60,60,0.25)" }}>
                  {decodeURIComponent(error)}
                </p>
              )}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium" style={{ color: "color-mix(in srgb, var(--dark-foreground) 80%, transparent)" }}>Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="vous@exemple.fr"
                  required
                  autoComplete="email"
                  className="auth-input w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                  style={{ background: "color-mix(in srgb, var(--dark-foreground) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--dark-foreground) 15%, transparent)", color: "var(--dark-foreground)" }}
                />
              </div>
              <Turnstile />

              <button
                formAction={forgotPassword}
                className="w-full rounded-xl py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
                style={{ background: "var(--dark-foreground)", color: "var(--dark)" }}
              >
                Envoyer le lien
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

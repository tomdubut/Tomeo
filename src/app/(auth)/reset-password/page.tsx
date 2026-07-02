import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { resetPassword } from "../actions"

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ background: "#1c1208" }}>
      <div className="w-full max-w-sm">

        <Link href="/login" className="mb-6 flex items-center gap-2 group w-fit" aria-label="Retour">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors" style={{ background: "rgba(245,239,230,0.08)", border: "1px solid rgba(245,239,230,0.15)" }}>
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" style={{ color: "#f5efe6" }} />
          </span>
        </Link>

        <div className="mb-8">
          <p className="text-2xl font-extrabold tracking-tight" style={{ color: "#f5efe6" }}>Nouveau mot de passe</p>
          <p className="mt-1 text-sm" style={{ color: "rgba(245,239,230,0.55)" }}>Choisissez un nouveau mot de passe pour votre compte.</p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "rgba(245,239,230,0.06)", border: "1px solid rgba(245,239,230,0.1)" }}>
          <form className="space-y-4">
            {error && (
              <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(220,60,60,0.15)", color: "#f87171", border: "1px solid rgba(220,60,60,0.25)" }}>
                {decodeURIComponent(error)}
              </p>
            )}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium" style={{ color: "rgba(245,239,230,0.8)" }}>Nouveau mot de passe</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                className="auth-input w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                style={{ background: "rgba(245,239,230,0.08)", border: "1px solid rgba(245,239,230,0.15)", color: "#f5efe6" }}
              />
              <p className="text-xs" style={{ color: "rgba(245,239,230,0.4)" }}>8 caractères minimum</p>
            </div>
            <button
              formAction={resetPassword}
              className="w-full rounded-xl py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ background: "#f5efe6", color: "#1c1208" }}
            >
              Réinitialiser le mot de passe
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { login } from "../actions"

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ background: "#1c1208" }}>

      <div className="w-full max-w-sm">
        {/* Back arrow */}
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 group w-fit" aria-label="Retour">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors" style={{ background: "rgba(245,239,230,0.08)", border: "1px solid rgba(245,239,230,0.15)" }}>
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" style={{ color: "#f5efe6" }} />
          </span>
        </Link>

        {/* Logo */}
        <div className="mb-8 text-center">
          <p className="text-2xl font-extrabold tracking-tight" style={{ color: "#f5efe6" }}>Tomeo</p>
          <p className="mt-1 text-sm" style={{ color: "rgba(245,239,230,0.55)" }}>Connectez-vous à votre compte</p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl p-6 space-y-5" style={{ background: "rgba(245,239,230,0.06)", border: "1px solid rgba(245,239,230,0.1)" }}>
          {error && (
            <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(220,60,60,0.15)", color: "#f87171", border: "1px solid rgba(220,60,60,0.25)" }}>
              {decodeURIComponent(error)}
            </p>
          )}

          <form className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium" style={{ color: "rgba(245,239,230,0.8)" }}>Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="vous@exemple.fr"
                required
                autoComplete="email"
                className="auth-input w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                style={{ background: "rgba(245,239,230,0.08)", border: "1px solid rgba(245,239,230,0.15)", color: "#f5efe6" }}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium" style={{ color: "rgba(245,239,230,0.8)" }}>Mot de passe</label>
                <Link href="/forgot-password" className="text-xs" style={{ color: "rgba(245,239,230,0.45)" }}>Mot de passe oublié ?</Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="auth-input w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                style={{ background: "rgba(245,239,230,0.08)", border: "1px solid rgba(245,239,230,0.15)", color: "#f5efe6" }}
              />
            </div>

            <button
              type="submit"
              formAction={login}
              className="w-full rounded-xl py-2.5 text-sm font-bold transition-opacity hover:opacity-90 mt-2"
              style={{ background: "#f5efe6", color: "#1c1208" }}
            >
              Se connecter
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm" style={{ color: "rgba(245,239,230,0.45)" }}>
          Pas encore de compte ?{" "}
          <Link href="/register" className="font-semibold underline underline-offset-4" style={{ color: "rgba(245,239,230,0.8)" }}>
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </div>
  )
}

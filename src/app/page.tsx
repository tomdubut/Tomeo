import { Suspense } from "react"
import Link from "next/link"
import { BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

async function AuthRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/books")
  return null
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense>
        <AuthRedirect />
      </Suspense>

      <header className="border-b border-[--border] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5" />
          <span>Tomeo</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Connexion</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">S&apos;inscrire</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center gap-6">
        <h1 className="text-4xl font-bold tracking-tight max-w-xl">
          La bibliothèque des lecteurs français
        </h1>
        <p className="text-lg text-[--muted-foreground] max-w-md">
          Notez vos lectures, découvrez de nouveaux livres et suivez vos amis lecteurs.
        </p>
        <Button asChild size="lg">
          <Link href="/register">Commencer gratuitement</Link>
        </Button>
      </main>
    </div>
  )
}

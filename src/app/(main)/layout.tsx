import { Suspense } from "react"
import Link from "next/link"
import Navbar from "@/components/layout/Navbar"
import NavigationProgress from "@/components/ui/NavigationProgress"
import { Toaster } from "sonner"

function NavbarFallback() {
  return (
    <header className="sticky top-0 z-50" style={{ background: "#1c1208" }}>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-extrabold tracking-tight" style={{ color: "#f5efe6" }}>Tomeo</Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl px-3.5 py-2 text-sm font-semibold" style={{ color: "rgba(245,239,230,0.85)" }}>Connexion</Link>
          <Link href="/register" className="rounded-xl px-3.5 py-2 text-sm font-semibold" style={{ background: "#f5efe6", color: "#1c1208" }}>S&apos;inscrire</Link>
        </div>
      </div>
    </header>
  )
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <NavigationProgress />
      </Suspense>
      <Suspense fallback={<NavbarFallback />}>
        <Navbar />
      </Suspense>
      <main className="mx-auto w-full max-w-5xl px-4 py-10 pb-20 sm:pb-10">
        <Suspense>
          {children}
        </Suspense>
      </main>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "var(--card)",
            border: "none",
            color: "var(--secondary-accent)",
            boxShadow: "none",
          },
        }}
      />
    </>
  )
}

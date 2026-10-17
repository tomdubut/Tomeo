import { Suspense } from "react"
import Link from "next/link"
import Navbar from "@/components/layout/Navbar"
import NavigationProgress from "@/components/ui/NavigationProgress"
import FeedbackButton from "@/components/feedback/FeedbackButton"
import { Toaster } from "sonner"
import Wordmark from "@/components/brand/Wordmark"

function NavbarFallback() {
  return (
    <header className="sticky top-0 z-50" style={{ background: "var(--dark)" }}>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/"><Wordmark /></Link>
        <div className="h-8 w-8 rounded-full" style={{ background: "color-mix(in srgb, var(--dark-foreground) 12%, transparent)" }} />
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
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <Suspense>
          {children}
        </Suspense>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 sm:pb-8">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border pt-5 text-xs text-muted-foreground">
          <FeedbackButton variant="link" />
          <Link href="/conditions-utilisation" className="hover:underline">Conditions d&apos;utilisation</Link>
          <Link href="/politique-de-confidentialite" className="hover:underline">Confidentialité</Link>
        </div>
      </footer>
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

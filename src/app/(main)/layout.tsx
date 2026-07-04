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
        <div className="h-8 w-8 rounded-full" style={{ background: "rgba(245,239,230,0.12)" }} />
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

import { Suspense } from "react"
import Navbar from "@/components/layout/Navbar"
import NavigationProgress from "@/components/ui/NavigationProgress"
import { Toaster } from "sonner"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <NavigationProgress />
      </Suspense>
      <Suspense>
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

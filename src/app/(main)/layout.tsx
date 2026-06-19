import Navbar from "@/components/layout/Navbar"
import { Toaster } from "sonner"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 pb-20 sm:pb-10">
        {children}
      </main>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            boxShadow: "var(--shadow-lg)",
          },
        }}
      />
    </>
  )
}

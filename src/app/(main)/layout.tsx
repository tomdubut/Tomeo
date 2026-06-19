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
          classNames: {
            toast: "!bg-[--card] !border-[--border] !text-[--foreground] !shadow-none",
            success: "[&_[data-icon]]:!text-[--secondary-accent]",
            error: "[&_[data-icon]]:!text-[--destructive]",
          },
        }}
      />
    </>
  )
}

import Navbar from "@/components/layout/Navbar"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {children}
      </main>
    </>
  )
}

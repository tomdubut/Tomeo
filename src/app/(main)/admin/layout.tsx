import type { Metadata } from "next"

// No title: the shell is sent before the admin check, and shouldn't reveal what the page is
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-4xl">{children}</div>
}

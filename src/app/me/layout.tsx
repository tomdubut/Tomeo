import { Suspense } from "react"

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>
}

import { Suspense } from "react"
import ReactDOM from "react-dom"
import { TURNSTILE_SCRIPT_SRC } from "@/lib/turnstile"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Start connecting to Cloudflare and downloading Turnstile while the page loads,
  // so the check is usually done before the user has finished typing.
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    ReactDOM.preconnect("https://challenges.cloudflare.com")
    ReactDOM.preload(TURNSTILE_SCRIPT_SRC, { as: "script" })
  }
  return <Suspense>{children}</Suspense>
}

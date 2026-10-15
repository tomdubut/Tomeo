"use client"

import { useEffect, useRef } from "react"

// Cloudflare Turnstile widget. Supabase Auth has CAPTCHA protection on, so
// sign-in, sign-up and password reset must send a token. The widget adds it to
// the enclosing form as the hidden field "cf-turnstile-response".

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error("Turnstile failed to load"))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export default function Turnstile() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return
    const container = ref.current
    let widgetId: string | null = null
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return
        widgetId = window.turnstile.render(container, {
          sitekey: SITE_KEY,
          theme: "dark",
          language: "fr",
        })
      })
      .catch((err) => console.error(err))

    // A token is single-use: after a submission (e.g. wrong password, the page
    // stays mounted), get a fresh one for the next attempt.
    const form = container.closest("form")
    const onSubmit = () => {
      setTimeout(() => {
        if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
      }, 1000)
    }
    form?.addEventListener("submit", onSubmit)

    return () => {
      cancelled = true
      form?.removeEventListener("submit", onSubmit)
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [])

  if (!SITE_KEY) return null
  return <div ref={ref} className="flex justify-center min-h-[65px]" />
}

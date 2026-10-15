"use client"

import { useEffect, useRef } from "react"
import { TURNSTILE_SCRIPT_SRC } from "@/lib/turnstile"

// Cloudflare Turnstile widget. Supabase Auth has CAPTCHA protection on, so
// sign-in, sign-up and password reset must send a token. The widget adds it to
// the enclosing form as the hidden field "cf-turnstile-response".
//
// The script is preloaded by the auth layout. If the user submits before the
// check has finished, the submission is held and sent as soon as the token
// arrives, instead of failing.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

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
    script.src = TURNSTILE_SCRIPT_SRC // already in the browser cache thanks to the layout's preload
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
    const form = container.closest("form")
    let widgetId: string | null = null
    let token: string | null = null
    let heldSubmitter: HTMLElement | null | undefined // set while a submit waits for the token
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return
        widgetId = window.turnstile.render(container, {
          sitekey: SITE_KEY,
          theme: "dark",
          language: "fr",
          callback: (t: string) => {
            token = t
            if (heldSubmitter !== undefined && form) {
              const submitter = heldSubmitter
              heldSubmitter = undefined
              form.requestSubmit(submitter instanceof HTMLButtonElement ? submitter : undefined)
            }
          },
          "expired-callback": () => {
            token = null
          },
        })
      })
      .catch((err) => console.error(err))

    // Capture phase: runs before React's form-action handler.
    const onSubmit = (e: SubmitEvent) => {
      if (!token) {
        // Too early: hold the submission until the check finishes
        e.preventDefault()
        e.stopImmediatePropagation()
        heldSubmitter = e.submitter
        return
      }
      // A token is single-use: get a fresh one for a possible next attempt
      // (e.g. wrong password — the page stays mounted).
      token = null
      setTimeout(() => {
        if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
      }, 1000)
    }
    form?.addEventListener("submit", onSubmit, true)

    return () => {
      cancelled = true
      form?.removeEventListener("submit", onSubmit, true)
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [])

  if (!SITE_KEY) return null
  return <div ref={ref} className="flex justify-center min-h-[65px]" />
}

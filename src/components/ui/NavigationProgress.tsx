"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

export default function NavigationProgress() {
  const pathname = usePathname()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function startProgress() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setVisible(true)
    setWidth(12)
    intervalRef.current = setInterval(() => {
      setWidth((w) => {
        if (w >= 85) { clearInterval(intervalRef.current!); return w }
        return w + Math.random() * 12
      })
    }, 300)
  }

  function completeProgress() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setWidth(100)
    hideTimerRef.current = setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, 400)
  }

  // Listen to link clicks to start the bar immediately
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return
      // Same-page navigation — skip
      const url = new URL(href, window.location.href)
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      startProgress()
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [])

  // Complete the bar when the page has loaded (pathname changed)
  useEffect(() => {
    completeProgress()
  }, [pathname])

  if (!visible) return null

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[3px] pointer-events-none"
      style={{
        width: `${width}%`,
        background: "var(--primary)",
        transition: width === 100 ? "width 0.2s ease" : "width 0.3s ease",
        boxShadow: "0 0 8px var(--primary)",
      }}
    />
  )
}

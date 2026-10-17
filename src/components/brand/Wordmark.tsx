import Image from "next/image"
import { cn } from "@/lib/utils"
import onDark from "@/assets/brand/wordmark-light-text.png"
import onLight from "@/assets/brand/wordmark-dark-text.png"

/**
 * The Tomesie logo. Size it with a height class (h-6, h-8…); the width follows.
 * `tone="light"` is the cream version for dark backgrounds (navbar, auth pages, landing page).
 */
export default function Wordmark({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <Image
      src={tone === "light" ? onDark : onLight}
      alt="Tomesie"
      loading="eager"
      className={cn("h-6 w-auto", className)}
    />
  )
}

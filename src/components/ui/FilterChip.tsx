import Link from "next/link"
import { X } from "lucide-react"

interface Props {
  label: string
  href: string
  isActive: boolean
  accent?: boolean
}

export default function FilterChip({ label, href, isActive, accent }: Props) {
  const activeStyle = accent
    ? { background: "var(--secondary-accent)", color: "var(--secondary-accent-foreground)" }
    : { background: "var(--primary)", color: "#fff" }
  const inactiveStyle = { background: "var(--secondary)", color: "var(--foreground)" }

  return (
    <Link
      href={href}
      className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors"
      style={isActive ? activeStyle : inactiveStyle}
    >
      {label}
      {isActive && <X className="h-3.5 w-3.5" />}
    </Link>
  )
}

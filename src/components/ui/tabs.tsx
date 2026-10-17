import Link from "next/link"
import { cn } from "@/lib/utils"

export interface TabItem {
  key: string
  label: string
  href: string
  active: boolean
  count?: number
}

/** Section navigation (Profil · Bibliothèque · …): equal-width segments, the active one raised. */
export function SegmentedTabs({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <nav className={cn("flex gap-1 rounded-xl bg-secondary p-1", className)}>
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "flex-1 rounded-lg py-2 text-center text-xs font-semibold transition-all sm:text-sm",
            t.active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

/** Filter choice within a page (Tous · Lus · En cours · À lire): pills with optional counts. */
export function PillTabs({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <div className={cn("-mx-4 overflow-x-auto scrollbar-hide sm:mx-0", className)}>
      <div className="flex min-w-max gap-2 px-4 sm:px-0">
        {items.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            scroll={false}
            aria-current={t.active ? "true" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors",
              t.active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn("text-xs tabular-nums", t.active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {t.count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

import { SegmentedTabs } from "@/components/ui/tabs"

const SECTIONS = [
  { key: "overview", label: "Vue d'ensemble", href: "/admin" },
  { key: "feedback", label: "Avis", href: "/admin/feedback" },
  { key: "reports", label: "Signalements", href: "/admin/reports" },
  { key: "users", label: "Utilisateurs", href: "/admin/users" },
] as const

export type AdminSection = (typeof SECTIONS)[number]["key"]

/** Title + section tabs shared by the admin pages. */
export default function AdminShell({ active, children }: { active: AdminSection; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Administration</h1>
      <SegmentedTabs items={SECTIONS.map((s) => ({ ...s, active: s.key === active }))} />
      {children}
    </div>
  )
}

/** A white card section with a title. */
export function AdminCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A number with its label, optionally a secondary line ("+3 cette semaine"). */
export function Stat({ label, value, hint, tone }: { label: string; value: number | string; hint?: string; tone?: "alert" }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className={tone === "alert" ? "text-2xl font-extrabold tabular-nums text-primary" : "text-2xl font-extrabold tabular-nums"}>{value}</p>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

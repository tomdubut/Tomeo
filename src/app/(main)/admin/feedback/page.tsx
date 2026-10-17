import Link from "next/link"
import { Bug, Lightbulb, MessageCircle } from "lucide-react"
import { requireAdmin, describeDevice, getAuthUsers } from "@/lib/admin"
import { formatDate } from "@/lib/utils/date"
import { PillTabs } from "@/components/ui/tabs"
import AdminShell from "@/components/admin/AdminShell"
import StatusButtons from "@/components/admin/StatusButtons"
import { setFeedbackStatus } from "../actions"

const STATUSES = [
  { value: "new", label: "Nouveau" },
  { value: "planned", label: "Prévu" },
  { value: "done", label: "Fait" },
  { value: "ignored", label: "Ignoré" },
]
const KIND = {
  bug: { label: "Problème", icon: Bug },
  idea: { label: "Idée", icon: Lightbulb },
  other: { label: "Autre", icon: MessageCircle },
} as const

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminFeedbackPage({ searchParams }: Props) {
  const { admin } = await requireAdmin()
  const { status: rawStatus } = await searchParams
  const status = rawStatus === "all" || STATUSES.some((s) => s.value === rawStatus) ? rawStatus! : "new"

  let query = admin
    .from("feedback")
    .select("id, kind, message, page, user_agent, viewport, status, created_at, user_id, profile:profiles(username)")
    .order("created_at", { ascending: false })
    .limit(200)
  if (status !== "all") query = query.eq("status", status)

  const [{ data: rows }, { data: allStatuses }, authUsers] = await Promise.all([
    query,
    admin.from("feedback").select("status"),
    getAuthUsers(admin),
  ])
  const counts = new Map<string, number>()
  for (const r of allStatuses ?? []) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)

  return (
    <AdminShell active="feedback">
      <PillTabs
        items={[
          ...STATUSES.map((s) => ({ key: s.value, label: s.label, href: `/admin/feedback?status=${s.value}`, active: status === s.value, count: counts.get(s.value) ?? 0 })),
          { key: "all", label: "Tous", href: "/admin/feedback?status=all", active: status === "all", count: allStatuses?.length ?? 0 },
        ]}
      />

      {(rows ?? []).length === 0 ? (
        <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">Aucun message ici.</p>
      ) : (
        <ul className="space-y-3">
          {(rows ?? []).map((f) => {
            const kind = KIND[f.kind as keyof typeof KIND] ?? KIND.other
            const Icon = kind.icon
            const profile = f.profile as unknown as { username: string } | null
            const email = f.user_id ? authUsers.get(f.user_id)?.email : null
            const device = [describeDevice(f.user_agent), f.viewport].filter(Boolean).join(" · ")
            return (
              <li key={f.id} className="rounded-2xl bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Icon className="h-3.5 w-3.5" />{kind.label}</span>
                  <span>{formatDate(f.created_at)}</span>
                  {profile ? <Link href={`/users/${profile.username}`} className="font-medium hover:underline">@{profile.username}</Link> : <span>Compte supprimé</span>}
                  {email && <a href={`mailto:${email}?subject=${encodeURIComponent("Votre avis sur Tomesie")}`} className="hover:underline">{email}</a>}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{f.message}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {f.page && (/^\/(?![/\\])/.test(f.page)
                      ? <Link href={f.page} className="font-mono hover:underline">{f.page}</Link>
                      : <span className="font-mono">{f.page}</span>)}
                    {device && <span>{f.page ? " · " : ""}{device}</span>}
                  </p>
                  <StatusButtons id={f.id} status={f.status} options={STATUSES} save={setFeedbackStatus} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </AdminShell>
  )
}

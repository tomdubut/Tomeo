import Link from "next/link"
import { requireAdmin, REPORT_REASON_LABELS } from "@/lib/admin"
import { formatDate } from "@/lib/utils/date"
import { PillTabs } from "@/components/ui/tabs"
import AdminShell from "@/components/admin/AdminShell"
import StatusButtons from "@/components/admin/StatusButtons"
import { setReportStatus } from "../actions"

const STATUSES = [
  { value: "new", label: "Nouveau" },
  { value: "fixed", label: "Corrigé" },
  { value: "ignored", label: "Ignoré" },
]

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminReportsPage({ searchParams }: Props) {
  const { admin } = await requireAdmin()
  const { status: rawStatus } = await searchParams
  const status = rawStatus === "all" || STATUSES.some((s) => s.value === rawStatus) ? rawStatus! : "new"

  let query = admin
    .from("content_reports")
    .select("id, content_type, reason, note, status, created_at, book:books(id, title), manga:manga_series(id, title_fr), profile:profiles(username)")
    .order("created_at", { ascending: false })
    .limit(200)
  if (status !== "all") query = query.eq("status", status)

  const [{ data: rows }, { data: allStatuses }] = await Promise.all([query, admin.from("content_reports").select("status")])
  const counts = new Map<string, number>()
  for (const r of allStatuses ?? []) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)

  return (
    <AdminShell active="reports">
      <PillTabs
        items={[
          ...STATUSES.map((s) => ({ key: s.value, label: s.label, href: `/admin/reports?status=${s.value}`, active: status === s.value, count: counts.get(s.value) ?? 0 })),
          { key: "all", label: "Tous", href: "/admin/reports?status=all", active: status === "all", count: allStatuses?.length ?? 0 },
        ]}
      />

      {(rows ?? []).length === 0 ? (
        <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">Aucun signalement ici.</p>
      ) : (
        <ul className="space-y-3">
          {(rows ?? []).map((r) => {
            const book = r.book as unknown as { id: string; title: string } | null
            const manga = r.manga as unknown as { id: string; title_fr: string } | null
            const profile = r.profile as unknown as { username: string } | null
            const target = book
              ? { href: `/books/${book.id}`, title: book.title, type: "Livre" }
              : manga
                ? { href: `/manga/${manga.id}`, title: manga.title_fr, type: "Manga" }
                : null
            return (
              <li key={r.id} className="rounded-2xl bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</span>
                  <span>{formatDate(r.created_at)}</span>
                  {profile ? <Link href={`/users/${profile.username}`} className="font-medium hover:underline">@{profile.username}</Link> : <span>Compte supprimé</span>}
                </div>
                <p className="mt-2 text-sm">
                  {target ? (
                    <>
                      <span className="text-muted-foreground">{target.type} · </span>
                      <Link href={target.href} className="font-semibold hover:underline">{target.title}</Link>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Élément supprimé</span>
                  )}
                </p>
                {r.note && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{r.note}</p>}
                <div className="mt-3 flex justify-end">
                  <StatusButtons id={r.id} status={r.status} options={STATUSES} save={setReportStatus} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </AdminShell>
  )
}

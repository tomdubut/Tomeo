import Link from "next/link"
import { requireAdmin, getAuthUsers } from "@/lib/admin"
import { formatDate } from "@/lib/utils/date"
import AdminShell from "@/components/admin/AdminShell"
import UserAvatar from "@/components/ui/UserAvatar"

const MEDIA_LABEL: Record<string, string> = { books: "Livres", manga: "Manga", both: "Les deux" }

function countBy(rows: { user_id: string }[] | null) {
  const map = new Map<string, number>()
  for (const r of rows ?? []) map.set(r.user_id, (map.get(r.user_id) ?? 0) + 1)
  return map
}

export default async function AdminUsersPage() {
  const { admin } = await requireAdmin()

  const [{ data: profiles }, authUsers, { data: books }, { data: manga }, { data: reviews }, { data: mangaReviews }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, profile_color, created_at, preferred_media, is_public")
      .order("created_at", { ascending: false })
      .limit(500),
    getAuthUsers(admin),
    admin.from("user_books").select("user_id").limit(20000),
    admin.from("user_manga").select("user_id").limit(20000),
    admin.from("reviews").select("user_id").limit(20000),
    admin.from("manga_reviews").select("user_id").limit(20000),
  ])
  const bookCounts = countBy(books)
  const mangaCounts = countBy(manga)
  const reviewCounts = countBy([...(reviews ?? []), ...(mangaReviews ?? [])])
  // Signed up but never finished onboarding (no profile): worth a personal email
  const profileIds = new Set((profiles ?? []).map((p) => p.id))
  const unfinished = [...authUsers.entries()]
    .filter(([id]) => !profileIds.has(id))
    .map(([id, a]) => ({ id, ...a }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))

  return (
    <AdminShell active="users">
      {unfinished.length > 0 && (
        <section className="rounded-2xl bg-card p-5 shadow-card">
          <h2 className="font-extrabold">Inscriptions non terminées</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Compte créé mais profil jamais complété (onboarding). Un petit email personnel peut les faire revenir.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {unfinished.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                {u.email ? (
                  <a
                    href={`mailto:${u.email}?subject=${encodeURIComponent("Votre inscription sur Tomesie")}`}
                    className="font-semibold hover:underline"
                  >
                    {u.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Sans email</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {u.createdAt && `inscrit ${formatDate(u.createdAt)}`}
                  {u.lastSignIn && ` · vu ${formatDate(u.lastSignIn)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-muted-foreground">{profiles?.length ?? 0} profils</p>
      <ul className="divide-y divide-border rounded-2xl bg-card shadow-card">
        {(profiles ?? []).map((p) => {
          const auth = authUsers.get(p.id)
          return (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar profile={p} className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <Link href={`/users/${p.username}`} className="font-semibold hover:underline">{p.display_name ?? p.username}</Link>
                  <span className="text-muted-foreground"> @{p.username}</span>
                  {!p.is_public && <span className="text-muted-foreground"> · privé</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {auth?.email ?? "—"} · inscrit {formatDate(p.created_at)}
                  {auth?.lastSignIn && ` · vu ${formatDate(auth.lastSignIn)}`}
                  {p.preferred_media && ` · ${MEDIA_LABEL[p.preferred_media] ?? p.preferred_media}`}
                </p>
              </div>
              <div className="hidden shrink-0 gap-4 text-right text-xs text-muted-foreground tabular-nums sm:flex">
                <span><span className="font-bold text-foreground">{bookCounts.get(p.id) ?? 0}</span> livres</span>
                <span><span className="font-bold text-foreground">{mangaCounts.get(p.id) ?? 0}</span> manga</span>
                <span><span className="font-bold text-foreground">{reviewCounts.get(p.id) ?? 0}</span> critiques</span>
              </div>
            </li>
          )
        })}
      </ul>
    </AdminShell>
  )
}

import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { formatDate } from "@/lib/utils/date"
import AdminShell, { AdminCard, Stat } from "@/components/admin/AdminShell"

/** ISO date n days ago (called after requireAdmin, so the page is already dynamic). */
function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

export default async function AdminOverviewPage() {
  const { admin } = await requireAdmin()
  const week = daysAgo(7)
  const month = daysAgo(30)
  const count = { count: "exact", head: true } as const

  const [
    users, usersWeek, usersMonth, activity,
    books, manga, booksWeek,
    reviewsWeek, mangaReviewsWeek, ratingsWeek, libraryWeek, mangaLibraryWeek,
    feedbackNew, reportsNew,
    smallCovers, noDescription, bookIds, genreBookIds, mangaNoCover, mangaNeedsReview, lastVolumeCheck,
    recentUsers, recentReviews,
  ] = await Promise.all([
    admin.from("profiles").select("id", count),
    admin.from("profiles").select("id", count).gte("created_at", week),
    admin.from("profiles").select("id", count).gte("created_at", month),
    admin.from("activity_feed").select("actor_id").gte("created_at", week).limit(10000),
    admin.from("books").select("id", count),
    admin.from("manga_series").select("id", count),
    admin.from("books").select("id", count).gte("created_at", week),
    admin.from("reviews").select("id", count).gte("created_at", week),
    admin.from("manga_reviews").select("id", count).gte("created_at", week),
    admin.from("ratings").select("user_id", count).gte("created_at", week),
    admin.from("user_books").select("user_id", count).gte("created_at", week),
    admin.from("user_manga").select("user_id", count).gte("created_at", week),
    admin.from("feedback").select("id", count).eq("status", "new"),
    admin.from("content_reports").select("id", count).eq("status", "new"),
    admin.from("books").select("id", count).like("cover_url", "%zoom=1%").not("cover_url", "like", "%fife=%"),
    admin.from("books").select("id", count).is("description", null),
    admin.from("books").select("id").limit(20000),
    admin.from("book_genres").select("book_id").limit(50000),
    admin.from("manga_series").select("id", count).is("cover_url", null),
    admin.from("manga_series").select("id", count).eq("needs_review", true),
    admin.from("manga_series").select("volumes_checked_at").not("volumes_checked_at", "is", null).order("volumes_checked_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("profiles").select("username, display_name, created_at").order("created_at", { ascending: false }).limit(5),
    admin.from("reviews").select("id, body, created_at, book:books(id, title), profile:profiles!reviews_user_id_fkey(username)").order("created_at", { ascending: false }).limit(5),
  ])

  const activeWeek = new Set((activity.data ?? []).map((a) => a.actor_id)).size
  const withGenre = new Set((genreBookIds.data ?? []).map((g) => g.book_id))
  const noGenre = (bookIds.data ?? []).filter((b) => !withGenre.has(b.id)).length
  const n = (r: { count: number | null }) => r.count ?? 0

  return (
    <AdminShell active="overview">
      {(n(feedbackNew) > 0 || n(reportsNew) > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {n(feedbackNew) > 0 && (
            <Link href="/admin/feedback" className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-card transition-opacity hover:opacity-90">
              <p className="text-2xl font-extrabold tabular-nums">{n(feedbackNew)}</p>
              <p className="text-sm font-semibold">avis à lire →</p>
            </Link>
          )}
          {n(reportsNew) > 0 && (
            <Link href="/admin/reports" className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-card transition-opacity hover:opacity-90">
              <p className="text-2xl font-extrabold tabular-nums">{n(reportsNew)}</p>
              <p className="text-sm font-semibold">signalement{n(reportsNew) > 1 ? "s" : ""} à traiter →</p>
            </Link>
          )}
        </div>
      )}

      <AdminCard title="Utilisateurs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Inscrits" value={n(users)} />
          <Stat label="Nouveaux (7 j)" value={n(usersWeek)} />
          <Stat label="Nouveaux (30 j)" value={n(usersMonth)} />
          <Stat label="Actifs (7 j)" value={activeWeek} hint="ont ajouté, noté ou critiqué" />
        </div>
      </AdminCard>

      <AdminCard title="Activité (7 derniers jours)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Ajouts en bibliothèque" value={n(libraryWeek) + n(mangaLibraryWeek)} hint={`${n(libraryWeek)} livre${n(libraryWeek) > 1 ? "s" : ""} · ${n(mangaLibraryWeek)} manga`} />
          <Stat label="Critiques" value={n(reviewsWeek) + n(mangaReviewsWeek)} />
          <Stat label="Notes (livres)" value={n(ratingsWeek)} />
          <Stat label="Livres ajoutés au catalogue" value={n(booksWeek)} />
        </div>
      </AdminCard>

      <AdminCard title="Catalogue">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Livres" value={n(books)} />
          <Stat label="Séries manga" value={n(manga)} />
          <Stat href="/admin/catalogue?issue=book-no-genre" label="Livres sans genre" value={noGenre} tone={noGenre > 0 ? "alert" : undefined} />
          <Stat href="/admin/catalogue?issue=book-blurry" label="Couvertures floues" value={n(smallCovers)} tone={n(smallCovers) > 0 ? "alert" : undefined} />
          <Stat href="/admin/catalogue?issue=book-no-summary" label="Livres sans résumé" value={n(noDescription)} tone={n(noDescription) > 0 ? "alert" : undefined} />
          <Stat href="/admin/catalogue?issue=manga-no-cover" label="Manga sans couverture" value={n(mangaNoCover)} tone={n(mangaNoCover) > 0 ? "alert" : undefined} />
          <Stat href="/admin/catalogue?issue=manga-review" label="Manga à vérifier" value={n(mangaNeedsReview)} tone={n(mangaNeedsReview) > 0 ? "alert" : undefined} />
          <Stat
            label="Vérif. des tomes"
            value={lastVolumeCheck.data?.volumes_checked_at ? formatDate(lastVolumeCheck.data.volumes_checked_at) : "jamais"}
            hint="tâche quotidienne"
          />
        </div>
      </AdminCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="Dernières inscriptions" action={<Link href="/admin/users" className="text-sm font-semibold text-primary hover:underline">Tout voir</Link>}>
          <ul className="space-y-2 text-sm">
            {(recentUsers.data ?? []).map((u) => (
              <li key={u.username} className="flex justify-between gap-3">
                <Link href={`/users/${u.username}`} className="truncate font-semibold hover:underline">{u.display_name ?? u.username}</Link>
                <span className="shrink-0 text-muted-foreground">{formatDate(u.created_at)}</span>
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard title="Dernières critiques">
          <ul className="space-y-3 text-sm">
            {(recentReviews.data ?? []).map((r) => {
              const book = r.book as unknown as { id: string; title: string } | null
              const profile = r.profile as unknown as { username: string } | null
              return (
                <li key={r.id}>
                  <p className="text-xs text-muted-foreground">
                    @{profile?.username ?? "?"} sur{" "}
                    {book ? <Link href={`/books/${book.id}`} className="font-semibold text-foreground hover:underline">{book.title}</Link> : "?"}
                    {" · "}{formatDate(r.created_at)}
                  </p>
                  <p className="line-clamp-2">{r.body}</p>
                </li>
              )
            })}
          </ul>
        </AdminCard>
      </div>
    </AdminShell>
  )
}

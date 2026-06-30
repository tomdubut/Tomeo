# Tomeo

A French social reading platform — track books you've read, rate and review them, follow other readers, and build reading lists. Think Goodreads / Babelio, built with Next.js and Supabase.

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions)
- **Supabase** (Postgres, Auth, Row Level Security)
- **Tailwind CSS v4**
- **Google Books API** for book search and metadata

## Project structure

```
src/
  app/                  # Next.js App Router
    (auth)/             # Login / register pages
    (main)/             # Authenticated app shell
      books/            # Catalogue, search, book detail
      feed/             # Social feed
      lists/            # Reading lists
      me/               # Own profile
      users/            # Public user profiles
    api/search/         # Search endpoint (Google Books + local DB)
    onboarding/         # New user setup flow
  components/
    books/              # BookCover, BookCard, RatingSection, AddToLibraryButton…
    reviews/            # ReviewForm, ReviewCard, StarRating, modals…
    lists/              # List display and management
    profile/            # ProfileHeader
    ui/                 # Shared primitives (Button, Avatar…)
  lib/
    api/                # google-books.ts, openlibrary.ts
    search/             # Scoring and relevance logic
    supabase/           # Client helpers, cached queries
    types.ts            # Shared TypeScript types (Profile, Book, Review…)
    utils/              # cn, date, dropdown helpers
  supabase/migrations/  # Ordered SQL migrations (001_users … 010_…)
  scripts/              # seed-test-data.ts, backfill scripts
```

## Local setup

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [Google Books API key](https://console.cloud.google.com/apis/credentials)

### 2. Clone and install

```bash
git clone <repo-url>
cd Tomeo
npm install
```

### 3. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key (keep secret) |
| `GOOGLE_BOOKS_API_KEY` | Google Cloud Console → APIs & Services → Credentials |
| `SEED_USER_ID` | Supabase → Authentication → Users → copy your test user UUID (seed script only) |

### 4. Database migrations

Run all migrations in order against your Supabase project using the Supabase CLI:

```bash
npx supabase db push
```

Or apply them manually in the Supabase SQL editor — files are in `supabase/migrations/`, numbered `001` to `010`.

Migrations create: users/profiles, books, authors, genres, user_books (library), ratings, reviews, comments, lists, follows, and the genres seed data.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Seed test data (optional)

Create a user via the Supabase Auth dashboard, copy their UUID into `SEED_USER_ID`, then:

```bash
npm run seed
```

This populates the DB with sample books, ratings, and reviews for local development.

## Key patterns

**Data fetching** — Server Components fetch data directly. User-specific data (ratings, library status) is always fetched fresh via `createClient()`. Public data (book metadata, community reviews) is cached with `unstable_cache` / `cacheLife` in `src/lib/supabase/queries.ts`.

**Mutations** — All writes go through Server Actions in `src/app/(main)/*/actions.ts`. Each action validates input, checks auth, writes to Supabase, and calls `revalidatePath` or `revalidateTag` to bust the cache.

**Book import** — Books are imported from Google Books on first view (`importBook` action). Open Library is used as a fallback for cover images and extra metadata.

**Authentication** — Supabase Auth with SSR cookie handling (`@supabase/ssr`). Row Level Security is enforced at the DB level for all user data.

## Available scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
npm run seed     # Seed test data (requires SEED_USER_ID in .env.local)
```

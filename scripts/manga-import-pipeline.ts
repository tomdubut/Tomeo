/**
 * ============================================================================
 * TOMESIE — MANGA SERIES IMPORT PIPELINE (single-file version)
 * ============================================================================
 *
 * ORDER OF TRUTH:
 * 1. French publisher catalog pages are the ONLY source of which series
 *    exist in your database.
 * 2. AniList is ENRICHMENT ONLY (cover fallback, synopsis, JP volume count,
 *    AniList ID) — it never decides whether a series gets added.
 * 3. Full French volume/ISBN/release-date data is separate, manual,
 *    publisher-page work — not part of this script.
 *
 * BEFORE RUNNING:
 * - Check each publisher's robots.txt and Terms of Use for restrictions on
 *   automated collection of catalog listings. Only flip `tosChecked: true`
 *   below after you've personally verified this per publisher.
 * - Inspect each publisher's live catalog page (browser devtools) and
 *   replace the `seriesLinkSelector: 'TODO'` placeholders with the real
 *   CSS selector for series entries on that page (~10 min per site).
 *
 * SETUP:
 *   npm install cheerio string-similarity @supabase/supabase-js dotenv
 *   npx tsx run
 * (If a publisher's catalog is JS-rendered, that publisher needs a
 *  Playwright-based fetch instead — this script only handles static HTML.)
 *
 * .env required:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (service role — this is a trusted script)
 * ============================================================================
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as cheerio from 'cheerio';
import stringSimilarity from 'string-similarity';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// 1. CONFIG — publisher list + tuning constants
// ============================================================================

interface PublisherConfig {
  name: string;
  catalogUrl: string;
  seriesLinkSelector: string; // TODO: fill in per publisher after inspecting the page
  titleAttr: 'text' | string; // 'text' = element text, or an attribute name like 'title'
  requiresBrowserRender: boolean; // true if content is JS-rendered (not handled here)
  tosChecked: boolean; // flip to true only after personally verifying robots.txt / ToS
  // If set, fetch this XML sitemap instead of scraping catalogUrl HTML.
  // The regex must capture the series slug in group 1.
  sitemapProductsUrl?: string;
  sitemapSlugPattern?: RegExp;
}

const PUBLISHERS: PublisherConfig[] = [
  {
    name: 'Glénat',
    // Catalog is JS-rendered (Next.js app); series data comes from their products.xml sitemap.
    // robots.txt does not disallow /glenat-manga/ or the sitemap. tosChecked: true.
    catalogUrl: 'https://www.glenat.com/manga/series/',
    seriesLinkSelector: 'N/A',
    titleAttr: 'text',
    requiresBrowserRender: false,
    tosChecked: true,
    sitemapProductsUrl: 'https://www.glenat.com/products.xml',
    sitemapSlugPattern: /\/glenat-manga\/([^/"<\s]+)/,
  },
  {
    name: 'Pika Édition',
    catalogUrl: 'https://www.pika.fr/',
    seriesLinkSelector: 'TODO',
    titleAttr: 'text',
    requiresBrowserRender: false,
    tosChecked: false,
  },
  {
    name: 'Kana',
    catalogUrl: 'https://www.kana.fr/',
    seriesLinkSelector: 'TODO',
    titleAttr: 'text',
    requiresBrowserRender: false,
    tosChecked: false,
  },
  {
    name: 'Ki-oon',
    catalogUrl: 'http://www.ki-oon.com/mangas/',
    seriesLinkSelector: 'TODO',
    titleAttr: 'text',
    requiresBrowserRender: false,
    tosChecked: false,
  },
  {
    name: 'Kurokawa',
    catalogUrl: 'https://www.kurokawa.fr/',
    seriesLinkSelector: 'TODO',
    titleAttr: 'text',
    requiresBrowserRender: false,
    tosChecked: false,
  },
  {
    name: 'Panini Manga',
    catalogUrl: 'https://www.paninimanga.fr/',
    seriesLinkSelector: 'TODO',
    titleAttr: 'text',
    requiresBrowserRender: false,
    tosChecked: false,
  },
  {
    name: 'Delcourt/Tonkam',
    catalogUrl: 'https://www.delcourt.fr/',
    seriesLinkSelector: 'TODO',
    titleAttr: 'text',
    requiresBrowserRender: false,
    tosChecked: false,
  },
  {
    name: 'Soleil Manga',
    catalogUrl: 'https://www.soleilmanga.com/',
    seriesLinkSelector: 'TODO',
    titleAttr: 'text',
    requiresBrowserRender: false,
    tosChecked: false,
  },
];

// AniList match confidence threshold — below this, flag for manual review
// instead of auto-attaching the anilist_id. Tune after your first run.
const ANILIST_MATCH_THRESHOLD = 0.75;

// Dedup thresholds — see deduplicateSeries() below.
const DEDUP_REVIEW_THRESHOLD = 0.85; // above this, auto-merge but flag for review
const DEDUP_IGNORE_BELOW = 0.6; // below this, treat as genuinely different series

// ============================================================================
// 2. SCRAPE — pull series names off each publisher's catalog page
// ============================================================================

interface RawSeriesEntry {
  title: string;
  publisher: string;
  sourceUrl: string;
}

async function scrapeViaSitemap(publisher: PublisherConfig): Promise<RawSeriesEntry[]> {
  const res = await fetch(publisher.sitemapProductsUrl!, {
    headers: { 'User-Agent': 'Tomesie-CatalogBot/1.0 (contact: you@tomesie.com)' },
  });
  if (!res.ok) throw new Error(`Failed to fetch sitemap ${publisher.sitemapProductsUrl}: ${res.status}`);
  const xml = await res.text();

  const slugs = new Set<string>();
  const re = new RegExp(publisher.sitemapSlugPattern!.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const slug = match[1]
      .replace(/-tome-\d.*/i, '')
      .replace(/-9782\d*/i, '')
      .trim();
    if (slug) slugs.add(slug);
  }

  return Array.from(slugs).map((slug) => ({
    title: slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .replace(/[^\x00-\xFF]/g, ''), // strip non-latin characters that break HTTP headers
    publisher: publisher.name,
    sourceUrl: publisher.sitemapProductsUrl!,
  }));
}

async function scrapePublisherCatalog(publisher: PublisherConfig): Promise<RawSeriesEntry[]> {
  if (publisher.sitemapProductsUrl && publisher.sitemapSlugPattern) {
    return scrapeViaSitemap(publisher);
  }

  if (!publisher.tosChecked) {
    throw new Error(
      `Skipping ${publisher.name}: tosChecked is false. Verify robots.txt / Terms of Use first.`
    );
  }
  if (publisher.seriesLinkSelector === 'TODO') {
    throw new Error(
      `Skipping ${publisher.name}: seriesLinkSelector is still a placeholder — inspect the page and fill it in.`
    );
  }
  if (publisher.requiresBrowserRender) {
    throw new Error(
      `${publisher.name} is JS-rendered — this script only handles static HTML. Use Playwright for this one.`
    );
  }

  const res = await fetch(publisher.catalogUrl, {
    headers: { 'User-Agent': 'Tomesie-CatalogBot/1.0 (contact: you@tomesie.com)' },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${publisher.catalogUrl}: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const entries: RawSeriesEntry[] = [];

  $(publisher.seriesLinkSelector).each((_, el) => {
    const title =
      publisher.titleAttr === 'text'
        ? $(el).text().trim()
        : ($(el).attr(publisher.titleAttr) || '').trim();
    if (title) entries.push({ title, publisher: publisher.name, sourceUrl: publisher.catalogUrl });
  });

  return entries;
}

async function scrapeAllPublishers(
  publishers: PublisherConfig[]
): Promise<{ entries: RawSeriesEntry[]; errors: string[] }> {
  const entries: RawSeriesEntry[] = [];
  const errors: string[] = [];

  for (const publisher of publishers) {
    try {
      const result = await scrapePublisherCatalog(publisher);
      entries.push(...result);
      console.log(`✓ ${publisher.name}: ${result.length} series found`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${publisher.name}: ${message}`);
      console.warn(`✗ ${publisher.name} skipped — ${message}`);
    }
  }

  return { entries, errors };
}

// ============================================================================
// 3. NORMALIZE — clean titles, merge near-duplicates across publishers
// ============================================================================

interface NormalizedSeries {
  canonicalTitle: string;
  publisher: string;
  sourceTitles: string[];
  needsReview: boolean;
}

function normalizeTitle(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/\b(tome|t\.?|vol\.?|volume)\s*\d+\b/gi, '') // drop tome/vol numbers
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deduplicateSeries(raw: RawSeriesEntry[]): NormalizedSeries[] {
  const groups: NormalizedSeries[] = [];

  for (const entry of raw) {
    const normalized = normalizeTitle(entry.title);
    let matched = false;

    for (const group of groups) {
      const similarity = stringSimilarity.compareTwoStrings(normalized, normalizeTitle(group.canonicalTitle));

      if (similarity === 1) {
        group.sourceTitles.push(entry.title);
        matched = true;
        break;
      } else if (similarity >= DEDUP_REVIEW_THRESHOLD) {
        group.sourceTitles.push(entry.title);
        group.needsReview = true; // fuzzy merge — confirm by hand later
        matched = true;
        break;
      } else if (similarity >= DEDUP_IGNORE_BELOW) {
        continue; // ambiguous zone — not confident enough either way, treat as separate
      }
    }

    if (!matched) {
      groups.push({
        canonicalTitle: entry.title,
        publisher: entry.publisher,
        sourceTitles: [entry.title],
        needsReview: false,
      });
    }
  }

  return groups;
}

// ============================================================================
// 4. ANILIST — enrichment lookup with confidence scoring (never the source)
// ============================================================================

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const ANILIST_QUERY = `
query ($search: String) {
  Media(search: $search, type: MANGA) {
    id
    title { romaji english native }
    volumes
    status
    description(asHtml: false)
    coverImage { large }
  }
}
`;

interface AniListMatch {
  anilistId: number | null;
  jpVolumeCount: number | null;
  coverUrl: string | null;
  description: string | null;
  confidence: number;
  needsReview: boolean;
}

async function matchAniList(seriesTitle: string): Promise<AniListMatch> {
  const res = await fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: seriesTitle } }),
  });

  if (!res.ok) {
    if (res.status === 404) {
      return { anilistId: null, jpVolumeCount: null, coverUrl: null, description: null, confidence: 0, needsReview: true };
    }
    // Rate limit is 90 req/min — if you hit 429, increase the delay in runPipeline().
    throw new Error(`AniList request failed for "${seriesTitle}": ${res.status}`);
  }

  const json = await res.json();
  const media = json?.data?.Media;

  if (!media) {
    return { anilistId: null, jpVolumeCount: null, coverUrl: null, description: null, confidence: 0, needsReview: true };
  }

  const candidates = [media.title.romaji, media.title.english, media.title.native].filter(Boolean) as string[];
  const bestScore = Math.max(
    ...candidates.map((c) => stringSimilarity.compareTwoStrings(seriesTitle.toLowerCase(), c.toLowerCase()))
  );

  return {
    anilistId: media.id,
    jpVolumeCount: media.volumes ?? null,
    coverUrl: media.coverImage?.large ?? null,
    description: media.description ?? null,
    confidence: bestScore,
    needsReview: bestScore < ANILIST_MATCH_THRESHOLD,
  };
}

// ============================================================================
// 5. SUPABASE — insert identity-only series records
// ============================================================================
// Expects a `series` table shaped roughly like:
//   id               uuid primary key default gen_random_uuid()
//   title_fr         text        -- from the French publisher, source of truth
//   publisher        text
//   anilist_id       int null    -- enrichment reference only
//   jp_volume_count  int null    -- AniList's original-run count, informational
//   cover_url        text null   -- fallback only; real FR covers come later, per-volume
//   description      text null
//   needs_review     boolean default false
//   source           text        -- e.g. 'publisher_catalog'
// Adjust field names / onConflict target to match your actual schema.

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function insertSeriesRecord(series: NormalizedSeries, aniList: AniListMatch | null) {
  const { error } = await supabase.from('series').upsert(
    {
      title_fr: series.canonicalTitle,
      publisher: series.publisher,
      anilist_id: aniList?.anilistId ?? null,
      jp_volume_count: aniList?.jpVolumeCount ?? null,
      cover_url: aniList?.coverUrl ?? null,
      description: aniList?.description ?? null,
      needs_review: series.needsReview || (aniList?.needsReview ?? true),
      source: 'publisher_catalog',
    },
    { onConflict: 'title_fr,publisher' }
  );

  if (error) throw new Error(`Failed to insert "${series.canonicalTitle}": ${error.message}`);
}

// ============================================================================
// 6. ORCHESTRATION — run the whole pipeline end to end
// ============================================================================

interface ReviewItem {
  title: string;
  publisher: string;
  reason: string;
  anilistConfidence?: number;
}

async function runPipeline() {
  console.log('--- Step 1-2: scraping French publisher catalogs ---');
  const { entries, errors } = await scrapeAllPublishers(PUBLISHERS);

  if (errors.length > 0) {
    console.warn(`\n${errors.length} publisher(s) skipped:`);
    errors.forEach((e) => console.warn(`  - ${e}`));
  }
  if (entries.length === 0) {
    console.error('No series scraped. Fix selectors/tosChecked flags above before continuing.');
    return;
  }

  console.log(`\n--- Step 3: deduplicating ${entries.length} raw entries ---`);
  const uniqueSeries = deduplicateSeries(entries);
  console.log(`${uniqueSeries.length} unique series after dedup`);

  const reviewQueue: ReviewItem[] = [];

  console.log('\n--- Step 4-5: AniList enrichment + Supabase insert ---');
  for (const series of uniqueSeries) {
    if (series.needsReview) {
      reviewQueue.push({
        title: series.canonicalTitle,
        publisher: series.publisher,
        reason: 'fuzzy title merge during dedup — confirm these are the same series',
      });
    }

    let aniListResult: AniListMatch | null;
    try {
      aniListResult = await matchAniList(series.canonicalTitle);
    } catch (err) {
      console.warn(`AniList lookup failed for "${series.canonicalTitle}":`, err);
      aniListResult = null;
    }

    if (aniListResult?.needsReview) {
      reviewQueue.push({
        title: series.canonicalTitle,
        publisher: series.publisher,
        reason: 'low-confidence or missing AniList match',
        anilistConfidence: aniListResult.confidence,
      });
    }

    await insertSeriesRecord(series, aniListResult);
    await new Promise((r) => setTimeout(r, 800)); // stay comfortably under AniList's 90 req/min
  }

  fs.writeFileSync('review-queue.json', JSON.stringify(reviewQueue, null, 2));

  console.log(`\nDone. ${uniqueSeries.length} series inserted.`);
  console.log(`${reviewQueue.length} items need manual review — see review-queue.json`);
  console.log('Do not treat a completed run as finished until you\'ve checked that file.');
}

runPipeline().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});

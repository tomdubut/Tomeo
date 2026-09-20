/**
 * ============================================================================
 * TOMESIE — MANGA SERIES IMPORT PIPELINE
 * ============================================================================
 *
 * ORDER OF TRUTH:
 * 1. Glénat product pages are the PRIMARY data source (French title, author,
 *    description in French, FR cover, FR volume count).
 * 2. AniList is SECONDARY — only used to get anilist_id for cross-referencing.
 *    AniList content fields (English description, JP cover) are NOT stored.
 * 3. The products.xml sitemap tells us which series exist and gives us the
 *    first-volume URL to fetch.
 *
 * SETUP:
 *   npm install cheerio string-similarity @supabase/supabase-js dotenv
 *   cp .env.local .env   (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *
 * RUN:
 *   npx tsx scripts/manga-import-pipeline.ts
 *
 * PROBE MODE (prints NEXT_DATA for 3 series then exits — run this first to
 * verify field paths before a full import):
 *   PROBE_GLENAT=1 npx tsx scripts/manga-import-pipeline.ts
 * ============================================================================
 */

import 'dotenv/config';
import * as fs from 'fs';
import stringSimilarity from 'string-similarity';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// 1. CONFIG
// ============================================================================

interface PublisherConfig {
  name: string;
  tosChecked: boolean;
  sitemapProductsUrl?: string;
  sitemapSlugPattern?: RegExp;
  productBaseUrl?: string; // base URL for individual product pages
}

const PUBLISHERS: PublisherConfig[] = [
  {
    name: 'Glénat',
    tosChecked: true,
    sitemapProductsUrl: 'https://www.glenat.com/products.xml',
    sitemapSlugPattern: /\/glenat-manga\/([^/"<\s]+)/,
    productBaseUrl: 'https://www.glenat.com/glenat-manga/',
  },
];

const ANILIST_MATCH_THRESHOLD = 0.75;
const DEDUP_REVIEW_THRESHOLD = 0.85;
const DEDUP_IGNORE_BELOW = 0.6;

// ============================================================================
// 2. SITEMAP — extract series slugs AND first-volume product URL
// ============================================================================

interface RawSeriesEntry {
  title: string;       // title-cased from series slug, used for dedup + AniList search
  publisher: string;
  sourceUrl: string;
  productUrl?: string; // first-volume Glénat product page URL
}

async function scrapeViaSitemap(publisher: PublisherConfig): Promise<RawSeriesEntry[]> {
  const res = await fetch(publisher.sitemapProductsUrl!, {
    headers: { 'User-Agent': 'Tomesie-CatalogBot/1.0 (contact: tomvmauri@gmail.com)' },
  });
  if (!res.ok) throw new Error(`Failed to fetch sitemap ${publisher.sitemapProductsUrl}: ${res.status}`);
  const xml = await res.text();

  // Track the lowest tome number seen per series so we fetch tome 1's product page
  const seriesMap = new Map<string, { fullSlug: string; tomeNum: number }>();
  const re = new RegExp(publisher.sitemapSlugPattern!.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(xml)) !== null) {
    const fullSlug = match[1]; // e.g. "naruto-tome-1-9782723445405"
    const tomeMatch = fullSlug.match(/-tome-(\d+)/i);
    const tomeNum = tomeMatch ? parseInt(tomeMatch[1], 10) : 999;
    const seriesSlug = fullSlug
      .replace(/-tome-\d.*/i, '')
      .replace(/-9782\d*/i, '')
      .trim();
    if (!seriesSlug) continue;

    const existing = seriesMap.get(seriesSlug);
    if (!existing || tomeNum < existing.tomeNum) {
      seriesMap.set(seriesSlug, { fullSlug, tomeNum });
    }
  }

  return Array.from(seriesMap.entries()).map(([seriesSlug, { fullSlug }]) => ({
    title: seriesSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .replace(/[^\x00-\xFF]/g, ''),
    publisher: publisher.name,
    sourceUrl: publisher.sitemapProductsUrl!,
    productUrl: publisher.productBaseUrl ? `${publisher.productBaseUrl}${fullSlug}/` : undefined,
  }));
}

async function scrapeAllPublishers(
  publishers: PublisherConfig[]
): Promise<{ entries: RawSeriesEntry[]; errors: string[] }> {
  const entries: RawSeriesEntry[] = [];
  const errors: string[] = [];

  for (const publisher of publishers) {
    if (!publisher.tosChecked) {
      errors.push(`${publisher.name}: tosChecked is false — verify robots.txt / ToS first`);
      console.warn(`✗ ${publisher.name} skipped — tosChecked is false`);
      continue;
    }
    try {
      const result = await scrapeViaSitemap(publisher);
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
// 3. NORMALIZE — clean titles, merge near-duplicates
// ============================================================================

interface NormalizedSeries {
  canonicalTitle: string;
  publisher: string;
  sourceTitles: string[];
  needsReview: boolean;
  productUrl?: string;
}

function normalizeTitle(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(tome|t\.?|vol\.?|volume)\s*\d+\b/gi, '')
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
        group.needsReview = true;
        matched = true;
        break;
      } else if (similarity >= DEDUP_IGNORE_BELOW) {
        continue;
      }
    }

    if (!matched) {
      groups.push({
        canonicalTitle: entry.title,
        publisher: entry.publisher,
        sourceTitles: [entry.title],
        needsReview: false,
        productUrl: entry.productUrl,
      });
    }
  }

  return groups;
}

// ============================================================================
// 4. GLENAT PRODUCT PAGE — primary enrichment source (French data)
// ============================================================================

interface GlenatData {
  titleFr: string | null;
  author: string | null;
  description: string | null;
  coverUrl: string | null;
  volumeCount: number | null;
}

function extractAuthor(product: any): string | null {
  // Hachette platform stores contributors as an array with roles
  const contributors: any[] = product.contributors ?? product.authors ?? product.createurs ?? [];
  const author = contributors.find((c: any) =>
    /auteur|mangaka|dessinateur|sc[eé]nariste/i.test(c.role ?? c.fonction ?? c.type ?? '')
  ) ?? contributors[0];
  return author?.name ?? author?.nom ?? author?.displayName ?? null;
}

function extractCoverUrl(product: any): string | null {
  // Try common Hachette image field paths
  return (
    product.coverImage?.url ??
    product.images?.[0]?.url ??
    product.image?.url ??
    product.cover?.url ??
    product.couverture?.url ??
    product.imageUrl ??
    null
  );
}

async function enrichFromGlenat(productUrl: string, probe = false): Promise<GlenatData | null> {
  try {
    const res = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });
    if (!res.ok) {
      console.warn(`  Glénat product page ${res.status}: ${productUrl}`);
      return null;
    }

    const html = await res.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!nextDataMatch) {
      console.warn(`  No __NEXT_DATA__ found: ${productUrl}`);
      return null;
    }

    const nextData = JSON.parse(nextDataMatch[1]);

    if (probe) {
      console.log('\n=== PROBE: __NEXT_DATA__.props.pageProps keys ===');
      const pp = nextData?.props?.pageProps;
      if (pp) {
        console.log('pageProps keys:', Object.keys(pp));
        // Print top-level keys of the first product-like object
        for (const key of Object.keys(pp)) {
          const val = pp[key];
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            console.log(`\npageProps.${key} keys:`, Object.keys(val).slice(0, 30));
          }
        }
      }
      console.log('\nFull pageProps (truncated to 4000 chars):');
      console.log(JSON.stringify(nextData?.props?.pageProps, null, 2).slice(0, 4000));
      return null;
    }

    const pp = nextData?.props?.pageProps;

    // Try common Hachette product data paths
    const product =
      pp?.product ??
      pp?.data?.product ??
      pp?.initialData?.product ??
      pp?.livre ??
      pp?.data?.livre ??
      pp?.pageData?.product ??
      null;

    if (!product) {
      console.warn(`  Could not find product object in pageProps for ${productUrl}`);
      console.warn(`  pageProps keys: ${Object.keys(pp ?? {}).join(', ')}`);
      return null;
    }

    // Series title — prefer collection/series title over volume title
    const titleFr =
      product.collection?.title ??
      product.serie?.titre ??
      product.series?.title ??
      product.seriesTitle ??
      product.titre ?? // volume title as last resort
      product.title ??
      null;

    return {
      titleFr,
      author: extractAuthor(product),
      description: product.synopsis ?? product.description ?? product.resume ?? product.quatriemeDeCouverture ?? null,
      coverUrl: extractCoverUrl(product),
      volumeCount: product.collection?.volumeCount ?? product.serie?.nombreTomes ?? product.seriesVolumeCount ?? null,
    };
  } catch (err) {
    console.warn(`  Error fetching ${productUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ============================================================================
// 5. ANILIST — secondary source, only for anilist_id cross-reference
// ============================================================================

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const ANILIST_QUERY = `
query ($search: String) {
  Media(search: $search, type: MANGA) {
    id
    title { romaji english native }
  }
}
`;

async function matchAniListId(seriesTitle: string): Promise<{ anilistId: number | null; confidence: number }> {
  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: seriesTitle } }),
    });

    if (!res.ok) return { anilistId: null, confidence: 0 };

    const json = await res.json();
    const media = json?.data?.Media;
    if (!media) return { anilistId: null, confidence: 0 };

    const candidates = [media.title.romaji, media.title.english, media.title.native].filter(Boolean) as string[];
    const bestScore = Math.max(
      ...candidates.map((c) => stringSimilarity.compareTwoStrings(seriesTitle.toLowerCase(), c.toLowerCase()))
    );

    return {
      anilistId: bestScore >= ANILIST_MATCH_THRESHOLD ? media.id : null,
      confidence: bestScore,
    };
  } catch {
    return { anilistId: null, confidence: 0 };
  }
}

// ============================================================================
// 6. SUPABASE — upsert with Glénat data as primary source
// ============================================================================

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function sanitizeText(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/[^\x00-\xFF]/g, '').trim() || null;
}

async function insertSeriesRecord(
  series: NormalizedSeries,
  glenat: GlenatData | null,
  anilistId: number | null
) {
  const { error } = await supabase.from('manga_series').upsert(
    {
      title_fr: sanitizeText(glenat?.titleFr ?? series.canonicalTitle),
      publisher: series.publisher,
      author: sanitizeText(glenat?.author ?? null),
      anilist_id: anilistId,
      jp_volume_count: glenat?.volumeCount ?? null,
      cover_url: sanitizeText(glenat?.coverUrl ?? null),
      description: sanitizeText(glenat?.description ?? null),
      needs_review: series.needsReview || !glenat,
      source: 'publisher_catalog',
    },
    { onConflict: 'title_fr,publisher' }
  );

  if (error) throw new Error(`Failed to insert "${series.canonicalTitle}": ${error.message}`);
}

// ============================================================================
// 7. ORCHESTRATION
// ============================================================================

interface ReviewItem {
  title: string;
  publisher: string;
  reason: string;
}

async function runPipeline() {
  const probeMode = process.env.PROBE_GLENAT === '1';

  console.log('--- Step 1: scraping publisher sitemaps ---');
  const { entries, errors } = await scrapeAllPublishers(PUBLISHERS);

  if (errors.length > 0) {
    console.warn(`\n${errors.length} publisher(s) skipped:`);
    errors.forEach((e) => console.warn(`  - ${e}`));
  }
  if (entries.length === 0) {
    console.error('No series found. Check publisher configs.');
    return;
  }

  console.log(`\n--- Step 2: deduplicating ${entries.length} raw entries ---`);
  const uniqueSeries = deduplicateSeries(entries);
  console.log(`${uniqueSeries.length} unique series after dedup`);

  if (probeMode) {
    console.log('\n=== PROBE MODE: fetching first 3 product pages and printing NEXT_DATA ===\n');
    let probed = 0;
    for (const series of uniqueSeries) {
      if (!series.productUrl) continue;
      if (probed >= 3) break;
      console.log(`\n--- Probing: ${series.canonicalTitle} ---`);
      console.log(`URL: ${series.productUrl}`);
      await enrichFromGlenat(series.productUrl, true);
      probed++;
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log('\nProbe complete. Check output above and adjust field paths in enrichFromGlenat().');
    return;
  }

  const reviewQueue: ReviewItem[] = [];
  let inserted = 0;

  console.log('\n--- Step 3: Glénat enrichment + AniList ID lookup + Supabase upsert ---');
  for (const series of uniqueSeries) {
    if (series.needsReview) {
      reviewQueue.push({
        title: series.canonicalTitle,
        publisher: series.publisher,
        reason: 'fuzzy title merge during dedup',
      });
    }

    // Primary: fetch Glénat product page
    let glenatData: GlenatData | null = null;
    if (series.productUrl) {
      glenatData = await enrichFromGlenat(series.productUrl);
      await new Promise((r) => setTimeout(r, 400)); // ~150 req/min max
    }

    // Secondary: AniList ID only
    let anilistId: number | null = null;
    try {
      const aniResult = await matchAniListId(series.canonicalTitle);
      anilistId = aniResult.anilistId;
    } catch {
      // AniList failure is non-fatal — we have Glénat data
    }
    await new Promise((r) => setTimeout(r, 400));

    if (!glenatData) {
      reviewQueue.push({
        title: series.canonicalTitle,
        publisher: series.publisher,
        reason: 'Glénat product page not scraped — stored with slug-derived title only',
      });
    }

    try {
      await insertSeriesRecord(series, glenatData, anilistId);
      inserted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Insert failed for "${series.canonicalTitle}" — skipping: ${msg}`);
      reviewQueue.push({ title: series.canonicalTitle, publisher: series.publisher, reason: `insert error: ${msg}` });
    }
  }

  fs.writeFileSync('review-queue.json', JSON.stringify(reviewQueue, null, 2));

  console.log(`\nDone. ${inserted} series inserted.`);
  console.log(`${reviewQueue.length} items need manual review — see review-queue.json`);
}

runPipeline().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});

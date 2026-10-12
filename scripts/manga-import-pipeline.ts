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
 *   PROBE_PIKA=1   npx tsx scripts/manga-import-pipeline.ts
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
  {
    name: 'Pika',
    tosChecked: true,
    // sitemap.xml is an index — scrapeViaSitemap will follow child sitemaps automatically
    sitemapProductsUrl: 'https://www.pika.fr/sitemap.xml',
    sitemapSlugPattern: /\/livre\/([^/"<\s]+)/,
    productBaseUrl: 'https://www.pika.fr/livre/',
  },
];

const ANILIST_MATCH_THRESHOLD = 0.75;

const HTML_ENTITIES: Record<string, string> = {
  '&eacute;': 'é', '&egrave;': 'è', '&ecirc;': 'ê', '&euml;': 'ë',
  '&agrave;': 'à', '&acirc;': 'â', '&auml;': 'ä',
  '&ocirc;': 'ô', '&ouml;': 'ö', '&ucirc;': 'û', '&uuml;': 'ü',
  '&icirc;': 'î', '&iuml;': 'ï', '&ccedil;': 'ç',
  '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>',
  '&nbsp;': ' ', '&laquo;': '«', '&raquo;': '»', '&hellip;': '…',
};
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
  frVolumeCount?: number; // max tome number seen in sitemap = FR volumes published
}

async function scrapeViaSitemap(publisher: PublisherConfig): Promise<RawSeriesEntry[]> {
  const fetchXml = async (url: string) => {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Tomesie-CatalogBot/1.0 (contact: tomvmauri@gmail.com)' },
    });
    if (!res.ok) throw new Error(`Failed to fetch sitemap ${url}: ${res.status}`);
    return res.text();
  };

  let xml = await fetchXml(publisher.sitemapProductsUrl!);

  // If this is a sitemap index, follow all child sitemaps to get product URLs
  if (xml.includes('<sitemapindex')) {
    const childUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const childXmls = await Promise.all(childUrls.map((u) => fetchXml(u).catch(() => '')));
    xml = childXmls.join('\n');
  }

  // Non-manga product types (calendars, artbooks, games, etc.)
  const NON_MANGA_SLUG = /\b(agenda|agendas|calendrier|artbook|art-book|cahier|hors-serie|guide|guides|jeu|puzzle|coloriage|coloring|postcard|ex-libris|kakebo|roman|novel|coffret|color-walk|blue-deep|chapitre|light-novel|ln)\b/i;

  // Alternate editions of the same manga — not separate series (replicable across publishers)
  const EDITION_VARIANT_SLUG = /\b(full-color|couleur|edition-originale|big|perfect|deluxe|integrale|new-edition|nouvelle-edition|extra|super-livre|absolute)\b/i;

  // Track min tome number (for product URL) and max tome number (for volume count)
  const seriesMap = new Map<string, { fullSlug: string; minTome: number; maxTome: number }>();
  const re = new RegExp(publisher.sitemapSlugPattern!.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(xml)) !== null) {
    const fullSlug = match[1]; // e.g. "naruto-tome-1-9782723445405" or "demon-slayer-t1-9782811678005"
    // Support both -tome-N and -tN- (Pika style) and -chapitre-N
    const tomeMatch =
      fullSlug.match(/-tome-(\d+)/i) ??
      fullSlug.match(/-t(\d+)(?:-|$)/i) ??
      fullSlug.match(/-chapitre-(\d+)/i);
    const tomeNum = tomeMatch ? parseInt(tomeMatch[1], 10) : 999;
    const seriesSlug = fullSlug
      .replace(/-tome-\d.*/i, '')
      .replace(/-t\d+.*/i, '')         // Pika: -t11-isbn → strip from -t onward
      .replace(/-chapitre-\d.*/i, '')  // chapter editions
      .replace(/-97[89]\d*/i, '')      // ISBN suffix (978 or 979)
      .trim();
    if (!seriesSlug || NON_MANGA_SLUG.test(seriesSlug) || EDITION_VARIANT_SLUG.test(seriesSlug)) continue;

    const existing = seriesMap.get(seriesSlug);
    if (!existing) {
      seriesMap.set(seriesSlug, { fullSlug, minTome: tomeNum, maxTome: tomeNum });
    } else {
      if (tomeNum < existing.minTome) {
        existing.fullSlug = fullSlug; // keep slug of lowest tome for product URL
        existing.minTome = tomeNum;
      }
      if (tomeNum > existing.maxTome && tomeNum < 900) {
        existing.maxTome = tomeNum;
      }
    }
  }

  return Array.from(seriesMap.entries()).map(([seriesSlug, { fullSlug, maxTome }]) => ({
    title: seriesSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .replace(/[^\x00-\xFF]/g, ''),
    publisher: publisher.name,
    sourceUrl: publisher.sitemapProductsUrl!,
    productUrl: publisher.productBaseUrl ? `${publisher.productBaseUrl}${fullSlug}/` : undefined,
    frVolumeCount: maxTome < 900 ? maxTome : undefined,
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
  frVolumeCount?: number;
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
        frVolumeCount: entry.frVolumeCount,
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
    const pp = nextData?.props?.pageProps;

    if (probe) {
      console.log('\n=== PROBE: __NEXT_DATA__.props.pageProps keys ===');
      if (pp) {
        console.log('pageProps keys:', Object.keys(pp));
        for (const key of Object.keys(pp)) {
          const val = pp[key];
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            console.log(`\npageProps.${key} keys:`, Object.keys(val).slice(0, 30));
          }
        }
        const sections: any[] = pp.sections ?? [];
        const productSection = sections.find((s: any) => s.name === 'section_product_glenat_info');
        const sData = productSection?.data ?? null;
        console.log('\npp.data:', JSON.stringify(pp.data, null, 2));
        console.log('\nsection_product_glenat_info.data keys:', sData ? Object.keys(sData) : 'not found');
        console.log('\nsData.primary:', JSON.stringify(sData?.primary, null, 2));
        console.log('\nsData.secondary:', JSON.stringify(sData?.secondary, null, 2));
        // Search all strings in sData for image/cover URLs
        const allText = JSON.stringify(sData);
        const imgMatches = allText.match(/https?:[^"]+\.(jpg|jpeg|png|webp)[^"]*/gi) ?? [];
        console.log('\nImage URLs found in sData:', imgMatches);
      }
      console.log('\nFull pageProps (truncated to 6000 chars):');
      console.log(JSON.stringify(pp, null, 2).slice(0, 6000));
      return null;
    }

    if (!pp) return null;

    // Data lives in sections[], not at a top-level product key
    const sections: any[] = pp.sections ?? [];
    const productSection = sections.find((s: any) => s.name === 'section_product_glenat_info');
    const sData = productSection?.data ?? null;

    // Series title — pp.data.serie_label is the cleanest source
    const titleFr =
      pp.data?.serie_label ??
      pp.dataLayer?.book_serie ??
      (sData?.primary?.title as string | null)?.replace(/\s*[-–]\s*[Tt]ome\s*\d+.*$/, '').trim() ??
      null;

    // Author — from primary.authors array
    const rawAuthors: any[] = sData?.primary?.authors ?? [];
    const authorLabel: string | null = rawAuthors[0]?.label ?? pp.dataLayer?.book_author ?? null;

    // Description — use full editorial text from pp.data, fall back to teaser
    const rawDesc: string | null =
      pp.data?.presentation_editoriale ??
      sData?.primary?.resume ??
      null;
    const description = rawDesc
      ? rawDesc
          .replace(/<[^>]+>/g, '')
          .replace(/&[a-zA-Z]+;/g, (e) => HTML_ENTITIES[e] ?? '')
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
          .replace(/\s+/g, ' ')
          .trim() || null
      : null;

    // Cover URL — use Hachette media CDN URL embedded in the page data
    const coverUrl: string | null =
      sData?.secondary?.bookmarkData?.entity_image_url ??
      sData?.promo?.images?.mobile ??
      sData?.hdCoverImage ??
      pp.data?.image_de_couverture_hd ??
      null;

    return {
      titleFr,
      author: authorLabel,
      description,
      coverUrl,
      volumeCount: null, // not available on individual product pages
    };
  } catch (err) {
    console.warn(`  Error fetching ${productUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ============================================================================
// 5. PIKA PRODUCT PAGE — primary enrichment source for Pika series
// ============================================================================

async function enrichFromPika(productUrl: string, probe = false): Promise<GlenatData | null> {
  try {
    const res = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });
    if (!res.ok) {
      console.warn(`  Pika product page ${res.status}: ${productUrl}`);
      return null;
    }

    const html = await res.text();

    // Try Next.js __NEXT_DATA__ first
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      const nextData = JSON.parse(nextDataMatch[1]);
      const pp = nextData?.props?.pageProps;

      if (probe) {
        console.log('\n=== PROBE_PIKA: __NEXT_DATA__.props.pageProps keys ===');
        if (pp) {
          console.log('pageProps keys:', Object.keys(pp));
          for (const key of Object.keys(pp)) {
            const val = pp[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              console.log(`\npageProps.${key} keys:`, Object.keys(val).slice(0, 30));
            }
          }
          const allText = JSON.stringify(pp);
          const imgMatches = allText.match(/https?:[^"]+\.(jpg|jpeg|png|webp)[^"]*/gi) ?? [];
          console.log('\nImage URLs found in pageProps:', imgMatches.slice(0, 5));
        }
        console.log('\nFull pageProps (truncated to 6000 chars):');
        console.log(JSON.stringify(pp, null, 2).slice(0, 6000));
        return null;
      }

      if (pp) {
        // Generic extraction — field paths will be refined after a probe run
        const product = pp.product ?? pp.data?.product ?? pp.livre ?? null;
        const titleFr: string | null =
          product?.seriesTitle ?? product?.serie ?? pp.data?.serie_label ?? null;
        const rawAuthor: any[] = product?.authors ?? product?.auteurs ?? [];
        const author: string | null = rawAuthor[0]?.name ?? rawAuthor[0]?.label ?? null;
        const rawDesc: string | null =
          product?.description ?? product?.resume ?? product?.synopsis ?? null;
        const description = rawDesc
          ? rawDesc
              .replace(/<[^>]+>/g, '')
              .replace(/&[a-zA-Z]+;/g, (e) => HTML_ENTITIES[e] ?? '')
              .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
              .replace(/\s+/g, ' ')
              .trim() || null
          : null;
        const coverUrl: string | null =
          product?.image ?? product?.cover ?? product?.images?.[0]?.url ?? null;
        if (titleFr || coverUrl) {
          return { titleFr, author, description, coverUrl, volumeCount: null };
        }
      }
    }

    // Fallback: OpenGraph meta tags (always present on well-formed pages)
    if (probe) {
      console.log('\n[PROBE_PIKA] No __NEXT_DATA__ found, printing OpenGraph meta tags:');
    }
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1] ?? null;
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1] ?? null;
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/)?.[1] ?? null;

    if (probe) {
      console.log('og:title:', ogTitle);
      console.log('og:image:', ogImage);
      console.log('og:description:', ogDesc);
      return null;
    }

    return {
      titleFr: ogTitle,
      author: null,
      description: ogDesc,
      coverUrl: ogImage,
      volumeCount: null,
    };
  } catch (err) {
    console.warn(`  Error fetching ${productUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ============================================================================
// 7. ANILIST — secondary source, only for anilist_id cross-reference
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
// 8. SUPABASE — upsert with publisher data as primary source
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
      jp_volume_count: glenat?.volumeCount ?? series.frVolumeCount ?? null,
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
// 9. ORCHESTRATION
// ============================================================================

interface ReviewItem {
  title: string;
  publisher: string;
  reason: string;
}

async function enrichFromPublisher(series: NormalizedSeries, probe = false): Promise<GlenatData | null> {
  if (!series.productUrl) return null;
  if (series.publisher === 'Pika') return enrichFromPika(series.productUrl, probe);
  return enrichFromGlenat(series.productUrl, probe);
}

async function runPipeline() {
  const probeGlenat = process.env.PROBE_GLENAT === '1';
  const probePika = process.env.PROBE_PIKA === '1';
  const probeMode = probeGlenat || probePika;

  // In probe mode, only process the relevant publisher
  const publishers = probeGlenat
    ? PUBLISHERS.filter((p) => p.name === 'Glénat')
    : probePika
    ? PUBLISHERS.filter((p) => p.name === 'Pika')
    : PUBLISHERS;

  console.log('--- Step 1: scraping publisher sitemaps ---');
  const { entries, errors } = await scrapeAllPublishers(publishers);

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
    const publisherName = probeGlenat ? 'Glénat' : 'Pika';
    console.log(`\n=== PROBE MODE (${publisherName}): fetching first 3 product pages ===\n`);
    let probed = 0;
    for (const series of uniqueSeries) {
      if (!series.productUrl) continue;
      if (probed >= 3) break;
      console.log(`\n--- Probing: ${series.canonicalTitle} ---`);
      console.log(`URL: ${series.productUrl}`);
      await enrichFromPublisher(series, true);
      probed++;
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(`\nProbe complete. Adjust field paths in enrichFrom${publisherName}() based on output above.`);
    return;
  }

  const reviewQueue: ReviewItem[] = [];
  let inserted = 0;

  console.log('\n--- Step 3: publisher enrichment + AniList ID lookup + Supabase upsert ---');
  for (const series of uniqueSeries) {
    if (series.needsReview) {
      reviewQueue.push({
        title: series.canonicalTitle,
        publisher: series.publisher,
        reason: 'fuzzy title merge during dedup',
      });
    }

    // Primary: fetch publisher product page
    const publisherData = await enrichFromPublisher(series);
    await new Promise((r) => setTimeout(r, 400)); // ~150 req/min max

    // Secondary: AniList ID only
    let anilistId: number | null = null;
    try {
      const aniResult = await matchAniListId(series.canonicalTitle);
      anilistId = aniResult.anilistId;
    } catch {
      // AniList failure is non-fatal
    }
    await new Promise((r) => setTimeout(r, 400));

    const glenatData = publisherData;

    if (!glenatData) {
      reviewQueue.push({
        title: series.canonicalTitle,
        publisher: series.publisher,
        reason: 'Publisher product page not scraped — stored with slug-derived title only',
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

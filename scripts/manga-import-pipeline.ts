/**
 * ============================================================================
 * TOMESIE — MANGA SERIES IMPORT PIPELINE
 * ============================================================================
 *
 * One row per SERIES (not per volume).
 *
 * ORDER OF TRUTH:
 * 1. Publisher product pages (Glénat, Pika) are the PRIMARY source for French
 *    data: French title, author, French description, FR cover.
 * 2. AniList is SECONDARY: anilist_id and the Japanese volume count
 *    (jp_volume_count). AniList text (English description, JP cover) is NOT
 *    stored.
 * 3. The sitemaps tell us which series exist, which product URLs to try, and
 *    the highest French tome number seen (fr_volume_count).
 *
 * A series whose product page can't be scraped is NOT inserted — it goes to
 * review-queue.json instead. A slug-derived title is never stored.
 *
 * SETUP:
 *   npm install
 *   cp .env.local .env   (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   Apply supabase/migrations/20261015_manga_fr_volume_count.sql first.
 *
 * RUN:
 *   DRY_RUN=1 LIMIT=30 npx tsx scripts/manga-import-pipeline.ts   # no DB writes, writes manga-import-preview.json
 *   npx tsx scripts/manga-import-pipeline.ts                       # full import
 *
 * OPTIONS (env):
 *   DRY_RUN=1     scrape + match but don't write to Supabase
 *   LIMIT=n       only process the first n series (after dedup)
 *   PIKA_ONLY=1   only Pika;  GLENAT_ONLY=1  only Glénat
 *   PROBE_GLENAT=1 / PROBE_PIKA=1  print raw page data for 3 series then exit
 * ============================================================================
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as cheerio from 'cheerio';
import stringSimilarity from 'string-similarity';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// 1. CONFIG
// ============================================================================

interface PublisherConfig {
  name: string;
  tosChecked: boolean;
  sitemapProductsUrl?: string;
  sitemapSlugPattern?: RegExp;
  productBaseUrl?: string; // base URL for individual product pages
  coverImprint?: string; // media.hachette.fr/.../imgArticle/<IMPRINT>/ — rejects other imprints' books
}

const PUBLISHERS: PublisherConfig[] = [
  {
    name: 'Glénat',
    tosChecked: true,
    sitemapProductsUrl: 'https://www.glenat.com/products.xml',
    sitemapSlugPattern: /\/glenat-manga\/([^/"<\s?#]+)/,
    productBaseUrl: 'https://www.glenat.com/glenat-manga/',
  },
  {
    name: 'Pika',
    tosChecked: true,
    // sitemap.xml is an index — scrapeViaSitemap follows child sitemaps automatically
    sitemapProductsUrl: 'https://www.pika.fr/sitemap.xml',
    sitemapSlugPattern: /\/livre\/([^/"<\s?#]+)/,
    productBaseUrl: 'https://www.pika.fr/livre/',
    // pika.fr also sells H2T (French BD) books — their covers live under imgArticle/EDITIONSH2T/
    coverImprint: 'PIKA',
  },
];

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

const ANILIST_MATCH_THRESHOLD = 0.75;
const DEDUP_REVIEW_THRESHOLD = 0.85;
const MAX_PRODUCT_URLS_TRIED = 3; // per series, lowest tome first
const PUBLISHER_DELAY_MS = 400;
const ANILIST_DELAY_MS = 2100; // AniList is currently limited to 30 req/min

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// 2. TEXT HELPERS
// ============================================================================

/**
 * HTML fragment → clean plain text. Decodes every entity (named, decimal, hex),
 * NFC-normalizes so decomposed accents (o + U+0300) become "ò"/"ù" instead of
 * being lost, and keeps all Unicode (’ « » … œ etc.).
 */
function cleanText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const withBreaks = raw.replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>/gi, ' ');
  const text = cheerio
    .load(withBreaks, null, false)
    .root()
    .text()
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F​﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

/** Key used for matching only — never stored. */
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

/** Same as normalizeTitle but also ignores spaces, so "ruri dragon" == "ruridragon". */
function compactKey(raw: string): string {
  return normalizeTitle(raw).replace(/\s/g, '');
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC');
}

/** "Mon voisin Totoro - Studio Ghibli" minus " - Studio Ghibli" → "Mon voisin Totoro". */
function stripSuffix(title: string | null, suffix: string | null): string | null {
  if (!title || !suffix) return title;
  const i = title.toLowerCase().lastIndexOf(suffix.toLowerCase());
  if (i <= 0 || i + suffix.length !== title.length) return title;
  return title.slice(0, i).replace(/[\s\-–]+$/, '').trim() || title;
}

function dedupeNames(names: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const name = cleanText(n);
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

// ============================================================================
// 3. SITEMAP — series slugs, candidate product URLs, FR volume count
// ============================================================================

interface RawSeriesEntry {
  slugTitle: string; // title-cased from series slug — for logs, dedup and AniList fallback only
  publisher: PublisherConfig;
  productUrls: string[]; // sorted by tome number, lowest first
  frVolumeCount?: number; // highest tome number seen in sitemap
}

// Non-manga product types (calendars, artbooks, games, novels, etc.)
const NON_MANGA_SLUG = /\b(agenda|agendas|calendrier|artbook|art-book|cahier|hors-serie|guide|guides|jeu|puzzle|coloriage|coloring|postcard|ex-libris|kakebo|roman|novel|coffret|color-walk|blue-deep|light-novel|ln|ebook|e-book|lart|l-art|zakki|fanbook|databook|data-book|magazine|recettes|cuisine|encyclopedie|quiz|stickers|carnet|mook|pack|offre-decouverte|reproduction-de-planche|illustrations|vivre-cards?|vivre-rush|anime-comics|akira-club|one-piece-(?:red|blue|yellow|green|doors))\b/i;

// Alternate editions of the same manga — not separate series
const EDITION_VARIANT_SLUG = /\b(full-color|couleur|edition-originale|big|perfect|deluxe|integrale|new-edition|nouvelle-edition|extra|super-livre|absolute)\b/i;

// Chapter-by-chapter digital editions — their numbers are chapters, not tomes
const CHAPTER_SLUG = /-chapitre-?\d/i; // also "ruridragon-chapitre33"

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

  const seriesMap = new Map<string, { slugs: Map<string, number>; maxTome: number }>();
  const re = new RegExp(publisher.sitemapSlugPattern!.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(xml)) !== null) {
    const fullSlug = match[1]; // e.g. "naruto-tome-1-9782723445405" or "demon-slayer-t1-9782811678005"
    if (CHAPTER_SLUG.test(fullSlug)) continue;
    if (/^\d+$/.test(fullSlug)) continue; // catalogue pagination (/livre/2/), not a product

    const tomeMatch = fullSlug.match(/-tome-(\d+)/i) ?? fullSlug.match(/-t(\d+)(?:-|$)/i);
    const tomeNum = tomeMatch ? parseInt(tomeMatch[1], 10) : null;
    const seriesSlug = fullSlug
      .replace(/-tome-\d.*/i, '')
      .replace(/-t\d+(?:-.*|$)/i, '') // Pika: -t11-isbn → strip from -t onward
      .replace(/-97[89]\d*/i, '') // ISBN suffix (978 or 979)
      .trim();
    if (!seriesSlug || NON_MANGA_SLUG.test(seriesSlug)) continue;

    const entry = seriesMap.get(seriesSlug) ?? { slugs: new Map<string, number>(), maxTome: 0 };
    // Untomed products (one-shots, specials) sort after numbered tomes
    entry.slugs.set(fullSlug, tomeNum ?? 900);
    if (tomeNum !== null && tomeNum < 900 && tomeNum > entry.maxTome) entry.maxTome = tomeNum;
    seriesMap.set(seriesSlug, entry);
  }

  // An alternate edition ("akira-noir-et-blanc-edition-originale") is dropped only when the
  // plain series also exists — Glénat's main One Piece IS "one-piece-edition-originale"
  const variantRe = new RegExp(EDITION_VARIANT_SLUG.source, 'gi');
  for (const seriesSlug of [...seriesMap.keys()]) {
    if (!EDITION_VARIANT_SLUG.test(seriesSlug)) continue;
    const base = seriesSlug.replace(variantRe, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
    if (base && base !== seriesSlug && seriesMap.has(base)) seriesMap.delete(seriesSlug);
  }

  return Array.from(seriesMap.entries()).map(([seriesSlug, { slugs, maxTome }]) => ({
    slugTitle: seriesSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    publisher,
    productUrls: [...slugs.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, MAX_PRODUCT_URLS_TRIED)
      .map(([slug]) => `${publisher.productBaseUrl}${slug}/`),
    frVolumeCount: maxTome > 0 ? maxTome : undefined,
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

/** Merges sitemap entries whose slugs differ only by spacing/case (same publisher). */
function mergeSitemapDuplicates(raw: RawSeriesEntry[]): RawSeriesEntry[] {
  const byKey = new Map<string, RawSeriesEntry>();
  for (const entry of raw) {
    const key = `${entry.publisher.name}|${compactKey(entry.slugTitle)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...entry, productUrls: [...entry.productUrls] });
      continue;
    }
    existing.productUrls = [...new Set([...existing.productUrls, ...entry.productUrls])].slice(0, MAX_PRODUCT_URLS_TRIED);
    existing.frVolumeCount = Math.max(existing.frVolumeCount ?? 0, entry.frVolumeCount ?? 0) || undefined;
  }
  return [...byKey.values()];
}

// ============================================================================
// 4. PUBLISHER PAGES — primary source (French data)
// ============================================================================

interface PublisherData {
  notManga?: string; // set when the page itself says it's not a manga — series is skipped
  titleFr: string;
  author: string | null;
  description: string | null;
  coverUrl: string | null;
}

type FetchResult = { html: string; finalUrl: string } | null;

async function fetchProductPage(url: string, label: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (!res.ok) {
      console.warn(`  ${label} product page ${res.status}: ${url}`);
      return null;
    }
    return { html: await res.text(), finalUrl: res.url };
  } catch (err) {
    console.warn(`  Error fetching ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function readNextData(html: string): any | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1])?.props?.pageProps ?? null;
  } catch {
    return null;
  }
}

function probeDump(label: string, pp: any, html: string) {
  console.log(`\n=== PROBE ${label}: __NEXT_DATA__.props.pageProps ===`);
  if (pp) {
    console.log('pageProps keys:', Object.keys(pp));
    console.log(JSON.stringify(pp, null, 2).slice(0, 6000));
  } else {
    console.log('(no __NEXT_DATA__)');
  }
  const $ = cheerio.load(html);
  console.log('og:title:', $('meta[property="og:title"]').attr('content'));
  console.log('og:image:', $('meta[property="og:image"]').attr('content'));
  console.log('JSON-LD blocks:', $('script[type="application/ld+json"]').length);
  $('script[type="application/ld+json"]').each((_, el) => console.log($(el).text().slice(0, 1500)));
}

async function enrichFromGlenat(productUrl: string, slugTitle: string, probe = false): Promise<PublisherData | null> {
  const page = await fetchProductPage(productUrl, 'Glénat');
  if (!page) return null;
  const pp = readNextData(page.html);
  if (probe) {
    probeDump('Glénat', pp, page.html);
    return null;
  }
  if (!pp) {
    console.warn(`  No __NEXT_DATA__ found: ${productUrl}`);
    return null;
  }

  // Note: Glénat tags are NOT usable to detect art books — Bleach tome 1 is tagged "guide".

  // Data lives in sections[], not at a top-level product key
  const sections: any[] = pp.sections ?? [];
  const sData = sections.find((s: any) => s.name === 'section_product_glenat_info')?.data ?? null;

  // Series title — pp.data.serie_label is the cleanest source, except when it's a
  // collection name ("Studio Ghibli") unrelated to the product's own slug
  const serieLabel = cleanText(pp.data?.serie_label ?? pp.dataLayer?.book_serie);
  const productTitle = cleanText(
    (sData?.primary?.title as string | undefined)?.replace(/\s*[-–]\s*[Tt]ome\s*\d+.*$/, '')
  );
  // A label equal to the collection ("Studio Ghibli") names a collection, not a series
  const collection = cleanText(pp.dataLayer?.book_collection);
  const labelIsCollection = serieLabel !== null && collection !== null && compactKey(serieLabel) === compactKey(collection);
  const labelMatchesSlug = serieLabel !== null && compactKey(slugTitle).includes(compactKey(serieLabel));
  const titleFr =
    labelMatchesSlug && !labelIsCollection ? serieLabel : (stripSuffix(productTitle, serieLabel) ?? serieLabel);
  if (!titleFr) return null;

  const rawAuthors: any[] = sData?.primary?.authors ?? [];
  const author = dedupeNames([rawAuthors[0]?.label, pp.dataLayer?.book_author])[0] ?? null;

  // Full editorial text first, teaser as fallback
  const description = cleanText(pp.data?.presentation_editoriale ?? sData?.primary?.resume);

  const coverUrl: string | null =
    sData?.secondary?.bookmarkData?.entity_image_url ??
    sData?.promo?.images?.mobile ??
    sData?.hdCoverImage ??
    pp.data?.image_de_couverture_hd ??
    null;

  return { titleFr, author, description, coverUrl };
}

/**
 * Pika og:title looks like:
 *   "Chobits T01 (Grand format - Autre 2002), de Clamp, Clamp | Pika Édition"
 * → title "Chobits", authors ["Clamp"]
 */
function parsePikaOgTitle(ogTitle: string): { title: string; authors: string[] } | null {
  const noSuffix = ogTitle.replace(/\s*\|\s*Pika\s+[ÉE]dition\s*$/i, '').trim();
  const m = noSuffix.match(/^(.*?)\s*\((?:[^()]|\([^()]*\))*\)\s*,\s*de\s*(.*)$/);
  const titlePart = m ? m[1] : noSuffix;
  const authors = m ? m[2].split(',').map((a) => a.trim()) : [];
  const title = titlePart
    .replace(/\s+(?:T|Tome\s*)\d+\b.*$/i, '') // "T01", "T01 & T02"
    .replace(/\s*[-–]\s*$/, '')
    .trim();
  return title ? { title, authors: dedupeNames(authors) } : null;
}

async function enrichFromPika(productUrl: string, probe = false): Promise<PublisherData | null> {
  const page = await fetchProductPage(productUrl, 'Pika');
  if (!page) return null;
  const pp = readNextData(page.html);
  if (probe) {
    probeDump('Pika', pp, page.html);
    return null;
  }

  // Removed products redirect to the catalogue ("Tous les livres | Page 150 sur 185")
  if (!/\/livre\//.test(page.finalUrl)) {
    console.warn(`  Pika redirected away from product page: ${productUrl} → ${page.finalUrl}`);
    return null;
  }

  const $ = cheerio.load(page.html);
  const og = (p: string) => $(`meta[property="${p}"]`).attr('content') ?? null;
  const ogTitle = cleanText(og('og:title'));
  if (!ogTitle || /^Tous les livres/i.test(ogTitle)) return null;

  // Next.js data first (when present), og: meta tags as fallback
  let productData: any = null;
  for (const section of (pp?.sections ?? []) as any[]) {
    const candidate = section?.data?.serieLabel
      ? section.data
      : section?.data?.primary?.serieLabel
        ? section.data.primary
        : null;
    if (candidate) {
      productData = candidate;
      break;
    }
  }

  // Skip light novels (Pika Roman imprint)
  if (/roman/i.test(productData?.publisherLabel ?? '')) return null;

  const parsedOg = parsePikaOgTitle(ogTitle);
  const titleFr = cleanText(productData?.serieLabel) ?? parsedOg?.title ?? null;
  if (!titleFr) return null;

  const rawAuthors: any[] = productData?.contributeurs ?? productData?.authors ?? [];
  const nextAuthors = rawAuthors.map((a) =>
    a?.prenom && a?.nom ? `${a.prenom} ${a.nom}` : (a?.label ?? a?.name)
  );
  const author = dedupeNames([...nextAuthors, ...(parsedOg?.authors ?? [])])[0] ?? null;

  const hdImage = productData?.images?.find((i: any) => i.format === 'HD');
  const coverUrl: string | null = hdImage?.url ?? productData?.images?.[0]?.url ?? og('og:image');

  // Other imprints sold on pika.fr (e.g. H2T French BD) aren't manga
  const imprint = coverUrl?.match(/\/imgArticle\/([A-Z0-9]+)\//)?.[1];
  if (imprint && imprint !== 'PIKA') return null;
  // Placeholder image used on catalogue pages
  if (coverUrl?.endsWith('.svg')) return null;

  const description = cleanText(productData?.description ?? productData?.resume ?? og('og:description'));

  return { titleFr, author, description, coverUrl };
}

async function enrichFromPublisher(series: RawSeriesEntry, probe = false): Promise<PublisherData | null> {
  // Try the lowest tomes first; a removed tome 1 shouldn't lose the whole series
  for (const url of series.productUrls) {
    let data: PublisherData | null = null;
    try {
      data =
        series.publisher.name === 'Pika'
          ? await enrichFromPika(url, probe)
          : await enrichFromGlenat(url, series.slugTitle, probe);
    } catch (err) {
      // One malformed page must not stop a 1-hour run
      console.warn(`  Error parsing ${url}:`, err instanceof Error ? err.message : err);
    }
    if (probe) return null;
    if (data) return data;
    await sleep(PUBLISHER_DELAY_MS);
  }
  return null;
}

// ============================================================================
// 5. ANILIST — anilist_id + Japanese volume count
// ============================================================================

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const MEDIA_FIELDS = `
  id
  format
  title { romaji english native }
  synonyms
  volumes
  status
  coverImage { extraLarge large }
  staff(perPage: 4, sort: RELEVANCE) { edges { role node { name { full } } } }
`;

const ANILIST_QUERY = `
query ($search: String) {
  Page(perPage: 8) {
    media(search: $search, type: MANGA, format_in: [MANGA, ONE_SHOT]) { ${MEDIA_FIELDS} }
  }
}
`;

// An author's manga — used when the French title isn't known to AniList
const ANILIST_STAFF_QUERY = `
query ($search: String) {
  Staff(search: $search) {
    staffMedia(type: MANGA, perPage: 50) { nodes { ${MEDIA_FIELDS} } }
  }
}
`;

interface AniListMatch {
  anilistId: number | null;
  jpVolumes: number | null;
  coverUrl: string | null;
  confidence: number;
  media?: any; // the matched AniList entry (titles, synonyms, staff)
}

const NO_MATCH = { anilistId: null, jpVolumes: null, coverUrl: null } as const;

function toMatch(media: any, confidence: number): AniListMatch {
  return {
    anilistId: media.id,
    jpVolumes: media.volumes ?? null,
    coverUrl: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    confidence,
    media,
  };
}

function mediaNames(media: any): string[] {
  return [media.title?.romaji, media.title?.english, media.title?.native, ...(media.synonyms ?? [])].filter(Boolean);
}

async function anilistSearch(search: string, query = ANILIST_QUERY): Promise<any[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { search } }),
    });
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After') ?? '60', 10);
      console.warn(`  AniList rate limited — waiting ${wait}s`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.Page?.media ?? json?.data?.Staff?.staffMedia?.nodes ?? [];
  }
  return [];
}

/**
 * Searches AniList with each title variant and keeps the candidate whose
 * romaji/english/native title or synonym (synonyms often include the French
 * title) best matches. Scores compare normalized titles.
 */
async function matchAniList(titles: string[]): Promise<AniListMatch> {
  let best: AniListMatch = { ...NO_MATCH, confidence: 0 };
  const searched = new Set<string>();

  // AniList search returns nothing for accented input ("Chû") — also try without accents
  for (const title of titles.flatMap((t) => [t, stripAccents(t)])) {
    const key = normalizeTitle(title);
    if (!key || searched.has(title)) continue;
    searched.add(title);

    let candidates: any[] = [];
    try {
      candidates = await anilistSearch(title);
    } catch {
      // AniList failure is non-fatal
    }
    await sleep(ANILIST_DELAY_MS);

    for (const media of candidates) {
      const score = Math.max(0, ...mediaNames(media).map((n) => stringSimilarity.compareTwoStrings(key, normalizeTitle(n))));
      if (score > best.confidence) best = toMatch(media, score);
    }
    if (best.confidence >= 0.95) break;
  }

  // AniList leaves `volumes` null for ongoing series — no guessing, keep null
  return best.confidence >= ANILIST_MATCH_THRESHOLD ? best : { ...NO_MATCH, confidence: best.confidence };
}

const AUTHOR_TITLE_THRESHOLD = 0.6;
const AUTHOR_VOLUME_MATCH_MIN = 3;

/**
 * Fallback for series AniList only knows under another title ("Princesse
 * Résurrection" = "Kaibutsu Oujo" / "Princess Resurrection"): list the author's
 * manga and accept
 *   - the best title match (≥ 0.6, or one title containing the other), if the
 *     volume counts are consistent (equal for a finished series), or
 *   - otherwise the ONLY work whose Japanese volume count equals the French
 *     count (≥ 3 volumes, so one-shots never match on count alone).
 */
async function matchViaAuthor(author: string, titleFr: string, frCount: number | null): Promise<AniListMatch> {
  let works: any[] = [];
  for (const name of [...new Set([author, stripAccents(author)])]) {
    try {
      works = await anilistSearch(name, ANILIST_STAFF_QUERY);
    } catch {
      works = [];
    }
    await sleep(ANILIST_DELAY_MS);
    if (works.length) break;
  }
  works = works.filter((w) => w.format === 'MANGA' || w.format === 'ONE_SHOT');
  // A finished Japanese series must have the same count in France; an ongoing one may be ahead.
  // (Without this, "L'Académie musicale Alice", 3 FR tomes, matched "Gakuen Alice", 31.)
  const consistent = (w: any) =>
    w.volumes == null || frCount == null || (w.status === 'FINISHED' ? frCount === w.volumes : frCount <= w.volumes);

  const key = normalizeTitle(titleFr);
  const compact = compactKey(titleFr);
  let best: AniListMatch = { ...NO_MATCH, confidence: 0 };
  for (const w of works) {
    if (!consistent(w)) continue;
    let score = Math.max(0, ...mediaNames(w).map((n) => stringSimilarity.compareTwoStrings(key, normalizeTitle(n))));
    const contains = mediaNames(w).some((n) => {
      const c = compactKey(n);
      return compact.length >= 6 && c.length >= 6 && (c.includes(compact) || compact.includes(c));
    });
    if (contains) score = Math.max(score, AUTHOR_TITLE_THRESHOLD);
    if (score > best.confidence) best = toMatch(w, score);
  }
  if (best.confidence >= AUTHOR_TITLE_THRESHOLD) return best;

  if (frCount !== null && frCount >= AUTHOR_VOLUME_MATCH_MIN) {
    const sameCount = works.filter((w) => w.volumes === frCount);
    if (sameCount.length === 1) return toMatch(sameCount[0], AUTHOR_TITLE_THRESHOLD);
  }
  return { ...NO_MATCH, confidence: best.confidence };
}

/** AniList author: the first Story/Art credit ("Story & Art", "Story", "Art"). */
function anilistAuthor(media: any): string | null {
  const edges: any[] = media?.staff?.edges ?? [];
  const edge = edges.find((e) => /story|art|original creator/i.test(e.role ?? ''));
  return edge?.node?.name?.full ?? null;
}

/** French title among AniList's synonyms that matches the slug ("Elin la charmeuse de bêtes"). */
function anilistFrenchTitle(media: any, slugTitle: string): string | null {
  const key = compactKey(slugTitle);
  // Skip all-caps romaji ("BLACK BIRD") — the slug's "Black Bird" reads better
  return mediaNames(media).find((n) => compactKey(n) === key && n !== n.toUpperCase()) ?? null;
}

// ============================================================================
// 6. SUPABASE
// ============================================================================

interface SeriesRecord {
  title_fr: string;
  publisher: string;
  author: string | null;
  anilist_id: number | null;
  jp_volume_count: number | null;
  fr_volume_count: number | null;
  cover_url: string | null;
  description: string | null;
  needs_review: boolean;
  source: string;
}

let supabaseClient: SupabaseClient | null = null;
function supabase(): SupabaseClient {
  supabaseClient ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return supabaseClient;
}

async function upsertSeries(record: SeriesRecord) {
  const { error } = await supabase().from('manga_series').upsert(record, { onConflict: 'title_fr,publisher' });
  if (error) throw new Error(error.message);
}

// ============================================================================
// 7. ORCHESTRATION
// ============================================================================

interface ReviewItem {
  title: string;
  publisher: string;
  reason: string;
  urls?: string[];
}

const OUT_OF_PRINT_MIN_CONFIDENCE = 0.9;

/**
 * Builds a reduced record for a series whose publisher pages are gone: title from
 * the URL slug, AniList id / JP volumes / cover, FR volume count from the sitemap,
 * no description (AniList's is English). Returns the reason as a string when the
 * series can't be confirmed.
 */
async function outOfPrintRecord(series: RawSeriesEntry): Promise<SeriesRecord | string> {
  const ani = await matchAniList([series.slugTitle]);
  if (!ani.anilistId || ani.confidence < OUT_OF_PRINT_MIN_CONFIDENCE) {
    return `no publisher page and AniList score ${ani.confidence.toFixed(2)} < ${OUT_OF_PRINT_MIN_CONFIDENCE} — not inserted`;
  }
  if (ani.jpVolumes !== null && (series.frVolumeCount ?? 0) > ani.jpVolumes) {
    return `no publisher page and AniList ${ani.anilistId} has ${ani.jpVolumes} JP volumes < ${series.frVolumeCount} FR — not inserted`;
  }
  return {
    title_fr: anilistFrenchTitle(ani.media, series.slugTitle) ?? series.slugTitle,
    publisher: series.publisher.name,
    author: anilistAuthor(ani.media),
    anilist_id: ani.anilistId,
    jp_volume_count: ani.jpVolumes,
    fr_volume_count: series.frVolumeCount ?? null,
    cover_url: ani.coverUrl,
    description: null,
    needs_review: true,
    source: 'publisher_sitemap+anilist',
  };
}

/**
 * Same series found twice (e.g. main series + an art book or film comic that
 * carries the same series label). The product line with more French volumes
 * wins for text and cover; empty fields are filled from the other.
 */
function mergeRecords(target: SeriesRecord, other: SeriesRecord) {
  if ((other.fr_volume_count ?? 0) > (target.fr_volume_count ?? 0)) {
    target.author = other.author ?? target.author;
    target.cover_url = other.cover_url ?? target.cover_url;
    target.description = other.description ?? target.description;
  }
  target.author ??= other.author;
  target.anilist_id ??= other.anilist_id;
  target.jp_volume_count ??= other.jp_volume_count;
  target.fr_volume_count = Math.max(target.fr_volume_count ?? 0, other.fr_volume_count ?? 0) || null;
  target.cover_url ??= other.cover_url;
  target.description ??= other.description;
}

async function runPipeline() {
  const probeGlenat = process.env.PROBE_GLENAT === '1';
  const probePika = process.env.PROBE_PIKA === '1';
  const probeMode = probeGlenat || probePika;
  const dryRun = process.env.DRY_RUN === '1';
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;

  const onlyPika = probePika || process.env.PIKA_ONLY === '1';
  const onlyGlenat = probeGlenat || process.env.GLENAT_ONLY === '1';
  const publishers = PUBLISHERS.filter(
    (p) => (!onlyPika || p.name === 'Pika') && (!onlyGlenat || p.name === 'Glénat')
  );

  if (!dryRun && !probeMode && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or set DRY_RUN=1)');
  }

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

  // ONLY=one-piece,bleach — test specific series (slug-title prefix match)
  const only = process.env.ONLY?.split(',').map((o) => compactKey(o));
  const uniqueSeries = mergeSitemapDuplicates(entries)
    .filter((e) => !only || only.some((o) => compactKey(e.slugTitle).startsWith(o)))
    .slice(0, limit);
  console.log(`\n--- Step 2: ${entries.length} sitemap series → ${uniqueSeries.length} after slug merge ---`);

  if (probeMode) {
    for (const series of uniqueSeries.slice(0, 3)) {
      console.log(`\n--- Probing: ${series.slugTitle} — ${series.productUrls[0]} ---`);
      await enrichFromPublisher(series, true);
      await sleep(1000);
    }
    console.log('\nProbe complete. Adjust field paths in enrichFromGlenat()/enrichFromPika() based on output above.');
    return;
  }

  const reviewQueue: ReviewItem[] = [];
  const matchedViaAuthor: ReviewItem[] = []; // logged for spot-checking, not flagged
  // Keyed by publisher + compact title so "Ruridragon"/"RuriDragon" end up as one record
  const records = new Map<string, SeriesRecord>();
  const addRecord = (record: SeriesRecord) => {
    const key = `${record.publisher}|${compactKey(record.title_fr)}`;
    const existing = records.get(key);
    if (existing) mergeRecords(existing, record);
    else records.set(key, record);
  };

  console.log('\n--- Step 3: publisher pages + AniList ---');
  let processed = 0;
  for (const series of uniqueSeries) {
    processed++;
    if (processed % 25 === 0) console.log(`  ${processed}/${uniqueSeries.length}`);

    const pub = await enrichFromPublisher(series);
    await sleep(PUBLISHER_DELAY_MS);

    if (pub?.notManga) {
      reviewQueue.push({ title: pub.titleFr, publisher: series.publisher.name, reason: `not manga (${pub.notManga}) — skipped` });
      continue;
    }
    if (!pub) {
      // Out of print: the publisher removed the pages. Keep the series only when
      // AniList confirms the slug title is a real manga.
      const fallback = await outOfPrintRecord(series);
      if (typeof fallback === 'string') {
        reviewQueue.push({ title: series.slugTitle, publisher: series.publisher.name, reason: fallback, urls: series.productUrls });
        continue;
      }
      reviewQueue.push({
        title: fallback.title_fr,
        publisher: fallback.publisher,
        reason: `out of print — imported from slug + AniList ${fallback.anilist_id}, no description`,
      });
      addRecord(fallback);
      continue;
    }

    let ani = await matchAniList([pub.titleFr, series.slugTitle]);
    let aniIssue = ani.anilistId ? null : `no AniList match (best score ${ani.confidence.toFixed(2)})`;
    // France can't have more tomes than Japan — the match is a different work
    if (ani.anilistId && ani.jpVolumes !== null && (series.frVolumeCount ?? 0) > ani.jpVolumes) {
      aniIssue = `AniList ${ani.anilistId} rejected: ${ani.jpVolumes} JP volumes < ${series.frVolumeCount} FR`;
      ani = { ...NO_MATCH, confidence: ani.confidence };
    }
    if (!ani.anilistId && pub.author) {
      const viaAuthor = await matchViaAuthor(pub.author, pub.titleFr, series.frVolumeCount ?? null);
      if (viaAuthor.anilistId) {
        ani = viaAuthor;
        aniIssue = null;
        matchedViaAuthor.push({ title: pub.titleFr, publisher: series.publisher.name, reason: `matched via author ${pub.author} → AniList ${viaAuthor.anilistId} "${viaAuthor.media?.title?.romaji}"` });
      }
    }

    const record: SeriesRecord = {
      title_fr: pub.titleFr,
      publisher: series.publisher.name,
      author: pub.author,
      anilist_id: ani.anilistId,
      jp_volume_count: ani.jpVolumes,
      fr_volume_count: series.frVolumeCount ?? null,
      cover_url: pub.coverUrl,
      description: pub.description,
      needs_review: aniIssue !== null,
      source: 'publisher_catalog',
    };
    if (aniIssue) reviewQueue.push({ title: record.title_fr, publisher: record.publisher, reason: aniIssue });

    addRecord(record);
  }

  // Same AniList id on two records: identical series under different titles → merge;
  // anything less certain → keep both, drop the id on the second, flag it.
  const byAnilist = new Map<number, SeriesRecord>();
  for (const [key, record] of records) {
    if (!record.anilist_id) continue;
    const first = byAnilist.get(record.anilist_id);
    if (!first) {
      byAnilist.set(record.anilist_id, record);
      continue;
    }
    const similarity = stringSimilarity.compareTwoStrings(normalizeTitle(first.title_fr), normalizeTitle(record.title_fr));
    if (first.publisher === record.publisher && similarity >= DEDUP_REVIEW_THRESHOLD) {
      mergeRecords(first, record);
      records.delete(key);
    } else {
      reviewQueue.push({
        title: record.title_fr,
        publisher: record.publisher,
        reason: `AniList id ${record.anilist_id} already used by "${first.title_fr}" (${first.publisher}) — id dropped`,
      });
      record.anilist_id = null;
      record.jp_volume_count = null;
      record.needs_review = true;
    }
  }

  const finalRecords = [...records.values()];

  if (dryRun) {
    fs.writeFileSync('manga-import-preview.json', JSON.stringify(finalRecords, null, 2));
    console.log(`\nDRY RUN — ${finalRecords.length} records written to manga-import-preview.json (nothing sent to Supabase)`);
  } else {
    console.log(`\n--- Step 4: upserting ${finalRecords.length} records ---`);
    let inserted = 0;
    for (const record of finalRecords) {
      try {
        await upsertSeries(record);
        inserted++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Insert failed for "${record.title_fr}" — skipping: ${msg}`);
        reviewQueue.push({ title: record.title_fr, publisher: record.publisher, reason: `insert error: ${msg}` });
      }
    }
    console.log(`\nDone. ${inserted} series upserted.`);
  }

  fs.writeFileSync('review-queue.json', JSON.stringify(reviewQueue, null, 2));
  fs.writeFileSync('matched-via-author.json', JSON.stringify(matchedViaAuthor, null, 2));
  console.log(`${matchedViaAuthor.length} series matched via their author — see matched-via-author.json`);
  console.log(`${reviewQueue.length} items need manual review — see review-queue.json`);
}

runPipeline().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});

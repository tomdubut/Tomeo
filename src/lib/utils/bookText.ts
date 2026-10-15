// Text cleanup for book metadata coming from Google Books, applied when a
// book is saved (not in search results, so search ranking is unaffected).

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  laquo: "«", raquo: "»", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  agrave: "à", acirc: "â", auml: "ä", ccedil: "ç", icirc: "î", iuml: "ï",
  ocirc: "ô", ouml: "ö", ugrave: "ù", ucirc: "û", uuml: "ü", oelig: "œ",
  Eacute: "É", Egrave: "È", Agrave: "À", Ccedil: "Ç",
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name] ?? m)
}

/**
 * Google Books HTML description → plain text. Paragraphs and line breaks are
 * kept as newlines (BookDescription renders with whitespace-pre-wrap).
 */
export function cleanDescription(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = decodeEntities(
    raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]*>/g, "")
  )
    .normalize("NFC")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

/**
 * "Autre-monde - tome 3", "Les voleurs de fumée (Tome 2) - Le monde des démons",
 * "Le journal d'une grosse nouille, Tome 01", "Les P'tits Diables T08 - …"
 * → { name, position }. Returns nulls when the title has no volume number.
 */
export function parseSeriesFromTitle(title: string): { series_name: string | null; series_position: number | null } {
  const match = title.match(/^(.+?)[\s,:\-–(]*\b(?:tome|tom|vol(?:ume)?\.?|t)\s*0*(\d{1,3})\b/i)
  const name = match?.[1].replace(/[\s,:\-–(]+$/, "").trim()
  if (!match || !name) return { series_name: null, series_position: null }
  return { series_name: name, series_position: parseInt(match[2], 10) }
}

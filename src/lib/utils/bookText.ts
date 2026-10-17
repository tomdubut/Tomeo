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
  return tidyBlurb(text) || null
}

/** Library-catalogue artefacts in Google descriptions (BnF records especially). */
function tidyBlurb(text: string): string {
  let t = text
    // "…»--Quatrième de couverture": the record's source note
    .replace(/\s*-{1,2}\s*(?:quatrième de couverture|4e de couverture|page 4 de couverture|présentation de l['’]éditeur)\.?$/i, "")
    // A stray opening quote left at the very end
    .replace(/\s*«\s*$/, "")
    // Spaced ellipsis ". . ." (English style) → "…", before the next rule sees its spaces
    .replace(/\.(?: \.){2,}/g, "…")
    // "sensuelle . Florence", "mystérieuses. . Alors": no space before . or , in French
    .replace(/ +([.,])/g, "$1")
    .replace(/(?<!\.)\.\.(?!\.)/g, ".")
    .trim()
  // The whole blurb wrapped in « … » (nested quotes allowed): drop the outer pair
  if (t.startsWith("«") && t.endsWith("»")) {
    let depth = 0
    let wrapped = true
    for (let i = 0; i < t.length; i++) {
      if (t[i] === "«") depth++
      else if (t[i] === "»") depth--
      if (depth === 0 && i < t.length - 1) { wrapped = false; break }
    }
    if (wrapped) t = t.slice(1, -1).trim()
  }
  return t
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

const SMALL_WORDS = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "à", "au", "aux"])

/** "ALBIN MICHEL" → "Albin Michel", "ÉDITIONS DU SEUIL" → "Éditions du Seuil". Other names are kept as is. */
export function normalisePublisherName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ")
  // Only names written entirely in capitals (short acronyms like PUF stay)
  if (trimmed.length <= 4 || trimmed !== trimmed.toUpperCase() || trimmed === trimmed.toLowerCase()) return trimmed
  return trimmed
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
}

// Latest French volume of a manga series, from the BnF catalogue (SRU API, UNIMARC records).
// Port of the import matcher's logic: volumes are grouped by their series link (field 461),
// the regular edition is kept (not Perfect/Deluxe/…), and the highest volume number wins.

const SRU = "https://catalogue.bnf.fr/api/SRU"
const VARIANT_EDITION = /smash|perfect|deluxe|couleur|int[ée]grale|collector|coffret|hokage|ultimate|kanzenban/i

export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
}

/** First occurrence of each subfield of a UNIMARC datafield, per occurrence of the field. */
function fields(record: string, tag: string): Record<string, string>[] {
  const out: Record<string, string>[] = []
  const fieldRe = new RegExp(`<mxc:datafield tag="${tag}"[^>]*>([\\s\\S]*?)</mxc:datafield>`, "g")
  for (const f of record.matchAll(fieldRe)) {
    const sub: Record<string, string> = {}
    for (const s of f[1].matchAll(/<mxc:subfield code="(.)">([\s\S]*?)<\/mxc:subfield>/g)) {
      if (!(s[1] in sub)) sub[s[1]] = decode(s[2].replace(/\s+/g, " ").trim())
    }
    out.push(sub)
  }
  return out
}

async function sru(query: string, start: number): Promise<string> {
  const params = new URLSearchParams({
    version: "1.2",
    operation: "searchRetrieve",
    query,
    recordSchema: "unimarcXchange",
    maximumRecords: "50",
    startRecord: String(start),
  })
  const res = await fetch(`${SRU}?${params}`, {
    headers: { "User-Agent": "Tomesie/1.0 (catalogue; contact: tomvmauri@gmail.com)" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`BnF ${res.status}`)
  return res.text()
}

/** Highest regular-edition volume number the BnF lists for the series, or null if none found. */
export async function latestFrenchVolume(bnfSeries: string, bnfAuthor: string): Promise<number | null> {
  const query = `bib.author all "${norm(bnfAuthor)}" and bib.title all "${norm(bnfSeries)}" and bib.doctype any "a"`
  const target = norm(bnfSeries)
  let latest: number | null = null

  for (let start = 1; start <= 251; start += 50) {
    const xml = await sru(query, start)
    const records = [...xml.matchAll(/<srw:record>([\s\S]*?)<\/srw:record>/g)].map((m) => m[1])
    for (const rec of records) {
      const link = fields(rec, "461").find((f) => f.t)
      if (!link || norm(link.t) !== target) continue
      const edition = fields(rec, "205")[0]?.a ?? ""
      if (VARIANT_EDITION.test(edition)) continue
      const vol = Number((link.v ?? "").match(/\d{1,3}/)?.[0])
      if (Number.isInteger(vol) && vol > 0) latest = Math.max(latest ?? 0, vol)
    }
    const total = Number(xml.match(/<srw:numberOfRecords>(\d+)/)?.[1] ?? 0)
    if (start + 50 > total) break
  }
  return latest
}

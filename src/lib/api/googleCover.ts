import { createHash } from "crypto"

// Google Books' "image not available" picture at zoom=3 (575×750)
const PLACEHOLDER_MD5 = "a64fa89d7ebc97075c1d363fc5fea71f"
const TIMEOUT_MS = 8000

function imageSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.subarray(0, 4).toString("hex") === "89504e47") {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
      }
      i += 2 + buf.readUInt16BE(i + 2)
    }
  }
  return null
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Google Books thumbnails (zoom=1) are 128px wide. Returns a larger URL for the same picture, or null.
 *
 * 1. zoom=3 (~575px) isn't always the same picture: it can be Google's placeholder or a different
 *    crop (a 575×92 strip), so it's kept only when it's a real, larger image with the same proportions.
 *    Checked on 105 books: 84 passed.
 * 2. Otherwise the image server's size parameter (fife=w…-h…): asking for the thumbnail's own size
 *    returns the thumbnail byte for byte when the full image is the same picture (it differs when
 *    Google's full image is, say, a title page), so a match proves the larger one is the same cover.
 */
export async function largerGoogleCover(coverUrl: string | null): Promise<string | null> {
  if (!coverUrl || !/books\.google\.[a-z.]+\//.test(coverUrl) || !coverUrl.includes("zoom=1")) return null
  const largeUrl = coverUrl.replace("zoom=1", "zoom=3")
  const [small, large] = await Promise.all([fetchImage(coverUrl), fetchImage(largeUrl)])
  if (!small) return null
  const s = imageSize(small)
  if (!s) return null

  if (large && createHash("md5").update(large).digest("hex") !== PLACEHOLDER_MD5) {
    const l = imageSize(large)
    if (l && l.w > s.w && Math.abs(s.w / s.h - l.w / l.h) <= 0.04) return largeUrl
  }

  const sameSize = await fetchImage(`${coverUrl}&fife=w${s.w}-h${s.h}`)
  if (sameSize && sameSize.equals(small)) return `${coverUrl}&fife=w800-h1200`
  return null
}

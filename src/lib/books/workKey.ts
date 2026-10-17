// Identifies "the same book" across editions: normalised title + first author's last name + language.
// Used to avoid importing a second edition of a book already in the catalogue (one book per work),
// and to merge duplicate Google Books results in search. A French and an English edition stay separate.

export function titleKey(title: string, authors: string[]): string {
  const t = title
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // strip accents
    .toLowerCase()
    .replace(/['''\-:]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    // strip leading articles only
    .replace(/^(le|la|les|l|un|une|des|the|a|an|de|du)\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
  // Use only last name of first author to handle "Victor Hugo" vs "M. Victor Hugo"
  const authorParts = (authors[0] ?? "").toLowerCase().trim().split(/\s+/)
  const a = authorParts[authorParts.length - 1] ?? ""
  return `${t}|${a}`
}

/**
 * null when the title, author or language is missing: such books are never matched.
 * A comic or manga adaptation (Les Misérables in manga) is a different work from the novel.
 */
export function workKey(
  title: string,
  authors: string[],
  language: string | null | undefined,
  isComic = false
): string | null {
  if (!title.trim() || !authors[0]?.trim() || !language) return null
  return `${titleKey(title, authors)}|${language.toLowerCase()}${isComic ? "|bd" : ""}`
}

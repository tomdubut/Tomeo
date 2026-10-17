// What a user mainly reads (profiles.preferred_media), asked at onboarding.

export type PreferredMedia = "books" | "manga" | "both"

export const PREFERRED_MEDIA_OPTIONS: { value: PreferredMedia; label: string }[] = [
  { value: "books", label: "Livres" },
  { value: "manga", label: "Manga" },
  { value: "both", label: "Les deux" },
]

export function parsePreferredMedia(value: unknown): PreferredMedia | null {
  return value === "books" || value === "manga" || value === "both" ? value : null
}

/** Tab the catalogue and search open on: manga for manga readers, books otherwise. */
export function defaultMediaType(preferred: string | null | undefined): "books" | "manga" {
  return preferred === "manga" ? "manga" : "books"
}

// Input checks shared by server actions. Server actions are public endpoints: anyone can call
// them with any arguments, whatever the UI allows.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

export function assertUuid(value: unknown, what = "identifiant"): asserts value is string {
  if (!isUuid(value)) throw new Error(`${what} invalide`)
}

/** Integer within [min, max], or null when the value isn't one. */
export function intInRange(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

// Must match the content_reports_reason_known constraint and the report forms
export const REPORT_REASONS = ["wrong_cover", "wrong_description", "wrong_edition", "wrong_isbn", "wrong_metadata", "wrong_volume", "other"] as const

/** Profile text limits (also enforced by database constraints) */
export const PROFILE_LIMITS = { display_name: 50, bio: 500, location: 100, website_url: 200 } as const

export const PROFILE_COLORS = [
  "#b08a8a", // dusty rose
  "#8a9e8a", // sage green
  "#7a9e9e", // dusty teal
  "#c4b49a", // warm sand
  "#a89ab5", // muted lavender
  "#7a96b0", // dusty blue
  "#b07a6a", // warm terracotta
  "#8aada0", // seafoam
]

export function getProfileColor(username: string, savedColor?: string | null): string {
  if (savedColor) return savedColor
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash += username.charCodeAt(i)
  }
  return PROFILE_COLORS[hash % PROFILE_COLORS.length]
}

export function getBookColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) & 0xffffffff
  }
  return PROFILE_COLORS[Math.abs(hash) % PROFILE_COLORS.length]
}

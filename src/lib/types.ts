export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  location: string | null
  website_url: string | null
  profile_color: string | null
}

export interface Author {
  id: string
  name: string
}

export interface BookAuthorEntry {
  role: string
  display_order: number
  author: Author
}

export interface Book {
  id: string
  title: string
  subtitle: string | null
  cover_url: string | null
  description: string | null
  avg_rating: number | null
  rating_count: number
  page_count: number | null
  published_date: string | null
  isbn_13: string | null
  isbn_10: string | null
  language: string | null
  book_authors?: BookAuthorEntry[]
  publisher?: { name: string } | null
}

export interface ReviewWithProfile {
  id: string
  body: string
  is_spoiler: boolean
  is_private?: boolean
  created_at: string
  updated_at: string
  book_id: string
  user_id: string
  profile: Profile | null
  score?: number | null
}

export interface UserBook {
  book_id: string
  status: "want_to_read" | "currently_reading" | "read"
  updated_at: string
  finished_at: string | null
  book?: Book
}

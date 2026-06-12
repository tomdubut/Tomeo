// Run `supabase gen types typescript --project-id <your-project-id>` to regenerate.

export type ReadingStatus = "want_to_read" | "currently_reading" | "read"

export type ActivityType =
  | "added_book"
  | "rated_book"
  | "reviewed_book"
  | "created_list"
  | "followed_user"

export interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  website_url: string | null
  location: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}

export interface Book {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  language: string
  page_count: number | null
  published_date: string | null
  publisher_id: string | null
  cover_url: string | null
  isbn_10: string | null
  isbn_13: string | null
  google_books_id: string | null
  openlibrary_key: string | null
  avg_rating: number | null
  rating_count: number
  review_count: number
  created_at: string
  updated_at: string
}

export interface UserBook {
  user_id: string
  book_id: string
  status: ReadingStatus
  started_at: string | null
  finished_at: string | null
  is_private: boolean
  created_at: string
  updated_at: string
}

export interface Rating {
  user_id: string
  book_id: string
  score: number
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  user_id: string
  book_id: string
  body: string
  is_spoiler: boolean
  is_private: boolean
  created_at: string
  updated_at: string
}

export interface List {
  id: string
  user_id: string
  title: string
  description: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface ActivityFeedItem {
  id: string
  actor_id: string
  activity_type: ActivityType
  book_id: string | null
  review_id: string | null
  list_id: string | null
  target_user_id: string | null
  created_at: string
}

-- Add current_page to user_books for optional reading progress tracking
alter table user_books add column if not exists current_page integer check (current_page >= 0);

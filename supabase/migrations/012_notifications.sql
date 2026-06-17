create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  actor_id uuid references profiles(id) on delete cascade not null,
  type text not null check (type in ('new_follower', 'new_comment')),
  review_id uuid references reviews(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz default now() not null
);

create index on notifications(user_id, created_at desc);
create index on notifications(user_id, read_at) where read_at is null;

alter table notifications enable row level security;

create policy "Users can read own notifications"
  on notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can mark own notifications as read"
  on notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

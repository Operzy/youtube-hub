-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- This creates the tables for saved videos, content projects, and calendar entries
-- with Row Level Security so each user can only access their own data.

-- 1. Saved Videos
create table saved_videos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  url text,
  view_count bigint,
  upload_date text,
  thumbnail_url text,
  channel_name text,
  description text,
  subscriber_count bigint,
  type text default 'video',
  saved_at timestamptz default now(),
  unique(user_id, url)
);

alter table saved_videos enable row level security;

create policy "Users can view own saved videos"
  on saved_videos for select using (auth.uid() = user_id);

create policy "Users can insert own saved videos"
  on saved_videos for insert with check (auth.uid() = user_id);

create policy "Users can delete own saved videos"
  on saved_videos for delete using (auth.uid() = user_id);


-- 2. Content Projects
create table content_projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  source_video_title text,
  source_video_url text,
  script text,
  presentation text,
  titles jsonb default '[]'::jsonb,
  saved_at timestamptz default now()
);

alter table content_projects enable row level security;

create policy "Users can view own content projects"
  on content_projects for select using (auth.uid() = user_id);

create policy "Users can insert own content projects"
  on content_projects for insert with check (auth.uid() = user_id);

create policy "Users can update own content projects"
  on content_projects for update using (auth.uid() = user_id);

create policy "Users can delete own content projects"
  on content_projects for delete using (auth.uid() = user_id);


-- 3. Calendar Entries
create table calendar_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  date text not null,
  status text not null default 'idea',
  notes text default '',
  source_url text
);

alter table calendar_entries enable row level security;

create policy "Users can view own calendar entries"
  on calendar_entries for select using (auth.uid() = user_id);

create policy "Users can insert own calendar entries"
  on calendar_entries for insert with check (auth.uid() = user_id);

create policy "Users can update own calendar entries"
  on calendar_entries for update using (auth.uid() = user_id);

create policy "Users can delete own calendar entries"
  on calendar_entries for delete using (auth.uid() = user_id);

-- Web Ask hand-offs (CC 2, Nov 2026, landing repo).
--
-- When a reader hits the daily Ask limit on the website and takes "Keep
-- talking in the app, free", the website keeps the species and the last
-- three turns of that conversation here under an id the store link
-- (Play install referrer `handoff=<id>`), the deep link
-- (animaldex://talk?species=<slug>&handoff=<id>) and the https link
-- (https://animaldex.app/talk/<slug>?handoff=<id>) carry, so an app can pick
-- the conversation up after install. Nothing about the reader is kept: no
-- account, address or user agent. `redeemed_at` / `redeemed_by` stay null
-- until an app claims the row (the apps' side is not built here).
--
-- Written by the website's /api/ask/handoff route with the service role.
-- Nobody else can read or write it.
--
-- Also widens the front-door funnel's event check for the new
-- `store_click_ask_limit` step (lib/web-funnel), sent alongside store_click
-- from the same panel.
--
-- Version chosen against both repos' supabase/migrations (AnimalDex ends at
-- 20261113160000 on 2026-11-13; this repo at 20261111170000).
--
-- Idempotent. Rollback (this repo keeps no rollback files):
--   drop table if exists public.web_ask_handoffs;
--   alter table public.web_funnel_events drop constraint if exists web_funnel_events_event_check;
--   alter table public.web_funnel_events add constraint web_funnel_events_event_check check (event in (
--       'hero_view', 'demo_start', 'demo_reply', 'second_message', 'share_take', 'signup', 'store_click'));

begin;

create table if not exists public.web_ask_handoffs (
    id uuid primary key default gen_random_uuid(),
    species_slug text not null check (char_length(species_slug) <= 120 and species_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    -- The canonical species, when the website knew it; no foreign key, so
    -- the apps' species tables can be reshaped without this row in the way.
    species_profile_id uuid,
    -- Up to three turns, oldest first: [{"role": "user"|"assistant", "text": "…"}].
    turns jsonb not null default '[]'::jsonb check (jsonb_typeof(turns) = 'array' and jsonb_array_length(turns) <= 3),
    -- The page the limit was hit on: its path alone, never a query.
    source_path text check (source_path is null or (char_length(source_path) <= 300 and left(source_path, 1) = '/')),
    created_at timestamptz not null default now(),
    redeemed_at timestamptz,
    redeemed_by uuid
);

create index if not exists web_ask_handoffs_created_at_idx on public.web_ask_handoffs (created_at);

comment on table public.web_ask_handoffs is
    'Web Ask limit hand-offs to the apps (landing migration 20261113180000): species, last three turns, redeemed_at null until an app claims it. Service role only.';

alter table public.web_ask_handoffs enable row level security;
revoke all on public.web_ask_handoffs from public, anon, authenticated;
grant all on public.web_ask_handoffs to service_role;

-- The funnel's new step.
alter table public.web_funnel_events drop constraint if exists web_funnel_events_event_check;
alter table public.web_funnel_events add constraint web_funnel_events_event_check check (event in (
    'hero_view', 'demo_start', 'demo_reply', 'second_message', 'share_take', 'signup', 'store_click', 'store_click_ask_limit'
));

commit;

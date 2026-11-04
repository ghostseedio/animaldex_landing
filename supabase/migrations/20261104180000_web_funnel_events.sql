-- Front-door funnel for the home hero test (Nov 2026, landing repo).
--
-- One row per step a website visitor took after being shown the home hero:
-- hero_view, demo_start, demo_reply, second_message, share_take, signup,
-- store_click. `variant` is the hero they were given (a: the talking octopus,
-- b: the split card with the live lion take), kept in the first-touch cookie.
-- The visitor is a random id from that cookie, stored only as an HMAC
-- (visitor_hash); no account, address or user agent is kept here.
--
-- Written by the website's /api/funnel route and sign-in callback with the
-- service role; read by /admin/metrics (Acquisition, "Hero test"). Nobody
-- else can read or write it.
--
-- Idempotent. Rollback (this repo keeps no rollback files):
--   drop table if exists public.web_funnel_events;

begin;

create table if not exists public.web_funnel_events (
    id bigint generated always as identity primary key,
    visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
    event text not null check (event in (
        'hero_view', 'demo_start', 'demo_reply', 'second_message', 'share_take', 'signup', 'store_click'
    )),
    variant text not null check (variant in ('a', 'b')),
    -- What started the first message: a hero idea chip, its problem chip,
    -- the visitor's own words, or a suggestion the chat offered.
    chip_kind text check (chip_kind in ('idea', 'problem', 'typed', 'suggested')),
    path text check (path is null or (char_length(path) <= 300 and left(path, 1) = '/')),
    created_at timestamptz not null default now()
);

create index if not exists web_funnel_events_created_at_idx on public.web_funnel_events (created_at);
create index if not exists web_funnel_events_visitor_idx on public.web_funnel_events (visitor_hash, created_at);

comment on table public.web_funnel_events is
    'Home hero A/B funnel steps from the website (landing migration 20261104180000). Service role only.';

alter table public.web_funnel_events enable row level security;
revoke all on public.web_funnel_events from public, anon, authenticated;
grant all on public.web_funnel_events to service_role;

commit;

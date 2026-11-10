-- Ark measurement on the website (AnimalDex docs/ark-next.md, Part 1).
--
-- One row per Ark event a browser reported to /api/ark-events: how often the
-- Ark is opened and from where (ark_open, source), how long it stays open
-- (ark_session_seconds), animal taps, follows, "while you were away" replays,
-- shares, arrivals seen, and the chat's steps offered and completed. The
-- server tables stay the source of truth for steps and arrivals
-- (animal_companion_trials, voyage_events / voyage_animals, ark_seen_events);
-- this adds what only the browser knows: opens, time and taps.
--
-- Nothing personal: no account, no visitor id, no address or user agent, and
-- no names, problems, steps or chat. species_profile_id is a catalog species.
-- signed_in only splits visitors from people with an account.
--
-- Written by the website's /api/ark-events route with the service role (in
-- production only); read by /admin/metrics (the Ark tab). Nobody else can
-- read or write it.
--
-- Idempotent. Rollback: supabase/rollbacks/20261110130000_web_ark_events.rollback.sql.

begin;

create table if not exists public.web_ark_events (
    id bigint generated always as identity primary key,
    event text not null check (event in (
        'ark_open', 'ark_session_seconds', 'ark_animal_tap', 'ark_follow_animal', 'ark_replay_viewed',
        'step_offered', 'step_completed', 'ark_arrival_seen', 'ark_share'
    )),
    source text check (source in ('chat_panel', 'ark_page', 'capture_band', 'share_link')),
    seconds integer check (seconds between 0 and 21600),
    species_profile_id uuid,
    is_mine boolean,
    events_count integer check (events_count between 0 and 10000),
    skipped boolean,
    outcome text check (outcome in ('worked', 'partly', 'didnt_work')),
    target text check (target in ('tap_card', 'population')),
    signed_in boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists web_ark_events_created_at_idx on public.web_ark_events (created_at);
create index if not exists web_ark_events_event_idx on public.web_ark_events (event, created_at);

comment on table public.web_ark_events is
    'Ark opens, session time, taps, replays, shares and chat steps reported by the website (landing migration 20261110130000). No account or visitor id. Service role only.';

alter table public.web_ark_events enable row level security;
revoke all on public.web_ark_events from public, anon, authenticated;
grant all on public.web_ark_events to service_role;

commit;

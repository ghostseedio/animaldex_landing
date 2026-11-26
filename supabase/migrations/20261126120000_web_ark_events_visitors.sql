-- Ark metrics count people, not only opens, and leave the operator out.
--
-- visitor_id: a random id the browser keeps for itself (localStorage
--             'animaldex:ark:visitor'). It names a browser, never an account,
--             and is not derived from anything about the person.
-- device:     phone / tablet / desktop, from the request's user agent.
-- internal:   the operator's own browser (it has opened a signed-in /admin
--             page, cookie animaldex_internal). Kept, but left out of
--             /admin/metrics.
--
-- Additive and nullable: rows written before this keep working, and the site
-- writes the older row shape until this is applied.

begin;

alter table public.web_ark_events
    add column if not exists visitor_id uuid,
    add column if not exists device text check (device in ('phone', 'tablet', 'desktop')),
    add column if not exists internal boolean not null default false;

create index if not exists web_ark_events_visitor_idx on public.web_ark_events (visitor_id, created_at)
    where visitor_id is not null;

comment on column public.web_ark_events.visitor_id is
    'Random per-browser id from localStorage (landing migration 20261126120000). Not an account, not an IP.';
comment on column public.web_ark_events.internal is
    'The operator''s own browser (cookie animaldex_internal, set by signed-in /admin pages). Left out of /admin/metrics.';

commit;

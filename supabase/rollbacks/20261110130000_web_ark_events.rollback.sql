-- Rolls back 20261110130000_web_ark_events, WITH its rows (the website's Ark
-- opens, session times, taps and replays). /api/ark-events treats the missing
-- table as "not recorded" and the site carries on; the Ark tab of
-- /admin/metrics says opens are not recorded yet. No deploy is needed first.

begin;

drop table if exists public.web_ark_events;

commit;

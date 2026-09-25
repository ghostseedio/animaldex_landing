-- Capture-integrity reporting for /admin/integrity.
--
-- Read-only, and deliberately free of any dependency on the hardening
-- migration that belongs in the AnimalDex repo: this must answer "is it
-- happening elsewhere, and did it happen before?" today, against the schema as
-- it stands, and keep working unchanged afterwards.
--
-- The four signals are the ones that actually identified the 2026-09-25
-- account, in the order they were decisive:
--
--   backdated       captures whose recorded time precedes the account itself.
--                   Twelve of that account's twenty-four claimed 2026-09-15 on
--                   a profile created 2026-09-25. Impossible, and the single
--                   cheapest tell.
--   repeat_media    the largest group of that user's images sharing an exact
--                   byte size and pixel dimensions. Twelve at 546,059 bytes.
--                   content_sha256 would be better but is NULL on every row.
--   coarse_coords   coordinates unchanged by rounding to four decimals, i.e. a
--                   looked-up place rather than a fix (13.7563, 100.5018).
--   rush            captures in the first two minutes after signup. Twelve
--                   arrived 13 to 83 seconds in, about six seconds apart.
--
-- No signal is proof on its own: a coarse coordinate can be a manual location,
-- and two frames of one subject can share a byte size. The page ranks by how
-- many fire together, and a person decides.

begin;

create or replace function public.admin_capture_integrity_v1(
    min_captures integer default 3,
    lookback_days integer default 365
)
returns table (
    user_id uuid,
    username text,
    display_name text,
    joined_at timestamptz,
    captures_total bigint,
    backdated_captures bigint,
    repeat_media_max bigint,
    coarse_coordinate_captures bigint,
    distinct_coordinates bigint,
    captures_in_first_two_minutes bigint,
    first_capture_after_signup_seconds bigint,
    last_capture_at timestamptz,
    signals integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with scope as (
        select c.id, c.user_id, c.created_at, c.captured_at, c.location_lat, c.location_lng,
               p.created_at as account_created, p.username, p.display_name
          from public.captures c
          join public.profiles p on p.id = c.user_id
         where c.created_at >= now() - make_interval(days => greatest(1, coalesce(lookback_days, 365)))
    ),
    -- Largest set of one user's images sharing an exact size and dimensions.
    media as (
        select s.user_id, max(g.n) as repeat_media_max
          from (
                select c.user_id, ci.byte_size, ci.width_px, ci.height_px, count(*) as n
                  from public.capture_images ci
                  join public.captures c on c.id = ci.capture_id
                 where ci.byte_size is not null and ci.width_px is not null and ci.height_px is not null
                 group by 1,2,3,4
               ) g
          join scope s on s.user_id = g.user_id
         group by s.user_id
    ),
    agg as (
        select s.user_id,
               min(s.username) as username,
               min(s.display_name) as display_name,
               min(s.account_created) as joined_at,
               count(*) as captures_total,
               count(*) filter (
                   where s.created_at < s.account_created
                      or (s.captured_at is not null and s.captured_at < s.account_created)
               ) as backdated_captures,
               count(*) filter (
                   where s.location_lat is not null and s.location_lng is not null
                     and s.location_lat = round(s.location_lat::numeric, 4)::double precision
                     and s.location_lng = round(s.location_lng::numeric, 4)::double precision
               ) as coarse_coordinate_captures,
               count(distinct (s.location_lat::text || ',' || s.location_lng::text)) as distinct_coordinates,
               count(*) filter (where s.created_at < s.account_created + interval '2 minutes') as captures_in_first_two_minutes,
               greatest(0, floor(extract(epoch from (min(s.created_at) - min(s.account_created))))::bigint) as first_capture_after_signup_seconds,
               max(s.created_at) as last_capture_at
          from scope s group by s.user_id
    )
    select a.user_id, a.username, a.display_name, a.joined_at, a.captures_total,
           a.backdated_captures,
           coalesce(m.repeat_media_max, 0) as repeat_media_max,
           a.coarse_coordinate_captures,
           a.distinct_coordinates,
           a.captures_in_first_two_minutes,
           a.first_capture_after_signup_seconds,
           a.last_capture_at,
           ( (a.backdated_captures > 0)::int
           + (coalesce(m.repeat_media_max, 0) >= 3)::int
           + (a.coarse_coordinate_captures > 0)::int
           + (a.captures_in_first_two_minutes >= 5)::int ) as signals
      from agg a
      left join media m on m.user_id = a.user_id
     where a.captures_total >= greatest(1, coalesce(min_captures, 3))
       and ( a.backdated_captures > 0
          or coalesce(m.repeat_media_max, 0) >= 3
          or a.coarse_coordinate_captures > 0
          or a.captures_in_first_two_minutes >= 5 )
     order by signals desc, a.backdated_captures desc, a.captures_total desc;
$$;

comment on function public.admin_capture_integrity_v1(integer, integer) is
    'Read-only capture-provenance anomaly report for /admin/integrity. Service role only.';

revoke all on function public.admin_capture_integrity_v1(integer, integer) from public, anon, authenticated;
grant execute on function public.admin_capture_integrity_v1(integer, integer) to service_role;

commit;

-- Product analytics for /admin/metrics (Nov 2026).
--
-- 1. user_activity_days: one row per account, Jakarta day and platform the
--    app (or web app) was opened. Filled from user_devices, which every client
--    already updates through record_user_device, so no app release is needed.
--    The apps report at most once per 12h, so this is a floor on daily opens;
--    captures, chats, trials and debates fill in the rest on the dashboard.
-- 2. app_releases: when each app version went live. A trigger records the
--    first time any user reports a new version; older versions are seeded from
--    the version-bump commits in the iOS and Android repos.
-- 3. analytics_annotations: hand-added markers (a website launch, a campaign)
--    drawn on the dashboard's charts next to the releases.
-- 4. user_acquisition.landing_path / referrer_host: the website page and
--    referring site a web signup first arrived on (first-touch cookie), and
--    utm_content (the exact page a Play link was clicked on) in the admin view.

begin;

-- ---------------------------------------------------------------------------
-- 1. Daily app opens
-- ---------------------------------------------------------------------------
create table if not exists public.user_activity_days (
    user_id uuid not null references auth.users(id) on delete cascade,
    day date not null,
    platform text not null check (platform in ('ios', 'android', 'web')),
    app_version text,
    created_at timestamptz not null default now(),
    primary key (user_id, day, platform)
);

create index if not exists user_activity_days_day_idx on public.user_activity_days (day);

alter table public.user_activity_days enable row level security;
revoke all on public.user_activity_days from public, anon, authenticated;
grant all on public.user_activity_days to service_role;

create or replace function public.log_user_activity_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.user_activity_days (user_id, day, platform, app_version)
    values (new.user_id, (new.last_seen_at at time zone 'Asia/Jakarta')::date, new.platform, new.app_version)
    on conflict (user_id, day, platform) do update set app_version = coalesce(excluded.app_version, user_activity_days.app_version);
    return new;
end;
$$;

drop trigger if exists user_devices_log_activity_day on public.user_devices;
create trigger user_devices_log_activity_day
after insert or update of last_seen_at on public.user_devices
for each row execute function public.log_user_activity_day();

-- What the device table already knows: the first and the latest open per account.
insert into public.user_activity_days (user_id, day, platform, app_version)
select user_id, (first_seen_at at time zone 'Asia/Jakarta')::date, platform, null from public.user_devices
union
select user_id, (last_seen_at at time zone 'Asia/Jakarta')::date, platform, app_version from public.user_devices
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Releases
-- ---------------------------------------------------------------------------
create table if not exists public.app_releases (
    platform text not null check (platform in ('ios', 'android')),
    version text not null,
    released_at timestamptz not null,
    -- 'store': the first user reported this version; 'build': the version bump commit.
    source text not null default 'store' check (source in ('store', 'build')),
    notes text,
    created_at timestamptz not null default now(),
    primary key (platform, version)
);

alter table public.app_releases enable row level security;
revoke all on public.app_releases from public, anon, authenticated;
grant all on public.app_releases to service_role;

create or replace function public.log_app_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.app_version is not null and new.platform in ('ios', 'android') then
        insert into public.app_releases (platform, version, released_at, source)
        values (new.platform, new.app_version, now(), 'store')
        on conflict (platform, version) do nothing;
    end if;
    return new;
end;
$$;

drop trigger if exists user_devices_log_app_release on public.user_devices;
create trigger user_devices_log_app_release
after insert or update of app_version on public.user_devices
for each row execute function public.log_app_release();

insert into public.app_releases (platform, version, released_at, source) values
    ('ios', '2.1', '2026-07-09T12:00:00+07:00', 'build'),
    ('ios', '2.3', '2026-07-13T12:00:00+07:00', 'build'),
    ('ios', '2.4', '2026-07-15T12:00:00+07:00', 'build'),
    ('ios', '2.6', '2026-07-25T12:00:00+07:00', 'build'),
    ('ios', '2.7', '2026-07-30T12:00:00+07:00', 'build'),
    ('ios', '2.8', '2026-08-06T12:00:00+07:00', 'build'),
    ('ios', '2.8.1', '2026-08-11T12:00:00+07:00', 'build'),
    ('ios', '2.9', '2026-09-22T12:00:00+07:00', 'build'),
    ('ios', '3.0', '2026-10-10T12:00:00+07:00', 'build'),
    ('ios', '3.0.2', '2026-10-12T12:00:00+07:00', 'build'),
    ('ios', '3.0.4', '2026-10-19T12:00:00+07:00', 'build'),
    ('ios', '3.1.0', '2026-10-29T12:00:00+07:00', 'build'),
    ('ios', '3.2', '2026-10-30T12:00:00+07:00', 'build'),
    ('android', '1.0.0', '2026-06-14T12:00:00+07:00', 'build'),
    ('android', '1.0.1', '2026-06-24T12:00:00+07:00', 'build'),
    ('android', '2.0.0', '2026-07-09T12:00:00+07:00', 'build'),
    ('android', '2.4.0', '2026-07-27T12:00:00+07:00', 'build'),
    ('android', '2.8.0', '2026-08-06T12:00:00+07:00', 'build'),
    ('android', '2.8.1', '2026-08-23T12:00:00+07:00', 'build'),
    ('android', '2.9.0', '2026-09-29T12:00:00+07:00', 'build'),
    ('android', '3.0', '2026-10-07T12:00:00+07:00', 'build'),
    ('android', '3.0.2', '2026-10-12T12:00:00+07:00', 'build'),
    ('android', '3.0.3', '2026-10-19T12:00:00+07:00', 'build'),
    ('android', '3.1.0', '2026-10-24T12:00:00+07:00', 'build'),
    ('android', '3.2.0', '2026-10-30T12:00:00+07:00', 'build')
on conflict (platform, version) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Chart markers
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_annotations (
    id uuid primary key default gen_random_uuid(),
    day date not null,
    platform text check (platform in ('ios', 'android', 'web')),
    label text not null check (char_length(label) between 1 and 120),
    created_by text,
    created_at timestamptz not null default now()
);

create index if not exists analytics_annotations_day_idx on public.analytics_annotations (day);

alter table public.analytics_annotations enable row level security;
revoke all on public.analytics_annotations from public, anon, authenticated;
grant all on public.analytics_annotations to service_role;

-- ---------------------------------------------------------------------------
-- 4. Web first touch
-- ---------------------------------------------------------------------------
alter table public.user_acquisition add column if not exists landing_path text;
alter table public.user_acquisition add column if not exists referrer_host text;

create or replace function public.record_user_acquisition(
    p_platform text,
    p_self_reported_source text default null,
    p_self_reported_detail text default null,
    p_install_referrer text default null,
    p_apple_ads jsonb default null,
    p_utm jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_has_store boolean := p_install_referrer is not null or p_apple_ads is not null or p_utm is not null;
    v_referrer text := left(nullif(btrim(p_install_referrer), ''), 1000);
begin
    if v_user is null then
        raise exception 'not_authenticated' using errcode = '28000';
    end if;
    if p_platform is null or p_platform not in ('ios', 'android', 'web') then
        raise exception 'invalid_platform' using errcode = '22023';
    end if;
    if p_self_reported_source is not null and p_self_reported_source not in (
        'tiktok', 'instagram', 'youtube', 'facebook', 'x', 'reddit',
        'google_search', 'app_store', 'play_store', 'friend', 'press', 'other', 'skipped'
    ) then
        raise exception 'invalid_self_reported_source' using errcode = '22023';
    end if;

    insert into public.user_acquisition (user_id, first_platform)
    values (v_user, p_platform)
    on conflict (user_id) do nothing;

    -- A skipped question may be answered later; a real answer is never overwritten.
    if p_self_reported_source is not null then
        update public.user_acquisition
        set self_reported_source = p_self_reported_source,
            self_reported_detail = left(nullif(btrim(p_self_reported_detail), ''), 200),
            self_reported_at = now(),
            updated_at = now()
        where user_id = v_user
          and (self_reported_source is null or self_reported_source = 'skipped');
    end if;

    -- Store attribution is first-touch: the first report for the account wins.
    if v_has_store then
        update public.user_acquisition
        set install_referrer = v_referrer,
            utm_source = coalesce(public.growth_referrer_param(v_referrer, 'utm_source'), left(p_utm->>'utm_source', 200)),
            utm_medium = coalesce(public.growth_referrer_param(v_referrer, 'utm_medium'), left(p_utm->>'utm_medium', 200)),
            utm_campaign = coalesce(public.growth_referrer_param(v_referrer, 'utm_campaign'), left(p_utm->>'utm_campaign', 200)),
            utm_content = coalesce(public.growth_referrer_param(v_referrer, 'utm_content'), left(p_utm->>'utm_content', 200)),
            utm_term = coalesce(public.growth_referrer_param(v_referrer, 'utm_term'), left(p_utm->>'utm_term', 200)),
            gclid = coalesce(public.growth_referrer_param(v_referrer, 'gclid'), left(p_utm->>'gclid', 200)),
            landing_path = left(nullif(btrim(p_utm->>'landing_path'), ''), 300),
            referrer_host = left(nullif(btrim(p_utm->>'referrer_host'), ''), 200),
            apple_ads = p_apple_ads,
            apple_ads_attributed = case
                when p_apple_ads ? 'attribution' then (p_apple_ads->>'attribution')::boolean
                else null
            end,
            apple_ads_campaign_id = nullif(p_apple_ads->>'campaignId', ''),
            store_attribution_at = now(),
            updated_at = now()
        where user_id = v_user
          and store_attribution_at is null;
    end if;
end;
$$;

revoke all on function public.record_user_acquisition(text, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.record_user_acquisition(text, text, text, text, jsonb, jsonb) to authenticated;

-- Same view, three columns appended at the end (create or replace can only add).
create or replace view public.admin_user_growth_v1 as
with devices as (
    select
        user_id,
        (array_agg(platform order by first_seen_at))[1] as first_reported_platform,
        min(first_seen_at) as first_reported_at,
        array_agg(distinct platform) as reported_platforms,
        max(last_seen_at) as last_seen_at
    from public.user_devices
    group by user_id
)
select
    p.id as user_id,
    p.created_at,
    d.first_reported_platform,
    d.first_reported_at,
    d.reported_platforms,
    d.last_seen_at,
    exists (select 1 from public.user_push_tokens t where t.user_id = p.id) as has_apns_token,
    exists (
        select 1 from public.app_store_purchases s
        where s.user_id = p.id and s.environment = 'Production'
    ) as has_app_store_purchase,
    exists (
        select 1 from public.credit_transactions c
        where c.user_id = p.id and c.reason = 'purchase'
          and c.metadata->>'source' in ('play_billing', 'google_play', 'google_play_billing')
    ) or coalesce(e.entitlements ? 'google_play_pro', false) as has_play_purchase,
    coalesce(u.raw_app_meta_data->'providers', jsonb_build_array(u.raw_app_meta_data->>'provider')) as auth_providers,
    a.first_platform as acquisition_platform,
    a.self_reported_source,
    a.self_reported_detail,
    a.install_referrer,
    a.utm_source,
    a.utm_medium,
    a.utm_campaign,
    a.gclid,
    a.apple_ads_attributed,
    a.apple_ads_campaign_id,
    a.store_attribution_at,
    a.utm_content,
    a.landing_path,
    a.referrer_host
from public.profiles p
left join devices d on d.user_id = p.id
left join auth.users u on u.id = p.id
left join public.subscriber_entitlements e on e.user_id = p.id
left join public.user_acquisition a on a.user_id = p.id;

revoke all on public.admin_user_growth_v1 from public, anon, authenticated;
grant select on public.admin_user_growth_v1 to service_role;

commit;

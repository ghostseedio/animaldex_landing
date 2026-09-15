-- Growth platform + acquisition attribution.
--
-- Additive. The iOS / Android / web apps report which platform each account uses
-- (record_user_device) and, once, how the account was acquired
-- (record_user_acquisition). /admin/metrics reads admin_user_growth_v1 with the
-- service role and infers a platform for accounts that pre-date app reporting
-- from device-only evidence (APNs token, App Store purchase, Play entitlement,
-- Sign in with Apple).
--
-- Paid log rows gain an OS and platform-reported installs so spend can be split
-- Android vs iOS. The web API deletes a day's spend rows before inserting, so it
-- works before and after the unique key below changes.

begin;

-- ---------------------------------------------------------------------------
-- Devices: one row per account per platform
-- ---------------------------------------------------------------------------
create table if not exists public.user_devices (
    user_id uuid not null references auth.users(id) on delete cascade,
    platform text not null check (platform in ('ios', 'android', 'web')),
    app_version text,
    build_number text,
    os_version text,
    device_model text,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    primary key (user_id, platform)
);

create index if not exists user_devices_first_seen_idx on public.user_devices (first_seen_at);

alter table public.user_devices enable row level security;
revoke all on public.user_devices from public, anon, authenticated;
grant all on public.user_devices to service_role;

create or replace function public.record_user_device(
    p_platform text,
    p_app_version text default null,
    p_build_number text default null,
    p_os_version text default null,
    p_device_model text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
begin
    if v_user is null then
        raise exception 'not_authenticated' using errcode = '28000';
    end if;
    if p_platform is null or p_platform not in ('ios', 'android', 'web') then
        raise exception 'invalid_platform' using errcode = '22023';
    end if;

    insert into public.user_devices as d (
        user_id, platform, app_version, build_number, os_version, device_model
    )
    values (
        v_user,
        p_platform,
        left(nullif(btrim(p_app_version), ''), 40),
        left(nullif(btrim(p_build_number), ''), 40),
        left(nullif(btrim(p_os_version), ''), 40),
        left(nullif(btrim(p_device_model), ''), 80)
    )
    on conflict (user_id, platform) do update set
        app_version = coalesce(excluded.app_version, d.app_version),
        build_number = coalesce(excluded.build_number, d.build_number),
        os_version = coalesce(excluded.os_version, d.os_version),
        device_model = coalesce(excluded.device_model, d.device_model),
        last_seen_at = now();
end;
$$;

revoke all on function public.record_user_device(text, text, text, text, text) from public, anon;
grant execute on function public.record_user_device(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Acquisition: first-touch store attribution + self-reported source
-- ---------------------------------------------------------------------------
create table if not exists public.user_acquisition (
    user_id uuid primary key references auth.users(id) on delete cascade,
    first_platform text check (first_platform in ('ios', 'android', 'web')),
    self_reported_source text check (self_reported_source in (
        'tiktok', 'instagram', 'youtube', 'facebook', 'x', 'reddit',
        'google_search', 'app_store', 'play_store', 'friend', 'press', 'other', 'skipped'
    )),
    self_reported_detail text,
    self_reported_at timestamptz,
    install_referrer text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    gclid text,
    apple_ads jsonb,
    apple_ads_attributed boolean,
    apple_ads_campaign_id text,
    store_attribution_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.user_acquisition enable row level security;
revoke all on public.user_acquisition from public, anon, authenticated;
grant all on public.user_acquisition to service_role;

-- Reads one key from a query-string-shaped referrer such as
-- "utm_source=google-play&utm_medium=organic" (Play Install Referrer format).
create or replace function public.growth_referrer_param(p_referrer text, p_key text)
returns text
language sql
immutable
as $$
    select nullif(
        left(replace(substring(coalesce(p_referrer, '') from '(?:^|[&?])' || p_key || '=([^&]*)'), '+', ' '), 200),
        ''
    );
$$;

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

-- ---------------------------------------------------------------------------
-- Paid log: OS + platform-reported installs per spend row
-- ---------------------------------------------------------------------------
-- Some environments never received the spend table from
-- 20260826090000_growth_command_center.sql; create it here in its final shape.
create table if not exists public.growth_marketing_daily_spend (
    id uuid primary key default gen_random_uuid(),
    date date not null references public.growth_marketing_daily(date) on delete cascade,
    platform text not null check (platform in ('google_ads', 'tiktok_ads', 'apple_search_ads', 'meta_ads', 'other')),
    amount numeric(18,2) not null check (amount >= 0),
    currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
    os text not null default 'unknown',
    reported_installs integer,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists growth_marketing_daily_spend_date_idx
    on public.growth_marketing_daily_spend (date);

alter table public.growth_marketing_daily_spend enable row level security;

alter table public.growth_marketing_daily_spend
    add column if not exists os text not null default 'unknown',
    add column if not exists reported_installs integer;

do $$
begin
    alter table public.growth_marketing_daily_spend
        add constraint growth_marketing_daily_spend_os_check
        check (os in ('ios', 'android', 'web', 'mixed', 'unknown'));
exception when duplicate_object then null;
end $$;

do $$
begin
    alter table public.growth_marketing_daily_spend
        add constraint growth_marketing_daily_spend_installs_check
        check (reported_installs is null or reported_installs >= 0);
exception when duplicate_object then null;
end $$;

-- Apple Search Ads only serves iOS; AnimalDex Google Ads campaigns are Android app campaigns.
update public.growth_marketing_daily_spend
set os = case platform when 'apple_search_ads' then 'ios' when 'google_ads' then 'android' else os end
where os = 'unknown';

do $$
declare
    c record;
begin
    for c in
        select conname
        from pg_constraint
        where conrelid = 'public.growth_marketing_daily_spend'::regclass
          and contype = 'u'
          and conname <> 'growth_marketing_daily_spend_date_platform_os_currency_key'
    loop
        execute format('alter table public.growth_marketing_daily_spend drop constraint %I', c.conname);
    end loop;
end $$;

do $$
begin
    alter table public.growth_marketing_daily_spend
        add constraint growth_marketing_daily_spend_date_platform_os_currency_key
        unique (date, platform, os, currency_code);
exception when duplicate_object or duplicate_table then null;
end $$;

-- Historical imports: tag the OS a source can only serve.
alter table public.growth_marketing_snapshots
    add column if not exists os text;

do $$
begin
    alter table public.growth_marketing_snapshots
        add constraint growth_marketing_snapshots_os_check
        check (os is null or os in ('ios', 'android', 'web', 'mixed', 'unknown'));
exception when duplicate_object then null;
end $$;

update public.growth_marketing_snapshots set os = 'ios' where source = 'apple_search_ads' and os is null;
update public.growth_marketing_snapshots set os = 'android' where source = 'google_ads' and os is null;

-- ---------------------------------------------------------------------------
-- Admin read model: one row per profile with every platform/acquisition signal
-- ---------------------------------------------------------------------------
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
    a.store_attribution_at
from public.profiles p
left join devices d on d.user_id = p.id
left join auth.users u on u.id = p.id
left join public.subscriber_entitlements e on e.user_id = p.id
left join public.user_acquisition a on a.user_id = p.id;

revoke all on public.admin_user_growth_v1 from public, anon, authenticated;
grant select on public.admin_user_growth_v1 to service_role;

commit;

-- Historical external marketing snapshots from August 2026 screenshots.
-- Paste into Supabase SQL Editor. This is idempotent and does not seed
-- AnimalDex automatic metrics.

create table if not exists public.growth_marketing_snapshots (
    id uuid primary key default gen_random_uuid(),
    source text not null,
    period_start date not null,
    period_end date not null,
    metric text not null,
    value numeric(18,4) not null check (value >= 0),
    currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
    aggregation_role text not null default 'primary' check (aggregation_role in ('primary', 'supporting')),
    metadata jsonb not null default '{}'::jsonb,
    captured_at timestamptz not null default now(),
    notes text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint growth_marketing_snapshots_period_check check (period_end >= period_start),
    constraint growth_marketing_snapshots_unique unique (source, period_start, period_end, metric)
);

create index if not exists growth_marketing_snapshots_period_idx
    on public.growth_marketing_snapshots (period_start, period_end, source);

alter table public.growth_marketing_snapshots
    add column if not exists aggregation_role text not null default 'primary' check (aggregation_role in ('primary', 'supporting'));

alter table public.growth_marketing_snapshots enable row level security;

insert into public.growth_marketing_snapshots
    (source, period_start, period_end, metric, value, currency, aggregation_role, metadata, captured_at, notes)
values
    ('google_search_console', date '2026-07-29', date '2026-08-25', 'clicks', 568, null, 'primary', '{"impressions":38500,"source_type":"organic_search"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from Search Console 28-day screenshot. Organic search, not ads.'),
    ('google_search_console', date '2026-07-29', date '2026-08-25', 'impressions', 38500, null, 'primary', '{"clicks":568,"source_type":"organic_search"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from Search Console 28-day screenshot.'),

    ('tiktok_organic', date '2026-07-28', date '2026-08-24', 'video_views', 186600, null, 'primary', '{"profile_views":1600,"likes":1500,"comments":67,"shares":585,"estimated_rewards":{"amount":0,"currency":"USD"},"source_type":"organic_social"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from TikTok Studio 28-day screenshot. Profile views are not website visits.'),
    ('tiktok_organic', date '2026-07-28', date '2026-08-24', 'profile_views', 1600, null, 'primary', '{"source_type":"organic_social"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from TikTok Studio. Do not treat as website visits.'),
    ('tiktok_organic', date '2026-07-28', date '2026-08-24', 'likes', 1500, null, 'primary', '{"source_type":"organic_social"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from TikTok Studio.'),
    ('tiktok_organic', date '2026-07-28', date '2026-08-24', 'comments', 67, null, 'primary', '{"source_type":"organic_social"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from TikTok Studio.'),
    ('tiktok_organic', date '2026-07-28', date '2026-08-24', 'shares', 585, null, 'primary', '{"source_type":"organic_social"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from TikTok Studio.'),
    ('tiktok_organic', date '2026-07-28', date '2026-08-24', 'estimated_rewards', 0, 'USD', 'primary', '{"source_type":"organic_social"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from TikTok Studio.'),

    ('tiktok_ads', date '2026-07-27', date '2026-08-25', 'spend', 41.25, 'GBP', 'primary', '{"impressions":34034,"destination_clicks":2821,"displayed_destination_cpc_gbp":0.01,"displayed_cpm_gbp":1.21,"source_type":"paid_ads"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from TikTok Ads screenshot. CPC should be derived from spend/clicks when needed.'),
    ('tiktok_ads', date '2026-07-27', date '2026-08-25', 'impressions', 34034, null, 'primary', '{"spend":{"amount":41.25,"currency":"GBP"},"source_type":"paid_ads"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from TikTok Ads screenshot.'),
    ('tiktok_ads', date '2026-07-27', date '2026-08-25', 'destination_clicks', 2821, null, 'primary', '{"spend":{"amount":41.25,"currency":"GBP"},"source_type":"paid_ads"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from TikTok Ads screenshot. Do not treat as installs or users.'),

    ('google_ads', date '2026-07-27', date '2026-08-25', 'spend', 2155324, 'IDR', 'primary', '{"impressions":80314,"clicks_approx":3010,"conversions":498,"reported_average_cpc_idr":716,"campaigns":[{"name":"AnimalDex Android Install Campaign - Asia","installs":498,"reported_cost_per_install_idr":1595},{"name":"AnimalDex | iOS | Install Volume | iOS Locations | Jun 2026","installs":0}],"source_type":"paid_ads"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical account-level import from Google Ads. Campaign values are metadata only and must not be double-counted.'),
    ('google_ads', date '2026-07-27', date '2026-08-25', 'impressions', 80314, null, 'primary', '{"source_type":"paid_ads"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical account-level import from Google Ads.'),
    ('google_ads', date '2026-07-27', date '2026-08-25', 'clicks', 3010, null, 'primary', '{"approximate":true,"source_type":"paid_ads"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical account-level import from Google Ads. Approximate screenshot value.'),
    ('google_ads', date '2026-07-27', date '2026-08-25', 'installs', 498, null, 'primary', '{"campaign":"AnimalDex Android Install Campaign - Asia","ios_installs":0,"source_type":"paid_ads"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical Google Ads conversions reported as installs. Not verified as AnimalDex users.'),

    ('google_ads', date '2026-08-17', date '2026-08-23', 'spend', 504370, 'IDR', 'supporting', '{"impressions":13274,"conversions":110,"android":{"spend_idr":163548,"installs":110,"reported_cost_per_install_idr":1487},"ios":{"spend_idr":340822,"installs":0},"source_type":"paid_ads","overlaps_main_period":true,"do_not_sum_with_main":true}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Supporting Google Ads screenshot. Overlaps the Jul 27-Aug 25 Google Ads import; source evidence only, do not sum with main period.'),
    ('google_ads', date '2026-08-17', date '2026-08-23', 'impressions', 13274, null, 'supporting', '{"source_type":"paid_ads","overlaps_main_period":true,"do_not_sum_with_main":true}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Supporting Google Ads screenshot. Overlaps the main Google Ads import; source evidence only.'),
    ('google_ads', date '2026-08-17', date '2026-08-23', 'installs', 110, null, 'supporting', '{"android_installs":110,"ios_installs":0,"source_type":"paid_ads","overlaps_main_period":true,"do_not_sum_with_main":true}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Supporting Google Ads screenshot. Overlaps the main Google Ads import; source evidence only.'),

    ('apple_search_ads', date '2026-07-27', date '2026-08-25', 'spend', 9.04, 'GBP', 'primary', '{"impressions":603,"taps":22,"installs":9,"average_cpa_gbp":1.00,"average_cpt_gbp":0.41,"average_cpm_gbp":14.99,"ttr_percent":3.65,"campaign":"PokemonGO","source_type":"paid_ads"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from Apple Search Ads screenshot. Account was on hold in screenshot.'),
    ('apple_search_ads', date '2026-07-27', date '2026-08-25', 'impressions', 603, null, 'primary', '{"campaign":"PokemonGO","source_type":"paid_ads"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from Apple Search Ads screenshot.'),
    ('apple_search_ads', date '2026-07-27', date '2026-08-25', 'taps', 22, null, 'primary', '{"campaign":"PokemonGO","source_type":"paid_ads"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical import from Apple Search Ads screenshot.'),
    ('apple_search_ads', date '2026-07-27', date '2026-08-25', 'installs', 9, null, 'primary', '{"campaign":"PokemonGO","source_type":"paid_ads"}'::jsonb, timestamptz '2026-08-26 00:00:00+07', 'Historical Apple Search Ads reported installs. Not verified as AnimalDex users.')
on conflict (source, period_start, period_end, metric) do update set
    value = excluded.value,
    currency = excluded.currency,
    aggregation_role = excluded.aggregation_role,
    metadata = excluded.metadata,
    captured_at = excluded.captured_at,
    notes = excluded.notes,
    updated_at = now();

select
    source,
    period_start,
    period_end,
    metric,
    value,
    currency,
    aggregation_role,
    metadata,
    notes
from public.growth_marketing_snapshots
where period_start <= date '2026-08-31'
  and period_end >= date '2026-08-01'
order by source, period_start, period_end, metric;

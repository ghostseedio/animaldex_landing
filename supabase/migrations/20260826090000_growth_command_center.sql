create table if not exists public.growth_monthly_plans (
    id uuid primary key default gen_random_uuid(),
    month date not null unique,
    targets jsonb not null default '{}'::jsonb,
    weekly_targets jsonb not null default '[]'::jsonb,
    weekly_action_plans jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.growth_marketing_daily (
    date date primary key,
    social_views bigint not null default 0 check (social_views >= 0),
    search_clicks bigint not null default 0 check (search_clicks >= 0),
    ad_spend numeric(12,2) not null default 0 check (ad_spend >= 0),
    paid_users integer not null default 0 check (paid_users >= 0),
    short_videos integer not null default 0 check (short_videos >= 0),
    seo_pages integer not null default 0 check (seo_pages >= 0),
    notes text not null default '',
    updated_at timestamptz not null default now(),
    updated_by text
);

create table if not exists public.growth_marketing_daily_spend (
    id uuid primary key default gen_random_uuid(),
    date date not null references public.growth_marketing_daily(date) on delete cascade,
    platform text not null check (platform in ('google_ads', 'tiktok_ads', 'apple_search_ads', 'meta_ads', 'other')),
    amount numeric(18,2) not null check (amount >= 0),
    currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (date, platform, currency_code)
);

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

alter table public.growth_marketing_daily
    add column if not exists short_videos integer not null default 0 check (short_videos >= 0),
    add column if not exists seo_pages integer not null default 0 check (seo_pages >= 0);

alter table public.growth_marketing_snapshots
    add column if not exists aggregation_role text not null default 'primary' check (aggregation_role in ('primary', 'supporting'));

create index if not exists growth_monthly_plans_month_idx
    on public.growth_monthly_plans (month);

create index if not exists growth_marketing_daily_date_idx
    on public.growth_marketing_daily (date);

create index if not exists growth_marketing_daily_spend_date_idx
    on public.growth_marketing_daily_spend (date);

create index if not exists growth_marketing_snapshots_period_idx
    on public.growth_marketing_snapshots (period_start, period_end, source);

alter table public.growth_monthly_plans enable row level security;
alter table public.growth_marketing_daily enable row level security;
alter table public.growth_marketing_daily_spend enable row level security;
alter table public.growth_marketing_snapshots enable row level security;

insert into public.growth_monthly_plans (month, targets, weekly_targets, weekly_action_plans)
values (
    date '2026-09-01',
    '{
        "users": 1500,
        "captures": 5000,
        "socialViews": 300000,
        "searchClicks": 900,
        "activePro": 10,
        "adSpend": 150,
        "shortVideos": 90,
        "seoPages": 8
    }'::jsonb,
    '[
        {"label":"Week 1","startDay":1,"endDay":6,"targets":{"users":300,"captures":1000,"socialViews":60000,"searchClicks":180,"activePro":3,"adSpend":30,"shortVideos":18,"seoPages":2}},
        {"label":"Week 2","startDay":7,"endDay":13,"targets":{"users":350,"captures":1167,"socialViews":70000,"searchClicks":210,"activePro":5,"adSpend":35,"shortVideos":21,"seoPages":2}},
        {"label":"Week 3","startDay":14,"endDay":20,"targets":{"users":350,"captures":1167,"socialViews":70000,"searchClicks":210,"activePro":7,"adSpend":35,"shortVideos":21,"seoPages":2}},
        {"label":"Week 4","startDay":21,"endDay":27,"targets":{"users":350,"captures":1167,"socialViews":70000,"searchClicks":210,"activePro":9,"adSpend":35,"shortVideos":21,"seoPages":2}},
        {"label":"Week 5","startDay":28,"endDay":30,"targets":{"users":150,"captures":499,"socialViews":30000,"searchClicks":90,"activePro":10,"adSpend":15,"shortVideos":9,"seoPages":0}}
    ]'::jsonb,
    '[
        {"label":"Sep 1-6 - FOUNDATION","startDay":1,"endDay":6,"items":["Finish/ship Android + iOS update","Ensure marketing attribution is usable","3 original short videos/day minimum","Cross-post successful videos","Publish 2 SEO pages","Keep ads small until measurement works"]},
        {"label":"Sep 7-13 - TEST","startDay":7,"endDay":13,"items":["3-5 original shorts/day","Test 3 repeatable hooks","Publish 2 SEO pages","Run measured Google Android ads plus one other paid test","Check signup -> first capture -> battle usage","Identify the best acquisition source"]},
        {"label":"Sep 14-20 - DOUBLE DOWN","startDay":14,"endDay":20,"items":["Put the majority of marketing effort into the previous week''s winner","Make variants of the top-performing content","Publish 2 SEO pages in proven search clusters","Stop clearly weak paid tests","Fix the largest activation/retention weakness"]},
        {"label":"Sep 21-27 - SCALE WINNERS","startDay":21,"endDay":27,"items":["Repeat proven formats aggressively","3-5 shorts/day","Put paid budget into the best measured acquisition source","Publish 2 SEO pages","Keep product stable except conversion blockers"]},
        {"label":"Sep 28-30 - REVIEW","startDay":28,"endDay":30,"items":["Close the remaining user gap","Continue only proven marketing","Record final channel performance","Decide the #1 October growth engine"]}
    ]'::jsonb
)
on conflict (month) do nothing;

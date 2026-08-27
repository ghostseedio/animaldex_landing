create table if not exists public.growth_north_star (
    id text primary key default 'default' check (id = 'default'),
    target_users integer not null check (target_users > 0),
    target_date date not null,
    growth_model text not null default 'ramp' check (growth_model in ('linear', 'ramp')),
    ramp_percent numeric(6,2) not null default 20 check (ramp_percent >= 0),
    updated_at timestamptz not null default now(),
    updated_by text
);

create table if not exists public.growth_marketing_daily_organic (
    id uuid primary key default gen_random_uuid(),
    date date not null references public.growth_marketing_daily(date) on delete cascade,
    platform text not null check (platform in ('tiktok', 'instagram', 'youtube', 'facebook', 'reddit', 'other')),
    posts integer not null default 0 check (posts >= 0),
    views bigint not null default 0 check (views >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (date, platform)
);

create index if not exists growth_marketing_daily_organic_date_idx
    on public.growth_marketing_daily_organic (date);

alter table public.growth_north_star enable row level security;
alter table public.growth_marketing_daily_organic enable row level security;

create table if not exists public.growth_social_pages (
    id uuid primary key default gen_random_uuid(),
    platform text not null,
    page_name text not null,
    description text not null default '',
    posts_per_day integer not null default 1 check (posts_per_day >= 0),
    active boolean not null default true,
    notes text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

do $$
begin
    if not exists (
        select 1
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'growth_social_pages'
          and c.conname = 'growth_social_pages_platform_page_name_unique'
    ) then
        alter table public.growth_social_pages
            add constraint growth_social_pages_platform_page_name_unique unique (platform, page_name);
    end if;
end $$;

create table if not exists public.growth_social_idea_history (
    id uuid primary key default gen_random_uuid(),
    idea_date date not null,
    page_name text not null,
    platform text not null,
    title text not null,
    hook text not null default '',
    length_seconds integer not null default 0 check (length_seconds >= 0),
    tips text not null default '',
    status text not null default 'suggested' check (status in ('suggested', 'completed')),
    completed_at timestamptz,
    projected_views_24h bigint not null default 0
        constraint growth_social_idea_history_projected_views_check check (projected_views_24h >= 0),
    projection_confidence text not null default 'low'
        constraint growth_social_idea_history_projection_confidence_check check (projection_confidence in ('low', 'medium', 'high')),
    projection_reason text not null default '',
    actual_views_24h bigint
        constraint growth_social_idea_history_actual_views_check check (actual_views_24h is null or actual_views_24h >= 0),
    measured_at timestamptz,
    created_at timestamptz not null default now()
);

-- `create table if not exists` does not add newer columns to an existing
-- table, so keep upgrades idempotent for installations with the first schema.
alter table public.growth_social_idea_history
    add column if not exists status text not null default 'suggested',
    add column if not exists completed_at timestamptz,
    add column if not exists projected_views_24h bigint not null default 0,
    add column if not exists projection_confidence text not null default 'low',
    add column if not exists projection_reason text not null default '',
    add column if not exists actual_views_24h bigint,
    add column if not exists measured_at timestamptz;

do $$
begin
    if not exists (
        select 1
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'growth_social_idea_history'
          and c.conname = 'growth_social_idea_history_status_check'
    ) then
        alter table public.growth_social_idea_history
            add constraint growth_social_idea_history_status_check
            check (status in ('suggested', 'completed'));
    end if;
end $$;

create index if not exists growth_social_pages_active_idx
    on public.growth_social_pages (active, platform, page_name);

create index if not exists growth_social_idea_history_page_idx
    on public.growth_social_idea_history (page_name, idea_date desc);

create index if not exists growth_social_idea_history_completed_idx
    on public.growth_social_idea_history (status, page_name, title);

alter table public.growth_social_pages enable row level security;
alter table public.growth_social_idea_history enable row level security;

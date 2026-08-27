alter table public.growth_social_idea_history
    add column if not exists projected_views_24h bigint not null default 0,
    add column if not exists projection_confidence text not null default 'low',
    add column if not exists projection_reason text not null default '',
    add column if not exists actual_views_24h bigint,
    add column if not exists measured_at timestamptz;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'growth_social_idea_history_projected_views_check'
          and conrelid = 'public.growth_social_idea_history'::regclass
    ) then
        alter table public.growth_social_idea_history
            add constraint growth_social_idea_history_projected_views_check
            check (projected_views_24h >= 0);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'growth_social_idea_history_projection_confidence_check'
          and conrelid = 'public.growth_social_idea_history'::regclass
    ) then
        alter table public.growth_social_idea_history
            add constraint growth_social_idea_history_projection_confidence_check
            check (projection_confidence in ('low', 'medium', 'high'));
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'growth_social_idea_history_actual_views_check'
          and conrelid = 'public.growth_social_idea_history'::regclass
    ) then
        alter table public.growth_social_idea_history
            add constraint growth_social_idea_history_actual_views_check
            check (actual_views_24h is null or actual_views_24h >= 0);
    end if;
end $$;

create index if not exists growth_social_idea_history_performance_idx
    on public.growth_social_idea_history (page_name, platform, measured_at desc)
    where actual_views_24h is not null;

notify pgrst, 'reload schema';

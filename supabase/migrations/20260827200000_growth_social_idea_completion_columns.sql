alter table public.growth_social_idea_history
    add column if not exists status text not null default 'suggested',
    add column if not exists completed_at timestamptz;

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

create index if not exists growth_social_idea_history_completed_idx
    on public.growth_social_idea_history (status, page_name, title);

notify pgrst, 'reload schema';

-- Supports /admin/metrics collector lifecycle cohorts without changing capture semantics.
create index if not exists profiles_created_at_collector_analytics_idx
    on public.profiles (created_at, id);

create index if not exists captures_ready_created_at_collector_analytics_idx
    on public.captures (created_at, user_id)
    where status = 'ready';

create index if not exists captures_ready_user_created_at_collector_analytics_idx
    on public.captures (user_id, created_at)
    where status = 'ready';

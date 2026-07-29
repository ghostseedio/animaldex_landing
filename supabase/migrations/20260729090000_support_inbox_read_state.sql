alter table public.support_threads
    add column if not exists read_at timestamptz null;

create index if not exists support_threads_unread_idx
    on public.support_threads (read_at, updated_at desc);

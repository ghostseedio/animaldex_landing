create table if not exists public.admin_content_entries (
    id uuid primary key default gen_random_uuid(),
    content_type text not null check (content_type in ('blog', 'page')),
    slug text not null,
    payload jsonb not null default '{}'::jsonb,
    is_published boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (content_type, slug)
);

create index if not exists admin_content_entries_type_updated_idx
    on public.admin_content_entries (content_type, updated_at desc);

alter table public.admin_content_entries enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'admin-assets',
    'admin-assets',
    true,
    15728640,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads admin assets" on storage.objects;
create policy "Public reads admin assets"
    on storage.objects for select
    using (bucket_id = 'admin-assets');

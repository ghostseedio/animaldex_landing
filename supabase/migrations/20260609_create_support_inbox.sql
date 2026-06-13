create extension if not exists pgcrypto;

create table if not exists public.support_threads (
    id uuid primary key default gen_random_uuid(),
    customer_email text not null,
    customer_name text null,
    subject text null,
    status text not null default 'open',
    resend_received_email_id text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
    id uuid primary key default gen_random_uuid(),
    thread_id uuid not null references public.support_threads(id) on delete cascade,
    direction text not null check (direction in ('inbound', 'outbound')),
    from_email text not null,
    to_email text not null,
    subject text null,
    text_body text null,
    html_body text null,
    resend_email_id text null,
    raw_payload jsonb null,
    created_at timestamptz not null default now()
);

create table if not exists public.support_reply_tokens (
    id uuid primary key default gen_random_uuid(),
    thread_id uuid not null references public.support_threads(id) on delete cascade,
    token text not null unique,
    expires_at timestamptz not null,
    used_at timestamptz null,
    created_at timestamptz not null default now()
);

create index if not exists support_threads_customer_subject_idx
    on public.support_threads (customer_email, subject, status, updated_at desc);

create index if not exists support_messages_thread_created_idx
    on public.support_messages (thread_id, created_at asc);

create index if not exists support_reply_tokens_token_idx
    on public.support_reply_tokens (token);

create or replace function public.set_support_thread_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists support_threads_set_updated_at on public.support_threads;
create trigger support_threads_set_updated_at
    before update on public.support_threads
    for each row
    execute function public.set_support_thread_updated_at();

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_reply_tokens enable row level security;

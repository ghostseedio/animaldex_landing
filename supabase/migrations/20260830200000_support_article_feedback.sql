-- Help Center article helpfulness feedback (articles compiled from support-content.ts)

create table if not exists public.support_article_feedback (
    id uuid primary key default gen_random_uuid(),
    article_id text not null,
    helpful boolean not null,
    user_id uuid null references auth.users (id) on delete set null,
    session_key text null,
    source text not null default 'article-page',
    created_at timestamptz not null default now(),
    constraint support_article_feedback_identity check (
        user_id is not null or (session_key is not null and length(trim(session_key)) > 0)
    )
);

create index if not exists support_article_feedback_article_id_idx
    on public.support_article_feedback (article_id);

create index if not exists support_article_feedback_created_at_idx
    on public.support_article_feedback (created_at desc);

create unique index if not exists support_article_feedback_user_unique
    on public.support_article_feedback (article_id, user_id)
    where user_id is not null;

create unique index if not exists support_article_feedback_session_unique
    on public.support_article_feedback (article_id, session_key)
    where user_id is null and session_key is not null;

alter table public.support_article_feedback enable row level security;

comment on table public.support_article_feedback is
    'Helpful / not helpful votes for public Help Center articles keyed by canonical article_id.';

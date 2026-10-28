-- The social growth engine behind /admin/story-videos:
--
-- 1. Pinterest, Threads and Bluesky join the share log. They post through
--    Zernio (like TikTok), so they never get an admin_social_connections row.
-- 2. admin_social_content holds what is posted besides videos: image
--    carousels (slides rendered from a page) and text posts (hot takes, polls).
--    Rendered slides live in the public content-videos bucket under social/<id>/.
-- 3. admin_social_post_metrics keeps the latest numbers for each published
--    share (views, 3-second hold, completion…), refreshed by the metrics sync.
--    The hook lab learns from it which hook styles, lengths and endings work.
-- 4. Two more automation jobs log to admin_automation_runs.
--
-- Service role only, like the other admin_social tables.

ALTER TABLE public.admin_social_posts
    DROP CONSTRAINT IF EXISTS admin_social_posts_platform_known;

ALTER TABLE public.admin_social_posts
    ADD CONSTRAINT admin_social_posts_platform_known
        CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'facebook', 'x', 'pinterest', 'threads', 'bluesky'));

CREATE TABLE IF NOT EXISTS public.admin_social_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_slug TEXT NOT NULL,
    source_title TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ready',
    -- Carousel: {template, slides:[…]}. Text post: {format, text, long, poll}.
    spec JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Carousel only: rendered slide paths per size, {"feed": [...], "tall": [...], "pin": "..."}.
    images JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Per-platform copy, the same shape as a video's share copy.
    share JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- The hook-lab arms this item tests, e.g. {"hookStyle": "question"}.
    experiment JSONB,
    estimated_usd NUMERIC NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,

    CONSTRAINT admin_social_content_kind_known CHECK (kind IN ('carousel', 'text')),
    CONSTRAINT admin_social_content_status_known CHECK (status IN ('ready', 'failed'))
);

ALTER TABLE public.admin_social_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_social_content FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS admin_social_content_kind_created_idx
    ON public.admin_social_content (kind, created_at DESC);

COMMENT ON TABLE public.admin_social_content IS
    'Carousels and text posts for the official social accounts (/admin/story-videos). Service role only.';

CREATE TABLE IF NOT EXISTS public.admin_social_post_metrics (
    post_id UUID PRIMARY KEY REFERENCES public.admin_social_posts (id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Hours between publishing and this reading: young posts are not judged yet.
    age_hours NUMERIC,
    views BIGINT,
    likes BIGINT,
    comments BIGINT,
    shares BIGINT,
    saves BIGINT,
    follows BIGINT,
    -- Share of viewers still watching at 1 s / 3 s, and who reached the end (0–1).
    hold_1s NUMERIC,
    hold_3s NUMERIC,
    completion NUMERIC,
    avg_watch_seconds NUMERIC,
    -- YouTube: average percentage of the video watched (0–100).
    avg_view_pct NUMERIC,
    raw JSONB
);

ALTER TABLE public.admin_social_post_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_social_post_metrics FROM anon, authenticated;

COMMENT ON TABLE public.admin_social_post_metrics IS
    'Latest per-post numbers for published shares, refreshed by the social metrics sync. Service role only.';

ALTER TABLE public.admin_automation_runs
    DROP CONSTRAINT IF EXISTS admin_automation_runs_job_known;

ALTER TABLE public.admin_automation_runs
    ADD CONSTRAINT admin_automation_runs_job_known
        CHECK (job IN ('social-auto-share', 'video-auto-generate', 'blog-auto-generate', 'social-content-generate', 'social-metrics-sync'));

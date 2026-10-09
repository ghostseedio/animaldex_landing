-- Sharing generated story videos to the official AnimalDex social accounts
-- from /admin/story-videos.
--
-- admin_social_connections holds one OAuth connection per platform (the
-- official account). Tokens are AES-GCM encrypted by the landing server before
-- they are written, and the table has RLS on with no policies, so only the
-- service role can read it.
--
-- admin_social_posts is the share log: one row per (video, platform) attempt,
-- so the admin can see what went where and is stopped from posting the same
-- video to the same account twice. capture_id is kept so a post can be traced
-- back to the capture it came from.

CREATE TABLE IF NOT EXISTS public.admin_social_connections (
    platform TEXT PRIMARY KEY,
    account_id TEXT,
    account_name TEXT,
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT,
    expires_at TIMESTAMPTZ,
    scopes TEXT,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT admin_social_connections_platform_known
        CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'x'))
);

ALTER TABLE public.admin_social_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_social_connections FROM anon, authenticated;

COMMENT ON TABLE public.admin_social_connections IS
    'OAuth connection to each official AnimalDex social account; tokens encrypted by the landing server. Service role only.';

CREATE TABLE IF NOT EXISTS public.admin_social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    media_path TEXT NOT NULL,
    media_kind TEXT NOT NULL,
    species_profile_id UUID,
    species_name TEXT,
    page_slug TEXT,
    capture_id UUID,
    caption TEXT NOT NULL DEFAULT '',
    title TEXT,
    mode TEXT NOT NULL DEFAULT 'post',
    status TEXT NOT NULL DEFAULT 'queued',
    external_id TEXT,
    external_url TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT admin_social_posts_platform_known
        CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'x')),
    CONSTRAINT admin_social_posts_status_known
        CHECK (status IN ('queued', 'processing', 'published', 'failed')),
    CONSTRAINT admin_social_posts_mode_known
        CHECK (mode IN ('post', 'draft'))
);

ALTER TABLE public.admin_social_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_social_posts FROM anon, authenticated;

-- One live or successful post per video per account; failed rows can be retried.
CREATE UNIQUE INDEX IF NOT EXISTS admin_social_posts_one_per_platform_idx
    ON public.admin_social_posts (platform, media_path)
    WHERE status IN ('queued', 'processing', 'published');

CREATE INDEX IF NOT EXISTS admin_social_posts_created_idx
    ON public.admin_social_posts (created_at DESC);

COMMENT ON TABLE public.admin_social_posts IS
    'Share log for /admin/story-videos: one row per video per platform attempt. Service role only.';

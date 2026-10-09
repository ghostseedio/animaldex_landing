-- Per-post platform options chosen in the share dialog (for TikTok: privacy
-- level, comment/duet/stitch, commercial content disclosure), so the
-- background job publishes exactly what the admin picked.

ALTER TABLE public.admin_social_posts
    ADD COLUMN IF NOT EXISTS options JSONB;

-- A draft and a direct post of the same video are different actions (TikTok's
-- review even asks to see both), so uniqueness is per mode.
DROP INDEX IF EXISTS public.admin_social_posts_one_per_platform_idx;
CREATE UNIQUE INDEX IF NOT EXISTS admin_social_posts_one_per_platform_mode_idx
    ON public.admin_social_posts (platform, media_path, mode)
    WHERE status IN ('queued', 'processing', 'published');

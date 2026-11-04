-- The social auto-share's per-platform switches (/admin/story-videos,
-- src/lib/social/platform-pauses.ts): one row per platform and kind (video,
-- carousel, text) that the admin has turned on or off. With no row, the code's
-- default holds: X, Facebook and Pinterest paused, Instagram carousels paused,
-- everything else on. A paused row carries the reason the panel shows
-- ("credits depleted", "check this is the AnimalDex Page").
--
-- The landing server also writes a pause here when X answers 402 "credits
-- depleted", so the timer stops retrying until someone turns X back on.
-- Service role only, like the other admin_social tables.

CREATE TABLE IF NOT EXISTS public.admin_social_platform_settings (
    platform TEXT NOT NULL,
    kind TEXT NOT NULL,
    paused BOOLEAN NOT NULL,
    reason TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (platform, kind),

    CONSTRAINT admin_social_platform_settings_platform_known
        CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'facebook', 'x', 'pinterest', 'threads', 'bluesky')),
    CONSTRAINT admin_social_platform_settings_kind_known
        CHECK (kind IN ('video', 'carousel', 'text')),
    CONSTRAINT admin_social_platform_settings_reason_length
        CHECK (reason IS NULL OR char_length(reason) <= 200)
);

ALTER TABLE public.admin_social_platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_social_platform_settings FROM anon, authenticated;

COMMENT ON TABLE public.admin_social_platform_settings IS
    'Auto-share on/off per official social account and kind (video, carousel, text), set from /admin/story-videos; no row = the code default. Service role only.';

-- Adds Facebook (Page Reels) to the platforms /admin/story-videos can share to.

ALTER TABLE public.admin_social_connections
    DROP CONSTRAINT IF EXISTS admin_social_connections_platform_known,
    ADD CONSTRAINT admin_social_connections_platform_known
        CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'facebook', 'x'));

ALTER TABLE public.admin_social_posts
    DROP CONSTRAINT IF EXISTS admin_social_posts_platform_known,
    ADD CONSTRAINT admin_social_posts_platform_known
        CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'facebook', 'x'));

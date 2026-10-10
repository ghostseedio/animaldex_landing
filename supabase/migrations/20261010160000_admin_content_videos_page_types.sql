-- Page videos beyond blog posts: comparison battles, hybrid and fusion
-- reveals, ranking countdowns and location guides (/admin/story-videos).
-- Each family keeps one live video per page (the existing unique index is on
-- source_type + source_slug).

ALTER TABLE public.admin_content_videos
    DROP CONSTRAINT IF EXISTS admin_content_videos_source_type_known,
    ADD CONSTRAINT admin_content_videos_source_type_known
        CHECK (source_type IN ('blog', 'comparison', 'hybrid', 'fusion', 'ranking', 'location'));

-- The scan reveal (/admin/story-videos): our own footage of the app scanning
-- a real animal, made from an /animals page. Adds it to the source_type check
-- that 20261106124500 set.

ALTER TABLE public.admin_content_videos
    DROP CONSTRAINT IF EXISTS admin_content_videos_source_type_known,
    ADD CONSTRAINT admin_content_videos_source_type_known
        CHECK (source_type IN ('blog', 'comparison', 'hybrid', 'fusion', 'ranking', 'location', 'lesson', 'guess', 'scan'));

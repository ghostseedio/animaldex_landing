-- The format lab's new formats (/admin/story-videos): "what the <animal>
-- teaches you", a dark & gold lesson video made from an /animal-powers page,
-- and "guess the animal", clues then the reveal, made from an /animals page.
-- One live video per page per family, like every family (the unique index is
-- on source_type + source_slug).

ALTER TABLE public.admin_content_videos
    DROP CONSTRAINT IF EXISTS admin_content_videos_source_type_known,
    ADD CONSTRAINT admin_content_videos_source_type_known
        CHECK (source_type IN ('blog', 'comparison', 'hybrid', 'fusion', 'ranking', 'location', 'lesson', 'guess'));

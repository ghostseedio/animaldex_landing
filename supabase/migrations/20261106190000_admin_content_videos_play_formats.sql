-- The three play formats (/admin/story-videos): "You vs the animal" (from an
-- /animals page), "Would you rather" (from a comparison page) and real-life
-- Pokémon (from a /pokemon-animals page). Adds them to the source_type check
-- that 20261106150000 set.

ALTER TABLE public.admin_content_videos
    DROP CONSTRAINT IF EXISTS admin_content_videos_source_type_known,
    ADD CONSTRAINT admin_content_videos_source_type_known
        CHECK (source_type IN ('blog', 'comparison', 'hybrid', 'fusion', 'ranking', 'location', 'lesson', 'guess', 'scan', 'you_vs', 'would_you_rather', 'pokemon'));

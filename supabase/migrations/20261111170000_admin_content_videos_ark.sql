-- Ark clips as a content-video type (docs/ark-next.md, Part 4b; owner-approved
-- 2026-11-10). An `ark` row in admin_content_videos is a clip recorded from the
-- live Ark scene by the landing repo's recorder (scripts/ark-clips.mts), not a
-- video the AI maker built from a page: it arrives `ready`, unpublished, with
-- its MP4 and poster already in the public `content-videos` bucket under
-- `ark/<day>/`. Publishing it in /admin/story-videos puts it on
-- /videos/ark/<slug>, in the video sitemap and in the auto-share queue (daily
-- caps unchanged).
--
-- The same file is in the AnimalDex repo (branch `ark-marketing-clips`):
-- rehearse and apply it from there with supabase/scripts/db-migrate.sh. It is
-- here to keep the table's history in one place; applying it twice is harmless.
--
-- Only the source_type check changes: no row is written, nothing else moves.

ALTER TABLE public.admin_content_videos
    DROP CONSTRAINT IF EXISTS admin_content_videos_source_type_known,
    ADD CONSTRAINT admin_content_videos_source_type_known
        CHECK (source_type IN ('blog', 'comparison', 'hybrid', 'fusion', 'ranking', 'location', 'lesson', 'guess', 'scan', 'you_vs', 'would_you_rather', 'pokemon', 'ark'));

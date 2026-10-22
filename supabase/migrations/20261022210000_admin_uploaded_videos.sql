-- Finished videos made outside the site (travel vlogs, edits) uploaded in
-- /admin/story-videos so they share to the official accounts like any story
-- or page video. The file lives in the public content-videos bucket under
-- uploads/; the row holds its title, notes for drafting copy, and the last
-- drafted per-platform copy. Archiving hides it from the page and from new
-- shares; the share log keeps its rows.

CREATE TABLE IF NOT EXISTS public.admin_uploaded_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
    video_path TEXT NOT NULL UNIQUE CHECK (video_path LIKE 'uploads/%'),
    duration_seconds NUMERIC,
    size_bytes BIGINT,
    share JSONB,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_uploaded_videos_live_idx
    ON public.admin_uploaded_videos (created_at DESC)
    WHERE archived_at IS NULL;

ALTER TABLE public.admin_uploaded_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_uploaded_videos FROM anon, authenticated;

COMMENT ON TABLE public.admin_uploaded_videos IS
    'Videos uploaded in /admin/story-videos for sharing to the official social accounts. Service role only.';

-- Uploads go up to the share runner's 200 MB cap (src/lib/social/runner.ts).
UPDATE storage.buckets
SET file_size_limit = 209715200
WHERE id = 'content-videos';

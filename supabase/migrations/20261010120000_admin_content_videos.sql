-- Short vertical videos generated from AnimalDex blog posts in
-- /admin/story-videos ("Blog videos").
--
-- One row per generated video. The landing server's background runner moves
-- it through scripting (Claude → OpenAI → Gemini writes the script and shot
-- plan) → generating (Higgsfield image-to-video clips) → rendering (TTS +
-- ffmpeg) → ready. The finished MP4 and poster live in the public
-- `content-videos` bucket. A ready video appears on its blog post only once
-- an admin publishes it (published_at), and can be shared from the same page.
-- Re-editing a published video keeps the old file on the post until the new
-- one (a new path) is saved.
--
-- A source gets one live video: the unique index ignores archived rows, so
-- "Generate next" never picks a post that already has one, and archiving a
-- video is how a post is made eligible again.
--
-- RLS on with no policies: only the service role (the landing server) reads
-- or writes it, including the public blog page's server-side read.

CREATE TABLE IF NOT EXISTS public.admin_content_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL DEFAULT 'blog',
    source_slug TEXT NOT NULL,
    source_title TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'scripting',
    progress TEXT,
    plan JSONB,
    clips JSONB NOT NULL DEFAULT '[]'::jsonb,
    timeline JSONB,
    llm_provider TEXT,
    tts_provider TEXT,
    estimated_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
    video_path TEXT,
    poster_path TEXT,
    duration_seconds NUMERIC(8, 2),
    error TEXT,
    published_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT admin_content_videos_source_type_known
        CHECK (source_type IN ('blog')),
    CONSTRAINT admin_content_videos_status_known
        CHECK (status IN ('scripting', 'generating', 'rendering', 'ready', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_content_videos_one_live_per_source_idx
    ON public.admin_content_videos (source_type, source_slug)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS admin_content_videos_created_idx
    ON public.admin_content_videos (created_at DESC);

ALTER TABLE public.admin_content_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_content_videos FROM anon, authenticated;

COMMENT ON TABLE public.admin_content_videos IS
    'Short videos generated from blog posts in /admin/story-videos; published ones show on the post. Service role only.';

-- The rendered files. Public: the blog page plays them directly, and
-- Instagram/Facebook pull the file by URL when sharing.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('content-videos', 'content-videos', true, 104857600, ARRAY['video/mp4', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Shares of blog videos go in the existing share log as media_kind
-- 'blog_video' with no species; nothing in admin_social_posts needs changing.

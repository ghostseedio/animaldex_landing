-- The trend radar (src/lib/trend-radar): every few hours it reads science and
-- wildlife news feeds, Google's daily trending searches, Wikipedia's most-viewed
-- pages, Google autocomplete and the site's rising Search Console queries, and
-- Claude ranks what is worth an article now. The blog auto-generate writes the
-- best open topics; a very hot news story is written at once.
--
-- One row per article idea. Service role only.

CREATE TABLE IF NOT EXISTS public.admin_trend_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- news: time-sensitive (written within a day or two); evergreen: steady search demand.
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    primary_keyword TEXT NOT NULL,
    -- The blog generator's TopicIdea: {title, angle, hook, primaryKeyword, format, whyNow, sources}.
    idea JSONB NOT NULL,
    -- 1–10: search demand × freshness × shareability × fit with AnimalDex.
    score NUMERIC NOT NULL,
    -- Which radar sources pointed at it, e.g. {"feeds": ["Mongabay"], "googleTrends": "20K+"}.
    signals JSONB,
    status TEXT NOT NULL DEFAULT 'new',
    -- The article it became (/blog/<slug>) or why it was skipped.
    used_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT admin_trend_topics_kind_known CHECK (kind IN ('news', 'evergreen')),
    CONSTRAINT admin_trend_topics_status_known CHECK (status IN ('new', 'writing', 'used', 'skipped', 'expired'))
);

ALTER TABLE public.admin_trend_topics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_trend_topics FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS admin_trend_topics_open_idx
    ON public.admin_trend_topics (status, kind, score DESC);

COMMENT ON TABLE public.admin_trend_topics IS
    'Article ideas found by the trend radar (news feeds, Google Trends, Wikipedia, autocomplete, Search Console). Service role only.';

ALTER TABLE public.admin_automation_runs
    DROP CONSTRAINT IF EXISTS admin_automation_runs_job_known;

ALTER TABLE public.admin_automation_runs
    ADD CONSTRAINT admin_automation_runs_job_known
        CHECK (job IN ('social-auto-share', 'video-auto-generate', 'blog-auto-generate', 'social-content-generate', 'social-metrics-sync', 'trend-radar'));

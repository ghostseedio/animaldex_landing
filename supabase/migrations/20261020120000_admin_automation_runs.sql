-- One row per run of the VM-timer automations behind /admin/story-videos:
-- the social auto-share (every 2 hours) and the page-video auto-generate
-- (every 3 hours). Runs that do nothing are logged too, with the reason, so
-- the admin panel can show that the timer is alive and why it waited.
--
-- ref points at what the run acted on: the shared video's media_path, or the
-- admin_content_videos.id of the video it started. Service role only.

CREATE TABLE IF NOT EXISTS public.admin_automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job TEXT NOT NULL,
    outcome TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    ref TEXT,
    detail JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT admin_automation_runs_job_known
        CHECK (job IN ('social-auto-share', 'video-auto-generate')),
    CONSTRAINT admin_automation_runs_outcome_known
        CHECK (outcome IN ('acted', 'skipped', 'failed'))
);

ALTER TABLE public.admin_automation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_automation_runs FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS admin_automation_runs_job_created_idx
    ON public.admin_automation_runs (job, created_at DESC);

COMMENT ON TABLE public.admin_automation_runs IS
    'Run log of the social auto-share and page-video auto-generate timers (/admin/story-videos). Service role only.';

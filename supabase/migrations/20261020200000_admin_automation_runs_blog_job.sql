-- The blog auto-generate timer (daily, a "Latest news" article with a
-- random focus, published by /api/cron/blog-auto-generate) logs its runs to
-- admin_automation_runs alongside the other two timers.

ALTER TABLE public.admin_automation_runs
    DROP CONSTRAINT IF EXISTS admin_automation_runs_job_known;

ALTER TABLE public.admin_automation_runs
    ADD CONSTRAINT admin_automation_runs_job_known
        CHECK (job IN ('social-auto-share', 'video-auto-generate', 'blog-auto-generate'));

-- Scheduler visibility for /admin/jobs.
--
-- The 16 pg_cron jobs that run AnimalDex are scheduled from the AnimalDex
-- repo's migrations, and until now nothing could see whether they were still
-- running. /admin/reliability reads operation_failure_events, which is the
-- residue of work that *started*; a job whose schedule was dropped, whose
-- database role lost a grant, or that has been failing on every tick since
-- Tuesday leaves no row there at all. The silence looked identical to health.
--
-- pg_cron keeps both facts already — cron.job for the schedule, and
-- cron.job_run_details for each tick's outcome — but the cron schema is not
-- exposed to PostgREST, which is how every /api/admin route reads this
-- database. This is the one function that bridges it: read-only, security
-- definer so it can see a schema the service role cannot, and granted to
-- service_role alone so it is never reachable with an anon or user token.
--
-- Deliberately raw: the function returns the last run and a count of recent
-- failures per job and does not decide what "late" means. Working out whether
-- a job is overdue needs its cron expression interpreted, which is far easier
-- to write and to test in TypeScript than in SQL.

begin;

create or replace function public.admin_cron_job_health_v1(
    failure_window_hours integer default 24
)
returns table (
    jobid bigint,
    jobname text,
    schedule text,
    command text,
    active boolean,
    last_run_id bigint,
    last_status text,
    last_start_time timestamptz,
    last_end_time timestamptz,
    last_return_message text,
    last_success_at timestamptz,
    runs_in_window bigint,
    failures_in_window bigint
)
language sql
stable
security definer
set search_path = public, cron, pg_temp
as $$
    with window_bounds as (
        select now() - make_interval(hours => greatest(1, coalesce(failure_window_hours, 24))) as since
    ),
    -- One row per job: the most recent tick, whatever its outcome.
    last_run as (
        select distinct on (d.jobid)
            d.jobid, d.runid, d.status, d.start_time, d.end_time, d.return_message
        from cron.job_run_details d
        order by d.jobid, d.start_time desc
    ),
    -- Kept separate from last_run: a job that is failing right now still needs
    -- to show when it last worked, which is the first thing anyone asks.
    last_success as (
        select distinct on (d.jobid) d.jobid, d.start_time
        from cron.job_run_details d
        where d.status = 'succeeded'
        order by d.jobid, d.start_time desc
    ),
    window_counts as (
        select
            d.jobid,
            count(*) as runs_in_window,
            count(*) filter (where d.status <> 'succeeded') as failures_in_window
        from cron.job_run_details d, window_bounds w
        where d.start_time >= w.since
        group by d.jobid
    )
    select
        j.jobid,
        j.jobname::text,
        j.schedule::text,
        j.command::text,
        j.active,
        r.runid,
        r.status::text,
        r.start_time,
        r.end_time,
        r.return_message::text,
        s.start_time as last_success_at,
        coalesce(c.runs_in_window, 0),
        coalesce(c.failures_in_window, 0)
    from cron.job j
    left join last_run r on r.jobid = j.jobid
    left join last_success s on s.jobid = j.jobid
    left join window_counts c on c.jobid = j.jobid
    order by j.jobname;
$$;

comment on function public.admin_cron_job_health_v1(integer) is
    'Read-only pg_cron scheduler health for /admin/jobs. Service role only.';

-- security definer means the grant list is the whole access control, so it is
-- revoked from everyone before the one role that may call it gets it back.
revoke all on function public.admin_cron_job_health_v1(integer) from public;
revoke all on function public.admin_cron_job_health_v1(integer) from anon;
revoke all on function public.admin_cron_job_health_v1(integer) from authenticated;
grant execute on function public.admin_cron_job_health_v1(integer) to service_role;

commit;

import type {AutomationJob} from "@/lib/automation-runs";

// The VM timers' calendars (scripts/install-*-timer.sh), so the admin panel
// can say when the next run is. Keep in step with the OnCalendar lines:
//   social-auto-share    OnCalendar=*-*-* 00/2:25:00  (+ up to 5 min random delay)
//   video-auto-generate  OnCalendar=*-*-* 01/3:50:00  (+ up to 5 min random delay)
//   blog-auto-generate   OnCalendar=*-*-* 07:40:00    (+ up to 5 min random delay)

export const AUTOMATION_TIMERS: Record<AutomationJob, {firstHour: number; everyHours: number; minute: number}> = {
    "social-auto-share": {firstHour: 0, everyHours: 2, minute: 25},
    "video-auto-generate": {firstHour: 1, everyHours: 3, minute: 50},
    "blog-auto-generate": {firstHour: 7, everyHours: 24, minute: 40}
};

/** The next scheduled start (UTC) after `now`, before the timer's random delay. */
export function nextTimerRun(job: AutomationJob, now: Date) {
    const {firstHour, everyHours, minute} = AUTOMATION_TIMERS[job];
    const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    for (let dayOffset = 0; dayOffset < 2; dayOffset += 1) {
        for (let hour = firstHour; hour < 24; hour += everyHours) {
            const at = new Date(day + dayOffset * 86_400_000 + hour * 3_600_000 + minute * 60_000);
            if (at > now) return at;
        }
    }
    throw new Error("unreachable");
}

import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {describeSchedule, expectedIntervalSeconds, jobStatus, lateAfterSeconds, shortAgo} from "@/lib/cron-schedule";

describe("expectedIntervalSeconds", () => {
    it("reads pg_cron interval syntax", () => {
        assert.equal(expectedIntervalSeconds("5 seconds"), 5);
        assert.equal(expectedIntervalSeconds("10 seconds"), 10);
        assert.equal(expectedIntervalSeconds("2 minutes"), 120);
        assert.equal(expectedIntervalSeconds("1 hour"), 3600);
    });

    it("reads the five-field schedules this fleet uses", () => {
        assert.equal(expectedIntervalSeconds("* * * * *"), 60);
        assert.equal(expectedIntervalSeconds("*/5 * * * *"), 300);
        assert.equal(expectedIntervalSeconds("*/15 * * * *"), 900);
        assert.equal(expectedIntervalSeconds("15 * * * *"), 3600);
        assert.equal(expectedIntervalSeconds("47 3 * * *"), 86400);
        assert.equal(expectedIntervalSeconds("23 4 * * *"), 86400);
    });

    it("declines to guess rather than inventing an interval", () => {
        assert.equal(expectedIntervalSeconds("0 0 1 * *"), null, "monthly");
        assert.equal(expectedIntervalSeconds("0 9 * * 1"), null, "weekday-restricted");
        assert.equal(expectedIntervalSeconds("0,30 * * * *"), null, "minute list");
        assert.equal(expectedIntervalSeconds(""), null);
        assert.equal(expectedIntervalSeconds(null), null);
        assert.equal(expectedIntervalSeconds("0 seconds"), null, "a zero interval is not a schedule");
    });
});

describe("describeSchedule", () => {
    it("says the schedule the way an operator would", () => {
        assert.equal(describeSchedule("5 seconds"), "Every 5s");
        assert.equal(describeSchedule("* * * * *"), "Every 1m");
        assert.equal(describeSchedule("*/5 * * * *"), "Every 5m");
        assert.equal(describeSchedule("15 * * * *"), "Hourly at :15");
        assert.equal(describeSchedule("47 3 * * *"), "Daily at 03:47 UTC");
    });

    it("falls back to the raw expression it cannot phrase", () => {
        assert.equal(describeSchedule("0 9 * * 1"), "0 9 * * 1");
    });
});

describe("lateAfterSeconds", () => {
    it("is generous with fast jobs and tight with slow ones", () => {
        // A 5s drainer gets a full minute before anyone is told.
        assert.equal(lateAfterSeconds(5), 60);
        assert.equal(lateAfterSeconds(60), 360);
        assert.equal(lateAfterSeconds(900), 2700);
        assert.equal(lateAfterSeconds(86400), 129600);
    });
});

describe("jobStatus", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    const base = {active: true, schedule: "* * * * *", lastStatus: "succeeded", lastStartTime: "2026-09-25T11:59:30Z", failuresInWindow: 0};

    it("calls a recent successful run healthy", () => {
        const result = jobStatus(base, now);
        assert.equal(result.status, "healthy");
        assert.equal(result.secondsSinceLastRun, 30);
        assert.equal(result.lateBySeconds, null);
    });

    it("calls a job late once it passes its grace", () => {
        const result = jobStatus({...base, lastStartTime: "2026-09-25T11:50:00Z"}, now);
        assert.equal(result.status, "late");
        assert.equal(result.secondsSinceLastRun, 600);
        assert.equal(result.lateBySeconds, 240);
    });

    it("reports a failed last run as failing even when it is on time", () => {
        const result = jobStatus({...base, lastStatus: "failed", failuresInWindow: 12}, now);
        assert.equal(result.status, "failing");
    });

    it("treats a running tick as fine rather than as a failure", () => {
        assert.equal(jobStatus({...base, lastStatus: "running"}, now).status, "healthy");
    });

    it("does not call a paused job failing or late", () => {
        const result = jobStatus({...base, active: false, lastStatus: "failed", lastStartTime: "2026-09-01T00:00:00Z"}, now);
        assert.equal(result.status, "paused");
        assert.equal(result.lateBySeconds, null);
    });

    it("separates a job that has never run from one that is late", () => {
        const result = jobStatus({...base, lastStatus: null, lastStartTime: null}, now);
        assert.equal(result.status, "never-run");
        assert.equal(result.secondsSinceLastRun, null);
    });

    it("will not claim lateness for a schedule it cannot read", () => {
        const result = jobStatus({...base, schedule: "0 9 * * 1", lastStartTime: "2026-08-01T00:00:00Z"}, now);
        assert.equal(result.status, "healthy", "no interval means no lateness claim");
        assert.equal(result.lateBySeconds, null);
    });
});

describe("shortAgo", () => {
    it("stays short at every scale", () => {
        assert.equal(shortAgo(null), "Never");
        assert.equal(shortAgo(5), "5s ago");
        assert.equal(shortAgo(240), "4m ago");
        assert.equal(shortAgo(7200), "2h ago");
        assert.equal(shortAgo(172800), "2d ago");
    });
});

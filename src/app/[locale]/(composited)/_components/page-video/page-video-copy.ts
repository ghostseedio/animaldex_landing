import type {TimelineEntry} from "@/lib/content-video/plan";

export type PageVideoCopy = {kicker: string; blurb: string; footnote: string};

/** Key moments for the player: the beats with an on-screen label, never the winner reveal (that would spoil it). */
export function pageVideoChapters(timeline: TimelineEntry[]) {
    return timeline
        .filter((entry) => entry.kind === "scene" && entry.overlay && entry.overlayStyle !== "winner")
        .slice(0, 6)
        .map((entry) => ({start: entry.start, label: entry.overlay}));
}

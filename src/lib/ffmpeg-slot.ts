// The web server and every ffmpeg run share one small VM. On Nov 1 2026 a
// page-video encode starved Next.js until the health check restarted it
// (render, auto-share normalizing and an admin render could also all run at
// once). So every ffmpeg the server starts goes through here:
//   - one at a time per server process (a queue, not a refusal), and
//   - at the lowest CPU priority (nice 19), unless CONTENT_VIDEO_NICE=0.
// Encoders also pass "-threads 1", so one vCPU always stays with the web server.

const SLOT_KEY = Symbol.for("animaldex.ffmpegSlot");

type Slot = {tail: Promise<void>; waiting: number};

function slot(): Slot {
    const holder = globalThis as unknown as Record<symbol, Slot | undefined>;
    holder[SLOT_KEY] ??= {tail: Promise.resolve(), waiting: 0};
    return holder[SLOT_KEY] as Slot;
}

/** Runs `task` once every ffmpeg queued before it has finished. */
export function withFfmpegSlot<T>(task: () => Promise<T>): Promise<T> {
    const current = slot();
    current.waiting += 1;
    const run = current.tail.then(task, task);
    current.tail = run.then(
        () => {
            current.waiting -= 1;
        },
        () => {
            current.waiting -= 1;
        }
    );
    return run;
}

/** ffmpeg runs queued or running in this process (for logs and tests). */
export function ffmpegSlotDepth() {
    return slot().waiting;
}

/** The command and arguments that start `binary` at the lowest CPU priority. */
export function lowPriority(binary: string, args: string[]): {command: string; args: string[]} {
    const useNice = process.platform !== "win32" && process.env.CONTENT_VIDEO_NICE !== "0";
    return useNice ? {command: "nice", args: ["-n", "19", binary, ...args]} : {command: binary, args};
}

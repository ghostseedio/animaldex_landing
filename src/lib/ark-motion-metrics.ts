/**
 * Lanes' measured numbers for the motion pass's one CI summary (`scripts/ark-motion-ci.mts`, `tests/ark-motion/metrics.json`).
 *
 * A test or a metric script calls `recordMotionMetric("l2", "wingbeat_slope", slope)` next to its assertion. When the
 * summary runs it, `ARK_MOTION_METRICS_DIR` is set and the number is appended to `<dir>/<lane>.jsonl`; the registry's
 * `"output": "$ARK_MOTION_METRICS_DIR/l2.jsonl"` then reads it by id (the last value recorded wins). Anywhere else (a
 * plain `npm test`) it does nothing. Ids are plain words (no dots).
 */

import {appendFileSync, mkdirSync} from "node:fs";
import path from "node:path";

export function recordMotionMetric(lane: string, id: string, value: number, unit?: string): void {
    const dir = process.env.ARK_MOTION_METRICS_DIR;
    if (!dir || !Number.isFinite(value)) return;
    mkdirSync(dir, {recursive: true});
    appendFileSync(path.join(dir, `${lane.replace(/[^a-z0-9-]+/gi, "_")}.jsonl`), JSON.stringify({id, value, ...(unit ? {unit} : {})}) + "\n");
}

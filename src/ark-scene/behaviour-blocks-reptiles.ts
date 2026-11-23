/**
 * Two building blocks the reptile signature variants need (`recipe-templates-reptiles.ts`; lane SIG2-REPTILES), added to
 * the engine's table by `behaviour-blocks.ts`: the generic blocks are another body's (a probe is a bill in soil with dust
 * flying, a dig leaves a hole), and these differ only in what the body leaves and what flies.
 */

import type {BlockDef} from "@/ark-scene/behaviour-blocks";

const B = (def: BlockDef) => def;

export const REPTILE_BLOCKS: BlockDef[] = [
    // A hawksbill's narrow beak into a reef's crevice: head down, hardly moving, a few bubbles (no dust under water).
    B({id: "probe_reef", label: "probe a reef's crevice with the beak", motion: "hold", states: ["probe"], beat: "peck", pitch: 0.5, surge: 0.06, rate: 0.7, wet: true, fx: "bubbles", fxAt: "during"}),
    // A reptile heaping and tidying its nest mound: it digs and scrapes material up into a mound (its own mark, no props' nest).
    B({id: "mound_up", label: "heap up and tidy a nest mound", motion: "hold", states: ["dig"], beat: "peck", pitch: 0.3, rate: 2.5, fx: "dirt", fxAt: "during", mark: "mound"})
];

/**
 * The behaviour engine's building blocks (rich-behaviours brief §2): generic
 * actions that recipes compose (`behaviour-recipes.ts`, data in `recipes.json`).
 * Visual only.
 *
 * Each block says:
 * - how it moves: `travel` goes from where the last step left it to the step's target along its own curve;
 *   `hold` stays where it is, with its own small motion (a lunge, a push, a roll, a bob);
 * - the named animation states it plays (`states`), which the rig player maps to clips (ARK_RECIPE_STATES lists
 *   every name, for that lane);
 * - the schedule beat it reads as where no clip exists, which is also its cheap far version (`beat`);
 * - its body attitude (pitch, roll, aloft), the same near and far, so nothing jumps between levels;
 * - its near-only detail: particles at its start or end, a carried item, a mark on the ground.
 */

import type {ArkBeat} from "@/ark-scene/behaviour-schedule";

export type BlockMotion = "travel" | "hold";
/** A travel block's path: on the ground; a flight's arc; a plunge (steep, fast at the end); a dive (down and along); straight up; straight. */
export type BlockCurve = "ground" | "arc" | "plunge" | "dive" | "rise" | "line" | "leap";

export type BlockDef = {
    id: string;
    label: string;
    motion: BlockMotion;
    curve?: BlockCurve;
    /** Animation states, in order through the step (the rig player maps each to a clip). */
    states: string[];
    /** The schedule beat it reads as without its own clip, and far away. */
    beat: ArkBeat;
    /** Body pitch (rad, nose down positive) at the step's middle; with `pitchWave` it rocks. */
    pitch?: number;
    pitchWave?: number;
    /** Body roll (rad); with `rollWave` it rocks side to side. */
    roll?: number;
    rollWave?: number;
    /** A hold block's own motion: forward and back (lunge, push), side to side (sweep, shuffle), up and down (bob, hop). In body lengths. */
    surge?: number;
    sway?: number;
    heave?: number;
    /** Its local motion's rate (Hz). */
    rate?: number;
    /** In the air during it. */
    aloft?: boolean;
    /** In the water (its pose may go below the surface). */
    wet?: boolean;
    /** Near-only: particles (at the start of the step unless `fxAt` says the end), a mark left on the ground. */
    fx?: "splash" | "dirt" | "dust" | "mud" | "chips" | "bubbles" | "sand" | "spray";
    fxAt?: "start" | "end" | "during";
    mark?: "hole" | "mound" | "hollow" | "pit";
};

const B = (def: BlockDef) => def;

/** Every block the engine runs. Recipes may only use these (the generator and the tests check). */
export const BLOCKS: Record<string, BlockDef> = Object.fromEntries(
    [
        // Moving
        B({id: "walk", label: "walk to", motion: "travel", curve: "ground", states: ["walk"], beat: "walk"}),
        B({id: "run", label: "run to", motion: "travel", curve: "ground", states: ["run"], beat: "run"}),
        B({id: "stalk", label: "stalk (low, slow)", motion: "travel", curve: "ground", states: ["stalk"], beat: "stalk", pitch: 0.08}),
        B({id: "swim", label: "swim to", motion: "travel", curve: "line", states: ["swim"], beat: "swim", wet: true}),
        B({id: "fly", label: "fly to", motion: "travel", curve: "arc", states: ["fly", "glide"], beat: "fly", aloft: true}),
        B({id: "climb", label: "climb to", motion: "travel", curve: "line", states: ["climb"], beat: "climb"}),
        B({id: "crawl", label: "crawl to", motion: "travel", curve: "ground", states: ["crawl"], beat: "walk", pitch: 0.04}),
        B({id: "wade", label: "wade (slow steps in the shallows)", motion: "travel", curve: "ground", states: ["wade"], beat: "walk", wet: true}),
        B({id: "take_off", label: "take off", motion: "travel", curve: "rise", states: ["takeoff"], beat: "fly", aloft: true, pitch: -0.35}),
        B({id: "land", label: "land", motion: "travel", curve: "line", states: ["land"], beat: "fly", aloft: true, pitch: -0.25}),
        B({id: "go", label: "go there its own way (fly, swim, climb or walk: chosen by the engine)", motion: "travel", curve: "ground", states: ["walk"], beat: "walk"}),
        B({id: "follow", label: "follow (in line or beside)", motion: "travel", curve: "ground", states: ["walk"], beat: "walk"}),
        B({id: "flee", label: "flee (to cover, water or a tree)", motion: "travel", curve: "ground", states: ["run"], beat: "run"}),
        B({id: "leap", label: "leap (a pounce, a mousing jump)", motion: "travel", curve: "leap", states: ["leap"], beat: "play", aloft: true, pitch: 0.5}),
        // Into and out of the water
        B({id: "dive_air", label: "dive from the air into the water", motion: "travel", curve: "plunge", states: ["plunge"], beat: "glide", aloft: true, pitch: 1.35, fx: "splash", fxAt: "end"}),
        B({id: "dive_feet", label: "drop feet-first onto the water", motion: "travel", curve: "plunge", states: ["strike_feet"], beat: "glide", aloft: true, pitch: -0.9, fx: "splash", fxAt: "end"}),
        B({id: "dive", label: "dive from the surface", motion: "travel", curve: "dive", states: ["dive"], beat: "swim", wet: true, pitch: 0.9, fx: "bubbles"}),
        B({id: "surface", label: "surface", motion: "travel", curve: "line", states: ["surface"], beat: "swim", wet: true, pitch: -0.6, fx: "spray", fxAt: "end"}),
        B({id: "slide_in", label: "slide in on the belly", motion: "travel", curve: "line", states: ["slide"], beat: "enter_water", pitch: 1.35, fx: "splash", fxAt: "end"}),
        B({id: "slip_in", label: "slip in low and slow", motion: "travel", curve: "line", states: ["slip_in"], beat: "enter_water", pitch: 0.12}),
        B({id: "dive_in", label: "dive in from the bank", motion: "travel", curve: "leap", states: ["dive_in"], beat: "enter_water", pitch: 0.8, fx: "splash", fxAt: "end"}),
        B({id: "launch", label: "launch onto the water (paddling)", motion: "travel", curve: "line", states: ["launch"], beat: "enter_water", pitch: -0.1, fx: "spray", fxAt: "during"}),
        B({id: "haul_out", label: "haul out", motion: "travel", curve: "line", states: ["haul_out"], beat: "exit_water", pitch: -0.25, heave: 0.06, rate: 1.2}),
        B({id: "hop_out", label: "leap out onto the shore", motion: "travel", curve: "leap", states: ["hop_out"], beat: "exit_water", pitch: -0.4, fx: "spray", fxAt: "start"}),
        // Hunting and feeding
        B({id: "scan", label: "look and scan", motion: "hold", states: ["scan"], beat: "scan"}),
        B({id: "ambush", label: "wait in ambush (still)", motion: "hold", states: ["crouch"], beat: "pause", pitch: 0.06}),
        B({id: "hover", label: "hover", motion: "hold", states: ["hover"], beat: "fly", aloft: true, pitch: -0.5, heave: 0.05, rate: 1.6}),
        B({id: "strike", label: "strike (a lunge of the head or bill)", motion: "hold", states: ["strike"], beat: "bite", pitch: 0.5, surge: 0.35, rate: 1.4}),
        B({id: "swipe", label: "swipe with a paw", motion: "hold", states: ["swipe"], beat: "bite", pitch: 0.25, surge: 0.15, sway: 0.15, rate: 1.1, fx: "splash", fxAt: "during"}),
        B({id: "scoop", label: "scoop with the bill", motion: "hold", states: ["scoop"], beat: "bite", pitch: 0.7, surge: 0.2, rate: 0.7, fx: "splash"}),
        B({id: "sweep", label: "sweep the bill side to side", motion: "hold", states: ["sweep"], beat: "peck", pitch: 0.55, sway: 0.12, rate: 0.9, fx: "spray", fxAt: "during"}),
        B({id: "upend", label: "up-end (head under, tail up)", motion: "hold", states: ["upend"], beat: "bite", pitch: 1.3, wet: true, fx: "spray", fxAt: "start"}),
        B({id: "probe", label: "probe the ground with the bill", motion: "hold", states: ["probe"], beat: "peck", pitch: 0.6, heave: -0.06, rate: 1.3, fx: "dirt", fxAt: "during"}),
        B({id: "pull", label: "pull (a worm from the ground)", motion: "hold", states: ["pull"], beat: "bite", pitch: 0.2, surge: -0.18, rate: 0.8}),
        B({id: "peck", label: "peck", motion: "hold", states: ["peck"], beat: "peck", pitch: 0.45, heave: -0.04, rate: 2}),
        B({id: "drum", label: "drum or hammer on wood", motion: "hold", states: ["drum"], beat: "peck", surge: 0.08, rate: 9, fx: "chips", fxAt: "during"}),
        B({id: "eat", label: "swallow or eat", motion: "hold", states: ["eat"], beat: "chew", pitch: -0.15}),
        B({id: "beat_prey", label: "beat the catch on a branch or rock", motion: "hold", states: ["beat_prey"], beat: "bite", pitch: 0.3, sway: 0.1, rate: 2.2}),
        // Handling things
        B({id: "pick_up", label: "pick up", motion: "hold", states: ["pick_up"], beat: "peck", pitch: 0.55}),
        B({id: "carry", label: "carry (in the mouth, bill, feet or on the back)", motion: "travel", curve: "ground", states: ["carry"], beat: "walk"}),
        B({id: "place", label: "drop or place", motion: "hold", states: ["place"], beat: "peck", pitch: 0.35}),
        B({id: "dig", label: "dig (dirt flies; a hole or a mound)", motion: "hold", states: ["dig"], beat: "peck", pitch: 0.4, surge: 0.05, rate: 3, fx: "dirt", fxAt: "during", mark: "hole"}),
        B({id: "push", label: "push or roll an object", motion: "travel", curve: "ground", states: ["push"], beat: "walk", pitch: 0.3}),
        B({id: "tool", label: "use a tool (a stone, a stick)", motion: "hold", states: ["tool"], beat: "bite", surge: 0.06, rate: 2.5}),
        // Display, voice, contests
        B({id: "display", label: "display (posture, wings, crest, tail, throat)", motion: "hold", states: ["display"], beat: "scan", pitch: -0.12}),
        B({id: "pushup", label: "push-up display", motion: "hold", states: ["pushup"], beat: "scan", heave: 0.12, rate: 1.8}),
        B({id: "dance", label: "courtship dance (bow, leap, turn)", motion: "hold", states: ["dance"], beat: "play", heave: 0.18, pitchWave: 0.35, rate: 0.8}),
        B({id: "call", label: "call", motion: "hold", states: ["call"], beat: "scan", pitch: -0.3}),
        B({id: "fight", label: "fight, non-lethal (clash, push, wrestle)", motion: "hold", states: ["fight"], beat: "play", surge: 0.12, pitch: 0.3, rate: 0.9, fx: "dust", fxAt: "during"}),
        B({id: "clash", label: "run at a rival and clash", motion: "travel", curve: "ground", states: ["charge", "clash"], beat: "run", pitch: 0.35, fx: "dust", fxAt: "end"}),
        B({id: "rear", label: "rear up", motion: "hold", states: ["rear"], beat: "play", pitch: -0.7}),
        B({id: "box", label: "box or kick standing up", motion: "hold", states: ["box"], beat: "play", pitch: -0.6, surge: 0.08, rate: 2.4}),
        B({id: "scent_mark", label: "scent mark (rub, scrape)", motion: "hold", states: ["mark"], beat: "peck", sway: 0.08, rate: 1.2, fx: "dirt", fxAt: "during"}),
        // Comfort
        B({id: "groom", label: "groom or preen itself", motion: "hold", states: ["groom"], beat: "preen"}),
        B({id: "groom_other", label: "groom another", motion: "hold", states: ["groom_other"], beat: "preen", pitch: 0.2}),
        B({id: "bathe", label: "bathe (splash in the shallows)", motion: "hold", states: ["bathe"], beat: "shake", pitch: 0.35, rollWave: 0.25, heave: -0.05, rate: 3, wet: true, fx: "splash", fxAt: "during"}),
        B({id: "bury", label: "bury itself (sand, mud)", motion: "hold", states: ["bury"], beat: "rest", heave: -0.45, rate: 0.25, fx: "sand", fxAt: "start", mark: "hollow"}),
        B({id: "shake_off", label: "shake off water", motion: "hold", states: ["shake"], beat: "shake", rollWave: 0.35, rate: 4, fx: "spray", fxAt: "start"}),
        B({id: "roll", label: "roll on the ground", motion: "hold", states: ["roll"], beat: "rest", roll: 1.6, rollWave: 0.9, rate: 0.5, fx: "dust", fxAt: "during"}),
        B({id: "dust_bathe", label: "dust or sand bathe", motion: "hold", states: ["dust_bathe"], beat: "rest", roll: 0.5, rollWave: 0.4, sway: 0.05, rate: 1.4, fx: "dust", fxAt: "during", mark: "hollow"}),
        B({id: "wallow", label: "wallow in mud or water", motion: "hold", states: ["wallow"], beat: "rest", roll: 1.1, rollWave: 0.6, rate: 0.35, fx: "mud", fxAt: "during", mark: "hollow"}),
        B({id: "bask", label: "bask (flat, broadside to the sun)", motion: "hold", states: ["bask"], beat: "rest"}),
        B({id: "wing_dry", label: "spread the wings to dry", motion: "hold", states: ["wing_dry"], beat: "preen"}),
        B({id: "stretch", label: "stretch", motion: "hold", states: ["stretch"], beat: "rest", pitch: 0.3}),
        B({id: "yawn", label: "yawn", motion: "hold", states: ["yawn"], beat: "rest", pitch: -0.25}),
        B({id: "float_back", label: "float on the back", motion: "hold", states: ["float_back"], beat: "rest", roll: Math.PI, wet: true}),
        B({id: "sleep_pose", label: "sleep in its posture (one leg, head tucked, hanging, curled, afloat)", motion: "hold", states: ["sleep"], beat: "sleep"}),
        B({id: "freeze", label: "freeze", motion: "hold", states: ["freeze"], beat: "pause"}),
        B({id: "perch", label: "perch", motion: "hold", states: ["perch"], beat: "rest"}),
        B({id: "rest", label: "rest", motion: "hold", states: ["rest"], beat: "rest"}),
        B({id: "incubate", label: "sit on the nest", motion: "hold", states: ["incubate"], beat: "rest", heave: -0.08})
    ].map((b) => [b.id, b])
);

/** Every named animation state a block can ask for: the rig player lane maps these to clips (unmapped: the block's `beat`). */
export const ARK_RECIPE_STATES: string[] = Array.from(new Set(Object.values(BLOCKS).flatMap((b) => b.states))).sort();

export function blockOf(id: string): BlockDef | null {
    return BLOCKS[id] ?? null;
}

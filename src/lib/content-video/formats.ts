import {isMusicMood, MUSIC_MOOD_GUIDE, MUSIC_MOODS} from "@/lib/content-video/music";
import {HOOK_RULES, type PlanScene, type StatLine, type VideoPlan, type VideoSource} from "@/lib/content-video/plan";
import type {ShareCopy} from "@/lib/social/share-copy";

// The two fully generated formats. A comparison becomes a Pokémon-style
// battle: a VS card with the page's stats, then a 15-second AI fight in three
// shots (charge, clash, finish), each drawn mid-action from its own keyframe,
// cut with punch-in zooms, hit flashes, move callouts and health bars, ending
// on the page's winner. A hybrid or fusion becomes a reveal: the two parents,
// then a 10-second photoreal clip of the imagined animal moving through its
// habitat under a documentary voiceover. Both come back as an ordinary VideoPlan.

const SHARE_RULES = `Share copy (share), from the same facts:
- youtube.title: max 100 chars, the hook in the first 40, then the search phrase people type (e.g. "Tiger vs Grizzly Bear: Who Would Win?"). No hashtags, never "AnimalDex".
- youtube.description: 3–5 short lines, then "Full breakdown: <url>", then "Subscribe @animaldexapp for more.", then 4–5 hashtags starting "#AnimalDex #Shorts".
- tiktok.caption: hook in 80 chars, a line that splits the audience, a question for comments, "Follow @animaldex.app", 4–5 hashtags starting "#AnimalDex". No URL.
- instagram.caption: hook in 125 chars, blank line, 1–2 lines, blank line, "Follow @animaldexapp for more.", blank line, 3–5 hashtags starting "#AnimalDex". No URL.
- facebook.caption: hook in 125 chars, blank line, 2–3 lines, blank line, "Full breakdown: <url>", 2–3 hashtags starting "#AnimalDex".
- x.text: max 240 chars, the hook, 1–2 hashtags starting "#AnimalDex". No URL.`;

const MUSIC_RULES = `music_mood: ${MUSIC_MOODS.map((mood) => `${mood} (${MUSIC_MOOD_GUIDE[mood]})`).join("; ")}.`;

const shareSchema = {
    type: "object",
    additionalProperties: false,
    required: ["youtube", "tiktok", "instagram", "facebook", "x"],
    properties: {
        youtube: {type: "object", additionalProperties: false, required: ["title", "description"], properties: {title: {type: "string"}, description: {type: "string"}}},
        tiktok: {type: "object", additionalProperties: false, required: ["caption"], properties: {caption: {type: "string"}}},
        instagram: {type: "object", additionalProperties: false, required: ["caption"], properties: {caption: {type: "string"}}},
        facebook: {type: "object", additionalProperties: false, required: ["caption"], properties: {caption: {type: "string"}}},
        x: {type: "object", additionalProperties: false, required: ["text"], properties: {text: {type: "string"}}}
    }
} as const;

// ---------------------------------------------------------------- battle

export const BATTLE_SYSTEM_PROMPT = `You direct AnimalDex's "Who would win?" battle shorts. A vertical 20–25 second video: a VS card with the two animals' stats, then a 15-second fight in three AI-generated 5-second shots, ending on a definite winner. It has to feel like a blockbuster fight scene crossed with a Pokémon battle, never two animals politely facing each other.

${HOOK_RULES}

THE LOOK: REAL animals, photoreal, in a stylised battle arena (a flat field with a painted white circle and centre line, stadium floodlights, a blurred crowd), set in the page's matchup scenario. Shot like an action film: dramatic angles, motion blur, dust and debris exploding on every impact, sweat-and-breath detail, rim light from the floodlights.

THE ACTION: every shot is ONE big, clear, physical move, already happening in its first frame. Use real animal behaviour, pushed to its most dramatic: charging full speed, leaping or pouncing onto the other, rearing up and crashing together, ramming heads or horns, tackling, swiping, wrestling, flipping the other over, pinning, dodging, chasing, fleeing, tumbling across the arena, roaring in its face. Show FACES: bared teeth, snarls, flattened ears, wide furious eyes, flared nostrils, then exhaustion and panting, a cowering retreat, a triumphant roar.
Allowed: force, speed, collisions, pins, escapes, intimidation. Not allowed (the AI video model refuses it and it is not who we are): blood, open wounds, bites that break skin, gore, injury close-ups, dead or dying animals, super powers, magic, weapons, people.

- intro_narration: the spoken hook over the VS card (max 12 words). Extreme and polarising, e.g. "Everyone says the lion wins. Everyone is wrong."
- hook_text: on-screen over the VS card, 2–6 words.
- stats: the 3–4 most dramatic stat lines FROM THE PAGE, values shortened to fit (max 14 characters each, e.g. "1,050 PSI", "65 km/h", "220 kg"); advantage "a", "b" or "even" as the page says.
- arena: one line, the battlefield's setting (e.g. "a misty bamboo-forest arena at dusk").
- look_a / look_b: one precise line each describing that animal's appearance (size, build, colour, markings, horns or mane), reused word for word in every shot so both animals look the same from shot to shot. Species-accurate and life-size relative to each other.
- beats: exactly 3 shots, in order:
  (1) CHARGE: the first attack, both animals in motion (a full-speed charge, a pounce, a sprint across the arena). Wide or tracking shot.
  (2) CLASH: the impact: they collide, grapple, ram, flip or tumble. Close and violent-looking, faces filling the frame.
  (3) FINISH: the decisive move and the result: the loser pinned, flipped, fleeing or cowering, exhausted; the winner roaring over the field. Low hero angle.
  Each beat is { narration, attacker, move, shot, motion_prompt }:
  - narration: a hype battle commentator, 6–14 words, present tense, punchy, matching what we see.
  - attacker: "a" or "b", whose move this shot is.
  - move: the Pokémon-style move name, 1–3 words, max 18 characters, e.g. "HORN CHARGE", "LEAP ATTACK", "BODY SLAM", "ESCAPE".
  - shot: the photoreal first frame of the shot, frozen MID-ACTION: camera angle and lens, where each animal is and what its body is doing, its facial expression, the dust and debris. Refer to them as "the <animal name>"; do not describe their looks (look_a/look_b are added). Vertical 9:16.
  - motion_prompt: 1–2 sentences for the 5 seconds: the camera move first ("Fast tracking shot…", "Crash zoom…", "Slow-motion low angle…"), then the ONE action with strong verbs and its result, then the expressions. No lists of moves, no negations.
- winner: "a" or "b". It MUST be the page's verdict (given below when the page names one); the fight must make that outcome believable.
- cta_narration: one line that splits the audience, e.g. "Agree? Tell me who you'd bet on."; cta_text 2–5 words.
- ${MUSIC_RULES} Battles are usually intense or epic.

${SHARE_RULES}

Return only the JSON object.`;

export const BATTLE_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["title", "hook_text", "intro_narration", "stats", "arena", "look_a", "look_b", "beats", "winner", "cta_narration", "cta_text", "music_mood", "share"],
    properties: {
        title: {type: "string"},
        hook_text: {type: "string"},
        intro_narration: {type: "string"},
        stats: {
            type: "array",
            items: {
                type: "object", additionalProperties: false, required: ["label", "a", "b", "advantage"],
                properties: {label: {type: "string"}, a: {type: "string"}, b: {type: "string"}, advantage: {type: "string", enum: ["a", "b", "even"]}}
            }
        },
        arena: {type: "string"},
        look_a: {type: "string"},
        look_b: {type: "string"},
        beats: {
            type: "array",
            items: {
                type: "object", additionalProperties: false, required: ["narration", "attacker", "move", "shot", "motion_prompt"],
                properties: {narration: {type: "string"}, attacker: {type: "string", enum: ["a", "b"]}, move: {type: "string"}, shot: {type: "string"}, motion_prompt: {type: "string"}}
            }
        },
        winner: {type: "string", enum: ["a", "b"]},
        cta_narration: {type: "string"},
        cta_text: {type: "string"},
        music_mood: {type: "string", enum: [...MUSIC_MOODS]},
        share: shareSchema
    }
} as const;

export function buildBattleUserPrompt(source: VideoSource) {
    const facts = source.battle!;
    return [
        `Matchup: ${facts.a.name} (animal A) vs ${facts.b.name} (animal B)`,
        `Page: ${source.title} — ${source.url}`,
        facts.winner ? `THE PAGE'S WINNER: ${facts.winner === "a" ? facts.a.name : facts.b.name} (winner "${facts.winner}"). Use it.` : "The page names no single winner: pick the one its verdict and scenarios favour.",
        `Verdict: ${facts.verdict}`,
        "",
        "Stats on the page:",
        ...facts.stats.map((stat) => `- ${stat.label}: A ${stat.a} | B ${stat.b} (advantage ${stat.advantage})`),
        "",
        "Scenarios on the page:",
        ...facts.scenarios.map((scenario) => `- ${scenario.title}: winner ${scenario.winner}. ${scenario.verdict}`),
        "",
        "Page text:",
        source.text.slice(0, 6000)
    ].join("\n");
}

const BATTLE_KEYFRAME_SUFFIX =
    "Photorealistic cinematic action still, like a frame from a blockbuster nature fight scene: frozen mid-action, motion blur on limbs, dust and debris exploding, dramatic floodlight rim lighting, " +
    "a stylised Pokémon-style battle arena (flat ground, painted white circle and centre line, stadium floodlights, blurred crowd). Both animals anatomically accurate and life-size relative to each other, faces and expressions clearly visible. Vertical 9:16. No text, no letters, no logos, no people in the arena.";
const BATTLE_MOTION_SUFFIX =
    "Fast, powerful, realistic animal motion with real weight and momentum; cinematic VFX: dust bursts and flying debris on every impact, motion blur, camera shake. Keep both animals' species, size and markings exactly as in the frame. No text.";
/** Kling's negative prompt for fight shots: the bloodless rules live here, plus anything that reads as a still. */
export const BATTLE_NEGATIVE_PROMPT =
    "blood, wounds, gore, injury, dead animal, bite marks, people, weapons, text, watermark, logo, distorted anatomy, extra limbs, extra heads, morphing, melting, flicker, cartoon, static shot, motionless, standing still, frozen pose";
const BATTLE_FX = ["charge", "clash", "finish"] as const;

function clean(value: unknown, max: number) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function parseShare(value: unknown): ShareCopy | null {
    const record = value as Record<string, Record<string, unknown>> | null;
    if (!record || typeof record !== "object") return null;
    const pick = (platform: string, field: string) => typeof record[platform]?.[field] === "string" ? (record[platform][field] as string).trim() : "";
    const copy: ShareCopy = {
        youtube: {title: pick("youtube", "title"), description: pick("youtube", "description")},
        tiktok: {caption: pick("tiktok", "caption")},
        instagram: {caption: pick("instagram", "caption")},
        facebook: {caption: pick("facebook", "caption")},
        x: {text: pick("x", "text")}
    };
    return copy.youtube.title ? copy : null;
}

/** The model's battle, held to the page: its winner, its stats, three beats. */
export function normalizeBattlePlan(value: unknown, source: VideoSource): VideoPlan | null {
    const facts = source.battle;
    const record = value as Record<string, unknown> | null;
    if (!facts || !record || typeof record !== "object") return null;
    const share = parseShare(record.share);
    const beats = (Array.isArray(record.beats) ? record.beats : [])
        .map((beat) => {
            const entry = beat as Record<string, unknown>;
            return {
                narration: clean(entry.narration, 200),
                motion: clean(entry.motion_prompt, 600),
                shot: clean(entry.shot, 900),
                move: clean(entry.move, 18).replace(/[!.]+$/, ""),
                attacker: entry.attacker === "b" ? "b" as const : "a" as const
            };
        })
        .filter((beat) => beat.narration && beat.motion && beat.shot)
        .slice(0, 3);
    if (beats.length < 3 || !share) return null;

    const modelWinner = record.winner === "b" ? "b" : "a";
    const winner = facts.winner ?? modelWinner;
    const winnerName = winner === "a" ? facts.a.name : facts.b.name;
    const stats: StatLine[] = (Array.isArray(record.stats) ? record.stats : [])
        .map((stat) => {
            const entry = stat as Record<string, unknown>;
            const advantage: StatLine["advantage"] = entry.advantage === "a" || entry.advantage === "b" ? entry.advantage : "even";
            return {label: clean(entry.label, 22), a: clean(entry.a, 16), b: clean(entry.b, 16), advantage};
        })
        .filter((stat) => stat.label && stat.a && stat.b)
        .slice(0, 4);
    const fallbackStats = facts.stats.slice(0, 4).map((stat) => ({...stat, label: stat.label.slice(0, 22), a: stat.a.slice(0, 16), b: stat.b.slice(0, 16)}));
    const arena = clean(record.arena, 200);
    const looks = `The ${facts.a.name}: ${clean(record.look_a, 300) || `an adult ${facts.a.name}`}. The ${facts.b.name}: ${clean(record.look_b, 300) || `an adult ${facts.b.name}`}.`;

    const scenes: PlanScene[] = [
        {
            narration: clean(record.intro_narration, 160) || `${facts.a.name} versus ${facts.b.name}. Only one walks away.`,
            overlay: "",
            visual: "card",
            image: facts.a.image,
            focusX: 0.5,
            motionPrompt: "",
            minSeconds: 3.4,
            card: {kind: "vs", left: facts.a, right: facts.b, stats: stats.length >= 2 ? stats : fallbackStats}
        },
        // Every shot is drawn mid-action from its own keyframe rather than chained from
        // the last frame of the one before: a real fight edit cuts between angles, the
        // model starts moving immediately, and one failed clip no longer sinks the rest.
        ...beats.map((beat, index): PlanScene => ({
            narration: beat.narration,
            overlay: index === 2 ? `WINNER: ${winnerName}` : "",
            overlayStyle: index === 2 ? "winner" : undefined,
            visual: "ai_clip",
            image: index === 2 ? (winner === "a" ? facts.a.image : facts.b.image) : (beat.attacker === "a" ? facts.a.image : facts.b.image),
            focusX: 0.5,
            motionPrompt: `${beat.motion}${index === 2 ? ` The ${winnerName} wins clearly and ends standing over the field.` : ""} ${BATTLE_MOTION_SUFFIX}`,
            keyframePrompt: `${beat.shot} ${looks}${arena ? ` Setting: ${arena}.` : ""} ${BATTLE_KEYFRAME_SUFFIX}`,
            clipSeconds: 5,
            minSeconds: 5,
            fx: BATTLE_FX[index],
            ...(beat.move ? {move: `${beat.attacker === "a" ? facts.a.name : facts.b.name} used ${beat.move}!`} : {})
        }))
    ];

    return {
        format: "battle",
        title: clean(record.title, 120) || `${facts.a.name} vs ${facts.b.name}`,
        hookText: clean(record.hook_text, 50) || `${facts.a.name} vs ${facts.b.name}`.toUpperCase(),
        scenes,
        ctaNarration: clean(record.cta_narration, 160) || "Who would you bet on? Tell me in the comments.",
        ctaText: clean(record.cta_text, 40) || "Who would you bet on?",
        musicMood: isMusicMood(record.music_mood) ? record.music_mood : "intense",
        share,
        hud: {left: facts.a.name, right: facts.b.name, winner: winner === "a" ? "left" : "right", fightScenes: [1, 2, 3]}
    };
}

// -------------------------------------------------------------- creature

export const CREATURE_SYSTEM_PROMPT = `You direct AnimalDex's imagined-animal reveals. A vertical 12–15 second video: the two parent animals side by side, then a 10-second photoreal AI clip of the imagined animal moving naturally through its habitat, under a nature-documentary voiceover (think a famous British wildlife narrator: hushed, awed, precise — never imitate a real person by name).

${HOOK_RULES}

- intro_narration: the spoken hook over the two parents (max 10 words), e.g. "This is what happens when a lion meets a shark."
- hook_text: on-screen over the parents, 2–6 words (e.g. "LION + SHARK = ?").
- creature_name: the animal's name from the page.
- keyframe_prompt: a photoreal, documentary-photo description of the creature as the page describes it — anatomy that clearly blends both parents (which parts come from which), colour, texture, scale — standing or moving in its natural habitat in natural light. One creature, full body visible, believable as a real animal. Vertical 9:16. No text.
- motion_prompt: how it moves for 10 seconds — its gait, how the blended body parts work, breathing, the environment reacting; a slow tracking documentary camera.
- narration: the documentary voiceover over the clip, 18–30 words, present tense, vivid and specific to the page.
- cta_narration: one line, e.g. "Would you want to meet one? Tell me below."; cta_text 2–5 words.
- ${MUSIC_RULES} Reveals are usually wonder, mystery or epic.

${SHARE_RULES}

Return only the JSON object.`;

export const CREATURE_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["title", "hook_text", "intro_narration", "creature_name", "keyframe_prompt", "motion_prompt", "narration", "cta_narration", "cta_text", "music_mood", "share"],
    properties: {
        title: {type: "string"},
        hook_text: {type: "string"},
        intro_narration: {type: "string"},
        creature_name: {type: "string"},
        keyframe_prompt: {type: "string"},
        motion_prompt: {type: "string"},
        narration: {type: "string"},
        cta_narration: {type: "string"},
        cta_text: {type: "string"},
        music_mood: {type: "string", enum: [...MUSIC_MOODS]},
        share: shareSchema
    }
} as const;

export function buildCreatureUserPrompt(source: VideoSource) {
    const facts = source.creature!;
    return [
        facts.kind === "hybrid"
            ? `Imagined hybrid: ${facts.name}, a cross of ${facts.parents[0].name} and ${facts.parents[1].name}.`
            : `Imagined fusion: a ${facts.parents[0].name} that has learned "${facts.name}" from the ${facts.parents[1].name}. Show the ${facts.parents[0].name} itself (not a hybrid body) doing that learned behaviour in the wild.`,
        `Page: ${source.title} — ${source.url}`,
        `Appearance: ${facts.appearance}`,
        `Behaviour: ${facts.behavior}`,
        `Habitat: ${facts.habitat}`,
        "",
        "Page text:",
        source.text.slice(0, 5000)
    ].join("\n");
}

const CREATURE_KEYFRAME_SUFFIX =
    "Photorealistic National Geographic-style wildlife photograph, natural light, shallow depth of field, one animal, full body, believable anatomy. Vertical 9:16. No text, no letters, no logos, no people.";
const CREATURE_MOTION_SUFFIX =
    "Natural, believable animal motion and physics; slow tracking documentary camera. Keep the creature's anatomy, colours and markings exactly as in the frame. No text, no added animals or people.";

export function normalizeCreaturePlan(value: unknown, source: VideoSource): VideoPlan | null {
    const facts = source.creature;
    const record = value as Record<string, unknown> | null;
    if (!facts || !record || typeof record !== "object") return null;
    const share = parseShare(record.share);
    const keyframe = clean(record.keyframe_prompt, 1400);
    const motion = clean(record.motion_prompt, 700);
    const narration = clean(record.narration, 300);
    if (!share || !keyframe || !motion || !narration) return null;
    const name = clean(record.creature_name, 40) || facts.name;
    const [first, second] = facts.parents;

    return {
        format: "creature",
        title: clean(record.title, 120) || source.title,
        hookText: clean(record.hook_text, 50) || `${first.name} + ${second.name} = ?`.toUpperCase(),
        scenes: [
            {
                narration: clean(record.intro_narration, 140) || `What if a ${first.name} and a ${second.name} had a baby?`,
                overlay: "",
                visual: "card",
                image: first.image,
                focusX: 0.5,
                motionPrompt: "",
                minSeconds: 2.6,
                card: {kind: "pair", left: first, right: second, title: facts.kind === "hybrid" ? "+" : "learns from"}
            },
            {
                narration,
                overlay: name,
                overlayStyle: "title",
                visual: "ai_clip",
                image: first.image,
                focusX: 0.5,
                motionPrompt: `${motion} ${CREATURE_MOTION_SUFFIX}`,
                keyframePrompt: `${keyframe} ${CREATURE_KEYFRAME_SUFFIX}`,
                clipSeconds: 10,
                minSeconds: 9
            }
        ],
        ctaNarration: clean(record.cta_narration, 140) || "Would you want to meet one?",
        ctaText: clean(record.cta_text, 40) || "Would you meet one?",
        musicMood: isMusicMood(record.music_mood) ? record.music_mood : "wonder",
        share
    };
}

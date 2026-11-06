import {isMusicMood, MUSIC_MOOD_GUIDE, MUSIC_MOODS} from "@/lib/content-video/music";
import {HOOK_RULES, type PlanScene, type StatLine, type VideoPlan, type VideoSource} from "@/lib/content-video/plan";
import type {Experiment} from "@/lib/social-lab/arms";
import type {ShareCopy} from "@/lib/social/share-copy";

// The two fully generated formats. A comparison becomes a Pokémon-style
// battle: a VS card with the page's stats, then a 25-second AI fight in five
// shots (opener, counter, clash, turn, finish), each built around one of the
// animals' signature powers and drawn mid-action from its own keyframe, cut
// with punch-in zooms, hit flashes, move callouts and health bars, ending on
// the page's winner winning with its power. A hybrid or fusion becomes a reveal: the two parents,
// then a 10-second photoreal clip of the imagined animal moving through its
// habitat under a documentary voiceover. Both come back as an ordinary VideoPlan.

/**
 * Text-to-image models mix up lookalikes (a "honey badger" came back with an
 * anteater's snout): every drawn first frame spells out what tells the species
 * apart. The writer sees the artwork, so it can say what the animal looks like.
 */
const LOOKS_RULE = `  Every keyframe_prompt names the species AND spells out the 2–3 features that tell it apart from its lookalikes, as the photos show them (a honey badger: "stocky and short-legged, black body under a broad silver-white cape from the crown to the tail, a short blunt muzzle, small eyes").`;

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

export const BATTLE_SYSTEM_PROMPT = `You direct AnimalDex's "Who would win?" battle shorts. A vertical 30–35 second video: a VS card with the two animals' stats, then a 25-second fight in five AI-generated 5-second shots, ending on a definite winner. It has to feel like a blockbuster fight scene crossed with a Pokémon battle, never two animals politely facing each other.

${HOOK_RULES}

THE STORY IS THE POWERS. Before writing, pick 2–3 SIGNATURE POWERS for each animal: the real abilities that make it dangerous or hard to beat, drawn from the page's stats and text and from real biology (crushing bite force, explosive sprint speed, horns built for ramming, camouflage that makes it vanish, a leap of several body lengths, an armoured hide, a deafening roar, a venomous strike, a death roll). When an animal has an ANIMALDEX POWER (given below), it MUST be one of its powers, by that exact name. Every shot shows one power in action, and the viewer should finish knowing exactly WHICH power won the fight and why that power beats the other animal. The winner's best power decides the finish; the loser gets to land its own power once, so the fight is close.

THE LOOK: REAL animals, photoreal, in a stylised battle arena (a flat field with a painted white circle and centre line, stadium floodlights, a blurred crowd), set in the page's matchup scenario. Shot like an action film: dramatic angles, motion blur, dust and debris exploding on every impact, sweat-and-breath detail, rim light from the floodlights. Powers get cinematic VFX that EXAGGERATE REAL BIOLOGY without becoming magic: speed streaks and afterimages behind a sprint, a shockwave of dust rippling out from a roar or a stomp, ground cracking under a slam, a heat-haze shimmer as camouflage melts an animal into the scenery, sound-wave rings from a song or call, debris frozen in the air for a slow-motion strike.

THE ACTION: every shot is ONE big, clear, physical move, already happening in its first frame: charging full speed, leaping or pouncing onto the other, rearing up and crashing together, ramming heads or horns, tackling, swiping, wrestling, flipping the other over, pinning, dodging, chasing, fleeing, tumbling across the arena, roaring in its face. Show FACES: bared teeth, snarls, flattened ears, wide furious eyes, flared nostrils, then exhaustion and panting, a cowering retreat, a triumphant roar.
Allowed: force, speed, collisions, pins, escapes, intimidation. Not allowed (the AI video model refuses it and it is not who we are): blood, open wounds, bites that break skin, gore, injury close-ups, dead or dying animals, fire or lasers or any power the real animal does not have, weapons, people.

- intro_narration: the spoken hook over the VS card (max 12 words). Extreme and polarising, e.g. "Everyone says the lion wins. Everyone is wrong."
- hook_text: on-screen over the VS card, 2–6 words.
- stats: the 3–4 most dramatic stat lines FROM THE PAGE, values shortened to fit (max 14 characters each, e.g. "1,050 PSI", "65 km/h", "220 kg"); advantage "a", "b" or "even" as the page says.
- arena: one line, the battlefield's setting (e.g. "a misty bamboo-forest arena at dusk").
- look_a / look_b: one precise line each describing that animal's appearance (size, build, colour, markings, horns or mane), reused word for word in every shot so both animals look the same from shot to shot. Species-accurate and life-size relative to each other.
- beats: exactly 5 shots, in order:
  (1) OPENER: the winner-to-be or the aggressor attacks first with a power, both animals in motion. Wide or tracking shot.
  (2) COUNTER: the other animal answers with ITS best power and lands it: the fight swings. Close and fast.
  (3) CLASH: full collision, both powers meeting: grappling, ramming, tumbling. Faces filling the frame.
  (4) TURN: the winner adapts and uses the power that will decide it; the loser is visibly tiring.
  (5) FINISH: the winner's decisive power lands: the loser pinned, flipped, fleeing or cowering, exhausted; the winner roaring over the field. Low hero angle.
  Each beat is { narration, attacker, power, shot, motion_prompt }:
  - narration: a hype battle commentator, 7–14 words, present tense, punchy. Name the power or the real fact behind it ("Nine hundred kilos of horn at fifty kilometres an hour!").
  - attacker: "a" or "b", whose power this shot shows.
  - power: the power's name as a Pokémon-style move, 1–3 words, max 18 characters, e.g. "HORN CHARGE", "BROKEN OUTLINE", "DEATH ROLL", "SONIC ROAR".
  - shot: the photoreal first frame of the shot, frozen MID-ACTION with the power visible: camera angle and lens, where each animal is and what its body is doing, its facial expression, the power's VFX, the dust and debris. Refer to them as "the <animal name>"; do not describe their looks (look_a/look_b are added). Vertical 9:16.
  - motion_prompt: 1–2 sentences for the 5 seconds: the camera move first ("Fast tracking shot…", "Crash zoom…", "Slow-motion low angle…"), then the ONE action using the power, with strong verbs, its VFX and its result, then the expressions. No lists of moves, no negations.
- winner: "a" or "b". It MUST be the page's verdict (given below when the page names one); the fight must make that outcome believable through the winner's powers.
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
                type: "object", additionalProperties: false, required: ["narration", "attacker", "power", "shot", "motion_prompt"],
                properties: {narration: {type: "string"}, attacker: {type: "string", enum: ["a", "b"]}, power: {type: "string"}, shot: {type: "string"}, motion_prompt: {type: "string"}}
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
        ...(["a", "b"] as const).map((side) => {
            const power = facts.powers?.[side];
            const name = facts[side].name;
            return power ? `ANIMALDEX POWER of the ${name} (animal ${side.toUpperCase()}): "${power.name}". ${power.basis}` : `The ${name} has no AnimalDex Power: pick its signature powers from the page and real biology.`;
        }),
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
/** The edit for each of the five shots: opener, counter, clash, turn, finish. */
const BATTLE_FX = ["charge", "clash", "clash", "clash", "finish"] as const;
export const BATTLE_SHOTS = BATTLE_FX.length;

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

/** How long the VS / parents card holds after a cold open (it only has to land the matchup). */
const COLD_OPEN_CARD_SECONDS = 2.2;

/**
 * The model's battle, held to the page: its winner, its stats, three beats.
 * With the "cold_open" opener the clash shot plays first under the spoken hook,
 * then a short VS card, then the fight.
 */
export function normalizeBattlePlan(value: unknown, source: VideoSource, experiment: Experiment | null = null): VideoPlan | null {
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
                power: clean(entry.power ?? entry.move, 18).replace(/[!.]+$/, ""),
                attacker: entry.attacker === "b" ? "b" as const : "a" as const
            };
        })
        .filter((beat) => beat.narration && beat.motion && beat.shot)
        .slice(0, BATTLE_SHOTS);
    if (beats.length < BATTLE_SHOTS || !share) return null;

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

    const coldOpen = experiment?.opener === "cold_open";
    const hookLine = clean(record.intro_narration, 160) || `${facts.a.name} versus ${facts.b.name}. Only one walks away.`;
    const vsCard: PlanScene = {
        narration: coldOpen ? `${facts.a.name} versus ${facts.b.name}.` : hookLine,
        overlay: "",
        visual: "card",
        image: facts.a.image,
        focusX: 0.5,
        motionPrompt: "",
        minSeconds: coldOpen ? COLD_OPEN_CARD_SECONDS : 3.4,
        card: {kind: "vs", left: facts.a, right: facts.b, stats: stats.length >= 2 ? stats : fallbackStats}
    };
    // The beats start after the card (and after the cold open when there is one); the clash is the third beat.
    const firstBeat = coldOpen ? 2 : 1;
    const scenes: PlanScene[] = [
        ...(coldOpen ? [{narration: hookLine, overlay: "", visual: "image" as const, image: facts.a.image, focusX: 0.5, motionPrompt: "", minSeconds: 2.2, reuseClip: firstBeat + 2}] : []),
        vsCard,
        // Every shot is drawn mid-action from its own keyframe rather than chained from
        // the last frame of the one before: a real fight edit cuts between angles, the
        // model starts moving immediately, and one failed clip no longer sinks the rest.
        ...beats.map((beat, index): PlanScene => {
            const last = index === BATTLE_SHOTS - 1;
            // The finish is the winner's move, whatever the model wrote.
            const attacker = last ? winner : beat.attacker;
            return {
                narration: beat.narration,
                overlay: last ? `WINNER: ${winnerName}` : "",
                overlayStyle: last ? "winner" : undefined,
                visual: "ai_clip",
                image: attacker === "a" ? facts.a.image : facts.b.image,
                focusX: 0.5,
                motionPrompt: `${beat.motion}${last ? ` The ${winnerName} wins clearly and ends standing over the field.` : ""} ${BATTLE_MOTION_SUFFIX}`,
                keyframePrompt: `${beat.shot} ${looks}${arena ? ` Setting: ${arena}.` : ""} ${BATTLE_KEYFRAME_SUFFIX}`,
                clipSeconds: 5,
                minSeconds: 5,
                fx: BATTLE_FX[index],
                attacker: attacker === "a" ? "left" : "right",
                ...(beat.power ? {move: `${attacker === "a" ? facts.a.name : facts.b.name} used ${beat.power}!`} : {})
            };
        })
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
        hud: {left: facts.a.name, right: facts.b.name, winner: winner === "a" ? "left" : "right", fightScenes: beats.map((_, index) => index + firstBeat)}
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
- narration: the documentary voiceover over the clip, 18–30 words, present tense, vivid and specific to the page, in words a 5-year-old knows.
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

/** With the "cold_open" opener the creature itself opens the video under the hook, then the parents card, then the full clip. */
export function normalizeCreaturePlan(value: unknown, source: VideoSource, experiment: Experiment | null = null): VideoPlan | null {
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
    const coldOpen = experiment?.opener === "cold_open";
    const hookLine = clean(record.intro_narration, 140) || `What if a ${first.name} and a ${second.name} had a baby?`;
    const pairCard: PlanScene = {
        narration: coldOpen ? `${first.name}${facts.kind === "hybrid" ? " plus " : " learns from "}${second.name}.` : hookLine,
        overlay: "",
        visual: "card",
        image: first.image,
        focusX: 0.5,
        motionPrompt: "",
        minSeconds: coldOpen ? COLD_OPEN_CARD_SECONDS : 2.6,
        card: {kind: "pair", left: first, right: second, title: facts.kind === "hybrid" ? "+" : "learns from"}
    };

    return {
        format: "creature",
        title: clean(record.title, 120) || source.title,
        hookText: clean(record.hook_text, 50) || `${first.name} + ${second.name} = ?`.toUpperCase(),
        scenes: [
            ...(coldOpen ? [{narration: hookLine, overlay: "", visual: "image" as const, image: first.image, focusX: 0.5, motionPrompt: "", minSeconds: 2.4, reuseClip: 2}] : []),
            pairCard,
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

// ---------------------------------------------------------------- lesson

// "What the <animal> teaches you": the self-improvement "dark & gold quote"
// short transplanted to animals (the format lab's first transplant). Research
// (Nov 2026): lion / eagle / wolf "mindset" Shorts reach 4–6M views on small
// channels, mostly 5–23 s, deep slow voice, gold serif lines over dark
// close-ups, and many of them repeat myths. Ours is the same look with true
// biology: one real behaviour, turned into a rule for the viewer's life.

export const LESSON_SYSTEM_PROMPT = `You direct AnimalDex's "what the animal teaches you" shorts: the dark & gold quote video that self-improvement channels made famous, about one REAL animal behaviour. A vertical 15–22 second video in five shots: near-black cinematic close-ups of the animal, gold serif lines on screen, a deep, slow, calm male voice. Slogan of the channel: "Every animal has a lesson."

WHY IT WORKS: one true, surprising behaviour, said like a rule to live by. The viewer should feel the line is about THEM, and want to send it to someone or keep it.

THE TRUTH RULE (our whole edge over the copycat channels): every claim about the animal is real biology, from the record below or well-established science. Never repeat the famous myths: the eagle does not pull out its beak and talons at 40 to be "reborn"; the wolf pack is a family, there is no "alpha walks at the back to protect the weak"; ostriches do not bury their heads; bats are not blind; goldfish remember for months; lions live in savanna, not jungle. Exaggerate the framing, never the facts; no invented numbers.

SHOTS (exactly 5, in order):
(1) HOOK, 0–3 s: the voice and the on-screen line start on the first frame. Pattern: "The <animal> doesn't <what people expect>. It <the real behaviour>." or one jaw-dropping true fact said flatly. The animal is named in the first three words. Shot: an extreme close-up of its face or eyes, mid-movement (a breath, a turn of the head, eyes opening).
(2) BEHAVIOUR: the real behaviour in action, one line. Shot: the animal doing it.
(3) THE TURN: turn that behaviour into a rule for the viewer, second person, plain words ("Most people chase everything. Pick one thing."). Shot: the animal in motion, powerful and calm.
(4) THE PRINCIPLE: the lesson in one short line a person would quote (from the record's lesson, in plainer words). Shot: the animal still and powerful: a silhouette against low gold light, or looking straight into the lens.
(5) CLOSE: the motto, or "Every animal has a lesson." The picture returns to the opening shot so the video loops.

WORDS: deep and slow, about 2 words a second. Narration across the five shots: 30–42 words. Each line 4–12 words, short sentences, words a 12-year-old knows, no jargon, no Latin names, no emoji, no hashtags. Never preachy or cheesy ("rise and grind", "alpha", "sigma", "king mentality" are banned).

- hook_text: on screen over shot 1, 3–7 words, the whole hook on its own ("THE LION DOESN'T CHASE EVERYTHING").
- shots[i].overlay: on screen, gold, 2–6 words: "" for shot 1 (the hook_text is there), the rule for shot 3, the principle for shot 4, the motto for shot 5; shot 2 may be "".
- shots[i].keyframe_prompt: the first frame, a photoreal description of exactly this species doing exactly this (pose, angle, lens, the light falling on it). Never other animals, never people, never text.
${LOOKS_RULE}
- shots[i].motion_prompt: one sentence: a slow camera move first ("Slow push-in…", "Slow orbit…"), then the animal's one real movement.
- cta_narration / cta_text: when THIS ITEM'S EXPERIMENT says the ending is a loop, both "". Otherwise the JOB's ask: share → "Send this to someone who needs it." save → "Save this for the day you need it." Never "follow".
- music_mood: "noir" (the dark bed made for this format).

${SHARE_RULES}
Captions for this format: the hook first, then "Every animal has a lesson." on its own line; TikTok and Instagram end with a question that makes people answer ("Which animal are you?").

Return only the JSON object.`;

export const LESSON_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["title", "hook_text", "shots", "cta_narration", "cta_text", "music_mood", "share"],
    properties: {
        title: {type: "string"},
        hook_text: {type: "string"},
        shots: {
            type: "array",
            items: {
                type: "object", additionalProperties: false, required: ["narration", "overlay", "keyframe_prompt", "motion_prompt"],
                properties: {narration: {type: "string"}, overlay: {type: "string"}, keyframe_prompt: {type: "string"}, motion_prompt: {type: "string"}}
            }
        },
        cta_narration: {type: "string"},
        cta_text: {type: "string"},
        music_mood: {type: "string", enum: [...MUSIC_MOODS]},
        share: shareSchema
    }
} as const;

export function buildLessonUserPrompt(source: VideoSource) {
    const facts = source.lesson!;
    return [
        `Animal: ${facts.animal.name}`,
        `Page: ${source.title} — ${source.url}`,
        `Its AnimalDex Power: ${facts.power}`,
        facts.expression ? `The behaviour: ${facts.expression}` : null,
        facts.basis ? `The biology: ${facts.basis}` : null,
        `The lesson (say it plainer): ${facts.lesson}`,
        facts.motto ? `Motto: ${facts.motto}` : null,
        facts.application ? `A real-life moment it fits: ${facts.application}` : null
    ].filter((line) => line !== null).join("\n");
}

const LESSON_KEYFRAME_SUFFIX =
    "Cinematic low-key wildlife photograph: near-black background, one warm golden rim light, deep shadows, rich fur, feather or scale detail, shallow depth of field; photoreal and species-accurate, the real animal exactly as it looks in life, large in frame. Vertical 9:16. No text, no letters, no logos, no people.";
const LESSON_MOTION_SUFFIX =
    "Slow, deliberate, cinematic motion with real weight; the slow camera move continues the whole shot; dust or mist drifting through the light. Keep the species, colours and markings exactly as in the frame. No text, no added animals or people.";
const LESSON_SHOTS = 5;

/** A lesson plan: four drawn-and-animated shots, the fifth replaying the first so the video loops; always the noir theme. */
export function normalizeLessonPlan(value: unknown, source: VideoSource, experiment: Experiment | null = null): VideoPlan | null {
    const facts = source.lesson;
    const record = value as Record<string, unknown> | null;
    if (!facts || !record || typeof record !== "object" || !Array.isArray(record.shots)) return null;
    const share = parseShare(record.share);
    const shots = (record.shots as Array<Record<string, unknown>>).slice(0, LESSON_SHOTS).map((shot) => ({
        narration: clean(shot?.narration, 160),
        overlay: clean(shot?.overlay, 48),
        keyframe: clean(shot?.keyframe_prompt, 1200),
        motion: clean(shot?.motion_prompt, 500)
    }));
    if (!share || shots.length < LESSON_SHOTS || shots.some((shot) => !shot.narration)) return null;
    if (shots.slice(0, 4).some((shot) => !shot.keyframe || !shot.motion)) return null;
    const loops = experiment?.ending === "loop";
    const scenes: PlanScene[] = shots.map((shot, index) => index < 4
        ? {
            narration: shot.narration,
            overlay: index === 0 ? "" : shot.overlay,
            visual: "ai_clip",
            image: facts.animal.image,
            focusX: 0.5,
            motionPrompt: `${shot.motion} ${LESSON_MOTION_SUFFIX}`,
            keyframePrompt: `${shot.keyframe} ${LESSON_KEYFRAME_SUFFIX}`,
            subject: facts.animal.name,
            species: facts.animal.slug,
            // The principle is the quote people screenshot: let it breathe.
            ...(index === 3 ? {minSeconds: 3.6} : {})
        }
        : {narration: shot.narration, overlay: shot.overlay, visual: "image", image: facts.animal.image, focusX: 0.5, motionPrompt: "", reuseClip: 0, minSeconds: 2.6});
    return {
        format: "lesson",
        theme: "noir_gold",
        ending: loops ? "loop" : "cta_card",
        title: clean(record.title, 120) || `What the ${facts.animal.name} teaches you`,
        hookText: clean(record.hook_text, 60) || `WHAT THE ${facts.animal.name.toUpperCase()} KNOWS`,
        scenes,
        ctaNarration: loops ? "" : clean(record.cta_narration, 140) || "Send this to someone who needs it.",
        ctaText: loops ? "" : clean(record.cta_text, 40) || "Every animal has a lesson.",
        musicMood: isMusicMood(record.music_mood) ? record.music_mood : "noir",
        share
    };
}

// ----------------------------------------------------------------- guess

// "Guess the animal": a puzzle in the first frame, clues from hardest to
// easiest, the reveal with the animal's real stat card (the Dex entry), one
// surprising fact, and a loop back to the opening close-up. Research (Nov
// 2026): MrBeast's "Guess the Animal" Shorts run 311–646M views and the rest of
// the supply is mostly kids' clip art; the viewer commits to a guess, so they
// stay for the reveal and say it in the comments.

export const GUESS_SYSTEM_PROMPT = `You direct AnimalDex's "guess the animal" shorts. A vertical 16–22 second puzzle: the viewer sees a close-up they cannot place, gets clues that get easier, guesses, and then the animal is revealed with its AnimalDex stat card. They should feel smart if they got it and need to comment either way.

THE FIRST FRAME IS THE PUZZLE: an extreme close-up of one distinctive part (an eye, the skin or feather pattern, a paw, a tooth, the texture of a horn), sharp, real, and hard but fair to place. The spoken line and the on-screen line start on that frame.

SHOTS (exactly 6, in order):
(1) CLUE 1, the close-up. narration: the challenge, at most 9 words ("Name this animal before the reveal." / "Only 1 in 10 people get this one."). hook_text: 3–6 words ("NAME IT BEFORE THE REVEAL").
(2) CLUE 2: the animal as a silhouette, backlit or mostly hidden (in tall grass, in shadow, in mist), still not identifiable. narration: the hardest clue (what it does or where it lives), at most 14 words, from the clues below. overlay "CLUE 2".
(3) CLUE 3: narration: an easier clue (how it looks or a striking number), at most 14 words. overlay "CLUE 3". (This shot replays the silhouette.)
(4) REVEAL: narration: "It's the <animal>." (or "It's a <animal>.") — nothing else. (The real artwork and its stat card are shown; no prompts needed.)
(5) THE PAYOFF: the animal in full, doing its most striking real thing. narration: the most surprising true fact about it, plus its lesson in a few words when one is given, 14–24 words in total.
(6) LOOP: narration: "Next one is harder." overlay "NEXT ONE IS HARDER". (This shot replays the opening close-up, so the video loops.)

RULES: every clue and fact comes from the page material below or well-established biology; never invent a number. A clue never names the animal or a giveaway word in its name ("snow" for a snow leopard). The voice is a fun quiz host: quick, warm, words a 10-year-old knows.
- shots[i].keyframe_prompt (shots 1, 2 and 5; "" for the others): the photoreal first frame of exactly this species, with the framing above (shot 1 so close the whole animal is not visible; shot 2 a silhouette). No other animals, no people, no text.
${LOOKS_RULE}
- shots[i].motion_prompt (shots 1, 2 and 5; "" for the others): one sentence, the camera move first (shot 1 a very slow pull-back that still never shows the whole animal), then the animal's one real movement.
- cta_narration / cta_text: when THIS ITEM'S EXPERIMENT says the ending is a loop, both "". Otherwise "How many clues did you need? Comment it." / "How many clues?".
- music_mood: "curious" or "mystery".

${SHARE_RULES}
Captions for this format never name the animal (the reveal is the point): "Guess it before the reveal 👀" style hook, a question asking for the number of clues; YouTube's title is the challenge, never the answer.

Return only the JSON object.`;

export const GUESS_JSON_SCHEMA = LESSON_JSON_SCHEMA;

export function buildGuessUserPrompt(source: VideoSource) {
    const facts = source.guess!;
    return [
        `The animal (never named before the reveal): ${facts.animal.name}`,
        `Page: ${source.url}`,
        "Clue material from its species page (hardest first):",
        ...facts.clues.map((clue) => `- ${clue}`),
        "Facts for the payoff:",
        ...facts.facts.map((fact) => `- ${fact}`),
        facts.lookalikes.length ? `Often mistaken for: ${facts.lookalikes.join("; ")}` : null,
        facts.lesson ? `Its AnimalDex lesson: ${facts.lesson}` : null
    ].filter((line) => line !== null).join("\n");
}

const GUESS_KEYFRAME_SUFFIX =
    "Photorealistic wildlife photograph, natural light, tack-sharp detail, shallow depth of field; species-accurate. Vertical 9:16. No text, no letters, no logos, no people, no other animals.";
const GUESS_MOTION_SUFFIX =
    "Natural, believable animal motion; a slow, smooth camera move. Keep the species, colours and markings exactly as in the frame. No text, no added animals or people.";
const GUESS_SHOTS = 6;

/** A guess plan: close-up, silhouette (twice), the reveal on the real artwork with its stat card, the payoff clip, the close-up again. */
export function normalizeGuessPlan(value: unknown, source: VideoSource, experiment: Experiment | null = null): VideoPlan | null {
    const facts = source.guess;
    const record = value as Record<string, unknown> | null;
    if (!facts || !record || typeof record !== "object" || !Array.isArray(record.shots)) return null;
    const share = parseShare(record.share);
    const shots = (record.shots as Array<Record<string, unknown>>).slice(0, GUESS_SHOTS).map((shot) => ({
        narration: clean(shot?.narration, 200),
        overlay: clean(shot?.overlay, 40),
        keyframe: clean(shot?.keyframe_prompt, 1200),
        motion: clean(shot?.motion_prompt, 500)
    }));
    if (!share || shots.length < GUESS_SHOTS || shots.some((shot) => !shot.narration)) return null;
    if ([0, 1, 4].some((index) => !shots[index].keyframe || !shots[index].motion)) return null;
    // The model may slip the name into a clue: a clue that gives the answer away is no clue.
    const nameWords = facts.animal.name.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
    const givesAway = (text: string) => nameWords.some((word) => text.toLowerCase().includes(word));
    if ([0, 1, 2].some((index) => givesAway(shots[index].narration) || givesAway(shots[index].overlay))) return null;
    const clip = (index: number): PlanScene => ({
        narration: shots[index].narration,
        overlay: index === 0 ? "" : shots[index].overlay,
        visual: "ai_clip",
        image: facts.animal.image,
        focusX: 0.5,
        motionPrompt: `${shots[index].motion} ${GUESS_MOTION_SUFFIX}`,
        keyframePrompt: `${shots[index].keyframe} ${GUESS_KEYFRAME_SUFFIX}`,
        subject: facts.animal.name
    });
    const loops = experiment?.ending === "loop";
    const scenes: PlanScene[] = [
        clip(0),
        clip(1),
        {narration: shots[2].narration, overlay: shots[2].overlay || "CLUE 3", visual: "image", image: facts.animal.image, focusX: 0.5, motionPrompt: "", reuseClip: 1},
        // The reveal: the real artwork with its stat card, the name slamming in.
        {narration: shots[3].narration, overlay: `It's the: ${facts.animal.name}`, overlayStyle: "winner", visual: "image", image: facts.animal.image, focusX: 0.5, motionPrompt: "", species: facts.animal.slug, minSeconds: 3},
        {...clip(4), overlay: ""},
        {narration: shots[5].narration, overlay: shots[5].overlay || "NEXT ONE IS HARDER", visual: "image", image: facts.animal.image, focusX: 0.5, motionPrompt: "", reuseClip: 0, minSeconds: 1.8}
    ];
    return {
        format: "guess",
        ending: loops ? "loop" : "cta_card",
        title: clean(record.title, 120) || "Guess the animal",
        hookText: clean(record.hook_text, 50) || "NAME IT BEFORE THE REVEAL",
        scenes,
        ctaNarration: loops ? "" : clean(record.cta_narration, 140) || "How many clues did you need? Comment it.",
        ctaText: loops ? "" : clean(record.cta_text, 40) || "How many clues?",
        musicMood: isMusicMood(record.music_mood) && record.music_mood !== "noir" ? record.music_mood : "curious",
        share
    };
}

// ------------------------------------------------------------------ scan

// The scan reveal: the founder's own footage of the app scanning a real
// animal at a zoo or aquarium, the result card, then the animal itself with
// one surprising fact and its lesson. Real footage of a real person using the
// product: the most original thing the account can post (research, Nov 2026:
// platforms down-rank templated AI slideshows; sends and real footage win).
// The shots come from our clips (footage.ts); the writer only writes the words.

export const SCAN_SYSTEM_PROMPT = `You write the voiceover for AnimalDex's scan reveals: real phone footage of our founder pointing the AnimalDex app at a real animal at a zoo or aquarium, the app's result card, then the animal itself. A vertical 14–20 second video in five shots. The voice is the founder's inner monologue, said by a narrator: curious, warm, a little amazed, never salesy. You do not describe the footage; you say what a curious person would say over it.

SHOTS (exactly 5, in order; the footage is fixed, you write only the words):
(1) THE SCAN: the phone is pointed at the animal. narration: a curious hook in at most 9 words that makes people need the answer ("Found this guy at the aquarium. What is it?" / "This thing was staring at me. Let's scan it."). Never name the animal here. hook_text (on screen over it): 3–6 words ("WHAT EVEN IS THIS?").
(2) THE RESULT: the app's card names it. narration: "It's a <animal>." plus at most 6 more words of surprise. overlay "".
(3) THE FACT: the animal itself. narration: the single most surprising TRUE fact about it, from the material below, in plain words, 10–18 words. overlay: the fact in 2–5 words.
(4) THE LESSON: the animal again. narration: its lesson for the viewer's life in 8–14 words, from its AnimalDex lesson when one is given, else a second fact. overlay: 2–5 words.
(5) THE CLOSE: narration: when THIS ITEM'S EXPERIMENT says the ending is a loop, a line that leads back to the start ("…and I still couldn't stop staring at it."); otherwise "What should I scan next? Comment it." overlay "".

RULES: every fact comes from the material below or well-established biology; never invent a number. Plain words a 10-year-old knows. Never say "AnimalDex" in the narration (the card shows it). No emoji, no hashtags.
- cta_narration / cta_text: "" when the ending is a loop; otherwise "" too (shot 5 already asks).
- music_mood: "curious" or "wonder".

${SHARE_RULES}
Captions for this format say it is real footage and invite people to say what they would scan next; TikTok and Instagram end with "What should I scan next?".

Return only the JSON object.`;

export const SCAN_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["title", "hook_text", "shots", "cta_narration", "cta_text", "music_mood", "share"],
    properties: {
        title: {type: "string"},
        hook_text: {type: "string"},
        shots: {type: "array", items: {type: "object", additionalProperties: false, required: ["narration", "overlay"], properties: {narration: {type: "string"}, overlay: {type: "string"}}}},
        cta_narration: {type: "string"},
        cta_text: {type: "string"},
        music_mood: {type: "string", enum: [...MUSIC_MOODS]},
        share: shareSchema
    }
} as const;

export function buildScanUserPrompt(source: VideoSource) {
    const facts = source.scan!;
    return [
        `The animal (named only from shot 2 on): ${facts.animal.name}`,
        `Page: ${source.url}`,
        "Material from its species page:",
        ...facts.facts.map((fact) => `- ${fact}`),
        facts.power ? `Its AnimalDex Power: ${facts.power}` : null,
        facts.lesson ? `Its AnimalDex lesson: ${facts.lesson}` : null
    ].filter((line) => line !== null).join("\n");
}

const SCAN_SHOTS = 5;

/** A scan reveal plan: each shot plays one of our clips (scan, result, animal, animal or reaction, reaction or the scan again). */
export function normalizeScanPlan(value: unknown, source: VideoSource, experiment: Experiment | null = null): VideoPlan | null {
    const facts = source.scan;
    const record = value as Record<string, unknown> | null;
    if (!facts || !record || typeof record !== "object" || !Array.isArray(record.shots)) return null;
    const share = parseShare(record.share);
    const shots = (record.shots as Array<Record<string, unknown>>).slice(0, SCAN_SHOTS).map((shot) => ({narration: clean(shot?.narration, 200), overlay: clean(shot?.overlay, 40)}));
    if (!share || shots.length < SCAN_SHOTS || shots.some((shot) => !shot.narration)) return null;
    const {scan, result, animal, reaction} = facts.clips;
    const opening = scan[0] ?? reaction[0];
    if (!opening || (!result[0] && !scan[1])) return null;
    const scene = (narration: string, overlay: string, footage: typeof opening | undefined, extra: Partial<PlanScene> = {}): PlanScene => ({
        narration,
        overlay,
        visual: "image",
        image: facts.animal.image,
        focusX: 0.5,
        motionPrompt: "",
        ...(footage ? {footage} : {}),
        ...extra
    });
    const loops = experiment?.ending === "loop";
    const scenes: PlanScene[] = [
        scene(shots[0].narration, "", opening),
        scene(shots[1].narration, `It's a: ${facts.animal.name}`, result[0] ?? scan[1], {overlayStyle: "winner", minSeconds: 2.8}),
        scene(shots[2].narration, shots[2].overlay, animal[0] ?? reaction[0]),
        scene(shots[3].narration, shots[3].overlay, animal[1] ?? reaction[1] ?? animal[0]),
        // The close: a reaction when we have one, else the scan again (it loops back into shot 1).
        reaction[0] && animal[0] ? scene(shots[4].narration, "", reaction[0]) : scene(shots[4].narration, "", undefined, {reuseClip: 0})
    ];
    // A shot we have no clip for falls back to an AI clip of the real animal, never a cut-out still.
    for (const entry of scenes) {
        if (entry.footage || entry.reuseClip !== undefined) continue;
        entry.visual = "ai_clip";
        entry.keyframePrompt = `A real ${facts.animal.name} in a zoo or aquarium enclosure, close and sharp, natural light, shot on a phone. Photorealistic, species-accurate. Vertical 9:16. No text, no people.`;
        entry.motionPrompt = `Handheld phone camera, the ${facts.animal.name} moves naturally. No text, no added animals or people.`;
    }
    return {
        format: "scan",
        ending: loops ? "loop" : "cta_card",
        title: clean(record.title, 120) || `I scanned a ${facts.animal.name}`,
        hookText: clean(record.hook_text, 50) || "WHAT EVEN IS THIS?",
        scenes,
        ctaNarration: "",
        ctaText: loops ? "" : "What should I scan next?",
        musicMood: isMusicMood(record.music_mood) && record.music_mood !== "noir" ? record.music_mood : "curious",
        share
    };
}

// ---------------------------------------------------------------- you vs

// "Could you beat a gorilla?": the viewer against one real animal, three
// rounds, each stat shown as something that happens to them, one round they
// really win, then the score. Research (Nov 2026): "100 men vs 1 gorilla"
// (288M on X), Sambucha's survival Shorts (25M), "bite force vs leg" (19.7M,
// AI): the viewer is the fighter and the ending is argued over.

export const YOU_VS_SYSTEM_PROMPT = `You direct AnimalDex's "You vs the animal" shorts: could YOU beat this animal? A vertical 16–24 second video in six shots: three rounds between the viewer and one real animal, each shown as a physical event, then the verdict and a question that splits the comments.

WHY IT WORKS: the viewer is the fighter. Every stat becomes something that happens to them ("It runs 60 km/h. It catches you in four seconds."). One round is one a human really wins (running for hours in the heat, throwing, planning ahead, using tools, climbing a ladder, staying awake), so the ending is argued over.

THE TRUTH RULE: every number and claim is from the record below or well-established biology; never invent a number. Without a sure number, compare without one ("It outweighs three of you."). For the human side: an average adult sprints about 20–25 km/h and weighs about 60–80 kg; trained people can run 40+ km in a day in the heat, which almost no animal can.

SHOTS (exactly 6, in order):
(1) HOOK, 0–3 s: narration "Could you beat a <animal>? Three rounds." or sharper, at most 10 words, the animal named in the first five. hook_text: 3–6 words ("YOU VS A GORILLA"). Shot: the animal at eye level, staring into the lens, close, from the viewer's point of view.
(2) ROUND 1: the animal's strongest edge as an event, second person. overlay "ROUND 1: <SKILL>" ("ROUND 1: STRENGTH"). Shot: the animal doing it, coming toward the camera.
(3) ROUND 2: a different edge. overlay "ROUND 2: <SKILL>".
(4) ROUND 3: the round YOU win, said plainly and truly. overlay "ROUND 3: <SKILL>". Shot: the animal at the limit of that skill (panting in the heat, looking up at something out of reach).
(5) VERDICT: the score and who wins overall, honestly ("Two rounds to one. The gorilla wins, but only up close."). overlay "<ANIMAL> WINS 2–1" or "YOU WIN 2–1". (The real artwork and its stat card are shown; no prompts needed.)
(6) ASK: a question that makes people pick a side ("Which round would you take? Comment it."). overlay: 2–5 words. (Replays the opening shot so the video loops.)

WORDS: a fun, confident host; words a 10-year-old knows; each line at most 18 words; 50–70 words in total. No gore: an event shows power (a charge, a lift, a sprint), never an injury, never blood, never a person getting hurt.
- shots[i].keyframe_prompt (shots 1–4; "" for 5 and 6): the photoreal first frame of exactly this species doing exactly this, from the viewer's point of view (first-person camera, the animal facing it). Never people or human body parts, never text.
${LOOKS_RULE}
- shots[i].motion_prompt (shots 1–4; "" for 5 and 6): one sentence, the camera move first, then the animal's one real movement.
- cta_narration / cta_text: when THIS ITEM'S EXPERIMENT says the ending is a loop, both "". Otherwise "Could you take it? Comment your round." / "Could you take it?".
- music_mood: "intense" or "epic".

${SHARE_RULES}
Captions for this format: the challenge first ("Could you beat a gorilla? 3 rounds 🥊"), then a question asking which round they would win. The shots are AI-imagined: say so once, naturally.

Return only the JSON object.`;

export const YOU_VS_JSON_SCHEMA = LESSON_JSON_SCHEMA;

export function buildYouVsUserPrompt(source: VideoSource) {
    const facts = source.youVs!;
    return [
        `The animal: ${facts.animal.name}`,
        `Page: ${source.url}`,
        "Its side of the AnimalDex battle stats:",
        ...facts.stats.map((stat) => `- ${stat.label}: ${stat.value}`),
        "Facts from its species page:",
        ...facts.facts.map((fact) => `- ${fact}`),
        facts.lesson ? `Its AnimalDex lesson: ${facts.lesson}` : null
    ].filter((line) => line !== null).join("\n");
}

const POV_KEYFRAME_SUFFIX =
    "Photorealistic wildlife photograph from a first-person point of view at human eye level, the animal facing the camera, natural light, tack-sharp detail, dramatic but real; species-accurate. Vertical 9:16. No people, no hands, no text, no letters, no logos, no blood.";
const POV_MOTION_SUFFIX =
    "Powerful, believable animal motion with real weight toward the camera; a handheld first-person camera. Keep the species, colours and markings exactly as in the frame. No people, no blood, no text.";
const YOU_VS_SHOTS = 6;

/** A you-vs plan: the stare, three rounds (AI clips), the verdict on the real artwork with its stat card, the stare again. */
export function normalizeYouVsPlan(value: unknown, source: VideoSource, experiment: Experiment | null = null): VideoPlan | null {
    const facts = source.youVs;
    const record = value as Record<string, unknown> | null;
    if (!facts || !record || typeof record !== "object" || !Array.isArray(record.shots)) return null;
    const share = parseShare(record.share);
    const shots = (record.shots as Array<Record<string, unknown>>).slice(0, YOU_VS_SHOTS).map((shot) => ({
        narration: clean(shot?.narration, 200),
        overlay: clean(shot?.overlay, 40),
        keyframe: clean(shot?.keyframe_prompt, 1200),
        motion: clean(shot?.motion_prompt, 500)
    }));
    if (!share || shots.length < YOU_VS_SHOTS || shots.some((shot) => !shot.narration)) return null;
    if ([0, 1, 2, 3].some((index) => !shots[index].keyframe || !shots[index].motion)) return null;
    const loops = experiment?.ending === "loop";
    const clip = (index: number): PlanScene => ({
        narration: shots[index].narration,
        overlay: index === 0 ? "" : shots[index].overlay || `ROUND ${index}`,
        visual: "ai_clip",
        image: facts.animal.image,
        focusX: 0.5,
        motionPrompt: `${shots[index].motion} ${POV_MOTION_SUFFIX}`,
        keyframePrompt: `${shots[index].keyframe} ${POV_KEYFRAME_SUFFIX}`,
        subject: facts.animal.name
    });
    const scenes: PlanScene[] = [
        clip(0),
        clip(1),
        clip(2),
        clip(3),
        {narration: shots[4].narration, overlay: shots[4].overlay || `${facts.animal.name} wins`, overlayStyle: "winner", visual: "image", image: facts.animal.image, focusX: 0.5, motionPrompt: "", species: facts.animal.slug, minSeconds: 3},
        {narration: shots[5].narration, overlay: shots[5].overlay, visual: "image", image: facts.animal.image, focusX: 0.5, motionPrompt: "", reuseClip: 0, minSeconds: 1.8}
    ];
    return {
        format: "you_vs",
        ending: loops ? "loop" : "cta_card",
        title: clean(record.title, 120) || `Could you beat a ${facts.animal.name}?`,
        hookText: clean(record.hook_text, 50) || `YOU VS A ${facts.animal.name.toUpperCase()}`,
        scenes,
        ctaNarration: loops ? "" : clean(record.cta_narration, 140) || "Could you take it? Comment your round.",
        ctaText: loops ? "" : clean(record.cta_text, 40) || "Could you take it?",
        musicMood: isMusicMood(record.music_mood) && record.music_mood !== "noir" ? record.music_mood : "intense",
        share
    };
}

// ------------------------------------------------------- would you rather

// "Would you rather have the bite of a crocodile or the speed of a cheetah?":
// two animals of a comparison page, each power in action, each one's real
// catch, then "A or B?". Research (Nov 2026): "Shark or Chimp" 13.9M with 22K
// comments, This or That 60M; a fair, hard choice is argued over.

export const WOULD_YOU_RATHER_SYSTEM_PROMPT = `You direct AnimalDex's "Would you rather" shorts: two real animals, one superpower each, and the viewer has to pick. A vertical 16–24 second video in six shots that ends with everyone arguing in the comments.

WHY IT WORKS: a hard, fair choice. Each power sounds amazing, then each has a real catch, so neither answer is obvious.

THE TRUTH RULE: both powers and both catches are real biology, from the record below or well-established science; never invent a number. A catch is a real cost of that power (a cheetah is spent after about 30 seconds of sprinting and often loses its meal to lions).

SHOTS (exactly 6, in order):
(1) THE QUESTION: "Would you rather have the <power A> of a <animal A>, or the <power B> of a <animal B>?", at most 22 words. hook_text: 2–5 words ("WOULD YOU RATHER…"). (Shown on the two animals' card; no prompts needed.)
(2) POWER A in action: what it would let YOU do, second person, with a vivid true number when there is one. overlay: the power in 2–4 words ("A CRUSHING BITE"). Shot: animal A using it.
(3) POWER B in action, the same way. overlay: power B in 2–4 words. Shot: animal B using it.
(4) THE CATCH of power A: one true downside, said as what it would cost you. overlay "THE CATCH". (Shows animal A's artwork.)
(5) THE CATCH of power B, the same way. overlay "THE CATCH". (Shows animal B's artwork.)
(6) ASK: "<animal A> or <animal B>? Comment your pick." overlay: the two names with "OR". (Back to the question card, so it loops.)

WORDS: quick and playful; words a 10-year-old knows; each line at most 20 words; 55–75 words in total.
- shots[i].keyframe_prompt (shots 2 and 3; "" for the others): the photoreal first frame of exactly that species using exactly that power, dynamic and close. Never people, never text.
${LOOKS_RULE}
- shots[i].motion_prompt (shots 2 and 3; "" for the others): one sentence, the camera move first, then the animal's one real movement.
- cta_narration / cta_text: when THIS ITEM'S EXPERIMENT says the ending is a loop, both "". Otherwise "Pick one in the comments." / "Which one?".
- music_mood: "playful" or "curious".

${SHARE_RULES}
Captions for this format: the question itself, then "Comment A or B 👇". The action shots are AI-imagined: say so once, naturally.

Return only the JSON object.`;

export const WOULD_YOU_RATHER_JSON_SCHEMA = LESSON_JSON_SCHEMA;

export function buildWouldYouRatherUserPrompt(source: VideoSource) {
    const facts = source.wouldYouRather!;
    const power = (name: string, entry: {name: string; basis: string} | null) => entry ? `${name}'s AnimalDex Power: ${entry.name} — ${entry.basis}` : `${name} has no AnimalDex Power yet: pick its signature ability from the stats and facts.`;
    return [
        `Animal A: ${facts.a.name}`,
        `Animal B: ${facts.b.name}`,
        `Page: ${source.url}`,
        power(facts.a.name, facts.powers.a),
        power(facts.b.name, facts.powers.b),
        "Battle stats (A | B):",
        ...facts.stats.map((stat) => `- ${stat.label}: ${stat.a} | ${stat.b}`),
        `Facts about ${facts.a.name}:`,
        ...facts.facts.a.map((fact) => `- ${fact}`),
        `Facts about ${facts.b.name}:`,
        ...facts.facts.b.map((fact) => `- ${fact}`)
    ].join("\n");
}

const WOULD_YOU_RATHER_SHOTS = 6;

/** A would-you-rather plan: the question over power B's clip, each power (AI clips), each catch on the real artwork, the two animals' card for the pick. */
export function normalizeWouldYouRatherPlan(value: unknown, source: VideoSource, experiment: Experiment | null = null): VideoPlan | null {
    const facts = source.wouldYouRather;
    const record = value as Record<string, unknown> | null;
    if (!facts || !record || typeof record !== "object" || !Array.isArray(record.shots)) return null;
    const share = parseShare(record.share);
    const shots = (record.shots as Array<Record<string, unknown>>).slice(0, WOULD_YOU_RATHER_SHOTS).map((shot) => ({
        narration: clean(shot?.narration, 220),
        overlay: clean(shot?.overlay, 40),
        keyframe: clean(shot?.keyframe_prompt, 1200),
        motion: clean(shot?.motion_prompt, 500)
    }));
    if (!share || shots.length < WOULD_YOU_RATHER_SHOTS || shots.some((shot) => !shot.narration)) return null;
    if ([1, 2].some((index) => !shots[index].keyframe || !shots[index].motion)) return null;
    const loops = experiment?.ending === "loop";
    const card = (narration: string, overlay: string, minSeconds: number): PlanScene => ({
        narration, overlay, visual: "card", image: facts.a.image, focusX: 0.5, motionPrompt: "", minSeconds,
        card: {kind: "pair", left: facts.a, right: facts.b, title: "or"}
    });
    const power = (index: number, side: "a" | "b"): PlanScene => ({
        narration: shots[index].narration,
        overlay: shots[index].overlay,
        visual: "ai_clip",
        image: facts[side].image,
        focusX: 0.5,
        motionPrompt: `${shots[index].motion} ${GUESS_MOTION_SUFFIX}`,
        keyframePrompt: `${shots[index].keyframe} ${GUESS_KEYFRAME_SUFFIX}`,
        subject: facts[side].name
    });
    // No stat card on a catch: over the artwork it covers the animal's face, and the catch is the point.
    const catchScene = (index: number, side: "a" | "b"): PlanScene => ({
        narration: shots[index].narration, overlay: shots[index].overlay || "THE CATCH", visual: "image", image: facts[side].image, focusX: 0.5, motionPrompt: ""
    });
    return {
        format: "would_you_rather",
        ending: loops ? "loop" : "cta_card",
        title: clean(record.title, 120) || `${facts.a.name} or ${facts.b.name}: would you rather?`,
        hookText: clean(record.hook_text, 50) || "WOULD YOU RATHER…",
        // The question opens on power B in action (frame 0 is a moving animal, not a card); the card comes back for the pick.
        scenes: [
            {narration: shots[0].narration, overlay: "", visual: "image", image: facts.b.image, focusX: 0.5, motionPrompt: "", reuseClip: 2, minSeconds: 3},
            power(1, "a"),
            power(2, "b"),
            catchScene(3, "a"),
            catchScene(4, "b"),
            card(shots[5].narration, shots[5].overlay || `${facts.a.name} or ${facts.b.name}?`, 2.2)
        ],
        ctaNarration: loops ? "" : clean(record.cta_narration, 140) || "Pick one in the comments.",
        ctaText: loops ? "" : clean(record.cta_text, 40) || "Which one?",
        musicMood: isMusicMood(record.music_mood) && record.music_mood !== "noir" ? record.music_mood : "playful",
        share
    };
}

// --------------------------------------------------------------- pokemon

// "This real animal is a Pokémon. Name it.": the real animal (never Pokémon
// artwork), two clues from the design match on /pokemon-animals, the reveal,
// then a true fact that beats the game. Research (Nov 2026): real-animal
// Pokémon Shorts run 3.6–15.9M; gaming fans cross over into nature.

export const POKEMON_SYSTEM_PROMPT = `You direct AnimalDex's "real animals that look like Pokémon" shorts. A vertical 16–22 second quiz: the viewer sees a REAL animal, guesses which Pokémon it matches, then gets the answer and one true fact about the real animal that is wilder than the game.

No Pokémon artwork is ever shown and no shot depicts a Pokémon, a cartoon or a game: every shot is the real animal, photoreal. The Pokémon is only ever named in words.

SHOTS (exactly 6, in order):
(1) HOOK: the real animal, close and striking. narration: the challenge, at most 10 words ("This real animal is a Pokémon. Name it."). hook_text: 3–6 words ("NAME THE POKÉMON").
(2) CLUE 1: a design cue from the match note below, said about the real animal. overlay "CLUE 1". Shot: the animal showing that feature.
(3) CLUE 2: an easier cue. overlay "CLUE 2". (Replays shot 2.)
(4) REVEAL: "It's <Pokémon>! The real one is the <animal>." — nothing else. (The animal's artwork and stat card are shown; no prompts needed.)
(5) PAYOFF: the most surprising true fact about the real animal, 14–24 words, ideally one that beats the game ("Squirtle sprays water. A real green sea turtle can sleep underwater for hours.").
(6) LOOP: "Comment the next Pokémon I should find." overlay "WHICH POKÉMON NEXT?". (Replays the opening shot.)

RULES: facts from the record below or well-established biology; never invent a number; say about the Pokémon only what the match note says. A clue never names the Pokémon or a giveaway part of its name. Fun and quick, words a 10-year-old knows.
- shots[i].keyframe_prompt (shots 1, 2 and 5; "" for the others): the photoreal first frame of exactly this real species (shot 1 close on its face, shot 2 showing the feature of the clue). Never cartoons, game art or toys, never people, never text.
${LOOKS_RULE}
- shots[i].motion_prompt (shots 1, 2 and 5; "" for the others): one sentence, the camera move first, then the animal's one real movement.
- cta_narration / cta_text: when THIS ITEM'S EXPERIMENT says the ending is a loop, both "". Otherwise "Comment the next Pokémon to find." / "Which Pokémon next?".
- music_mood: "playful" or "curious".

${SHARE_RULES}
Captions for this format never name the Pokémon (the reveal is the point): "Which Pokémon is this real animal? 👀"; YouTube's title is the challenge, never the answer.

Return only the JSON object.`;

export const POKEMON_JSON_SCHEMA = LESSON_JSON_SCHEMA;

export function buildPokemonUserPrompt(source: VideoSource) {
    const facts = source.pokemon!;
    return [
        `The Pokémon (never named before the reveal): ${facts.pokemon}`,
        `The real animal: ${facts.animal.name}`,
        `Page: ${source.url}`,
        `Why they match: ${facts.note}`,
        "Facts about the real animal:",
        ...facts.facts.map((fact) => `- ${fact}`),
        facts.lesson ? `Its AnimalDex lesson: ${facts.lesson}` : null
    ].filter((line) => line !== null).join("\n");
}

const POKEMON_SHOTS = 6;

/** A Pokémon plan: the real animal, two clues, the reveal on its artwork with its stat card, the payoff, the opening again. */
export function normalizePokemonPlan(value: unknown, source: VideoSource, experiment: Experiment | null = null): VideoPlan | null {
    const facts = source.pokemon;
    const record = value as Record<string, unknown> | null;
    if (!facts || !record || typeof record !== "object" || !Array.isArray(record.shots)) return null;
    const share = parseShare(record.share);
    const shots = (record.shots as Array<Record<string, unknown>>).slice(0, POKEMON_SHOTS).map((shot) => ({
        narration: clean(shot?.narration, 200),
        overlay: clean(shot?.overlay, 40),
        keyframe: clean(shot?.keyframe_prompt, 1200),
        motion: clean(shot?.motion_prompt, 500)
    }));
    if (!share || shots.length < POKEMON_SHOTS || shots.some((shot) => !shot.narration)) return null;
    if ([0, 1, 4].some((index) => !shots[index].keyframe || !shots[index].motion)) return null;
    // A clue that names the Pokémon gives the answer away.
    const nameWords = facts.pokemon.toLowerCase().split(/[\s-]+/).filter((word) => word.length > 2);
    const givesAway = (text: string) => nameWords.some((word) => text.toLowerCase().includes(word));
    if ([0, 1, 2].some((index) => givesAway(shots[index].narration) || givesAway(shots[index].overlay))) return null;
    const clip = (index: number): PlanScene => ({
        narration: shots[index].narration,
        overlay: index === 0 ? "" : shots[index].overlay,
        visual: "ai_clip",
        image: facts.animal.image,
        focusX: 0.5,
        motionPrompt: `${shots[index].motion} ${GUESS_MOTION_SUFFIX}`,
        keyframePrompt: `${shots[index].keyframe} ${GUESS_KEYFRAME_SUFFIX}`,
        subject: facts.animal.name
    });
    const loops = experiment?.ending === "loop";
    return {
        format: "pokemon",
        ending: loops ? "loop" : "cta_card",
        title: clean(record.title, 120) || "Which Pokémon is this real animal?",
        hookText: clean(record.hook_text, 50) || "NAME THE POKÉMON",
        scenes: [
            clip(0),
            {...clip(1), overlay: shots[1].overlay || "CLUE 1"},
            {narration: shots[2].narration, overlay: shots[2].overlay || "CLUE 2", visual: "image", image: facts.animal.image, focusX: 0.5, motionPrompt: "", reuseClip: 1},
            {narration: shots[3].narration, overlay: `It's ${facts.pokemon}`, overlayStyle: "winner", visual: "image", image: facts.animal.image, focusX: 0.5, motionPrompt: "", species: facts.animal.slug, minSeconds: 3},
            {...clip(4), overlay: ""},
            {narration: shots[5].narration, overlay: shots[5].overlay || "WHICH POKÉMON NEXT?", visual: "image", image: facts.animal.image, focusX: 0.5, motionPrompt: "", reuseClip: 0, minSeconds: 1.8}
        ],
        ctaNarration: loops ? "" : clean(record.cta_narration, 140) || "Comment the next Pokémon to find.",
        ctaText: loops ? "" : clean(record.cta_text, 40) || "Which Pokémon next?",
        musicMood: isMusicMood(record.music_mood) && record.music_mood !== "noir" ? record.music_mood : "playful",
        share
    };
}

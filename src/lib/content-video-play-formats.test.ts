import assert from "node:assert/strict";
import test from "node:test";
import {applyFootage, type FootageClip, planHasAiImagery} from "./content-video/footage";
import {normalizePokemonPlan, normalizeWouldYouRatherPlan, normalizeYouVsPlan, POKEMON_SYSTEM_PROMPT, YOU_VS_SYSTEM_PROMPT} from "./content-video/formats";
import {applyStatCards, type StatCard, type VideoSource} from "./content-video/plan";
import {redrawPrompt} from "./content-video/higgsfield";
import {famousSides} from "./content-video/auto-generate-plan";
import {sourcePath} from "./content-video/source-paths";
import {KIND_DIMENSIONS} from "./social-lab/arms";
import {SOURCE_FORMAT} from "./social-lab/format-board";

const share = {youtube: {title: "t", description: "d"}, tiktok: {caption: "t"}, instagram: {caption: "i"}, facebook: {caption: "f"}, x: {text: "x"}};
const shot = (narration: string, overlay = "", drawn = true) => ({narration, overlay, keyframe_prompt: drawn ? "a frame" : "", motion_prompt: drawn ? "slow push-in" : ""});
const reply = (shots: ReturnType<typeof shot>[]) => ({title: "t", hook_text: "H", shots, cta_narration: "", cta_text: "", music_mood: "intense", share});
const card: StatCard = {name: "Gorilla", tier: "A", stats: {dominance: 90, speed: 40, size: 80, intelligence: 85, rarity: 70}};
const base = {slug: "x", title: "t", description: "", url: "https://animaldex.app/x", tags: [], text: "", images: [{index: 1, src: "/a", alt: "", caption: null, width: 1, height: 1, license: null}, {index: 2, src: "/b", alt: "", caption: null, width: 1, height: 1, license: null}]};
const gorilla = {slug: "western-gorilla", name: "Western Gorilla", image: 1};

test("you vs the animal: three drawn rounds, the verdict on the artwork with its stat card, then the stare again", () => {
    const source: VideoSource = {...base, type: "you_vs", format: "you_vs", species: [{slug: gorilla.slug, name: gorilla.name, image: 1, card}], youVs: {animal: gorilla, stats: [{label: "Mass", value: "140 kg"}], facts: [], lesson: null}};
    const made = normalizeYouVsPlan(reply([shot("Could you beat a gorilla?"), shot("It lifts more than you.", "ROUND 1: STRENGTH"), shot("It bites harder."), shot("But you can run all day.", "ROUND 3: STAMINA"), shot("Two to one, gorilla.", "", false), shot("Which round is yours?", "", false)]), source)!;
    assert.equal(made.format, "you_vs");
    assert.deepEqual(made.scenes.map((scene) => scene.visual), ["ai_clip", "ai_clip", "ai_clip", "ai_clip", "image", "image"]);
    assert.equal(made.scenes[2].overlay, "ROUND 2", "a round the model left unlabelled still says which round");
    assert.equal(made.scenes[5].reuseClip, 0);
    // Each drawn round is checked for the right animal before it is animated.
    assert.deepEqual(made.scenes.map((scene) => scene.subject ?? null), ["Western Gorilla", "Western Gorilla", "Western Gorilla", "Western Gorilla", null, null]);
    // The stat card goes on the verdict only, never on a round.
    const carded = applyStatCards(made, source);
    assert.deepEqual(carded.scenes.map((scene) => Boolean(scene.statCard)), [false, false, false, false, true, false]);
    // Our zoo footage does not show a charge or a sprint: the rounds stay drawn.
    const clips: FootageClip[] = [{id: "g", kind: "animal", species: gorilla.slug, label: null, seconds: 8, path: "footage/g.mp4", poster: "footage/g.jpg", filmed: null}];
    assert.equal(applyFootage(made, source, clips), made);
    assert.match(YOU_VS_SYSTEM_PROMPT, /never invent a number/);
    // A round without its prompts is no plan.
    assert.equal(normalizeYouVsPlan(reply([shot("a"), shot("b"), shot("c", "", false), shot("d"), shot("e", "", false), shot("f", "", false)]), source), null);
});

test("would you rather: the question over a power in action, both powers drawn, both catches on the artwork, the two animals' card for the pick", () => {
    const croc = {slug: "nile-crocodile", name: "Nile Crocodile", image: 2};
    const source: VideoSource = {...base, type: "would_you_rather", format: "would_you_rather", wouldYouRather: {a: gorilla, b: croc, powers: {a: null, b: null}, stats: [], facts: {a: [], b: []}}};
    const made = normalizeWouldYouRatherPlan(reply([shot("Would you rather…", "", false), shot("Lift a car.", "SUPER STRENGTH"), shot("Bite through bone.", "A CRUSHING BITE"), shot("But you'd eat leaves all day.", "", false), shot("But you can barely open your jaws.", "", false), shot("Gorilla or croc?", "", false)]), source)!;
    assert.deepEqual(made.scenes.map((scene) => scene.visual), ["image", "ai_clip", "ai_clip", "image", "image", "card"]);
    // Frame 0 is the crocodile's clip, not a still card.
    assert.equal(made.scenes[0].reuseClip, 2);
    assert.equal(made.scenes[5].card?.kind === "pair" && made.scenes[5].card.title, "or");
    assert.deepEqual(made.scenes.map((scene) => scene.image), [2, 1, 2, 1, 2, 1]);
    assert.equal(made.scenes[3].overlay, "THE CATCH");
    assert.equal(made.scenes[5].overlay, "Western Gorilla or Nile Crocodile?");
    assert.ok(made.scenes.every((scene) => !scene.species), "no stat card over a catch");
    assert.equal(planHasAiImagery(made), true);
});

test("real-life Pokémon: never names the Pokémon before the reveal, and plays our own clip of the real animal where it can", () => {
    const turtle = {slug: "green-sea-turtle", name: "Green Sea Turtle", image: 1};
    const source: VideoSource = {...base, type: "pokemon", format: "pokemon", pokemon: {pokemon: "Squirtle", animal: turtle, note: "A shell and a beak.", facts: [], lesson: null}};
    const shots = [shot("This real animal is a Pokémon. Name it."), shot("It wears its home on its back.", "CLUE 1"), shot("It spits water.", "", false), shot("It's Squirtle!", "", false), shot("It can sleep underwater for hours."), shot("Comment the next one.", "", false)];
    const made = normalizePokemonPlan(reply(shots), source)!;
    assert.equal(made.format, "pokemon");
    assert.equal(made.scenes[3].overlay, "It's Squirtle");
    assert.equal(made.scenes[3].species, turtle.slug);
    assert.equal(normalizePokemonPlan(reply([shots[0], shot("Squirtle fans know this shell.", "CLUE 1"), ...shots.slice(2)]), source), null, "a clue that names the Pokémon is rejected");
    const clips: FootageClip[] = [{id: "t1", kind: "animal", species: turtle.slug, label: null, seconds: 9, path: "footage/t1.mp4", poster: "footage/t1.jpg", filmed: null}, {id: "t2", kind: "animal", species: turtle.slug, label: null, seconds: 5, path: "footage/t2.mp4", poster: "footage/t2.jpg", filmed: null}];
    const filmed = applyFootage(made, source, clips);
    assert.deepEqual(filmed.scenes.map((scene) => scene.footage?.id ?? null), ["t1", null, null, null, "t2", null]);
    assert.match(POKEMON_SYSTEM_PROMPT, /No Pokémon artwork is ever shown/);
});

test("the play formats are registered everywhere a format must be", () => {
    for (const type of ["you_vs", "would_you_rather", "pokemon"] as const) {
        assert.equal(SOURCE_FORMAT[type], type);
        assert.ok(KIND_DIMENSIONS[type]);
    }
    assert.equal(sourcePath("you_vs", "western-gorilla"), "/animals/western-gorilla");
    assert.equal(sourcePath("would_you_rather", "gorilla-vs-crocodile"), "/comparisons/gorilla-vs-crocodile");
    assert.equal(sourcePath("pokemon", "squirtle"), "/pokemon-animals/squirtle");
});

test("a would-you-rather needs an animal people know: a lion-tamarin or a lionfish is not a lion", () => {
    assert.equal(famousSides("gorilla-vs-crocodile"), 2);
    assert.equal(famousSides("aardvark-vs-african-lion"), 1);
    assert.equal(famousSides("clownfish-vs-lionfish"), 0);
    assert.equal(famousSides("bongo-vs-golden-headed-lion-tamarin"), 0);
});

test("a drawn frame that showed the wrong animal is redrawn with the correction", () => {
    assert.match(redrawPrompt("A honey badger digging.", "Honey Badger", "an anteater"), /must be unmistakably a Honey Badger.*looked like an anteater, which is wrong/);
});

test("every format's writer is told to sound like a person and open on an event", async () => {
    const formats = await import("./content-video/formats");
    const {PLAN_SYSTEM_PROMPT} = await import("./content-video/plan");
    for (const prompt of [PLAN_SYSTEM_PROMPT, formats.BATTLE_SYSTEM_PROMPT, formats.CREATURE_SYSTEM_PROMPT, formats.YOU_VS_SYSTEM_PROMPT, formats.WOULD_YOU_RATHER_SYSTEM_PROMPT, formats.POKEMON_SYSTEM_PROMPT, formats.GUESS_SYSTEM_PROMPT]) {
        assert.match(prompt, /SOUND LIKE A PERSON, NOT A DOCUMENTARY/);
    }
    assert.doesNotMatch(formats.YOU_VS_SYSTEM_PROMPT, /staring into the lens/);
});

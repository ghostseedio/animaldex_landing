/**
 * The stored text that describes each Ark species' behaviour, and the
 * behaviours found in it (the rich-behaviours brief, docs/ark/behaviour-data-report.md).
 * Shared by the recipe generator (`ark-behaviour-recipes.mts`) and its tests.
 *
 * Deterministic phrase rules over stored data only: no AI calls. Every hit keeps
 * the stored field and a verbatim phrase (whole words, cut from the sentence the
 * rule matched), so a recipe can be checked against the catalogue text.
 */

export type TextField =
    | "sleep"
    | "time"
    | "months"
    | "habitat"
    | "look"
    | "diet"
    | "predators"
    | "offspring"
    | "sexdiff"
    | "traits"
    | "facts"
    | "spotlight"
    | "story"
    | "basis"
    | "evidence"
    | "sd"
    | "activity"
    | "sociality"
    | "season";

/** Where each field is stored (for the report). */
export const FIELD_SOURCES: Record<TextField, string> = {
    sleep: "species_field_guide.sleep_pattern",
    time: "species_field_guide.best_time_of_day",
    months: "species_field_guide.best_months",
    habitat: "species_field_guide.typical_habitat",
    look: "species_field_guide.where_to_look",
    diet: "species_field_guide.diet_summary",
    predators: "species_field_guide.predators_summary",
    offspring: "species_field_guide.female_offspring_notes",
    sexdiff: "species_field_guide.sex_difference_notes",
    traits: "species_field_guide.signature_traits[]",
    facts: "species_field_guide.interesting_facts[]",
    spotlight: "species_field_guide.species_spotlight",
    story: "species_field_guide.species_subtitle_story",
    basis: "species_behavior_principles.biological_basis",
    evidence: "species_behavior_principles.behavioral_evidence[].observation + biological_function",
    sd: "species_system_dynamics.signature_explanation",
    activity: "voyage_species_traits.activity_phrase",
    sociality: "voyage_species_traits.sociality_phrase",
    season: "voyage_species_traits.season_phrase"
};

export type SpeciesText = {
    id: string;
    slug: string;
    name: string;
    zone: string | null;
    excluded: string | null;
    parentSlug: string | null;
    fromParent: boolean;
    className: string | null;
    order: string | null;
    family: string | null;
    plan: string;
    /** The body plan's own words: the profile generator's movement, social, diet, roost (behaviour lane). */
    move: string | null;
    moves: string[];
    social: string | null;
    diet: string | null;
    roost: string | null;
    activityValue: string | null;
    /** voyage_species_traits.season (the breeding season, where stored). */
    seasonValue: string[] | null;
    text: Partial<Record<TextField, string>>;
};

/** Sentences about the young (larvae, caterpillars, tadpoles) are left out: the Ark shows the adult. */
const YOUNG = /\b(larva|larvae|larval|caterpillars?|nymphs?|naiads?|tadpoles?|grubs|maggots|hellgrammites?|fry|juveniles? (live|feed|stay))\b/i;

/** Its sentences in a field (the young's left out). */
export function sentences(text: string | undefined | null): string[] {
    if (!text) return [];
    return text
        .replace(/\s+/g, " ")
        .split(/(?<=[.!?;])\s+(?=[A-Z0-9"“(])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 3 && !YOUNG.test(s));
}

/**
 * A verbatim phrase round a match: the sentence, or (a long one) the words round the match, cut at word
 * boundaries (never inside a word), without its last full stop.
 */
export function phraseAt(sentence: string, index: number, length: number, max = 150): string {
    let start = 0;
    let end = sentence.length;
    if (end - start > max) {
        // The clause round it first (between commas, semicolons, dashes), then a window of words.
        const before = Math.max(sentence.lastIndexOf(", ", index), sentence.lastIndexOf(" - ", index), sentence.lastIndexOf(" – ", index), sentence.lastIndexOf(": ", index));
        if (before >= 0 && index - before < 90) start = before + 2;
        const after = [", ", " - ", " – ", ": "].map((s) => sentence.indexOf(s, index + length)).filter((i) => i >= 0);
        if (after.length) end = Math.min(...after);
        if (end - start > max || end - start < 24) {
            start = Math.max(0, index - 60);
            end = Math.min(sentence.length, index + length + 70);
            while (start > 0 && /\S/.test(sentence[start - 1])) start--;
            while (end < sentence.length && /\S/.test(sentence[end])) end++;
        }
    }
    return sentence
        .slice(start, end)
        .trim()
        .replace(/^[,;:–-]\s*/, "")
        .replace(/[.;,:]$/, "");
}

/** Words just before a match that make it not its own doing, or not done at all. */
const NEGATED = /(\b(not|never|no|nor|cannot|can't|doesn't|don't|isn't|aren't|rarely|seldom|unlike|without|instead of|rather than|little|unable to|too \w+ to|avoids?|avoiding|lacks?|lacking)\b[^.,;]{0,28}|\bthan (a|an|the)\b[^.,;]{0,12})$/i;
/** A sentence about what others do to it (its predators), or what its prey does. */
const OTHERS = /\b(predators?|enemies|hunted by|eaten by|preyed (up)?on by|attacked by|taken by|caught by|killed by|threats? (include|come from)|such as (hawks|eagles|owls|foxes|snakes|herons|gulls|crows|cats|dogs|weasels))\b/i;
const PREY = /\b(prey|feeds? on|eats?|eating|hunts?|hunting|catches|catching|takes|taking|targets?|diet (of|includes))\b[^.]{0,60}$/i;

export type Hit = {field: TextField; phrase: string; match: string};

/** A System Dynamics sentence about the model of the animal (its "system", "mode", "frequency"), not what it does. */
const SD_META = /\b(system|systems|frequency|bimodal|waveform|baseline|trigger(ed)?|channel|archetype|signal-to|mode)\b/i;
/** A where-to-look sentence telling people what to do ("Wait quietly…", "Listen for…"): its verb is theirs. */
const IMPERATIVE = /^(look|wait|listen|search|check|watch|scan|visit|try|walk|stand|sit|go|use|follow|keep|stay|approach|head|explore)\b/i;
/** A threat in the sentence: fleeing and freezing are only that when something frightens it. */
const THREAT = /\b(threat\w*|alarm\w*|disturb\w*|danger\w*|predators?|escap\w*|flush\w*|startl\w*|approach\w*|chased|frighten\w*|scared|panic\w*|pursu\w*|attack\w*|safety|refuge|enem\w*|hunters?|people|humans)\b/i;

export type Rule = {
    id: string;
    label: string;
    /** The block family it feeds (for the report's grouping). */
    group: "fishing" | "foraging" | "comfort" | "social" | "breeding" | "movement" | "defence" | "seasonal" | "voice";
    pattern: RegExp;
    /** Only these fields are read (default: every behaviour field but the predators'). */
    fields?: TextField[];
    /** Only these body plans (the rig's, else the class's). */
    plans?: string[];
    /** Not these body plans. */
    notPlans?: string[];
    /** Only these classes. */
    classes?: string[];
    /** A sentence matching this is passed over. */
    unless?: RegExp;
    /** A behaviour the predators' text may also show (how it escapes). */
    defence?: boolean;
    /** A match after a prey phrase ("feeds on fish that school") is the prey's doing, not its own. */
    preyCheck?: boolean;
    /** The sentence must also match this (the context that makes it this behaviour). */
    needs?: RegExp;
    /** Only when something threatens it. */
    threat?: boolean;
};

const ACTION_FIELDS: TextField[] = ["sleep", "habitat", "look", "diet", "offspring", "sexdiff", "traits", "facts", "spotlight", "story", "basis", "evidence", "sd", "activity", "sociality", "season", "months"];

const BIRD = ["flying_bird", "walking_bird", "flightless_bird"];
const FLYING = ["flying_bird", "walking_bird", "bat", "flying_insect"];
const LEGGED = ["quadruped", "primate", "flying_bird", "walking_bird", "flightless_bird", "lizard", "turtle", "amphibian", "crustacean", "insect", "arachnid", "bat", "flying_insect"];
const MAMMAL = ["Mammalia"];

/**
 * The behaviours the brief lists (and a few more the data supports), each a phrase rule. The rules were tuned by
 * reading samples of their hits against the stored text (docs/ark/behaviour-data-report.md, "checks").
 */
export const RULES: Rule[] = [
    // Fishing
    {id: "plunge_dive", label: "plunge-diving from the air or a perch", group: "fishing", plans: BIRD, pattern: /\b(plunge[- ]?div\w*|plunges?|plunging|dives? (head-?first|headlong|steeply|vertically|from (a |its |their )?(perch|height|the air|flight|branches|wires|above))|dives? (down )?(in)?to (the )?(water|sea|surface) (from|to (catch|seize|grab))|(tucks?|folds?) (its|their) wings and (dives?|plunges?|drops?)|dive-bombs?|(steep|spectacular|vertical) dives? into|drops? (in)?to the water|(sudden|rapid|fast|swift|quick|headlong) dives?|dives? (rapidly|swiftly|quickly|sharply|fast|suddenly)|(dives?|diving) (in)?to (catch|seize|grab|take) (fish|prey))\b/i, needs: /\b(fish\w*|water|sea|surface|prey|squid|shrimp|krill|tadpoles|catch\w*|pond|river|stream|lake)\b/i, unless: /\bplunges? in (temperature|numbers)|plunges? into (dense )?(foliage|cover|vegetation)|display|\b(chicks|young|nestlings) (may )?(drop|plunge|dive)/i},
    {id: "feet_first", label: "feet-first fishing (talons)", group: "fishing", plans: BIRD, pattern: /\b(feet[- ]first|talons?[- ]first|(snatch|grab|seiz|catch|grasp|pluck|lift)\w* (fish|prey|them)?\s*(from|off|out of|at) (the )?(water|surface)[^.]{0,30}(feet|talons|claws)|(talons|claws)[^.]{0,30}\bfish|fish(es)? with (its|their) (feet|talons))\b/i, unless: /\bunderwater|chase fish|pursue/i},
    {id: "hover", label: "hovering", group: "foraging", plans: [...FLYING, "fish"], pattern: /\b(hover\w*|hangs? in the air|holds? (itself|its position) in the air|kiting|wind-?hover\w*)\b/i, unless: /\bhover-?fl(y|ies)\b(?! hover)/i},
    {id: "wade", label: "wading in the shallows", group: "fishing", plans: [...BIRD, "quadruped"], pattern: /\b(wad(e|es|ing)|stalks? (slowly )?through (the )?(shallows|shallow water)|stands? (motionless |still |patiently )?in (the )?(shallow water|shallows))\b/i, unless: /\bwading birds?\b(?! (such|like))|waders? such as|wader species/i},
    {id: "spear", label: "spearing or stabbing prey with the bill", group: "fishing", plans: BIRD, pattern: /\b(spear(s|ing|ed)?\b|stab(s|bing|bed)?\b|(lightning|rapid|sudden|quick) (strike|thrust|jab)s?|strikes? (at )?(fish|prey|frogs) with (its|a|the) (bill|beak|neck)|(darts?|shoots?) (out )?(its|the) (neck|head|bill))\b/i},
    {id: "scoop", label: "scooping fish with a pouch or bill", group: "fishing", plans: BIRD, pattern: /\b(scoop\w* (up )?(fish|prey|water|food|shrimp|mouthfuls?)|pouch(es)? (to|full of|as a net|like a net) ?(catch|scoop|fish|water|net)?|(fish|water) (in|into) (its|the|their) pouch|scoops? (with|using) (its|their|the) (bill|pouch))\b/i, unless: /\bdisplay|inflat/i},
    {id: "bill_sweep", label: "sweeping or filtering with the bill", group: "fishing", plans: BIRD, pattern: /\b(sweep\w* (its|their|the) (bill|beak|head)s?|(bill|beak|head) (sweeps?|swept) (from )?side to side|side[- ]to[- ]side (sweeps?|through the water)|filters? (food|water|small animals|plankton|shrimp|algae) (from|out of|through) (the )?(water|mud)|upside[- ]down (to feed|in the water))\b/i},
    {id: "dabble", label: "dabbling and up-ending", group: "foraging", plans: BIRD, pattern: /\b(dabbl\w*|up-?end\w*|tips? (up|forward) (to feed)?|tips? (its|their) bod(y|ies) forward|head (and neck )?(under|beneath) the (water|surface))\b/i},
    {id: "bank_fishing", label: "fishing from the bank or at the river", group: "fishing", plans: ["quadruped", "primate"], pattern: /\b(fish(es|ing)? (from|along|at) (the )?(bank|shore|river|edge|rocks|rapids|waterfalls?)|(catch|grab|swipe|snatch|scoop|hook)\w* (fish|salmon|trout|crayfish)\b|salmon (runs?|migrations?)|spawning (salmon|fish)|wades? into (rivers|streams|the water) (to|for) (fish|catch)|stands? (in|at|by) (rivers|streams|rapids|waterfalls?) (to|and) (catch|fish))\b/i, needs: /\b(streams?|rivers?|shallows|rapids|banks?|shore|waterfalls?|salmon|paw|creeks?|pools?|ponds?)\b/i, unless: /\bdives?|diving|at sea\b/i},
    {id: "chase_fish", label: "chasing fish underwater (schools, bait balls)", group: "fishing", plans: ["fish", "quadruped", "flightless_bird", "flying_bird", "walking_bird", "turtle", "lizard", "amphibian"], pattern: /\b(bait[- ]?balls?|herd\w* (fish|schools|shoals|prey)|chas\w* (fish|schools|shoals|squid|prey|krill)|pursu\w* (fish|prey|schools|squid)|pursuit div\w*|(swims?|dives?|diving) (after|down after|to catch|for|in pursuit of) (fish|prey|squid|krill)|cooperative(ly)? (hunt|feed|herd)\w*|bubble[- ]?nets?|corral\w*|(catch|hunt|seize)\w* (fish|prey|squid|krill) (underwater|under water|beneath the surface|while swimming|in the water)|underwater (pursuit|chase|hunting))\b/i, needs: /\b(fish\w*|squid|krill|water|underwater|sea|schools?|shoals?|swim\w*|div\w*|bait|shallows|surface|herring|sardines?|anchov\w*)\b/i},
    {id: "surface_dive", label: "diving from the surface", group: "fishing", plans: ["flying_bird", "walking_bird", "flightless_bird", "quadruped", "turtle", "lizard", "amphibian", "fish"], pattern: /\b(dives? (from the surface|underwater|under water|beneath the surface|to the (bottom|seabed|sea floor|riverbed))|duck[- ]?div\w*|dives? (for|to (catch|find|reach|feed on)) (food|fish|prey|shellfish|clams|crabs|plants|weed)|dive (to )?(depths|deep)|deep div\w*|dives? (to|up to|more than|over|down to|as deep as) [0-9])\b/i},
    {id: "hawking", label: "catching insects in the air", group: "foraging", plans: [...FLYING], pattern: /\b(hawk\w* (for )?(insects|flies|prey|midges|moths)|(catch|snatch|take|seize|capture)\w* (flying )?(insects|flies|moths|prey|midges|mosquitoes|bees|wasps|dragonflies)[^.]{0,20}\b(in (flight|the air|mid-?air)|on the wing|in mid-?air)|sall(y|ies|ying)|flycatch\w*|aerial (insect )?(hunt|forag|feed)\w*|feeds? (on the wing|in flight|in the air)|forages? (on the wing|in flight|in the air))\b/i},
    {id: "pounce", label: "stalking and pouncing", group: "foraging", plans: ["quadruped", "primate", "lizard", "arachnid", "insect", "amphibian", "flying_bird", "walking_bird"], pattern: /\b(pounc\w*|leaps? (on|onto|at|upon) (prey|its prey|victims|insects|mice|rodents)|springs? (on|onto|at) (prey|its prey)|mousing|(high|arching) (leap|jump)s? (to|onto|and)|dives? (nose|head)[- ]first into (the )?snow)\b/i},
    {id: "ambush", label: "waiting in ambush", group: "foraging", pattern: /\b(ambush\w*|sit[- ]and[- ]wait|lies? in wait|lying in wait|waits (motionless|patiently|still|quietly|hidden|concealed|for (prey|passing))|waiting (motionless|patiently|still|for (prey|passing))|lurk\w*)\b/i, unless: /\bambushed by\b/i},
    {id: "probe", label: "probing mud, sand or soil", group: "foraging", plans: [...BIRD, "quadruped"], pattern: /\b(prob(e|es|ing|ed) (deep )?(the |in |into |for |through )?(the )?(damp |soft |wet )?(mud|sand|soil|ground|sediment|leaf litter|turf|crevices|bark|flowers|shallow water|grass|lawns?|nests|burrows|holes)|(bill|beak|snout)s? (to|for) prob\w*)\b/i},
    {id: "worm_pull", label: "pulling worms from the ground", group: "foraging", plans: BIRD, pattern: /\b(earthworms?|worms? (from|out of) (the )?(ground|soil|lawn|turf))\b/i, fields: ["diet", "facts", "traits", "look", "basis", "evidence", "spotlight"]},
    {id: "drumming", label: "drumming or hammering on wood", group: "voice", plans: [...BIRD, "insect", "quadruped"], pattern: /\b(drum\w*|hammer\w* (on|at|into) (wood|bark|trees|trunks)|excavat\w* (nest )?(holes|cavities|hollows) in (trees|wood|trunks)|chisel\w*|bores? into (wood|bark))\b/i},
    {id: "tool_use", label: "tool use", group: "foraging", pattern: /\b(tool[- ]?(use|using|users?|making|maker)|uses? tools|makes? tools|(uses?|using|wields?|holds?|picks? up) (a |an )?(sticks?|stones?|rocks?|twigs?|leaves|leaf|thorns?|cactus spines?|sponges?|shells?|pebbles?|grass stems?|bark)\b[^.]{0,30}\b(to|as)\b|as (a )?tools?\b|anvils?|cracks? (open )?(shells|nuts|snails|clams|eggs|mussels|urchins) (on|with|against) (a |an |its |their )?(stone|rock|anvil|chest|belly)|drops? (shells|snails|nuts|bones|eggs|tortoises) (on|onto) (rocks|stones))\b/i, unless: /\b(digging|body|odd|surprising|anatomical) tools?\b|tool-user until|serves as a tool|tool-based/i},
    {id: "caching", label: "food caching and hoarding", group: "foraging", pattern: /\b(cach(e|es|ed|ing)|hoard\w*|larder\w*|stor(e|es|ed|ing) (food|nuts|seeds|acorns|insects|prey|fat)|bur(y|ies|ied|ying) (nuts|seeds|acorns|food|bones|prey|caches)|impal(e|es|ed|ing)\b|stash\w*)\b/i, unless: /\bstores? (fat|water|energy)|stored (fat|water)|cheek pouch/i},
    {id: "graze_rumination", label: "chewing the cud", group: "foraging", plans: ["quadruped"], pattern: /\b(chews? (the |its )?cud|ruminat\w*|regurgitat\w* (and|to) re-?chew)\b/i},

    // Comfort
    {id: "bask", label: "basking in the sun", group: "comfort", pattern: /\b(bask\w*|sun(s|ning)? (itself|themselves)|sunbath\w*|warms? (itself|themselves|up) in the sun|lies? in the sun)\b/i},
    {id: "wing_dry", label: "spreading wings to dry or sun", group: "comfort", plans: BIRD, pattern: /\b((spread\w*|hold\w*|hang\w*) (its|their|the) wings (out )?(open |wide )?(to dry|in the sun|to the sun|after|to warm)|wings? (spread|held) (out )?to dry|wing[- ]?dry\w*|(spread|open)\w* wings (in|to) the sun|sunning (posture|stance))\b/i},
    {id: "dust_bathe", label: "dust or sand bathing", group: "comfort", plans: [...LEGGED], pattern: /\b(dust[- ]?bath\w*|sand[- ]?bath\w*|bath\w* in (dust|sand|dirt|loose soil)|rolls? (\w+ )?in (dust|sand|dirt|loose earth))\b/i},
    {id: "wallow", label: "wallowing in mud or water", group: "comfort", plans: ["quadruped", "lizard", "turtle", "amphibian"], pattern: /\b(wallow\w*|mud[- ]?bath\w*|rolls? (\w+ )?in (the )?mud|coats? (itself|themselves|its skin|their skin) (in|with) mud|covers? (itself|themselves) in mud|mud (to keep cool|protects?|to protect|for (cooling|protection)))\b/i},
    {id: "bathe", label: "bathing in water", group: "comfort", plans: [...BIRD, "quadruped", "primate"], pattern: /\b(bath\w* (in|at) (shallow |the )?(water|puddles|pools|streams|ponds|birdbaths|rain)|bird ?baths?|splash\w* (in|about in) (water|puddles|shallow))\b/i},
    {id: "roll", label: "rolling on the ground", group: "comfort", plans: ["quadruped", "primate"], pattern: /\b(rolls? (around |about |over )?(on|in) (the )?(ground|grass|snow|sand|soil|scent|carcasses|dung)|rolling (on|in) (the )?(ground|grass|snow|sand))\b/i},
    {id: "groom", label: "grooming or preening itself", group: "comfort", pattern: /\b(groom\w*|preen\w*|cleans? (its|their) (fur|feathers|face|antennae|legs|body|coat))\b/i, unless: /\bgrooming (by|from) (cleaner|other)/i},
    {id: "allogroom", label: "grooming each other", group: "social", pattern: /\b(groom\w* (each other|one another|others|group members|partners?|mates?|companions)|mutual(ly)? (groom|preen)\w*|allo-?(groom|preen)\w*|social grooming)\b/i},
    {id: "shake_off", label: "shaking off water", group: "comfort", pattern: /\b(shakes? (off |itself |themselves )?(water|dry|its (fur|feathers|coat|body))|shake (dry|off water))\b/i},
    {id: "stretch_yawn", label: "stretching and yawning", group: "comfort", pattern: /\b(yawn\w*|stretch(es|ing)? (its|their|out) (wings|legs|body|limbs)|stretch(es|ing)? out (in|on))\b/i},
    {id: "sleep_posture", label: "a particular sleeping posture", group: "comfort", pattern: /\b((sleep|rest|roost)\w* (standing|upside[- ]down|curled|coiled|on one leg|with (its|their) (head|bill|beak) (tucked|under)|hanging|floating|in a (tight )?ball|wrapped|on (its|their) back)|(tucks?|tucked) (its|their) (head|bill|beak)|stands? on one leg|hangs? upside[- ]down|floats? on (its|their) back|curls? (up )?(into a ball|in a ball)|sleeps? in (a )?(huddle|pile|heap|rafts?))\b/i},
    {id: "float_back", label: "floating on its back", group: "comfort", plans: ["quadruped"], pattern: /\b(float(s|ing)? on (its|their|the) backs?|on (its|their) back(s)? (in|at) the (water|surface)|lies? on (its|their) backs? (in|on) the water)\b/i},

    // Social and movement
    {id: "flock", label: "flocking", group: "social", plans: [...FLYING], pattern: /\b(flock\w*|large (groups|numbers|gatherings) (of birds)?|gather\w* in (large |huge )?(groups|numbers|flocks)|communal roosts?|roosts? communally)\b/i, preyCheck: true, unless: /\b(flocks? of (sheep|goats|other)|follows? flocks|mixed(-species)? (feeding )?flocks)\b/i},
    {id: "murmuration", label: "murmurations (swirling flocks at the roost)", group: "social", plans: [...FLYING], pattern: /\b(murmuration\w*|swirl\w* (flocks|clouds|masses|groups)|(aerial|evening|pre-roost) (displays|manoeuvres|maneuvers) (at|before|over) (the )?(dusk|roost|roosts|sunset)|wheel\w* (flocks|in unison)|moves? in unison|coordinated flocks?|(huge|vast|enormous|very large|immense) (flocks|roosts|gatherings))\b/i, preyCheck: true},
    {id: "v_formation", label: "flying in V or line formation", group: "social", plans: [...FLYING], pattern: /\b(v[- ]?(shaped )?formations?|in (a )?v\b|skeins?|(fly|flying|flies|travel\w*|come|comes|move\w*) (in|in long|in low) lines|echelons?|formation flight|fly in formation)\b/i},
    {id: "school", label: "schooling or shoaling", group: "social", plans: ["fish", "cephalopod_jelly", "quadruped"], pattern: /\b(school\w*|shoal\w*)\b/i, preyCheck: true, unless: /\b(school(s)? (children|pupils)|after school|schoolbag|school of thought|(into|through|at|on) (a |the )?(school|shoal)s?|schools? of (prey|fish it|herring|sardines|anchov\w*|squid))\b/i, fields: ACTION_FIELDS.filter((f) => f !== "diet")},
    {id: "herd", label: "moving in herds", group: "social", plans: ["quadruped"], pattern: /\b(herd\w*|large (groups|numbers|aggregations)|bands of)\b/i, preyCheck: true, unless: /\bherd\w* (fish|prey|schools|shoals)|(sheep|cattle)[- ]?herd|herd(s|ed|ing)? by (people|humans|dogs)|herding (dogs?|breeds?|instincts?|or|and|work)|herd(ing)? (livestock|sheep|cattle)|herders?\b/i, fields: ACTION_FIELDS.filter((f) => f !== "diet")},
    {id: "swarm", label: "swarming", group: "social", plans: ["insect", "flying_insect", "fish", "crustacean"], pattern: /\b(swarm\w*|clouds? of|mating swarms?|nuptial flights?|dense aggregations?|mass emergences?)\b/i, preyCheck: true, unless: /\b(into|through|at) (a |the )?swarms?|swarms? of (prey|krill|insects it|plankton)/i, fields: ACTION_FIELDS.filter((f) => f !== "diet")},
    {id: "mixed_flock", label: "mixed-species flocks or groups", group: "social", pattern: /\b(mixed[- ](species )?(flocks?|groups?|herds?|parties|feeding)|joins? (flocks|groups|herds) of (other|\w+)|forag\w* (alongside|with) (other|\w+ )(birds|species|monkeys|animals|herbivores|grazers)|associates? with (other )?(species|herds|flocks|monkeys)|in (the )?company of (other )?(\w+ )?(birds|species|zebras|wildebeest|antelope|monkeys))\b/i},
    {id: "follow", label: "following others (single file, a leader, the mother)", group: "social", pattern: /\b(single[- ]file|follow\w* (the |its |their )?(mother|leader|matriarch|adults|parents?|others|herd|group|trails)|in (a )?line behind|nose[- ]to[- ]tail)\b/i},
    {id: "migration", label: "migration", group: "seasonal", fields: ACTION_FIELDS.filter((f) => f !== "evidence"), pattern: /\b(migrat\w*|long-distance (journeys|movements|travel)|travels? (thousands of|hundreds of) (kilometres|kilometers|miles)|(moves?|travels?|flies?) (south|north|to (africa|warmer|lower))\w* (for|in|each|every) (the )?(winter|autumn|year))\b/i, unless: /\b(not|non)[- ]migrat\w*|resident (all year|year-round)/i},
    {id: "hibernation", label: "hibernation, torpor or brumation", group: "seasonal", pattern: /\b(hibernat\w*|brumat\w*|aestivat\w*|estivat\w*|winter (sleep|dormancy|torpor)|dormant (in|through|during) (the )?(winter|cold|dry season|cold months)|overwinter\w* (as adults|in (burrows|crevices|mud|leaf litter|hibernacula))|torpor)\b/i, fields: ["sleep", "facts", "traits", "spotlight", "habitat", "evidence", "basis", "sd", "months", "activity"]},
    {id: "glide", label: "gliding between trees", group: "movement", plans: ["quadruped", "primate", "lizard", "amphibian", "legless"], pattern: /\b(glid\w*|patagi\w*|gliding membranes?|parachut\w*)\b/i, needs: /\b(trees?|branch\w*|canopy|patagi\w*|membranes?|skin flaps?|from tree|trunks?|leaps?|metres|meters|air)\b/i},
    {id: "brachiate", label: "swinging or hanging from branches", group: "movement", plans: ["primate", "quadruped"], pattern: /\b(brachiat\w*|swings? (hand over hand |arm over arm )?(through|from|between) (the )?(trees|branches|canopy)|hangs? (upside[- ]down )?(from|by) (branches|its tail|its arms|its claws|a branch))\b/i},
    {id: "stott", label: "stotting or pronking", group: "defence", plans: ["quadruped"], pattern: /\b(stott\w*|pronk\w*|leaps? (high )?(with|on) (stiff|straight) legs|bounds? (high )?on stiff legs)\b/i},
    {id: "breach", label: "breaching, leaping or tail-slapping", group: "movement", plans: ["fish", "quadruped", "cephalopod_jelly"], pattern: /\b(breach\w*|lob-?tail\w*|tail[- ]slap\w*|slaps? (its|their|the) (tail|fins?|flippers?)|spy-?hop\w*|leaps? (clear )?(out of|from|above) the (water|surface|sea)|porpoising|bow[- ]?rid\w*|(dramatic|spectacular|acrobatic|high) (leaps|jumps) (above|out of|from|clear of) the (water|surface|sea)|(leaps|jumps) above the water|jumps? (out of|from) the water)\b/i},
    {id: "run_on_water", label: "running across the water", group: "movement", pattern: /\b(runs? (across|over|on) (the )?(water|surface)|patter\w* (across|over|on) the (water|surface)|walks? on water)\b/i},
    {id: "dig", label: "digging", group: "foraging", plans: [...LEGGED, "legless"], pattern: /\b(dig(s|ging)?\b|dug\b|excavat\w*|burrows? (into|through|down|deep)|burrowing (into|in|through)|tunnel(s|ing|led|ling)? (through|into|under|in)|scrap(e|es|ing) (out )?(a )?(hollow|hole|scrape|depression)|uproot\w*|root\w* (up|for|through|in) (the )?(soil|ground|roots|tubers|bulbs|earth)|mole-?hills?|mounds? of (soil|earth|sand))\b/i, unless: /\b(dug|dig\w*|excavat\w*) by (other|another|aardvarks|rabbits|people)|(uses?|takes over|occupies|occupy|shelters? in) (old |abandoned |existing |other animals'? )?(burrows|tunnels)|digest\w*|digit\w*|dignit\w*/i},
    {id: "sand_bury", label: "burying itself in sand or mud", group: "defence", unless: /\beggs?\b[^.]{0,40}\bburied|bur(y|ies) (the |her |their )?eggs|clutch/i, plans: ["crustacean", "fish", "turtle", "amphibian", "lizard", "legless", "other", "insect"], pattern: /\b(bur(y|ies|ied|ying) (itself|themselves|its body|in) (\w+ )?(in )?(the )?(sand|mud|sediment|gravel|silt|soil)|buried in (the )?(sand|mud|sediment)|digs? (itself|themselves) (backwards )?into (the )?(sand|mud|sediment))\b/i},

    // Breeding
    {id: "nest_build", label: "nest building", group: "breeding", pattern: /\b(builds?|building|built|weav\w*|construct\w*)\b[^.;]{0,40}\bnests?\b|\b(makes?|making) (a |an |its |their |her )?(\w+ )?nests?\b|\b(lines?|lining) (the |its |their |her )?nests?\b|\bnests? (is |are )?(built|made|woven|constructed|lined|formed|assembled)\b|\bnests? (of|from) (twigs|grass|mud|sticks|leaves|moss|plant|seaweed|pebbles|stones|reeds|feathers|bubbles|saliva|silk|lichen|bark|down)|\b(cup|dome|domed|platform|mud|bubble|floating|stick|grass|ball)[- ]?(shaped )?nests?\b|\bbowers?\b/i, unless: /\b(nests? of (other|ants|termites|wasps|bees)|(raids?|eats?|robs?|takes over|uses?|lays? (its |her |their )?eggs in) (the )?(old |abandoned |other birds'? |others'? )?nests)\b/i},
    {id: "beach_nest", label: "digging a nest on the beach or in sand", group: "breeding", plans: ["turtle", "lizard", "flightless_bird", "crustacean", "legless"], pattern: /\b(lays? (her |its |their )?eggs (in|on) (the )?(sand|beach|sandy)|(digs?|excavates?|scoops? out) (a |her |their )?(nest|hole|pit|chamber) (in|on) (the )?(sand|beach|sandy|soil)|nesting beach\w*|haul(s|ing)? (herself|themselves) (up|out) (onto|on) (the )?beach\w*)\b/i},
    {id: "incubate", label: "incubating or brooding eggs", group: "breeding", pattern: /\b(incubat\w*|brood\w* (the )?(eggs|clutch|young|chicks)|sits? on (the )?eggs|guards? (the |her |its |their )?(eggs|clutch|nest)|coils? (around|round) (the |her )?eggs)\b/i},
    {id: "carry_young", label: "carrying young", group: "breeding", fields: ACTION_FIELDS.filter((f) => f !== "sexdiff"), pattern: /\b(carr(y|ies|ied|ying) (the |her |their |its |his )?(young|babies|baby|infants?|cubs?|pups?|kits?|chicks?|joeys?|offspring|egg sacs?|tadpoles|spiderlings|eggs on)|(young|babies|infants?|cubs?|pups?|chicks?|joeys?|offspring|spiderlings|baby|infant) (ride|rides|riding|cling|clings|clinging|carried|travel|travels)\w* (on|to|in)|(ride|rides|riding|cling\w*|carried) on (her|its|their|the mother's|the parent's|the father's|the adult's) (back|belly|fur)|(young|eggs|fry|babies|tadpoles) (in|into) (her|his|its|the parent's|the mother's|the father's) (mouth|jaws|pouch)|carr(y|ies|ying) (it|them) on (her|its|the|their) (back|belly)|(rest|rests|resting|ride|rides) on (the|her) mother's back|(in|into) (her|its|the mother's|a) pouch|pouch young|mouthbrood\w*|brood pouch)\b/i, unless: /\bgular pouch|throat pouch|cheek pouch/i},
    {id: "provision", label: "bringing food to the young", group: "breeding", pattern: /\b(feed\w* (the |its |their )?(chicks|young|nestlings|fledglings|cubs|pups)|regurgitat\w* (food|meals?|milk) (for|to)|bring\w* (food|prey) (back )?(to|for) (the )?(nest|young|chicks|den))\b/i},
    {id: "courtship", label: "courtship", group: "breeding", pattern: /\b(courtship|courts?\b|courting|leks?\b|lekking|(mating|courtship|bonding) (dances?|displays?|flights?|rituals?|calls?|songs?)|dances?\b|dancing|(bows?|bowing|bobs?|bobbing) (to|its head|their heads)|pair[- ]bond\w*|offers? (a )?(fish|food|gifts?|nuptial)|nuptial (gifts?|flights?))\b/i, unless: /\bdance of (light|shadows)|courts? of law/i},
    {id: "display", label: "displays (posture, crest, wings, tail, throat)", group: "breeding", pattern: /\b(display\w*|raises? (its|their|a) (crest|hackles|frill|hood|sail|tail|quills|spines|mane)|crest\w* (raised|erect\w*)|fans? (its|their|out) (tail|feathers)|tail[- ]?fan\w*|spreads? (its|their) (tail|wings|hood|frill|fins)|(inflat|puff)\w* (its|their|a|up)? ?(throat|pouch|sac|chest|body|feathers|dewlap)|(extend\w*|flar\w*|flash\w*|fan\w*) (its |their |a |the )?(throat )?dewlaps?|dewlaps? (extended|flared|flashed)|push-?ups?|head[- ]?bob\w*|flares? (its|their) (hood|frill|gills|fins))\b/i, unless: /\bon display\b|displays? (in|at) (zoos|museums)|(important|more) than (obvious )?display|display (cases|tanks)/i},
    {id: "male_combat", label: "male combat, rut or rivals' contests", group: "breeding", pattern: /\b(rut\b|rutting|ruts\b|spar(s|ring|red)?\b|clash(es|ing)?\b|butt\w* heads|head-?butt\w*|lock\w* (antlers|horns)|neck\w* (fights?|bouts?|contests?)|necking|wrestl\w*|joust\w*|boxing\b|box(es)? (each other|rivals)|(fights?|fighting|battles?|contests?|duels?|combat) (between|among) (males|bulls|stags|rams|rivals|cocks|bucks)|(males|bulls|stags|rams|bucks|cocks|rivals|boars|tom|toms) (fight|fights|battle|battles|clash|clash\w*|spar|spars|compete|contest|wrestle|wrestles|butt|push|shove|grapple)\b|(fight|fights|fighting|battle|battles|compete|competes|competing|contest|contests) (for|over) (mates|females|territor\w*|dominance|harems?|access|rank|breeding (access|rights|sites|territories))|(gap\w*|yawn\w*|display\w*|show\w*|roar\w*|bellow\w*) (to show )?[^.]{0,30}\bat (any |a |the )?rivals?|reserved for fighting|harems?\b|rivals? (males?|stags|bulls|rams)|(chase|chases|drive|drives|displace|displaces|challenge|challenges|fight|fights|warn|warns) (off )?(away )?rivals?|male[- ](male )?(combat|competition|contests?|rivalry)|(dominance|territorial) (fights?|battles?|contests?|disputes?|clashes))\b/i, unless: /\bfights? (off|back) (predators|attackers|enemies)|unrivall?ed|combat (predators|threats)/i},
    {id: "scent_mark", label: "scent marking", group: "social", plans: ["quadruped", "primate"], pattern: /\b(scent[- ]?mark\w*|marks? (its|their) territor\w*|(urine|dung|scent) (marks?|posts?|stations|middens)|middens?|rubs? (its|their) (scent|glands?|cheeks|face|chin|antlers|horns) (on|against)|thrash\w* (bushes|vegetation|saplings))\b/i},

    // Defence
    {id: "freeze", label: "freezing when alarmed", group: "defence", defence: true, unless: /\bsurviv\w*[^.]{0,20}freez\w*|freez\w* (temperatures?|cold|winters?|conditions|water|weather|nights?|solid|tolera\w*)|(below|above) freezing|freeze[- ]tolera\w*|frozen|freezing during|water freezing/i, pattern: /\b(freez\w*|keeps? (very )?still|stays? (very )?(still|motionless)|remains? (motionless|still)|lies? (still|motionless|flat)|play\w* dead|feign\w* death|thanatosis|crouch\w* (low|flat|motionless))\b/i},
    {id: "flee_cover", label: "fleeing to cover", group: "defence", defence: true, threat: true, pattern: /\b((runs?|dashes?|darts?|bolts?|flees?|scurr\w*|retreats?|escapes?|scuttles?|disappears?|vanishes?) (\w+ )?(for|into|to|under|beneath) (the )?(nearest )?(cover|vegetation|undergrowth|bushes|scrub|thickets?|grass|crevices?|cracks|rocks|burrows?|holes?|dens?|leaf litter|shelter|tunnels?))\b/i},
    {id: "flee_water", label: "fleeing into water", group: "defence", defence: true, threat: true, pattern: /\b((runs?|dashes?|darts?|bolts?|flees?|slips?|slides?|plunges?|dives?|drops?|retreats?|escapes?|leaps?|jumps?|disappears?) (\w+ )?(into|under|beneath|to) (the )?(water|river|stream|pond|lake|sea|surface)|dives? (underwater|under water) (to escape|when (threatened|disturbed|alarmed|approached))|takes? to (the )?water)\b/i},
    {id: "flee_tree", label: "fleeing up a tree", group: "defence", defence: true, threat: true, plans: ["quadruped", "primate", "lizard", "amphibian"], pattern: /\b((climbs?|scrambles?|runs?|races?|escapes?|flees?|bolts?|dashes?|retreats?) (quickly |rapidly |up |straight up )?(up |into )?(a |the )?(trees?|trunk|canopy|branches)|takes? (refuge|to) (in |the )?trees)\b/i},
    {id: "curl_shell", label: "curling up or withdrawing into a shell", group: "defence", defence: true, pattern: /\b(rolls? (itself |up )?into a (tight )?ball|curls? (up )?into a (tight )?ball|conglobat\w*|withdraws? (its head |its body |itself )?into (its|the|their) shells?|pulls? (its|their) (head|legs|limbs) into (its|the|their) shells?|retreats? into (its|their|the) (shell|tube|case))\b/i},
    {id: "ink", label: "inking or colour flashes", group: "defence", defence: true, plans: ["cephalopod_jelly"], pattern: /\b(ink\w*|chang\w* colou?rs?|colou?r[- ]chang\w*|flash\w* (of )?colou?r)\b/i},

    // Voice
    {id: "call", label: "calling or singing", group: "voice", pattern: /\b(calls?|calling|sings?|singing|songs?|roar\w*|howl\w*|bellow\w*|croak\w*|chirp\w*|hoot\w*|screech\w*|whistl\w*|trumpet\w*|bugl\w*|grunt\w*|squeal\w*|chatter\w*|bark(s|ing)\b|yelp\w*|trill\w*|chorus\w*|stridulat\w*|purr\w*|honk\w*|cackl\w*|caw\w*|whoop\w*)\b/i, unless: /\b(so-called|called (the|a|an|it|them|its)|is called|are called|calls? (it|them) )|calls? for (conservation|protection)/i}
];

export function ruleApplies(rule: Rule, s: Pick<SpeciesText, "plan" | "className">): boolean {
    if (rule.plans && !rule.plans.includes(s.plan)) return false;
    if (rule.notPlans && rule.notPlans.includes(s.plan)) return false;
    if (rule.classes && !rule.classes.includes(s.className ?? "")) return false;
    return true;
}

/** Every behaviour found in a species' stored text (each with its first phrases, at most three). */
export function behavioursOf(s: SpeciesText): Record<string, Hit[]> {
    const out: Record<string, Hit[]> = {};
    for (const rule of RULES) {
        if (!ruleApplies(rule, s)) continue;
        const fields = rule.fields ?? (rule.defence ? [...ACTION_FIELDS, "predators" as TextField] : ACTION_FIELDS);
        const hits: Hit[] = [];
        const seen = new Set<string>();
        for (const field of fields) {
            for (const sentence of sentences(s.text[field])) {
                if (rule.unless && rule.unless.test(sentence)) continue;
                if (rule.needs && !rule.needs.test(sentence)) continue;
                if (rule.threat && field !== "predators" && !THREAT.test(sentence)) continue;
                if (field === "sd" && SD_META.test(sentence)) continue;
                if (field === "look" && IMPERATIVE.test(sentence)) continue;
                const pattern = new RegExp(rule.pattern.source, "gi");
                for (let m = pattern.exec(sentence); m; m = pattern.exec(sentence)) {
                    const before = sentence.slice(Math.max(0, m.index - 48), m.index);
                    if (NEGATED.test(before)) continue;
                    // What its predators do, and what its prey does, is not its own behaviour (but how it escapes them is).
                    if (!rule.defence && field !== "predators" && OTHERS.test(sentence.slice(0, m.index))) continue;
                    if (rule.preyCheck && PREY.test(sentence.slice(Math.max(0, m.index - 70), m.index))) continue;
                    const phrase = phraseAt(sentence, m.index, m[0].length);
                    if (seen.has(phrase)) break;
                    seen.add(phrase);
                    hits.push({field, phrase, match: m[0].toLowerCase()});
                    break;
                }
                if (hits.length >= 3) break;
            }
            if (hits.length >= 3) break;
        }
        if (hits.length) out[rule.id] = hits;
    }
    return out;
}

// MARK: Sex

export type SexInfo = {
    /** "separate": males and females; "hermaphrodite": both in one; "parthenogenetic": mostly or all female; "workers": a eusocial insect's workers (female). */
    system: "separate" | "hermaphrodite" | "parthenogenetic" | "workers" | "changes";
    /** Share of males (0–1). */
    maleShare: number;
    /** The bigger sex and by about how much (1 = alike). */
    bigger: "male" | "female" | null;
    sizeRatio: number;
    /** Visual traits of each sex the text names (antlers, mane, bright plumage…). */
    male: string[];
    female: string[];
    /** The duller sex (plumage, colour). */
    duller: "male" | "female" | null;
    src: Hit[];
    defaulted: boolean;
};

const FEATURES: Array<[RegExp, string]> = [
    [/\bantlers?\b/i, "antlers"],
    [/\bhorns?\b/i, "horns"],
    [/\btusks?\b/i, "tusks"],
    [/\bmanes?\b/i, "mane"],
    [/\bbeards?\b/i, "beard"],
    [/\bcrests?\b/i, "crest"],
    [/\bwattles?\b|\bcombs?\b/i, "wattle"],
    [/\b(trains?|tail streamers?|long tail feathers)\b/i, "long_tail"],
    [/\b(dewlaps?|throat (fans?|sacs?|pouch(es)?))\b/i, "dewlap"],
    [/\bclaws?\b|\bchel(a|ae|ipeds?)\b|\bpincers?\b/i, "big_claw"],
    [/\bmandibles?\b/i, "mandibles"],
    [/\b(bright|brilliant|vivid|colou?rful|glossy|iridescent|showy|bold(ly)? (marked|patterned))\b/i, "bright"],
    [/\b(duller|drab|dull|cryptic|brownish|mottled brown|plainer|paler|less colou?rful)\b/i, "dull"],
    [/\b(darker|black(er)?)\b/i, "darker"],
    [/\bhumps?\b|\bnuchal\b/i, "hump"],
    [/\b(saddle|silver(back|ed back))\b/i, "silverback"],
    [/\bpr(o|oboscis)\b|\b(inflatable )?(nose|snout|proboscis)\b/i, "snout"]
];

const SEX_WORD = /\b(males?|bulls?|stags?|rams?|bucks?|cocks?|drakes?|boars?|tom|toms|roosters?|cobs?|ganders?|jacks?|silverbacks?)\b/i;
const FEMALE_WORD = /\b(females?|cows?|hinds?|ewes?|does|hens?|sows?|queens?|pens?|vixens?|jennies|nannies)\b/i;

export function sexOf(s: SpeciesText): SexInfo {
    const out: SexInfo = {system: "separate", maleShare: 0.5, bigger: null, sizeRatio: 1, male: [], female: [], duller: null, src: [], defaulted: true};
    const all: Array<[TextField, string]> = [];
    for (const field of ["sexdiff", "offspring", "facts", "traits", "spotlight", "sociality", "basis", "evidence"] as TextField[]) for (const sentence of sentences(s.text[field])) all.push([field, sentence]);
    const hit = (field: TextField, sentence: string, m: RegExpExecArray) => out.src.push({field, phrase: phraseAt(sentence, m.index, m[0].length), match: m[0].toLowerCase()});
    // The system first: hermaphrodites, sex changers, parthenogenetic species, the workers of a colony.
    for (const [field, sentence] of all) {
        let m: RegExpExecArray | null;
        // Not about this species' sexes: a comparison ("unlike pond snails, which are hermaphrodites"), its name, a captive record.
        if (/\bunlike\b|\bname\b|captiv\w*|(has|have) been (recorded|shown|reported)|separate sexes|relatives\b/i.test(sentence)) continue;
        if ((m = /\b(hermaphrodit\w*|both (male and female|sexes) (organs|reproductive)|simultaneous hermaphrodit\w*)\b/i.exec(sentence)) && !NEGATED.test(sentence.slice(0, m.index))) {
            out.system = /\b(changes? sex|sequential|protandr\w*|protogyn\w*)\b/i.test(sentence) ? "changes" : "hermaphrodite";
            hit(field, sentence, m);
            break;
        }
        if ((m = /\b(changes? sex|change (from|into) (a )?(male|female)|protandr\w*|protogyn\w*|sex change)\b/i.exec(sentence)) && !NEGATED.test(sentence.slice(0, m.index))) {
            out.system = "changes";
            hit(field, sentence, m);
            break;
        }
        if ((m = /\b(parthenogen\w*|all[- ]female (species|populations?)|males are (unknown|very rare|extremely rare|rare|rarely seen|not observed)|no males|without (males|mating))\b/i.exec(sentence)) && !NEGATED.test(sentence.slice(0, m.index))) {
            out.system = "parthenogenetic";
            out.maleShare = /rare/.test(m[0]) ? 0.05 : 0;
            hit(field, sentence, m);
            break;
        }
    }
    if (out.system === "separate" && /^(Hymenoptera|Isoptera|Blattodea)$/.test(s.order ?? "") && /\b(workers?|colon(y|ies)|queens?|hives?|nests? of)\b/i.test(Object.values(s.text).join(" ")) && /(ant|bee|wasp|hornet|termite|yellowjacket)/i.test(s.name)) {
        out.system = "workers";
        out.maleShare = 0.02;
        out.src.push({field: "facts", phrase: "colony insect: the animals seen are almost all female workers", match: "workers"});
    }
    if (out.system === "hermaphrodite") out.maleShare = 0;
    // A stated ratio.
    for (const [field, sentence] of all) {
        const m = /\b(females? (greatly |far |usually )?outnumber\w* males|males? (greatly |far |usually )?outnumber\w* females|sex ratio[^.]{0,40}(female|male)[- ]biased|(female|male)[- ]biased sex ratio)\b/i.exec(sentence);
        if (m) {
            out.maleShare = /females? (greatly |far |usually )?outnumber|female[- ]biased/i.test(m[0]) ? 0.35 : 0.65;
            hit(field, sentence, m);
            break;
        }
    }
    // Size: "males are larger", "females are up to twice the size", "males about 30% heavier".
    const text = sentences(s.text.sexdiff).concat(sentences(s.text.traits), sentences(s.text.facts));
    for (const sentence of text) {
        const bigger = /\b(males?|bulls?|stags?|rams?|bucks?|cocks?|drakes?|boars?|females?|cows?|hens?|sows?)\b[^.]{0,30}\b(are|is|grow|can be|average|weigh|tend to be|often|usually|noticeably|much|slightly|considerably|markedly|substantially|clearly)\b[^.]{0,30}\b(larger|bigger|heavier|longer|taller|twice|three times|much larger|considerably larger|more massive|bulkier)\b/i.exec(sentence);
        const smaller = /\b(males?|females?)\b[^.]{0,30}\b(are|is|tend to be|often|usually)\b[^.]{0,20}\b(smaller|lighter|shorter|slighter)\b/i.exec(sentence);
        const m = bigger ?? smaller;
        if (!m) continue;
        if (NEGATED.test(sentence.slice(0, m.index + m[0].length).slice(-60)) && !/\bslightly\b/.test(m[0])) continue;
        const subjectMale = SEX_WORD.test(m[1]);
        out.bigger = bigger ? (subjectMale ? "male" : "female") : subjectMale ? "female" : "male";
        const twice = /twice|two times|double/i.test(sentence) ? 1.45 : /three times|several times|four times/i.test(sentence) ? 1.6 : null;
        const percent = /(\d{2,3})\s?(%|per ?cent)/i.exec(sentence);
        const slightly = /\bslightly|a little|marginally\b/i.test(sentence);
        const much = /\bmuch|considerably|markedly|substantially|far|greatly|noticeably\b/i.test(sentence);
        // Drawn length, not weight: a weight ratio's cube root (twice the weight is about 1.26 times the length).
        const ratio = twice ?? (percent ? Math.min(1 + Number(percent[1]) / 300, 1.45) : slightly ? 1.05 : much ? 1.2 : 1.12);
        out.sizeRatio = Math.round(ratio * 100) / 100;
        out.src.push({field: "sexdiff", phrase: phraseAt(sentence, m.index, m[0].length), match: m[0].toLowerCase()});
        break;
    }
    // Features: in each clause that names a sex, its subject (the first sex named) has them (or lacks them: then the other sex).
    const clauses = sentences(s.text.sexdiff).flatMap((t) => t.split(/,? (?:while|whereas|but|and) (?=(?:the |most |adult |many |some )?(?:males?|females?|bulls?|cows?|stags?|hinds?|rams?|ewes?|bucks?|does|cocks?|hens?|drakes?|boars?|sows?)\b)|; /i));
    for (const sentence of clauses) {
        const male = SEX_WORD.exec(sentence);
        const female = FEMALE_WORD.exec(sentence);
        if (!male && !female) continue;
        for (const [pattern, feature] of FEATURES) {
            const m = pattern.exec(sentence);
            if (!m) continue;
            // The clause's subject: the first sex it names.
            const owner = male && (!female || male.index < female.index) ? "male" : "female";
            const lacks = /\b(lack|lacks|without|no|absent|smaller|shorter|reduced|tiny|less)\b/i.test(sentence.slice(Math.max(m.index - 30, 0), m.index + m[0].length + 20));
            const list = feature === "dull" ? null : lacks && owner === "female" ? out.male : lacks && owner === "male" ? out.female : owner === "male" ? out.male : out.female;
            if (feature === "dull") {
                out.duller = owner;
            } else if (feature === "bright" && lacks) {
                out.duller = owner;
            } else if (list && !list.includes(feature)) list.push(feature);
            if (out.src.length < 6) out.src.push({field: "sexdiff", phrase: phraseAt(sentence, m.index, m[0].length), match: m[0].toLowerCase()});
        }
    }
    if (!out.duller && out.male.includes("bright") && !out.female.includes("bright")) out.duller = "female";
    if (!out.duller && out.female.includes("bright") && !out.male.includes("bright")) out.duller = "male";
    // Alike: "sexes look alike", "similar".
    const alike = sentences(s.text.sexdiff).find((t) => /\b(sexes|males and females|male and female)\b[^.]{0,40}\b(alike|similar|identical|look the same|indistinguishable|hard to tell apart)\b/i.test(t));
    if (alike && !out.bigger && !out.male.length && !out.female.length) out.src.push({field: "sexdiff", phrase: phraseAt(alike, 0, 1), match: "alike"});
    out.defaulted = !out.src.length;
    return out;
}

// MARK: Season

export type Season = {months: number[]; src: Hit | null; kind: "breeding" | "nesting" | "seen" | "default"};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const SEASONS: Record<string, number[]> = {spring: [3, 4, 5], summer: [6, 7, 8], autumn: [9, 10, 11], fall: [9, 10, 11], winter: [12, 1, 2]};

/** Month numbers (1–12) a phrase names: months, ranges ("April to June"), seasons (northern). */
export function monthsIn(text: string): number[] {
    const out = new Set<number>();
    const lower = text.toLowerCase();
    const range = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b\s*(?:to|-|–|through|until|and)\s*\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/g;
    for (let m = range.exec(lower); m; m = range.exec(lower)) {
        if ((m[1] === "may" || m[2] === "may") && !/\bMay\b/.test(text)) continue;
        let a = MONTHS.indexOf(m[1]);
        const b = MONTHS.indexOf(m[2]);
        for (let k = 0; k < 12; k++) {
            out.add(a + 1);
            if (a === b) break;
            a = (a + 1) % 12;
        }
    }
    // "May" only as a capitalised word (never "may feed"), and not starting a sentence.
    for (const [i, month] of MONTHS.entries()) if (month === "may" ? /(?<![.!?]\s)(?<!^)\bMay\b/.test(text) : new RegExp(`\\b${month}\\b`).test(lower)) out.add(i + 1);
    for (const [word, months] of Object.entries(SEASONS)) if (new RegExp(`\\b${word}\\b`).test(lower)) for (const n of months) out.add(n);
    return [...out].sort((a, b) => a - b);
}

const MATING = /\b(rut\w*|mating|mates? (in|from|between|during)|breeding season|breeds? (in|from|between|during|mainly|mostly|chiefly)|courtship|court(s|ing)? (in|from|during)|lek\w*|spawn\w*|in season|on heat|roar\w* (in|during|each))\b/i;
const NESTING = /\b(nests?|nesting|lays?|laid|eggs|clutch|born|births?|calv\w*|lamb\w*|pupping|whelp\w*|fawns?|give birth)\b/i;

/**
 * Its season for a kind of behaviour: "mating" (rut, courtship, male contests) or "nesting" (building, eggs, birth),
 * where stored or written (any field: "rutting activity intense in autumn"), else the other one, else the months it is
 * best seen (a weaker sign), else none (all year).
 */
export function seasonOf(s: SpeciesText, kind: "mating" | "nesting" = "mating"): Season {
    const order = kind === "mating" ? [MATING, NESTING] : [NESTING, MATING];
    for (const gate of order) {
        for (const field of ["season", "offspring", "sleep", "facts", "basis", "evidence", "sexdiff", "traits", "spotlight", "habitat", "story", "sd"] as TextField[]) {
            for (const sentence of sentences(s.text[field])) {
                const m = gate.exec(sentence);
                if (!m) continue;
                const months = monthsIn(sentence);
                if (months.length && months.length < 12) return {months, src: {field, phrase: phraseAt(sentence, m?.index ?? 0, m?.[0].length ?? 1), match: m?.[0].toLowerCase() ?? "season"}, kind: gate === MATING ? "breeding" : "nesting"};
            }
        }
    }
    if (s.seasonValue && s.seasonValue.length) {
        const months = monthsIn(s.seasonValue.join(" "));
        if (months.length && months.length < 12) return {months, src: {field: "season", phrase: s.seasonValue.join(", "), match: "season"}, kind: "breeding"};
    }
    const seen = s.text.months ? monthsIn(s.text.months) : [];
    if (seen.length && seen.length < 12) return {months: seen, src: {field: "months", phrase: s.text.months!, match: "months"}, kind: "seen"};
    return {months: [], src: null, kind: "default"};
}

// MARK: Nest materials

export const MATERIALS: Array<[RegExp, string]> = [
    [/\b(twigs?|sticks?|branches|stick nest)\b/i, "twigs"],
    [/\b(grass(es)?|straw|hay|dry stems)\b/i, "grass"],
    [/\bmud\b|\bclay\b/i, "mud"],
    [/\b(leaves|leaf)\b/i, "leaves"],
    [/\bmoss(es)?\b/i, "moss"],
    [/\b(feathers?|down)\b/i, "feathers"],
    [/\b(reeds?|rushes|sedges?|water plants|aquatic plants|vegetation)\b/i, "reeds"],
    [/\b(seaweed|kelp)\b/i, "seaweed"],
    [/\b(pebbles?|stones?|gravel)\b/i, "pebbles"],
    [/\b(saliva)\b/i, "saliva"],
    [/\b(spider ?silk|silk|cobwebs?|webs?)\b/i, "silk"],
    [/\b(lichens?)\b/i, "lichen"],
    [/\b(bark|wood chips|wood fibre|chewed wood|paper)\b/i, "bark"],
    [/\b(bubbles?|foam)\b/i, "bubbles"],
    [/\b(hair|fur|wool)\b/i, "hair"],
    [/\b(sand)\b/i, "sand"]
];

export type Nest = {materials: string[]; kind: "cup" | "platform" | "dome" | "mud" | "cavity" | "scrape" | "mound" | "floating" | "bubble" | "burrow" | "bower" | "beach" | "other"; src: Hit[]};

export function nestOf(s: SpeciesText, hits: Hit[]): Nest | null {
    if (!hits.length) return null;
    const text = hits.map((h) => h.phrase).join(" ");
    // The materials are in the sentences round the nest (the whole sentence, not just the phrase).
    const around = Object.entries(s.text)
        .flatMap(([, value]) => sentences(value))
        .filter((t) => /\bnests?\b|\bbowers?\b/i.test(t) && !/\bnests? of (ants|termites|wasps|bees)\b/i.test(t))
        .join(" ");
    const materials = MATERIALS.filter(([pattern]) => pattern.test(around)).map(([, m]) => m);
    const kind: Nest["kind"] = /\bbower/i.test(around)
        ? "bower"
        : /\bbubble/i.test(around)
          ? "bubble"
          : /\bfloating\b/i.test(around)
            ? "floating"
            : /\b(mound|incubation mound)\b/i.test(around)
              ? "mound"
              : /\bmud (nest|cup)|of mud|from mud|with mud\b/i.test(around) && !/\bmudflats?\b/i.test(text)
                ? "mud"
                : /\b(dome|domed|ball|globular|enclosed|roofed|hanging|woven|pendant)\b/i.test(around)
                  ? "dome"
                  : /\b(platform|stick nest|large nest of sticks|bulky)\b/i.test(around)
                    ? "platform"
                    : /\b(cavit|hole|hollow|tree hole|nest hole|nest box)\w*/i.test(around)
                      ? "cavity"
                      : /\b(scrape|shallow depression|hollow in the ground|bare ground|on the ground)\b/i.test(around)
                        ? "scrape"
                        : /\bburrow/i.test(around)
                          ? "burrow"
                          : /\bcup/i.test(around)
                            ? "cup"
                            : "other";
    return {materials, kind, src: hits};
}

/**
 * On-page "What animal am I?" quiz for /what-animal-am-i.
 *
 * Pure data + deterministic scoring, shared by the server-rendered sections
 * (question list, results gallery) and the client quiz component. No network,
 * no randomness: the same answers always produce the same result.
 *
 * Every `slug` is published in src/data/published-seo-slugs.json under both
 * `animals` and `lessons`, so /animals/<slug> and /animal-lessons/<slug> resolve.
 */

export type QuizAnimalId =
    | "wolf"
    | "octopus"
    | "elephant"
    | "barn-owl"
    | "sea-otter"
    | "honey-badger"
    | "dolphin"
    | "red-fox"
    | "grizzly-bear"
    | "bald-eagle"
    | "domestic-cat"
    | "american-crow"
    | "galapagos-tortoise"
    | "ruby-throated-hummingbird";

export type QuizAnimal = {
    /** Species slug; doubles as the archetype id. */
    slug: QuizAnimalId;
    name: string;
    /** Short archetype label shown under the name. */
    archetype: string;
    /** One line for the SSR "all possible results" gallery. */
    oneLiner: string;
    /** 2–3 sentence personality read grounded in the species' real behaviour. */
    read: string;
    /**
     * Artwork file in the species bucket when the slug has none of its own;
     * without it the artwork route falls back to a relative (wolf → Ethiopian wolf).
     */
    artworkFile?: string;
};

export type QuizAnswer = {
    id: string;
    label: string;
    weights: Partial<Record<QuizAnimalId, number>>;
};

export type QuizQuestion = {
    id: string;
    /** What the question measures, shown in the "what this test measures" section. */
    trait: string;
    prompt: string;
    answers: QuizAnswer[];
};

export type WildProfileRole = "origin" | "apex" | "active";

export type QuizResult = {
    /** Root pattern: best match across every answer. */
    origin: QuizAnimal;
    /** Pressure pattern: best match on the conflict / pressure / protect / flaw answers. */
    apex: QuizAnimal;
    /** Current season: best match on the recharge / novelty / learning / rhythm answers. */
    active: QuizAnimal;
    scores: Record<QuizAnimalId, number>;
};

export const quizAnimals: QuizAnimal[] = [
    {
        slug: "wolf",
        artworkFile: "gray-wolf.webp",
        name: "Gray Wolf",
        archetype: "The loyal coordinator",
        oneLiner: "Team-first and loyal — you do your best work as part of a tight, well-organised pack.",
        read: "Wolf packs are usually one extended family that travels, hunts and raises pups together, coordinating with howls, posture and scent. Like them, you are at your best with a clear crew and a shared goal, and you notice quickly when someone in the group is falling behind. Your loyalty is earned slowly and kept for a long time."
    },
    {
        slug: "octopus",
        name: "Octopus",
        archetype: "The inventive problem-solver",
        oneLiner: "Curious, adaptable and inventive — you solve problems by poking at them from every angle.",
        read: "Octopuses open jars, squeeze through gaps the size of their beak and change skin colour and texture in a fraction of a second, with much of their nervous system spread through their arms. You work the same way: you would rather experiment than follow a manual, and you adapt fast when the situation changes. You are happy working alone as long as there is something interesting to figure out."
    },
    {
        slug: "elephant",
        artworkFile: "african-bush-elephant.webp",
        name: "African Elephant",
        archetype: "The steady caretaker",
        oneLiner: "The one everyone leans on — you remember what matters and look after your herd.",
        read: "Elephant herds are led by an older matriarch whose memory of water holes and dangers helps the whole family survive, and herd members are seen gathering around and touching distressed calves. You carry that kind of memory and care: you remember birthdays, old promises and who needs checking on. People trust you because you show up consistently, not loudly."
    },
    {
        slug: "barn-owl",
        name: "Barn Owl",
        archetype: "The quiet observer",
        oneLiner: "Calm, perceptive and a little nocturnal — you listen first and act with precision.",
        read: "Barn owls hunt mostly at night and can locate prey by sound alone, helped by a heart-shaped face that funnels sound and feathers that keep their flight almost silent. You tend to take in a room before you speak and notice details other people miss. When you finally move, it is usually quietly and exactly on target."
    },
    {
        slug: "sea-otter",
        name: "Sea Otter",
        archetype: "The playful toolmaker",
        oneLiner: "Playful, sociable and resourceful — you make hard things feel lighter for everyone.",
        read: "Sea otters crack shellfish open with rocks they carry around, spend hours grooming their dense fur to stay warm, and rest together in floating groups called rafts. You bring that mix of play and practicality: you keep the mood light, take good care of yourself, and are surprisingly handy when something needs fixing. You recharge best with your people close by."
    },
    {
        slug: "honey-badger",
        name: "Honey Badger",
        archetype: "The fearless persister",
        oneLiner: "Tenacious and unshakeable — pressure makes you more determined, not less.",
        read: "Honey badgers dig relentlessly, raid beehives for larvae and are known to stand their ground against much larger predators thanks to thick, loose skin and sheer persistence. You share that refusal to back down: when something matters, you deal with it head-on. The flip side is stubbornness — you can keep pushing after it would be smarter to stop."
    },
    {
        slug: "dolphin",
        name: "Bottlenose Dolphin",
        archetype: "The social communicator",
        oneLiner: "Warm, quick and socially fluent — you read the room and bring people together.",
        read: "Bottlenose dolphins live in shifting social groups, keep track of one another with individual signature whistles, and spend a lot of time in what looks like play. You thrive in connection: you communicate easily, sense group mood fast and enjoy bringing people into the fun. Long stretches alone tend to drain rather than restore you."
    },
    {
        slug: "red-fox",
        name: "Red Fox",
        archetype: "The adaptable opportunist",
        oneLiner: "Clever, independent and adaptable — you find the gap nobody else noticed.",
        read: "Red foxes live everywhere from Arctic tundra to city centres, eat almost anything, cache food for later and pinpoint mice under snow by sound before pouncing. You are similarly resourceful: you would rather find a clever route around a problem than charge through it. You keep a rough plan but change it the moment a better opportunity shows up."
    },
    {
        slug: "grizzly-bear",
        name: "Grizzly Bear",
        archetype: "The self-reliant protector",
        oneLiner: "Self-reliant, seasonal and protective — calm by default, formidable when it counts.",
        read: "Grizzlies spend most of the year on their own, eat enormous amounts in late summer and autumn to store fat for winter, and mothers defend their cubs fiercely. You recharge alone, plan for the lean seasons ahead, and are generally easy-going. But if someone threatens the people you protect, that calm disappears fast."
    },
    {
        slug: "bald-eagle",
        name: "Bald Eagle",
        archetype: "The big-picture focuser",
        oneLiner: "Focused, far-sighted and committed — you see the whole landscape and pick your target.",
        read: "Bald eagles have eyesight several times sharper than ours, usually pair with one mate for years, and keep adding to the same huge nest season after season. You combine long-range vision with steady commitment: you like to see the whole picture, choose one goal and build on it over time. Under pressure you get calmer and sharper, not louder."
    },
    {
        slug: "domestic-cat",
        name: "Domestic Cat",
        archetype: "The independent selector",
        oneLiner: "Independent, routine-loving and selective — your affection is real but on your terms.",
        read: "Cats hunt alone, are most active around dawn and dusk, and show trust in quiet ways such as slow blinks, head-bunting and simply choosing to sit near someone. You value your independence and your routines, and you pick your people carefully. When you do show affection, it is low-key, sincere and easy to miss if someone is not paying attention."
    },
    {
        slug: "american-crow",
        name: "American Crow",
        archetype: "The strategic learner",
        oneLiner: "Observant, strategic and quick to learn — you watch, remember and outthink.",
        read: "American crows recognise individual human faces for years, warn their family group about people who have threatened them, and hide food to retrieve later. You learn by watching, remember what worked, and think a few moves ahead. You are loyal to your inner circle and slow to forget a slight."
    },
    {
        slug: "galapagos-tortoise",
        name: "Galápagos Tortoise",
        archetype: "The patient long-gamer",
        oneLiner: "Patient, steady and unhurried — you win by outlasting, not outrunning.",
        read: "Galápagos tortoises can live well beyond a century, spend long hours resting and basking to save energy, and can go many months without food or water. You play the long game: steady routines, no wasted effort, and a calm that others find grounding. You do not like being rushed, and you rarely need to be."
    },
    {
        slug: "ruby-throated-hummingbird",
        name: "Ruby-throated Hummingbird",
        archetype: "The high-energy explorer",
        oneLiner: "Bright, fast and always moving — you chase novelty and bring the energy.",
        read: "Ruby-throated hummingbirds have one of the highest metabolisms of any animal, visit hundreds of flowers a day, and many cross the Gulf of Mexico non-stop on migration. You run hot in the best way: quick, curious and drawn to whatever is new. You get a lot done in bursts, and you need novelty to stay switched on."
    }
];

export const quizQuestions: QuizQuestion[] = [
    {
        id: "recharge",
        trait: "How you recharge — solitude, close company, novelty or play",
        prompt: "After a draining week, how do you recharge?",
        answers: [
            {id: "solo", label: "Alone — phone off, no plans, my own space.", weights: {"grizzly-bear": 2, "domestic-cat": 2, "barn-owl": 1}},
            {id: "people", label: "With my close people — food, couch, familiar faces.", weights: {wolf: 2, elephant: 2, "sea-otter": 1}},
            {id: "novelty", label: "Somewhere new — a trip, a class, a place I've never been.", weights: {"ruby-throated-hummingbird": 2, octopus: 1, "red-fox": 1}},
            {id: "play", label: "Something active and social — a game, a swim, a night out.", weights: {dolphin: 2, "sea-otter": 2, "ruby-throated-hummingbird": 1}}
        ]
    },
    {
        id: "conflict",
        trait: "How you handle conflict — head-on, patient, peacekeeping or clever",
        prompt: "Someone crosses a line with you. What do you do?",
        answers: [
            {id: "head-on", label: "Deal with it right away, directly.", weights: {"honey-badger": 3, "bald-eagle": 1}},
            {id: "observe", label: "Step back, watch, and pick my moment.", weights: {"barn-owl": 2, "american-crow": 2, "domestic-cat": 1}},
            {id: "smooth", label: "Smooth it over so the group stays together.", weights: {elephant: 2, dolphin: 2}},
            {id: "around", label: "Find a clever way around it instead of a fight.", weights: {"red-fox": 2, octopus: 2}}
        ]
    },
    {
        id: "solo-group",
        trait: "Where you do your best work — team, solo, crowd or leading",
        prompt: "Which setup brings out your best work?",
        answers: [
            {id: "team", label: "A tight team where everyone knows their role.", weights: {wolf: 3}},
            {id: "solo", label: "Working alone, then sharing when it's done.", weights: {octopus: 2, "domestic-cat": 2, "grizzly-bear": 1}},
            {id: "crowd", label: "A big, buzzing group bouncing ideas around.", weights: {dolphin: 2, "sea-otter": 2}},
            {id: "lead", label: "Setting the direction and keeping the big picture.", weights: {"bald-eagle": 3, elephant: 1}}
        ]
    },
    {
        id: "planning",
        trait: "Planning style — stockpiler, adapter, improviser or slow and steady",
        prompt: "Planner or improviser?",
        answers: [
            {id: "stockpile", label: "Planner — I prepare early and keep reserves.", weights: {"grizzly-bear": 2, "american-crow": 2, "galapagos-tortoise": 1}},
            {id: "rough", label: "Rough plan, then adapt as I go.", weights: {"red-fox": 2, wolf: 1}},
            {id: "improv", label: "Improviser — I figure it out in the moment.", weights: {octopus: 2, "ruby-throated-hummingbird": 2}},
            {id: "steady", label: "One step at a time, at my own pace.", weights: {"galapagos-tortoise": 3}}
        ]
    },
    {
        id: "day-night",
        trait: "Your daily rhythm — dawn, daytime, dusk or night",
        prompt: "When are you most switched on?",
        answers: [
            {id: "morning", label: "Early morning — I'm up with the light.", weights: {"bald-eagle": 2, "ruby-throated-hummingbird": 2, "sea-otter": 1}},
            {id: "night", label: "Late at night, when everything is quiet.", weights: {"barn-owl": 3, "red-fox": 1}},
            {id: "twilight", label: "Dawn and dusk — the in-between hours.", weights: {"domestic-cat": 2, "red-fox": 1, "grizzly-bear": 1}},
            {id: "steady", label: "Pretty even all day — I keep a steady pace.", weights: {"galapagos-tortoise": 2, "american-crow": 1, dolphin: 1}}
        ]
    },
    {
        id: "novelty",
        trait: "Your relationship with your comfort zone",
        prompt: "How do you feel about your comfort zone?",
        answers: [
            {id: "routine", label: "I love my routines and rituals.", weights: {"galapagos-tortoise": 2, "domestic-cat": 2, "bald-eagle": 1}},
            {id: "base", label: "A familiar home base, with small adventures.", weights: {"sea-otter": 1, "grizzly-bear": 1, elephant: 1, wolf: 1}},
            {id: "new", label: "I'm always chasing something new.", weights: {"ruby-throated-hummingbird": 2, octopus: 2, dolphin: 1}},
            {id: "anywhere", label: "I can make a home anywhere there's opportunity.", weights: {"red-fox": 2, "american-crow": 2, "honey-badger": 1}}
        ]
    },
    {
        id: "care",
        trait: "How you show care — memory, protection, play or quiet presence",
        prompt: "How do you usually show someone you care?",
        answers: [
            {id: "remember", label: "I remember the details and always show up.", weights: {elephant: 3, "american-crow": 1}},
            {id: "protect", label: "I protect them — nobody messes with my people.", weights: {"honey-badger": 2, "grizzly-bear": 2, wolf: 1}},
            {id: "play", label: "I make them laugh and pull them into the fun.", weights: {"sea-otter": 2, dolphin: 2}},
            {id: "presence", label: "Quiet company — I'm just there, no fuss.", weights: {"domestic-cat": 2, "barn-owl": 1, "galapagos-tortoise": 1}}
        ]
    },
    {
        id: "pressure",
        trait: "How you react under pressure — fight, focus, pivot or outlast",
        prompt: "When the pressure is really on, you…",
        answers: [
            {id: "fiercer", label: "Get fiercer and refuse to quit.", weights: {"honey-badger": 3, wolf: 1}},
            {id: "focus", label: "Go calm and laser-focused.", weights: {"bald-eagle": 2, "barn-owl": 2}},
            {id: "pivot", label: "Think fast and try something different.", weights: {octopus: 2, "red-fox": 2, "american-crow": 1}},
            {id: "outlast", label: "Slow down, save energy and outlast it.", weights: {"galapagos-tortoise": 2, "grizzly-bear": 2}}
        ]
    },
    {
        id: "learning",
        trait: "How you learn — watching, tinkering, talking or diving in",
        prompt: "How do you learn something new?",
        answers: [
            {id: "watch", label: "Watch others first, then do it better.", weights: {"american-crow": 3, "barn-owl": 1}},
            {id: "hands-on", label: "Hands-on — take it apart and tinker.", weights: {octopus: 2, "sea-otter": 2}},
            {id: "together", label: "Talk it through with other people.", weights: {dolphin: 2, elephant: 1, wolf: 1}},
            {id: "burst", label: "Dive in fast, absorb what I need, move on.", weights: {"ruby-throated-hummingbird": 2, "bald-eagle": 1, "red-fox": 1}}
        ]
    },
    {
        id: "flaw",
        trait: "Your blind spot — stubborn, restless, aloof or over-giving",
        prompt: "What would your friends say is your biggest flaw?",
        answers: [
            {id: "stubborn", label: "Stubborn — I won't let things go.", weights: {"honey-badger": 2, "galapagos-tortoise": 1, "bald-eagle": 1}},
            {id: "restless", label: "Restless — hard to pin down.", weights: {"ruby-throated-hummingbird": 2, "sea-otter": 1, "red-fox": 1}},
            {id: "aloof", label: "Aloof — I need a lot of space.", weights: {"domestic-cat": 2, "grizzly-bear": 1, "barn-owl": 1}},
            {id: "over-giving", label: "I give too much of myself to others.", weights: {elephant: 2, wolf: 1, dolphin: 1}}
        ]
    }
];

function emptyScores(): Record<QuizAnimalId, number> {
    return quizAnimals.reduce((acc, animal) => {
        acc[animal.slug] = 0;
        return acc;
    }, {} as Record<QuizAnimalId, number>);
}

/**
 * The same three roles the app's Wild Profile uses. Apex and Active are scored
 * on the questions that speak to that role; Origin on everything.
 */
export const wildProfileRoleQuestions: Record<Exclude<WildProfileRole, "origin">, string[]> = {
    apex: ["conflict", "pressure", "care", "flaw"],
    active: ["recharge", "novelty", "learning", "day-night"]
};

type Tally = {scores: Record<QuizAnimalId, number>; hits: Record<QuizAnimalId, number>; peak: Record<QuizAnimalId, number>};

function tally(answers: Record<string, string>, questionIds?: string[]): Tally {
    const scores = emptyScores();
    const hits = emptyScores();
    const peak = emptyScores();

    quizQuestions.forEach((question) => {
        if (questionIds && !questionIds.includes(question.id)) {
            return;
        }
        const answer = question.answers.find((item) => item.id === answers[question.id]);
        if (!answer) {
            return;
        }
        (Object.keys(answer.weights) as QuizAnimalId[]).forEach((slug) => {
            const weight = answer.weights[slug] ?? 0;
            scores[slug] += weight;
            hits[slug] += 1;
            peak[slug] = Math.max(peak[slug], weight);
        });
    });

    return {scores, hits, peak};
}

function rank(primary: Tally, overall: Tally, exclude: QuizAnimalId[] = []): QuizAnimal {
    const ranked = quizAnimals
        .map((animal, order) => ({animal, order}))
        .filter(({animal}) => !exclude.includes(animal.slug))
        .sort((a, b) => {
            const x = a.animal.slug;
            const y = b.animal.slug;
            return primary.scores[y] - primary.scores[x]
                || primary.hits[y] - primary.hits[x]
                || primary.peak[y] - primary.peak[x]
                || overall.scores[y] - overall.scores[x]
                || a.order - b.order;
        });
    return ranked[0].animal;
}

/**
 * Deterministic scoring into an Origin / Apex / Active triad.
 *
 * 1. Each chosen answer adds its weights to the matching animals.
 * 2. Origin is the top animal across all answers.
 * 3. Apex is the top animal on the pressure questions, Active the top animal
 *    on the current-season questions; each skips animals already assigned so
 *    the triad is always three different species.
 * 4. Ties break on the number of separate answers that pointed at the animal
 *    (broad agreement beats one heavy answer), then on the strongest single
 *    weight, then on the overall score, then on the fixed order of `quizAnimals`.
 *
 * `answers` maps question id → answer id. Unknown ids are ignored, so a stale
 * saved state can never throw.
 */
export function scoreQuiz(answers: Record<string, string>): QuizResult {
    const overall = tally(answers);
    const origin = rank(overall, overall);
    const apex = rank(tally(answers, wildProfileRoleQuestions.apex), overall, [origin.slug]);
    const active = rank(tally(answers, wildProfileRoleQuestions.active), overall, [origin.slug, apex.slug]);

    return {origin, apex, active, scores: overall.scores};
}

export function getQuizAnimal(slug: string): QuizAnimal | undefined {
    return quizAnimals.find((animal) => animal.slug === slug);
}

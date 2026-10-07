/**
 * "What does it mean to dream about a <animal>?" — answered from the animal's
 * own AnimalDex principle, expression, core lesson and best-for qualities, so
 * every species page with a principle (≈2,400) carries a distinct reading in
 * its Animal Power section. Phrasing rotates deterministically by slug so the
 * pages don't repeat one template sentence.
 *
 * Framing: a reflective reading tied to real behaviour, never a prediction.
 */

export type DreamReadingInput = {
    slug: string;
    name: string;
    principle: string;
    principleExpression?: string | null;
    coreLesson: string;
    motto?: string | null;
    bestFor: string[];
};

export type DreamScenarioReading = {title: string; reading: string};

export type DreamReading = {
    question: string;
    answer: string;
    goodOrBad: string;
    scenarios: DreamScenarioReading[];
    note: string;
};

// Place and people words stay capitalised in running text ("African lion").
const PROPER_WORDS = /^(african|american|asian|european|indian|bengal|siberian|sumatran|bornean|javan|malayan|chinese|japanese|korean|arabian|australian|tasmanian|egyptian|madagascan|amazon|amazonian|andean|arctic|antarctic|atlantic|pacific|caribbean|mediterranean|himalayan|tibetan|mexican|brazilian|canadian|californian|alaskan|galapagos|komodo|nile|congo|sahara|russian|mongolian|persian|scottish|irish|english|british|french|german|spanish|norwegian|siamese|cape|eurasian|philippine|new|zealand|guinea|hawaiian|cuban|jamaican|patagonian|chilean|peruvian|argentine|sri|lankan|bactrian|przewalski|grant|thomson|kirk|xantus|humboldt|magellanic|adelie|emperor|king)$/i;

/** "Bengal Tiger" → "Bengal tiger", "Sabine's Gull" → "Sabine's gull", "Lion" → "lion". */
export function commonNameInSentence(name: string) {
    return name
        .split(" ")
        .map((word) => (PROPER_WORDS.test(word) || /'s$/i.test(word) || /^[A-Z]{2,}$/.test(word) ? word : word.toLowerCase()))
        .join(" ");
}

function article(word: string) {
    return /^[aeiou]/i.test(word) ? "an" : "a";
}

function lowerFirst(text: string) {
    return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function sentence(text: string) {
    const trimmed = text.trim();
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Stable small hash so a slug always gets the same phrasing. */
function pick<T>(slug: string, salt: number, options: T[]): T {
    let hash = salt;
    for (const character of slug) {
        hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return options[hash % options.length];
}

export function buildDreamQuestion(name: string) {
    const animal = commonNameInSentence(name);
    return `What does it mean to dream about ${article(animal)} ${animal}?`;
}

export function buildAnimalDreamReading(input: DreamReadingInput): DreamReading {
    const {slug, name} = input;
    const animal = commonNameInSentence(name);
    const a = `${article(animal)} ${animal}`;
    const principle = input.principle.trim();
    const expression = input.principleExpression?.trim();
    const lesson = sentence(input.coreLesson);
    const qualities = input.bestFor.map((quality) => quality.trim().toLowerCase()).filter(Boolean);
    const first = qualities[0] ?? principle.toLowerCase();
    const second = qualities[1] ?? first;
    const third = qualities[2] ?? second;
    const motto = input.motto?.trim();

    const opener = pick(slug, 1, [
        `Dreaming about ${a} usually points to ${first} and ${second}: the qualities the ${animal} lives by.`,
        `${a.charAt(0).toUpperCase()}${a.slice(1)} in a dream tends to show up when ${first} or ${second} is on your mind.`,
        `A dream about ${a} is often a nudge toward ${first}, the quality the ${animal} is built around.`
    ]);
    const principleLine = expression
        ? `In AnimalDex, the ${animal}'s principle is ${principle}: ${lowerFirst(sentence(expression))}`
        : `In AnimalDex, the ${animal}'s principle is ${principle}.`;
    const answer = `${opener} ${principleLine} Read the dream through its core lesson: ${lesson}`;

    const goodOrBad = pick(slug, 2, [
        `Mostly a prompt rather than a warning. A calm ${animal} suggests ${first} you already have; a threatening one suggests ${first} is being tested or pushed too far.`,
        `It depends on how the ${animal} behaved. Calm or close by, it reads as ${second} within reach; aggressive or fleeing, it points to ${first} you are resisting.`,
        `Neither good nor bad on its own. How the ${animal} acts matters: at ease, it reflects ${first}; hostile, it flags ${first} out of balance.`
    ]);

    const scenarios: DreamScenarioReading[] = [
        {
            title: `Being chased by ${a}`,
            reading: pick(slug, 3, [
                `Being chased suggests you are avoiding the ${principle} the ${animal} stands for: ${lowerFirst(lesson)} Ask what you keep postponing that needs ${first}.`,
                `A chase often means a demand for ${first} is catching up with you. The ${animal}'s lesson, "${input.coreLesson.trim().replace(/[.!?]+$/, "")}", is the part you may be running from.`,
                `If the ${animal} pursues you, look at where ${second} is being asked of you and you are stepping away instead of meeting it.`
            ])
        },
        {
            title: `${a.charAt(0).toUpperCase()}${a.slice(1)} attacking you`,
            reading: pick(slug, 4, [
                `An attack points to ${first} turned against you: someone using it on you, or your own ${first} overused until it costs you.`,
                `When the ${animal} attacks, the dream may be about pressure: ${second} or ${third} applied too hard, by you or by someone close to you.`,
                `An aggressive ${animal} can mirror a conflict where ${first} has become a weapon rather than a strength.`
            ])
        },
        {
            title: `A calm or friendly ${animal}`,
            reading: pick(slug, 5, [
                `A relaxed ${animal} near you reads as readiness: ${principle} is available to you now${motto ? `, as its motto puts it, "${motto}"` : ""}.`,
                `A calm ${animal} suggests you have made peace with ${first} and can use it without force.`,
                `Meeting a peaceful ${animal} is usually encouraging: ${second} and ${third} are within reach.`
            ])
        },
        {
            title: `A dead or injured ${animal}`,
            reading: pick(slug, 6, [
                `A dead or injured ${animal} can mark ${first} you have let lapse, or a phase built on ${principle} coming to an end.`,
                `Seeing the ${animal} hurt may point to ${second} that has been neglected. Ask what it would take to restore it.`,
                `An injured ${animal} often reflects ${first} under strain; rest and repair come before pushing again.`
            ])
        }
    ];

    return {
        question: buildDreamQuestion(name),
        answer,
        goodOrBad,
        scenarios,
        note: `Dream readings on AnimalDex are reflective prompts drawn from how the ${animal} really lives, not predictions.`
    };
}

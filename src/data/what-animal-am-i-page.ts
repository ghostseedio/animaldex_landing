export type WildProfileAnimalMatch = {
    speciesSlug: string;
    speciesName: string;
    rationale: string;
};

export type CelebrityWildProfile = {
    id: string;
    name: string;
    roleLabel: string;
    summary: string;
    origin: WildProfileAnimalMatch;
    apex: WildProfileAnimalMatch;
    active: WildProfileAnimalMatch;
};

export const WHAT_ANIMAL_AM_I_SLUG = "what-animal-am-i";
export const WHAT_ANIMAL_AM_I_UPDATED_AT = "2026-10-07";

export const whatAnimalAmIPage = {
    slug: WHAT_ANIMAL_AM_I_SLUG,
    // The root layout's title template appends " | AnimalDex".
    metaTitle: "What Animal Am I? Free Animal Personality Quiz",
    metaDescription: "Take the free 10-question animal personality quiz and get your animal instantly — plus your secondary animal, grounded in how 14 real species actually behave.",
    heroTitle: "What animal am I?",
    heroSubtitle: "Take the free 10-question animal personality quiz below and get your answer instantly: a main animal, a secondary animal, and why they fit.",
    intro: "Every result is a real species, matched on how you recharge, handle conflict, work with others and react under pressure. Want the deeper version? The AnimalDex app builds a full Wild Profile — Origin, Apex and Active animals — from an adaptive interview.",
    quiz: {
        eyebrow: "Spirit animal quiz",
        title: "Take the animal personality quiz",
        description: "10 quick questions, no sign-up. Pick the answer that sounds most like you — not who you'd like to be.",
        submitLabel: "Show my animal",
        answeredLabel: "answered",
        incompleteHint: "Answer every question to see your animal.",
        resultEyebrow: "Your animal",
        secondaryLabel: "Your secondary animal",
        speciesLinkLabel: "Meet the species",
        lessonLinkLabel: "Read its life lessons",
        retakeLabel: "Retake the quiz",
        fullProfileTitle: "Want the full Wild Profile?",
        fullProfileDescription: "This quiz gives you one snapshot. In the AnimalDex app, an adaptive interview builds three animals — Origin (your root pattern), Apex (you under pressure) and Active (your current season) — matched against the AnimalDex species catalog.",
        resultsEyebrow: "Every possible result",
        resultsDescription: "The quiz scores you against these real species. Each description is based on documented behaviour of the animal — not astrology.",
        progressLabel: "Quiz progress"
    },
    searchIntents: [
        "what animal am I",
        "what animal are you",
        "spirit animal quiz",
        "what is my spirit animal",
        "animal personality quiz",
        "what animal are you quiz",
        "free spirit animal quiz",
        "find out which animal you are",
        "animal identity app",
        "AnimalDex Wild Profile",
        "origin apex active animal"
    ],
    roleRows: [
        {
            role: "Origin",
            meaning: "Your stable root pattern — the baseline style that tends to stay with you across seasons."
        },
        {
            role: "Apex",
            meaning: "How you become under pressure, when defending something, or operating at full intensity."
        },
        {
            role: "Active",
            meaning: "Your current actionable pattern — the animal energy most relevant right now."
        }
    ],
    howItWorks: [
        "Open AnimalDex, go to Identity, and start Wild Profile.",
        "Answer an adaptive chat-style interview. Questions follow your values, habits, fears, social style, favorite animals, and recurring life patterns.",
        "AnimalDex scores candidate species from its catalog, then AI chooses only from that shortlist.",
        "You receive Origin, Apex, and Active animals with evidence inside the app — not a random horoscope label."
    ],
    whyNotStatic: [
        "Static quizzes ask everyone the same questions in the same order.",
        "Wild Profile adapts because the best animal match depends on behavioral patterns, not trivia preferences alone.",
        "Feeling like more than one animal is normal — that is why AnimalDex uses a triad instead of forcing one answer."
    ],
    faq: [
        {
            question: "What animal am I?",
            answer: "Take the 10-question quiz on this page to find out instantly. It scores your answers about how you recharge, handle conflict, plan, learn and react under pressure against 14 real animals — from the Gray Wolf and Octopus to the Honey Badger and Galápagos Tortoise — and shows your main animal plus a secondary animal."
        },
        {
            question: "How does the spirit animal quiz work?",
            answer: "Each of the 10 questions has four answers, and every answer adds points to the animals whose real-world behaviour matches it. Your main animal is the one with the most points and your secondary animal is the runner-up. Scoring is fixed, so the same answers always give the same result."
        },
        {
            question: "Is this quiz scientific?",
            answer: "No. It is a fun, self-report personality reflection, not a validated psychological test. What is grounded in science is the animal side: each description is based on documented behaviour of that species, such as wolf pack cooperation, crow face recognition or bear hyperphagia before winter."
        },
        {
            question: "What is my spirit animal based on my personality?",
            answer: "Your quiz result is the animal whose habits best mirror yours — for example, a team-first planner tends to land on the Wolf, a curious improviser on the Octopus, and a calm, routine-loving loner on the Domestic Cat or Galápagos Tortoise. For a deeper three-animal answer, the AnimalDex app builds a full Wild Profile."
        },
        {
            question: "What is the AnimalDex Wild Profile?",
            answer: "Wild Profile is the full version inside the AnimalDex app: Origin, Apex, and Active animals. Origin is your root pattern, Apex is your pressure pattern, and Active is your current actionable pattern. It uses an adaptive interview and catalog-backed matching rather than a fixed quiz."
        },
        {
            question: "How do I get my full Wild Profile?",
            answer: "Download AnimalDex on the App Store or Google Play, open Identity, and complete the Wild Profile interview. The app generates your personal Origin, Apex, and Active diagnosis there."
        },
        {
            question: "Can my animal change?",
            answer: "Yes. On this quiz your result changes if your answers do. In the app, Active can shift as your current season changes, Apex can be refreshed from newer reflection data, and Origin only changes if you retake the full questionnaire."
        },
        {
            question: "Are the celebrity examples real app results?",
            answer: "No. The celebrity carousel is editorial — it shows how Wild Profile logic maps public personas to Origin, Apex, and Active patterns using AnimalDex animal behavior principles."
        }
    ],
    blogSlug: "what-animal-am-i"
};

export const celebrityWildProfiles: CelebrityWildProfile[] = [
    {
        id: "beyonce",
        name: "Beyoncé",
        roleLabel: "Performer & cultural architect",
        summary: "A public persona built on ceremony, precision, and command — with different animals for baseline magnetism, stage pressure, and current strategic focus.",
        origin: {
            speciesSlug: "indian-peafowl",
            speciesName: "Indian Peafowl",
            rationale: "Origin maps to visible mastery, ritual, and the baseline need to hold attention with elegance rather than noise."
        },
        apex: {
            speciesSlug: "lion",
            speciesName: "Lion",
            rationale: "Apex appears when the stakes are highest: command, territorial authority, and protecting the work under spotlight pressure."
        },
        active: {
            speciesSlug: "bald-eagle",
            speciesName: "Bald Eagle",
            rationale: "Active reflects the current era of strategic reinvention — altitude, precision, and long-range vision over short-term reaction."
        }
    },
    {
        id: "elon-musk",
        name: "Elon Musk",
        roleLabel: "Builder across domains",
        summary: "A pattern of cross-domain adaptation, relentless execution intensity, and high-altitude strategic bets.",
        origin: {
            speciesSlug: "octopus",
            speciesName: "Octopus",
            rationale: "Origin fits distributed intelligence — shifting between engineering, product, narrative, and risk without staying in one lane."
        },
        apex: {
            speciesSlug: "komodo-dragon",
            speciesName: "Komodo Dragon",
            rationale: "Apex is the relentless execution mode: patient pursuit, high stamina, and intensity when a target is locked."
        },
        active: {
            speciesSlug: "bald-eagle",
            speciesName: "Bald Eagle",
            rationale: "Active shows up as strategic altitude — scanning many fronts at once and committing to bold, high-visibility moves."
        }
    },
    {
        id: "taylor-swift",
        name: "Taylor Swift",
        roleLabel: "Narrative strategist",
        summary: "Loyal tribe-building at the root, fierce protection of craft under attack, and playful audience communication in the present.",
        origin: {
            speciesSlug: "wolf",
            speciesName: "Wolf",
            rationale: "Origin reflects long-arc belonging — building and tending a loyal pack around shared story and identity."
        },
        apex: {
            speciesSlug: "tiger",
            speciesName: "Tiger",
            rationale: "Apex emerges when the work is threatened: solitary focus, precision, and protective intensity around the craft."
        },
        active: {
            speciesSlug: "dolphin",
            speciesName: "Dolphin",
            rationale: "Active is communication as play — rapport, timing, and emotional intelligence with a massive audience."
        }
    },
    {
        id: "david-attenborough",
        name: "David Attenborough",
        roleLabel: "Naturalist & storyteller",
        summary: "Quiet observation at the root, memory and stewardship under gravity, and a clarifying public voice in the present.",
        origin: {
            speciesSlug: "barn-owl",
            speciesName: "Barn Owl",
            rationale: "Origin is pattern-notice in low light — patient observation before conclusion."
        },
        apex: {
            speciesSlug: "elephant",
            speciesName: "Elephant",
            rationale: "Apex is stewardship weight — memory, responsibility, and moral gravity when speaking for the living world."
        },
        active: {
            speciesSlug: "bald-eagle",
            speciesName: "Bald Eagle",
            rationale: "Active is the clarifying voice — distilling complexity into something the public can carry and act on."
        }
    },
    {
        id: "serena-williams",
        name: "Serena Williams",
        roleLabel: "Competitor & champion",
        summary: "Competitive power as baseline, dominance in decisive moments, and pack loyalty in the current life chapter.",
        origin: {
            speciesSlug: "tiger",
            speciesName: "Tiger",
            rationale: "Origin is competitive baseline — explosive capability held with discipline."
        },
        apex: {
            speciesSlug: "lion",
            speciesName: "Lion",
            rationale: "Apex is championship pressure — claiming space, finishing, and owning the decisive moment."
        },
        active: {
            speciesSlug: "wolf",
            speciesName: "Wolf",
            rationale: "Active reflects family and team loyalty — building beyond solo competition into shared legacy."
        }
    },
    {
        id: "mrbeast",
        name: "MrBeast",
        roleLabel: "Scale creator",
        summary: "Pack-scale collaboration at the root, massive orchestration under pressure, and generosity as a communication loop today.",
        origin: {
            speciesSlug: "wolf",
            speciesName: "Wolf",
            rationale: "Origin is coalition-building — turning collaborators into a coordinated pack around outsized goals."
        },
        apex: {
            speciesSlug: "gorilla",
            speciesName: "Gorilla",
            rationale: "Apex is project gravity — holding complex production, protection, and leadership when stakes are enormous."
        },
        active: {
            speciesSlug: "dolphin",
            speciesName: "Dolphin",
            rationale: "Active is generosity as signal — using giving and spectacle as the main audience communication language."
        }
    },
    {
        id: "zendaya",
        name: "Zendaya",
        roleLabel: "Poised performer",
        summary: "Aesthetic control at the root, protective boundaries under scrutiny, and selective timing in the public eye.",
        origin: {
            speciesSlug: "indian-peafowl",
            speciesName: "Indian Peafowl",
            rationale: "Origin is poise and presentation — making composure look effortless while staying intentional."
        },
        apex: {
            speciesSlug: "wolf",
            speciesName: "Wolf",
            rationale: "Apex is boundary protection — calm until the perimeter of craft or privacy is threatened."
        },
        active: {
            speciesSlug: "barn-owl",
            speciesName: "Barn Owl",
            rationale: "Active is selective visibility — timing when to speak, when to disappear, and when to let the work land."
        }
    },
    {
        id: "steve-jobs",
        name: "Steve Jobs",
        roleLabel: "Product visionary",
        summary: "Vision from altitude at the root, ruthless product intensity under pressure, and multi-domain design thinking in motion.",
        origin: {
            speciesSlug: "bald-eagle",
            speciesName: "Bald Eagle",
            rationale: "Origin is long-range vision — seeing the product story before the market catches up."
        },
        apex: {
            speciesSlug: "tiger",
            speciesName: "Tiger",
            rationale: "Apex is product intensity — narrowing, cutting, and demanding coherence when quality is on the line."
        },
        active: {
            speciesSlug: "octopus",
            speciesName: "Octopus",
            rationale: "Active is cross-domain adaptation — hardware, software, narrative, and experience treated as one system."
        }
    }
];

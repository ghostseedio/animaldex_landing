export type JournalSection = {
    title: string;
    paragraphs: string[];
};

export type JournalPost = {
    slug: string;
    title: string;
    description: string;
    publishedAt: string;
    updatedAt: string;
    readingMinutes: number;
    pillar: "identification" | "learning" | "collecting" | "family" | "travel" | "photography";
    audiences: string[];
    tags: string[];
    searchIntents: string[];
    sections: JournalSection[];
};

const journalPostsData: JournalPost[] = [
    {
        slug: "how-to-identify-animals-from-a-photo",
        title: "How to identify animals from a photo without losing the story behind the sighting",
        description: "A practical guide to AI animal analysis, habitat clues, body shape, behaviour, and respectful observation for anyone trying to identify animals from a photo.",
        publishedAt: "2026-03-16",
        updatedAt: "2026-04-08",
        readingMinutes: 6,
        pillar: "identification",
        audiences: ["Wildlife learners", "Animal lovers", "Photographers", "Travelers"],
        tags: ["Animal identification", "AI animal scanner", "Wildlife photography", "Field guide"],
        searchIntents: ["animal identification app", "AI animal scanner", "identify animals from a photo", "AI animal analysis"],
        sections: [
            {
                title: "Start with what the photo already tells you",
                paragraphs: [
                    "A good animal ID usually starts before the software does. Look at the silhouette, overall size, dominant colours, markings, tail shape, leg length, ear position, beak shape, horn pattern, or fin outline. Those cues often narrow the field faster than a name list.",
                    "When people struggle to identify wildlife from a photo, it is usually because they jump straight to the exact species too early. A more reliable first step is deciding what family or type of animal you are looking at. Once you know bird, antelope, cat, lizard, fish, or dog breed territory, the rest gets easier."
                ]
            },
            {
                title: "Use habitat, location, and behaviour as part of the ID",
                paragraphs: [
                    "The same animal can look different in poor light, at distance, or at different ages. Habitat context helps recover that missing information. Was the animal in woodland, open grass, wetland, reef, farm, suburban garden, zoo enclosure, or on safari? Those details matter.",
                    "Behaviour is another strong clue. A gliding raptor, a browsing herbivore, a wading bird, or a nocturnal mammal caught in low light each points you in a different direction. Strong animal identification apps should treat the moment around the sighting as useful evidence, not background noise."
                ]
            },
            {
                title: "Species, breeds, juveniles, and lookalikes",
                paragraphs: [
                    "One reason animal identification is fun is that real animals refuse to fit perfect textbook examples. Juveniles can look softer, duller, or less distinctive than adults. Some species have regional colour differences. Domestic breeds bring another layer of variation.",
                    "That is why an AI animal scanner should help with possibilities, not just dump one answer. The best experience explains lookalikes, confidence cues, and what to inspect next so the user learns something even when the first guess is not perfect."
                ]
            },
            {
                title: "What useful AI animal analysis should give you",
                paragraphs: [
                    "Useful AI analysis does more than label the animal. It should help you keep the sighting, understand why the ID makes sense, and turn the moment into something worth revisiting. Species clues, habitat notes, rarity context, field-guide facts, and clean collection metadata all add value.",
                    "That is where AnimalDex is aiming to feel different from a plain utility app. The goal is not just quick recognition. It is helping people scan real animals, learn more about them, and keep those encounters in a collectible journal that makes discovery feel rewarding."
                ]
            },
            {
                title: "Keep the sighting respectful",
                paragraphs: [
                    "Getting the answer is never worth stressing the animal. Avoid crowding, baiting, touching, cornering, or chasing wildlife for a better photo. Curiosity is better when it comes with distance, patience, and habitat awareness.",
                    "That mindset improves identification too. Calm observation gives you clearer behaviour, cleaner photos, and better notes. Respectful wildlife learning is not just ethically better. It also produces better sightings."
                ]
            }
        ]
    },
    {
        slug: "zoo-safari-and-family-animal-spotting-guide",
        title: "Zoo, safari, or nature walk: a family-friendly way to make animal spotting more fun",
        description: "How to turn zoo visits, safari drives, and everyday nature walks into playful, educational animal discovery without making the experience feel like homework.",
        publishedAt: "2026-03-22",
        updatedAt: "2026-04-05",
        readingMinutes: 5,
        pillar: "family",
        audiences: ["Families", "Travelers", "Animal lovers", "Wildlife learners"],
        tags: ["Family animal learning", "Zoo animal app", "Safari animal app", "Nature walk"],
        searchIntents: ["family-friendly animal learning app", "zoo animal app", "safari animal app", "educational animal app"],
        sections: [
            {
                title: "Start with curiosity, not a lecture",
                paragraphs: [
                    "Families usually get more out of animal learning when it feels like a shared game instead of a lesson plan. Rather than trying to teach everything at once, look for one or two memorable details: the longest neck, the quietest paws, the strangest eye shape, or the animal with the most surprising habitat.",
                    "That approach works in zoos, on safari, and even during local walks. People remember what they noticed for themselves. A family-friendly animal app should turn that curiosity into discovery instead of flattening it into a quiz."
                ]
            },
            {
                title: "Each outing teaches a different kind of animal awareness",
                paragraphs: [
                    "Zoos are great for comparing species side by side and learning visible traits. Safari trips make habitat, behaviour, and distance matter much more. Nature walks train people to notice smaller clues: tracks, movement, sound, camouflage, and the fact that many animals are easy to miss until you slow down.",
                    "That variety is useful. It helps kids and adults understand that animal spotting is not just about naming what is in front of you. It is about learning how animals live and why certain places suit them."
                ]
            },
            {
                title: "Simple collection loops make the learning stick",
                paragraphs: [
                    "A collectible journal gives outings structure without turning them into chores. You can try completing habitat sets, spotting five mammals before lunch, logging one surprising fact per sighting, or comparing two lookalike species before the day ends.",
                    "This is why collection mechanics work so well for animal learning. They reward attention. A sighting becomes more memorable when it enters an album, contributes to a set, or unlocks a better understanding of what makes that species special."
                ]
            },
            {
                title: "Respect for animals should feel natural, not preachy",
                paragraphs: [
                    "The best wildlife habits are simple. Keep a calm distance. Do not tap glass, shout, chase, crowd, or treat animals like props. Notice body language. Let the animal's comfort set the limit.",
                    "When an app makes respectful observation part of the experience, it helps children and adults absorb a healthier relationship with wildlife. Curiosity over cruelty is not a slogan. It is a better way to spot, learn, and remember."
                ]
            },
            {
                title: "Where AnimalDex fits",
                paragraphs: [
                    "AnimalDex is designed to make those outings feel premium and playful at the same time. You can scan, collect, compare, revisit, and learn from real sightings while still getting the satisfaction of sets, progress, and card-like rewards.",
                    "That combination is useful for parents, travelers, zoo visitors, safari guests, and anyone who wants animal education to feel alive instead of textbook-stiff."
                ]
            }
        ]
    },
    {
        slug: "why-real-animal-collecting-feels-so-good",
        title: "Why real-animal collecting hits differently for card fans and creature collectors",
        description: "Why collectors who love creature games, card albums, and Top Trumps style progression often find real-animal collecting unexpectedly satisfying.",
        publishedAt: "2026-03-11",
        updatedAt: "2026-03-28",
        readingMinutes: 5,
        pillar: "collecting",
        audiences: ["Collectors", "Competitive players", "Animal lovers", "Wildlife learners"],
        tags: ["Animal card app", "Species collecting game", "Collector psychology", "Top Trumps-like animal app"],
        searchIntents: ["animal card collecting app", "species collecting game", "Pokemon-like animal app", "Top Trumps-like animal app"],
        sections: [
            {
                title: "Real animals already have rarity, variety, and surprise built in",
                paragraphs: [
                    "Collectors love variation. Real animals provide that naturally. Some species are common, some are elusive, some look dramatic, some are subtle, and many become more interesting the longer you study them. You do not need fantasy lore to make collecting feel rich.",
                    "That is one reason a wildlife collection app can be so compelling. The world already contains habitats, lookalikes, regional sets, seasonal changes, and memorable one-off sightings. The collection loop is grounded in reality, which makes each card feel earned."
                ]
            },
            {
                title: "The best collection memories come from where you found them",
                paragraphs: [
                    "A real-world sighting carries context. You remember the zoo visit, the park at sunrise, the surprise bird on a city street, the safari drive, the aquarium tunnel, or the family trip where everybody finally spotted the animal together.",
                    "That gives a collectible animal card app something fantasy systems cannot copy exactly. The entry is tied to a place, a moment, and a personal memory. That makes collections feel lived-in instead of purely accumulated."
                ]
            },
            {
                title: "Stats and battles can add fun without replacing learning",
                paragraphs: [
                    "Collectors who also enjoy games often want more than a static archive. Progress, grading, missions, trades, and even battles can make a species collection feel alive. The key is making those systems deepen interest instead of reducing animals to disposable numbers.",
                    "When stats and rarity connect back to real traits, habitats, or field-guide context, the loop becomes more satisfying. You still get progression, but you also remember more about the species itself."
                ]
            },
            {
                title: "AnimalDex is trying to bridge both sides",
                paragraphs: [
                    "AnimalDex sits between wildlife learning and collectible play. It is for people who enjoy the energy of creature collecting, card albums, and set completion but want that energy aimed at real animals, real sightings, and real curiosity.",
                    "That is why the product pitch needs both halves. It is a premium collectible experience, but it is also an animal-learning app built around respectful observation and a growing field guide."
                ]
            }
        ]
    },
    {
        slug: "wildlife-photography-without-disturbing-animals",
        title: "Wildlife photography for beginners: better animal photos without stressing wildlife",
        description: "A beginner-friendly guide to cleaner animal photos, better species clues, and more respectful wildlife photography habits for travel, safaris, and everyday spotting.",
        publishedAt: "2026-03-04",
        updatedAt: "2026-03-21",
        readingMinutes: 6,
        pillar: "photography",
        audiences: ["Photographers", "Travelers", "Wildlife learners", "Animal lovers"],
        tags: ["Wildlife photography", "Respectful observation", "Travel spotting", "Animal discovery"],
        searchIntents: ["wildlife photography app", "wildlife photography tips", "safari animal app", "respectful wildlife observation"],
        sections: [
            {
                title: "The first rule is simple: the animal comes first",
                paragraphs: [
                    "A better wildlife photo is never worth a worse wildlife experience for the animal. Do not crowd nests, block escape routes, separate parents from young, bait animals toward the lens, or keep moving closer after the animal has already noticed you.",
                    "Beginners sometimes think respectful photography means missing the shot. Usually the opposite is true. Calm distance, stillness, and patience produce more natural behaviour and better images."
                ]
            },
            {
                title: "Good animal photos are usually built on shape and context",
                paragraphs: [
                    "Sharp detail is great, but identification often comes from the whole scene. Body shape, gait, beak or muzzle profile, tail use, horn direction, wing posture, or the kind of landscape around the animal can matter more than perfect texture.",
                    "That is why many strong animal photos for identification are not extreme close-ups. They show enough of the environment to make the sighting make sense."
                ]
            },
            {
                title: "Work with light, patience, and repeat sightings",
                paragraphs: [
                    "Early and late light usually helps colours and contrast. More important, it encourages you to slow down. If you wait instead of forcing the moment, animals often turn, pause, feed, or move into a cleaner angle on their own.",
                    "Repeat sightings are valuable too. One image might help with the head pattern, another with movement, and another with size relative to the environment. A journaled approach to wildlife photography lets each sighting add evidence."
                ]
            },
            {
                title: "Logging the moment after the photo makes you a better observer",
                paragraphs: [
                    "The photo is only part of the record. Note where you were, what the habitat looked like, what the animal was doing, and what first caught your eye. Those details help with identification later and make the sighting more meaningful.",
                    "This is where a wildlife photography app and animal journal can work together. The best experience does not just store pictures. It helps turn them into learning, comparison, and future discovery."
                ]
            },
            {
                title: "Why this matters for AnimalDex",
                paragraphs: [
                    "AnimalDex should feel useful to photographers because photography is often the bridge between noticing and understanding. A strong scan, clean collection card, and deeper field-guide follow-up can turn an ordinary travel photo into a memorable animal entry.",
                    "That is valuable whether you are photographing birds near home, mammals on safari, reptiles in a zoo, or unexpected species during a family trip."
                ]
            }
        ]
    }
];

export const journalPosts: JournalPost[] = [...journalPostsData].sort((a, b) => {
    if (a.updatedAt === b.updatedAt) {
        return b.publishedAt.localeCompare(a.publishedAt);
    }

    return b.updatedAt.localeCompare(a.updatedAt);
});

export function getJournalPost(slug: string) {
    return journalPosts.find((post) => post.slug === slug);
}

export function getJournalLastUpdatedAt() {
    return journalPosts[0]?.updatedAt;
}

export function getJournalAudienceCoverage() {
    return Array.from(new Set(journalPosts.flatMap((post) => post.audiences))).sort();
}

export function getJournalSearchCoverage() {
    return Array.from(new Set(journalPosts.flatMap((post) => post.searchIntents))).sort();
}

export function getRelatedJournalPosts(slug: string, limit = 3) {
    const currentPost = getJournalPost(slug);

    if (!currentPost) {
        return [];
    }

    return journalPosts
        .filter((post) => post.slug !== slug)
        .map((post) => {
            const sharedTags = post.tags.filter((tag) => currentPost.tags.includes(tag)).length;
            const sharedIntents = post.searchIntents.filter((intent) => currentPost.searchIntents.includes(intent)).length;
            const sharedAudiences = post.audiences.filter((audience) => currentPost.audiences.includes(audience)).length;
            const samePillar = post.pillar === currentPost.pillar ? 1 : 0;

            return {
                post,
                score: sharedTags * 3 + sharedIntents * 2 + sharedAudiences * 2 + samePillar
            };
        })
        .sort((a, b) => b.score - a.score || b.post.updatedAt.localeCompare(a.post.updatedAt))
        .slice(0, limit)
        .map(({post}) => post);
}

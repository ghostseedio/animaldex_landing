/**
 * Client-safe port of the app's `UniversalSearchSuggestionBuilder`.
 *
 * The remote `suggest` mode takes ~3s, so — exactly like the iOS catalog tab —
 * these local suggestions paint instantly and the remote ones merge in behind
 * them. Pools and subtitles are kept in sync with UniversalSearchModels.swift.
 */

export type LocalSuggestion = {
    id: string;
    title: string;
    subtitle: string;
};

export type SuggestionCatalogEntry = {
    slug: string;
    name: string;
    animalDexNumber: number | null;
};

const STAT_PRESET_TITLES: Array<{key: string; title: string}> = [
    {key: "fastest", title: "Fastest animals"},
    {key: "slowest", title: "Slowest animals"},
    {key: "rarest", title: "Rarest animals"},
    {key: "strongest", title: "Strongest animals"},
    {key: "smartest", title: "Smartest animals"},
    {key: "biggest", title: "Biggest animals"},
    {key: "smallest", title: "Smallest animals"},
    {key: "longestLived", title: "Longest-lived animals"},
    {key: "shortestLived", title: "Shortest-lived animals"},
    {key: "mostCaptures", title: "Most captured animals"}
];

const COLD_START_QUERIES: Array<{title: string; subtitle: string}> = [
    {title: "Fastest animals", subtitle: "Leaderboard"},
    {title: "Slowest animals", subtitle: "Leaderboard"},
    {title: "Rarest animals", subtitle: "Leaderboard"},
    {title: "Strongest animals", subtitle: "Leaderboard"},
    {title: "Smartest animals", subtitle: "Leaderboard"},
    {title: "Biggest animals", subtitle: "Leaderboard"},
    {title: "Smallest animals", subtitle: "Leaderboard"},
    {title: "Animals that can teach me success", subtitle: "Lesson"},
    {title: "Tiniest animals", subtitle: "Leaderboard"},
    {title: "Endangered animals near me", subtitle: "Near you"},
    {title: "Rare animals near me", subtitle: "Near you"},
    {title: "Which animal can teach me about love", subtitle: "Lesson"},
    {title: "Which animal can teach me about courage", subtitle: "Lesson"},
    {title: "Which animal can teach me about patience", subtitle: "Lesson"},
    {title: "What lesson does the tiger teach us", subtitle: "Lesson"},
    {title: "What does a frog symbolise", subtitle: "Symbolism"},
    {title: "What does it mean if I dreamed about a cat", subtitle: "Dream"},
    {title: "Which zoo has polar bears", subtitle: "Zoos"},
    {title: "What animals does Jakarta Zoo have", subtitle: "Zoos"},
    {title: "Best zoo near me", subtitle: "Zoos"},
    {title: "Best zoo in Japan", subtitle: "Zoos"},
    {title: "Zoos in Tokyo", subtitle: "Zoos"},
    {title: "Dog ancient symbolism", subtitle: "Symbolism"},
    {title: "Cat mythology", subtitle: "Mythology"},
    {title: "Safari animals", subtitle: "Safari"},
    {title: "Aquarium animals", subtitle: "Aquarium"},
    {title: "Monkeys", subtitle: "Species group"},
    {title: "Sharks", subtitle: "Species group"},
    {title: "Birds", subtitle: "Species group"},
    {title: "Apes", subtitle: "Species group"},
    {title: "Snakes", subtitle: "Species group"},
    {title: "Who would win tiger or lion", subtitle: "Compare"},
    {title: "Who would win shark or crocodile", subtitle: "Compare"},
    {title: "Eagle vs hawk", subtitle: "Compare"},
    {title: "Wolf vs coyote", subtitle: "Compare"},
    {title: "Animals near me", subtitle: "Near you"},
    {title: "Zoo animals", subtitle: "Places"}
];

const ANIMAL_PROMPT_TEMPLATES: Array<{id: string; subtitle: string; make: (name: string) => string}> = [
    {id: "open", subtitle: "Species", make: (name) => name},
    {id: "lesson", subtitle: "Lesson", make: (name) => `what lesson does the ${name} teach us`},
    {id: "symbol", subtitle: "Symbolism", make: (name) => `what does a ${name} symbolise`},
    {id: "mythology", subtitle: "Mythology", make: (name) => `${name} mythology`},
    {id: "dream", subtitle: "Dream", make: (name) => `what does it mean if i dreamed about a ${name}`},
    {id: "diet", subtitle: "Diet", make: (name) => `${name} diet`},
    {id: "lifespan", subtitle: "Lifespan", make: (name) => `${name} lifespan`},
    {id: "habitat", subtitle: "Habitat", make: (name) => `${name} habitat`},
    {id: "where-find", subtitle: "Where to find", make: (name) => `where to find ${name}`},
    {id: "predators", subtitle: "Predators", make: (name) => `${name} predators`},
    {id: "facts", subtitle: "Facts", make: (name) => `${name} facts`},
    {id: "near-me", subtitle: "Near me", make: (name) => `${name} near me`},
    {id: "endangered", subtitle: "Conservation", make: (name) => `endangered ${name}`},
    {id: "zoo-has", subtitle: "Zoos", make: (name) => `which zoo has ${name}`}
];

export function normalizeSuggestionQuery(raw: string) {
    return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Stable rotation so the cold-start pool varies without reshuffling per keystroke. */
function suggestionSeed(normalized: string) {
    if (!normalized) return Math.floor(Date.now() / (1000 * 60 * 30));
    let hash = 0;
    for (let index = 0; index < normalized.length; index += 1) {
        hash = (hash * 31 + normalized.charCodeAt(index)) % 100000;
    }
    return hash;
}

function rotate<T>(items: T[], seed: number) {
    if (!items.length) return items;
    const offset = seed % items.length;
    return [...items.slice(offset), ...items.slice(0, offset)];
}

export function buildLocalSuggestions(
    query: string,
    catalogEntries: SuggestionCatalogEntry[],
    limit = 18
): LocalSuggestion[] {
    const normalized = normalizeSuggestionQuery(query);
    const seed = suggestionSeed(normalized);
    const suggestions: LocalSuggestion[] = [];
    const seen = new Set<string>();

    const push = (item: LocalSuggestion) => {
        const key = normalizeSuggestionQuery(item.title);
        if (!key || seen.has(key)) return;
        seen.add(key);
        suggestions.push(item);
    };

    if (!normalized) {
        for (const item of rotate(COLD_START_QUERIES, seed)) {
            push({id: `preset:${item.title}`, title: item.title, subtitle: item.subtitle});
            if (suggestions.length >= limit) return suggestions;
        }
        return suggestions;
    }

    for (const preset of STAT_PRESET_TITLES) {
        const title = preset.title.toLowerCase();
        if (title.includes(normalized) || preset.key.toLowerCase().includes(normalized) || normalized.includes(preset.key.toLowerCase())) {
            push({id: `preset:${preset.key}`, title: preset.title, subtitle: "Leaderboard"});
        }
    }

    for (const item of COLD_START_QUERIES) {
        if (normalizeSuggestionQuery(item.title).includes(normalized)) {
            push({id: `preset:${item.title}`, title: item.title, subtitle: item.subtitle});
        }
    }

    // Species matches, each expanded through a rotating slice of prompt templates.
    const matches = catalogEntries
        .map((entry) => {
            const name = normalizeSuggestionQuery(entry.name);
            if (name === normalized) return {entry, score: 100};
            if (name.startsWith(normalized)) return {entry, score: 80};
            if (name.includes(normalized)) return {entry, score: 55};
            if (entry.slug.replace(/-/g, " ").includes(normalized)) return {entry, score: 35};
            return null;
        })
        .filter((item): item is {entry: SuggestionCatalogEntry; score: number} => item !== null)
        .sort((left, right) => right.score - left.score || left.entry.name.localeCompare(right.entry.name))
        .slice(0, 6);

    const templates = rotate(ANIMAL_PROMPT_TEMPLATES, seed);

    matches.forEach((match, index) => {
        const name = match.entry.name;
        push({id: `species:${match.entry.slug}`, title: name, subtitle: "Species"});
        const perAnimal = index === 0 ? 4 : 2;
        for (const template of templates.slice(0, perAnimal)) {
            if (template.id === "open") continue;
            push({
                id: `${template.id}:${match.entry.slug}`,
                title: template.make(name.toLowerCase()),
                subtitle: template.subtitle
            });
        }
    });

    // "tiger vs " style comparison completion.
    if (/\bvs\b|\bversus\b|who would win/.test(normalized) && matches.length) {
        push({
            id: `compare:${matches[0].entry.slug}`,
            title: `who would win ${matches[0].entry.name.toLowerCase()}`,
            subtitle: "Compare"
        });
    }

    return suggestions.slice(0, limit);
}

export const COLD_START_SUGGESTIONS = COLD_START_QUERIES;

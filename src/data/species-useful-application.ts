type LessonTheme = {
    patterns: RegExp[];
    lessons: string[];
};

const themeRules: LessonTheme[] = [
    {
        patterns: [/\b(pack|team\w*|together|group\w*|colony|hive|herd|flock|famil\w*|pod|cooperat\w*|shared)\b/],
        lessons: [
            "In human life, that means shared effort can carry farther than solo force.",
            "Its lesson for us is clear: the right allies can multiply what one person can do alone.",
            "For us, the message is simple: strong communities make hard tasks lighter and safer.",
            "In human life, this reminds us that trust and coordination often beat raw individual power."
        ]
    },
    {
        patterns: [/\b(wait\w*|patient\w*|perfect second|right moment|timing|ambush|stands very still)\b/],
        lessons: [
            "In human life, that means waiting for the right moment can beat forcing the wrong one.",
            "Its lesson for us is clear: timing matters just as much as effort.",
            "For us, the message is simple: patience turns preparation into real advantage.",
            "In human life, this reminds us that not every win comes from moving first."
        ]
    },
    {
        patterns: [/\b(change\w*|adapt\w*|flexib\w*|switch\w*|different|many kinds|more than one|three places|three realms|two worlds|boundary|shape\w*|color\w*|curiosity)\b/],
        lessons: [
            "In human life, that means flexibility keeps us effective when the world changes around us.",
            "Its lesson for us is clear: adapting well is often stronger than insisting on one fixed way.",
            "For us, the message is simple: people who can adjust without losing themselves stay hard to stop.",
            "In human life, this reminds us that range and flexibility can open doors rigid strength cannot."
        ]
    },
    {
        patterns: [/\b(warn\w*|shield\w*|armor\w*|spik\w*|quill\w*|curl\w*|ball|defen\w*|protect\w*|danger|do not touch me|warning sign)\b/],
        lessons: [
            "In human life, that means good boundaries can prevent problems before they become fights.",
            "Its lesson for us is clear: protection is strongest when it is visible early and used well.",
            "For us, the message is simple: a clear boundary is often more powerful than a late reaction.",
            "In human life, this reminds us that safety grows when we show people where the line is."
        ]
    },
    {
        patterns: [/\b(journey\w*|travel\w*|distance|migrat\w*|keeps going|long|endur\w*|harsh|frozen|desert|windy|cross\w*)\b/],
        lessons: [
            "In human life, that means steady effort can outrun dramatic bursts that do not last.",
            "Its lesson for us is clear: endurance wins when the road is longer than expected.",
            "For us, the message is simple: consistency can carry us through places where motivation alone cannot.",
            "In human life, this reminds us that resilience is often built one repeatable step at a time."
        ]
    },
    {
        patterns: [/\b(hear\w*|listen\w*|look\w*|watch\w*|eyes|spot\w*|scan\w*|vision|echo\w*|map|signal\w*)\b/],
        lessons: [
            "In human life, that means paying close attention can reveal options other people miss.",
            "Its lesson for us is clear: awareness is its own kind of power.",
            "For us, the message is simple: the better we read a situation, the less force we need later.",
            "In human life, this reminds us that careful observation often makes the next move obvious."
        ]
    },
    {
        patterns: [/\b(quiet\w*|silent\w*|calm\w*|gent\w*|blend\w*|hidden|hide\w*|camouflage|disappear\w*|peaceful)\b/],
        lessons: [
            "In human life, that means we do not have to be loud to be powerful.",
            "Its lesson for us is clear: calm presence often carries more power than noise.",
            "For us, the message is simple: quiet focus can move farther than constant performance.",
            "In human life, this reminds us that composure can make us both clearer and harder to shake."
        ]
    },
    {
        patterns: [/\b(sleep\w*|slow\w*|rest\w*|heal\w*|grow back|regrow\w*|prepar\w*|brief|gent\w*)\b/],
        lessons: [
            "In human life, that means rest and recovery are part of staying effective, not a failure of effort.",
            "Its lesson for us is clear: pace matters, and burning out is not the same as being strong.",
            "For us, the message is simple: taking care of energy is often what makes long-term progress possible.",
            "In human life, this reminds us that healing and patience can be productive forms of strength."
        ]
    },
    {
        patterns: [/\b(tool\w*|problem\w*|solv\w*|special\w*|exact|perfectly matched|one hard thing|focus\w*|built for)\b/],
        lessons: [
            "In human life, that means mastering one real strength can matter more than trying to do everything.",
            "Its lesson for us is clear: focus becomes powerful when it is practiced deeply.",
            "For us, the message is simple: the right skill, sharpened well, can change an entire situation.",
            "In human life, this reminds us that clear specialization can create unusual leverage."
        ]
    }
];

const fallbackLessons = [
    "In human life, that means our best results often come from understanding what we are built for and using it well.",
    "Its lesson for us is clear: when our strengths match the situation, life gets lighter and more effective.",
    "For us, the message is simple: progress comes faster when we lean into what works naturally and use it with intention.",
    "In human life, this reminds us that self-knowledge turns ability into direction."
];

function hashValue(value: string) {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }

    return hash;
}

function normalizeStory(story: string) {
    const trimmed = story.trim();

    if (!trimmed) {
        return trimmed;
    }

    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function buildUsefulApplicationSentence(slug: string, subtitleStory: string) {
    const story = subtitleStory.toLowerCase();

    for (const rule of themeRules) {
        if (rule.patterns.some((pattern) => pattern.test(story))) {
            return rule.lessons[hashValue(slug) % rule.lessons.length];
        }
    }

    return fallbackLessons[hashValue(slug) % fallbackLessons.length];
}

export function appendUsefulApplicationSentence(slug: string, subtitleStory: string) {
    const normalizedStory = normalizeStory(subtitleStory);
    const lesson = buildUsefulApplicationSentence(slug, normalizedStory);

    if (!normalizedStory) {
        return lesson;
    }

    return `${normalizedStory} ${lesson}`;
}

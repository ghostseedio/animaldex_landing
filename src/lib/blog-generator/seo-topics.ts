import type {TopicIdea} from "@/lib/blog-generator/pipeline";

// Search-led articles for the blog auto-generate's second daily run (the first
// stays on news). The cluster around AnimalDex's "talk to any animal" feature
// first: big searches ("dog translator", "cat translator", "can AI talk to
// animals") that the honest answer serves better than the translator apps do.
// Every brief keeps the line /talk-to-animals draws: no app decodes what an
// individual animal is saying; AnimalDex's AI answers *as the species*, from
// its real biology. Topics are written once each, in order (done = a run logged
// with detail.seoTopic and a published or draft result).

export type SeoTopic = {id: string; idea: TopicIdea};

const TALK_LINE = "Close by explaining, honestly, what AnimalDex's Talk to Any Animal feature is (an AI that answers as the species, grounded in its real biology and behaviour, not a translator of one animal's sounds), and link to /talk-to-animals and the relevant /animals page.";

function topic(id: string, primaryKeyword: string, title: string, angle: string, hook: string, format: string): SeoTopic {
    return {id, idea: {title, angle: `${angle} ${TALK_LINE}`, hook, primaryKeyword, format, whyNow: `Search demand for "${primaryKeyword}" and AnimalDex's talk-to-animals feature`, sources: []}};
}

export const SEO_TOPICS: SeoTopic[] = [
    topic("dog-translator", "dog translator", "Dog Translator: What Your Dog Is Really Saying",
        "Decode barks, whines, growls, howls, sighs, tail height and wag direction, ears, play bows and whale eye from canine behaviour research (pitch, rhythm, context). A scannable decoder table, then why no translator app can literally translate a bark.",
        "A wag to the right and a wag to the left mean different things, and dogs can tell.", "guide"),
    topic("cat-translator", "cat translator", "Cat Translator: What Every Meow, Purr and Trill Means",
        "Adult cats meow mostly at humans, not at each other: decode meows, chirps and trills, purrs (including stress purrs), hisses, the slow blink and tail and ear positions from feline behaviour research, with a decoder table.",
        "Adult cats barely meow at each other. That voice is for you.", "guide"),
    topic("can-ai-talk-to-animals", "can AI talk to animals", "Can AI Talk to Animals? What Is Real in 2026",
        "What the serious projects have actually found: Project CETI's sperm whale codas, the Earth Species Project, studies of Egyptian fruit bat calls, the elephant 'names' finding, marmoset name calls. Separate what is decoded, what is guessed and what is hype.",
        "Scientists can now tell which bat is arguing with which, and about what. A full conversation is still science fiction.", "explainer"),
    topic("how-to-talk-to-animals", "how to talk to animals", "How to Talk to Animals: 9 Ways That Actually Work",
        "Practical, science-backed ways people communicate with animals: tone and pitch, slow blinks with cats, calming signals with dogs, approaching horses, birds and wildlife without alarm. What animals read in us.",
        "Most animals ignore your words and read your pitch, posture and pace.", "listicle"),
    topic("do-animals-have-language", "do animals have language", "Do Animals Have Language? The Evidence, Species by Species",
        "Prairie dog alarm calls that describe predators, vervet monkey alarm calls, honey bee waggle dances, Japanese tit call syntax, chimpanzee gestures, dolphin whistles: which meet the tests linguists use for language and which do not.",
        "A prairie dog's alarm call can say what colour shirt the human was wearing.", "explainer"),
    topic("dolphin-language", "dolphin language", "Dolphin Language: Do Dolphins Really Have Names?",
        "Signature whistles as names, how dolphins call each other, what research does and does not show about a dolphin 'language', and how close AI is to decoding it.",
        "Each dolphin invents its own name whistle, and the others use it to call it.", "explainer"),
    topic("elephant-communication", "elephant communication", "Elephant Communication: Rumbles, Infrasound and Names",
        "Infrasound rumbles that travel kilometres, seismic listening through the feet, and the 2024 finding that African elephants address each other with name-like calls.",
        "Elephants call each other by name, and they can hear it through the ground.", "explainer"),
    topic("parrots-understand-words", "do parrots understand what they say", "Do Parrots Understand What They Say? Alex Says Yes",
        "Irene Pepperberg's work with Alex the African grey (colours, shapes, numbers, 'none'), what mimicry is, what comprehension is, and how wild parrots use their voices.",
        "Alex the parrot understood zero before many toddlers do.", "explainer"),
    topic("whale-song-meaning", "whale song meaning", "Whale Song Meaning: What Humpbacks and Sperm Whales Say",
        "Humpback songs that spread across oceans like hit songs, sperm whale codas and clans, and what AI analysis (Project CETI) has found so far.",
        "A humpback song can spread across an entire ocean basin in two years, like a pop hit.", "explainer"),
    topic("bird-song-meaning", "what are birds saying", "What Are Birds Saying? Songs, Calls and Alarms Decoded",
        "Songs versus calls, territory and mating songs, alarm calls other species understand, and why the dawn chorus happens. A decoder for common backyard sounds.",
        "Other birds and even squirrels understand a chickadee's alarm call.", "guide"),
    topic("horse-body-language", "horse body language", "Horse Body Language: How to Read and Talk to Horses",
        "Ears, eyes, nostrils, tail, posture and sounds (nicker, whinny, snort, squeal), what they mean, and how to approach and talk to a horse calmly.",
        "Horses can read human facial expressions and remember them.", "guide"),
    topic("animal-translator-apps", "animal translator app", "Animal Translator Apps: Do Any Actually Work?",
        "An honest look at pet and animal translator apps: what they claim, what is technically possible today, the research tools that are real, and what a useful app can do instead.",
        "No app can tell you what your cat just said. Here is what one can do.", "myth-buster"),
    topic("bat-communication", "bat communication", "Bats Argue About Food and Space, and Scientists Can Tell",
        "Egyptian fruit bat studies that decoded who is arguing with whom and about what, echolocation versus social calls, and what it means for animal communication research.",
        "Fruit bats squabble constantly, and researchers can now tell what about.", "explainer"),
    topic("why-do-dogs-bark", "why do dogs bark", "Why Do Dogs Bark? 8 Barks and What Each One Means",
        "Alert, demand, play, frustration, fear, boredom, attention and reactive barking: how pitch, pace and context tell them apart, and what to do about each.",
        "A low, slow bark and a high, fast one are opposite messages.", "listicle"),
    topic("why-do-cats-purr", "why do cats purr", "Why Do Cats Purr? It Is Not Always Happiness",
        "How purring works, purring for comfort, healing and soliciting (the cry hidden in the solicitation purr), and when a purr means pain.",
        "Some cats hide a baby-like cry inside their purr to get fed.", "explainer"),
    topic("animals-that-talk", "animals that can talk", "Animals That Can Talk: 10 Species That Use Human Words",
        "Parrots, mynas, crows, Koshik the elephant, Hoover the seal, Noc the beluga, Kanzi the bonobo with lexigrams: who imitates, who understands, and who just learned the sounds.",
        "An elephant in South Korea learned to say five Korean words with his trunk.", "listicle")
];

/** The next topic not yet written, in list order. */
export function nextSeoTopic(done: ReadonlySet<string>): SeoTopic | null {
    return SEO_TOPICS.find((entry) => !done.has(entry.id)) ?? null;
}

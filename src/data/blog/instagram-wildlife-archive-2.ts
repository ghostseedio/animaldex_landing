import {contentThumb} from "@/data/content-thumbnails";
import type {BlogPost} from "@/data/blog/types";

function post(input: Omit<BlogPost, "featuredImage" | "author" | "publishedAt" | "updatedAt" | "speciesSlugs"> & {featuredAlt: string}): BlogPost {
    const {featuredAlt: _featuredAlt, ...postFields} = input;
    return {
        ...postFields,
        author: "AnimalDex Field Desk",
        publishedAt: "2026-08-30",
        updatedAt: "2026-10-07",
        speciesSlugs: [],
        featuredImage: contentThumb(postFields.slug)
    };
}

const img = (slug: string, file: string, alt: string, width: number, height: number, caption: string) => ({
    type: "image" as const,
    image: {src: `/images/blog/${slug}/${file}.webp`, alt, width, height, caption}
});

const useCaseLinks = {
    herping: {text: "Herping field journal", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"},
    importIg: {text: "Import Instagram wildlife photos", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"},
    companion: {text: "Wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"},
    collection: {text: "Wildlife collection app", slug: "wildlife-collection-animal-card-app", href: "/use-cases/wildlife-collection-animal-card-app"}
};

export const instagramWildlifeArchivePosts2: BlogPost[] = [
    post({
        slug: "herping-photography-without-disturbing-wildlife",
        title: "Herping Photography Without Disturbing Wildlife",
        description: "How to photograph snakes, frogs and lizards without handling, flipping or baiting: working distance, light, venomous-species safety and what to log.",
        featuredAlt: "Herping photography at a respectful distance from a reptile",
        readingMinutes: 6,
        tags: ["herping photography", "ethics", "wildlife"],
        searchIntents: ["ethical herping photography", "herping without disturbing wildlife", "how to photograph snakes safely", "reptile photography app", "frog photography at night"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "what-to-record-when-you-find-a-snake", "herping-photos-searchable-collection"],
        tableOfContents: [
            "The picture is not worth the stress",
            "Work the distance, not the animal",
            "Venomous species: the rules do not change, the distance does",
            "Frogs at night: light, wet hands and chytrid",
            "A journal reduces repeat pressure"
        ],
        sections: [
            {
                title: "The picture is not worth the stress",
                paragraphs: [
                    "No flipping rocks into a worse microhabitat. No pinning for a scale shot. No baiting. No moving a snake onto a prettier log. Get the record you can get from where you already stand, then move on.",
                    "Handling is the single most disruptive thing a photographer does to a reptile. A snake that has just been lifted abandons the basking spot it chose for a reason, burns energy on a defensive display, and may regurgitate a recent meal. Lizards drop tails. Frogs lose the mucus layer that keeps their skin breathing. None of that shows in the frame, which is exactly why it keeps happening.",
                    "Cover objects matter too. A sheet of tin or a flat rock is a microhabitat with its own humidity and temperature. If you lift it, lift it towards you so the animal has an escape route away from you, photograph what is there, and set it back exactly as it was. Never put the animal back under the cover after replacing it. Put the cover back first, then let the animal find its own way in."
                ],
                pullQuote: "The ethical shot is the one you can take from where you are already standing."
            },
            {
                title: "Work the distance, not the animal",
                paragraphs: [
                    "A 90 to 105 mm macro lens gives you a frame-filling snake head from roughly a metre away. A 300 mm telephoto gives you the same from three or four. A phone with a clip-on macro is closer than either, so with a phone the discipline is to crop afterwards instead of leaning in.",
                    "Get low. Most reptiles read a tall silhouette as a predator and a low one as scenery. Lie on the trail if the ground allows it and let the animal settle for thirty seconds before the first frame. A garter snake that has stopped moving will usually stay put for a short burst of shutter clicks; one that is actively crossing should be allowed to cross.",
                    "Shoot the first frame badly on purpose. A quick record shot from distance means you already have evidence before you try anything better. If the animal moves off after that, the encounter is still logged.",
                    "Keep your own track clean. Stay on the trail where there is one, do not trample vegetation to improve the background, and never corner an animal against a wall or a drop."
                ],
                media: img(
                    "herping-photography-without-disturbing-wildlife",
                    "garter-snake-trail",
                    "California red-sided garter snake coiled on a rock, photographed from a standing distance",
                    1400,
                    788,
                    "A garter snake left where it was found: a record shot from standing height, then a lower angle, then walk on. Photo: Casey Helton, CC BY 2.0, via Wikimedia Commons."
                )
            },
            {
                title: "Venomous species: the rules do not change, the distance does",
                paragraphs: [
                    "Identify first, from where you are. If you are not certain the animal is harmless, treat it as venomous. A snake can strike roughly half its body length, so a 1.5 m rattlesnake can reach about 75 cm; stay well beyond that and remember that a startled snake can move faster than you expect on uneven ground.",
                    "Most snakebites in North America happen to people who were trying to handle, move or kill the snake. The animal was not hunting them. That statistic is the whole safety briefing: hands away, feet still, long lens.",
                    "On roads at night, the traffic is more dangerous than the snake. Pull completely off the carriageway, wear something reflective, and never step into the lane to photograph an animal that a car could reach before you do."
                ],
                cards: [
                    {label: "Distance", body: "Can you take the frame from where you are standing? If not, do you really need it?"},
                    {label: "Cover", body: "Lift cover objects towards you, photograph, replace exactly. Animal goes back under on its own."},
                    {label: "Hands", body: "No handling, no pinning, no repositioning. Wet amphibian skin and sunscreen do not mix."},
                    {label: "Light", body: "Brief, diffused flash. Red headlamp for finding, white light only for the frame."},
                    {label: "Exit", body: "Leave the animal an escape route. Never block the direction it was heading."}
                ]
            },
            {
                title: "Frogs at night: light, wet hands and chytrid",
                paragraphs: [
                    "Tree frogs are the easiest herps to photograph well and the easiest to harm. An American green tree frog is 3 to 6 cm long, calls from a perch after rain, and will stay on that perch for minutes if you keep the light short and the lens still. There is no need to move it to a leaf with a better background.",
                    "Amphibian skin absorbs whatever touches it. Insect repellent, sunscreen and hand sanitiser on your fingers all go straight into the animal. The safest hand is the one that never makes contact.",
                    "The chytrid fungus Bd, and its salamander relative Bsal, travel on boots and gear between sites. Clean mud off footwear between wetlands and disinfect it where you can. It is a small habit with a large effect, because chytridiomycosis has been linked to declines in hundreds of amphibian species worldwide."
                ],
                media: img(
                    "herping-photography-without-disturbing-wildlife",
                    "green-tree-frog-leaf",
                    "American green tree frog resting on a leaf at night",
                    1400,
                    933,
                    "An American green tree frog (Hyla cinerea) on its own perch at night, lit briefly for the frame. Photo: Judy Gallagher, CC BY 2.0, via Wikimedia Commons."
                ),
                inlineLinks: [{text: "Red-eyed tree frog", slug: "red-eyed-tree-frog"}, {text: "American bullfrog", slug: "american-bullfrog"}]
            },
            {
                title: "A journal reduces repeat pressure",
                paragraphs: [
                    "If you already documented that stretch of road, you do not need to work the same animal again for a slightly cleaner frame. A searchable Dex tells you in the car park whether you have the species, where, and in what condition. That is one reason a herping journal helps the animals as much as the herper.",
                    "In AnimalDex a field find is a live capture: a photo taken in the app at the moment of the encounter, with species or group-level identity, setting and a confirmed location attached. Older finds that you posted on Instagram can join the same Dex through import, but each post is reviewed before it becomes a capture, so a 2019 road snake stays honest about where it actually was.",
                    "Record the encounter, not just the animal: time, temperature if you have it, substrate, behaviour and how far away you were. That context is what makes a journal worth re-reading in five years."
                ],
                inlineLinks: [useCaseLinks.herping, {text: "What to record when you find a snake", slug: "what-to-record-when-you-find-a-snake", href: "/blog/what-to-record-when-you-find-a-snake"}]
            }
        ],
        faq: [
            {question: "Is it OK to pick up a snake for a photo?", answer: "No. Handling stresses the animal, risks a bite, and makes the photograph a record of an interrupted snake rather than an encounter. Use a macro or telephoto lens from a metre or more away, get low, and let the animal settle. If it moves off, you still have the record shot you took first."},
            {question: "How far away should I stay from a venomous snake?", answer: "Stay several body lengths away. A snake can strike about half its own length, so a 1.5 m rattlesnake reaches roughly 75 cm, and you want a wide margin beyond that on uneven ground. Most bites happen to people trying to handle or kill the snake, so distance and stillness are the whole safety plan."},
            {question: "Can I move a frog to a better background?", answer: "You should not. Amphibian skin absorbs repellent, sunscreen and sanitiser from your hands, and a frog moved off its perch loses the spot it chose. Photograph it where it is with brief, diffused light, then switch back to a red headlamp and leave."},
            {question: "What is the Grinnell method and do I need it for herping?", answer: "The Grinnell method is a structured field-notebook system from the Museum of Vertebrate Zoology at Berkeley: a running journal, species accounts and a specimen catalogue. You do not need the full method, but its habit of recording date, place, weather, habitat and behaviour for every find is exactly what makes a herping record useful later."},
            {question: "Do imported Instagram herp photos count as captures?", answer: "They can become captures after review. AnimalDex finds animal posts on a connected Instagram professional account, then you confirm species or group identity, the historical location and the setting before the original media is added. New finds in the field are live captures taken in the app."}
        ],
        sources: [
            {label: "Savannah River Ecology Laboratory Herpetology Program, University of Georgia", href: "https://srelherp.uga.edu/"},
            {label: "AmphibiaWeb: amphibian declines and chytridiomycosis", href: "https://amphibiaweb.org/"},
            {label: "Britannica: snake", href: "https://www.britannica.com/animal/snake"},
            {label: "iNaturalist help: geoprivacy and sensitive species", href: "https://www.inaturalist.org/pages/help"}
        ]
    }),
    post({
        slug: "herping-photos-searchable-collection",
        title: "Turn Years of Herping Photos Into a Searchable Collection",
        description: "Bring night herps, road finds and frog choruses out of Instagram and a camera roll into a species-indexed collection you can actually query.",
        featuredAlt: "A searchable collection of herping photographs by species",
        readingMinutes: 5,
        tags: ["herping", "Instagram", "archive"],
        searchIntents: ["organize herping photos", "herping Instagram archive", "reptile photo collection", "snake photo organizer", "herp life list from photos"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "turn-instagram-wildlife-archive-into-species-collection", "organize-snake-reptile-photos-by-species"],
        tableOfContents: [
            "The nights already happened",
            "Index by identity, not by trip",
            "What to attach to every record",
            "Night finds and frog choruses",
            "Keep live nights and old archives in one Dex"
        ],
        sections: [
            {
                title: "The nights already happened",
                paragraphs: [
                    "You do not need to re-walk every site. The road-cruising nights of 2017, the frog chorus you filmed in Costa Rica, the rat snake on the guesthouse wall: those encounters exist as posts, camera-roll frames and half-remembered captions. The job is not to shoot them again. It is to turn them into records.",
                    "Start with an audit. Count the places your herp photos live: Instagram, the phone, an old laptop, a cloud album from a trip. Most herpers find three or four. Pick the one with the most context attached, which is usually Instagram because you wrote a caption at the time, and work from there.",
                    "Eligible Instagram posts can be reviewed into AnimalDex with their original media after species and historical location are confirmed. That is slower than dumping a camera roll into albums. It is also the only way a 2017 road find stays honest about where the snake actually was."
                ],
                inlineLinks: [useCaseLinks.importIg]
            },
            {
                title: "Index by identity, not by trip",
                paragraphs: [
                    "Folder names like Bali night or Florida roads hide lookalikes. A milk snake and a coral snake can sit in the same folder for years because the folder was named after the state, not the animal. Index by identity first, then let place, date and setting hang off that.",
                    "Lookalikes are where honesty matters most. The eastern milk snake, 50 to 90 cm of red, black and cream banding, is a Batesian mimic of the venomous coral snakes; the red-on-yellow rhyme works for most of the United States and nowhere else. If you cannot resolve the animal to species from the frame, record the group (milk snake or kingsnake, a Lampropeltis) rather than guessing. A group-level record is a true record. A wrong species is a false one.",
                    "The same rule applies to subspecies and colour morphs. Log what the photograph supports. Let an expert upgrade it later if the evidence allows."
                ],
                media: img(
                    "herping-photos-searchable-collection",
                    "milk-snake",
                    "Eastern milk snake with red, black and cream banding coiled on the ground",
                    1400,
                    938,
                    "Eastern milk snake (Lampropeltis triangulum), a harmless coral-snake mimic that ends up in the wrong folder more often than most. Photo: Peter Paplanus, CC BY 2.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["milk-snake", "corn-snake"]
            },
            {
                title: "What to attach to every record",
                paragraphs: [
                    "A searchable collection is only as good as the fields on each record. These are the ones herpers actually query later."
                ],
                table: {
                    columns: ["Field", "Why it matters", "Example"],
                    rows: [
                        {cells: ["Species or group", "The thing you will search by", "Eastern milk snake, or Lampropeltis sp. if unresolved"]},
                        {cells: ["Historical place", "Where the animal was, not where you uploaded", "Forest road, Ocala NF, not the hotel in Orlando"]},
                        {cells: ["Date and time", "Season and activity window", "14 May 2019, 22:40"]},
                        {cells: ["Setting", "Wild, zoo, farm or domestic", "Wild"]},
                        {cells: ["Alive or dead on road", "Live lists and DOR lists are different lists", "Alive, crossing"]},
                        {cells: ["Behaviour", "Basking, crossing, in shed, defensive, calling", "Calling from a reed stem"]},
                        {cells: ["Microhabitat and substrate", "What the animal was using", "Under tin on sandy soil"]},
                        {cells: ["Weather", "Recent rain drives amphibian nights", "24 C, light rain earlier"]}
                    ]
                }
            },
            {
                title: "Night finds and frog choruses",
                paragraphs: [
                    "Night herping produces a specific kind of archive: a lot of flash-lit frogs on leaves and a lot of audio. The red-eyed tree frog, 5 to 7 cm and strictly nocturnal, is the classic example. It sleeps flat against a leaf by day with its red eyes shut and its blue flanks hidden, so almost every photograph of one is a night photograph.",
                    "A frog chorus recorded on your phone is an encounter, but it is not a capture. You heard the animal; you did not photograph it. Keep the audio with the trip notes, and log the heard-only species in your own list the way birders mark heard-only birds. The Dex entry waits for a frame.",
                    "When you review an old night post, check the perch. A frog on a hand, a white sheet or a studio leaf was handled or staged. Log the animal honestly and note the handling so your future self does not count it as a field observation of behaviour."
                ],
                media: img(
                    "herping-photos-searchable-collection",
                    "red-eyed-tree-frog",
                    "Red-eyed tree frog clinging to a stem with its red eyes open",
                    1400,
                    933,
                    "Red-eyed tree frog (Agalychnis callidryas), Central America. Nocturnal, so almost every record is a night record. Photo: Geoff Gallice, CC BY 2.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["red-eyed-tree-frog"]
            },
            {
                title: "Keep live nights and old archives in one Dex",
                paragraphs: [
                    "New finds still start with a live capture, a photo taken in the app at the moment of the encounter. Import fills the years you already photographed. Both land in the same species-indexed Dex, so the question which snakes have I actually documented gets one answer instead of four.",
                    "Two cautions. First, sensitive species: if a post shows a rare or heavily collected animal, be careful about publishing a precise location anywhere public. Second, rewards: imported posts build the collection, but Creator Rewards, which is currently paused, has always been tied to qualifying live contribution, not imported archives."
                ],
                cards: [
                    {label: "Identity", body: "Species if the frame supports it, group if it does not. No promotions for a cleaner card."},
                    {label: "Place", body: "Confirm where the animal was. Today's GPS and the caption are hints, not coordinates."},
                    {label: "Setting", body: "Wild, zoo, farm or domestic. A pet-shop ball python is a record, but not a field record."},
                    {label: "Several animals", body: "If more than one species is in shot, say which one the record is for."},
                    {label: "Public", body: "Imported posts may publish to Discover. Obscure precise sites for sensitive species."}
                ],
                inlineLinks: [useCaseLinks.herping, {text: "Organize snake and reptile photos by species", slug: "organize-snake-reptile-photos-by-species", href: "/blog/organize-snake-reptile-photos-by-species"}]
            }
        ],
        faq: [
            {question: "How do I organize years of herping photos?", answer: "Index by animal first, then by place and date. Audit where the photos live, start with the source that has the most context (usually Instagram captions), and attach species or group identity, historical location, setting and behaviour to each record. A folder named after a trip hides lookalikes; a species-indexed collection surfaces them."},
            {question: "What if I cannot identify a snake in an old photo?", answer: "Record it at group level. A milk snake or kingsnake logged as Lampropeltis is a true record; a guessed species is a false one. Platforms such as iNaturalist can help with community identification, and you can upgrade the record later if someone resolves it from the frame."},
            {question: "Does a frog chorus count for my herp list?", answer: "It counts as a heard-only encounter in your own list, the same way birders mark heard-only birds. It is not a capture, because a capture needs a photograph of the animal. Keep the audio with the trip notes and let the Dex entry wait for a frame."},
            {question: "Can I import herping photos from Instagram into AnimalDex?", answer: "Yes, from a compatible Instagram professional account. AnimalDex finds animal posts, then you review each one: confirm species or group identity, the historical place of the find and the setting. Eligible posts are added with their original media. Not every post will import."}
        ],
        sources: [
            {label: "AmphibiaWeb (University of California, Berkeley)", href: "https://amphibiaweb.org/"},
            {label: "The Reptile Database", href: "http://www.reptile-database.org/"},
            {label: "HerpMapper: a herp observation database shared with researchers", href: "https://www.herpmapper.org/"},
            {label: "iNaturalist help", href: "https://www.inaturalist.org/pages/help"}
        ]
    }),
    post({
        slug: "tools-for-tracking-herping-finds",
        title: "Tools for Tracking Herping Finds: Notebook to App",
        description: "Notebook, spreadsheet, iNaturalist, HerpMapper, eBird and AnimalDex compared for logging snakes, lizards and frogs, with what to record whichever you use.",
        featuredAlt: "Field tools and a phone used to track herping finds",
        readingMinutes: 6,
        tags: ["herping app", "tools", "field journal"],
        searchIntents: ["best herping app", "tools for tracking herping finds", "reptile tracking app", "herping journal spreadsheet", "iNaturalist vs HerpMapper"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "reptile-amphibian-life-list", "herping-photos-searchable-collection"],
        tableOfContents: [
            "Use the right tool for the job",
            "Six tools compared",
            "Notebook and spreadsheet",
            "Community science platforms",
            "Where AnimalDex fits"
        ],
        sections: [
            {
                title: "Use the right tool for the job",
                paragraphs: [
                    "A herp record needs six things: an identity, a place, a time, the conditions, some evidence and a way to find it again. Almost every tool does two or three of those well. None does all six, which is why most serious herpers run a notebook plus one platform plus a photo collection, and why the question which app is best has no honest single answer.",
                    "Maps, weather and local regulations live outside any collection app. Community science platforms are built for research-grade sharing. Galleries are built for files. AnimalDex is built for identification-assisted collecting. Knowing which lane each tool is in saves you from expecting one of them to be all of them."
                ],
                media: img(
                    "tools-for-tracking-herping-finds",
                    "field-notebook",
                    "Notebook and pen on a wooden table",
                    1400,
                    828,
                    "The oldest herping tool still works: a notebook that never runs out of battery on a road at 2 a.m. Photo: Thomas Martinsen faceline, CC0, via Wikimedia Commons."
                )
            },
            {
                title: "Six tools compared",
                paragraphs: [
                    "This is a fair reading of what each tool is designed for. None of the limitations are criticisms; they are the lane the tool chose."
                ],
                table: {
                    columns: ["Tool", "Best at", "Weak at", "Sensitive locations"],
                    rows: [
                        {cells: ["Paper notebook", "Fast, offline, conditions and sketches", "Searching, sharing, photos", "Private by default"]},
                        {cells: ["Spreadsheet", "Sorting, counting, custom fields", "Identification help, evidence", "Private; you control sharing"]},
                        {cells: ["iNaturalist", "Community ID, research-grade records to GBIF", "Keeping anything private or personal", "Auto-obscures threatened taxa; manual obscuring available"]},
                        {cells: ["HerpMapper", "Herp-only records shared with vetted researchers", "Public display, social features", "Records not shown publicly"]},
                        {cells: ["eBird", "Bird checklists, effort data, life lists", "Anything that is not a bird", "Sensitive species hidden from output"]},
                        {cells: ["AnimalDex", "Live captures, a species Dex, Instagram import after review", "Expert ID, permits, maps, weather", "You confirm location; Discover publishing is per post"]}
                    ]
                }
            },
            {
                title: "Notebook and spreadsheet",
                paragraphs: [
                    "The notebook is older than every app and still the best tool at the moment of the find. The Grinnell method, developed by Joseph Grinnell at Berkeley's Museum of Vertebrate Zoology in the early 1900s, formalised it: a running journal of where you went and what conditions were like, separate species accounts, and a catalogue of specimens or photographs. Museums still use notebooks written that way a century ago because the format forces you to record weather, habitat and behaviour, not just a name.",
                    "A spreadsheet is the notebook with sorting. One row per encounter, one column per field, and you can count lifers, filter by county or pull every DOR record from July in about ten seconds. Its weakness is evidence: a spreadsheet cell cannot show you the photo, and it cannot tell you whether the identification was right.",
                    "The practical pairing is a notebook in the field and a spreadsheet or Dex at home. Transcribe within a day, while the smell of the road is still in your memory."
                ]
            },
            {
                title: "Community science platforms",
                paragraphs: [
                    "iNaturalist is the default for herpers who want their records to count. An observation becomes research grade when the community agrees on a species-level identification, and research-grade records flow to GBIF where scientists use them. iNaturalist automatically obscures coordinates for taxa that are threatened or heavily collected, and you can obscure any record yourself, which matters for snakes and salamanders that poachers target.",
                    "HerpMapper is narrower and quieter: a herp-only database where your records are not displayed publicly but are shared with vetted partners such as state agencies and researchers. Many herpers log to both.",
                    "eBird, from the Cornell Lab of Ornithology, is the standard for birders and worth knowing even as a herper, because its effort-based checklists and life-list rules are the model everyone else borrows from. It does not take herp records."
                ],
                media: img(
                    "tools-for-tracking-herping-finds",
                    "european-tree-frog",
                    "European tree frog sitting on a green leaf",
                    1400,
                    934,
                    "European tree frog (Hyla arborea), 4 to 5 cm, a species whose declining range is tracked largely through records like yours. Photo: Gllawm, CC BY-SA 4.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["common-tree-frog"]
            },
            {
                title: "Where AnimalDex fits",
                paragraphs: [
                    "AnimalDex is a collection tool. A field find is a live capture: a photo taken in the app, with species or group-level identity, a setting (wild, zoo, farm, domestic) and a confirmed location attached, filed into a Dex you can browse by animal. Old finds on a compatible Instagram professional account can join the same Dex, but each post is reviewed before it becomes a capture.",
                    "It is not a replacement for expert identification, permits or safety practice, and it will not invent a species name when the honest catalogue result is a group. If you need research-grade community review, use iNaturalist alongside it. If you need a species collection with import and live capture, this is the lane AnimalDex is built for.",
                    "Whatever tools you settle on, the fields below are the ones that survive a change of app. Record them every time."
                ],
                cards: [
                    {label: "Identity", body: "Species or group. Write down why: pattern, scale count, call, size."},
                    {label: "Place and time", body: "Locality you could return to, date, clock time. Night finds need the time."},
                    {label: "Conditions", body: "Air temperature, cloud, rain in the last 24 hours, road or substrate temperature if you carry a thermometer."},
                    {label: "Behaviour and microhabitat", body: "Basking, crossing, under cover, calling. What it was on and what it was under."},
                    {label: "Evidence", body: "At least one record photograph, even a poor one. Audio for calling frogs."},
                    {label: "Distance and handling", body: "How close you were and whether the animal was touched. Honest journals note both."}
                ],
                inlineLinks: [useCaseLinks.herping, {text: "Reptile and amphibian life list", slug: "reptile-amphibian-life-list", href: "/blog/reptile-amphibian-life-list"}]
            }
        ],
        faq: [
            {question: "What is the best app for tracking herping finds?", answer: "There is no single best app, because the job has several parts. iNaturalist is best for community identification and research-grade records, HerpMapper for sharing herp records privately with researchers, a notebook for conditions at the moment of the find, and AnimalDex for a species collection built from live captures and reviewed Instagram imports. Most herpers use two or three."},
            {question: "Is iNaturalist safe for rare snakes and salamanders?", answer: "Mostly, if you use its tools. iNaturalist automatically obscures coordinates for taxa flagged as threatened or heavily collected, and you can obscure or make private the location of any observation yourself. For very sensitive sites, HerpMapper keeps records off public display entirely."},
            {question: "How do I keep a herping journal in a spreadsheet?", answer: "One row per encounter and one column per field: date, time, locality, species or group, alive or DOR, behaviour, microhabitat, air temperature, weather, photo reference and notes. Keep identity and place in separate columns from the trip name so you can sort by animal. Transcribe from a field notebook within a day."},
            {question: "Does AnimalDex replace iNaturalist?", answer: "No. AnimalDex is a collection tool: live captures in the app, a species Dex, setting and confirmed locations, plus Instagram import after review. iNaturalist is a community-science platform with expert identification and research-grade data. They do different jobs and work well together."},
            {question: "What is the Grinnell method?", answer: "A field-notebook system from the Museum of Vertebrate Zoology at Berkeley, dating from the early 1900s. It separates a daily journal (route, weather, habitat), species accounts (what each animal was doing) and a catalogue of specimens or photographs. Its lasting lesson is that conditions and behaviour belong in the record, not just the name."}
        ],
        sources: [
            {label: "iNaturalist help: research grade, geoprivacy and obscuring", href: "https://www.inaturalist.org/pages/help"},
            {label: "HerpMapper", href: "https://www.herpmapper.org/"},
            {label: "About eBird (Cornell Lab of Ornithology)", href: "https://ebird.org/about"},
            {label: "Museum of Vertebrate Zoology, University of California, Berkeley", href: "https://mvz.berkeley.edu/"},
            {label: "Global Biodiversity Information Facility", href: "https://www.gbif.org/"}
        ]
    }),
    post({
        slug: "wildlife-creators-need-a-species-archive",
        title: "Why Wildlife Creators Need a Species Archive",
        description: "A feed shows recent work. A species-indexed archive shows what you have actually documented, answers editors in seconds, and survives algorithm changes.",
        featuredAlt: "Wildlife creator moving from a social feed to a species archive",
        readingMinutes: 5,
        tags: ["wildlife creator", "archive", "Instagram"],
        searchIntents: ["wildlife creator archive", "species archive not social feed", "wildlife photography body of work", "organize wildlife content by species", "wildlife photographer portfolio by species"],
        relatedSlugs: ["wildlife-photographers-public-species-portfolio", "turn-instagram-wildlife-archive-into-species-collection", "wildlife-creator-profile-around-species"],
        tableOfContents: [
            "Algorithms are not librarians",
            "What a species-indexed body of work lets you do",
            "Build it: identity, place, setting, evidence",
            "Bring the existing feed across",
            "Earnings stay honest"
        ],
        sections: [
            {
                title: "Algorithms are not librarians",
                paragraphs: [
                    "A feed is sorted by recency and by what performed. It cannot answer the questions a working creator actually gets asked: do you have a great hornbill, how many viper species have you shot, which coasts have you covered. Scrolling a year of stories to find out is not a system.",
                    "Feeds are also rented. Hashtags change meaning, captions get edited, accounts get locked or lose reach, and a platform's search was never designed to find your own work by species. A species archive lets you answer which hornbills, which vipers, which coasts without opening the app at all.",
                    "Instagram import is how an existing body of posts can enter that archive. Each post is reviewed before it becomes a capture, so the archive starts honest instead of starting fast."
                ],
                inlineLinks: [useCaseLinks.companion, useCaseLinks.importIg],
                pullQuote: "A feed shows what you posted last. An archive shows what you have actually documented."
            },
            {
                title: "What a species-indexed body of work lets you do",
                paragraphs: [
                    "Indexing by species changes what you can do with the same photographs. A great hornbill, 95 to 120 cm long with a yellow casque and a wingbeat you hear before you see the bird, is one of the most requested Asian forest species by editors. If your archive is a feed, finding your best hornbill frame means remembering the month. If it is indexed by species, it means one tap."
                ],
                cards: [
                    {label: "Answer requests in seconds", body: "An editor asks for a species. You open the entry, not a year of posts."},
                    {label: "See the gaps", body: "Species you have never documented become a trip plan instead of a vague feeling."},
                    {label: "Compare encounters", body: "Three hornbill encounters across seasons show behaviour a single frame cannot."},
                    {label: "Protect the record", body: "Identity, place and setting stay attached to the photo, not in a caption you may not trust in five years."},
                    {label: "Outlast the platform", body: "If an account disappears, the archive and its original media do not."}
                ],
                media: img(
                    "wildlife-creators-need-a-species-archive",
                    "great-hornbill",
                    "Great hornbill perched on a branch showing its yellow casque",
                    1400,
                    928,
                    "Great hornbill (Buceros bicornis), listed as Vulnerable on the IUCN Red List and one of the most requested Asian forest birds. Photo: Malyasri Bhattacharya, CC BY-SA 4.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["great-hornbill"]
            },
            {
                title: "Build it: identity, place, setting, evidence",
                paragraphs: [
                    "Four fields do most of the work. Identity is the species, or the group if the frame does not support a species. Place is where the animal was when you made the picture. Setting is wild, zoo, farm or domestic. Evidence is the original media, not a compressed repost.",
                    "Setting is the one creators most often skip, and it is the one that costs reputations. A Gaboon viper photographed in a zoo reptile house is a real encounter with an extraordinary animal: up to 1.8 m long, fangs that can reach 5 cm, the longest of any snake. It is not a wild record, and every serious competition and most editors require captive animals to be disclosed. Record the setting at the moment of filing and the question never comes up."
                ],
                table: {
                    columns: ["Field", "What to record", "Why"],
                    rows: [
                        {cells: ["Identity", "Species, or group if unresolved", "The thing you search by; never promote a guess"]},
                        {cells: ["Historical place", "Where the animal was", "Today's GPS is where your laptop is"]},
                        {cells: ["Setting", "Wild, zoo, farm, domestic", "Captive disclosure is standard in competitions and editorial"]},
                        {cells: ["Date and season", "Day, month, year", "Breeding plumage, migration, activity windows"]},
                        {cells: ["Behaviour", "Feeding, calling, displaying, resting", "Turns a portrait into a natural-history record"]},
                        {cells: ["Evidence", "Original media", "Reposts lose resolution and metadata"]}
                    ]
                },
                media: img(
                    "wildlife-creators-need-a-species-archive",
                    "gaboon-viper",
                    "Gaboon viper lying among leaf litter",
                    1400,
                    933,
                    "Gaboon viper (Bitis gabonica) photographed in the reptile house at Wilhelma, Stuttgart. A real encounter and a captive record, and the archive should say so. Photo: H. Zell, CC BY-SA 3.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["gaboon-viper"]
            },
            {
                title: "Bring the existing feed across",
                paragraphs: [
                    "Connect a compatible Instagram professional account and AnimalDex looks through your posts for animals. You then review each candidate: confirm identity, confirm the historical place, confirm the setting, and note if more than one animal is in shot. Eligible posts are added with their original photos and videos.",
                    "Not every post will import, and some animals will stay at group level because that is the honest catalogue result. Imported posts may publish to Discover, which is why an accuracy confirmation sits in front of import rather than behind it.",
                    "New work still comes from live captures: photos taken in the app at the moment of the encounter. The archive is the sum of both."
                ],
                inlineLinks: [{text: "Turn your Instagram wildlife archive into a species collection", slug: "turn-instagram-wildlife-archive-into-species-collection", href: "/blog/turn-instagram-wildlife-archive-into-species-collection"}]
            },
            {
                title: "Earnings stay honest",
                paragraphs: [
                    "A public collection is not automatically Creator Rewards. That programme is currently paused, and when it ran it was tied to qualifying live contribution during open reward periods, never to imported posts. Wildlife Guides, a separate path where you host bookable experiences, is in beta. Neither is a promise of income, and a species archive is worth building for the working reasons above whether or not either programme applies to you."
                ],
                inlineLinks: [{text: "Public species portfolio for photographers", slug: "wildlife-photographers-public-species-portfolio", href: "/blog/wildlife-photographers-public-species-portfolio"}]
            }
        ],
        faq: [
            {question: "Why do wildlife photographers need an archive separate from Instagram?", answer: "Because a feed is sorted by recency, not by species, and it is rented. You cannot search your own posts by animal, captions drift, and reach or account access can vanish. A species-indexed archive answers editor requests in seconds, shows gaps, and keeps identity, place and setting attached to the original media."},
            {question: "How should I organize wildlife content by species?", answer: "Give every photograph four fields: identity (species or group), historical place, setting (wild, zoo, farm, domestic) and the original media. Add date and behaviour where you can. Index by identity first so that a search for one species returns every encounter across years and trips."},
            {question: "Do I have to disclose that an animal was photographed in a zoo?", answer: "In practice, yes. Most wildlife photography competitions require captive animals to be disclosed, and editors expect it. Record the setting when you file the image so the disclosure is automatic rather than a memory test years later."},
            {question: "Can I earn money from a species archive in AnimalDex?", answer: "Not from the archive itself. Creator Rewards is currently paused and was tied to qualifying live contribution, not imported posts. Wildlife Guides is a separate beta path for hosting experiences. The archive is worth building for working reasons: faster requests, visible gaps and a record that outlasts any platform."}
        ],
        sources: [
            {label: "IUCN Red List of Threatened Species", href: "https://www.iucnredlist.org/"},
            {label: "Britannica: hornbill", href: "https://www.britannica.com/animal/hornbill"},
            {label: "Britannica: Gaboon viper", href: "https://www.britannica.com/animal/Gaboon-viper"}
        ]
    }),
    post({
        slug: "wildlife-photography-searchable-body-of-work",
        title: "Make Wildlife Photography a Searchable Body of Work",
        description: "Index wildlife photos by species, place and date so a decade of pictures becomes a body of work you can query, with a minimum metadata standard.",
        featuredAlt: "Searchable wildlife photography body of work organized by species",
        readingMinutes: 4,
        tags: ["wildlife photography", "body of work"],
        searchIntents: ["searchable wildlife photography archive", "organize wildlife body of work", "wildlife photo metadata keywords", "catalog wildlife photos by species", "lightroom keywords for wildlife"],
        relatedSlugs: ["organize-years-of-wildlife-photos-by-species", "wildlife-photography-life-list", "preserve-context-behind-animal-encounters"],
        tableOfContents: [
            "Search needs identity, not only keywords",
            "A minimum metadata standard",
            "Keep captions out of the coordinate field",
            "One species, many encounters",
            "Import the archive, then keep shooting"
        ],
        sections: [
            {
                title: "Search needs identity, not only keywords",
                paragraphs: [
                    "Filename search fails on IMG_8841. Keyword search works only if you typed the same keyword, spelled the same way, on every relevant frame for ten years. Most photographers did not. The archive that can be searched is the one where every picture carries a species identity and a confirmed historical location, because those two fields do not depend on memory.",
                    "A gallery can find Tuesday. A Dex can find every heron you have actually documented, across every Tuesday.",
                    "The fix is not more folders. It is a short list of fields applied consistently, starting now, and then worked backwards through the archive one species at a time."
                ],
                media: img(
                    "wildlife-photography-searchable-body-of-work",
                    "wildlife-photographer-telephoto",
                    "Wildlife photographer lying prone with a telephoto lens as a desert tortoise walks past",
                    1400,
                    900,
                    "A desert tortoise and a photographer working from the ground with a long lens, Joshua Tree National Park. Photo: Joshua Tree National Park, public domain, via Wikimedia Commons."
                )
            },
            {
                title: "A minimum metadata standard",
                paragraphs: [
                    "Professional photo libraries use the IPTC photo metadata standard, which has fields for keywords, location and description that travel inside the file. You do not need to adopt the whole standard. You need these six fields, wherever you keep them."
                ],
                table: {
                    columns: ["Field", "Example", "Where it lives"],
                    rows: [
                        {cells: ["Species or group", "Great blue heron", "Keyword hierarchy or Dex identity"]},
                        {cells: ["Historical place", "Heron pond, Three Creeks, Ohio", "IPTC location fields or Dex location"]},
                        {cells: ["Date", "2021-07-14", "EXIF capture date (check camera clock on trips)"]},
                        {cells: ["Setting", "Wild", "Keyword or Dex setting"]},
                        {cells: ["Behaviour", "Hunting from a fallen branch", "Description or caption field"]},
                        {cells: ["Season and weather", "Mid-summer, overcast", "Description field"]}
                    ]
                }
            },
            {
                title: "Keep captions out of the coordinate field",
                paragraphs: [
                    "Hashtags and caption place names are hints, not records. A caption that says Everglades might mean the national park, the city of Everglades, or a road an hour away. The EXIF GPS tag is where the camera was, which for a 600 mm frame can be 100 m from the animal and, for a photo uploaded later, can be your kitchen.",
                    "AnimalDex asks you to confirm the historical place of the photograph instead of guessing from text or today's GPS. If you genuinely do not know, record that. An unknown location is an honest record; an invented one poisons every search that touches it.",
                    "For sensitive species, nesting birds, rare orchids with insects on them, heavily collected reptiles, deliberately coarsen the public location. Keep the precise one in your private notes."
                ]
            },
            {
                title: "One species, many encounters",
                paragraphs: [
                    "The payoff of a species index is not the first photograph of an animal. It is the fifth. A great blue heron stands up to 1.2 m tall on a 2 m wingspan and hunts by standing motionless in the shallows, sometimes for many minutes, before a single strike. One frame shows a heron. Five encounters across seasons show it fishing in July, in breeding plumes in March, hunched against a January wind, and that is natural history.",
                    "Indexed by species, those five encounters sit together and the behaviour becomes visible. Indexed by trip, they are in five folders named after five towns, and nobody ever looks at them side by side."
                ],
                media: img(
                    "wildlife-photography-searchable-body-of-work",
                    "great-blue-heron",
                    "Great blue heron standing on a fallen branch over still water",
                    912,
                    1400,
                    "Great blue heron (Ardea herodias) hunting from a fallen branch. The same species, filed under five towns, is five separate photos; filed under one species it is a behaviour record. Photo: Sixflashphoto, CC BY-SA 4.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["great-blue-heron"]
            },
            {
                title: "Import the archive, then keep shooting",
                paragraphs: [
                    "Eligible Instagram posts can enter the same index after review: connect a compatible professional account, let AnimalDex find animal posts, confirm identity and historical place for each, and the original media is added. New work still comes from live captures, photos taken in the app at the moment of the encounter.",
                    "Imported posts build the collection. They do not add qualifying live-capture signals for Creator Rewards, which is currently paused in any case. Build the body of work because it makes you a better photographer and a faster one, not for a programme."
                ],
                cards: [
                    {label: "Pick one species", body: "Start with the animal you have photographed most. Gather every frame of it, from every source."},
                    {label: "Confirm the place", body: "For each encounter, write down where the animal was. Unknown is allowed; guessed is not."},
                    {label: "Mark the setting", body: "Wild, zoo, farm or domestic, before you forget which were which."},
                    {label: "Note behaviour", body: "One phrase per encounter. Hunting, preening, displaying, resting."},
                    {label: "Move on", body: "Next species. Twenty minutes a day clears a decade in a season."}
                ],
                inlineLinks: [useCaseLinks.companion, useCaseLinks.importIg]
            }
        ],
        faq: [
            {question: "How do I organize wildlife photos so I can search them?", answer: "Attach a species identity and a confirmed historical location to every frame, then add setting, date and behaviour. Those fields do not rely on remembering a keyword. Work backwards through the archive one species at a time rather than one trip at a time, so encounters of the same animal end up together."},
            {question: "What metadata should wildlife photos have?", answer: "At minimum: species or group, historical place, capture date, setting (wild, zoo, farm, domestic), behaviour and season or weather. Professional libraries carry these in IPTC fields inside the file; a Dex carries them as structured fields beside the image. Either works as long as every frame gets them."},
            {question: "Can I trust the GPS in my photo's EXIF data?", answer: "Only as a hint. EXIF GPS records where the camera was, not where the animal was, and for photos uploaded from a phone later it may record where you uploaded. Confirm the historical place yourself, and record unknown if you cannot."},
            {question: "Should I hide locations for sensitive species?", answer: "Yes. Coarsen the public location for nesting birds, rare plants and heavily collected reptiles and amphibians, and keep the precise site in private notes. Community platforms such as iNaturalist obscure threatened taxa automatically; your own archive and any public posts need the same discipline."}
        ],
        sources: [
            {label: "Cornell Lab of Ornithology, All About Birds: Great Blue Heron", href: "https://www.allaboutbirds.org/guide/Great_Blue_Heron/overview"},
            {label: "IPTC Photo Metadata Standard", href: "https://iptc.org/standards/photo-metadata/"},
            {label: "iNaturalist help: geoprivacy", href: "https://www.inaturalist.org/pages/help"}
        ]
    }),
    post({
        slug: "wildlife-creator-profile-around-species",
        title: "Build a Wildlife Creator Profile Around Species",
        description: "A species-led public profile is readable by birders, herpers and editors and outlasts follower counts: what to include and how to keep it honest.",
        featuredAlt: "Wildlife creator profile built around documented species",
        readingMinutes: 5,
        tags: ["creator profile", "species"],
        searchIntents: ["wildlife creator profile", "species-based wildlife portfolio", "wildlife photographer public profile", "bird photographer portfolio by species", "wildlife life list profile"],
        relatedSlugs: ["wildlife-photographers-public-species-portfolio", "wildlife-creators-need-a-species-archive", "wildlife-photography-life-list"],
        tableOfContents: [
            "Show the animals, then the person",
            "What a species-led profile contains",
            "A hummingbird is a better headline than a follower count",
            "Public does not mean promotional fiction",
            "Fill the profile from the archive, then from the field"
        ],
        sections: [
            {
                title: "Show the animals, then the person",
                paragraphs: [
                    "Other field people do not read a wildlife profile the way a brand does. A birder wants to know which species you have documented and where. A herper wants to know whether that viper was wild. An editor wants to know if you have the animal they need this week. None of them are asking how many followers you have.",
                    "A species-led profile answers those questions on the first screen: a list of documented animals, each with a place, a date and a setting. The person comes second, and that order makes the profile useful to strangers instead of flattering to friends.",
                    "It also makes Instagram import useful. Old posts can fill the Dex that the profile displays, after review, so the profile reflects a decade of work rather than the months since you installed the app. Follower count changes with the algorithm. A documented list of animals does not."
                ],
                media: img(
                    "wildlife-creator-profile-around-species",
                    "photographer-camera-field",
                    "Bighorn sheep ewe in the foreground with a photographer out of focus behind her",
                    1400,
                    933,
                    "A bighorn ewe and a photographer in Lamar Valley, Yellowstone. A species-led profile shows the ewe first. Photo: Neal Herbert, public domain, via Wikimedia Commons."
                ),
                speciesSlugs: ["bighorn-sheep"]
            },
            {
                title: "What a species-led profile contains",
                paragraphs: [
                    "The structure is simple and it is the same whether the profile is a page in AnimalDex, a portfolio site or a printed list. Each element below is something another field person will check."
                ],
                cards: [
                    {label: "Species list", body: "Every animal you have documented, with group-level entries where a species name would be a guess."},
                    {label: "Wild or captive", body: "Setting on every entry. A zoo gaboon viper and a wild one are different records and different achievements."},
                    {label: "Places", body: "Where, at the resolution you are comfortable publishing. Coarse for sensitive species, precise for a city park pigeon."},
                    {label: "Dates and seasons", body: "A hummingbird in April and the same species in September tell a migration story; a date makes that visible."},
                    {label: "Best encounter per species", body: "One representative image, chosen for natural history rather than likes."},
                    {label: "Evidence", body: "Original media behind every entry. A list without photographs is a claim, not a record."}
                ]
            },
            {
                title: "A hummingbird is a better headline than a follower count",
                paragraphs: [
                    "Take the ruby-throated hummingbird. It weighs about 3 g, beats its wings roughly 50 times a second, and each autumn many individuals cross the Gulf of Mexico non-stop, a flight of around 800 km on fat reserves alone. Documenting that species in spring arrival, summer nesting and autumn fattening at a feeder is a story about one bird that no follower count can tell.",
                    "That is the content of a species-led profile: not how many people watched, but what you saw and when. Three seasons of one species, honestly dated and placed, is a stronger credential to a magazine or a tour operator than any engagement figure, because it is verifiable and specific."
                ],
                media: img(
                    "wildlife-creator-profile-around-species",
                    "ruby-throated-hummingbird",
                    "Female ruby-throated hummingbird perched on a twig among dry leaves",
                    1400,
                    1400,
                    "Female ruby-throated hummingbird (Archilochus colubris). Three dated encounters across a year say more about a creator than any audience number. Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["ruby-throated-hummingbird"],
                pullQuote: "Three seasons of one species, honestly dated and placed, beats any engagement figure."
            },
            {
                title: "Public does not mean promotional fiction",
                paragraphs: [
                    "Imported posts may publish to Discover. That is why location, species, setting and an accuracy confirmation sit in front of import, not after it. A public species portfolio is still a wildlife record, and the standards that apply in the field apply on the profile.",
                    "Three habits keep it honest. Disclose captive animals, every time; most competitions require it and other field people will notice if you do not. Coarsen locations for nesting birds, roosting owls and heavily collected herps, because a public profile is also a map. And leave uncertain identifications at group level rather than upgrading them for a cleaner card. The American Birding Association's code of birding ethics starts with the welfare of birds and their habitat; a profile that publishes a nest site for reach has got the order wrong."
                ]
            },
            {
                title: "Fill the profile from the archive, then from the field",
                paragraphs: [
                    "Connect a compatible Instagram professional account and AnimalDex finds the animal posts. Review each: confirm identity, confirm the historical place, confirm the setting, flag posts with several animals. Eligible posts join the Dex with their original media, and the profile shows them.",
                    "From then on, new encounters are live captures taken in the app in the field. Creator Rewards is currently paused and was never earned by imported posts; Wildlife Guides is a separate beta path for hosting experiences. The profile is worth building because it is the record other field people can read, not because of either programme."
                ],
                inlineLinks: [useCaseLinks.companion, useCaseLinks.importIg, {text: "Public species portfolio for photographers", slug: "wildlife-photographers-public-species-portfolio", href: "/blog/wildlife-photographers-public-species-portfolio"}]
            }
        ],
        faq: [
            {question: "What should a wildlife photographer's profile include?", answer: "A list of documented species with a setting (wild or captive), a place at a sensible resolution, a date, one representative image per species and the original media behind each entry. Lead with the animals; put the biography second. That order makes the profile useful to birders, herpers and editors who are checking what you have actually seen."},
            {question: "Can I count zoo animals on a wildlife profile?", answer: "You can list them, but mark them as captive. Birders' life-list rules exclude captive birds entirely, most photography competitions require captive disclosure, and other field people will treat an undisclosed zoo animal as a credibility problem. AnimalDex records setting (wild, zoo, farm, domestic) on every capture for exactly this reason."},
            {question: "Should I publish exact locations on a public profile?", answer: "Not for sensitive species. A public profile is also a map, so coarsen the location for nesting birds, owl roosts, rare plants and heavily collected reptiles and amphibians, and keep precise sites in private notes. A city park pigeon can carry its exact spot."},
            {question: "Does a public AnimalDex profile earn Creator Rewards?", answer: "No. Creator Rewards is currently paused, and when it ran it was tied to qualifying live contribution during open reward periods, not to imported posts or profile views. Wildlife Guides is a separate beta programme for hosting bookable experiences. Neither is a promise of income."}
        ],
        sources: [
            {label: "Cornell Lab of Ornithology, All About Birds: Ruby-throated Hummingbird", href: "https://www.allaboutbirds.org/guide/Ruby-throated_Hummingbird/overview"},
            {label: "American Birding Association: Code of Birding Ethics", href: "https://www.aba.org/aba-code-of-birding-ethics/"},
            {label: "IUCN Red List of Threatened Species", href: "https://www.iucnredlist.org/"}
        ]
    }),
    post({
        slug: "preserve-context-behind-animal-encounters",
        title: "Preserve the Context Behind Animal Encounters",
        description: "Place, season, weather, behaviour and setting turn a wildlife photo into a record. How to keep them with the picture so it still makes sense in five years.",
        featuredAlt: "Wildlife encounter context preserved beside a photograph",
        readingMinutes: 5,
        tags: ["context", "wildlife encounters"],
        searchIntents: ["preserve wildlife photo context", "animal encounter journal", "what to record with wildlife photos", "wildlife sighting notes", "wild vs captive wildlife photo"],
        relatedSlugs: ["wildlife-photography-searchable-body-of-work", "organize-years-of-wildlife-photos-by-species", "wildlife-photography-life-list"],
        tableOfContents: [
            "A beautiful crop without context is a postcard",
            "Why context makes a record valuable",
            "Do not let the phone invent the place",
            "Wild, zoo, farm, domestic",
            "Identity can stay at group level"
        ],
        sections: [
            {
                title: "A beautiful crop without context is a postcard",
                paragraphs: [
                    "Wild versus zoo, the actual place, the month, the weather, what the animal was doing and whether several animals were in shot: those are the difference between a postcard and a record. A tight crop of a heron is pleasant. A heron, at a named pond, in late February, standing in sleet, with the long breeding plumes just coming through, is a data point.",
                    "Context is cheap to record on the day and almost impossible to reconstruct later. The photograph keeps the light; it does not keep the temperature, the sound, the distance or the reason you were there. Import asks for those confirmations on purpose, because a record that lacks them cannot be trusted and a record that invents them is worse."
                ],
                pullQuote: "The photograph keeps the light. It does not keep the temperature, the distance or the reason you were there."
            },
            {
                title: "Why context makes a record valuable",
                paragraphs: [
                    "Take a grey heron, the common large heron of Europe and Asia: 90 to 100 cm tall, a wingspan of up to 1.95 m, and a habit of standing motionless for long stretches before a strike. The same bird photographed in four contexts is four different records."
                ],
                table: {
                    columns: ["Context field", "What it tells you later", "Grey heron example"],
                    rows: [
                        {cells: ["Place", "Range, habitat, site fidelity", "City-park pond versus a reed-fringed river"]},
                        {cells: ["Season", "Breeding state, migration, moult", "Late winter: breeding plumes; nesting in a heronry from February"]},
                        {cells: ["Weather", "Why the animal was there and active", "After rain: frogs and worms up, herons on wet grass"]},
                        {cells: ["Behaviour", "Natural history, not just presence", "Still-hunting, nest-building, feeding young"]},
                        {cells: ["Setting", "Wild or captive", "Free-flying in a park counts as wild; a wildlife-centre bird does not"]},
                        {cells: ["Distance", "Disturbance and how the frame was made", "25 m, bird undisturbed, left on its own"]}
                    ]
                },
                media: img(
                    "preserve-context-behind-animal-encounters",
                    "grey-heron",
                    "Grey heron standing beside a park pond under a blue sky",
                    1400,
                    1031,
                    "Grey heron (Ardea cinerea) at a city-park pond in Busan, South Korea. Place and season are what make this frame a record rather than a portrait. Photo: Basile Morin, CC BY-SA 4.0, via Wikimedia Commons."
                )
            },
            {
                title: "Do not let the phone invent the place",
                paragraphs: [
                    "Current GPS is where you are now. Caption text is what you typed then. Neither is automatically the capture location of a historical photograph. A phone photo of a camera's screen carries the GPS of your kitchen; a caption saying Kruger might mean the park, the gate town or the airport.",
                    "If you do not know, say you do not know. AnimalDex can record unknown; it will not treat that as enough to import, because a capture needs a confirmed historical place. That is a feature. An honest unknown stays out of searches it would corrupt. A guessed coordinate gets into all of them."
                ]
            },
            {
                title: "Wild, zoo, farm, domestic",
                paragraphs: [
                    "Setting is the context field people most often leave out, and it is the one that changes what a record means. A giraffe at Denver Zoo is a genuine encounter with a 5 m animal. It is also a captive record, and the two should never collapse into one tile.",
                    "The convention is older than any app. The American Birding Association's recording rules only count birds that are wild and unrestrained; captive and escaped birds do not go on a life list. Photography competitions require captive disclosure. Herpers keep pet-shop and zoo animals off their field lists. Recording setting at the moment of filing means your archive follows the convention without you having to remember which was which.",
                    "AnimalDex stores setting on every capture as wild, zoo, farm or domestic. Zoo and aquarium visits can be in the collection; they just say what they are."
                ],
                media: img(
                    "preserve-context-behind-animal-encounters",
                    "giraffe-zoo",
                    "Giraffes in an outdoor zoo enclosure with a shade structure",
                    1400,
                    933,
                    "Giraffe enclosure at Denver Zoo. A real encounter, a captive record, and the two should never share a tile. Photo: Sarbjit Bahga, CC BY-SA 4.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["giraffe"]
            },
            {
                title: "Identity can stay at group level",
                paragraphs: [
                    "Some animals are indexed as a group on purpose. A brown skink that crossed the path, a treefrog calling from a reed you never saw, a gull in winter plumage at 80 m: these are honest group-level records. Forcing a species-level name to look more professional makes the archive worse, not better, because every later search for that species now returns a guess.",
                    "Experts revise identifications all the time. Leave the door open by recording what you saw and why: size, pattern, call, habitat. If someone resolves it later, the record upgrades. If you had guessed, nobody would ever know it needed checking."
                ],
                cards: [
                    {label: "Same day", body: "Write place, time, weather and behaviour before you sleep. Memory of these decays within days."},
                    {label: "Setting", body: "Wild, zoo, farm or domestic, on every frame, before the trip folder is closed."},
                    {label: "Distance and disturbance", body: "How far, and whether the animal changed behaviour because of you."},
                    {label: "Several animals", body: "If more than one species is in shot, say which one the record is for."},
                    {label: "Uncertainty", body: "Group-level identity when the frame does not support a species. Note why."}
                ],
                inlineLinks: [useCaseLinks.companion, {text: "Wildlife photography life list", slug: "wildlife-photography-life-list", href: "/blog/wildlife-photography-life-list"}]
            }
        ],
        faq: [
            {question: "What should I record with a wildlife photo?", answer: "Place, date and time, season, weather, behaviour, distance, setting (wild, zoo, farm, domestic) and whether several animals were in shot. Write it the same day; those details decay within a week and the photograph does not keep them. Identity can stay at group level if the frame does not support a species."},
            {question: "Do zoo animals count as wildlife sightings?", answer: "Not as wild records. Birders' life-list rules count only wild, unrestrained birds, and photography competitions require captive disclosure. A zoo visit is still a real encounter worth keeping, which is why AnimalDex records a setting on every capture so captive and wild records never merge."},
            {question: "Can I use my phone's GPS as the photo location?", answer: "Only if you took the photo on the phone at the moment of the encounter. For photos uploaded later or re-photographed from a camera screen, GPS records where you were when you uploaded. Confirm the historical place yourself, and record unknown rather than guessing."},
            {question: "Why does context make a wildlife record more valuable?", answer: "Because a species name alone says the animal exists; the context says what it was doing, when, where and under what conditions. A grey heron in breeding plumes at a heronry in February and the same species on a city pond in August are different pieces of natural history. Context is what researchers, editors and your future self can actually use."}
        ],
        sources: [
            {label: "American Birding Association: Recording Rules and Interpretations", href: "https://www.aba.org/aba-recording-rules-and-interpretations/"},
            {label: "Britannica: heron", href: "https://www.britannica.com/animal/heron"},
            {label: "About eBird (Cornell Lab of Ornithology)", href: "https://ebird.org/about"}
        ]
    }),
    post({
        slug: "how-to-keep-track-of-animals-you-have-seen",
        title: "How to Keep Track of Every Animal You’ve Seen",
        description: "What a life list is, how birders and herpers keep one, which rules to borrow, and how to start from animals you have already seen instead of from zero.",
        featuredAlt: "A wildlife life list of animals someone has already encountered",
        readingMinutes: 5,
        tags: ["wildlife life list", "animal collection", "Instagram import"],
        searchIntents: ["keep track of animals I have seen", "app to track animals I have seen", "animal life list app", "wildlife life list", "what is a life list birding", "life list rules"],
        relatedSlugs: ["how-many-animals-have-you-already-encountered", "already-seen-hundreds-of-animals-start-collection", "wildlife-photography-life-list"],
        tableOfContents: [
            "You’ve already seen lots of animals. You just never tracked them.",
            "What a life list is",
            "Rules for your own list",
            "New encounters and past encounters",
            "What not to expect from a life list"
        ],
        sections: [
            {
                title: "You’ve already seen lots of animals. You just never tracked them.",
                paragraphs: [
                    "Most people do not need a new camera. They need a place that answers which animals they have already encountered: the zoo day, the holiday snake, the birds on a morning walk, the fox on the bins last winter. Those encounters happened. They were simply never written down.",
                    "A Dex is that record: unique AnimalDex entries for species and supported animal groups, each with a historical place you confirm and a setting that says wild, zoo, farm or domestic. It is not a guessed count from a feed, and it does not have to begin on the day you install an app."
                ],
                media: img(
                    "how-to-keep-track-of-animals-you-have-seen",
                    "birder-binoculars",
                    "Young birdwatchers looking through binoculars in a green woodland",
                    1400,
                    933,
                    "Birders at a bird inventory station. Most life lists begin with a pair of binoculars and a notebook. Photo: NPS, public domain, via Wikimedia Commons."
                )
            },
            {
                title: "What a life list is",
                paragraphs: [
                    "A life list is the running tally of species a person has identified in their lifetime, one entry per species, with the first encounter recorded. Birders invented the modern version, and the American Birding Association's recording rules are the reference everyone else borrows from. Under those rules a bird counts if it was alive, wild and unrestrained when you encountered it, if you identified it with confidence by sight or sound, and if you observed it within the ABA's code of ethics. A bird heard but never seen is countable. A bird in a zoo, an aviary or a rehabilitation centre is not, nor is an escaped pet unless the species has an established wild population.",
                    "Herpers keep life lists too, with less formal rules and a few conventions of their own: wild and free-living animals only, a separate column for animals found dead on the road, and a habit of noting whether an animal was found under cover or in the open. Many also keep a county list, a year list and a patch list for the one site they walk most.",
                    "For most people in Europe the first bird on the list is a robin, 14 cm of orange breast on a garden fence, and for most in North America it is an American robin or a house sparrow. The list starts with the ordinary and that is its point: you have been seeing animals all along."
                ],
                media: img(
                    "how-to-keep-track-of-animals-you-have-seen",
                    "european-robin",
                    "European robin perched on a wire in front of a brick wall",
                    1400,
                    931,
                    "European robin (Erithacus rubecula): the first entry on a great many life lists. Photo: Neil McIntosh, CC BY 2.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["european-robin", "american-robin", "house-sparrow"]
            },
            {
                title: "Rules for your own list",
                paragraphs: [
                    "You do not have to adopt the ABA's rulebook, but you should decide your rules once and apply them every time. The table shows how birders and herpers handle the common questions and what a general wildlife list usually does."
                ],
                table: {
                    columns: ["Question", "Birders (ABA rules)", "Herpers (common practice)", "A general wildlife list"],
                    rows: [
                        {cells: ["Captive animals", "Not countable", "Kept off the field list", "Keep, but record setting: zoo, farm, domestic"]},
                        {cells: ["Heard but not seen", "Countable", "Usually a separate heard-only note", "Note it; a capture still needs a photo"]},
                        {cells: ["Dead on road", "Not countable", "Separate DOR list", "Record, mark as dead"]},
                        {cells: ["Uncertain identification", "Not countable", "Logged to genus or group", "Group-level entry, upgrade later"]},
                        {cells: ["Established introduced species", "Countable (e.g. house sparrow in the Americas)", "Countable, often flagged", "Countable, note it"]},
                        {cells: ["Evidence required", "None; honesty system", "Photo strongly preferred", "Photo per capture"]}
                    ]
                }
            },
            {
                title: "New encounters and past encounters",
                paragraphs: [
                    "New encounters belong to live capture in AnimalDex: a photo taken in the app at the moment of the sighting, with identity, setting and location attached. That is the equivalent of the birder's field notebook entry, made on the spot.",
                    "Past encounters can come from eligible Instagram wildlife posts after you review identity and location. AnimalDex looks through a connected professional account for animal posts; you confirm what each shows, where it was and whether it was wild or captive; the original media becomes a capture. Wildlife memories often pre-date the app you eventually choose to track them in. Install day does not have to be day one."
                ],
                inlineLinks: [useCaseLinks.collection, useCaseLinks.importIg]
            },
            {
                title: "What not to expect from a life list",
                paragraphs: [
                    "Not every photo resolves to a species. A gull in winter plumage, a brown lizard at speed, a bat at dusk: some animals stay at group level when that is the honest catalogue result. Imported posts build the collection; they do not add qualifying live-capture wildlife signals for Creator Rewards, which is currently paused. And a list is not a competition unless you want it to be. Most people find the number matters less than the memory each entry brings back."
                ],
                cards: [
                    {label: "Write your rules", body: "Captive, heard-only, dead on road, uncertain ID. Decide once, apply every time."},
                    {label: "List from memory", body: "Garden, zoo trips, holidays, pets excluded or included by your rule. Most adults reach fifty species in ten minutes."},
                    {label: "Check the archive", body: "Instagram and the camera roll hold encounters you forgot. Review before you count."},
                    {label: "Capture the next one", body: "Tomorrow's pigeon counts. Take it live, in the app, with the place confirmed."}
                ],
                inlineLinks: [{text: "Wildlife photography life list", slug: "wildlife-photography-life-list", href: "/blog/wildlife-photography-life-list"}]
            }
        ],
        faq: [
            {question: "What is a life list?", answer: "A life list is a running record of every species a person has identified in their lifetime, with one entry per species and usually the date and place of the first encounter. Birders formalised it; the American Birding Association's rules count only wild, unrestrained, confidently identified birds. Herpers, mammal watchers and general wildlife fans keep the same kind of list with their own conventions."},
            {question: "Do zoo animals count on a life list?", answer: "Not under birding rules, which exclude captive and restrained animals, and not on a herper's field list. A general wildlife collection can keep them as long as each entry records its setting. AnimalDex stores wild, zoo, farm or domestic on every capture so the two kinds of record never merge."},
            {question: "Does a bird I only heard count?", answer: "Under ABA rules, yes: a bird identified by sound alone is countable. Many birders still keep a note of which entries were heard-only. In AnimalDex a heard-only bird is an encounter you can note, but a capture needs a photograph taken in the app."},
            {question: "How do I start tracking animals I saw years ago?", answer: "List what you remember first, then check where the photos live. Eligible wildlife posts on a compatible Instagram professional account can be reviewed into AnimalDex: confirm species or group, the historical place and the setting, and the original media becomes a capture. New sightings are live captures from then on."},
            {question: "Is there an app to track animals I have seen?", answer: "Yes. eBird tracks birds, iNaturalist tracks any organism as community-science observations, and AnimalDex keeps a species collection built from live in-app captures and reviewed Instagram imports, with setting and confirmed location on each entry. Many people use one platform for records and one for the collection."}
        ],
        sources: [
            {label: "American Birding Association: Recording Rules and Interpretations", href: "https://www.aba.org/aba-recording-rules-and-interpretations/"},
            {label: "About eBird (Cornell Lab of Ornithology)", href: "https://ebird.org/about"},
            {label: "iNaturalist help", href: "https://www.inaturalist.org/pages/help"}
        ]
    }),
    post({
        slug: "how-many-animals-have-you-already-encountered",
        title: "How Many Animals Have You Already Encountered?",
        description: "A realistic estimate of how many species a typical person has already seen from gardens, zoos, holidays and safaris, and how to get a number you trust.",
        featuredAlt: "Scattered wildlife memories becoming a structured record of animals encountered",
        readingMinutes: 5,
        tags: ["animals I have seen", "wildlife collection", "life list"],
        searchIntents: ["how many animal species have I seen", "animals I have seen", "animals I’ve encountered", "wildlife life list", "how many species does the average person see"],
        relatedSlugs: ["how-to-keep-track-of-animals-you-have-seen", "already-seen-hundreds-of-animals-start-collection", "turn-instagram-wildlife-archive-into-species-collection"],
        tableOfContents: [
            "The question is older than the app",
            "A realistic estimate",
            "Zoo and aquarium visits count, as captive records",
            "Do not count before you review",
            "How to get a number you trust"
        ],
        sections: [
            {
                title: "The question is older than the app",
                paragraphs: [
                    "How many different animals have I encountered? Which have I already found? How much of the animal world have I already seen? Those questions usually arrive years after the photos, often on a slow evening with a camera roll open.",
                    "A feed will not answer them. A reviewed collection can, as unique AnimalDex entries, including group-level identities when a species-level name would be a guess. But before the review, it helps to know what order of magnitude to expect, because most people guess low."
                ]
            },
            {
                title: "A realistic estimate",
                paragraphs: [
                    "There are roughly 11,000 bird species, more than 12,000 reptiles, around 8,800 amphibians and about 6,500 mammals described. Nobody sees most of them. But an ordinary life in a town, with a few holidays and a zoo visit or two, accumulates more species than people expect.",
                    "A suburban garden in Britain or the northern United States hosts 20 to 40 bird species over a year: house sparrow, blackbird or American robin, pigeons, a tit or chickadee or two, a gull overhead, a hawk once a season. Add grey squirrel, fox, a hedgehog or raccoon, bats at dusk, plus the butterflies, bees and dragonflies you could name, and the garden alone is 40 to 60 species."
                ],
                table: {
                    columns: ["Where", "Distinct species a typical person meets", "Notes"],
                    rows: [
                        {cells: ["Garden, street, local park", "40 to 60 over a year", "Birds dominate; add squirrels, fox, bats, common insects"]},
                        {cells: ["One large zoo visit", "50 to 150 in a day", "Large zoos hold several hundred species; you will not see them all, and they are captive records"]},
                        {cells: ["A week on a coast", "20 to 40", "Gulls, waders, cormorants, seals, crabs, rock-pool fish"]},
                        {cells: ["A three-day safari", "40 to 80", "Lion, elephant, giraffe, zebra, impala plus dozens of birds"]},
                        {cells: ["Aquarium visit", "30 to 100", "Captive; many will stay at group level (a ray, a jellyfish)"]},
                        {cells: ["Lifetime from memory", "100 to 200", "Most adults list this many in an hour; photos push it higher"]}
                    ]
                },
                media: img(
                    "how-many-animals-have-you-already-encountered",
                    "house-sparrow",
                    "Male house sparrow perched on a fence",
                    1400,
                    933,
                    "House sparrow (Passer domesticus), breeding male. Probably already on your list, whether or not you ever wrote it down. Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["house-sparrow", "rock-pigeon", "common-blackbird", "eastern-gray-squirrel", "red-fox"]
            },
            {
                title: "Zoo and aquarium visits count, as captive records",
                paragraphs: [
                    "A single afternoon at a large zoo can add more species than a year of garden watching. A meerkat on sentry duty, a giraffe, a tiger, a flamingo flock, a reptile house full of pythons and tree frogs: fifty to a hundred and fifty animals you can name, in captivity.",
                    "They count, as long as the record says what they are. Birders' life-list rules exclude captive animals; a general wildlife collection keeps them with a setting attached. AnimalDex records each capture as wild, zoo, farm or domestic, so the meerkat from the zoo and the fox from the garden sit in the same Dex without pretending to be the same kind of encounter."
                ],
                media: img(
                    "how-many-animals-have-you-already-encountered",
                    "meerkat-zoo",
                    "Meerkat standing upright on sentry duty",
                    1400,
                    933,
                    "Meerkat (Suricata suricatta) on sentry duty, a species most people first met in a zoo. Captive encounters count once the record says so. Photo: Gzen92, CC BY-SA 4.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["meerkat", "giraffe", "lion"]
            },
            {
                title: "Do not count before you review",
                paragraphs: [
                    "AnimalDex will not invent a species total from unreviewed Instagram posts. Connect a compatible professional account, let it find animal posts, then confirm identity and a historical place for each one before it imports. The Dex becomes clearer after that work, not before it.",
                    "Current GPS is not the location of a holiday photograph. Captions are not coordinates. A dog in the background of a beach photo is not a wildlife record, and a blurry brown bird at 60 m is a group-level entry, not a species. The number you end up with is smaller than a guess and far more useful."
                ],
                inlineLinks: [useCaseLinks.importIg]
            },
            {
                title: "How to get a number you trust",
                paragraphs: [
                    "An honest total takes an evening, not a week. Work in this order and resist counting until the end."
                ],
                cards: [
                    {label: "List from memory", body: "Garden, local park, every holiday, every zoo. Write species or groups. Expect 100 to 200."},
                    {label: "Check the archive", body: "Instagram, camera roll, old trip albums. Each will add animals you had forgotten."},
                    {label: "Mark the setting", body: "Wild, zoo, farm or domestic on every entry, before the number tempts you to blur them."},
                    {label: "Keep group-level entries honest", body: "A gull, a skink, a jellyfish. They count as what they are."},
                    {label: "Then count", body: "Two numbers: wild species and all species. Both are yours."}
                ],
                inlineLinks: [{text: "How to keep track of every animal you have seen", slug: "how-to-keep-track-of-animals-you-have-seen", href: "/blog/how-to-keep-track-of-animals-you-have-seen"}]
            }
        ],
        faq: [
            {question: "How many animal species has the average person seen?", answer: "Most adults can list 100 to 200 species from memory once gardens, parks, holidays and zoo visits are included, and photographs usually push the total higher. A suburban garden alone hosts 40 to 60 identifiable species in a year, and one large zoo visit can add 50 to 150 captive records in a day."},
            {question: "Do zoo animals count as animals I have seen?", answer: "Yes, as captive encounters. Birders' life-list rules exclude them from a wild list, so keep two numbers: wild species and all species. AnimalDex records the setting (wild, zoo, farm, domestic) on each capture so the counts stay separate without extra work."},
            {question: "How many bird species can I see in my garden?", answer: "Typically 20 to 40 over a year in a suburban garden in Britain or the northern United States, more with feeders, water and hedges. House sparrow, pigeons, a thrush or robin, tits or chickadees, finches, a corvid and a passing gull or hawk make up most of the list."},
            {question: "Can AnimalDex count the animals in my Instagram photos?", answer: "It can find animal posts on a compatible Instagram professional account, but it will not produce a species total until you review each candidate. You confirm identity, the historical place and the setting; eligible posts are then imported with their original media, and the Dex count reflects what you confirmed."}
        ],
        sources: [
            {label: "Cornell Lab of Ornithology, All About Birds: House Sparrow", href: "https://www.allaboutbirds.org/guide/House_Sparrow/overview"},
            {label: "British Trust for Ornithology: Garden BirdWatch", href: "https://www.bto.org/our-science/projects/garden-birdwatch"},
            {label: "The Reptile Database", href: "http://www.reptile-database.org/"},
            {label: "AmphibiaWeb", href: "https://amphibiaweb.org/"},
            {label: "IUCN Red List of Threatened Species", href: "https://www.iucnredlist.org/"}
        ]
    }),
    post({
        slug: "already-seen-hundreds-of-animals-start-collection",
        title: "Already Seen Hundreds of Animals? Don’t Start Over",
        description: "A wildlife collection does not have to begin on install day: where past encounters hide, what review asks, and how old trips and zoo visits join one Dex.",
        featuredAlt: "A wildlife collection that starts with history instead of a blank Dex",
        readingMinutes: 5,
        tags: ["wildlife collection", "past trips", "Instagram import"],
        searchIntents: ["track animals from past trips", "turn old wildlife photos into a species list", "wildlife collection app", "old wildlife photos", "safari photos species list"],
        relatedSlugs: ["how-to-keep-track-of-animals-you-have-seen", "wildlife-photos-sitting-on-instagram", "how-many-animals-have-you-already-encountered"],
        tableOfContents: [
            "Most collections start today. Yours doesn’t have to.",
            "Where your past encounters are hiding",
            "History and tomorrow are different paths",
            "A safari in 2019 is still a record",
            "What review actually asks"
        ],
        sections: [
            {
                title: "Most collections start today. Yours doesn’t have to.",
                paragraphs: [
                    "A new wildlife app usually means a blank list. That is a poor deal if you have already been to zoos, coasts and trails with a phone in your pocket for fifteen years. The encounters exist. The lion did not stop being a lion because you photographed it before the app existed.",
                    "AnimalDex is designed so eligible wildlife encounters from an existing Instagram archive can become part of your collection after review. Then keep going in the field with live capture. The collection ends up with two kinds of entry, both honest about where they came from."
                ],
                inlineLinks: [useCaseLinks.importIg, useCaseLinks.collection]
            },
            {
                title: "Where your past encounters are hiding",
                paragraphs: [
                    "Start with the mallard. It is the most widespread duck in the northern hemisphere, 50 to 65 cm long, the drake with the bottle-green head, the hen in streaked brown, and it sits on almost every park pond you have ever walked past. Almost everyone has photographed one. Almost nobody has it on a list. That is the pattern for the whole archive: the animals were common enough to photograph and ordinary enough to ignore."
                ],
                cards: [
                    {label: "Instagram posts", body: "The best source: a caption written on the day gives you place and context. Eligible posts can be reviewed and imported."},
                    {label: "Camera roll", body: "Park ducks, garden birds, a lizard on a holiday wall. Date stamps help; GPS is only a hint."},
                    {label: "Trip albums", body: "Safari, dive trip, coast week. Named after the place, which is exactly the problem a species index solves."},
                    {label: "Zoo and aquarium days", body: "Dozens of species per visit. They count as captive records, with the setting marked."},
                    {label: "Memory only", body: "No photo, no capture, but still a life-list entry in your own notes. The first hedgehog counts even unphotographed."}
                ],
                media: img(
                    "already-seen-hundreds-of-animals-start-collection",
                    "mallard-pair",
                    "Mallard drake and hen resting on bare ground",
                    1400,
                    933,
                    "Mallard (Anas platyrhynchos) pair. The most-photographed, least-recorded bird on most camera rolls. Photo: Diego Delso, CC BY-SA 3.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["mallard", "canada-goose", "rock-pigeon"]
            },
            {
                title: "History and tomorrow are different paths",
                paragraphs: [
                    "Past encounters and new ones enter the Dex differently, and the difference is deliberate."
                ],
                table: {
                    columns: ["", "Past encounter (import)", "New encounter (live capture)"],
                    rows: [
                        {cells: ["Source", "Eligible post on a compatible Instagram professional account", "Photo taken in the AnimalDex app at the moment of the sighting"]},
                        {cells: ["Identity", "You confirm species or group during review", "Identification assisted in the app; group level when honest"]},
                        {cells: ["Location", "You confirm the historical place; today's GPS is not used", "Where you are when you capture"]},
                        {cells: ["Setting", "You confirm wild, zoo, farm or domestic", "Recorded at capture"]},
                        {cells: ["Media", "Original photos and videos from the post", "The in-app photo"]},
                        {cells: ["Creator Rewards", "Never qualifying contribution", "Only live contribution ever qualified; programme currently paused"]}
                    ]
                }
            },
            {
                title: "A safari in 2019 is still a record",
                paragraphs: [
                    "A lion photographed in the Serengeti six years ago is a wild record of a species the IUCN lists as Vulnerable, with an estimated population in the low tens of thousands and falling. The encounter has not lost value with age. What it needs is a confirmed historical place, the park rather than the city you flew home to, a setting of wild, and an honest identity.",
                    "Lion, elephant, giraffe, zebra, impala, a dozen birds: one three-day safari typically yields 40 to 80 species, and most of them are sitting in a folder called Tanzania. Reviewed one by one, they become forty to eighty entries in a Dex, each searchable by animal."
                ],
                media: img(
                    "already-seen-hundreds-of-animals-start-collection",
                    "lion-safari",
                    "Lion resting in the grass in Serengeti National Park",
                    1400,
                    933,
                    "Lion (Panthera leo), Serengeti National Park, Tanzania. A six-year-old safari frame is still a wild record once its place and setting are confirmed. Photo: Diego Delso, CC BY-SA 4.0, via Wikimedia Commons."
                ),
                speciesSlugs: ["lion", "african-bush-elephant", "plains-zebra", "impala"]
            },
            {
                title: "What review actually asks",
                paragraphs: [
                    "Review is short per post and it is the whole reason the collection can be trusted. For each animal post AnimalDex finds, you answer five things: what the animal is (species, or group if the frame does not support more), where it actually was, whether it was wild or captive, whether more than one animal is in shot and which the record is for, and whether you stand by the accuracy of all of that. Imported posts may publish to Discover, so that last confirmation sits in front of import, not after it.",
                    "Not every post will import. Some will stay at group level. None of them will add qualifying live contribution for Creator Rewards, which is currently paused in any case. What you get is a collection that starts with history instead of a blank screen, and a field habit that carries on from there."
                ],
                inlineLinks: [{text: "Wildlife photos sitting on Instagram", slug: "wildlife-photos-sitting-on-instagram", href: "/blog/wildlife-photos-sitting-on-instagram"}, {text: "How many animals have you already encountered?", slug: "how-many-animals-have-you-already-encountered", href: "/blog/how-many-animals-have-you-already-encountered"}]
            }
        ],
        faq: [
            {question: "Can I add animals from past trips to a wildlife collection?", answer: "Yes. Eligible wildlife posts on a compatible Instagram professional account can be reviewed into AnimalDex: you confirm species or group identity, the historical place of the photo and the setting, and the original media becomes a capture. Camera-roll photos that were never posted are not imported this way, but they still belong on your own life list."},
            {question: "Do old safari photos count as wildlife records?", answer: "Yes, if the record is honest about place and setting. A lion photographed in the Serengeti in 2019 is a wild record of a Vulnerable species; it needs the park as its location, not the city you uploaded from, and the setting marked as wild. Age does not reduce its value."},
            {question: "What is the difference between an imported post and a live capture?", answer: "An imported post is a past encounter reviewed from Instagram: you confirm identity, historical place and setting, and the original media is added. A live capture is a photo taken in the AnimalDex app at the moment of a new sighting. Both sit in the same Dex; only live contribution ever counted toward Creator Rewards, which is currently paused."},
            {question: "Why does AnimalDex make me review every imported post?", answer: "Because a collection built from unreviewed captions and GPS tags would be wrong in ways you could not find later. Review confirms the animal, the place, the setting and which animal a multi-species photo is for, and because imported posts may publish to Discover, it includes an accuracy confirmation."}
        ],
        sources: [
            {label: "Cornell Lab of Ornithology, All About Birds: Mallard", href: "https://www.allaboutbirds.org/guide/Mallard/overview"},
            {label: "IUCN Red List of Threatened Species", href: "https://www.iucnredlist.org/"},
            {label: "Britannica: lion", href: "https://www.britannica.com/animal/lion"}
        ]
    })
];

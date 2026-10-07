import {blogHrefs, earnFacts, supportArticleHrefs} from "@/data/earn-economy";
import {earnBlogPost, earnRelatedLinks} from "@/data/blog/earn/_shared";
import {contentThumb} from "@/data/content-thumbnails";
import type {BlogPost} from "@/data/blog/types";

const publishedAt = "2026-08-30";
const updatedAt = "2026-10-07";

const indexesPostLink = {
    text: "How AnimalDex indexes animals",
    slug: "how-animaldex-indexes-animals",
    href: "/blog/how-animaldex-indexes-animals"
};

const photographyCompanionLink = {
    text: "Wildlife photography companion app",
    slug: "wildlife-photography-companion-app",
    href: "/use-cases/wildlife-photography-companion-app"
};

const herpingJournalLink = {
    text: "Herping field journal",
    slug: "herping-field-journal",
    href: "/use-cases/herping-field-journal"
};

const instagramImportLink = {
    text: "Import Instagram wildlife photos",
    slug: "import-instagram-wildlife-photos",
    href: "/use-cases/import-instagram-wildlife-photos"
};

const gradeFactorsTable = {
    columns: ["Grade factor", "What it looks at", "What you control in the field"],
    rows: [
        {cells: ["Clarity", "Focus on the animal, motion blur, noise", "Shutter speed, steadying the phone, waiting for the pause"]},
        {cells: ["Framing", "How much of the frame the animal fills and where it sits", "Distance, crouching to eye level, not centring everything"]},
        {cells: ["Identification confidence", "Whether the photo shows the features that separate the species", "Side-on angle, visible legs, bill, wing tips or markings"]},
        {cells: ["Visible detail", "Feather, scale or fur texture and the eye", "Light direction, getting closer without flushing the animal"]},
        {cells: ["Context", "Habitat and setting around the animal", "Leaving reeds, bark or sand in the frame instead of cropping to a head"]}
    ]
};

export const creatorEarnBlogPosts: BlogPost[] = [
    earnBlogPost({
        slug: "how-wildlife-photographers-can-build-a-digital-species-collection",
        canonicalUrl: `https://animaldex.app${blogHrefs.photographerCollection}`,
        title: "How to Build a Digital Species Collection as a Photographer",
        description:
            "Turn field photos into a searchable species collection: what counts as a capture, how a card gets indexed, and the field habit that keeps the list honest.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-wildlife-photographers-can-build-a-digital-species-collection"),
        readingMinutes: 7,
        tags: ["wildlife photography", "species collection", "creators"],
        searchIntents: [
            "wildlife photography app",
            "organize wildlife photos by species",
            "wildlife collection app",
            "digital species collection",
            "species list for wildlife photographers"
        ],
        speciesSlugs: ["willow-warbler", "common-chiffchaff", "great-egret", "snowy-egret"],
        relatedSlugs: [
            "why-every-wildlife-photographer-should-track-the-species-they-photograph",
            "can-wildlife-photography-make-money",
            "how-animaldex-rewards-genuine-wildlife-contribution"
        ],
        tableOfContents: [
            "A camera roll is not a species record",
            "What AnimalDex actually indexes",
            "Honest identification: the lookalike groups",
            "A field habit that sticks",
            "What the grade actually scores",
            "What this page is not promising"
        ],
        sections: [
            {
                title: "A camera roll is not a species record",
                paragraphs: [
                    "Most wildlife photographers already shoot more than they can name. After three seasons the archive is tens of thousands of frames sorted by date, and the useful questions are the ones a date cannot answer: which warbler was that, on which morning, and have you actually photographed the species before? Keyword tagging in a desktop catalog solves this only if you do it every time, and almost nobody does.",
                    "A species collection inverts the problem. The unit is the animal identity, not the file. One record per species, with the captures that back it up, and the list is readable in a minute: 212 species, 31 of them herps, nothing from the coast since March. That is a list you can plan a trip around.",
                    "AnimalDex is built as a live capture collection. You photograph an animal with the in-app camera, analysis resolves a catalog card, and that card is the thing you collect. The photo stays attached to a named index instead of sinking into a date-sorted camera roll."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-wildlife-photographers-can-build-a-digital-species-collection/photographer-telephoto-field.webp",
                        alt: "A desert tortoise walking across sand toward a photographer lying prone with a telephoto lens",
                        width: 1400,
                        height: 900,
                        caption: "Eye level, animal in habitat, photographer still: the frame that resolves cleanly and reads well in a collection. Photo: Joshua Tree National Park, Public domain, via Wikimedia Commons."
                    }
                },
                inlineLinks: [photographyCompanionLink]
            },
            {
                title: "What AnimalDex actually indexes",
                paragraphs: [
                    "AnimalDex numbers belong to resolved catalog cards, not to every name the analysis text mentions. The rule is species by default, a shared group card only for large lookalike families that phone photos cannot fairly split, and domestic breeds or colour morphs folded into the base animal. A German Shepherd indexes as Domestic Dog. A confident live heron becomes its own species card. A small brown tree frog may land on the Tree Frog group card.",
                    "For a photographer who wants an honest list this is the point. You are not minting a new entry every time the model mentions a subspecies, and you are building the same public catalog every other collector uses, so your 212 species mean the same thing as someone else's 212."
                ],
                table: {
                    columns: ["What you photographed", "What gets indexed", "Why"],
                    rows: [
                        {cells: ["A grey heron at a reedbed", "Species card", "Distinct wild species, visible features, not in a lookalike list"]},
                        {cells: ["A small green tree frog at night", "Tree Frog group card", "Many canopy frogs cannot be separated from a phone photo"]},
                        {cells: ["Your neighbour's Border Collie", "Domestic Dog", "Breeds fold to the base animal"]},
                        {cells: ["A named Desert Locust", "Species card", "Named insects stay species; only broad keys like “grasshopper” group"]},
                        {cells: ["A blur you cannot identify", "No new number", "Missing or unusable identity does not mint a card"]}
                    ]
                },
                inlineLinks: [indexesPostLink]
            },
            {
                title: "Honest identification: the lookalike groups",
                paragraphs: [
                    "The lookalike problem is not an app problem. It is a field problem that birders have argued about for a century. Willow warbler and common chiffchaff are near-identical olive-green leaf warblers around 11 cm long. In the hand the separation is primary projection and leg colour, with the willow warbler's wing tip longer and its legs usually pale; in the field it is the song, a descending cascade versus the two-note “chiff-chaff”. A silent bird photographed from below is often an honest tick for the group, not the species.",
                    "Great egret and snowy egret are the other classic. Both are white herons, but the great egret stands close to a metre tall with a yellow bill and black feet, and the snowy egret is much smaller, around 60 cm, with a black bill and yellow feet. If the feet are in the frame the call is easy. If you cropped them out, the photo cannot prove what you saw.",
                    "A species record is only as good as the weakest identification in it. Log the pair you can prove. Add the field note that would let someone else check it. Leave the maybe out, or let it resolve to a group card rather than guessing a species for the sake of a number."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-wildlife-photographers-can-build-a-digital-species-collection/willow-warbler-lookalike.webp",
                        alt: "A willow warbler perched on a twig among alder leaves",
                        width: 1400,
                        height: 933,
                        caption: "Willow warbler: pale legs and a long wing tip separate it from a chiffchaff, if the photo shows them. Photo: Lloyd Tudor, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["willow-warbler", "common-chiffchaff", "great-egret", "snowy-egret"]
            },
            {
                title: "A field habit that sticks",
                paragraphs: [
                    "The collection only works if the capture happens in the field. Gallery uploads are not how AnimalDex records a live sighting, so the habit has to fit between the moments you are already shooting with the big camera."
                ],
                cards: [
                    {label: "Phone after the frame, not instead of it", body: "Take the shot you came for on the camera, then take the capture on the phone while the animal is still there. A heron will usually give you both; a warbler often will not, so decide which one you want first."},
                    {label: "Enough body to identify", body: "A head-and-shoulders crop looks good and identifies badly. Keep legs, bill, wing tips or flank markings in the capture. Those are the features the identification confidence factor is looking for."},
                    {label: "Let analysis finish", body: "Walk on before the capture resolves and you lose the context. Wait the few seconds, check the card it landed on, and correct a lookalike while you still remember what you saw."},
                    {label: "Same species, new context", body: "Separate captures of the same species keep their own grade and context. A sanderling on a beach in October and the same species on a mudflat in May are both worth having; only the catalog card is counted once."},
                    {label: "Note what you did not get", body: "A gap list is a shot list. If the day's captures were all birds, the next outing has a direction: night, pond edge, or the hedge you always walk past."}
                ]
            },
            {
                title: "What the grade actually scores",
                paragraphs: [
                    "Grade is a 1–10 quality score for a specific capture, not a measure of the animal. The same species can hold a 9 and a 3 in the same collection. A sharp, well-lit live bird with its habitat in frame will outrank a distant blur of a rarer species every time, which is exactly how a photographer would judge the two frames.",
                    "The factors below are the ones the product describes. None of them is about luck; all of them are the things you already adjust when the light changes."
                ],
                table: gradeFactorsTable
            },
            {
                title: "What this page is not promising",
                paragraphs: [
                    "A collection is not a payout. Credits you spend on scans stay Credits and cannot be converted to cash. Creator Rewards, the company-funded program designed to recognise live contribution during open periods, is currently paused with no published reopen date. The reason to index species now is the record itself: a list you can search, compare and keep building, and the option to apply as an AnimalDex Wildlife Guide once the wild-collection gates of 45 wild captures, 20 wild species and a 30-day account are met."
                ],
                pullQuote: "The unit you collect is the animal identity, not the file. One card per species, backed by the captures that prove it.",
                inlineLinks: [earnRelatedLinks.creator, earnRelatedLinks.guide, earnRelatedLinks.earn]
            }
        ],
        faq: [
            {
                question: "Can I upload my existing wildlife Lightroom catalog to AnimalDex?",
                answer: "No. AnimalDex records live in-app captures, and gallery uploads are not captures. It is not a bulk importer for a desktop archive. The one exception is the Instagram import for compatible professional accounts, which reviews each eligible post for species and a historical location before it becomes part of the collection."
            },
            {
                question: "Does every photo become its own AnimalDex number?",
                answer: "No. The collectible number belongs to the resolved catalog card, so a species is counted once however many times you capture it. Each capture still keeps its own grade, context and media, which is why a second capture of a common species in a new habitat is still worth making."
            },
            {
                question: "What is a lookalike group card?",
                answer: "A lookalike group card is a single collectible entry shared by a family of animals that phone photos cannot reliably separate, such as many tree frogs or broad insect keys like “mosquito”. It is a real card with a number. Named species outside those lists, including most birds and mammals, still get their own species card."
            },
            {
                question: "How do I organise wildlife photos by species without an app?",
                answer: "Use keywords in your desktop catalog with the scientific name as the keyword, so Phylloscopus trochilus and willow warbler cannot drift apart, and keep a flat species spreadsheet with first-photographed date and location. The weakness is discipline: it only works if every import gets keyworded, which is the step most people skip."
            }
        ],
        sources: [
            {label: "Cornell Lab of Ornithology, All About Birds", href: "https://www.allaboutbirds.org/"},
            {label: "RSPB, bird identification guides", href: "https://www.rspb.org.uk/"},
            {label: "IUCN Red List of Threatened Species", href: "https://www.iucnredlist.org/"}
        ]
    }),
    earnBlogPost({
        slug: "can-wildlife-photography-make-money",
        canonicalUrl: `https://animaldex.app${blogHrefs.photographyIncome}`,
        title: "Can Wildlife Photography Make Money? Realistic Income Routes",
        description:
            "Wildlife photography income mixes licensing, assignments, prints, workshops and guiding. How each route really pays, and where an app actually fits.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("can-wildlife-photography-make-money"),
        readingMinutes: 6,
        tags: ["wildlife photography", "creators", "earning"],
        searchIntents: [
            "can wildlife photography make money",
            "wildlife photography income",
            "earn from wildlife photography",
            "how do wildlife photographers make money",
            "sell wildlife photos"
        ],
        speciesSlugs: [],
        relatedSlugs: [
            "how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income",
            "how-animaldex-rewards-genuine-wildlife-contribution",
            "how-wildlife-photographers-can-build-a-digital-species-collection"
        ],
        tableOfContents: [
            "The honest market",
            "Income routes compared",
            "Prints: the margin lives in the edit",
            "Guiding is the local route that uses your knowledge",
            "What a species list does for a portfolio",
            "What AnimalDex does and does not pay",
            "A practical mix"
        ],
        sections: [
            {
                title: "The honest market",
                paragraphs: [
                    "Yes, wildlife photography can make money. Very few people make a full living from it, and almost none of them make it from one source. The working pattern is a stack: some licensing, some editorial or commissioned work, prints, teaching, guiding, and in a good year a grant or a competition. Nobody gets paid per nice bird.",
                    "The reason is supply. The cameras got good, the long lenses got cheaper, and every reserve now has a dozen people with 600 mm of glass pointed at the same kingfisher. Generic images of common species are close to worthless as stock. What still sells is specificity: a behaviour nobody else has, a species nobody else has covered, a place you can get to on a Tuesday that the agency photographer cannot."
                ]
            },
            {
                title: "Income routes compared",
                paragraphs: [
                    "Each route below pays in a different shape. Some pay small amounts forever, some pay once and well, and some pay cash on the day. The “realistic framing” column is the part people selling courses tend to leave out."
                ],
                table: {
                    columns: ["Route", "How it pays", "Realistic framing", "What it needs from you"],
                    rows: [
                        {cells: ["Stock licensing", "Per download or per licence, often a small royalty share", "Microstock pays cents to a few dollars per use; rights-managed sales are rarer but larger", "Volume, accurate species keywords, model and property releases where relevant"]},
                        {cells: ["Editorial and assignments", "Day rate or per-story fee", "Competitive and slow; relationships with editors matter more than gear", "Reliability, captions that are correct, the ability to deliver a sequence not one hero frame"]},
                        {cells: ["Prints and books", "Margin on each sale", "Margins are real but the audience has to be built first", "A tight edit, print-quality files, a way to ship without damage"]},
                        {cells: ["Workshops and tours", "Per seat", "Steadiest route for established names; logistics eat time", "Teaching ability, insurance, permits, reliable sites"]},
                        {cells: ["Local guiding", "Per person, often cash on the day", "Small but immediate; scales with local knowledge, not follower count", "Knowing the site in every season, honest expectations, the permits the land requires"]},
                        {cells: ["Brand and ambassador work", "Fee, gear, or both", "Goes to people with an audience or a distinctive body of work", "A public species record or portfolio a brand can point at"]},
                        {cells: ["Competitions and grants", "Prize or funded project", "Lottery odds for the big ones; smaller regional ones are winnable", "Original files, honest captions, no baiting or staging"]}
                    ]
                }
            },
            {
                title: "Prints: the margin lives in the edit",
                paragraphs: [
                    "Prints are the route most photographers try first and abandon fastest, because they price the print and not the business around it. A 40 cm fine-art print might cost you a fraction of its sale price in paper and ink, but the frame, the packaging, the shipping, the payment fees and the returns are where the margin goes. The people who make prints work sell a small edit of ten to twenty images, not the whole archive.",
                    "The second thing that makes prints work is a reason to buy that one. A local species, a local place, a behaviour with a story: a sanderling on the beach the buyer walks every Sunday outsells a technically better image of a bird they have never heard of."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/can-wildlife-photography-make-money/prints-spread-table.webp",
                        alt: "Photographic prints laid out across a wooden table beside a window",
                        width: 1400,
                        height: 1054,
                        caption: "A print edit on the table: the small set you can stand behind, not the archive. Photo: Lombres, CC BY 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Guiding is the local route that uses your knowledge",
                paragraphs: [
                    "If you already know a wetland at first light, or which public trail goes quiet after rain, other people will pay for that time. That is guiding, not licensing, and it is the one route where a modest portfolio and deep local knowledge beat a famous name with no idea where the heron roosts. The customer is buying orientation: where to stand, when to arrive, how not to flush the bird for everyone else.",
                    "AnimalDex Wildlife Guides is a live beta for exactly this. Approved locals list a real-money experience with an area, a duration and a per-person price; collectors request a date; the guide accepts; and the guest pays the guide cash on the day. AnimalDex does not collect the cash. Completing the outing records seller net on Earnings. You still need any permits the land requires, and you still cannot promise a sighting."
                ],
                media: {
                    type: "gallery",
                    title: "Guiding sells orientation, not the animal",
                    images: [
                        {
                            src: "/images/blog/can-wildlife-photography-make-money/guided-birding-group.webp",
                            alt: "Local bird guides carrying a spotting scope and binoculars beside cycle rickshaws on a reserve track, with a visitor listening",
                            width: 1400,
                            height: 928,
                            caption: "Local guides at Keoladeo National Park, India: the scope, the track and the timing are the product. Photo: PJeganathan, CC BY-SA 4.0, via Wikimedia Commons."
                        },
                        {
                            src: "/images/blog/can-wildlife-photography-make-money/guided-birding-group-b.webp",
                            alt: "Three birdwatchers in tall grass, two with binoculars and one at a spotting scope on a tripod",
                            width: 1400,
                            height: 931,
                            caption: "Birders with binoculars and a scope on open grassland. Photo: U.S. Fish and Wildlife Service, National Conservation Training Center, Public domain, via Wikimedia Commons."
                        }
                    ]
                },
                inlineLinks: [earnRelatedLinks.guide, earnRelatedLinks.marketplace]
            },
            {
                title: "What a species list does for a portfolio",
                paragraphs: [
                    "Editors and picture researchers search by species, not by mood. The query is “osprey carrying fish, vertical, northern Europe”, and the photographer who can answer it in five minutes gets the licence. A species-indexed collection is how you answer in five minutes. It is also the quickest proof of range when a brand or a tour company asks what you actually shoot.",
                    "The same list tells you what to go and get. If your last two years are 80 percent waders and no herps, that is a portfolio gap and a sales gap at the same time."
                ],
                inlineLinks: [
                    {text: "Why photographers should track the species they photograph", slug: "why-every-wildlife-photographer-should-track-the-species-they-photograph", href: blogHrefs.trackSpecies}
                ]
            },
            {
                title: "What AnimalDex does and does not pay",
                paragraphs: [
                    "Creator Rewards is designed as a company-funded allocation during open periods for eligible live contribution. It is currently paused. It will never be “Credits times a rate” or “Score times a rate”, and there is no per-capture fee. Do not plan rent around it.",
                    "Credits are not cash and cannot be withdrawn. Sponsored Challenges, which a zoo, park or brand can run inside the app, pay achievements today, not cash. The only real-money flow on the platform right now is the guide route above, and that money passes from guest to guide in person.",
                    "The useful move is still the same whichever program is open: original live captures, breadth across groups, and capture quality. That work has value in the collection even when no period is paying, and it is the same work that makes the other six rows of the table easier."
                ],
                inlineLinks: [earnRelatedLinks.creator, earnRelatedLinks.earn, earnRelatedLinks.sponsor]
            },
            {
                title: "A practical mix",
                paragraphs: [
                    "Keep licensing and assignments if you have them; they are slow but they compound. Build a print edit of fifteen images with local stories. Use AnimalDex to keep a public species record, and if you meet the wild-collection gates, list the guided morning you already know how to run. Treat Creator Rewards as a possible later program, not income you can invoice against."
                ],
                pullQuote: "What still sells is specificity: a behaviour nobody else has, a species nobody else has covered, a place you can reach on a Tuesday.",
                inlineLinks: [
                    {text: "How to become a Wildlife Guide with AnimalDex", slug: "how-to-become-a-wildlife-guide-with-animaldex", href: blogHrefs.becomeGuideHowTo}
                ]
            }
        ],
        faq: [
            {
                question: "Does AnimalDex pay photographers for uploading photos?",
                answer: "No. Live captures build a collection; they do not earn a fee. Credits are not cash and cannot be withdrawn. Creator Rewards is paused, and when it runs it is a company-funded allocation for eligible live contribution, not a per-photo rate. The only real-money flow today is Wildlife Guides, where the guest pays the guide cash on the day."
            },
            {
                question: "How much do wildlife photographers earn from stock photography?",
                answer: "Usually very little per image. Microstock licences commonly pay cents to a few dollars per download and the photographer keeps a share of that. Rights-managed or editorial licences pay more but sell far less often. Stock works as a long tail on a large, well-keyworded archive rather than as a primary income."
            },
            {
                question: "Can you make a living as a wildlife photography guide?",
                answer: "Some people do, usually by combining guiding with workshops and tours at sites they know in every season. Local guiding on its own is more often a side income: small groups, a per-person price, cash on the day, and permits where the land requires them. Nobody can promise sightings, and the customers who return are the ones you were honest with."
            },
            {
                question: "What sells better, prints or licensing?",
                answer: "Prints usually earn more per sale and licensing earns more often, so the answer depends on whether you have an audience. A local following will buy prints of local species and places. Without one, a well-keyworded archive on licensing platforms earns slowly without you shipping anything. Most working photographers run both."
            }
        ],
        sources: [
            {label: "U.S. Copyright Office, copyright basics for photographs", href: "https://www.copyright.gov/"},
            {label: "American Society of Media Photographers, licensing guidance", href: "https://www.asmp.org/"},
            {label: "National Audubon Society, guide to ethical bird photography", href: "https://www.audubon.org/get-outside/audubons-guide-ethical-bird-photography"}
        ]
    }),
    earnBlogPost({
        slug: "how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income",
        canonicalUrl: `https://animaldex.app${blogHrefs.guidingSideIncome}`,
        title: "Turn Local Wildlife Knowledge Into a Guiding Side Income",
        description:
            "Know the public paths, seasons and honest expectations for local wildlife? What a guided outing sells, what it needs, and how cash on the day works.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income"),
        readingMinutes: 6,
        tags: ["wildlife-guides", "earning", "birding"],
        searchIntents: [
            "wildlife guiding side income",
            "become local nature guide",
            "earn money wildlife spotting",
            "how to become a birding guide",
            "start guiding wildlife walks"
        ],
        speciesSlugs: [],
        relatedSlugs: [
            "can-wildlife-photography-make-money",
            "from-birding-to-herping-build-a-public-record-of-what-you-find",
            "how-wildlife-photographers-can-build-a-digital-species-collection"
        ],
        tableOfContents: [
            "Knowledge is the product. The animal is not.",
            "What a guided outing actually sells",
            "Know the site like a resident",
            "Eligibility is a collection problem first",
            "Price, permits and promises",
            "Cash on the day, record after"
        ],
        sections: [
            {
                title: "Knowledge is the product. The animal is not.",
                paragraphs: [
                    "People pay for orientation: where to stand, how early to arrive, what “quiet” actually means on that trail, and how not to wreck the morning for the animal and for everyone behind you. They do not pay you to manufacture a sighting, and the guides who last are the ones who say so in the first sentence of the listing.",
                    "That is good news for anyone with a decade of Sunday walks and no famous portfolio. The person who knows that the kingfisher uses the downstream perch after 8 a.m. and the upstream one before has something a visiting photographer with better glass cannot buy anywhere else.",
                    "An AnimalDex Wildlife Guide listing is a public pitch for that orientation: category, area, duration, guest limit and a real-money price per person. Exact meeting points stay private until you accept a request."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income/nature-guide-group.webp",
                        alt: "A guide holding a site map talks to a small group in sun hats on a scrubland trail",
                        width: 1400,
                        height: 933,
                        caption: "A guided walk is mostly talking: where to look, when, and why. Photo: USFWS Pacific Southwest Region, Public domain, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "What a guided outing actually sells",
                paragraphs: [
                    "Break a good morning down and the animal is a small part of it. The rest is a set of decisions you have already made hundreds of times and the guest has never made once."
                ],
                cards: [
                    {label: "Timing", body: "Dawn for songbirds, the hour after sunset for frogs, a falling tide for waders. Knowing which of these applies to the site this month is half the value."},
                    {label: "Position", body: "Which bank has the sun behind you, where the path bends so you arrive unseen, and the spot you stop at so the whole group sees the heron before it sees them."},
                    {label: "Etiquette", body: "Voices down, no sudden arm-waving at the bird, no playback, no feeding, no handling. A guest who learns this once will carry it to every reserve after."},
                    {label: "Interpretation", body: "Why the egret shuffles its feet, why the newts are only in the shallow end, why the warbler you can hear and cannot see is still a tick. Stories are what people repeat at dinner."},
                    {label: "Honest expectation", body: "“We usually see twenty species and the otter about one morning in five” is a sentence that books repeat customers. “Guaranteed otter” books one refund."}
                ]
            },
            {
                title: "Know the site like a resident",
                paragraphs: [
                    "Resident knowledge is seasonal and specific. A grey heron is a good test. It stands around 90 to 98 cm tall with a wingspan close to two metres, and it fishes the same reed margin at the same stage of light for weeks at a time, yet visitors walk past the reedbed because they are looking for something that moves. The guide who knows the bird's stretch of water, the direction it faces into the wind and the week the colony becomes noisy in late winter is offering something no field guide contains.",
                    "Keep the same depth of notes for the unglamorous animals. Where the slow-worms bask on the compost edge, which pond has newts in April, which hedge the first chiffchaff sings from in March. The breadth is what turns a bird walk into a wildlife walk, and it is the breadth a public species record makes visible."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income/wetland-dawn-heron.webp",
                        alt: "A grey heron standing in shallow water in front of a tall green reedbed",
                        width: 933,
                        height: 1400,
                        caption: "A grey heron at the reed margin in the Tay reedbeds, Scotland. Residents know which stretch, and when. Photo: SwiftlyGinger, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Eligibility is a collection problem first",
                paragraphs: [
                    "You apply after 45 qualifying wild captures, 20 wild species and a 30-day-old account, plus an 18+ attestation and the current Guide Seller Terms. Meeting those numbers lets you apply. A person still reviews the application, and that gate exists so the marketplace is not an open classifieds board. It is not a promise that every birder who hits 45 captures is approved."
                ],
                table: {
                    columns: ["Gate", "Threshold", "Why it exists"],
                    rows: [
                        {cells: ["Qualifying wild captures", `${earnFacts.wildCaptures}`, "Shows you have been out, repeatedly, with the in-app camera"]},
                        {cells: ["Wild species", `${earnFacts.wildSpecies}`, "Shows breadth beyond one easy bird at one feeder"]},
                        {cells: ["Account age", `${earnFacts.accountAgeDays} days`, "Keeps throwaway accounts out of a real-money marketplace"]},
                        {cells: ["18+ attestation and Seller Terms", "Required", "You are selling a service to the public under your own name"]},
                        {cells: ["Human review", "Every application", "Numbers open the door; a person decides who walks through it"]}
                    ]
                },
                inlineLinks: [earnRelatedLinks.guide, {text: "How do I become a Wildlife Guide?", slug: "how-do-i-become-a-wildlife-guide", href: supportArticleHrefs.becomeGuide}]
            },
            {
                title: "Price, permits and promises",
                paragraphs: [
                    "Price per person for a two- to three-hour walk, and cap the group where you can still keep everyone quiet; six is a common ceiling for birds, fewer for herps at night. Check what the land requires before you list. Many reserves, national parks and some councils require a permit or a concession for commercial guiding even on public paths, and some forbid it. Public liability insurance is cheap compared with one slip on a boardwalk.",
                    "Say what you offer in terms of access as well as wildlife. A flat, surfaced circuit with benches is a different product from a muddy scramble, and plenty of keen naturalists use a wheelchair, a stick or a pushchair. If the heron path is accessible, say so; it is a selling point, not a disclaimer.",
                    "Never promise a sighting. Promise the morning: the route, the start time, the number of species you usually get, and the animal you sometimes get."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income/birders-binoculars-trail-b.webp",
                        alt: "An older man in a wheelchair holding binoculars on a paved path under park trees",
                        width: 1400,
                        height: 934,
                        caption: "Accessible routes are part of the listing: a surfaced path with good cover is a product in itself. Photo: USFWS Headquarters, Public domain, via Wikimedia Commons."
                    }
                },
                inlineLinks: [
                    {text: "What makes a great ethical Wildlife Guide", slug: "what-makes-a-great-ethical-wildlife-guide", href: blogHrefs.ethicalGuide}
                ]
            },
            {
                title: "Cash on the day, record after",
                paragraphs: [
                    "The collector pays you in person. AnimalDex does not process the payment and never holds it. When you mark the outing complete, seller net is recorded on Earnings so you have a record of what the guiding side of the account has done. Credits are never part of the booking, and nothing you earn from a scan, a mission or a comparison win moves across to the Earnings side.",
                    "That split is deliberate. It keeps the game economy and the real-money marketplace on different sides of a wall, so a guide's reputation rests on walks that happened, not on Credits bought."
                ],
                pullQuote: "Promise the morning, not the animal: the route, the start time, the species you usually get, and the one you sometimes get.",
                inlineLinks: [
                    {text: "How Guide bookings and payments work", slug: "how-do-wildlife-guide-bookings-and-payments-work", href: supportArticleHrefs.guidePayments},
                    earnRelatedLinks.experiences
                ]
            }
        ],
        faq: [
            {
                question: "Do I need a licence to guide wildlife walks?",
                answer: "Often, yes, depending on the land. Many national parks, nature reserves and some local authorities require a permit or commercial concession to guide paying guests, even on public paths, and some prohibit it. Check with the landowner or managing body before listing, and carry public liability insurance. AnimalDex requires you to hold whatever the law and the site require."
            },
            {
                question: "How much can I charge for a guided birding walk?",
                answer: "Local guided walks are commonly priced per person for two to three hours, with small groups of about four to six. Set the price against the local market and what the morning reliably delivers, not against a famous tour operator. Guests pay you cash on the day; AnimalDex does not take the payment or a cut of it."
            },
            {
                question: "What do I need to apply as an AnimalDex Wildlife Guide?",
                answer: "An account at least 30 days old with 45 qualifying wild captures and 20 wild species, an 18+ attestation and acceptance of the current Guide Seller Terms. Meeting the numbers lets you apply; a person then reviews the application. Approval is not automatic."
            },
            {
                question: "Can I guarantee a sighting on a guided walk?",
                answer: "No, and you should not try. Wild animals do not keep appointments, and a listing that promises one books refunds. Describe the route, the start time and what the walk usually produces, including how often the headline animal shows. AnimalDex guide terms also forbid baiting, playback and disturbance to force a sighting."
            }
        ],
        sources: [
            {label: "National Park Service, watching wildlife responsibly", href: "https://www.nps.gov/subjects/watchingwildlife/index.htm"},
            {label: "RSPB, grey heron", href: "https://www.rspb.org.uk/"},
            {label: "National Audubon Society, guide to ethical bird photography", href: "https://www.audubon.org/get-outside/audubons-guide-ethical-bird-photography"}
        ]
    }),
    earnBlogPost({
        slug: "why-every-wildlife-photographer-should-track-the-species-they-photograph",
        canonicalUrl: `https://animaldex.app${blogHrefs.trackSpecies}`,
        title: "Why Photographers Should Track the Species They Photograph",
        description:
            "A species list changes what you go out to shoot. How a tracked list exposes portfolio gaps, keeps IDs honest, and turns a camera roll into a body of work.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("why-every-wildlife-photographer-should-track-the-species-they-photograph"),
        readingMinutes: 6,
        tags: ["wildlife photography", "species collection"],
        searchIntents: [
            "wildlife photography species tracker",
            "bird photography checklist app",
            "animal collection tracker",
            "wildlife photography life list",
            "track species photographed"
        ],
        speciesSlugs: ["sanderling", "red-admiral", "smooth-newt"],
        relatedSlugs: [
            "how-wildlife-photographers-can-build-a-digital-species-collection",
            "from-birding-to-herping-build-a-public-record-of-what-you-find",
            "wildlife-photography-challenges-that-make-you-better-in-the-field"
        ],
        tableOfContents: [
            "Lists change behaviour",
            "What a species list does for a portfolio",
            "Index first, then fill the holes",
            "Birders already know this. Macro and herp shooters should too.",
            "A simple tracking system",
            "Lookalikes and honest ticks"
        ],
        sections: [
            {
                title: "Lists change behaviour",
                paragraphs: [
                    "Without a list, you reshoot the same easy bird. The robin on the fence is sharp, the light is good, and the file joins four hundred others exactly like it. With a list, you notice the gap instead: no night herps, no insects, nothing from the shoreline since the spring. That gap is the difference between a hobby folder and a body of work.",
                    "Birders worked this out generations ago. A life list is not vanity; it is a planning tool that tells you where you have not been and what you have not looked at properly. Sanderlings are a useful example. They are small pale waders, about 20 cm long, that run in and out with each wave on open sandy beaches, and they are easy to walk past as “some sandpipers”. The photographer with a list goes back for the sanderling at eye level, and comes home with a better frame and a confirmed species."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/why-every-wildlife-photographer-should-track-the-species-they-photograph/sanderling-eye-level.webp",
                        alt: "A loose flock of sanderlings feeding at the wave edge on a sandy beach, photographed low to the sand",
                        width: 1400,
                        height: 933,
                        caption: "Sanderlings working the tide line on Schiermonnikoog, Netherlands. A list sends you back for the eye-level frame. Photo: Rudolphous, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["sanderling"]
            },
            {
                title: "What a species list does for a portfolio",
                paragraphs: [
                    "A portfolio is judged on range as much as on peaks. An editor who needs a specific species wants to know in one search whether you have it, in what season, and whether the behaviour they need is in the set. A species-indexed list answers that in a minute. A date-sorted archive answers it in an afternoon, if at all.",
                    "The list is also the cheapest honesty check you own. When the count says 180 species and 150 of them are birds, you know your “wildlife photography” is bird photography with occasional foxes. That is fine as a specialism, but it should be a choice, not an accident.",
                    "Finally, a tracked list has a date on each first. First photographed, first good frame, first behaviour. Those dates are what turn a species into a project: three years of the same kingfisher pair tell a story that one lucky frame cannot."
                ],
                inlineLinks: [photographyCompanionLink]
            },
            {
                title: "Index first, then fill the holes",
                paragraphs: [
                    "AnimalDex gives each resolved animal a catalog card. Repeat captures of the same species keep their own grade and context, but collection progress counts unique identities, which is what a photographer's list should count too. The grade is a 1–10 score for that specific capture, so a second, better frame of a species you already hold still has a reason to exist.",
                    `First-time wild species captures also grant ${earnFacts.firstWildSpeciesCredits} Credit. That is a Credits grant, not Earnings. It exists to keep scanning going and it cannot be withdrawn or converted. It does not imply the species is worth money, and Creator Rewards, the program designed to recognise live contribution, is currently paused.`
                ],
                inlineLinks: [earnRelatedLinks.earn, indexesPostLink]
            },
            {
                title: "Birders already know this. Macro and herp shooters should too.",
                paragraphs: [
                    "A bird checklist is normal. An insect or amphibian checklist is rarer and often more useful, because those animals are the ones you skip. The red admiral is a migrant butterfly with a wingspan of roughly 6 to 8 cm whose caterpillars feed on stinging nettles, which means the scruffy nettle patch behind the car park is a site, not a weed. Most photographers have walked past it a hundred times.",
                    "Newts are the same story in a pond. A smooth newt is 8 to 11 cm long and spends spring in the water and the rest of the year under logs and stones nearby, so the species is there in both seasons if you look at the right height. AnimalDex treats insects, reptiles and amphibians as collectible wildlife, not as junk detections, and a list that includes them is the one that shows you where to go next."
                ],
                media: {
                    type: "gallery",
                    title: "The species you skip are the ones the list finds",
                    images: [
                        {
                            src: "/images/blog/why-every-wildlife-photographer-should-track-the-species-they-photograph/red-admiral-macro.webp",
                            alt: "A red admiral butterfly with wings open on stinging nettle leaves",
                            width: 1400,
                            height: 933,
                            caption: "Red admiral on its larval foodplant, stinging nettle, at Strumpshaw Fen, England. Photo: Michael Garlick, CC BY-SA 2.0, via Wikimedia Commons."
                        },
                        {
                            src: "/images/blog/why-every-wildlife-photographer-should-track-the-species-they-photograph/smooth-newt-pond.webp",
                            alt: "A dark newt with pale speckled flanks crossing bare soil beside a fallen leaf",
                            width: 1400,
                            height: 933,
                            caption: "A newt on land in Kalkar, Germany, uploaded as a smooth newt; on land the smooth and palmate newts are a classic lookalike pair. Photo: Pieter Delicaat, CC BY-SA 4.0, via Wikimedia Commons."
                        }
                    ]
                },
                speciesSlugs: ["red-admiral", "smooth-newt"],
                inlineLinks: [
                    {text: "From birding to herping", slug: "from-birding-to-herping-build-a-public-record-of-what-you-find", href: blogHrefs.birdingToHerping},
                    herpingJournalLink
                ]
            },
            {
                title: "A simple tracking system",
                paragraphs: [
                    "Whatever tool you use, the fields below are the ones that pay off later. They are also the ones a live capture records for you by default, which is the practical argument for doing the capture in the field rather than reconstructing it at a desk."
                ],
                table: {
                    columns: ["Field", "Why it matters", "Example"],
                    rows: [
                        {cells: ["Species, with the scientific name", "Common names drift between regions; Calidris alba does not", "Sanderling, Calidris alba"]},
                        {cells: ["First-photographed date", "Turns a tick into a timeline you can build a project on", "2024-10-12"]},
                        {cells: ["Location, honestly recorded", "Lets you go back, and lets a reviewer trust the record", "Schiermonnikoog north beach"]},
                        {cells: ["Best grade or best frame", "So you know which species still need a proper photo", "7/10, distant, no eye contact"]},
                        {cells: ["Behaviour seen", "Behaviour is what editors ask for and what you forget first", "Feeding at wave edge, flock of 9"]},
                        {cells: ["Confidence", "Marks the ticks that need a second look", "Group only: silent leaf warbler"]}
                    ]
                }
            },
            {
                title: "Lookalikes and honest ticks",
                paragraphs: [
                    "A list is only worth keeping if every line on it is true. Smooth and palmate newts are the textbook trap: females of the two are hard to separate even in the hand, and the reliable field mark is the throat, spotted in the smooth newt and plain pink in the palmate. If your photo does not show the throat, the honest entry is “newt, species unconfirmed”, and in AnimalDex terms that may mean a group-level record rather than a species card.",
                    "The same discipline applies to silent leaf warblers, distant white egrets and any small brown job at dusk. A tracked list with three honest “unconfirmed” lines is worth more than one with three guesses, because the first list tells you exactly what to go back for."
                ],
                pullQuote: "A list with three honest “unconfirmed” lines is worth more than one with three guesses. The first list tells you what to go back for."
            }
        ],
        faq: [
            {
                question: "What is a life list in wildlife photography?",
                answer: "A life list is the running record of every species you have photographed, usually with the date and place of the first one. Birders have kept them for generations as a planning tool. For a photographer it doubles as a portfolio index: it shows range, exposes gaps such as no night animals or no insects, and tells an editor in one search whether you have a species."
            },
            {
                question: "How do I keep track of the animals I have photographed?",
                answer: "Record one line per species with the scientific name, the first-photographed date, an honest location, your best frame or grade, and the behaviour you saw. A spreadsheet works if you fill it in every time. A live capture app does the same thing at the moment you take the photo, which is the step most people skip at the desk."
            },
            {
                question: "Does photographing the same species twice count twice?",
                answer: "On a species list, no: the species is counted once, however many frames you have. In AnimalDex the catalog card is counted once too, but each capture keeps its own grade, context and media, so a second capture of a species in a new season or habitat still adds to the record and can be the better frame."
            },
            {
                question: "Can you identify a species from a photo alone?",
                answer: "Often, but not always. Some pairs need a feature a photo may not show: the throat on a smooth versus palmate newt, the leg colour and wing tip on a willow warbler versus a chiffchaff, or a song. When the photo cannot prove the species, log it at the level you can prove, such as a group, and go back for the confirming shot."
            }
        ],
        sources: [
            {label: "Cornell Lab of Ornithology, Sanderling", href: "https://www.allaboutbirds.org/guide/Sanderling/"},
            {label: "Butterfly Conservation, red admiral", href: "https://butterfly-conservation.org/butterflies/red-admiral"},
            {label: "Amphibian and Reptile Conservation Trust, UK newts", href: "https://www.arc-trust.org/"}
        ]
    }),
    earnBlogPost({
        slug: "from-birding-to-herping-build-a-public-record-of-what-you-find",
        canonicalUrl: `https://animaldex.app${blogHrefs.birdingToHerping}`,
        title: "From Birding to Herping: Keep One Public Wildlife Record",
        description:
            "Bird lists are common; reptile, frog and insect lists are not. How to keep one honest public record across dawn birding, night herping and macro work.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("from-birding-to-herping-build-a-public-record-of-what-you-find"),
        readingMinutes: 6,
        tags: ["birding", "herping", "species collection"],
        searchIntents: [
            "herping checklist",
            "birding species list app",
            "public wildlife record",
            "herping for beginners night walk",
            "how to start herping"
        ],
        speciesSlugs: ["fire-salamander", "common-tree-frog"],
        relatedSlugs: [
            "why-every-wildlife-photographer-should-track-the-species-they-photograph",
            "how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income",
            "how-animaldex-rewards-genuine-wildlife-contribution"
        ],
        tableOfContents: [
            "One list, several tempos",
            "What a night walk actually looks like",
            "Kit that changes between habits",
            "Keep the record honest",
            "What a public record shows, and what it hides",
            "If you later guide"
        ],
        sections: [
            {
                title: "One list, several tempos",
                paragraphs: [
                    "Dawn birding is fast and optical: binoculars up, bird gone, next hedge. Herping is slow and mostly after dark, a headlamp sweeping a wet track at walking pace. Macro is crouch-and-wait at a nettle patch in the middle of the day. The animals do not share a schedule, and most people who do one of these never try the other two.",
                    "They can share a collection, though, if the app does not treat reptiles as second-class detections. The point of a single public record is that the same list shows 140 birds, 9 amphibians, 4 reptiles and 60 insects side by side, and the imbalance tells you where the next outing goes. A birder who adds one night walk a month will double the amphibian column in a season."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/from-birding-to-herping-build-a-public-record-of-what-you-find/birder-dawn-binoculars.webp",
                        alt: "A birdwatcher seen from behind holding a phone to the eyepiece of binoculars to photograph a bird",
                        width: 1400,
                        height: 928,
                        caption: "Birding is optical and quick: here a phone held to the binoculars for a record shot. Photo: PJeganathan, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "What a night walk actually looks like",
                paragraphs: [
                    "A good herping night is a mild, wet one. Fire salamanders, 15 to 25 cm of black and yellow, are nocturnal and come out onto woodland tracks after rain; the colours are a warning, backed by skin secretions that irritate the mouth and eyes of anything that bites them, which is one more reason not to handle them. European tree frogs are the opposite scale, about 4 to 5 cm, bright green, and loud: on spring nights the males call from pond margins and the chorus carries hundreds of metres, so you hear the site before you see a single frog.",
                    "The technique is to walk slowly, sweep the beam low, and stop when something glints. Most finds are on the path, not in the undergrowth, because the path is where the light reaches. Give each animal a minute, take the capture from a step back, and move on; a salamander crossing a track has somewhere to be."
                ],
                media: {
                    type: "gallery",
                    title: "Two animals a night walk finds",
                    images: [
                        {
                            src: "/images/blog/from-birding-to-herping-build-a-public-record-of-what-you-find/fire-salamander-night.webp",
                            alt: "A black and yellow fire salamander on wet gravel at night, lit by a torch",
                            width: 1400,
                            height: 933,
                            caption: "Fire salamander on a wet track after dark: the yellow is a warning, and a reason not to handle. Photo: Bouke ten Cate, CC BY 4.0, via Wikimedia Commons."
                        },
                        {
                            src: "/images/blog/from-birding-to-herping-build-a-public-record-of-what-you-find/frog-night-walk-b.webp",
                            alt: "A bright green European tree frog sitting on sand against a black night background",
                            width: 1400,
                            height: 957,
                            caption: "European tree frog found on a night walk, about the length of a thumb. Photo: Bouke ten Cate, CC BY 4.0, via Wikimedia Commons."
                        }
                    ]
                },
                speciesSlugs: ["fire-salamander", "common-tree-frog"],
                inlineLinks: [
                    {text: "What happens on a night wildlife walk", slug: "what-happens-on-a-night-wildlife-walk", href: blogHrefs.nightWildlifeWalk}
                ]
            },
            {
                title: "Kit that changes between habits",
                paragraphs: [
                    "The camera bag is mostly the same. The habits around it are not."
                ],
                cards: [
                    {label: "Headlamp with a low and a red mode", body: "A bright beam finds animals; a dim or red one lets you photograph them without a panicked frog leaping into the dark. Switch down once you have found the animal."},
                    {label: "Phone at arm's length, not lens to nose", body: "A capture from a step back with the habitat in frame grades better and disturbs less than a macro shoved into a salamander's face."},
                    {label: "Boots and a stick, not hands", body: "Wet rock, boardwalks and tree roots are where night walks go wrong. Nothing on a herping walk needs picking up."},
                    {label: "A time limit per animal", body: "Sixty seconds of light on a nocturnal animal is plenty. Longer and you are the predator it thinks you are."},
                    {label: "Binoculars at dawn, dry bag at night", body: "The optics that make birding work are dead weight after dark; the waterproofing that makes herping work is dead weight at a feeder. Pack for the tempo."}
                ]
            },
            {
                title: "Keep the record honest",
                paragraphs: [
                    "Live captures only. No luring, no handling, no turning logs and stones without putting them back exactly as they were, and no manufacturing a frog for the camera. AnimalDex Wildlife Guide terms forbid baiting and disturbance, and a personal list should hold the same line for the same reason: the record is worthless if you coerced the animal.",
                    "Location honesty is part of the same rule. A live capture is made where you were standing, in the app, at the moment you saw the animal; that is the whole point of recording live rather than uploading from a gallery, and it is why gallery uploads are not captures. If you later bring old material in through the Instagram import, each post is reviewed for the species and the historical location before it joins the collection. A record with a forged place is not a record, and for a sensitive species it is actively harmful.",
                    "Which raises the obvious tension: an honest location for a rare snake's den is also a map for the people you least want there. The answer is not to lie about where you were. It is to be careful about what you publish."
                ],
                inlineLinks: [herpingJournalLink, instagramImportLink]
            },
            {
                title: "What a public record shows, and what it hides",
                paragraphs: [
                    "The public side of a wild record is aggregate. It is designed to show that you have been out, across groups, for a sustained period, without turning into a dossier on every den and nest you know."
                ],
                table: {
                    columns: ["Shown publicly", "Kept to the record, not broadcast"],
                    rows: [
                        {cells: ["Count of wild species collected", "Which pond, which log, which crevice"]},
                        {cells: ["Count of qualifying wild captures", "A capture-by-capture location dump"]},
                        {cells: ["Breadth across birds, herps, insects and the rest", "Exact meeting points of a guided walk until a request is accepted"]},
                        {cells: ["That the captures were live, in-app photos", "Anything that would let a stranger find a sensitive animal from your list"]}
                    ]
                }
            },
            {
                title: "If you later guide",
                paragraphs: [
                    "The same public wild record is what collectors see as aggregate credentials on a Wildlife Guide listing. It is not a capture-ID dump. It is a count of wild species and qualifying wild captures: enough to show a prospective guest that you have actually walked the sites at night, not enough to dox a den. The gates to apply are 45 qualifying wild captures, 20 wild species and a 30-day account, and a person reviews every application. Guides is a live beta; guests pay the guide in person, and AnimalDex does not handle the cash."
                ],
                pullQuote: "The record is worthless if you coerced the animal, and worthless if you lied about where you were.",
                inlineLinks: [
                    earnRelatedLinks.guide,
                    earnRelatedLinks.marketplace,
                    {text: "How herpers can turn local knowledge into guided experiences", slug: "how-herpers-can-turn-local-knowledge-into-guided-wildlife-experiences", href: blogHrefs.herpersGuide}
                ]
            }
        ],
        faq: [
            {
                question: "What is herping?",
                answer: "Herping is searching for reptiles and amphibians in the field, from the word herpetology. In practice it means slow walks on mild, wet nights with a headlamp for frogs, newts and salamanders, and warm mornings for basking lizards and snakes. Ethical herping means no handling, no luring, and putting back any cover you lift exactly as you found it."
            },
            {
                question: "Can you keep a birding and a herping list in the same app?",
                answer: "Yes, if the app indexes reptiles, amphibians and insects as real species rather than junk detections. AnimalDex gives a fire salamander or a tree frog the same kind of catalog card as a warbler, so one public record shows how many birds, herps and insects you have collected side by side. That imbalance is what tells you where to go next."
            },
            {
                question: "Is it safe to handle a fire salamander?",
                answer: "Do not handle one. Fire salamanders secrete skin toxins that irritate the mouth, eyes and skin of predators, and handling also strips the moist skin layer amphibians depend on. Photograph it from a step back on the track, give it a minute of light at most, and let it cross. The same no-handling rule applies to every amphibian on a night walk."
            },
            {
                question: "Should I share the location of rare reptiles I find?",
                answer: "Record the real location for your own record, but do not publish it. An honest location is what makes a sighting a record; a public one for a sensitive snake or newt site is a map for collectors and disturbance. Public AnimalDex credentials show counts of species and captures, not a capture-by-capture location list, for exactly this reason."
            }
        ],
        sources: [
            {label: "Amphibian and Reptile Conservation Trust", href: "https://www.arc-trust.org/"},
            {label: "Froglife, amphibian and reptile identification", href: "https://www.froglife.org/"},
            {label: "IUCN Red List, Salamandra salamandra", href: "https://www.iucnredlist.org/"}
        ]
    }),
    earnBlogPost({
        slug: "wildlife-photography-challenges-that-make-you-better-in-the-field",
        canonicalUrl: `https://animaldex.app${blogHrefs.fieldChallenges}`,
        title: "Wildlife Photography Challenges That Improve Field Craft",
        description:
            "Seven self-set wildlife photography challenges, from eye level and backlight to behaviour sequences and habitat in frame, with the technique behind each.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("wildlife-photography-challenges-that-make-you-better-in-the-field"),
        readingMinutes: 7,
        tags: ["wildlife photography", "fieldcraft"],
        searchIntents: [
            "wildlife photography challenges",
            "photography field practice",
            "improve wildlife photos",
            "wildlife photography exercises",
            "bird photography eye level technique"
        ],
        speciesSlugs: ["snowy-plover", "magnificent-frigatebird", "common-kingfisher", "osprey"],
        relatedSlugs: [
            "why-every-wildlife-photographer-should-track-the-species-they-photograph",
            "how-wildlife-photographers-can-build-a-digital-species-collection",
            "how-animaldex-rewards-genuine-wildlife-contribution"
        ],
        tableOfContents: [
            "Give yourself constraints",
            "Seven challenges worth a month each",
            "Backlight without losing the bird",
            "Behaviour sequences, not hero frames",
            "Use AnimalDex as the scoreboard, not the prize",
            "Do not confuse this with a Sponsored Challenge"
        ],
        sections: [
            {
                title: "Give yourself constraints",
                paragraphs: [
                    "A useful personal challenge is narrow. “Go and shoot nature” produces the same four hundred robins. “Only animals at eye level this month” produces muddy knees, a different relationship with the ground, and a set of frames that look like nobody else's. Constraints force the technique you would otherwise never practise, because on an ordinary morning there is always an easier shot.",
                    "The challenges below are the ones working photographers set themselves. Each one trains a specific skill, and each one leaves a visible mark on the files, which is how you know it worked."
                ]
            },
            {
                title: "Seven challenges worth a month each",
                paragraphs: [
                    "Pick one. Run it for a month. The point is repetition under a single rule, not a checklist you tick in a weekend."
                ],
                cards: [
                    {label: "Eye level, every frame", body: "Get the lens to the animal's eye height: lying on the sand for a plover, kneeling for a fox, standing on the bank for a heron. It separates the subject from the background and makes the viewer a participant instead of an observer."},
                    {label: "Backlight only", body: "Shoot with the sun behind the animal for a month. You will learn to expose for the rim, to find dark backgrounds, and to read a silhouette for the feature that identifies the species."},
                    {label: "Behaviour sequence", body: "No single frames. Every outing must come back with a sequence of at least three: the perch, the look, the dive; the stoop, the strike, the carry. It teaches anticipation, which is the whole game."},
                    {label: "Habitat in frame", body: "No crop tighter than a third of the frame. The reeds, the sand, the bark stay in. It is harder to compose, it identifies the animal better, and it is the context factor a capture grade looks for."},
                    {label: "One species, one month", body: "Everything you shoot is the same species. By week three you know where it feeds, when it calls and which perch it prefers in rain, and the frames from week four are the ones that sell."},
                    {label: "The ugly hour", body: "Midday, flat light, nothing moving. Learn to find shade, overcast and water reflections. The photographers who only shoot golden hour are helpless for ten hours a day."},
                    {label: "The lookalike pair", body: "Photograph both halves of a pair, willow warbler and chiffchaff, great egret and snowy egret, showing the feature that separates them. It is identification training with a camera."}
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/wildlife-photography-challenges-that-make-you-better-in-the-field/plover-eye-level.webp",
                        alt: "Two snowy plovers at eye level on grey sand, one with wings raised toward the other",
                        width: 1400,
                        height: 700,
                        caption: "Eye level and behaviour in one frame: snowy plovers at Estero Bluffs, California, photographed from the sand. Photo: Mike Baird from Morro Bay, USA, CC BY 2.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["snowy-plover"]
            },
            {
                title: "Backlight without losing the bird",
                paragraphs: [
                    "Backlight is the challenge most people fail first, because the camera's meter wants to turn a bright sky into mid-grey and the bird into a black blob. The fix is to decide what the frame is about before you press anything. If it is a silhouette, expose for the sky and let the bird go black, then make sure the outline alone identifies the species: the frigatebird's long angled wings and forked tail read instantly, which is why it works as a shape. If it is rim light, you want the sun just outside the frame, a dark background behind the animal, and about a stop more exposure than the meter suggests so the lit edge of the feathers glows without the body dropping to nothing.",
                    "Either way, shoot when the sun is low. Twenty minutes either side of sunrise and sunset gives you a sun you can put behind a bird without it burning out the whole sky."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/wildlife-photography-challenges-that-make-you-better-in-the-field/backlit-bird-rim-light-b.webp",
                        alt: "A magnificent frigatebird silhouetted in flight against orange sunset clouds",
                        width: 1400,
                        height: 933,
                        caption: "A frigatebird against a St Lucia sunset: the outline alone is the identification. Photo: ImagePerson, CC BY 4.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["magnificent-frigatebird"]
            },
            {
                title: "Behaviour sequences, not hero frames",
                paragraphs: [
                    "A common kingfisher is 16 cm of patience. It fishes from a perch, watches, bobs its head to judge the range, and dives; the whole event lasts about a second and the bird is back on the perch with the fish before most people have raised the camera. The sequence challenge is to get the perch, the pre-dive stare and the return, which means picking the perch before the bird does, pre-focusing on it, and waiting through the twenty misses for the one that goes.",
                    "An osprey carrying a fish is the same lesson at a larger scale. Ospreys turn the fish head-first into the wind to reduce drag, and that one detail is what makes the frame a photograph rather than a record shot. You only get it by watching the bird long enough to know which way it will turn after the strike. Every sequence challenge is really an anticipation challenge, and anticipation is the one skill no lens can buy."
                ],
                media: {
                    type: "gallery",
                    title: "Perch, strike, carry",
                    images: [
                        {
                            src: "/images/blog/wildlife-photography-challenges-that-make-you-better-in-the-field/kingfisher-dive-sequence.webp",
                            alt: "A female common kingfisher on a thin perch looking down at the water before a dive",
                            width: 1400,
                            height: 849,
                            caption: "Female common kingfisher, locked on the water the moment before the dive. Photo: Luiz Lapa from Oeiras, Portugal, CC BY 2.0, via Wikimedia Commons."
                        },
                        {
                            src: "/images/blog/wildlife-photography-challenges-that-make-you-better-in-the-field/osprey-fish-behaviour.webp",
                            alt: "An osprey in flight against a pale sky carrying a fish head-first in its talons",
                            width: 1400,
                            height: 933,
                            caption: "Osprey carrying a fish head-first, the detail that turns a record shot into a photograph. Photo: Paul Danese, CC BY-SA 4.0, via Wikimedia Commons."
                        }
                    ]
                },
                speciesSlugs: ["common-kingfisher", "osprey"]
            },
            {
                title: "Use AnimalDex as the scoreboard, not the prize",
                paragraphs: [
                    "Unique species, distinct locations and capture grade are already in the product, which makes it a convenient scoreboard for a self-set challenge. The grade is a 1–10 score for a specific capture, built from clarity, framing, identification confidence, visible detail and context. Those map onto the challenges above almost one to one: eye level and habitat feed framing and context, backlight feeds visible detail, the lookalike pair feeds identification confidence.",
                    "Missions grant Credits for some of those loops. Credits are not cash and cannot be converted into Earnings. Creator Rewards, the program designed to recognise live contribution, is currently paused. The improvement is the point; the scoreboard just makes it visible."
                ],
                table: gradeFactorsTable,
                inlineLinks: [earnRelatedLinks.earn, indexesPostLink]
            },
            {
                title: "Do not confuse this with a Sponsored Challenge",
                paragraphs: [
                    "A Sponsored Challenge is a time-boxed campaign a zoo, park, tourism board or brand can enquire to run inside AnimalDex: free to join, published rules, a venue radius or species theme, and achievement rewards today rather than cash. It is not Arena PvP, and it is not a personal homework list. If a zoo or park invites you into one, the objective will be written on the campaign, usually unique indexed animals, qualifying captures or active days. Until then, set your own."
                ],
                pullQuote: "Every sequence challenge is really an anticipation challenge, and anticipation is the one skill no lens can buy.",
                inlineLinks: [
                    earnRelatedLinks.sponsor,
                    {text: "What is a sponsored wildlife challenge?", slug: "what-is-a-sponsored-wildlife-challenge", href: blogHrefs.whatSponsoredChallenge}
                ]
            }
        ],
        faq: [
            {
                question: "How do I get better at wildlife photography?",
                answer: "Set one narrow constraint and keep it for a month: eye level only, backlight only, or one species only. Constraints force the techniques an ordinary outing lets you avoid, and a month of repetition is what makes them automatic. Review the files against a single question, did the rule improve them, then pick the next constraint."
            },
            {
                question: "Why does eye level matter in wildlife photography?",
                answer: "Shooting at the animal's eye height puts the viewer in its world instead of looking down on it, throws the background further out of focus because the lens is parallel to the ground, and shows the features that identify the species from the side. For a plover that means lying on the sand; for a heron, standing on the bank."
            },
            {
                question: "How do you photograph a bird against the sun?",
                answer: "Decide first whether you want a silhouette or rim light. For a silhouette, expose for the sky and let the bird go black, and make sure the outline identifies it. For rim light, keep the sun just outside the frame, find a dark background and give about a stop more exposure than the meter suggests. Shoot within twenty minutes of sunrise or sunset."
            },
            {
                question: "What is the difference between a personal challenge and an AnimalDex Sponsored Challenge?",
                answer: "A personal challenge is a rule you set yourself to practise a technique. A Sponsored Challenge is a campaign a business runs inside AnimalDex with published rules, a theme or venue radius, and achievement rewards rather than cash. It is free to join and not a PvP mode. Both are about going out and capturing live animals; only one has a sponsor."
            }
        ],
        sources: [
            {label: "Cornell Lab of Ornithology, Osprey", href: "https://www.allaboutbirds.org/guide/Osprey/"},
            {label: "Cornell Lab of Ornithology, Snowy Plover", href: "https://www.allaboutbirds.org/guide/Snowy_Plover/"},
            {label: "National Audubon Society, guide to ethical bird photography", href: "https://www.audubon.org/get-outside/audubons-guide-ethical-bird-photography"}
        ]
    }),
    earnBlogPost({
        slug: "how-animaldex-rewards-genuine-wildlife-contribution",
        canonicalUrl: `https://animaldex.app${blogHrefs.genuineContribution}`,
        title: "How AnimalDex Rewards Genuine Wildlife Contribution",
        description:
            "Creator Rewards recognises live, diverse, high-quality wildlife contribution and is currently paused. What genuine means, and what never becomes cash.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-animaldex-rewards-genuine-wildlife-contribution"),
        readingMinutes: 6,
        tags: ["creator-rewards", "earning"],
        searchIntents: [
            "AnimalDex creator rewards",
            "wildlife creator platform",
            "how AnimalDex rewards photographers",
            "AnimalDex live capture rules",
            "get paid for wildlife photos app"
        ],
        speciesSlugs: ["red-fox"],
        relatedSlugs: [
            "can-wildlife-photography-make-money",
            "how-wildlife-photographers-can-build-a-digital-species-collection",
            "from-birding-to-herping-build-a-public-record-of-what-you-find"
        ],
        tableOfContents: [
            "Contribution is not a tip jar",
            "What “genuine” means in practice",
            "Live originals and location honesty",
            "How a capture is indexed and graded",
            "What never becomes Earnings",
            "The work is worth something either way"
        ],
        sections: [
            {
                title: "Contribution is not a tip jar",
                paragraphs: [
                    "Creator Rewards is a company-funded program. When a period is open, eligible accounts can receive an allocation from that pool based on live wildlife contribution during the period. There is no “pay me $X per capture” rate, there is no conversion from Credits, and there is no formula a user can run to invoice against.",
                    "The program is currently paused, with no published reopen date. That sentence is in this article three times on purpose, because the most common misunderstanding about AnimalDex is that scanning animals earns money. It does not. You can still do the work the program is designed to recognise, and that work has a value of its own, which is what the rest of this page is about."
                ],
                inlineLinks: [earnRelatedLinks.creator, {text: "Why are Creator Rewards unavailable?", slug: "why-are-creator-rewards-unavailable", href: supportArticleHrefs.whyCreatorPaused}]
            },
            {
                title: "What “genuine” means in practice",
                paragraphs: [
                    "Genuine contribution is the kind a field naturalist would recognise: you were there, you saw the animal, the record says where and when, and you did not stage it. In product terms it breaks down into five habits."
                ],
                cards: [
                    {label: "Live originals over imports", body: "A capture is a photo taken with the in-app camera at the moment you saw the animal. Gallery uploads are not captures. Imported history can join the collection after review, but live captures are what contribution means."},
                    {label: "Location honesty", body: "A live capture records where you were standing. A spoofed location is not a record of anything, and for a sensitive species it does real harm. Keep the location true in the record; be careful about what you publish."},
                    {label: "Breadth over repetition", body: "Twenty species across birds, herps, insects and mammals says more than two hundred captures of the feeder blackbird. Breadth is the signal that someone actually went looking."},
                    {label: "Quality over volume", body: "Grade is a 1–10 score for the specific capture. A pile of low-grade frames is noise. One sharp, identifiable, in-habitat frame of a species is contribution."},
                    {label: "Consistency over a spike", body: "A hundred captures in one weekend followed by silence looks like a sprint for a reward. Steady outings across a season look like a naturalist. The program is designed to prefer the second."}
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-animaldex-rewards-genuine-wildlife-contribution/photographer-camera-field.webp",
                        alt: "Two wildlife photographers in ghillie suits holding cameras with long lenses on a mountain trail above a glacier",
                        width: 1400,
                        height: 1050,
                        caption: "Wildlife photographers in ghillie suits looking for red deer on a mountain trail: time in the field is the thing that cannot be faked. Photo: Giles Laurent, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Live originals and location honesty",
                paragraphs: [
                    "The reason AnimalDex insists on live, in-app captures is that a live capture carries its own evidence: the moment, the place, the fact that a person pointed a phone at a real animal. A photo pulled from a gallery carries none of that, however good it is, which is why gallery uploads are not captures and why no amount of archive quality substitutes for a walk.",
                    "Old material is not worthless; it is just a different thing. The Instagram import exists for compatible professional accounts, and it reviews each eligible post for the species and a historical location before anything joins the collection. Imported posts help build the record. They are not what Creator Rewards eligibility is designed to rely on.",
                    "Location honesty cuts both ways. A red fox asleep in tundra vegetation at a national park is a capture with context: the habitat is in the frame, the place is where you were, and anyone reviewing the record can see that the story holds together. Move that fox to a different continent in the metadata and the capture becomes a lie that happens to contain a fox."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-animaldex-rewards-genuine-wildlife-contribution/red-fox-habitat.webp",
                        alt: "A red fox curled up asleep in low green tundra plants with yellow flowers",
                        width: 1400,
                        height: 1105,
                        caption: "A red fox asleep near Eielson Visitor Center, Denali National Park, Alaska. Habitat in frame, place as recorded. Photo: NPS Photo / Emily Mesner, Public domain, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["red-fox"],
                inlineLinks: [instagramImportLink]
            },
            {
                title: "How a capture is indexed and graded",
                paragraphs: [
                    "After a capture, AnimalDex identifies what it can from the photo and resolves the result to one canonical catalog card. Species by default; a shared group card only for large lookalike families that phone photos cannot fairly separate; domestic breeds and colour morphs folded into the base animal. The collectible number belongs to that card, so your species count means the same thing as everyone else's.",
                    "Separately, the capture gets a grade. The factors below are the ones the product describes, and every one of them is something a photographer already controls in the field."
                ],
                table: gradeFactorsTable,
                inlineLinks: [indexesPostLink]
            },
            {
                title: "What never becomes Earnings",
                paragraphs: [
                    "Credits, AnimalDex Score, Capture XP, Gift spend, PvP wins and Pack sales stay on the Credits side of the firewall. None of them converts, withdraws or accrues toward a payout. Community Gifts, if a future period counts them at all, would count as event signals, not as the Credit price of the Gift.",
                    "The only real-money flow on the platform today is Wildlife Guides, a live beta where a guest pays an approved guide cash on the day and the completed outing records seller net on Earnings. Sponsored Challenges pay achievements, not cash. If someone tells you otherwise, they have the product wrong."
                ],
                inlineLinks: [
                    earnRelatedLinks.earn,
                    {text: "What are Creator Rewards?", slug: "what-are-creator-rewards", href: supportArticleHrefs.whatCreatorRewards},
                    {text: "Are AnimalDex Credits worth real money?", slug: "are-animaldex-credits-worth-real-money", href: supportArticleHrefs.creditsWorthMoney}
                ]
            },
            {
                title: "The work is worth something either way",
                paragraphs: [
                    "The habits above are not AnimalDex rules dressed up as virtue. They are the same habits that make a wildlife photographer's work sell anywhere else. Editors want live originals with honest captions. Competitions disqualify staged and baited images. Print buyers want a species from a place, with a story that is true. A public species record built from live captures across a season is the quickest proof that you do the work, whether or not any reward period is open.",
                    "So build the record for the record. If a period opens and you are eligible, that is a bonus. If it does not, you still own a species-indexed body of work that was worth making."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-animaldex-rewards-genuine-wildlife-contribution/prints-spread-table.webp",
                        alt: "Photographic prints laid out across a wooden table beside a window",
                        width: 1400,
                        height: 1054,
                        caption: "The same work that counts as contribution is the work that becomes a print edit. Photo: Lombres, CC BY 4.0, via Wikimedia Commons."
                    }
                },
                pullQuote: "Build the record for the record. If a period opens, that is a bonus; if it does not, you still own a body of work that was worth making.",
                inlineLinks: [
                    {text: "Can wildlife photography make money?", slug: "can-wildlife-photography-make-money", href: blogHrefs.photographyIncome},
                    earnRelatedLinks.guide
                ]
            }
        ],
        faq: [
            {
                question: "When do Creator Rewards open?",
                answer: "There is no published reopen date. Creator Rewards is currently paused, and when it runs it is a company-funded allocation for eligible live contribution during a defined period, which can itself be paused. Do not treat the program as current income or plan anything around a date."
            },
            {
                question: "Does AnimalDex pay per capture?",
                answer: "No. There is no per-capture fee, no rate per species and no conversion from Credits or Score to cash. Captures build a collection. Creator Rewards, when open, is an allocation from a company-funded pool for eligible accounts, not a tariff. The only real-money flow today is Wildlife Guides, paid cash on the day by the guest."
            },
            {
                question: "Do Instagram imports count as genuine contribution?",
                answer: "They help build your collection, but they are not what the program is designed to rely on. The import works for compatible professional accounts and reviews each eligible post for species and a historical location before it joins the record. Live, in-app captures are the contribution Creator Rewards is built around."
            },
            {
                question: "What is the difference between Credits and Earnings on AnimalDex?",
                answer: "Credits are the in-app currency used for scans, upgrades and game actions. They are not cash and cannot be withdrawn or converted. Earnings is the real-money side, which today records seller net from completed Wildlife Guide outings paid cash on the day. Nothing moves from the Credits side to the Earnings side."
            }
        ],
        sources: [
            {label: "National Audubon Society, guide to ethical bird photography", href: "https://www.audubon.org/get-outside/audubons-guide-ethical-bird-photography"},
            {label: "National Park Service, Denali National Park and Preserve", href: "https://www.nps.gov/dena/index.htm"},
            {label: "IUCN Red List of Threatened Species", href: "https://www.iucnredlist.org/"}
        ]
    })
];

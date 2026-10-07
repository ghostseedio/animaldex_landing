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

function photo(src: string, alt: string, width: number, height: number, caption: string) {
    return {type: "image" as const, image: {src, alt, width, height, caption}};
}

const importLink = {text: "Import Instagram wildlife photos", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"};
const companionLink = {text: "Wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"};
const herpingLink = {text: "Herping field journal", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"};

export const instagramWildlifeArchivePosts: BlogPost[] = [
    post({
        slug: "organize-years-of-wildlife-photos-by-species",
        title: "How to Organize Years of Wildlife Photos by Species",
        description: "A working method for sorting a wildlife photo archive by species, place and setting, re-identifying old shots honestly and keeping the result searchable.",
        featuredAlt: "Wildlife photo cards arranged into a species collection instead of a camera roll",
        readingMinutes: 6,
        tags: ["wildlife photography", "photo organization", "Instagram import"],
        searchIntents: ["organize wildlife photos", "wildlife photo catalog", "wildlife species photo organizer", "sort wildlife photos by species", "how to catalog wildlife photos"],
        relatedSlugs: ["wildlife-photography-life-list", "wildlife-photography-app-vs-photo-gallery", "turn-instagram-wildlife-archive-into-species-collection"],
        tableOfContents: [
            "Why a camera roll is a weak wildlife catalog",
            "Species first, then place, then setting",
            "Re-identify old photos without fooling yourself",
            "Rebuild the dates and places you never wrote down",
            "If the archive already lives on Instagram",
            "What not to automate"
        ],
        sections: [
            {
                title: "Why a camera roll is a weak wildlife catalog",
                paragraphs: [
                    "Most wildlife photographers already own the pictures. What they do not own is a species index: which animal it was, where it actually was, and whether that identification would survive a second look. A camera roll sorts by the moment the shutter fired. A trip folder sorts by the holiday. Neither can answer the question a photographer actually asks years later, which is “have I photographed this species, and where?”",
                    "The folder approach also fails quietly. A folder called Bali 2019 holds a green pit viper, a tree frog and a monitor lizard, with nothing marking which is which. A folder called Snakes mixes a garter snake from a Minnesota lawn with a vine snake from Costa Rica. Lightroom keywords help, but only if you typed the right name at the time, and most people typed a guess.",
                    "The fix is not more folders. It is a catalog whose primary key is the animal, with the encounter (place, date, setting, evidence) attached to it. That is what a Dex is, and it is also what a birder's life list or a herper's field journal has always been, just with the photo kept in the record."
                ]
            },
            {
                title: "Species first, then place, then setting",
                paragraphs: [
                    "Work in three passes, in this order. Identity is the hardest pass and the one most likely to change your mind about a photo, so do it before you spend time on anything else. Place comes second because the honest answer is often rougher than you remember. Setting comes last and takes seconds, but it is the field people skip and regret: a captive animal filed as wild corrupts every range map and every list built on top of it.",
                    "A pass over 2,000 photos at 20 seconds each is roughly 11 hours. Do it in sessions of 100 to 200 and start with the animals you know best. Confidence builds a vocabulary of what a solid record looks like before you reach the hard ones."
                ],
                cards: [
                    {label: "1. Species", body: "Name the animal to the level the photo supports. Species when the diagnostic feature is visible, genus or family when it is not. Write down why: “keeled scales, round pupil, yellow collar” beats “looks like a grass snake”."},
                    {label: "2. Place", body: "The place you stood when you made the picture, not today's GPS and not the hashtag. A site name, a reserve, a town or a 10 km grid square are all honest answers at different resolutions."},
                    {label: "3. Setting", body: "Wild, captive (zoo, aquarium, rescue centre), farm or domestic. A wild tiger and a zoo tiger are the same species and completely different records."},
                    {label: "4. Evidence", body: "Keep the original file, not the Instagram export. The original holds the EXIF date, often the camera GPS, and the full-resolution detail that lets you check a scale count later."}
                ],
                media: photo("/images/blog/organize-years-of-wildlife-photos-by-species/european-robin.webp", "European robin perched on a bare twig", 1400, 933, "A European robin is a 10-second identification in Europe; the same orange breast on a North American photo is a different family entirely. Photo: Joselodos, CC0, via Wikimedia Commons."),
                speciesSlugs: ["european-robin", "american-robin"]
            },
            {
                title: "Re-identify old photos without fooling yourself",
                paragraphs: [
                    "Old photos were identified by a younger, less experienced you, often from the back of the camera. Treat every old caption as a hypothesis. Then sort the archive into lookalike groups and resolve each group with a field guide open, rather than resolving photos one at a time in random order. Doing all the tits in one sitting, or all the brown frogs, trains your eye on the single feature that separates them.",
                    "Know when to stop. A silhouetted egret with no leg colour visible is an egret, not a little egret. A brown juvenile gull is a gull. A Pelophylax water frog in central Europe is honestly a water frog unless you heard it call. Stopping at genus or family is not a failure; it is the record being accurate. A species name you cannot defend is worse than no name, because it will be copied into a list and trusted.",
                    "Use community checks for the groups you struggle with. iNaturalist's identifiers will correct a wrong frog within days, and eBird reviewers flag improbable birds. Bring the corrected name back into your own catalog; do not leave the correction stranded on someone else's site."
                ],
                table: {
                    columns: ["Lookalike group", "What usually separates them", "Honest fallback"],
                    rows: [
                        {cells: ["Grass snake, smooth snake, adder (Europe)", "Yellow collar and round pupil (grass); vertical pupil and zigzag (adder); plain brown with dark eye stripe (smooth)", "“Snake” with region and length estimate"]},
                        {cells: ["Egrets and small white herons", "Bill colour, leg colour, foot colour, size against a known bird", "“Egret”"]},
                        {cells: ["Brown frogs (common frog, moor frog, agile frog)", "Snout shape, heel-to-snout leg length, dorsal stripe, eye mask", "“Brown frog (Rana)”"]},
                        {cells: ["Garter snakes (North America)", "Stripe position (scale rows), lateral spotting, head markings; subspecies are often unresolvable in a photo", "“Garter snake (Thamnophis)”"]},
                        {cells: ["Tits and chickadees", "Cap colour, bib size, wing bars, cheek pattern", "“Tit/chickadee” plus location, which rules most species out"]}
                    ]
                },
                media: photo("/images/blog/organize-years-of-wildlife-photos-by-species/grass-snake.webp", "Grass snake coiled on a rock with its pale yellow collar visible", 1400, 933, "A grass snake: the yellow-and-black collar and round pupil separate it from the adder it is often mistaken for. Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."),
                speciesSlugs: ["common-frog", "red-sided-garter-snake", "little-egret"]
            },
            {
                title: "Rebuild the dates and places you never wrote down",
                paragraphs: [
                    "If you still have the original files, the date is almost always in the EXIF header (DateTimeOriginal), and phone photos often carry GPS coordinates. Check the camera clock was right: a camera that was never reset reads 2012 on photos from 2019, and a camera left on home time while abroad is off by hours, which matters for dusk and dawn species.",
                    "If the original is gone and only the Instagram copy survives, the post date is an upper bound, not the capture date. Rebuild the place from the trip itinerary, the posts around it, the background (a signposted boardwalk, a named hide, a recognisable shoreline), and a map. Satellite view plus the memory of “the second pond past the car park” gets most people to within a few hundred metres. Write down that it was reconstructed and roughly how precise it is.",
                    "When nothing works, record the coarsest unit you are sure of: the reserve, the island, the national park. A capture placed honestly at a reserve level is useful. A capture pinned to a precise point you guessed is misinformation with a confident face."
                ]
            },
            {
                title: "If the archive already lives on Instagram",
                paragraphs: [
                    "AnimalDex can look through a compatible Instagram professional account for posts that contain animals. It then shows each candidate one at a time, and you review the species, the historical location and the setting before the original media becomes an entry in your Dex. Posts without a location you can confirm stay out of the import queue. Group-level identities are kept when that is the honest catalog result; the app will not promote a “brown frog” to a species to make the grid look tidier.",
                    "That is slower than a bulk dump, and that is the point. A catalog that trusts captions will lie to you later. Imported archive items are also a different thing from live in-app captures: they build your collection and can appear in Discover, but they are not live field captures and do not count toward programmes that are tied to live contribution."
                ],
                inlineLinks: [companionLink, importLink],
                pullQuote: "A species name you cannot defend is worse than no name, because it will be copied into a list and trusted."
            },
            {
                title: "What not to automate",
                paragraphs: [
                    "Automation is useful for finding candidates and useless for deciding what is true. Keep these decisions manual."
                ],
                cards: [
                    {label: "Hashtags are not coordinates", body: "#costarica tells you the country. It does not tell you which slope of which volcano, and it is often added for reach rather than accuracy."},
                    {label: "A cleaner grid is not a better list", body: "Do not promote a genus-level record to a species because the species card has nicer art. The empty slot is honest; the wrong card is not."},
                    {label: "Captions are not identifications", body: "Your 2017 caption was a guess made on a phone screen. Re-check it against the full-resolution file before it becomes a record."},
                    {label: "Captive stays captive", body: "A wildlife park animal photographed through a fence is a captive record even if the fence is out of frame. Tag the setting before you forget which day it was."}
                ]
            }
        ],
        faq: [
            {question: "Can I organize wildlife photos without reshooting them?", answer: "Yes. Start from the original files or from a compatible Instagram professional account, review each photo for species, historical place and setting, and file it by animal rather than by trip. Eligible Instagram posts can be reviewed and imported into AnimalDex one at a time, so an archive from 2015 can sit in the same collection as a capture from this morning."},
            {question: "How do I identify an animal in an old photo I never labelled?", answer: "Sort the archive into lookalike groups first, then resolve each group with a field guide and the location, which rules most candidates out. Look for one diagnostic feature (pupil shape, leg colour, stripe position) rather than overall impression. If the feature is not visible, stop at genus or family and record it that way."},
            {question: "What is the best way to catalog wildlife photos by species?", answer: "Use a catalog whose primary key is the species, with place, date and setting attached to each record and the original file kept as evidence. Folders and albums sort by trip or by date and cannot answer whether you have photographed a species before. A Dex, a life-list app or a well-kept spreadsheet all work if identity stays honest."},
            {question: "Should every photo become a public record?", answer: "No. Publish only records where you have confirmed the identity and a historical location, and keep precise locations private for species that are collected or persecuted, such as adders, rare orchids and many turtles. Imported Instagram posts can appear in AnimalDex Discover, which is why the review step exists."},
            {question: "Do imported Instagram photos count as captures?", answer: "They become entries in your Dex after review, but they are archive items, not live in-app captures. Live captures are photographed in the app in the field with their own camera and location pipeline. Imported items build your collection and life list; they do not add live-contribution signals."}
        ],
        sources: [
            {label: "Cornell Lab of Ornithology, All About Birds identification guides", href: "https://www.allaboutbirds.org/"},
            {label: "iNaturalist, community identification and observation records", href: "https://www.inaturalist.org/"},
            {label: "IPTC Photo Metadata Standard (what EXIF and IPTC fields carry)", href: "https://iptc.org/standards/photo-metadata/"},
            {label: "Amphibian and Reptile Conservation Trust, UK reptile and amphibian identification", href: "https://www.arc-trust.org/"}
        ]
    }),
    post({
        slug: "turn-instagram-wildlife-archive-into-species-collection",
        title: "Turn an Instagram Wildlife Archive Into a Species Collection",
        description: "What survives in an Instagram wildlife post and what is lost, how to review each post honestly, and how to keep the originals in a species collection.",
        featuredAlt: "Path from an Instagram wildlife feed into an AnimalDex species collection",
        readingMinutes: 5,
        tags: ["Instagram", "wildlife archive", "collection"],
        searchIntents: ["organize Instagram wildlife photos", "wildlife Instagram archive", "import Instagram animal photos", "does Instagram keep photo metadata", "Instagram wildlife photos backup"],
        relatedSlugs: ["wildlife-photos-sitting-on-instagram", "organize-years-of-wildlife-photos-by-species", "wildlife-creators-need-a-species-archive"],
        tableOfContents: [
            "A feed is a timeline, not a collection",
            "What Instagram keeps and what it throws away",
            "The actual import path",
            "Reviewing a post honestly",
            "Professional accounts, not a Meta endorsement",
            "Archive items and live captures are different things"
        ],
        sections: [
            {
                title: "A feed is a timeline, not a collection",
                paragraphs: [
                    "Instagram is good at showing work in order. It is bad at answering the question a wildlife photographer actually has after a few years: what have I documented? Which snakes, which birds, which places, and which of those identifications would I still stand behind? A grid of 900 posts cannot be filtered by species, cannot separate a zoo tiger from a wild one, and cannot tell you that the “kingfisher” from 2018 was captioned on a bus with no field guide.",
                    "A species collection inverts the feed. The animal is the entry; the posts are evidence attached to it. Import is the bridge for the pictures that already exist, and it only works if the bridge includes a review step rather than a bulk copy."
                ],
                media: photo("/images/blog/turn-instagram-wildlife-archive-into-species-collection/photographer-telephoto.webp", "A photographer lying prone with a telephoto lens photographing a desert tortoise at a distance", 1400, 900, "A tortoise photographed from a distance with a long lens: the kind of encounter that deserves a species record, not just a post. Photo: Joshua Tree National Park, Public domain, via Wikimedia Commons.")
            },
            {
                title: "What Instagram keeps and what it throws away",
                paragraphs: [
                    "Instagram re-encodes every upload. The version on the feed is a compressed JPEG resized to roughly 1,080 pixels on the long side, cropped to the aspect ratio you chose, with the EXIF block stripped. That means the camera's capture date, lens, exposure and any GPS coordinates are gone from the file. What survives is what you typed: the caption, hashtags, alt text if you added it, and a location tag, which is a named place page rather than a coordinate.",
                    "The consequences for a wildlife archive are specific. The post date is not the capture date; many people post a safari in batches weeks later. The location tag is often a city or a country chosen from a list. Fine detail that would let you count scale rows or read a leg band has been compressed away. If you still have the originals on a drive or in a cloud library, those are the files to keep; the Instagram copy is the evidence of last resort."
                ],
                table: {
                    columns: ["Field", "On Instagram", "In your original file"],
                    rows: [
                        {cells: ["Capture date and time", "Lost; only the post date remains", "EXIF DateTimeOriginal"]},
                        {cells: ["GPS coordinates", "Stripped on upload", "Present on most phone photos; on cameras with GPS or a linked phone"]},
                        {cells: ["Camera, lens, exposure", "Stripped", "EXIF"]},
                        {cells: ["Resolution and detail", "Resized to about 1,080 px, re-compressed", "Full resolution"]},
                        {cells: ["Caption and hashtags", "Kept (and editable, so not fixed evidence)", "Not stored unless you wrote IPTC keywords"]},
                        {cells: ["Location tag", "Kept as a named place, not a coordinate", "Not applicable"]},
                        {cells: ["Alt text", "Kept if you wrote it", "Not applicable"]},
                        {cells: ["Video frames", "Re-encoded; still useful for identification", "Original clip"]}
                    ]
                }
            },
            {
                title: "The actual import path",
                paragraphs: [
                    "Connect a compatible Instagram professional account. AnimalDex looks through your posts for ones that appear to contain animals and lines them up as candidates. For each candidate you confirm three things: the species or group, a historical location (where the animal was when you photographed it, which is not today's GPS), and the setting. Only after that does the original eligible photo or video become an entry in your Dex.",
                    "Videos, including Reels, are sampled for frames when your device can play them; if a clip cannot be sampled it is skipped and the rest of the archive continues. Not every post qualifies. Named failures stay visible in the list so that a partial import is not mistaken for a finished one, and so you can retry a skipped Reel later on another device."
                ],
                cards: [
                    {label: "Connect", body: "Link the Instagram professional account that holds the archive. No messaging permissions are requested."},
                    {label: "Find", body: "AnimalDex scans posts for animals and queues candidates. A photo of a menu or a sunset will not appear."},
                    {label: "Review", body: "Confirm species or group, historical location and setting for each candidate. Candidates without a confirmed location stay out of the queue."},
                    {label: "Import", body: "The original eligible media becomes an archive entry in your Dex. Skipped items are listed by name so you can come back to them."}
                ],
                inlineLinks: [importLink]
            },
            {
                title: "Reviewing a post honestly",
                paragraphs: [
                    "Review is where the archive earns its value, and three habits make it fast. First, resolve the identity from the picture, not the caption; the caption is a hypothesis written by a younger you. If the diagnostic feature is not visible, keep the group. A great tit and a coal tit are easy on a sharp frame and genuinely ambiguous on a dark, compressed one, and “tit (Paridae)” is a correct record.",
                    "Second, place the animal where it was. Use the surrounding posts, the itinerary and the background to rebuild the site, and choose the coarsest unit you are sure of. Third, tag the setting before you forget. The same frog photographed in a visitor-centre terrarium and under a log in the forest are two different records, and a list that merges them is wrong in a way that is hard to undo."
                ],
                media: photo("/images/blog/turn-instagram-wildlife-archive-into-species-collection/great-tit.webp", "Juvenile great tit perched on a lichen-covered post", 1400, 933, "A juvenile great tit, duller than the adult: a plumage stage that catches out captions written on the day. Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."),
                speciesSlugs: ["great-tit", "blue-tit", "coal-tit"]
            },
            {
                title: "Professional accounts, not a Meta endorsement",
                paragraphs: [
                    "Import needs a compatible Instagram professional account (business or creator). Personal accounts cannot always connect, and if connecting fails the usual fix is to switch the account type in Instagram's settings and try again. AnimalDex is not an official Instagram or Meta product, does not claim a partnership, and does not request messaging permissions. If you would rather not connect at all, Instagram's own “Download your information” export gives you the posted media and a file of captions and timestamps, which you can review by hand into any catalog.",
                    "Either route gives you the posted copy, not the original. If the originals exist anywhere, pair them with the imported record so the full-resolution file is what you check an identification against."
                ],
                media: photo("/images/blog/turn-instagram-wildlife-archive-into-species-collection/common-frog.webp", "Young common frog sitting among brown beech leaves", 1400, 933, "A young common frog in beech litter. Brown frogs are a classic group where a compressed feed copy supports genus, not species. Photo: Stephan Sprinz, CC BY 4.0, via Wikimedia Commons."),
                speciesSlugs: ["common-frog"]
            },
            {
                title: "Archive items and live captures are different things",
                paragraphs: [
                    "Imported posts build your Dex and your life list. They do not add qualifying live-capture wildlife signals for Creator Rewards, which is paused anyway. They are archive items: reviewed historical encounters with a reconstructed place. Live captures are made in the app, in the field, with the camera and location pipeline running at the time. The two sit in the same collection and are labelled differently, and only live captures feed programmes that depend on live contribution, such as Creator Rewards, which is currently paused in any case. Nothing about an import is a payout, and nothing about it needs to be. A searchable, honest record of ten years of wildlife is the point."
                ],
                inlineLinks: [companionLink],
                pullQuote: "The post date is not the capture date, and the location tag is a place page, not a coordinate."
            }
        ],
        faq: [
            {question: "Does Instagram keep the metadata on my wildlife photos?", answer: "No. Instagram strips the EXIF block on upload, so capture date, camera settings and GPS coordinates are gone from the posted file. The caption, hashtags, alt text and a named location tag survive because you typed them. Keep your original files if you want the real date, coordinates and full resolution."},
            {question: "Can I import Instagram photos into a species collection?", answer: "Yes, from a compatible Instagram professional account. AnimalDex finds posts with animals, then you review species, historical location and setting for each one before the original media becomes an entry in your Dex. Posts you cannot place honestly stay out of the queue, and some identities stay at group level on purpose."},
            {question: "What is the difference between an imported post and a live capture?", answer: "An imported post is a reviewed historical encounter whose place you reconstructed; a live capture is photographed in the app in the field with its location recorded at the time. Both live in your collection and are labelled differently. Only live captures count toward live-contribution programmes, and Creator Rewards is currently paused."},
            {question: "Can I import Instagram Reels and videos?", answer: "Often, yes. AnimalDex samples frames from a video when your device can play it and you then review the same identity and location details as for a still. If a clip cannot be sampled it is skipped by name, the rest of the import continues, and you can retry later or on the iOS app."},
            {question: "Do I need a professional Instagram account?", answer: "Yes. Import connects through a compatible Instagram professional (business or creator) account; personal accounts cannot always connect. Switching account type in Instagram's settings is usually enough. If you prefer not to connect, Instagram's own data download gives you the posted media and captions to review by hand."}
        ],
        sources: [
            {label: "Instagram Help Center", href: "https://help.instagram.com/"},
            {label: "IPTC Photo Metadata Standard", href: "https://iptc.org/standards/photo-metadata/"},
            {label: "Cornell Lab of Ornithology, All About Birds", href: "https://www.allaboutbirds.org/"},
            {label: "AmphibiaWeb, amphibian species accounts", href: "https://amphibiaweb.org/"}
        ]
    }),
    post({
        slug: "wildlife-photography-life-list",
        title: "How to Keep a Wildlife Photography Life List",
        description: "How photographers keep a species life list that stays honest: what counts, how to handle uncertain IDs, where old archives fit, and which fields matter.",
        featuredAlt: "A wildlife photography life list built from real species encounters",
        readingMinutes: 4,
        tags: ["life list", "wildlife photography", "checklist"],
        searchIntents: ["wildlife photography life list", "species checklist for photographers", "wildlife photo tracker", "how to keep a life list", "photo life list rules"],
        relatedSlugs: ["organize-years-of-wildlife-photos-by-species", "wildlife-photographers-public-species-portfolio", "wildlife-photography-searchable-body-of-work"],
        tableOfContents: [
            "What a life list is and what a photo life list adds",
            "Decide the rules before you count",
            "A life list is only useful if the IDs stay honest",
            "The fields worth keeping on every entry",
            "One list for new shots and old archives",
            "Keeping the list alive"
        ],
        sections: [
            {
                title: "What a life list is and what a photo life list adds",
                paragraphs: [
                    "A life list is the set of species you have personally encountered, each recorded once with the first date and place. Birders have kept them for over a century, and the convention is simple: one line per species, first encounter wins, everything after that is a repeat. A photo life list is the stricter cousin. The species only counts when you have a photograph that supports the identification, which rules out heard-only birds, brief flybys and the frog that jumped before you raised the camera.",
                    "The stricter rule makes the list more useful rather than less. Every entry has evidence attached, so a wrong identification can be caught and fixed years later. It also removes the temptation to count a glimpse, which is where most inflated lists come from."
                ],
                media: photo("/images/blog/wildlife-photography-life-list/birder-binoculars.webp", "A group of young birdwatchers in a forest scanning with binoculars", 1400, 933, "Binoculars find the bird; the photograph is what lets you defend the identification later. Photo: NPS Photo, Public domain, via Wikimedia Commons.")
            },
            {
                title: "Decide the rules before you count",
                paragraphs: [
                    "Lists drift when the rules are decided case by case. Settle these questions once and write them at the top of the list."
                ],
                cards: [
                    {label: "Wild only, or wild and captive?", body: "Most photographers keep two lists or tag each entry. A zoo snow leopard is a real photograph and a false range record. Never let the two merge."},
                    {label: "Species or subspecies?", body: "Species is the sane default. Subspecies are often unresolvable from a photo and are revised constantly. Note the subspecies in the entry if you are sure; do not count it separately."},
                    {label: "Introduced and feral?", body: "Count established introduced populations (ring-necked parakeets in London, cane toads in Queensland) and tag them. Escaped pets and released individuals do not count."},
                    {label: "Group-level entries?", body: "Allowed, and tagged. “Pelophylax water frog” or “Thamnophis garter snake” is a legitimate line that can be upgraded when a better photo arrives."},
                    {label: "Minimum evidence?", body: "A frame where the diagnostic feature is visible. Not a dot in the sky, not a tail disappearing under a log."}
                ]
            },
            {
                title: "A life list is only useful if the IDs stay honest",
                paragraphs: [
                    "Tick-box lists reward overconfidence, because the tick feels better than the blank. The defence is to record the reason with the name. A great blue heron entry that says “yellow bill, dark cap, Florida, March” can be checked; one that says “heron” cannot. The reason also trains you to look at the diagnostic feature next time rather than the overall impression.",
                    "Names travel badly between continents, which matters for anyone whose archive spans trips. The European robin and the American robin share a name and nothing else; one is an Old World flycatcher, the other a thrush. The grey heron of Europe and the great blue heron of the Americas are sister species that look nearly identical in a photo and are separated mainly by range. A list that stores the scientific name alongside the common one avoids both problems.",
                    "Fix wrong entries by editing the record, not deleting it. Keep the original photo attached and change the name; the audit trail is part of what makes the list trustworthy."
                ],
                media: photo("/images/blog/wildlife-photography-life-list/grey-heron-pond.webp", "Grey heron standing on a mossy rock at the edge of a pond", 1400, 1050, "A grey heron: 90 to 98 cm tall, and separated from the great blue heron of North America chiefly by where you were standing. Photo: Rene Murillo, CC BY 4.0, via Wikimedia Commons."),
                speciesSlugs: ["great-blue-heron", "european-robin", "american-robin"]
            },
            {
                title: "The fields worth keeping on every entry",
                paragraphs: [
                    "A life list that is only a list of names ages badly. These fields take seconds at the time and are nearly impossible to recover later."
                ],
                table: {
                    columns: ["Field", "Why it matters", "Example"],
                    rows: [
                        {cells: ["Species and scientific name", "Common names collide across regions and change", "Grey heron, Ardea cinerea"]},
                        {cells: ["Identification note", "Makes the record checkable", "Dark crown stripe, pale neck, grey wings"]},
                        {cells: ["First date", "The life-list date; keep the camera clock honest", "2019-05-14"]},
                        {cells: ["Place and precision", "Range records live or die on this", "Camargue, Rhône delta, within 1 km"]},
                        {cells: ["Setting", "Wild, captive, farm, domestic", "Wild"]},
                        {cells: ["Evidence", "The original file, not the social copy", "DSC_4471.NEF"]},
                        {cells: ["Confidence", "Lets you upgrade later without pretending", "Species certain / genus only"]}
                    ]
                },
                media: photo("/images/blog/wildlife-photography-life-list/notebook-pen.webp", "A person writing in an open notebook next to a laptop", 1400, 933, "Whatever holds the list, the entry should carry the reason for the identification, not only the name. Photo: Shixart1985, CC BY 2.0, via Wikimedia Commons.")
            },
            {
                title: "One list for new shots and old archives",
                paragraphs: [
                    "Live captures in the app add today's encounters with the location recorded at the time. Instagram import can bring eligible older posts into the same list after you review species, historical place and setting for each one. The two are labelled differently (an archive item is a reconstructed historical record, a live capture is made in the field) and both count for the life list, because a life list is about what you have encountered, not which software you were running.",
                    "That is how a safari from five years ago and a herp night from last week end up in one collection. The import step is deliberately slow: a bulk copy that trusts captions would fill the list with the very guesses the list is supposed to replace."
                ],
                inlineLinks: [companionLink, importLink]
            },
            {
                title: "Keeping the list alive",
                paragraphs: [
                    "Review new entries within a week while the memory is fresh enough to add the place precisely. Once a year, re-check the group-level entries against new photos and promote the ones you can now defend. Submit the bird records to eBird and the rest to iNaturalist; both will correct you occasionally, and both turn your private list into data that researchers use. Then publish the list itself, with precise locations removed for sensitive species, so other people can see what you have actually documented rather than how many followers you have."
                ],
                pullQuote: "A life list is about what you have encountered, not which software you were running."
            }
        ],
        faq: [
            {question: "What is a wildlife photography life list?", answer: "It is a record of every species you have photographed, one entry per species with the first date and place, and the photograph kept as evidence. It differs from a birder's standard life list in that heard-only and glimpsed species do not count; only an identifiable photograph adds a line."},
            {question: "Do zoo animals count on a life list?", answer: "Not on a wild life list. Most photographers keep captive encounters as a separate list or tag each entry wild or captive, because a zoo record is a real photograph but a false range record. The same applies to escaped pets; established introduced populations usually count and are tagged as introduced."},
            {question: "How do I keep a life list honest?", answer: "Write the reason for each identification next to the name, store the scientific name, record the place with its precision, and allow group-level entries such as “garter snake (Thamnophis)” rather than forcing a species. Fix mistakes by editing the entry with the photo still attached so the correction is visible."},
            {question: "Can old Instagram posts go on my life list?", answer: "Yes, after review. A compatible Instagram professional account can be scanned for animal posts, and each one is reviewed for species, historical location and setting before it joins the list as an archive item. It is labelled differently from a live capture but counts as an encounter for the list."},
            {question: "Should I use eBird or iNaturalist as my life list?", answer: "Use them alongside your own list rather than instead of it. eBird handles birds with expert review; iNaturalist covers all taxa with community identification. Both correct errors and contribute to research, but neither keeps your original files or your captive and domestic records, which is what a personal collection is for."}
        ],
        sources: [
            {label: "eBird, Cornell Lab of Ornithology", href: "https://ebird.org/"},
            {label: "iNaturalist", href: "https://www.inaturalist.org/"},
            {label: "Cornell Lab of Ornithology, All About Birds: Great Blue Heron", href: "https://www.allaboutbirds.org/guide/Great_Blue_Heron/"},
            {label: "British Trust for Ornithology", href: "https://www.bto.org/"}
        ]
    }),
    post({
        slug: "wildlife-photography-app-vs-photo-gallery",
        title: "Wildlife Photography App vs Photo Gallery: The Difference",
        description: "Galleries store files and edits. A wildlife app stores identity, place, setting and evidence. What each does well, where they fail, and how to use both.",
        featuredAlt: "Comparison between a generic photo gallery and a wildlife species collection",
        readingMinutes: 4,
        tags: ["wildlife photography app", "photo gallery"],
        searchIntents: ["wildlife photography app vs gallery", "wildlife photo organizer", "animal photo collection app", "best way to organize wildlife photos", "Lightroom for wildlife photos"],
        relatedSlugs: ["organize-years-of-wildlife-photos-by-species", "wildlife-photography-life-list", "wildlife-photos-sitting-on-instagram"],
        tableOfContents: [
            "Galleries answer “do I still have the file?”",
            "A Dex answers “what did I actually document?”",
            "Side by side",
            "Where keywords and albums break down",
            "A workflow that uses both",
            "Where Instagram archives fit"
        ],
        sections: [
            {
                title: "Galleries answer “do I still have the file?”",
                paragraphs: [
                    "Lightroom, Apple Photos, Google Photos and a plain drive are excellent at pixels. They keep the raw file, the edit history, the backups and the export. They sort by date, by camera, by folder and, increasingly, by machine-recognised content. What they do not know is whether the duck in frame was a mallard or a hybrid, whether the python was in a national park or a pet shop, or whether you would still stand behind the name you typed in the keyword box in 2016.",
                    "That is not a criticism. A gallery's job is to be the system of record for the file. It should not pretend to be a field notebook, and the moment it tries, the keyword field fills with guesses that look like facts."
                ],
                media: photo("/images/blog/wildlife-photography-app-vs-photo-gallery/memory-cards.webp", "An SD memory card lying on a laptop keyboard", 1400, 933, "Cards, drives and galleries keep the file. None of them know what animal is on it. Photo: Dinkun Chen, CC BY-SA 4.0, via Wikimedia Commons.")
            },
            {
                title: "A Dex answers “what did I actually document?”",
                paragraphs: [
                    "A wildlife app is organised by animal. Each entry is a species (or an honest group), and attached to it are the encounters: a historical place, a date, a setting of wild or captive, and the original media as evidence. AnimalDex keeps identification, historical location, setting and the original photo or clip together as one record, which is a different job from storing the file.",
                    "The practical difference shows up in the questions you can ask. A gallery can show you every photo from March 2021. A Dex can show you every species you have photographed in the wild, which of them you have only at genus level, and which countries each one came from. A gallery can find “bird” with image recognition. A Dex can tell you that your only blue tit is a captive one from a rescue centre and you still need a wild record."
                ],
                media: photo("/images/blog/wildlife-photography-app-vs-photo-gallery/blue-tit.webp", "Eurasian blue tit perched on a weathered post", 1400, 933, "A blue tit. In a gallery it is “bird, March”; in a Dex it is a species with a place, a date and a setting. Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."),
                speciesSlugs: ["blue-tit", "mallard", "reticulated-python"]
            },
            {
                title: "Side by side",
                paragraphs: [
                    "The two tools overlap less than it looks. Each has a column it owns."
                ],
                table: {
                    columns: ["Job", "Photo gallery", "Wildlife app (Dex)"],
                    rows: [
                        {cells: ["Keeps the raw file and edits", "Yes, this is its purpose", "Keeps the original media as evidence; not an editor"]},
                        {cells: ["Backups and versions", "Yes", "No; back the gallery up"]},
                        {cells: ["Species identity with confidence", "Free-text keyword at best", "Species or honest group, with the index deciding what is supported"]},
                        {cells: ["Historical place", "EXIF GPS if present, otherwise nothing", "Reviewed place, which can be coarser than GPS and can be reconstructed"]},
                        {cells: ["Wild vs captive", "Not a concept", "A field on every record"]},
                        {cells: ["Life list and gaps", "Not a concept", "Built in: what you have, what is group-level, what is missing"]},
                        {cells: ["Old Instagram archive", "Re-import the compressed copies by hand", "Review and import eligible posts from a compatible professional account"]},
                        {cells: ["Sharing", "Export and post", "A public profile organised by species"]}
                    ]
                }
            },
            {
                title: "Where keywords and albums break down",
                paragraphs: [
                    "Keywords look like a species index until you try to use them as one. They are free text, so “mallard”, “Mallard”, “Anas platyrhynchos” and “duck” are four different keywords. They carry no confidence, so a guessed name and a verified one are indistinguishable. They are not revised when a species is split or renamed. And they say nothing about setting, so a search for “tiger” returns the zoo with the national park.",
                    "Albums are worse, because a photo in two albums is two problems. Mallards are a good test case: a drake in eclipse plumage in late summer looks like a female, domestic mallards come in a dozen colours, and mallard hybrids with other ducks are common in city parks. A keyword system has no way to say “mallard, probably, park bird, possibly domestic stock”. A wildlife record does."
                ],
                media: photo("/images/blog/wildlife-photography-app-vs-photo-gallery/mallard.webp", "Mallard with mottled brown body and green on the head, standing on bare ground", 1400, 933, "A mallard in transitional plumage. Park mallards also hybridise and mix with domestic stock, which is exactly the nuance a keyword cannot hold. Photo: Paul Danese, CC BY-SA 4.0, via Wikimedia Commons.")
            },
            {
                title: "A workflow that uses both",
                paragraphs: [
                    "Use both and let each do its job. Cull and edit in the gallery, because that is where the raw file lives and where the backup runs. Then index the encounter in the Dex: species or group, place, setting, and the finished frame as evidence. Keep the gallery filename in the record so the raw file can always be found again. In the field, a live capture made in the app records the place at the time, which saves the reconstruction step entirely."
                ],
                cards: [
                    {label: "Gallery: file and edit", body: "Import the card, cull, edit, back up. Add the scientific name as a keyword if you like, but treat it as a pointer, not a record."},
                    {label: "Dex: identity and encounter", body: "One entry per species. Attach the frame, the place with its precision, the date and the setting. Keep group-level entries where the photo does not support more."},
                    {label: "Field: capture live", body: "For new encounters, capture in the app so the location is recorded when it happens. Imported archive items and live captures are labelled differently in the collection."},
                    {label: "Yearly: reconcile", body: "Walk the gallery's year folder against the Dex once a year and catch the frames that never got indexed."}
                ],
                inlineLinks: [companionLink]
            },
            {
                title: "Where Instagram archives fit",
                paragraphs: [
                    "Instagram is a third thing: neither a gallery nor a catalog, but for many photographers the only place years of wildlife still exist. The feed copy is compressed and stripped of metadata, so it is weak evidence, but it is evidence. AnimalDex can scan a compatible Instagram professional account for animal posts and walk you through reviewing each one for species, historical place and setting before it joins the Dex as an archive item. If the raw files survive in the gallery, link them; if not, the reviewed post is a better record than the feed."
                ],
                inlineLinks: [importLink],
                pullQuote: "A gallery is the system of record for the file. A Dex is the system of record for the encounter."
            }
        ],
        faq: [
            {question: "What is the difference between a wildlife app and a photo gallery?", answer: "A gallery stores and edits files and sorts them by date or folder; a wildlife app stores records organised by species, with place, date, wild-or-captive setting and the photo attached as evidence. The gallery answers whether you still have the file; the wildlife app answers what you have documented and what is missing."},
            {question: "Can I use Lightroom keywords as a species list?", answer: "Only loosely. Keywords are free text with no confidence level, no setting and no revision when names change, so a guessed name and a verified one look identical. They work as pointers back to the raw file. For a life list or a catalog you can trust years later, keep species records in a tool built for them."},
            {question: "Do I need both a gallery and a wildlife app?", answer: "Yes if you shoot raw and care about edits and backups. The gallery remains the home of the file; the wildlife app indexes the encounter. Keep the gallery filename in each record so the two stay linked, and reconcile once a year to catch frames that were edited but never indexed."},
            {question: "Can a wildlife photography app identify animals in old photos?", answer: "It can propose candidates and will keep an honest group-level identity when the photo does not support a species, but you confirm the final name. For old Instagram posts, AnimalDex scans a compatible professional account and asks you to review species, historical place and setting for each candidate before it becomes a record."}
        ],
        sources: [
            {label: "Cornell Lab of Ornithology, All About Birds: Mallard", href: "https://www.allaboutbirds.org/guide/Mallard/"},
            {label: "IPTC Photo Metadata Standard", href: "https://iptc.org/standards/photo-metadata/"},
            {label: "iNaturalist", href: "https://www.inaturalist.org/"}
        ]
    }),
    post({
        slug: "wildlife-photographers-public-species-portfolio",
        title: "How to Build a Public Species Portfolio as a Photographer",
        description: "Build a public wildlife profile around species you have documented, with honest IDs, safe locations and the evidence attached, not follower counts.",
        featuredAlt: "A public AnimalDex profile organized around documented wildlife species",
        readingMinutes: 4,
        tags: ["wildlife creator", "portfolio", "profile"],
        searchIntents: ["wildlife photographer portfolio", "public species collection", "wildlife creator profile", "how to present wildlife photography", "wildlife photography portfolio tips"],
        relatedSlugs: ["wildlife-creator-profile-around-species", "wildlife-photography-life-list", "wildlife-creators-need-a-species-archive"],
        tableOfContents: [
            "Follower count is a weak wildlife credential",
            "What a species portfolio shows that a grid cannot",
            "Build it from records, not highlights",
            "Accuracy is the price of publishing",
            "Protect the animal in the location field",
            "Portfolio and rewards are separate"
        ],
        sections: [
            {
                title: "Follower count is a weak wildlife credential",
                paragraphs: [
                    "An editor, a tour operator or a conservation NGO looking at a wildlife photographer wants to know three things: what have you photographed, where, and can the identifications be trusted. A follower count answers none of them. A grid of 600 unlabelled stills answers them slowly and badly. A public collection organised by species answers all three in one screen: here are 212 species, 180 of them wild, here is each one's place and date, and here is the frame.",
                    "That is a portfolio in the older sense of the word, a body of work with provenance, rather than a feed that rewards the most dramatic crop."
                ],
                media: photo("/images/blog/wildlife-photographers-public-species-portfolio/kingfisher.webp", "Common kingfisher perched on a wooden post with its orange breast and blue back visible", 1400, 1400, "A common kingfisher. On a species portfolio it is one entry with a place and a date; on a feed it is a like count. Photo: Scarabinol, CC BY 4.0, via Wikimedia Commons."),
                speciesSlugs: ["common-kingfisher"]
            },
            {
                title: "What a species portfolio shows that a grid cannot",
                paragraphs: [
                    "A species-first profile makes four things visible at a glance that a chronological grid hides."
                ],
                cards: [
                    {label: "Breadth", body: "How many species, across which groups. A birder with 300 birds and a herper with 40 snakes are both credible; a grid cannot show either number."},
                    {label: "Provenance", body: "Where and when each record was made, and whether it was wild or captive. A zoo portrait is still a good photograph; it is just labelled as one."},
                    {label: "Honesty", body: "Which records are species-level and which are deliberately kept at genus. Visible uncertainty is a credential, not a weakness."},
                    {label: "Depth", body: "Repeated encounters with the same species across seasons and places, which is what shows real field knowledge rather than one lucky frame."}
                ]
            },
            {
                title: "Build it from records, not highlights",
                paragraphs: [
                    "Start with the life list, not the best-of folder. Every species you have a defensible photograph of gets an entry, even if the frame is documentary rather than beautiful; the portfolio is a record of what you have seen, and the hero images sit on top of it. Then work through the archive in lookalike groups so the identifications are consistent: all the tree frogs in one sitting, all the egrets in another.",
                    "Keep the scientific name on every entry. Common names collide across languages and continents, and the people most likely to look at a species portfolio are precisely the ones who will notice. Keep the original file attached in your own records even if only the finished frame is public, so a challenge to an identification can be answered with the full-resolution file."
                ],
                media: photo("/images/blog/wildlife-photographers-public-species-portfolio/tree-frog-b.webp", "Small green European tree frog clinging to a dry reed stem", 1400, 928, "A European tree frog, 4 to 5 cm long, on a reed. A documentary frame like this earns the species its place on the list; the hero shot can come later. Photo: Nicolas Weghaupt, CC0, via Wikimedia Commons."),
                speciesSlugs: ["tree-frog", "red-eyed-tree-frog"]
            },
            {
                title: "Accuracy is the price of publishing",
                paragraphs: [
                    "A public record is a claim. Before an entry is visible, confirm the identity to the level the photo supports and the historical location to the precision you are sure of. Imported Instagram posts in AnimalDex can appear in Discover, which is why each one is reviewed for species, place and setting first, and why false or misleading details can result in an account strike.",
                    "Be explicit about setting. Captive animals belong on a portfolio, labelled, because a photographer who shoots well in a zoo is still a photographer who shoots well. What damages credibility is the captive tiger presented as a wild one, which experienced viewers spot from the background, the condition of the coat and the behaviour."
                ],
                inlineLinks: [companionLink]
            },
            {
                title: "Protect the animal in the location field",
                paragraphs: [
                    "Precise public locations harm some species. Rare reptiles, orchids, nesting raptors, turtles and anything with a pet-trade value are collected or disturbed when a site becomes known, and photographers' posts are a documented source of that information. The rule most field communities follow is to publish the coarse place (county, reserve, region) and keep the precise site private. Your own record can hold the exact location; the public entry does not have to.",
                    "The same applies to timing. A nest site posted during the breeding season draws crowds; the same record posted after fledging does not. Owls, raptors and any bird on a nest are the usual casualties: a single post can bring a dozen photographers to a tree within a day, and repeated disturbance leads some species to abandon the nest.",
                    "A simple rule covers most cases: if a species is on a national protected list, has a pet-trade value, or is scarce enough that a local recorder would want the record, the public entry carries the region and nothing finer. The precise site goes to the recording scheme, which shares it with researchers and hides it from everyone else."
                ]
            },
            {
                title: "Portfolio and rewards are separate",
                paragraphs: [
                    "A public species portfolio is valuable as a record and a credential whether or not any programme pays for contribution. In AnimalDex, archive items imported from Instagram build the collection and the public profile; they are not live captures and do not feed live-contribution programmes. Creator Rewards, which is tied to live field captures during open reward periods, is currently paused. Build the portfolio for what it shows, not for a payout."
                ],
                pullQuote: "Visible uncertainty is a credential. A genus-level entry says you know what the photo does and does not prove."
            }
        ],
        faq: [
            {question: "What should a wildlife photography portfolio include?", answer: "A species-organised list of what you have photographed, each with a place, a date, a wild-or-captive setting and a frame that supports the identification, plus the scientific name. Hero images sit on top of that record. Breadth, provenance and visible honesty about uncertain identifications matter more to editors and NGOs than follower counts."},
            {question: "Should I include zoo photos in a wildlife portfolio?", answer: "Yes, clearly labelled as captive. A well-made zoo portrait shows skill; a captive animal presented as wild destroys credibility, and experienced viewers spot it from the background and the animal's condition. Keep captive and wild entries separate in the list so neither contaminates the other."},
            {question: "Is it safe to publish where I photographed an animal?", answer: "Not always. Precise public locations lead to collection and disturbance of rare reptiles, orchids, turtles and nesting raptors. Publish the coarse place (reserve, county, region) and keep the exact site in your private record. Delay posting nest sites until after the breeding season."},
            {question: "Can imported Instagram posts appear on my public profile?", answer: "Yes. After you review species, historical location and setting, an imported post becomes an archive entry in your AnimalDex collection and may appear in Discover. It is labelled as an archive item rather than a live capture, and false or misleading details can result in an account strike, so review carefully."}
        ],
        sources: [
            {label: "North American Nature Photography Association, ethical field practices", href: "https://www.nanpa.org/"},
            {label: "Cornell Lab of Ornithology, All About Birds", href: "https://www.allaboutbirds.org/"},
            {label: "IUCN Red List of Threatened Species", href: "https://www.iucnredlist.org/"}
        ]
    }),
    post({
        slug: "wildlife-photos-sitting-on-instagram",
        title: "What to Do With Years of Wildlife Photos on Instagram",
        description: "If your best birding, herping and safari pictures only live in a feed: what is at risk, how to get files out, and how to turn them into a species record.",
        featuredAlt: "Years of wildlife Instagram posts waiting to become a searchable collection",
        readingMinutes: 4,
        tags: ["Instagram archive", "wildlife photos"],
        searchIntents: ["wildlife photos on Instagram", "backup Instagram wildlife photos", "import Instagram animal photos", "download all my Instagram photos", "what happens to old Instagram posts"],
        relatedSlugs: ["turn-instagram-wildlife-archive-into-species-collection", "organize-years-of-wildlife-photos-by-species", "wildlife-creators-need-a-species-archive"],
        tableOfContents: [
            "Feeds are a poor archive",
            "What you can still recover from a feed",
            "Three ways to get the pictures out",
            "Rebuilding the record post by post",
            "Import, then keep shooting"
        ],
        sections: [
            {
                title: "Feeds are a poor archive",
                paragraphs: [
                    "Captions get edited. Posts get archived or deleted in a tidy-up. Accounts get locked, hacked or abandoned. The file itself has been resized to roughly 1,080 pixels, re-compressed, and stripped of the EXIF block that held the capture date and any GPS. If the originals are on a phone that was replaced in 2020, the feed copy may be the only version left of a snake you will never see again.",
                    "Instagram was never designed as a wildlife record, and it does not fail loudly. It simply makes the record harder to find every year, as the species you photographed in 2016 sinks under everything since. The way out is to treat the feed as a source to be mined once, carefully, into something built for the job."
                ],
                media: photo("/images/blog/wildlife-photos-sitting-on-instagram/blackbird.webp", "Male common blackbird standing on a lawn with its yellow bill", 1400, 933, "A male blackbird: 23 to 29 cm, yellow bill and eye ring. A common garden bird is still a species record worth keeping outside the feed. Photo: Musicaline, CC BY-SA 4.0, via Wikimedia Commons."),
                speciesSlugs: ["common-blackbird", "european-starling", "house-sparrow"]
            },
            {
                title: "What you can still recover from a feed",
                paragraphs: [
                    "More survives than people expect, as long as you know which fields are facts and which are things you typed."
                ],
                table: {
                    columns: ["Still there", "Gone", "What to do"],
                    rows: [
                        {cells: ["The posted image, about 1,080 px", "Full resolution and the raw file", "Search old drives and cloud backups for the original before settling for the feed copy"]},
                        {cells: ["Post date", "Capture date and time", "Use the post date as a latest-possible date; rebuild the real date from the trip"]},
                        {cells: ["Location tag (a named place)", "GPS coordinates", "Treat the tag as a hint; confirm the place from the itinerary and a map"]},
                        {cells: ["Caption, hashtags, alt text", "Camera and lens data", "Treat the caption's species as a hypothesis to re-check"]},
                        {cells: ["Comments, including corrections", "Nothing to lose here", "Read them; a knowledgeable follower may have corrected your ID years ago"]},
                        {cells: ["Video, re-encoded", "Original clip", "Frames are still usable for identification"]}
                    ]
                }
            },
            {
                title: "Three ways to get the pictures out",
                paragraphs: [
                    "Which route you use depends on whether you want files or records."
                ],
                cards: [
                    {label: "Instagram's data download", body: "Settings, then “Download your information”. You get every posted image and video plus a file of captions and timestamps. It is a backup of the posted copies, not the originals, and it gives you nothing organised by species."},
                    {label: "Your own originals", body: "Old phones, laptop Pictures folders, cloud backups and memory cards left in a drawer. If the raw files exist, they beat the feed copy on every field: date, GPS, resolution."},
                    {label: "Review-and-import", body: "AnimalDex scans a compatible Instagram professional account for animal posts and asks you to confirm species, historical place and setting for each candidate before the original media becomes an archive entry in your Dex. Slower than a bulk download; organised by animal at the end."}
                ],
                inlineLinks: [importLink]
            },
            {
                title: "Rebuilding the record post by post",
                paragraphs: [
                    "Work chronologically through one trip at a time rather than jumping around the grid, because the posts around a picture are your best evidence for where it was taken. Open the itinerary or the old emails, and keep a map in satellite view beside you. For each animal post: decide the identity from the picture (the caption is a hypothesis), place it at the coarsest unit you are sure of, and tag whether it was wild or captive. A toad photographed on a path at dusk is a wild record; the same toad species in a visitor-centre tank is not.",
                    "Expect to downgrade some identifications. A compressed frame of a brown frog often supports the genus and not the species, and the honest move is to record the genus and keep the photo. Expect also to find a few corrections waiting in the comments from people who knew better at the time.",
                    "Budget the time honestly. A feed of 600 posts with perhaps 250 animal pictures takes most people four or five evenings at a minute or two per post, longer for the trips where the itinerary has to be reconstructed. Do the easy, well-documented trips first so the method is settled before the 2014 safari with no notes."
                ],
                media: photo("/images/blog/wildlife-photos-sitting-on-instagram/common-toad.webp", "Common toad sitting in the hollow at the base of a tree", 1400, 992, "A common toad, 8 to 13 cm, in a tree hollow. Setting matters: on a woodland path it is a wild record; in a tank at a visitor centre it is captive. Photo: George Chernilevsky, Public domain, via Wikimedia Commons."),
                speciesSlugs: ["common-frog", "american-toad"]
            },
            {
                title: "Import, then keep shooting",
                paragraphs: [
                    "Bring the eligible posts across, then switch to live capture for new work. A live capture made in the app records the location at the time, which removes the reconstruction step that makes archive work slow. The two kinds of entry are labelled differently in the collection: imported archive items are reviewed historical encounters; live captures are field records. Both count toward the life list. Only live captures feed programmes tied to live contribution, and Creator Rewards is currently paused, so nothing about this is a payout; it is a record. The archive becomes the baseline, and being in the field stays the point."
                ],
                inlineLinks: [companionLink],
                pullQuote: "Treat the feed as a source to be mined once, carefully, into something built for the job."
            }
        ],
        faq: [
            {question: "How do I download all my Instagram wildlife photos?", answer: "Use Instagram's “Download your information” in settings, which exports every posted image and video with a file of captions and timestamps. You get the posted copies (around 1,080 pixels, EXIF stripped), not your originals, and nothing sorted by species. For a species record, review each post into a collection rather than just storing the download."},
            {question: "Does Instagram keep the original quality of my photos?", answer: "No. Uploads are resized to about 1,080 pixels on the long side, re-compressed as JPEG, and stripped of EXIF metadata including the capture date and GPS. If an original exists on an old phone, drive or cloud backup it is a better evidence file on every count. The feed copy is still usable for identification."},
            {question: "Can I turn old Instagram posts into a wildlife life list?", answer: "Yes. Review each animal post for species (from the picture, not the caption), a historical place at the precision you are sure of, and whether it was wild or captive. AnimalDex can scan a compatible professional account for animal posts and walk you through that review before each one becomes an archive entry in your Dex."},
            {question: "What is the difference between an imported post and a live capture?", answer: "An imported post is a reviewed historical encounter with a reconstructed place; a live capture is photographed in the app in the field with its location recorded at the time. Both sit in the same collection and count for the life list, labelled differently. Only live captures feed live-contribution programmes, and Creator Rewards is currently paused."}
        ],
        sources: [
            {label: "Instagram Help Center", href: "https://help.instagram.com/"},
            {label: "IPTC Photo Metadata Standard", href: "https://iptc.org/standards/photo-metadata/"},
            {label: "British Trust for Ornithology, garden bird identification", href: "https://www.bto.org/"},
            {label: "Amphibian and Reptile Conservation Trust", href: "https://www.arc-trust.org/"}
        ]
    }),
    post({
        slug: "how-to-keep-a-herping-field-journal",
        title: "How to Keep a Herping Field Journal",
        description: "What to record after a snake, lizard or frog find: temperature, time, substrate, behaviour and an honest ID, without handling or disturbing the animal.",
        featuredAlt: "A herping field journal with snake and amphibian records",
        readingMinutes: 5,
        tags: ["herping", "field journal", "reptiles"],
        searchIntents: ["herping field journal", "herping app", "snake spotting journal", "what to write in a herping journal", "herping notes temperature"],
        relatedSlugs: ["reptile-amphibian-life-list", "what-to-record-when-you-find-a-snake", "herping-photography-without-disturbing-wildlife"],
        tableOfContents: [
            "Record the find, then leave the animal alone",
            "The fields that matter for herps",
            "Why temperature and time are the core of the record",
            "Identity: species when you can, group when you must",
            "Location is the place of the find",
            "Ethics that belong in the journal"
        ],
        sections: [
            {
                title: "Record the find, then leave the animal alone",
                paragraphs: [
                    "A herping journal is different from a bird list because reptiles and amphibians are governed by conditions. A garter snake is where it is because of the air temperature, the sun on that rock and the time since the last rain. A journal that records those conditions alongside the animal becomes predictive: after a season you know which nights the salamanders cross the road and which hour the wall lizards come out in April.",
                    "The record does not require touching the animal. A photograph from two metres, a few numbers and a sentence of behaviour is a complete entry. Pinning, flipping and crowding add nothing to the journal and a great deal of stress to the animal, and with venomous species they add risk you cannot undo."
                ],
                media: photo("/images/blog/how-to-keep-a-herping-field-journal/field-notebook.webp", "A small Field Notes notebook and a pencil on a desk", 1400, 934, "A pocket notebook is still the fastest field journal; the app is where the record ends up. Photo: Helloquence, CC0, via Wikimedia Commons.")
            },
            {
                title: "The fields that matter for herps",
                paragraphs: [
                    "Most of these take ten seconds at the time and cannot be recovered afterwards. The first six are the ones herpetological surveys actually use."
                ],
                table: {
                    columns: ["Field", "Why", "Example"],
                    rows: [
                        {cells: ["Date and time of day", "Activity is tied to hour and season", "2026-04-18, 21:40"]},
                        {cells: ["Air temperature", "The main predictor of reptile and amphibian activity", "14 °C"]},
                        {cells: ["Weather and recent rain", "Amphibian movement follows rain; basking follows sun", "Overcast, rain 2 h earlier"]},
                        {cells: ["Habitat and microhabitat", "Where in the landscape, and where in the metre around the animal", "Heathland edge; south-facing bank"]},
                        {cells: ["Substrate or cover", "Rock, log, leaf litter, road, under tin, in water", "Basking on tarmac"]},
                        {cells: ["Behaviour", "Basking, moving, feeding, calling, in amplexus, in shed (cloudy eyes)", "Basking, moved off when approached to 3 m"]},
                        {cells: ["Life stage and count", "Adult, juvenile, larva, egg mass; how many", "2 adults, 1 juvenile"]},
                        {cells: ["How found", "Visual search, road cruising, call survey, under cover", "Road cruising, 25 km/h"]},
                        {cells: ["Identity and confidence", "Species or group, and the feature that decided it", "Garter snake (Thamnophis); stripes seen, species not resolved"]},
                        {cells: ["Place and precision", "Where the animal was; how sure you are", "Named reserve, within 100 m; exact site private"]}
                    ]
                }
            },
            {
                title: "Why temperature and time are the core of the record",
                paragraphs: [
                    "Reptiles and amphibians are ectotherms: their body temperature, and therefore their activity, tracks the environment. In temperate regions most snakes are active in a band of roughly 15 to 30 °C air temperature, basking at the cool end and sheltering at the hot end, which is why spring finds happen in the late morning on south-facing slopes and summer finds happen at dusk. Amphibians move on wet, mild nights; a mass migration of common toads to a breeding pond typically starts on the first evenings above about 5 °C with rain, and your journal is how you learn the date for your own pond.",
                    "Write the temperature you measured or the forecast you read, and say which. Over a few seasons the journal shows you the conditions each species appears in, and it starts telling you where to be tonight."
                ],
                media: photo("/images/blog/how-to-keep-a-herping-field-journal/garter-snake.webp", "Eastern garter snake with yellow stripes raising its head among dead wood", 1400, 933, "An eastern garter snake, typically 46 to 66 cm. Note the stripe position and head markings; subspecies are often unresolvable from a photo, and the journal should say so. Photo: Jasper Shide, CC0, via Wikimedia Commons."),
                speciesSlugs: ["red-sided-garter-snake", "eastern-rat-snake"]
            },
            {
                title: "Identity: species when you can, group when you must",
                paragraphs: [
                    "If you cannot identify to species, keep the group. Honesty travels better than a confident wrong name, and herps make this harder than birds: many are identified by scale counts, by the shape of a single head scale, or by a call you did not hear. A fire salamander with yellow blotches is unmistakable; a small brown newt in a torch beam often is not. Write the group, write the feature you could see, and let a later photo or a more experienced friend upgrade the entry.",
                    "Record the reason either way. “Vertical pupil, zigzag, reddish-brown: adder” is a record that can be checked. A name on its own is a guess with a tick next to it."
                ],
                media: photo("/images/blog/how-to-keep-a-herping-field-journal/fire-salamander.webp", "Fire salamander with yellow blotches on wet grass at night", 1400, 933, "A fire salamander, 15 to 25 cm, out on a wet night. Unmistakable to species; many smaller newts are not, and the journal should keep the group. Photo: Thomas Fuhrmann, CC BY-SA 4.0, via Wikimedia Commons."),
                speciesSlugs: ["fire-salamander", "smooth-newt", "alpine-newt"]
            },
            {
                title: "Location is the place of the find",
                paragraphs: [
                    "Do not drop today's GPS on last year's road-cruising photo. The location in a journal is a historical claim about where the animal was at the time, and it should carry a precision: “this bank, within 20 m” or “this reserve, somewhere on the eastern trail”. Unknown is an acceptable answer in your notes. In AnimalDex, a historical location is what you confirm when reviewing an archive item, and a candidate without one stays out of the import queue rather than being pinned to a guess.",
                    "Keep two versions of sensitive sites. The precise one lives in your own journal. The public one, the version that appears on a profile or a community platform, is the coarse place. Adder hibernacula, rare turtle ponds and any site for a species with pet-trade value have been emptied by people who read a precise location online."
                ],
                inlineLinks: [herpingLink]
            },
            {
                title: "Ethics that belong in the journal",
                paragraphs: [
                    "Field behaviour is part of the method, and a few habits keep both the animal and the record intact."
                ],
                cards: [
                    {label: "Do not handle", body: "Handling stresses the animal, transfers skin oils and sunscreen to amphibians that breathe through their skin, and with any snake you have not identified is a bite risk. Photograph from a distance and let it go about its business."},
                    {label: "Replace cover exactly", body: "If you lift a log, board or stone, put it back as it was and let the animal move back under on its own. Never set the cover down on top of the animal."},
                    {label: "No flash on nocturnal frogs", body: "Use a dim torch or red light for amphibians at night and keep the beam off them between frames. A frog's night vision is the thing it hunts and avoids predators with."},
                    {label: "Clean boots between sites", body: "Chytrid fungi (Bd and Bsal) and ranavirus travel on mud. Scrub and dry boots and nets between wetlands; it is the single biggest thing a herper can do for amphibians."},
                    {label: "Do not bait or move animals for a photo", body: "No posing, no placing a snake on a nicer rock, no chilling an animal to slow it down. The journal records what you found, where you found it."}
                ],
                pullQuote: "A photograph from two metres, a few numbers and a sentence of behaviour is a complete entry."
            }
        ],
        faq: [
            {question: "What should I write in a herping field journal?", answer: "Date and time, air temperature, weather and recent rain, habitat and microhabitat, the substrate or cover the animal was on or under, its behaviour, life stage and count, how you found it, the identity with your confidence and the feature that decided it, and the place with a precision. A photograph from a distance completes the record."},
            {question: "Do I need to handle a snake to identify it?", answer: "No, and for a journal record you should not. Most identifications come from pupil shape, head markings, pattern and location, all visible in a photograph taken from two or three metres. Handling stresses the animal and is a bite risk with any snake you have not already identified. If the photo does not resolve the species, record the group."},
            {question: "What temperature do snakes come out?", answer: "In temperate regions most snakes are active at roughly 15 to 30 °C air temperature, basking at the cooler end of that range in spring and retreating or switching to dusk activity at the hot end in summer. Recording the temperature at each find is how your journal learns the exact pattern for your own sites and species."},
            {question: "Can I use flash when photographing frogs at night?", answer: "Avoid it. Nocturnal frogs rely on night vision to hunt and to detect predators, and repeated flash or a bright torch held on the animal disrupts that. Use a dim or red light, keep the beam off the frog between frames, take a few shots and move on."},
            {question: "Can I keep a herping journal in an app?", answer: "Yes. AnimalDex's herping field journal stores the identity, a historical place, the setting and the photo or clip as one record, with group-level identities allowed when the photo does not support a species. Eligible older finds posted to a compatible Instagram professional account can be reviewed into the same journal."}
        ],
        sources: [
            {label: "Partners in Amphibian and Reptile Conservation (PARC)", href: "https://parcplace.org/"},
            {label: "AmphibiaWeb, chytridiomycosis and amphibian declines", href: "https://amphibiaweb.org/chytrid/"},
            {label: "Amphibian and Reptile Conservation Trust", href: "https://www.arc-trust.org/"},
            {label: "Britannica, Reptile", href: "https://www.britannica.com/animal/reptile"}
        ]
    }),
    post({
        slug: "reptile-amphibian-life-list",
        title: "How to Build a Reptile and Amphibian Life List",
        description: "A herp life list that allows group-level entries, records historical places and conditions, and brings older Instagram finds in after review.",
        featuredAlt: "Reptile and amphibian life list cards in a wildlife Dex",
        readingMinutes: 4,
        tags: ["life list", "herping", "amphibians"],
        searchIntents: ["reptile life list", "amphibian tracking app", "herp logging app", "herp life list rules", "how to keep a herp list"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "organize-snake-reptile-photos-by-species", "herping-photos-searchable-collection"],
        tableOfContents: [
            "Lists fail when they demand false precision",
            "Set the rules once",
            "Groups where stopping at genus is the honest entry",
            "What each entry should carry",
            "Old trips still count after review",
            "Keep the list useful to the animals"
        ],
        sections: [
            {
                title: "Lists fail when they demand false precision",
                paragraphs: [
                    "Birders have an advantage: most birds can be identified to species from a decent photo. Herpers do not. Many reptiles and amphibians are separated by scale counts, by a single head scale, by a call, or by range alone, and some groups are hybrid complexes that specialists argue about. A life list that forces a binomial on every line will fill with guesses. A list that can hold “wall lizard (Podarcis)” or “water frog (Pelophylax)” and upgrade later is more useful and more honest.",
                    "The goal of a herp life list is the same as any other: one line per taxon you have encountered, with the first date and place and the evidence attached. The difference is that the taxon is allowed to be a genus."
                ],
                media: photo("/images/blog/reptile-amphibian-life-list/sand-lizard.webp", "Bright green male sand lizard basking on weathered wood", 1400, 700, "A male sand lizard in breeding colour. Easy to species in May; a brown juvenile in September is often “lizard (Lacerta)” until a better photo. Photo: George Chernilevsky, Public domain, via Wikimedia Commons."),
                speciesSlugs: ["common-wall-lizard", "ocellated-lizard"]
            },
            {
                title: "Set the rules once",
                paragraphs: [
                    "Decide these before the first entry and write them at the top of the list."
                ],
                cards: [
                    {label: "Wild and captive stay separate", body: "A leopard gecko on a friend's shelf is not a life-list record. Tag every entry wild, captive or introduced; keep captive encounters in their own list if you want them at all."},
                    {label: "Evidence is a photo or a recording", body: "A frame showing the diagnostic feature, or an audio clip of a call, which for many frogs is the only field-identifiable character."},
                    {label: "Life stage counts", body: "Egg masses, tadpoles and larvae are encounters, but mark the stage. A spotted salamander egg mass is a real record; it is not an adult."},
                    {label: "Dead on road counts, marked", body: "Road-killed animals are legitimate distribution records and are how many rare snakes are found. Record them with the stage “DOR” and never dress them up as live finds."},
                    {label: "Group-level lines are allowed", body: "“Garter snake (Thamnophis)” is a line. It is upgraded, not duplicated, when a species-level photo arrives."}
                ]
            },
            {
                title: "Groups where stopping at genus is the honest entry",
                paragraphs: [
                    "Some groups will sit at genus on most lists for a long time, and that is correct. European water frogs (pool frog, marsh frog and their hybrid, the edible frog) form a complex that is reliably separated only by call and sometimes by genetics. Small brown newts in a torch beam, juvenile wall lizards across the Mediterranean, North American garter snakes with their stripe variation, and dusky salamanders in the Appalachians all resist field identification from a single photo. Record the genus, the feature you could see, and the place, which often narrows the candidates more than the picture does.",
                    "The upgrade path is the point. A genus-level line with a place and a date is something you can go back for with better light and a closer lens; a wrong species-level line is something you will defend by accident for years."
                ],
                media: photo("/images/blog/reptile-amphibian-life-list/smooth-newt-adult.webp", "Male smooth newt on a mossy stone showing its spotted flanks", 1400, 856, "A male smooth newt, 7 to 11 cm, out of water. In a pond at night the smooth and palmate newts are a classic genus-level stop. Photo: gailhampshire, CC BY 2.0, via Wikimedia Commons."),
                speciesSlugs: ["smooth-newt", "pool-frog", "marsh-frog"]
            },
            {
                title: "What each entry should carry",
                paragraphs: [
                    "A herp list entry has two extra fields a bird list does not need: the conditions and the cover. Both are how the list becomes predictive."
                ],
                table: {
                    columns: ["Field", "Example", "Why it matters"],
                    rows: [
                        {cells: ["Taxon and confidence", "Podarcis muralis; species certain", "Separates a defended name from a hope"]},
                        {cells: ["First date and time", "2024-04-12, 11:15", "Season and hour define herp activity"]},
                        {cells: ["Place and precision", "Old town walls, Dubrovnik, within 50 m", "Range records need a precision to be useful"]},
                        {cells: ["Setting", "Wild", "Captive records contaminate everything downstream"]},
                        {cells: ["Air temperature and weather", "18 °C, sunny after rain", "The conditions you will look for next time"]},
                        {cells: ["Substrate or cover", "Basking on limestone wall", "Microhabitat is the most repeatable clue to finding a species again"]},
                        {cells: ["Life stage", "Adult", "Larvae and egg masses are different records"]},
                        {cells: ["Evidence", "Photo from 2 m; no handling", "The file that backs the name"]}
                    ]
                },
                media: photo("/images/blog/reptile-amphibian-life-list/wall-lizard.webp", "Common wall lizard basking on a stone with its tail curled", 1400, 934, "A common wall lizard on stone. Across the Mediterranean the genus holds over 20 similar species, and the place is often the decisive clue. Photo: Marie-Lan Nguyen, CC BY 2.5, via Wikimedia Commons.")
            },
            {
                title: "Old trips still count after review",
                paragraphs: [
                    "Eligible Instagram posts can join the same list. AnimalDex scans a compatible Instagram professional account for animal posts and asks you to confirm species or group, a historical place and the setting for each one before it becomes an archive entry in your Dex. Review is the cost of bringing a night herp from 2018 into 2026 without inventing coordinates, and a candidate without a confirmed place stays out rather than being pinned to a guess. Archive items are labelled separately from live captures made in the field with the app; both count for the life list."
                ],
                inlineLinks: [herpingLink, importLink]
            },
            {
                title: "Keep the list useful to the animals",
                paragraphs: [
                    "A herp list is also distribution data, and distribution data for reptiles and amphibians is thin almost everywhere. Submit records to the scheme that covers your region: HerpMapper takes records worldwide and shares them with researchers while hiding precise locations from the public; national recording schemes and iNaturalist do the same for many countries. Keep precise sites private on your own public profile for any species that is collected or persecuted, which includes most snakes, all tortoises and many turtles, and move on from a find rather than returning daily. A list built this way is a credential, a planning tool and a small contribution to the maps that protect the places on it."
                ],
                pullQuote: "A genus-level line with a place and a date is something you can go back for. A wrong species-level line is something you will defend by accident for years."
            }
        ],
        faq: [
            {question: "What counts on a reptile and amphibian life list?", answer: "A wild encounter you can evidence with a photograph or, for calling frogs, a recording, recorded once per taxon with the first date and place. Captive animals belong on a separate list. Egg masses, larvae and road-killed animals are legitimate records if the life stage or condition is marked. Group-level entries are allowed and upgraded later."},
            {question: "Can I add a frog to my life list if I only heard it?", answer: "Yes, if you recorded the call, because for many frogs the call is the most reliable field character and the way surveys identify them. Store the audio as the evidence and mark the entry heard-only. A visual record can be added to the same line later; it does not create a second entry."},
            {question: "How do I identify a newt or lizard I only saw briefly?", answer: "Record the genus and the feature you could see rather than guessing the species. Smooth and palmate newts, juvenile wall lizards and garter snakes often cannot be separated from one photo. Note the place and conditions, which narrow the candidates, and go back with better light; the entry is upgraded, not duplicated."},
            {question: "Can old Instagram herping photos go on my list?", answer: "Yes, after review. A compatible Instagram professional account can be scanned for animal posts, and each is reviewed for species or group, historical place and setting before it joins the list as an archive item. Posts you cannot place honestly stay out, and compressed photos often support the genus rather than the species."},
            {question: "Should I share where I found a snake?", answer: "Share the coarse place (region, county, reserve) and keep the precise site private. Snakes, tortoises and turtles are collected for the pet trade and persecuted when sites become known. Submit the precise record to a scheme like HerpMapper or a national recording programme, which protects locations while making the data available to researchers."}
        ],
        sources: [
            {label: "HerpMapper, global reptile and amphibian records", href: "https://www.herpmapper.org/"},
            {label: "AmphibiaWeb", href: "https://amphibiaweb.org/"},
            {label: "The Reptile Database", href: "https://reptile-database.reptarium.cz/"},
            {label: "IUCN Red List of Threatened Species", href: "https://www.iucnredlist.org/"}
        ]
    }),
    post({
        slug: "organize-snake-reptile-photos-by-species",
        title: "How to Organize Snake and Reptile Photos by Species",
        description: "Sort snake and reptile pictures by honest identity, not trip folder: lookalike groups, the features that separate them, when to stop at genus, and setting.",
        featuredAlt: "Snake and reptile photographs organized by species identity",
        readingMinutes: 4,
        tags: ["snakes", "reptile photography", "organization"],
        searchIntents: ["organize snake photos", "reptile photo organizer", "snake photography app", "identify snake from photo", "sort reptile photos by species"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "herping-photos-searchable-collection", "reptile-amphibian-life-list"],
        tableOfContents: [
            "Trip folders hide lookalikes",
            "Sort by lookalike group before you sort by species",
            "The features that actually separate snakes in a photo",
            "When to stop at genus",
            "Setting: wild, captive, or somebody's pet",
            "Import is review, not magic"
        ],
        sections: [
            {
                title: "Trip folders hide lookalikes",
                paragraphs: [
                    "Bali snakes and Florida snakes in one dump is how pit vipers and harmless mimics get filed under the same guess. A folder named by trip holds everything you saw in one place, which is the opposite of what identification needs: all the similar animals together so the one feature that separates them is in front of you. Index by identity first, and let the trip become a field on the record rather than the drawer it lives in.",
                    "Reptiles punish this more than birds do. Pattern varies within a species, colour changes with age and shed cycle, and a juvenile is often a different-looking animal from the adult. A corn snake and a juvenile rat snake, a milk snake and a coral snake, a harmless water snake and a cottonmouth: each pair has been misfiled by careful people."
                ]
            },
            {
                title: "Sort by lookalike group before you sort by species",
                paragraphs: [
                    "Work in three passes, each one over the whole archive."
                ],
                cards: [
                    {label: "Pass 1: coarse group", body: "Snake, lizard, turtle or tortoise, crocodilian. Then within snakes: vipers and pit vipers, colubrids, elapids, boas and pythons, as far as you can tell. This takes seconds per photo."},
                    {label: "Pass 2: lookalike cluster", body: "Within a group, pile the ones that could be confused for each other: all the banded red-black-yellow snakes, all the plain brown terrestrial snakes, all the blotched juveniles. Resolve each pile with a regional guide open."},
                    {label: "Pass 3: species or honest stop", body: "Name each photo to the level the frame supports and write the feature that decided it. Keep genus-level names where the diagnostic character is not visible."}
                ],
                media: photo("/images/blog/organize-snake-reptile-photos-by-species/corn-snake.webp", "Corn snake with orange and red blotches coiled on bark", 1400, 1100, "A corn snake, 60 to 120 cm. Adults are distinctive; blotched juveniles of several rat snakes are routinely confused with them. Photo: Peter Paplanus, CC BY 2.0, via Wikimedia Commons."),
                speciesSlugs: ["corn-snake", "eastern-rat-snake", "common-rat-snake"]
            },
            {
                title: "The features that actually separate snakes in a photo",
                paragraphs: [
                    "Overall impression is what gets people into trouble. These are the characters that resolve most lookalike pairs, and the ones to zoom in on in a full-resolution file."
                ],
                table: {
                    columns: ["Pair often confused", "Decisive feature in a photo", "Note"],
                    rows: [
                        {cells: ["Milk snake vs coral snake (North America)", "Band order: red touching black (milk) vs red touching yellow (coral), plus snout colour", "The rhyme is reliable only in the United States; it fails on many Latin American coral snakes"]},
                        {cells: ["Adder vs grass snake vs smooth snake (Europe)", "Vertical pupil and zigzag (adder); yellow collar and round pupil (grass); dark eye stripe and plain brown (smooth)", "Black adders exist; rely on the pupil, not the zigzag"]},
                        {cells: ["Water snake vs cottonmouth (southeast US)", "Cottonmouth has a heavy, blocky head, a facial pit, and often swims with body high on the water", "Head shape alone is unreliable; harmless snakes flatten their heads when threatened"]},
                        {cells: ["Rattlesnake vs gopher snake or bullsnake", "A rattle (or button in juveniles), vertical pupil, facial pit", "Gopher snakes hiss and shake the tail in leaf litter to mimic a rattle"]},
                        {cells: ["Corn snake vs juvenile rat snake", "Spear-point mark on the head and checkerboard belly (corn); juvenile rat snakes lose their blotches with age", "Location narrows it fast"]}
                    ]
                },
                media: photo("/images/blog/organize-snake-reptile-photos-by-species/milk-snake.webp", "Eastern milk snake with reddish blotches crossing a lawn", 1400, 933, "An eastern milk snake, 60 to 90 cm. Compare band order and snout colour against a coral snake before you file it. Photo: Lusilier, CC0, via Wikimedia Commons."),
                speciesSlugs: ["milk-snake", "western-diamondback-rattlesnake"]
            },
            {
                title: "When to stop at genus",
                paragraphs: [
                    "A photo that does not show the deciding feature does not support the species, and the right record is the genus with the feature you could see. “Rattlesnake (Crotalus), rattle visible, pattern obscured by grass, Arizona” is an honest and useful line. “Western diamondback” on the same photo is a coin toss dressed as a fact. Garter snakes, rat snakes in regions where several overlap, small brown snakes, and most skinks and geckos from a phone photo at night are common genus-level stops.",
                    "The upgrade path keeps the list honest. A genus-level entry with a place and a date is something you can go back and improve; a wrong species name gets copied into your life list and defended by habit."
                ],
                media: photo("/images/blog/organize-snake-reptile-photos-by-species/rattlesnake.webp", "Western diamondback rattlesnake coiled with its rattle raised among leaf litter", 1400, 982, "A western diamondback rattlesnake, coiled with the rattle up. If the rattle and tail bands are not in frame, the honest file name is often just “rattlesnake”. Photo: Peter Paplanus, CC BY 2.0, via Wikimedia Commons.")
            },
            {
                title: "Setting: wild, captive, or somebody's pet",
                paragraphs: [
                    "Reptile archives mix settings more than any other group, because so many species are kept. A ball python on a friend's hand, a reticulated python at a zoo, a corn snake in a classroom tank and a wild corn snake under a Florida board are four records with four settings, and only the last is a wild encounter. Tag the setting before the identity if you have to choose, because a captive animal filed as wild corrupts every list and map downstream. Keep escaped and released pets as captive-origin records; a Burmese python in the Everglades is an established introduced population and is tagged that way instead."
                ],
                speciesSlugs: ["ball-python", "reticulated-python", "burmese-python"]
            },
            {
                title: "Import is review, not magic",
                paragraphs: [
                    "If the snakes already live on Instagram, AnimalDex can scan a compatible professional account for animal posts and queue each one for review. You confirm the species or group, the historical place and the setting before the original media becomes an archive entry in your Dex. The app will not invent a species-level identification to make the grid prettier, and it will not promote a “rattlesnake” to a diamondback because the card looks better. Archive items from the feed and live captures made in the field are labelled differently; both count for the life list.",
                    "Keep precise sites of snakes out of anything public. Snakes are collected and killed when locations become known; the coarse place is the public record, and the exact one stays in your own journal."
                ],
                inlineLinks: [herpingLink, importLink],
                pullQuote: "Index by identity first, and let the trip become a field on the record rather than the drawer it lives in."
            }
        ],
        faq: [
            {question: "How do I identify a snake from a photo?", answer: "Zoom in on the deciding characters rather than the overall look: pupil shape, the presence of a facial pit or rattle, band order and snout colour on banded snakes, head and neck markings, and the place it was photographed, which rules most species out. If the deciding feature is not visible, record the genus and note the features you could see."},
            {question: "What is the best way to organize snake photos?", answer: "Sort the whole archive into lookalike groups first (banded, plain brown, blotched juveniles) and resolve each group with a regional guide open, then file by species or honest genus with the trip, place and setting as fields on each record. Trip folders hide lookalikes; identity-first indexing exposes them."},
            {question: "Is the “red touches yellow” rhyme reliable?", answer: "Only within the United States, where it separates coral snakes from milk and king snakes most of the time. It fails on many Central and South American coral snakes and on aberrant individuals. Treat it as a first check, not a rule, and never handle a banded snake on the strength of a rhyme."},
            {question: "Should pet and zoo reptiles be in my collection?", answer: "They can be, tagged as captive and kept out of the wild list. Reptile archives mix settings more than any group because so many species are kept, and one captive corn snake filed as wild corrupts the range data downstream. Established introduced populations, such as Burmese pythons in Florida, are tagged introduced rather than captive."},
            {question: "Can AnimalDex import my snake photos from Instagram?", answer: "Yes, from a compatible Instagram professional account. It scans for animal posts and queues candidates, and you confirm species or group, historical place and setting for each before the original media becomes an archive entry. It keeps genus-level identities when the photo does not support a species rather than inventing one."}
        ],
        sources: [
            {label: "Britannica, Snake", href: "https://www.britannica.com/animal/snake"},
            {label: "Smithsonian's National Zoo and Conservation Biology Institute", href: "https://nationalzoo.si.edu/"},
            {label: "The Reptile Database", href: "https://reptile-database.reptarium.cz/"},
            {label: "Partners in Amphibian and Reptile Conservation", href: "https://parcplace.org/"}
        ]
    }),
    post({
        slug: "what-to-record-when-you-find-a-snake",
        title: "What to Record When You Find a Snake in the Wild",
        description: "A field checklist for snake finds: distance and safety first, then the photo, the conditions, an honest identification and a location that is true.",
        featuredAlt: "Field notes beside a wild snake observation at a safe distance",
        readingMinutes: 5,
        tags: ["snakes", "field notes", "safety"],
        searchIntents: ["what to record when you find a snake", "snake identification journal", "snake spotting app", "what to do if you find a snake", "how to photograph a snake safely"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "herping-photography-without-disturbing-wildlife", "reptile-amphibian-life-list"],
        tableOfContents: [
            "Safety before the notebook",
            "The sixty-second checklist",
            "The photo that supports an identification",
            "Identify honestly, from a distance",
            "Minimum useful record",
            "Location is a historical claim"
        ],
        sections: [
            {
                title: "Safety before the notebook",
                paragraphs: [
                    "Stop, and stay where you are. Most bites happen to people who approach, handle or try to move a snake, and a snake you have not identified is treated as venomous until a qualified person says otherwise. Two metres is a working minimum for anything under a metre long; more for large vipers, cobras and anything you cannot see the whole of. Leave the animal an escape route and do not stand between it and cover. Do not handle snakes because an app suggested a name; an identification on a phone screen is not a reason to pick anything up.",
                    "AnimalDex is educational. It is not a safety authority, and no identification tool replaces a regional guide and local advice on which species are dangerous where you are."
                ],
                media: photo("/images/blog/what-to-record-when-you-find-a-snake/adder-2.webp", "European adder with a dark zigzag lying on dry heath vegetation", 1400, 928, "An adder, 60 to 80 cm, among dry heather. The vertical pupil and zigzag are visible from well outside striking range. Photo: Janus Mosbacher, CC BY-SA 4.0, via Wikimedia Commons.")
            },
            {
                title: "The sixty-second checklist",
                paragraphs: [
                    "Everything below can be done from where you stopped, in about a minute, before the snake moves."
                ],
                cards: [
                    {label: "1. Photograph first", body: "Several frames from your current distance, then a longer-lens or zoomed frame of the head. Do not approach for a better angle until you know what it is."},
                    {label: "2. Time and temperature", body: "Read the clock and the thermometer or forecast. Note sun or shade on the animal. These two numbers are the core of any snake record."},
                    {label: "3. Where exactly it was", body: "Substrate (rock, tarmac, leaf litter, under a board), microhabitat (south-facing bank, pond margin), and what it was doing: basking, crossing, hunting, in shed."},
                    {label: "4. Length and condition", body: "Estimate length against something in frame. Note cloudy eyes (about to shed), injuries, or a swollen midsection (recent meal)."},
                    {label: "5. Behaviour on your approach", body: "Froze, fled, flattened its head, hissed, rattled or shook its tail, struck. All of this helps identification and tells the next person what to expect."},
                    {label: "6. Leave", body: "Back away the way you came. Do not follow it to cover, and do not lift the cover it went under."}
                ]
            },
            {
                title: "The photo that supports an identification",
                paragraphs: [
                    "One frame with the deciding feature beats twenty of the whole animal. For most lookalike pairs that feature is the head: pupil shape (vertical in vipers and many nocturnal snakes, round in most colubrids), a facial pit between eye and nostril on pit vipers, the pattern on the crown and neck, and the colour of the snout on banded species. A side-on head shot at a long focal length, taken from a safe distance, is usually enough. Then a frame of the whole body for pattern and a rough length, and a frame of the tail for a rattle or button.",
                    "Shoot with the lens you have, not by getting closer. A phone at 3x from two metres gives a usable head frame on anything over half a metre. If the snake is partly hidden, photograph what is visible and accept a genus-level record; that is better than the photo you would get by moving the vegetation."
                ],
                media: photo("/images/blog/what-to-record-when-you-find-a-snake/rat-snake.webp", "Black rat snake with a pale chin moving across bare ground", 1400, 933, "A black rat snake, often 1 to 1.8 m. The pale chin, round pupil and plain black back separate it from the racers and cottonmouths it is mistaken for. Photo: Judy Gallagher, CC BY 2.0, via Wikimedia Commons."),
                speciesSlugs: ["eastern-rat-snake", "red-sided-garter-snake", "western-diamondback-rattlesnake"]
            },
            {
                title: "Identify honestly, from a distance",
                paragraphs: [
                    "Write down the feature that decided the name, not just the name. “Round pupil, dark eye stripe, plain brown, no collar: smooth snake” is a record someone can check; “smooth snake” is an opinion. If the deciding feature is not in the photo, record the group and the features you did see. A plain brown snake that fled into bracken is “snake, plain brown, about 50 cm, round pupil not confirmed” and that is a complete and honest entry.",
                    "Lookalikes are where the danger is. Harmless snakes flatten their heads into a triangle when threatened, so head shape is unreliable; some vipers are black with no zigzag; juvenile rat snakes carry blotches that read as a different species. Check the regional guide and, where it is available, the community: a snake identification group with regional experts will correct a wrong call within hours. Bring the correction back into your own record."
                ],
                media: photo("/images/blog/what-to-record-when-you-find-a-snake/smooth-snake-2.webp", "Smooth snake coiled on a mossy stone with its dark eye stripe visible", 1400, 933, "A smooth snake, 60 to 70 cm and non-venomous, often mistaken for an adder. The round pupil and the dark stripe through the eye decide it. Photo: Lennart Hudel, CC BY-SA 4.0, via Wikimedia Commons.")
            },
            {
                title: "Minimum useful record",
                paragraphs: [
                    "A still or short clip, an honest identity or group, a historical place with a precision, whether the animal was wild, and the time and temperature. That is enough to keep the find in a Dex and enough for a recording scheme to use. Everything else in the checklist makes the record better; nothing else is required."
                ],
                table: {
                    columns: ["Field", "Minimum", "Better"],
                    rows: [
                        {cells: ["Evidence", "One photo of the head or pattern", "Head side-on, whole body, tail; a short clip of behaviour"]},
                        {cells: ["Identity", "Group plus the features seen", "Species with the deciding feature written down"]},
                        {cells: ["Place", "Reserve or site name, with precision", "Point location kept private; coarse place public"]},
                        {cells: ["Setting", "Wild", "Wild, with how found: visual, road cruising, under cover"]},
                        {cells: ["Conditions", "Time and approximate temperature", "Measured temperature, weather, recent rain, sun or shade"]},
                        {cells: ["Animal", "Rough length", "Length, condition, life stage, behaviour on approach"]}
                    ]
                },
                inlineLinks: [herpingLink]
            },
            {
                title: "Location is a historical claim",
                paragraphs: [
                    "The place in a snake record is where the animal was when you photographed it, at the precision you are sure of. A live capture made in the app records that at the time. For an older photo, reconstruct the place from the trip and a map and say how precise the reconstruction is; a candidate without a confirmed historical location stays out of an Instagram import rather than being pinned to today's GPS. Keep the precise site in your own journal and publish only the coarse place, because snakes are collected and killed when locations become known. The record is for you and for the scheme that maps the species; it is not a treasure map."
                ],
                pullQuote: "One frame with the deciding feature beats twenty of the whole animal."
            }
        ],
        faq: [
            {question: "What should I do if I find a snake in the wild?", answer: "Stop, stay at least two metres away, leave it an escape route and do not try to handle, move or follow it. Photograph it from where you are, note the time, temperature, substrate and behaviour, then back away the way you came. Treat any snake you have not identified as venomous until a qualified person says otherwise."},
            {question: "How do I photograph a snake safely?", answer: "Use the longest lens or zoom you have from a safe distance, at least two metres and more for large or venomous species, and never move vegetation or cover to get a cleaner frame. Aim for a side-on head shot showing the pupil and any facial pit, a whole-body frame for pattern, and the tail. Accept a genus-level record rather than approaching."},
            {question: "Can an app identify a snake for me?", answer: "An app can propose candidates and a Dex can keep an honest group-level identity, but no app is a safety authority and an identification on a screen is never a reason to handle a snake. Confirm with a regional guide or a snake identification group with local experts, and record the feature that decided the name."},
            {question: "What information do snake recording schemes want?", answer: "Species or group with your confidence, date and time, a location with its precision, whether the animal was alive or road-killed, and a photograph. Temperature, weather, substrate and behaviour make the record more valuable. Schemes such as HerpMapper and national recording programmes hide precise sites from the public while sharing them with researchers."},
            {question: "Should I post where I found a snake?", answer: "Post the coarse place only (region, county, reserve) and keep the exact site in your own journal. Snakes are collected for the pet trade and killed by people who learn where they are, and precise public locations have emptied known sites. Submit the exact record to a recording scheme that protects locations instead."}
        ],
        sources: [
            {label: "CDC / NIOSH, venomous snakes: risks and first aid", href: "https://www.cdc.gov/niosh/topics/snakes/"},
            {label: "Britannica, Snake", href: "https://www.britannica.com/animal/snake"},
            {label: "Amphibian and Reptile Conservation Trust, UK snake identification", href: "https://www.arc-trust.org/"},
            {label: "HerpMapper", href: "https://www.herpmapper.org/"}
        ]
    })
];

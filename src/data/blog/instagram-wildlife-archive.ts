import type {BlogPost} from "@/data/blog/types";

const image = (alt: string): BlogPost["featuredImage"] => ({
    src: "/images/placeholders/feature-collection-overview.svg",
    alt,
    width: 1200,
    height: 800
});

function post(input: Omit<BlogPost, "featuredImage" | "author" | "publishedAt" | "updatedAt" | "speciesSlugs"> & {featuredAlt: string}): BlogPost {
    return {
        ...input,
        author: "AnimalDex Field Desk",
        publishedAt: "2026-08-30",
        updatedAt: "2026-08-30",
        speciesSlugs: [],
        featuredImage: image(input.featuredAlt)
    };
}

export const instagramWildlifeArchivePosts: BlogPost[] = [
    post({
        slug: "organize-years-of-wildlife-photos-by-species",
        title: "How to Organize Years of Wildlife Photos by Species",
        description: "A practical way to turn a scattered wildlife photo archive into a species collection you can search, review, and keep honest.",
        featuredAlt: "Wildlife photo cards arranged into a species collection instead of a camera roll",
        readingMinutes: 8,
        tags: ["wildlife photography", "photo organization", "Instagram import"],
        searchIntents: ["organize wildlife photos", "wildlife photo catalog", "wildlife species photo organizer"],
        relatedSlugs: ["wildlife-photography-life-list", "wildlife-photography-app-vs-photo-gallery", "turn-instagram-wildlife-archive-into-species-collection"],
        tableOfContents: ["Why folders fail", "Species before folders", "Bring an Instagram archive across", "What not to automate"],
        sections: [
            {
                title: "Why a camera roll is a weak wildlife catalog",
                paragraphs: [
                    "Most wildlife photographers already have the pictures. What they lack is a species index: what animal it was, where it actually was, and whether that identification is honest.",
                    "Folders named Bali 2019 or Snakes mix habitats, years, and lookalikes. A Dex organizes by animal first, then keeps the encounter attached."
                ]
            },
            {
                title: "Species first, then place, then setting",
                paragraphs: [
                    "Start with the animal, not the trip. Confirm identity, including group-level names when a species-level card would be a guess.",
                    "Then confirm a historical location — the place you stood when you made the picture, not today's GPS pin. Setting (wild, zoo, farm, domestic) keeps captive and free-ranging records from collapsing into each other."
                ]
            },
            {
                title: "If the archive already lives on Instagram",
                paragraphs: [
                    "AnimalDex can look through a compatible Instagram professional account for animal posts. You still review species and location before original media becomes a capture.",
                    "That is slower than a bulk dump, and that is the point. A wildlife catalog that auto-trusts captions will lie to you later."
                ],
                inlineLinks: [
                    {text: "Wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"},
                    {text: "Import Instagram wildlife photos", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}
                ]
            },
            {
                title: "What not to automate",
                paragraphs: [
                    "Do not let a hashtag become a coordinate. Do not promote a lookalike group to a species because it looks cleaner. Do not assume imported posts qualify as live Creator Rewards contribution."
                ]
            }
        ],
        faq: [
            {question: "Can I organize wildlife photos without reshooting them?", answer: "Yes. Eligible Instagram posts can be reviewed and imported into AnimalDex instead of starting from zero."},
            {question: "Should every photo become a public record?", answer: "Only after you confirm identity and a historical location. Imported posts may publish to Discover."}
        ]
    }),
    post({
        slug: "turn-instagram-wildlife-archive-into-species-collection",
        title: "How to Turn Your Instagram Wildlife Archive Into a Species Collection",
        description: "Connect Instagram, find animal posts, review the details that matter, and keep the original photos in a Dex instead of a vanishing feed.",
        featuredAlt: "Path from an Instagram wildlife feed into an AnimalDex species collection",
        readingMinutes: 7,
        tags: ["Instagram", "wildlife archive", "collection"],
        searchIntents: ["organize Instagram wildlife photos", "wildlife Instagram archive", "import Instagram animal photos"],
        relatedSlugs: ["wildlife-photos-sitting-on-instagram", "organize-years-of-wildlife-photos-by-species", "wildlife-creators-need-a-species-archive"],
        tableOfContents: ["Feeds disappear", "Connect, find, review, import", "Professional accounts", "Rewards stay separate"],
        sections: [
            {
                title: "A feed is a timeline, not a collection",
                paragraphs: [
                    "Instagram is good at showing work in order. It is bad at answering what have I actually documented, which snakes, which birds, which places.",
                    "AnimalDex is built for that second question. Import is the bridge when the pictures already exist."
                ]
            },
            {
                title: "The actual import path",
                paragraphs: [
                    "Connect a compatible Instagram professional account. AnimalDex looks through posts for animals. You confirm species, a historical location, and setting. Original eligible photos and videos become Dex captures.",
                    "Videos can be included when the device can sample them. Not every post will qualify. Named failures stay visible so a partial import is not treated as a total loss."
                ],
                inlineLinks: [{text: "Open the Instagram import path", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}]
            },
            {
                title: "Professional accounts, not a Meta endorsement",
                paragraphs: [
                    "Import needs a compatible Instagram professional account. Personal accounts cannot always connect. AnimalDex is not an official Instagram partner and does not ask for messaging permissions."
                ]
            },
            {
                title: "Collection is not Creator Rewards",
                paragraphs: [
                    "Imported posts help build your Dex. They do not add qualifying live-capture wildlife signals. Creator Rewards stay tied to live contribution."
                ]
            }
        ]
    }),
    post({
        slug: "wildlife-photography-life-list",
        title: "Best Ways to Keep a Wildlife Photography Life List",
        description: "How photographers can keep a species checklist that still respects identification limits and historical locations.",
        featuredAlt: "A wildlife photography life list built from real species encounters",
        readingMinutes: 7,
        tags: ["life list", "wildlife photography", "checklist"],
        searchIntents: ["wildlife photography life list", "species checklist for photographers", "wildlife photo tracker"],
        relatedSlugs: ["organize-years-of-wildlife-photos-by-species", "wildlife-photographers-public-species-portfolio", "wildlife-photography-searchable-body-of-work"],
        sections: [
            {
                title: "A life list is only useful if the IDs stay honest",
                paragraphs: [
                    "Tick-box lists reward overconfidence. A Dex that keeps group-level identities when the picture cannot support a species is a better long-term list.",
                    "Photographers already collect evidence. The list should store that evidence, not replace it with a slogan."
                ]
            },
            {
                title: "One list for new shots and old archives",
                paragraphs: [
                    "Live scans add today's encounters. Instagram import can bring eligible older posts into the same list after review.",
                    "That is how a safari from five years ago and a herp night from last week sit in one collection."
                ],
                inlineLinks: [
                    {text: "Wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"},
                    {text: "Import from Instagram", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}
                ]
            }
        ]
    }),
    post({
        slug: "wildlife-photography-app-vs-photo-gallery",
        title: "Wildlife Photography App vs Photo Gallery: What’s the Difference?",
        description: "Galleries store files. A wildlife app stores identity, place, setting, and a collection you can return to.",
        featuredAlt: "Comparison between a generic photo gallery and a wildlife species collection",
        readingMinutes: 6,
        tags: ["wildlife photography app", "photo gallery"],
        searchIntents: ["wildlife photography app vs gallery", "wildlife photo organizer", "animal photo collection app"],
        relatedSlugs: ["organize-years-of-wildlife-photos-by-species", "wildlife-photography-life-list", "wildlife-photos-sitting-on-instagram"],
        sections: [
            {
                title: "Galleries answer 'do I still have the file?'",
                paragraphs: [
                    "Lightroom, Photos, and Drive are excellent at pixels, backups, and edits. They do not know a reticulated python from a garden hose, and they should not pretend to."
                ]
            },
            {
                title: "A Dex answers 'what did I actually document?'",
                paragraphs: [
                    "AnimalDex keeps identification, historical location, wild versus captive setting, and original media together. That is a different job from a gallery.",
                    "Use both. Edit in the gallery. Index the encounter in the Dex. Instagram import exists for archives that never left the feed."
                ],
                inlineLinks: [
                    {text: "Wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"},
                    {text: "Import Instagram wildlife photos", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}
                ]
            }
        ]
    }),
    post({
        slug: "wildlife-photographers-public-species-portfolio",
        title: "How Wildlife Photographers Can Build a Public Species Portfolio",
        description: "Build a public wildlife profile around species you have actually documented, not around follower count.",
        featuredAlt: "A public AnimalDex profile organized around documented wildlife species",
        readingMinutes: 7,
        tags: ["wildlife creator", "portfolio", "profile"],
        searchIntents: ["wildlife photographer portfolio", "public species collection", "wildlife creator profile"],
        relatedSlugs: ["wildlife-creator-profile-around-species", "wildlife-photography-life-list", "wildlife-creators-need-a-species-archive"],
        sections: [
            {
                title: "Follower count is a weak wildlife credential",
                paragraphs: [
                    "A public Dex can show what you have documented: species, places, and whether the record is wild or captive. That is a clearer portfolio than a grid of unlabelled stills."
                ]
            },
            {
                title: "Accuracy is the price of publishing",
                paragraphs: [
                    "Imported posts may appear in Discover. Confirm identity and historical location first. False details can become an account strike.",
                    "Creator Rewards remain a live-contribution path. A public archive is still valuable without being a payout event."
                ],
                inlineLinks: [{text: "Wildlife photography use case", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"}]
            }
        ]
    }),
    post({
        slug: "wildlife-photos-sitting-on-instagram",
        title: "What to Do With Years of Wildlife Photos Sitting on Instagram",
        description: "If your best herping, birding, and safari pictures only live in a feed, here is a structured way to keep them.",
        featuredAlt: "Years of wildlife Instagram posts waiting to become a searchable collection",
        readingMinutes: 6,
        tags: ["Instagram archive", "wildlife photos"],
        searchIntents: ["wildlife photos on Instagram", "backup Instagram wildlife photos", "import Instagram animal photos"],
        relatedSlugs: ["turn-instagram-wildlife-archive-into-species-collection", "organize-years-of-wildlife-photos-by-species", "wildlife-creators-need-a-species-archive"],
        sections: [
            {
                title: "Feeds are a poor archive",
                paragraphs: [
                    "Captions get edited. Posts get archived. URLs expire. A Dex stores original eligible media after you review it, which is a different kind of keeping."
                ]
            },
            {
                title: "Import, then keep shooting",
                paragraphs: [
                    "Bring eligible posts across, then keep using live capture for new work. The archive becomes a baseline, not a replacement for being in the field."
                ],
                inlineLinks: [{text: "Import Instagram wildlife photos", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}]
            }
        ]
    }),
    post({
        slug: "how-to-keep-a-herping-field-journal",
        title: "How to Keep a Herping Field Journal",
        description: "What to record after a snake, lizard, or frog find — and how to keep that journal searchable without disturbing wildlife.",
        featuredAlt: "A herping field journal with snake and amphibian records",
        readingMinutes: 8,
        tags: ["herping", "field journal", "reptiles"],
        searchIntents: ["herping field journal", "herping app", "snake spotting journal"],
        relatedSlugs: ["reptile-amphibian-life-list", "what-to-record-when-you-find-a-snake", "herping-photography-without-disturbing-wildlife"],
        sections: [
            {
                title: "Record the find, then leave the animal alone",
                paragraphs: [
                    "A useful herping journal stores identity, a historical place, setting, and the picture or clip. It does not require pinning, flipping, or crowding the animal.",
                    "If you cannot identify to species, keep the group. Honesty travels better than a confident wrong name."
                ]
            },
            {
                title: "Location is the place of the find",
                paragraphs: [
                    "Do not drop today's GPS on last year's road cruising photo. Confirm the historical place. Unknown is allowed as an answer; it does not unlock import."
                ],
                inlineLinks: [{text: "Herping field journal in AnimalDex", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"}]
            }
        ]
    }),
    post({
        slug: "reptile-amphibian-life-list",
        title: "How to Build a Reptile and Amphibian Life List",
        description: "Keep a herp life list that can include group-level identities, historical locations, and older Instagram finds.",
        featuredAlt: "Reptile and amphibian life list cards in a wildlife Dex",
        readingMinutes: 6,
        tags: ["life list", "herping", "amphibians"],
        searchIntents: ["reptile life list", "amphibian tracking app", "herp logging app"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "organize-snake-reptile-photos-by-species", "herping-photos-searchable-collection"],
        sections: [
            {
                title: "Lists fail when they demand false precision",
                paragraphs: [
                    "Many herps are identified more honestly as a group. A Dex that can hold that is more useful than a spreadsheet that forces a binomial."
                ]
            },
            {
                title: "Old trips still count after review",
                paragraphs: [
                    "Eligible Instagram posts can join the same list. Review is the cost of bringing a night herp from 2018 into 2026 without inventing coordinates."
                ],
                inlineLinks: [{text: "Start a herp Dex", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"}]
            }
        ]
    }),
    post({
        slug: "organize-snake-reptile-photos-by-species",
        title: "How to Organize Snake and Reptile Photos by Species",
        description: "Sort snake and reptile pictures by honest identity, not by the folder name of the trip.",
        featuredAlt: "Snake and reptile photographs organized by species identity",
        readingMinutes: 6,
        tags: ["snakes", "reptile photography", "organization"],
        searchIntents: ["organize snake photos", "reptile photo organizer", "snake photography app"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "herping-photos-searchable-collection", "reptile-amphibian-life-list"],
        sections: [
            {
                title: "Trip folders hide lookalikes",
                paragraphs: [
                    "Bali snakes and Florida snakes in one dump is how pit vipers and lookalikes get mixed. Index by identity first."
                ]
            },
            {
                title: "Import is review, not magic",
                paragraphs: [
                    "Instagram can supply the media. You still confirm the animal and the historical place. AnimalDex will not invent a species-level ID to make the grid prettier."
                ],
                inlineLinks: [
                    {text: "Herping field journal", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"},
                    {text: "Import wildlife posts", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}
                ]
            }
        ]
    }),
    post({
        slug: "what-to-record-when-you-find-a-snake",
        title: "What Should You Record When You Find a Snake in the Wild?",
        description: "A field checklist for snake finds that prioritizes safety, honest ID, and a location that is actually true.",
        featuredAlt: "Field notes beside a wild snake observation at a safe distance",
        readingMinutes: 7,
        tags: ["snakes", "field notes", "safety"],
        searchIntents: ["what to record when you find a snake", "snake identification journal", "snake spotting app"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "herping-photography-without-disturbing-wildlife", "reptile-amphibian-life-list"],
        sections: [
            {
                title: "Safety before the notebook",
                paragraphs: [
                    "Do not handle snakes because an app suggested a name. Photograph from a distance, leave an escape path, and treat unknown snakes as dangerous until a qualified person says otherwise.",
                    "AnimalDex is educational. It is not a safety authority."
                ]
            },
            {
                title: "Minimum useful record",
                paragraphs: [
                    "A still or short clip, an honest identity or group, a historical place, and whether the animal was wild. That is enough to keep the find in a Dex."
                ],
                inlineLinks: [{text: "Herping field journal", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"}]
            }
        ]
    }),
    post({
        slug: "herping-photography-without-disturbing-wildlife",
        title: "Herping Photography: How to Document Finds Without Disturbing Wildlife",
        description: "Practical technique for herp photos that still leave the animal unhandled and unbaited.",
        featuredAlt: "Herping photography at a respectful distance from a reptile",
        readingMinutes: 6,
        tags: ["herping photography", "ethics", "wildlife"],
        searchIntents: ["ethical herping photography", "herping without disturbing wildlife", "reptile photography app"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "what-to-record-when-you-find-a-snake", "herping-photos-searchable-collection"],
        sections: [
            {
                title: "The picture is not worth the stress",
                paragraphs: [
                    "No flipping rocks into a worse microhabitat. No pinning for a scale shot. No baiting. Get the record you can get from where you already stand, then move on."
                ]
            },
            {
                title: "A journal reduces repeat pressure",
                paragraphs: [
                    "If you already documented that stretch of road, you do not need to work the same animal again for a slightly cleaner frame. That is one reason a searchable Dex helps in the field."
                ],
                inlineLinks: [{text: "Herping field journal", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"}]
            }
        ]
    }),
    post({
        slug: "herping-photos-searchable-collection",
        title: "How to Turn Years of Herping Photos Into a Searchable Collection",
        description: "Bring night herps, road finds, and frog choruses out of Instagram and into a Dex you can actually query.",
        featuredAlt: "A searchable collection of herping photographs by species",
        readingMinutes: 8,
        tags: ["herping", "Instagram", "archive"],
        searchIntents: ["organize herping photos", "herping Instagram archive", "reptile photo collection"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "turn-instagram-wildlife-archive-into-species-collection", "organize-snake-reptile-photos-by-species"],
        sections: [
            {
                title: "The nights already happened",
                paragraphs: [
                    "You do not need to re-walk every site. Eligible Instagram posts can be reviewed into AnimalDex with original media, after species and historical location are confirmed.",
                    "That is slower than dumping a camera roll into albums. It is also the only way a 2017 road find stays honest about where the snake actually was."
                ],
                inlineLinks: [{text: "Import from Instagram", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}]
            },
            {
                title: "Search by animal, not by the name of the trip",
                paragraphs: [
                    "Folder names like Bali night or Florida roads hide lookalikes. Index by identity first, including group-level names when a species-level card would be a guess.",
                    "Then attach the historical place and setting. Wild, zoo, farm, and domestic records should not collapse into one tile."
                ]
            },
            {
                title: "Keep live nights and old archives in one Dex",
                paragraphs: [
                    "New finds still start with a live capture. Import fills the years you already photographed. Creator Rewards stay tied to qualifying live contribution, not imported posts."
                ],
                inlineLinks: [{text: "Herping field journal", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"}]
            }
        ]
    }),
    post({
        slug: "tools-for-tracking-herping-finds",
        title: "Tools for Tracking Herping Finds Without Pretending One App Does Everything",
        description: "A fair look at what a herping journal app should do, and where AnimalDex fits — without invented competitor claims.",
        featuredAlt: "Field tools and a phone used to track herping finds",
        readingMinutes: 7,
        tags: ["herping app", "tools", "field journal"],
        searchIntents: ["best herping app", "tools for tracking herping finds", "reptile tracking app"],
        relatedSlugs: ["how-to-keep-a-herping-field-journal", "reptile-amphibian-life-list", "herping-photos-searchable-collection"],
        sections: [
            {
                title: "Use the right tool for the job",
                paragraphs: [
                    "Maps, weather, and local regulations live outside any collection app. Community science platforms are built for research-grade sharing. Galleries are built for files.",
                    "AnimalDex is built for identification-assisted collecting: live scans, a Dex, and optional Instagram import after review. It is not a replacement for expert ID, permits, or safety practice."
                ]
            },
            {
                title: "What we will not claim",
                paragraphs: [
                    "We will not invent another app's features here. If you need research-grade community review, use a platform designed for that. If you need a species collection with import and live capture, AnimalDex is built for that lane."
                ],
                inlineLinks: [{text: "Herping field journal", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"}]
            }
        ]
    }),
    post({
        slug: "wildlife-creators-need-a-species-archive",
        title: "Why Wildlife Creators Need a Species Archive, Not Just a Social Feed",
        description: "A feed shows recent work. An archive shows what you have actually documented — and it survives algorithm weather.",
        featuredAlt: "Wildlife creator moving from a social feed to a species archive",
        readingMinutes: 6,
        tags: ["wildlife creator", "archive", "Instagram"],
        searchIntents: ["wildlife creator archive", "species archive not social feed", "wildlife photography body of work"],
        relatedSlugs: ["wildlife-photographers-public-species-portfolio", "turn-instagram-wildlife-archive-into-species-collection", "wildlife-creator-profile-around-species"],
        sections: [
            {
                title: "Algorithms are not librarians",
                paragraphs: [
                    "A species archive lets you answer which hornbills, which vipers, which coasts — without scrolling a year of stories. Instagram import is how an existing body of posts can enter that archive after review."
                ],
                inlineLinks: [
                    {text: "Wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"},
                    {text: "Import path", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}
                ]
            },
            {
                title: "Earnings stay honest",
                paragraphs: [
                    "A public collection is not automatically Creator Rewards. Imported posts do not count as live contribution. Guides and live captures remain separate paths."
                ]
            }
        ]
    }),
    post({
        slug: "wildlife-photography-searchable-body-of-work",
        title: "How to Turn Wildlife Photography Into a Searchable Body of Work",
        description: "Index encounters by species and place so a decade of pictures becomes a body of work, not a pile.",
        featuredAlt: "Searchable wildlife photography body of work organized by species",
        readingMinutes: 8,
        tags: ["wildlife photography", "body of work"],
        searchIntents: ["searchable wildlife photography archive", "organize wildlife body of work"],
        relatedSlugs: ["organize-years-of-wildlife-photos-by-species", "wildlife-photography-life-list", "preserve-context-behind-animal-encounters"],
        sections: [
            {
                title: "Search needs identity, not only keywords",
                paragraphs: [
                    "Filename search fails on IMG_8841. Species identity plus a confirmed historical location is what makes a body of work queryable.",
                    "A gallery can find Tuesday. A Dex can find every hornbill you have actually documented."
                ]
            },
            {
                title: "Keep captions out of the coordinate field",
                paragraphs: [
                    "Hashtags and caption place names are hints, not records. AnimalDex asks you to confirm the historical place of the photograph instead of guessing from text or today's GPS."
                ]
            },
            {
                title: "Import the archive, then keep shooting",
                paragraphs: [
                    "Eligible Instagram posts can enter the same index after review. New work still comes from live captures. Imported posts build the collection; they do not add qualifying live-capture wildlife signals for Creator Rewards."
                ],
                inlineLinks: [
                    {text: "Wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"},
                    {text: "Import Instagram wildlife photos", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}
                ]
            }
        ]
    }),
    post({
        slug: "wildlife-creator-profile-around-species",
        title: "Building a Wildlife Creator Profile Around Species, Not Follower Count",
        description: "A public AnimalDex profile can show documented animals. Followers are optional context, not the collection.",
        featuredAlt: "Wildlife creator profile built around documented species",
        readingMinutes: 7,
        tags: ["creator profile", "species"],
        searchIntents: ["wildlife creator profile", "species-based wildlife portfolio"],
        relatedSlugs: ["wildlife-photographers-public-species-portfolio", "wildlife-creators-need-a-species-archive", "wildlife-photography-life-list"],
        sections: [
            {
                title: "Show the animals, then the person",
                paragraphs: [
                    "A species-led profile is readable by other field people. It also makes Instagram import useful: old posts can fill the Dex that the profile displays, after review.",
                    "Follower count changes with the algorithm. A documented list of animals does not."
                ]
            },
            {
                title: "Public does not mean promotional fiction",
                paragraphs: [
                    "Imported posts may publish to Discover. That is why location, species, setting, and an accuracy confirmation sit in front of import.",
                    "A public species portfolio is still a wildlife record. Treat identifications the way you would in the field."
                ],
                inlineLinks: [
                    {text: "Wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"},
                    {text: "Import path", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}
                ]
            }
        ]
    }),
    post({
        slug: "preserve-context-behind-animal-encounters",
        title: "How Photographers Can Preserve the Context Behind Animal Encounters",
        description: "Keep setting, historical place, and honest identity with the picture so the encounter still makes sense in five years.",
        featuredAlt: "Wildlife encounter context preserved beside a photograph",
        readingMinutes: 7,
        tags: ["context", "wildlife encounters"],
        searchIntents: ["preserve wildlife photo context", "animal encounter journal"],
        relatedSlugs: ["wildlife-photography-searchable-body-of-work", "organize-years-of-wildlife-photos-by-species", "wildlife-photography-life-list"],
        sections: [
            {
                title: "A beautiful crop without context is a postcard",
                paragraphs: [
                    "Wild versus zoo, the actual place, and whether several animals were in shot are the difference between a postcard and a record. Import asks for those confirmations on purpose."
                ]
            },
            {
                title: "Do not let the phone invent the place",
                paragraphs: [
                    "Current GPS is where you are now. Caption text is what you typed then. Neither is automatically the capture location of a historical photograph.",
                    "If you do not know, say you do not know. AnimalDex can record unknown; it will not treat that as enough to import."
                ]
            },
            {
                title: "Identity can stay at group level",
                paragraphs: [
                    "Some animals are indexed as a group on purpose. Forcing a species-level name to look more professional makes the archive worse, not better."
                ],
                inlineLinks: [{text: "Wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"}]
            }
        ]
    }),
    post({
        slug: "how-to-keep-track-of-animals-you-have-seen",
        title: "How to Keep Track of Every Animal You’ve Seen",
        description: "A practical wildlife life list for people who have already encountered animals — and never kept a record.",
        featuredAlt: "A wildlife life list of animals someone has already encountered",
        readingMinutes: 7,
        tags: ["wildlife life list", "animal collection", "Instagram import"],
        searchIntents: ["keep track of animals I have seen", "app to track animals I have seen", "animal life list app", "wildlife life list"],
        relatedSlugs: ["how-many-animals-have-you-already-encountered", "already-seen-hundreds-of-animals-start-collection", "wildlife-photography-life-list"],
        sections: [
            {
                title: "You’ve already seen lots of animals. You just never tracked them.",
                paragraphs: [
                    "Most people do not need a new camera. They need a place that answers which animals they have already encountered — the zoo day, the holiday snake, the birds on a morning walk.",
                    "A Dex is that record: unique AnimalDex entries for species and supported animal groups, with a historical place you confirm. It is not a guessed count from a feed."
                ]
            },
            {
                title: "New encounters and past encounters",
                paragraphs: [
                    "New encounters belong to live capture in AnimalDex. Past encounters can come from eligible Instagram wildlife posts after you review identity and location.",
                    "Wildlife memories often pre-date the app you eventually choose to track them in. Install day does not have to be day one."
                ],
                inlineLinks: [
                    {text: "Wildlife collection in AnimalDex", slug: "wildlife-collection-animal-card-app", href: "/use-cases/wildlife-collection-animal-card-app"},
                    {text: "Import Instagram wildlife photos", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}
                ]
            },
            {
                title: "What not to expect from a life list",
                paragraphs: [
                    "Not every photo resolves to a species. Some animals stay at group level when that is the honest catalog result. Imported posts build the collection; they do not add qualifying live-capture wildlife signals for Creator Rewards."
                ]
            }
        ]
    }),
    post({
        slug: "how-many-animals-have-you-already-encountered",
        title: "How Many Animals Have You Already Encountered?",
        description: "Your old wildlife photos might hold a clearer record of the different animals you have seen — after you review them, not before.",
        featuredAlt: "Scattered wildlife memories becoming a structured record of animals encountered",
        readingMinutes: 6,
        tags: ["animals I have seen", "wildlife collection", "life list"],
        searchIntents: ["how many animal species have I seen", "animals I have seen", "animals I’ve encountered", "wildlife life list"],
        relatedSlugs: ["how-to-keep-track-of-animals-you-have-seen", "already-seen-hundreds-of-animals-start-collection", "turn-instagram-wildlife-archive-into-species-collection"],
        sections: [
            {
                title: "The question is older than the app",
                paragraphs: [
                    "How many different animals have I encountered? Which have I already found? How much of the animal world have I already seen? Those questions usually arrive years after the photos.",
                    "A feed will not answer them. A reviewed collection can — as unique AnimalDex entries, including group-level identities when a species-level name would be a guess."
                ]
            },
            {
                title: "Do not count before you review",
                paragraphs: [
                    "AnimalDex will not invent a species total from unreviewed Instagram posts. Connect, find animal posts, confirm identity and a historical place, then import. The Dex becomes clearer after that work.",
                    "Current GPS is not the location of a holiday photograph. Captions are not coordinates."
                ],
                inlineLinks: [{text: "Import your wildlife archive", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}]
            }
        ]
    }),
    post({
        slug: "already-seen-hundreds-of-animals-start-collection",
        title: "Already Seen Hundreds of Animals? You Don’t Have to Start Over",
        description: "A wildlife collection does not have to begin on install day. Eligible past encounters can join after review.",
        featuredAlt: "A wildlife collection that starts with history instead of a blank Dex",
        readingMinutes: 6,
        tags: ["wildlife collection", "past trips", "Instagram import"],
        searchIntents: ["track animals from past trips", "turn old wildlife photos into a species list", "wildlife collection app", "old wildlife photos"],
        relatedSlugs: ["how-to-keep-track-of-animals-you-have-seen", "wildlife-photos-sitting-on-instagram", "how-many-animals-have-you-already-encountered"],
        sections: [
            {
                title: "Most collections start today. Yours doesn’t have to.",
                paragraphs: [
                    "A new wildlife app usually means a blank list. That is a poor deal if you have already been to zoos, coasts, and trails with a phone in your pocket.",
                    "AnimalDex is designed so eligible wildlife encounters from an existing Instagram archive can become part of your collection after review. Then keep going in the field with live capture."
                ],
                inlineLinks: [
                    {text: "Import Instagram wildlife photos", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"},
                    {text: "Wildlife collection app", slug: "wildlife-collection-animal-card-app", href: "/use-cases/wildlife-collection-animal-card-app"}
                ]
            },
            {
                title: "History and tomorrow are different paths",
                paragraphs: [
                    "Past encounters: review location, identity, and setting, then import original eligible media. New encounters: capture them live. Imports do not become qualifying live Creator Rewards contribution."
                ]
            }
        ]
    })
];

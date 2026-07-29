import {legendaryEarthBeastEntries} from "@/data/legendary-earth-beasts";
import type {BlogPost, BlogSectionCard} from "@/data/blog/types";

const imageBase = "/images/blog/petrified-giants";

const legendaryCards: BlogSectionCard[] = legendaryEarthBeastEntries.map((beast) => ({
    label: `${beast.legendaryFormName} · ${beast.legendaryType}`,
    body: `${beast.captureSite}. The landform is paired with the real ${beast.displayName} (${beast.scientificName}) as an AnimalDex S-tier field-guide anchor.`,
    links: [
        {
            text: beast.legendaryFormName,
            slug: beast.slug
        },
        {
            text: beast.displayName,
            slug: beast.slug
        }
    ]
}));

export const petrifiedGiantsPost: BlogPost = {
    slug: "petrified-giants-animals-stone",
    canonicalUrl: "https://animaldex.app/blog/petrified-giants-animals-stone",
    title: "Petrified Giants: 20 Animal-Shaped Rocks, Legends & Real Geology",
    description: "A world field guide to petrified animals and so-called petrified giants—where to find 20 animal-shaped rock formations, the myths attached to them, and what geology actually says.",
    publishedAt: "2026-07-29",
    updatedAt: "2026-07-29",
    featuredImage: {
        src: `${imageBase}/petrified-giants-hero.png`,
        alt: "Cinematic natural rock formations resembling a giant reptile, shark fin and elephant at sunrise",
        width: 1672,
        height: 941,
        caption: "Animal-shaped landscapes can feel uncannily alive, but resemblance is not the same as fossil evidence."
    },
    readingMinutes: 18,
    author: "AnimalDex Field Guide",
    tags: [
        "Petrified Giants",
        "Petrified Animals",
        "Animal-Shaped Rocks",
        "Legendary Earth Beasts",
        "Geology",
        "Mythology"
    ],
    searchIntents: [
        "petrified giants",
        "petrified animals",
        "giant petrified animals",
        "animals turned to stone",
        "animal shaped rock formations",
        "rocks that look like animals",
        "petrified giant snake",
        "petrified elephant rock",
        "petrified dragon",
        "shark fin cove rock",
        "legendary animals in stone",
        "are petrified giants real"
    ],
    speciesSlugs: legendaryEarthBeastEntries.map((beast) => beast.slug),
    tableOfContents: [
        "Quick Answer: Are Petrified Giants Real?",
        "Petrified Animal or Animal-Shaped Rock?",
        "Why We See Giants in Stone",
        "The 20 S-Tier Legendary Earth Beasts",
        "Serpents, Dragons and Scale-Like Stone",
        "Ocean Giants and Coastal Sentinels",
        "Elephants, Rhinos and Desert Beasts",
        "Sacred Guardians and Mythic Places",
        "How to Visit Responsibly",
        "How to Evaluate a Petrified Giant Claim",
        "Final Verdict"
    ],
    sections: [
        {
            kicker: "Evidence first",
            title: "Quick Answer: Are Petrified Giants Real?",
            paragraphs: [
                "There is no accepted scientific evidence that mountain-sized animals or mythic giants were turned into the enormous rock formations shared online as “petrified giants.” Those formations are real and often spectacular, but their animal resemblance is normally explained by ordinary geology—erosion, weathering, fractures, uplift, volcanic activity and differences in how hard and soft rock wear away.",
                "Real petrified animals do exist as fossils. Fossilisation can preserve bone, shell and occasionally fine anatomical detail when minerals fill spaces or replace original material. A fossil is supported by anatomy, geological context and expert study; a cliff that resembles a sleeping dragon from one viewpoint is not, by resemblance alone, a fossil.",
                "That does not make animal-shaped rocks less meaningful. Around the world, communities have connected striking landforms with bears, serpents, lions, tigers, trolls and guardians. This guide treats those stories with respect while keeping folklore, AnimalDex world-building and geological evidence clearly labelled."
            ],
            pullQuote: "The rocks are real. The resemblance is real. The claim that they are giant fossilised bodies is not supported by current evidence."
        },
        {
            title: "Petrified Animal or Animal-Shaped Rock?",
            paragraphs: [],
            table: {
                columns: ["What you are looking at", "What it means", "What would support it"],
                rows: [
                    {
                        cells: [
                            "A genuine fossil",
                            "Preserved remains or traces of past life, sometimes mineralised or replaced by stone.",
                            "Diagnostic anatomy, consistent scale, geological context, laboratory or museum study and peer-reviewed description."
                        ]
                    },
                    {
                        cells: [
                            "An animal-shaped landform",
                            "A natural outcrop, arch, sea stack, ridge or cave whose outline resembles an animal.",
                            "Mapped rock units and known processes such as erosion, jointing, uplift, volcanism, wind, rain or waves."
                        ]
                    },
                    {
                        cells: [
                            "A sacred or legendary place",
                            "A landscape understood through living tradition, oral history, religion or local folklore.",
                            "Community knowledge and cultural sources—not a claim that the story must be literal geology."
                        ]
                    },
                    {
                        cells: [
                            "An AnimalDex Legendary Earth Beast",
                            "A creative S-tier animal guide that links a real place to a real species and a clearly labelled legendary form.",
                            "A real capture location, species anchor, respectful travel guidance and transparent myth-versus-geology framing."
                        ]
                    }
                ]
            }
        },
        {
            title: "Why We See Giants in Stone",
            paragraphs: [
                "Humans are exceptionally good at finding familiar forms in ambiguous scenes. Seeing an animal in a cloud, face in a cliff or creature in a rock is called pareidolia. NASA uses the same term for Martian hills and rocks that appear bear-like, snake-like or face-like even though their shapes have geological causes.",
                "Animal-shaped rocks are also helped by differential erosion. Wind, water, waves, freeze-thaw cycles and gravity attack weaknesses in rock. Harder layers may remain while softer material disappears, leaving an arch that reads as legs, a ridge that reads as a spine or a sea stack that reads as a fin.",
                "The effect changes with viewpoint, weather and light. A formation can look unmistakably like an elephant at sunset and like ordinary sandstone from behind. That tension—between what the land is and what the mind sees—is exactly why these places generate stories."
            ],
            media: {
                type: "image",
                image: {
                    src: `${imageBase}/petrified-giants-world-atlas.png`,
                    alt: "Illustrated world atlas surrounded by natural rock formations resembling animals",
                    width: 1536,
                    height: 1024,
                    caption: "Animal-like silhouettes recur across deserts, coasts, forests and volcanic landscapes."
                }
            }
        },
        {
            kicker: "Complete AnimalDex field guide",
            title: "The 20 S-Tier Legendary Earth Beasts",
            paragraphs: [
                "AnimalDex currently recognises 20 S-tier Legendary Earth Beasts. Each is tied to a real location or landform family and anchored to a real animal species. “Legendary” describes the collection tier and story layer—not a scientific claim that the rock was once that animal."
            ],
            cards: legendaryCards
        },
        {
            title: "Serpents, Dragons and Scale-Like Stone",
            paragraphs: [
                "Naka Cave in Bueng Kan, Thailand, is the collection’s strongest “petrified serpent” candidate. Its rounded rock pattern resembles overlapping scales, while regional Naga traditions give the resemblance a deeper cultural frame. Thailand’s government tourism portal describes the site as a legendary Naga realm and notes the scale-like pattern. In AnimalDex it becomes Naga Snake, anchored to the King Cobra.",
                "Jeju Dragon Head at Yongduam Rock layers coastal volcanic erosion with a story of a dragon struck down while seeking a sacred stone. Sinai Dragon uses a dragon-head silhouette in South Sinai, while Dragon’s Back Ridge Serpent in Hong Kong draws its identity from the winding ridge. Stone Dragon is the broader Geo-Legendary template for formations that look reptilian but have no well-documented local dragon tradition.",
                "The important distinction is source quality. A named local tradition belongs in the mythology section; a formation that merely looks dragon-like belongs in visual interpretation. Both can be fascinating without being presented as fossil proof."
            ],
            speciesSlugs: [
                "naga-snake",
                "jeju-dragon-head",
                "sinai-dragon",
                "dragons-back-ridge-serpent",
                "stone-dragon"
            ]
        },
        {
            title: "Ocean Giants and Coastal Sentinels",
            paragraphs: [
                "Stone Shark Fin is found at Shark Fin Cove near Davenport, California, where the offshore sea stack has a dorsal-fin silhouette. Waves and coastal erosion explain the rock; the Great White Shark gives AnimalDex its biological anchor. The route to the beach is steep and can be hazardous, so the overlook and current local access guidance matter more than recreating a risky photograph.",
                "Stone Whale Pod comes from Hin Sam Wan, or Three Whale Rock, in Thailand: three long sandstone masses that appear to swim through the forest canopy. Sleeping Sea Lion belongs to Kicker Rock, also called León Dormido, in the Galápagos. Coastal Seal Stone covers seal-like rocks including the wave-worked animal formations of Jialeshui in Taiwan.",
                "These are ideal examples of silhouette doing the storytelling. A fin, arched back or resting profile needs only a few geological lines before the brain completes the animal."
            ],
            speciesSlugs: [
                "stone-shark-fin",
                "stone-whale-pod",
                "sleeping-sea-lion",
                "coastal-seal-stone"
            ]
        },
        {
            title: "Elephants, Rhinos and Desert Beasts",
            paragraphs: [
                "Jabal AlFil—Elephant Rock—in AlUla, Saudi Arabia rises 52 metres from the sand. Its body-and-trunk arch was carved from sandstone by weather over immense time. It becomes AlUla Sand Elephant, anchored to the African Bush Elephant.",
                "Sardinia’s Fairy-Tomb Elephant adds archaeology to the silhouette: Roccia dell’Elefante contains ancient rock-cut tombs known as domus de janas, often translated as fairy houses. Hvítserkur in Iceland is variously read as a rhino, elephant, dragon or drinking beast and carries a famous troll-turned-to-stone story; AnimalDex calls it Troll Rhino Beast.",
                "Steppe Turtle in Mongolia, Desert Camel Sentinel in Cappadocia and New Mexico, and Rain Frog Stone near Mudgee show how simple body plans become durable visual symbols: a domed shell, two humps or the compact crouch of a frog."
            ],
            speciesSlugs: [
                "alula-sand-elephant",
                "fairy-tomb-elephant",
                "troll-rhino-beast",
                "steppe-turtle",
                "desert-camel-sentinel",
                "rain-frog-stone"
            ]
        },
        {
            title: "Sacred Guardians and Mythic Places",
            paragraphs: [
                "Some formations matter for more than resemblance. Bear Lodge, widely known as Devils Tower, is sacred to many Northern Plains tribes. The National Park Service records multiple distinct oral traditions involving bears and explains that many Indigenous names for the formation reference a bear. AnimalDex’s Great Bear Claw Guardian should be read through that living cultural significance, not reduced to internet “giant claw marks.”",
                "The Den of Nargun in Victoria is a culturally important Gunaikurnai place. The Nargun is described in tradition as a fierce stone being. Visitors should stay out of the cave and follow Parks Victoria and Traditional Owner guidance. Royal Lion Rock at Sigiriya connects an ancient fortress identity with the lion, while Sky Tigress at Bhutan’s Tiger’s Nest centres the tradition of Guru Rinpoche arriving on a tigress.",
                "Monkey Pillar at Saruiwa on Iki Island is linked with a divine island-anchor legend. These places demonstrate why myth should not be treated as failed science: it can carry identity, ethics, memory and relationship to Country in a completely different register."
            ],
            speciesSlugs: [
                "great-bear-claw-guardian",
                "nargun-stone-beast",
                "royal-lion-rock",
                "sky-tigress",
                "monkey-pillar"
            ]
        },
        {
            title: "How to Visit Responsibly",
            cards: [
                {
                    label: "Check the official source",
                    body: "Opening hours, permits, closures, tide conditions and trail access can change. Use the park or destination authority before travelling."
                },
                {
                    label: "Keep sacred stories in context",
                    body: "Name the community connected to a tradition, avoid blending distinct stories together and follow requests about restricted places, photography and access."
                },
                {
                    label: "Use safe viewpoints",
                    body: "Do not climb unstable arches, sea stacks or cliff edges for a forced-perspective image. Respect barriers and stay clear of waves and rockfall zones."
                },
                {
                    label: "Leave the geology where it is",
                    body: "Do not chip, collect, carve or move rock, fossils or cultural material. Take photographs and field notes instead."
                }
            ],
            paragraphs: []
        },
        {
            title: "How to Evaluate a Petrified Giant Claim",
            paragraphs: [
                "Start by reverse-searching the image and identifying the location. Viral compilations often mix several formations, rotate photographs or remove the scale and horizon. Then look for an official geological description from a park, survey, museum or university.",
                "Ask whether the proposed anatomy continues through the rock in a biologically coherent way. A fossil claim needs more than an outline: it should show diagnostic structures, consistent proportions and an appropriate geological setting. Search for published fossil work rather than relying on visual annotations drawn over a photograph.",
                "Finally, separate three questions: What is the rock? What does it resemble? What stories do people tell about it? A strong answer can honour all three without forcing them into one literal explanation."
            ],
            pullQuote: "Location first, geology second, cultural context third—and resemblance last."
        },
        {
            title: "Final Verdict",
            paragraphs: [
                "Petrified giants are compelling as a search idea, visual tradition and doorway into mythology, but they are not an established class of giant fossil animals. Real petrification happens at biological scales and leaves evidence that can be examined. Animal-shaped mountains and sea stacks are usually landforms interpreted through pareidolia and story.",
                "The better discovery is not that geology has hidden a dead menagerie in plain sight. It is that wind, water, heat, ice and time can create forms vivid enough to become guardians, monsters and animals in human memory. AnimalDex’s S-tier Legendary Earth Beasts turn that intersection into a global field guide—grounded in real species, real places and clearly labelled wonder."
            ]
        }
    ],
    faq: [
        {
            question: "Are petrified giants real?",
            answer: "There is no accepted scientific evidence that mountain-sized people or animals became the giant rock formations circulated online. Genuine petrified fossils exist, but they are identified through anatomy, geological context and scientific study—not silhouette alone."
        },
        {
            question: "Can an entire animal turn to stone?",
            answer: "Parts of organisms can fossilise through mineralisation, replacement, moulds or casts under rare conditions. Fossilisation does not preserve a giant animal as an unchanged, mountain-sized exterior body."
        },
        {
            question: "Why do rocks look so much like animals?",
            answer: "Erosion and weathering create arches, ridges and isolated stacks, while pareidolia makes the brain recognise familiar animals in those ambiguous shapes."
        },
        {
            question: "Is Naka Cave a petrified giant snake?",
            answer: "Naka Cave has striking scale-like rock patterns and strong Naga associations, but official descriptions identify it as a natural rock formation. No accepted evidence shows that it is the fossilised body of a giant snake."
        },
        {
            question: "Where is Shark Fin Cove?",
            answer: "Shark Fin Cove is near Davenport on California’s central coast. Its offshore sea stack resembles a shark’s dorsal fin. Access terrain can be steep, so visitors should check current local guidance and use safe viewpoints."
        },
        {
            question: "What are AnimalDex Legendary Earth Beasts?",
            answer: "They are S-tier field-guide entries that pair dramatic animal-linked places with real species. The legendary form is a creative and cultural layer, not a claim that the landform is a literal fossil."
        }
    ],
    sources: [
        {
            label: "U.S. Geological Survey — Modes of fossil preservation",
            href: "https://www.usgs.gov/publications/modes-fossil-preservation"
        },
        {
            label: "U.S. Geological Survey — Find-A-Feature: Fossil",
            href: "https://www.usgs.gov/educational-resources/find-a-feature-fossil"
        },
        {
            label: "Natural History Museum — How fossils are formed",
            href: "https://www.nhm.ac.uk/discover/how-are-fossils-formed.html"
        },
        {
            label: "NASA Science — Pareidolia in animal-like rocks",
            href: "https://science.nasa.gov/blog/celebrating-halloween-and-investigating-ghoulish-rocks-from-the-red-planet/"
        },
        {
            label: "National Park Service — Devils Tower or Bear Lodge?",
            href: "https://www.nps.gov/articles/devilstower.htm"
        },
        {
            label: "National Park Service — How Devils Tower formed",
            href: "https://www.nps.gov/deto/learn/nature/tower-formation.htm"
        },
        {
            label: "Thailand Government — Naka Cave, legendary Naga realm",
            href: "https://thailand.go.th/visit-thailand-detail/explore-naka-cave---the-legendary-naga-realm-of-bueng-kan-the-path-to-faith"
        },
        {
            label: "Experience AlUla — Elephant Rock",
            href: "https://www.experiencealula.com/en/places-to-go/elephant-rock"
        },
        {
            label: "Parks Victoria — Den of Nargun",
            href: "https://www.parks.vic.gov.au/places-to-see/sites/den-of-nargun"
        },
        {
            label: "Parks Victoria — Aboriginal culture in parks",
            href: "https://www.parks.vic.gov.au/managing-country-together/aboriginal-cultural-heritage/experience-aboriginal-culture-in-parks"
        }
    ]
};

import type {BlogPost} from "@/data/blog/types";

const imageBase = "/images/blog/how-animaldex-indexes-animals";

export const howAnimalDexIndexesAnimalsPost: BlogPost = {
    slug: "how-animaldex-indexes-animals",
    canonicalUrl: "https://animaldex.app/blog/how-animaldex-indexes-animals",
    title: "How AnimalDex Indexes Animals & Numbers",
    description:
        "Learn how AnimalDex indexes animals into species cards, lookalike groups, and base domestics—so AnimalDex numbers stay fair and collectible.",
    publishedAt: "2026-08-08",
    updatedAt: "2026-08-08",
    featuredImage: {
        src: `${imageBase}/how-animaldex-indexes-animals-hero.png`,
        alt: "Three AnimalDex field cards showing a species snail, a tree frog lookalike group, and a domestic dog base index",
        width: 1536,
        height: 1024,
        caption: "AnimalDex numbers map to resolved catalog cards: species, lookalike groups, or domestic base animals."
    },
    headerHtml: `<style data-section-styles>
.indexing-hero {
  position: relative;
  overflow: hidden;
  border-radius: 2rem;
  border: 1px solid rgba(130, 239, 168, 0.18);
  background:
    radial-gradient(ellipse 80% 70% at 12% 0%, rgba(56, 189, 120, 0.22), transparent 55%),
    radial-gradient(ellipse 60% 50% at 100% 20%, rgba(34, 120, 90, 0.28), transparent 50%),
    linear-gradient(160deg, #0b1510 0%, #102018 48%, #0a120e 100%);
  padding: 2rem 1.5rem 1.75rem;
}
@media (min-width: 768px) {
  .indexing-hero { padding: 2.75rem 2.5rem 2.25rem; }
}
.indexing-hero__glow {
  pointer-events: none;
  position: absolute;
  inset: auto -10% -40% auto;
  width: 18rem;
  height: 18rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(130, 239, 168, 0.16), transparent 70%);
  filter: blur(8px);
}
.indexing-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-radius: 9999px;
  border: 1px solid rgba(130, 239, 168, 0.28);
  background: rgba(16, 40, 28, 0.65);
  padding: 0.35rem 0.85rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #b7f5cb;
}
.indexing-hero__title {
  max-width: 18ch;
  margin: 0;
  font-family: var(--font-display), ui-serif, Georgia, serif;
  font-size: clamp(2.4rem, 6vw, 4.1rem);
  line-height: 0.98;
  letter-spacing: -0.03em;
  color: #f4fff5;
}
.indexing-hero__lead {
  max-width: 42rem;
  margin: 1.1rem 0 0;
  font-size: clamp(1.05rem, 2.2vw, 1.35rem);
  line-height: 1.55;
  color: rgba(220, 240, 228, 0.88);
}
.indexing-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1.1rem;
  margin-top: 1.35rem;
  font-size: 0.92rem;
  color: rgba(180, 210, 194, 0.8);
}
.indexing-hero__chips {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin-top: 1.75rem;
}
@media (min-width: 768px) {
  .indexing-hero__chips { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.indexing-hero__chip {
  border-radius: 1.15rem;
  border: 1px solid rgba(130, 239, 168, 0.16);
  background: rgba(8, 18, 13, 0.55);
  padding: 0.95rem 1rem;
}
.indexing-hero__chip strong {
  display: block;
  margin-bottom: 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #82efa8;
}
.indexing-hero__chip span {
  display: block;
  font-size: 0.98rem;
  line-height: 1.4;
  color: rgba(232, 245, 236, 0.92);
}
.indexing-hero__back {
  display: inline-flex;
  margin-bottom: 1rem;
  color: #82efa8;
  text-decoration: none;
  font-weight: 600;
}
.indexing-hero__back:hover { color: #b7f5cb; }
</style>
<header class="indexing-hero">
  <div class="indexing-hero__glow" aria-hidden="true"></div>
  <a class="indexing-hero__back" href="/blog">← Back to blog</a>
  <p class="indexing-hero__eyebrow">Field guide · Catalog rules</p>
  <h1 class="indexing-hero__title">How AnimalDex Indexes Animals &amp; Numbers</h1>
  <p class="indexing-hero__lead">AnimalDex indexes animals at species by default, folds breeds and morphs into base cards, and uses lookalike groups only for massive hard-to-separate families.</p>
  <div class="indexing-hero__meta">
    <span>Published 8 August 2026</span>
    <span>9 min read</span>
    <span>AnimalDex Field Guide</span>
  </div>
  <div class="indexing-hero__chips" aria-label="Indexing rules at a glance">
    <div class="indexing-hero__chip"><strong>Default</strong><span>Named wild species get their own AnimalDex number.</span></div>
    <div class="indexing-hero__chip"><strong>Groups</strong><span>Huge lookalike families can share one group card.</span></div>
    <div class="indexing-hero__chip"><strong>Domestics</strong><span>Breeds and morphs fold to a base species card.</span></div>
  </div>
</header>`,
    readingMinutes: 9,
    author: "AnimalDex Field Guide",
    tags: [
        "AnimalDex Numbers",
        "Animal Indexing",
        "Species Catalog",
        "Lookalike Groups",
        "Field Guide",
        "Animal Collection",
        "AnimalDex"
    ],
    searchIntents: [
        "how animaldex indexes animals",
        "animaldex number meaning",
        "what is an animaldex number",
        "animaldex species vs group",
        "why my animal shares a number",
        "animaldex lookalike group",
        "does animaldex index dog breeds",
        "garden snail animaldex number",
        "giant african land snail animaldex",
        "animaldex tree frog group",
        "animaldex goldfish morph",
        "animaldex catalog rules"
    ],
    speciesSlugs: ["red-eyed-tree-frog", "australian-green-tree-frog"],
    tableOfContents: [
        "Quick answer",
        "Definition: AnimalDex number",
        "The three indexing rules",
        "How AnimalDex chooses a card",
        "Lookalike groups explained",
        "Breeds and morphs",
        "Common exceptions people ask about",
        "Worked examples",
        "What you see after a scan",
        "Key takeaways"
    ],
    sections: [
        {
            kicker: "Answer first",
            title: "Quick answer",
            paragraphs: [
                "How AnimalDex indexes animals: give distinct wild species their own AnimalDex number by default; share a group card only for allowlisted massive lookalike families; fold domestic breeds and color morphs into a base species. The collectible card always shows the resolved catalog identity — number, display name, and species-or-group kind — not every nickname mentioned during analysis."
            ],
            pullQuote: "Species by default. Groups only for huge lookalike families. Breeds and morphs fold to the base animal."
        },
        {
            title: "Definition: AnimalDex number",
            paragraphs: [
                "An AnimalDex number is the official collectible index for one canonical catalog card in the AnimalDex field guide.",
                "It answers: which stable animal identity did this capture resolve to? Not every AI label becomes a new number. Analysis may mention a breed, morph, or common name, while the indexed card stays on the catalog identity AnimalDex resolved behind the scenes.",
                "If a profile has no AnimalDex number, it is not an indexed collection card yet."
            ],
            inlineLinks: [
                {text: "Browse the AnimalDex catalog", slug: "animals", href: "/animals"},
                {text: "Help Center: AnimalDex numbers", slug: "support-animaldex-numbers", href: "/support#animaldex-numbers"}
            ]
        },
        {
            title: "The three indexing rules",
            paragraphs: [],
            cards: [
                {
                    label: "1 · Species by default",
                    body: "If a user can reasonably treat a sighting as a named wild species, AnimalDex prefers a dedicated species card and AnimalDex number."
                },
                {
                    label: "2 · Groups for massive lookalikes",
                    body: "When everyday photos cannot pin species without specialist traits — often insects, plus product buckets like Tree Frog, Tilapia, and ordinary snails — many identities share one group card."
                },
                {
                    label: "3 · No morph or breed indexes",
                    body: "Domestic breeds and color morphs fold to a base species. German Shepherd → Domestic Dog. Lutino Cockatiel → Cockatiel. Fantail Goldfish → Goldfish."
                },
                {
                    label: "Bonus · Named insects stay species",
                    body: "Broad labels like “grasshopper” may hit Grasshopper & Locust. A named Desert Locust stays its own species line."
                }
            ]
        },
        {
            title: "How AnimalDex chooses a card",
            paragraphs: [
                "After a scan, AnimalDex identifies what it can from the photo, then resolves aliases and common names to one canonical catalog profile.",
                "In plain language, the decision order is:"
            ],
            cards: [
                {
                    label: "Step A",
                    body: "Missing or unusable identity → no new AnimalDex number."
                },
                {
                    label: "Step B",
                    body: "Breed / morph / domestic fold → base species card (or no mint if it is an unknown morph label)."
                },
                {
                    label: "Step C",
                    body: "Specific wild identity not in a lookalike-group list → distinct species card."
                },
                {
                    label: "Step D",
                    body: "Identity matches an allowlisted lookalike group → shared group card."
                }
            ]
        },
        {
            title: "Lookalike groups explained",
            paragraphs: [
                "A group card is a real collectible AnimalDex entry. It is simply shared across a lookalike family instead of minting dozens of near-identical parallel numbers.",
                "Insect groups usually catch broad keys only — “ant,” “mosquito,” “true fly,” “grasshopper.” Named species that are not folded stay species.",
                "Tree Frog, Tilapia, and ordinary Snail work differently: the product folds many named lookalike common names together because phone photos rarely separate them reliably."
            ],
            table: {
                columns: ["Group card", "What it catches", "Usually stays separate"],
                rows: [
                    {
                        cells: [
                            "Tree Frog",
                            "Many named canopy lookalikes",
                            "Australian Green Tree Frog (species exception)"
                        ]
                    },
                    {
                        cells: [
                            "Snail",
                            "Ordinary garden / pond lookalikes",
                            "Giant African Land Snail; distinctive snails such as Apple Snail"
                        ]
                    },
                    {
                        cells: [
                            "Grasshopper & Locust",
                            "Broad grasshopper / locust labels",
                            "Named species such as Desert Locust"
                        ]
                    },
                    {
                        cells: [
                            "Tilapia",
                            "Common aquaculture lookalike forms",
                            "Non-tilapia cichlids"
                        ]
                    },
                    {
                        cells: [
                            "True Fly / Mosquito / Ant",
                            "Broad insect family labels",
                            "Distinct named species keyed specifically elsewhere"
                        ]
                    }
                ]
            }
        },
        {
            title: "Breeds and morphs",
            paragraphs: [
                "AnimalDex does not mint parallel indexes for domestic breeds or hobby color morphs. That keeps the catalog focused on animals as species (or allowlisted groups), not fashion lines.",
                "Dog breeds resolve to Domestic Dog. Cat breeds resolve to Domestic Cat. Horse breeds resolve to Domestic Horse. Cockatiel colorways resolve to Cockatiel. Fancy goldfish forms resolve to Goldfish.",
                "Your analysis text can still say “German Shepherd” or “White-faced Cockatiel.” The indexed card — the number you collect — is the base species."
            ]
        },
        {
            title: "Common exceptions people ask about",
            paragraphs: [
                "These are the cases that surprise collectors most often."
            ],
            table: {
                columns: ["Sighting", "Correct indexed card", "Why"],
                rows: [
                    {
                        cells: [
                            "Ordinary garden / pond snail",
                            "Snail (group)",
                            "Lookalike bucket for everyday photos"
                        ]
                    },
                    {
                        cells: [
                            "Giant African Land Snail",
                            "Giant African Land Snail (species)",
                            "Visually massive, highly distinct exception"
                        ]
                    },
                    {
                        cells: [
                            "Ordinary tree frog lookalike",
                            "Tree Frog (group)",
                            "Hundreds of near-identical canopy forms"
                        ]
                    },
                    {
                        cells: [
                            "Australian Green Tree Frog",
                            "Australian Green Tree Frog (species)",
                            "Legendary Earth Beast species exception"
                        ]
                    },
                    {
                        cells: [
                            "Broad “grasshopper”",
                            "Grasshopper & Locust (group)",
                            "Family bucket for broad labels"
                        ]
                    },
                    {
                        cells: [
                            "Desert Locust",
                            "Desert Locust (species)",
                            "Named insects stay species"
                        ]
                    },
                    {
                        cells: [
                            "Goldfish / Cockatiel morphs",
                            "Goldfish / Cockatiel (species)",
                            "Morphs fold; not separate group cards"
                        ]
                    }
                ]
            },
            inlineLinks: [
                {
                    text: "Australian Green Tree Frog",
                    slug: "australian-green-tree-frog",
                    href: "/animals/australian-green-tree-frog",
                    kind: "species"
                },
                {
                    text: "Red-eyed Tree Frog",
                    slug: "red-eyed-tree-frog",
                    href: "/animals/red-eyed-tree-frog",
                    kind: "species"
                }
            ]
        },
        {
            title: "Worked examples",
            paragraphs: [
                "Use this as a mental model for the card you should expect after a confident resolution."
            ],
            table: {
                columns: ["User / AI label", "Canonical card", "Kind"],
                rows: [
                    {cells: ["Garden Snail / Escargot", "Snail", "Group"]},
                    {cells: ["GALS / Lissachatina fulica", "Giant African Land Snail", "Species"]},
                    {cells: ["Red-eyed Tree Frog", "Tree Frog", "Group"]},
                    {cells: ["Australian Green Tree Frog", "Australian Green Tree Frog", "Species"]},
                    {cells: ["Nile Tilapia", "Tilapia", "Group"]},
                    {cells: ["Fantail Goldfish", "Goldfish", "Species"]},
                    {cells: ["White-faced Cockatiel", "Cockatiel", "Species"]},
                    {cells: ["German Shepherd", "Domestic Dog", "Domestic fold"]},
                    {cells: ["“grasshopper” (broad)", "Grasshopper & Locust", "Group"]},
                    {cells: ["Desert Locust", "Desert Locust", "Species"]},
                    {cells: ["Plume Moth", "Plume Moth", "Group"]}
                ]
            }
        },
        {
            title: "What you see after a scan",
            paragraphs: [
                "Aliases map to one official card. “Garden Snail” and “Escargot” can both point at Snail. “GALS” and “Lissachatina fulica” point at Giant African Land Snail.",
                "The collection UI should show that resolved card’s AnimalDex number, display name, and whether it is a species or a lookalike group.",
                "AnimalDex does not invent a second client-side taxonomy of parallel breed numbers. If a result still feels wrong, retake with better light and framing, or contact support with the capture details."
            ],
            inlineLinks: [
                {text: "Contact AnimalDex Support", slug: "contact", href: "/contact"},
                {text: "Open the Help Center", slug: "support", href: "/support#animaldex-numbers"}
            ]
        },
        {
            title: "Key takeaways",
            paragraphs: [],
            cards: [
                {
                    label: "Collect the resolved card",
                    body: "Always trust the catalog number, display name, and species-or-group kind — not every temporary AI nickname."
                },
                {
                    label: "Groups are intentional",
                    body: "A shared group card is not a bug when photos cannot fairly separate a massive lookalike family."
                },
                {
                    label: "Exceptions are explicit",
                    body: "Giant African Land Snail and Australian Green Tree Frog stay species on purpose. Named insects usually do too."
                },
                {
                    label: "Pets still belong",
                    body: "Dogs, cats, horses, cockatiels, and goldfish index as base animals so the catalog stays collectible without endless morph lines."
                }
            ],
            pullQuote: "Index at species by default; fold domestics and morphs; group only allowlisted lookalike families — then display the DB-resolved card."
        }
    ],
    faq: [
        {
            question: "How does AnimalDex index animals?",
            answer:
                "AnimalDex indexes animals at species by default, uses lookalike group cards only for allowlisted massive hard-to-separate families, and folds domestic breeds and color morphs into a base species. The collectible AnimalDex number always belongs to the resolved catalog card."
        },
        {
            question: "What does an AnimalDex number mean?",
            answer:
                "An AnimalDex number is the official collectible index for one canonical field-guide card — a species, an allowlisted lookalike group, or a domestic base species — not every breed, morph, or nickname mentioned in analysis."
        },
        {
            question: "Why did my garden snail become “Snail” instead of a more specific name?",
            answer:
                "Ordinary garden and pond snails usually share the Snail group card because everyday photos cannot reliably separate those lookalikes. Giant African Land Snail is a deliberate species exception and keeps its own number."
        },
        {
            question: "Do dog breeds get their own AnimalDex numbers?",
            answer:
                "No. Breeds and color morphs fold to a base species. A German Shepherd indexes as Domestic Dog. Analysis may still mention the breed, but the collectible card is the base animal."
        },
        {
            question: "What is a lookalike group in AnimalDex?",
            answer:
                "A group card covers a massive family of animals that look too similar for reliable species-level indexing from typical phone photos — for example Tree Frog, Tilapia, ordinary snails, or broad insect labels like ant or mosquito."
        },
        {
            question: "Why does Desert Locust stay separate from Grasshopper & Locust?",
            answer:
                "Named insects stay species by default. The Grasshopper & Locust group catches broad labels such as “grasshopper” or “locust,” not every named species in that family."
        },
        {
            question: "Can the AI mention a breed or morph if the card is the base species?",
            answer:
                "Yes. Refined analysis text can mention breed or morph detail for learning, while the indexed AnimalDex card remains the base species or allowlisted group."
        },
        {
            question: "Is a group card still collectible?",
            answer:
                "Yes. Lookalike groups still receive AnimalDex numbers. They are shared catalog cards for hard-to-separate families, not unindexed leftovers."
        }
    ]
};

import {getChallenge, getChallengesForSpecies} from "@/data/challenges";
import {BlogMediaBlock, CanonicalContentMetadata} from "@/data/content-schema";

export type BlogLink = {
    text: string;
    slug: string;
    href?: string;
    kind?: "species" | "challenge";
};

export type BlogSectionCard = {
    label: string;
    body: string;
    links?: BlogLink[];
    image?: {
        src: string;
        alt: string;
        width: number;
        height: number;
    };
};

export type BlogSource = {
    label: string;
    href: string;
};

export type BlogSubsection = {
    title: string;
    paragraphs: string[];
    media?: BlogMediaBlock;
    pullQuote?: string;
};

export type BlogSection = {
    kicker?: string;
    title: string;
    paragraphs: string[];
    cards?: BlogSectionCard[];
    inlineLinks?: BlogLink[];
    speciesSlugs?: string[];
    media?: BlogMediaBlock;
    pullQuote?: string;
    subsections?: BlogSubsection[];
};

export type BlogFAQ = {
    question: string;
    answer: string;
};

export type BlogPost = CanonicalContentMetadata & {
    slug: string;
    readingMinutes: number;
    author?: string;
    tags: string[];
    searchIntents: string[];
    speciesSlugs: string[];
    systemsSpeciesSlugs?: string[];
    relatedChallengeSlugs?: string[];
    tableOfContents?: string[];
    sections: BlogSection[];
    faq?: BlogFAQ[];
    sources?: BlogSource[];
};

type AnimalSystemsPostInput = Omit<BlogPost, "publishedAt" | "updatedAt" | "author" | "speciesSlugs" | "systemsSpeciesSlugs"> & {
    speciesSlug: string;
    author?: string;
};

function createAnimalSystemsPost({
    speciesSlug,
    author = "AnimalDex Systems Desk",
    ...post
}: AnimalSystemsPostInput): BlogPost {
    return {
        ...post,
        publishedAt: "2026-04-10",
        updatedAt: "2026-04-10",
        author,
        speciesSlugs: [speciesSlug],
        systemsSpeciesSlugs: [speciesSlug]
    };
}

const forbiddenAnimalFilesImageBase = "/images/blog/forbidden-animal-files";

function forbiddenAnimalFilesImage(src: string, alt: string, width: number, height: number, caption?: string) {
    return {
        src: `${forbiddenAnimalFilesImageBase}/${src}`,
        alt,
        width,
        height,
        caption
    };
}

const blogPostsData: BlogPost[] = [
    {
        slug: "animal-experiments-they-wont-repeat-ethics-or-cover-up",
        title: "Animal Experiments They Won’t Repeat — Ethics or Cover-Up?",
        description: "Explore the forbidden animal files: CIA spy cats, bat bombs, planarian memory, Rupert Sheldrake, animal death instincts, Kirlian photography, medieval bestiaries, and ancient animal symbolism.",
        publishedAt: "2026-06-08",
        updatedAt: "2026-06-08",
        featuredImage: forbiddenAnimalFilesImage(
            "animal-kingdom-connected-consciousness-field.webp",
            "World map style image showing animals connected through a shared consciousness field, representing the AnimalDex view of nature as a living network",
            1548,
            1296,
            "The AnimalDex view treats the animal kingdom as a living archive of intelligence, instinct, myth, and meaning."
        ),
        readingMinutes: 22,
        author: "AnimalDex Editorial",
        tags: ["Forbidden animal files", "Animal consciousness", "Animal symbolism", "Animal intelligence"],
        searchIntents: [
            "animal experiments",
            "forbidden animal experiments",
            "unethical animal experiments",
            "CIA animal experiments",
            "Acoustic Kitty",
            "Project X-Ray bat bomb",
            "Rupert Sheldrake animals",
            "morphic resonance animals",
            "animal consciousness",
            "animal symbolism",
            "biblical animal symbolism",
            "medieval bestiary animals",
            "animals and death",
            "do animals know when they are dying",
            "animal intelligence experiments",
            "flatworm memory experiment",
            "planarian memory",
            "Kirlian photography animals",
            "AnimalDex"
        ],
        speciesSlugs: ["maine-coon-cat", "bald-eagle"],
        systemsSpeciesSlugs: ["bald-eagle"],
        tableOfContents: [
            "The Chicks and the Random Robot",
            "James McConnell and the Memory Cannibal Flatworms",
            "The Soviet Rabbit Submarine Story",
            "Animals and Death",
            "Rupert Sheldrake, Dogs That Know, and Morphic Resonance",
            "Why Would Mainstream Science Dismiss This?",
            "Declassified Animal Projects",
            "Animal Intelligence Experiments",
            "Kirlian Photography, L-Fields, and the Body as a Blueprint",
            "Ancient Animal Symbolism",
            "Are Humans Animals?",
            "Ethics or Cover-Up?",
            "Final AnimalDex Reflection"
        ],
        sections: [
            {
                kicker: "Forbidden animal files",
                title: "The animal questions science keeps at the edge",
                paragraphs: [
                    "There are animal experiments that feel too strange to belong in normal science. Not because they are automatically false. Not because every claim is proven. But because they ask questions that modern science often avoids.",
                    "Can animals sense death before it happens? Can memory exist outside the brain? Can instinct be a kind of ancient biological archive? Can animals perceive invisible signals humans ignore? Can consciousness behave less like a private thought inside the skull and more like a field?",
                    "The AnimalDex view is simple: animals are not just background creatures in the human story. They are living archives. They carry behavior, intelligence, symbolism, instinct, memory, and mystery. Every animal is a code. Every species is a different way of reading reality.",
                    "Modern biology gives us one layer of the animal kingdom. Ancient texts give us another. Declassified military projects give us another. Controversial consciousness research gives us another. When those layers overlap, the question becomes hard to ignore: what if animals are receivers, sensors, symbols, and biological technologies tuned into parts of reality we barely understand?",
                    "Some of these experiments are documented history. Some are controversial. Some are fringe. Some are rejected by mainstream science. The point is not to pretend every forbidden claim is proven. The point is to ask why the stories survive, what they reveal about human curiosity, and what they might still teach us about animals."
                ],
                pullQuote: "Real curiosity does not blindly believe every strange claim. It also does not laugh at a question just because it threatens a worldview."
            },
            {
                title: "The Chicks and the Random Robot",
                paragraphs: [
                    "One of the strangest animal consciousness stories comes from French researcher Rene Peoc'h and his experiments with chicks and a machine known as a Tychoscope.",
                    "A Tychoscope is a small robot designed to move randomly. It has no eyes, no feelings, no desire, and no relationship to the space around it. Then Peoc'h introduced newborn chicks.",
                    "Newly hatched chicks can imprint on the first moving object they encounter. In nature, this is usually the mother hen. In the lab story, the first moving object was the robot. To the chicks, the little machine became mother.",
                    "Peoc'h placed the chicks inside a glass cage on one side of the room and allowed the robot to move freely. According to the claim, the robot spent far more time near the chicks than random chance predicted.",
                    "Mainstream science does not accept this as proof of psychokinesis or mind-over-matter. Critics have questioned methodology, statistics, environmental bias, edge effects, and replication. That matters. Any extraordinary claim should be treated carefully.",
                    "But the reason this experiment remains fascinating is not because it proves animal telepathy. It is fascinating because it asks a forbidden question: can desire interact with randomness?"
                ],
                media: {
                    type: "gallery",
                    title: "Chicks, imprinting, and a random machine",
                    images: [
                        forbiddenAnimalFilesImage(
                            "rene-peoch-tychscope-chicks-robot-experiment.webp",
                            "Rene Peoc'h Tychoscope experiment screenshot showing chicks imprinted on a robot used to test intention and random movement",
                            862,
                            684,
                            "Rene Peoc'h's controversial chick-and-robot experiment asked whether animal intention could affect random movement."
                        ),
                        forbiddenAnimalFilesImage(
                            "tychscope-robot-movement-before-after-chicks.webp",
                            "Diagram comparing Tychoscope robot movement before and after exposure to imprinted chicks in Rene Peoc'h's controversial experiment",
                            882,
                            752,
                            "The famous claim is disputed, but the story survives because it points at the mystery of attention, attachment, and randomness."
                        )
                    ]
                },
                pullQuote: "A newborn chick does not believe the robot is its mother in an abstract way. It experiences the robot as mother."
            },
            {
                title: "James McConnell and the Memory Cannibal Flatworms",
                paragraphs: [
                    "If the chick experiment asks whether consciousness can reach outward, the flatworm experiments ask whether memory can live deeper than the brain.",
                    "In the 1950s and 60s, biologist James V. McConnell became famous for experiments involving planarian flatworms. Planarians are small worms known for extraordinary regeneration. Cut one in half, and the head half can regrow a tail. The tail half can regrow a head, including a new brain and nervous system.",
                    "McConnell trained planarians using light and electric shock conditioning, then cut trained worms in half and allowed them to regenerate. According to controversial reports, regenerated worms appeared to retain traces of previous training.",
                    "Then McConnell pushed the idea further. He ground up trained worms and fed them to untrained worms. The claim was that the untrained worms learned faster than ordinary control worms. This became known popularly as the memory cannibalism experiment.",
                    "Mainstream science heavily criticized the experiments, and many attempts to replicate McConnell's strongest claims produced mixed or negative results. For decades, the topic became almost embarrassing in serious neuroscience.",
                    "But the question did not die. Modern planarian research has revived part of the mystery in a more careful way, including questions about regeneration, behavioral priming, and whether body-wide bioelectric or cellular systems participate in memory-like patterning.",
                    "This does not mean worms literally eat knowledge in the cartoon sense. It means the simple model of memory equals brain wiring only may be incomplete in some organisms."
                ],
                media: {
                    type: "gallery",
                    title: "Planarians and body memory",
                    images: [
                        forbiddenAnimalFilesImage(
                            "planarian-flatworm-regeneration-memory.webp",
                            "Planarian flatworm used in regeneration and memory experiments exploring whether learned behavior can survive brain regrowth",
                            1200,
                            705,
                            "Planarian flatworms raise one of biology's strangest questions: where does memory live if the brain can regrow?"
                        ),
                        forbiddenAnimalFilesImage(
                            "flatworm-under-microscope-memory-research.webp",
                            "Flatworm under a microscope, representing planarian memory research and regeneration experiments",
                            978,
                            812,
                            "Planarian regeneration is documented biology; the stronger memory-transfer claims remain disputed."
                        )
                    ]
                },
                pullQuote: "If your brain disappeared and came back, what part of you would remain?"
            },
            {
                title: "The Soviet Rabbit Submarine Story",
                paragraphs: [
                    "One of the most disturbing and controversial animal stories comes from the Cold War. It is often described as the Soviet rabbit submarine experiment.",
                    "The story goes like this: Soviet researchers allegedly placed a mother rabbit in a laboratory on shore and connected her to monitoring equipment. Her newborn babies were taken aboard a submarine. At scheduled intervals, the baby rabbits were killed. According to the story, the mother rabbit showed measurable physiological spikes at the exact moments her babies died.",
                    "Mainstream science does not accept the rabbit submarine story as reliable proof. The documentation is murky, the chain of evidence is weak, and the experiment is often repeated in fringe literature more than in rigorous scientific archives.",
                    "But as a story, it remains powerful because it touches a pattern humans have observed for thousands of years: the mother knows, the herd knows, the pack knows, the flock knows.",
                    "Animal bonds often appear deeper than mechanical stimulus and response. A dog senses when its owner is coming home. A cat changes behavior around illness. Birds leave before storms. Herd animals panic before danger. Elephants gather around bones. Whales carry dead calves.",
                    "These behaviors do not prove telepathy. But they do prove that animals respond to death, distress, absence, and emotional rupture in ways that look more complex than old models of mere instinct allowed.",
                    "The rabbit submarine story may be myth, distorted history, or unverified Cold War rumor. Yet it survives because it points at something real: animals often appear to sense connection, distress, and death in ways humans still struggle to explain fully."
                ],
                media: {
                    type: "gallery",
                    title: "A disputed Cold War legend",
                    images: [
                        forbiddenAnimalFilesImage(
                            "soviet-rabbit-experiment-black-and-white.webp",
                            "Black and white image representing the controversial Soviet rabbit experiment and Cold War biological radio communication research",
                            1200,
                            1198,
                            "The Soviet rabbit story remains controversial, but it survives because it asks whether biological bonds can cross distance."
                        ),
                        forbiddenAnimalFilesImage(
                            "mother-rabbit-eeg-biological-radio-communication.webp",
                            "Mother rabbit connected to EEG monitoring equipment, representing claims about biological radio communication in Soviet animal experiments",
                            1200,
                            756,
                            "Use this story carefully: it is reported and controversial, not accepted as proven science."
                        ),
                        forbiddenAnimalFilesImage(
                            "soviet-rabbit-eeg-submarine-experiment-demonstration.webp",
                            "Demonstration image of a rabbit connected to EEG equipment beside a toy rabbit, representing the controversial Soviet rabbit submarine experiment",
                            1200,
                            660,
                            "Demonstration image for a disputed claim, not documentation of verified animal harm."
                        )
                    ]
                }
            },
            {
                title: "Animals and Death",
                paragraphs: [
                    "Animals and death may be one of the most emotionally powerful areas of animal mystery. Many people report that pets behave strangely before their own death or before the death of a human companion.",
                    "Dogs may refuse to leave a dying owner's bedside. Cats may curl up next to someone shortly before they pass. Horses may become unusually still. Birds may go quiet. Elephants may touch the bones of dead relatives. Whales may carry dead calves through the ocean. Chimpanzees may gather quietly around a dying member of the group.",
                    "These behaviors challenge the old idea that animals are emotional machines. They look like grief. They look like mourning. They look like goodbye.",
                    "Cats are especially mysterious in this area. Many cat owners report that cats sometimes hide, leave home, or withdraw shortly before death. The standard explanation is practical and evolutionary: a sick animal becomes vulnerable, so it hides to avoid predators.",
                    "There are also reports of cats and dogs reacting to dying humans before the humans visibly decline. Ordinary explanations matter here: animals can smell biochemical changes, hear changes in breathing, and detect shifts in movement, temperature, stress hormones, and routine.",
                    "But the deeper question remains: do animals merely detect physical decline, or do they experience death as a transition before we consciously recognize it?",
                    "In many cultures, animals were seen as threshold beings. Cats guarded doorways between seen and unseen worlds. Dogs guarded the underworld. Birds carried souls. Serpents represented death and rebirth. Modern people may dismiss this as superstition, but ancient symbolism often began with observation."
                ],
                media: {
                    type: "gallery",
                    title: "Boundary readers",
                    images: [
                        forbiddenAnimalFilesImage(
                            "dog-beside-dying-owner-bedside.webp",
                            "Dog lying beside a dying loved one in bed, representing reports of animals sensing death and staying close to their owners",
                            1200,
                            725,
                            "Dogs and cats often behave strangely around illness and death, raising questions about animal sensitivity to human transition."
                        ),
                        forbiddenAnimalFilesImage(
                            "cat-leaving-home-before-death-myth.webp",
                            "Funny image of a cat leaving home with a suitcase, representing stories of cats hiding or leaving before death",
                            221,
                            228,
                            "A lighter image for a heavy subject: cats may hide, withdraw, seek closeness, or simply change routine near the end of life."
                        )
                    ]
                },
                pullQuote: "Whether or not one accepts spiritual interpretations, animals clearly perceive more than humans consciously notice."
            },
            {
                title: "Rupert Sheldrake, Dogs That Know, and Morphic Resonance",
                paragraphs: [
                    "Rupert Sheldrake is one of the most controversial figures in modern consciousness research. He is a Cambridge-educated biologist and author best known for the theory of morphic resonance.",
                    "Morphic resonance proposes that nature has memory. Not just individual memory, but collective memory. According to the theory, organisms inherit not only genes but also habits of form and behavior through fields.",
                    "This is not accepted as mainstream science. It is controversial and often criticized. But it is powerful as a framework because it tries to explain patterns that seem difficult to reduce to genes and mechanics alone.",
                    "One of Sheldrake's most famous areas of research involves animals that appear to know when their owners are coming home. Many dog owners report that their dog goes to the window, waits by the door, or becomes excited before the owner arrives.",
                    "Skeptics argue that dogs respond to routine, sound, smell, or subtle cues from people already in the house. Sheldrake explored cases where the owner returned at random times, by unfamiliar transport, or without normal cues. Mainstream researchers remain skeptical.",
                    "Sheldrake's morphic resonance remains controversial, but it is useful for AnimalDex because it gives language to a possibility: animals may not be isolated machines. They may be nodes in a living field."
                ],
                media: {
                    type: "gallery",
                    title: "Pet bonds and species memory",
                    images: [
                        forbiddenAnimalFilesImage(
                            "dog-knows-owner-coming-home-sheldrake.webp",
                            "Dog waiting by the door for its owner, representing Rupert Sheldrake's research into pets knowing when their owners are coming home",
                            1200,
                            1000,
                            "Sheldrake's pet research explores whether animals can sense their owners returning through more than ordinary cues."
                        ),
                        forbiddenAnimalFilesImage(
                            "rat-maze-memory-experiment.webp",
                            "Rats navigating a maze, representing early animal memory experiments and controversial maze-learning research",
                            1200,
                            838,
                            "Rat maze stories became part of the wider debate about learning, replication, and species-level memory claims."
                        ),
                        forbiddenAnimalFilesImage(
                            "morphic-resonance-rats-distant-labs.webp",
                            "Rats in distant laboratories representing Rupert Sheldrake's controversial morphic resonance theory and shared species memory",
                            1200,
                            796,
                            "Morphic resonance is disputed, but it remains one of the most famous field-like theories of animal behavior."
                        )
                    ]
                }
                // TODO: The image map requested rats-global-memory-field-experiment.webp, but no matching raw source image was present in blog-content-temp.
            },
            {
                title: "Why Would Mainstream Science Dismiss This?",
                paragraphs: [
                    "The word suppressed is emotionally powerful, but it needs to be used carefully. Sometimes information is not suppressed. Sometimes it is rejected because the evidence is weak. Sometimes an experiment is flawed. Sometimes results cannot be replicated. Sometimes the simpler explanation is correct.",
                    "But there is also a deeper cultural issue. Modern science operates inside worldviews. One dominant worldview is materialism: reality is made of physical matter and energy, consciousness is produced by the brain, memory is stored in neural systems, and emotions are chemical and electrical events.",
                    "This worldview has produced incredible achievements: medicine, engineering, computing, antibiotics, neuroscience, and modern biology. It also creates boundaries around what kinds of questions are considered respectable.",
                    "A young scientist who wants a stable career may avoid topics like telepathy, animal premonition, near-death experiences, or morphic fields because those subjects carry stigma. That does not prove the subjects are true. It does mean the social environment affects what gets researched.",
                    "The AnimalDex approach should not be anti-science. It should be anti-dogma. Real science is curiosity plus discipline. It asks strange questions, then tests them carefully."
                ],
                pullQuote: "The right approach is curiosity with standards: mystery with discipline, wonder with honesty."
            },
            {
                title: "Declassified Animal Projects",
                paragraphs: [
                    "One of the strongest arguments that animals are not simple comes from government behavior. Governments and militaries have repeatedly tried to use animals as biological technology.",
                    "That does not mean every project was ethical. Many were disturbing. Some were cruel. Some were failures. But they show that powerful institutions took animal perception seriously."
                ],
                subsections: [
                    {
                        title: "Project Acoustic Kitty",
                        paragraphs: [
                            "During the Cold War, the CIA developed a project popularly known as Acoustic Kitty. The idea was to turn a cat into a covert listening device. Instead of simply attaching a microphone to a collar, the project involved surgical modification.",
                            "The goal was espionage. A cat could wander near sensitive conversations without looking suspicious. The project was eventually judged impractical, and the famous taxi-ending version of the story is debated.",
                            "The declassified lesson is still disturbing: the CIA viewed a living animal as a platform. Not a pet. Not a symbol. A biological surveillance device."
                        ]
                    },
                    {
                        title: "Project X-Ray: The Bat Bomb",
                        paragraphs: [
                            "During World War Two, the United States developed Project X-Ray, a plan to use bats as incendiary weapons. Mexican free-tailed bats were chosen because they could carry small loads and naturally hide in dark spaces such as roofs and attics.",
                            "The plan involved attaching tiny timed incendiary devices to bats, placing the bats into bomb casings, dropping them over Japanese cities, and allowing them to disperse into wooden structures before the devices ignited.",
                            "The project sounds cartoonish, but it was real enough to receive serious development. It was eventually canceled before deployment. Project X-Ray reveals something dark about human ingenuity: when humans recognize animal abilities, we often try to exploit them."
                        ]
                    },
                    {
                        title: "The US Navy Marine Mammal Program",
                        paragraphs: [
                            "The US Navy Marine Mammal Program trains bottlenose dolphins and California sea lions for underwater tasks. Dolphins are valuable because of echolocation. Sea lions have excellent underwater vision and can be trained to locate and mark objects.",
                            "These animals have been used for mine detection, object recovery, and harbor defense. Unlike the more bizarre CIA cat or bat bomb experiments, the Navy marine mammal program is publicly acknowledged.",
                            "The ethical questions are serious. Should animals be used in military programs? Can they consent? Are they protected? Are they treated as partners or equipment? One thing is clear: the military did not treat these animals as dumb. It treated them as specialists."
                        ],
                        media: {
                            type: "gallery",
                            title: "Dolphins and sea lions as specialists",
                            images: [
                                forbiddenAnimalFilesImage(
                                    "navy-marine-mammal-program-dolphin-device.webp",
                                    "Dolphin leaping from the water with a training device, representing the US Navy Marine Mammal Program and dolphin echolocation research",
                                    998,
                                    1200,
                                    "Military programs treated dolphins and sea lions as biological specialists with perception machines still struggle to match."
                                ),
                                forbiddenAnimalFilesImage(
                                    "navy-marine-mammal-program-sea-lion-device.webp",
                                    "Sea lion with a training device, representing military marine mammal research and underwater object recovery",
                                    932,
                                    609,
                                    "Sea lions specialize in underwater vision and trained object recovery."
                                )
                            ]
                        }
                    }
                ]
            },
            {
                title: "Animal Intelligence Experiments",
                paragraphs: [
                    "For a long time, people imagined intelligence as a ladder: humans at the top, then great apes, mammals, birds, reptiles, fish, and insects below. This ladder is outdated.",
                    "Animal intelligence is not one ladder. It is a forest of different abilities. Different species solve different realities."
                ],
                subsections: [
                    {
                        title: "Crows and the Concept of Zero",
                        paragraphs: [
                            "Crows are among the most intelligent birds studied. Research has shown that carrion crows can treat the empty set as a numerical quantity. In plain language, they can represent nothing as a kind of number.",
                            "This matters because zero is abstract. Zero is not an object in the world. It is a concept representing absence. For a bird brain to represent absence as a numerical category suggests that abstract cognition does not require a human brain or even a mammalian neocortex."
                        ],
                        media: {
                            type: "image",
                            image: forbiddenAnimalFilesImage(
                                "crow-neurons-concept-of-zero.webp",
                                "Crow intelligence image showing specialized neurons linked to the concept of zero and abstract animal cognition",
                                960,
                                1200,
                                "Crows challenge the human-centered view of intelligence by representing absence as a numerical category."
                            )
                        }
                    },
                    {
                        title: "Cleaner Wrasse and Economic Strategy",
                        paragraphs: [
                            "Cleaner wrasse are small reef fish that eat parasites from larger client fish. Their social world is basically a living marketplace.",
                            "Some client fish are residents that will wait. Others are visitors that will leave if not served quickly. This creates a strategic problem: serve the temporary client first before it leaves, then serve the one that will stay.",
                            "In experiments based on this logic, adult cleaner wrasse outperformed capuchin monkeys, orangutans, and chimpanzees in a task involving temporary and permanent food options. This does not mean cleaner wrasse are generally smarter than apes. It means their intelligence is specialized for their ecological reality."
                        ]
                    },
                    {
                        title: "Slime Mold and the Tokyo Rail Network",
                        paragraphs: [
                            "Slime mold is not an animal in the usual sense. It has no brain or nervous system. Yet it can solve network problems.",
                            "In a famous experiment, researchers placed food sources in positions corresponding to Tokyo and surrounding cities. Slime mold grew outward and formed a network connecting the food sources in a way that resembled the Tokyo rail system.",
                            "No brain. No central planner. No engineering degree. Just biological feedback. For AnimalDex, this is crucial: if a brainless organism can solve a transport problem, perhaps intelligence is not a possession. Maybe intelligence is a pattern life enters when it organizes itself."
                        ],
                        media: {
                            type: "gallery",
                            title: "Network intelligence without a brain",
                            images: [
                                forbiddenAnimalFilesImage(
                                    "slime-mold-network-intelligence.webp",
                                    "Slime mold forming a branching network, used to explain decentralized intelligence without a brain",
                                    960,
                                    1200,
                                    "Slime mold suggests that intelligence may emerge from networks, not just brains."
                                ),
                                forbiddenAnimalFilesImage(
                                    "slime-mold-tokyo-rail-network-comparison.webp",
                                    "Slime mold network pattern compared with human transport systems, showing how brainless organisms can solve complex routes",
                                    1140,
                                    760,
                                    "The Tokyo rail comparison became famous because the organism's network was efficient, adaptive, and resilient."
                                )
                            ]
                        }
                    }
                ]
            },
            {
                title: "Kirlian Photography, L-Fields, and the Body as a Blueprint",
                paragraphs: [
                    "Some of the most controversial animal-related ideas involve invisible fields around living bodies. Two names appear often in this area: Harold Saxton Burr and Semyon Kirlian."
                ],
                subsections: [
                    {
                        title: "Harold Burr and L-Fields",
                        paragraphs: [
                            "Dr. Harold Saxton Burr, an anatomist at Yale, studied electrical patterns in living organisms. He proposed that living beings are shaped by organizing electrical fields, which he called L-fields or Fields of Life.",
                            "Mainstream science does not accept all of Burr's interpretations. However, modern biology increasingly recognizes that bioelectric signals play important roles in development, regeneration, wound healing, and body patterning.",
                            "The controversial part is how far that idea goes. Does the body have an electrical mold? Can regeneration be guided by field-like information? Do animals carry body memory in bioelectric patterns?"
                        ]
                    },
                    {
                        title: "Kirlian Photography",
                        paragraphs: [
                            "Kirlian photography captures corona discharge around objects exposed to high-voltage electrical fields. The images often show glowing outlines, which many people have interpreted as auras or life-force fields.",
                            "Mainstream science explains Kirlian images through electrical discharge, moisture, pressure, grounding, humidity, and conductivity. It does not treat them as proof of a soul or aura.",
                            "The famous phantom leaf effect adds to the mystery. Some claimed that when part of a leaf was cut away, a ghostly outline of the missing section could still appear. Skeptics argue this can result from moisture residue, contamination, or technical artifacts.",
                            "Even if the mainstream explanation is correct, the symbolism remains powerful. The Kirlian image feels like a visual metaphor for an ancient idea: the body is more than flesh. It is also pattern."
                        ],
                        media: {
                            type: "gallery",
                            title: "Corona discharge and field symbolism",
                            images: [
                                forbiddenAnimalFilesImage(
                                    "semyon-kirlian-portrait-kirlian-photography.webp",
                                    "Portrait of Semyon Kirlian, associated with Kirlian photography and glowing corona discharge images around living objects",
                                    220,
                                    282,
                                    "Kirlian photography became famous for glowing corona images and controversial claims about life fields."
                                ),
                                forbiddenAnimalFilesImage(
                                    "phantom-leaf-effect-kirlian-field.webp",
                                    "Illustration of the phantom leaf effect showing a cut leaf with a glowing field around the missing section",
                                    1200,
                                    782,
                                    "The phantom leaf effect is disputed and usually explained through technical artifacts, but its symbolism remains powerful."
                                )
                            ]
                        }
                    }
                ]
            },
            {
                title: "Ancient Animal Symbolism",
                paragraphs: [
                    "Long before laboratories, military programs, and neuroscience, humans studied animals through myth, art, scripture, and symbol.",
                    "Ancient people did not see animals as random background creatures. They saw them as living signs: a force, a temperament, a warning, a virtue, a danger, a divine message.",
                    "AnimalDex can be understood as a modern continuation of this ancient instinct: to identify animals not only by species, but by meaning."
                ],
                media: {
                    type: "image",
                    image: forbiddenAnimalFilesImage(
                        "leonardo-da-vinci-animal-drawings.webp",
                        "Leonardo da Vinci animal drawings showing the historical study of animal anatomy, movement, and symbolic meaning",
                        1200,
                        690,
                        "Human beings have always studied animals as anatomy, motion, symbol, and message."
                    )
                },
                subsections: [
                    {
                        title: "The Tetramorph: Human, Lion, Ox, Eagle",
                        paragraphs: [
                            "In the biblical books of Ezekiel and Revelation, there are visions of four living creatures. These creatures are later represented in Christian art as the Tetramorph: human, lion, ox, and eagle.",
                            "The human represents consciousness, intelligence, speech, empathy, and moral awareness. The lion represents courage, sovereignty, danger, and command. The ox represents labor, endurance, sacrifice, and grounded strength. The eagle represents height, vision, ascension, and the ability to see from above.",
                            "Together, these animals form a symbolic map of reality: mind, power, labor, and vision."
                        ]
                    },
                    {
                        title: "Medieval Bestiaries",
                        paragraphs: [
                            "Medieval bestiaries were illustrated books about animals, both real and imaginary. They mixed natural history, folklore, theology, allegory, and moral teaching.",
                            "Modern people sometimes laugh at bestiaries because the animals look inaccurate. But accuracy was not always the point. The medieval artist was not simply asking what an animal looked like. They were asking what it meant."
                        ]
                    },
                    {
                        title: "The Pelican: Sacrifice",
                        paragraphs: [
                            "The Pelican in her Piety became a major medieval Christian symbol. People believed the pelican pierced her own breast to feed her young with her blood. This was a misunderstanding of pelican behavior, but symbolically it became an image of self-sacrifice and life-giving love.",
                            "In AnimalDex language, the pelican is the archetype of nourishment through suffering: the mother who gives herself, the body as offering, life feeding life."
                        ],
                        media: {
                            type: "image",
                            image: forbiddenAnimalFilesImage(
                                "medieval-bestiary-pelican-sacrifice.webp",
                                "Medieval bestiary illustration of the pelican sacrifice myth, showing a mother pelican feeding her young in ancient symbolic animal art",
                                1200,
                                730,
                                "Medieval bestiaries treated animals as symbolic codes, not just biological creatures."
                            )
                        }
                    },
                    {
                        title: "The Stag: Purity and Hidden Water",
                        paragraphs: [
                            "The stag or deer appears in Christian and ancient symbolism as a seeker of pure water. The biblical line about the deer panting for streams of water made the deer a symbol of spiritual longing.",
                            "In older bestiary lore, stags were also associated with fighting serpents and renewal. In AnimalDex terms, the stag is the tracker of light."
                        ],
                        media: {
                            type: "gallery",
                            title: "The deer as seeker",
                            images: [
                                forbiddenAnimalFilesImage(
                                    "medieval-bestiary-stag-symbolism.webp",
                                    "Medieval bestiary image of a stag, symbolizing purity, hidden water, and spiritual longing in ancient animal symbolism",
                                    500,
                                    386,
                                    "The stag searches for pure water and becomes a symbol of longing, renewal, and clean instinct."
                                ),
                                forbiddenAnimalFilesImage(
                                    "as-the-deer-pants-for-streams-psalm-42.webp",
                                    "Psalm 42 Bible verse image with a deer background, showing the ancient symbolism of the stag seeking pure water",
                                    800,
                                    1200,
                                    "Psalm 42 helped make the deer a lasting image of spiritual thirst."
                                )
                            ]
                        }
                    },
                    {
                        title: "The Serpent and the Cat",
                        paragraphs: [
                            "The serpent is one of the most complex animal symbols in human history. In some traditions, it represents danger, temptation, poison, and deception. In others, it represents healing, wisdom, renewal, and immortality. Because the serpent sheds its skin, it becomes transformation through danger.",
                            "Cats occupy a different symbolic threshold. In ancient Egypt, cats were linked with protection and sacred power. In European folklore, they were linked with witches, night, spirits, omens, and invisible worlds. Scientifically, cats have sharp senses and subtle body awareness. Symbolically, they represent the doorway."
                        ]
                    }
                ]
            },
            {
                title: "Are Humans Animals?",
                paragraphs: [
                    "Scientifically, yes. Humans are animals. We belong to the kingdom Animalia. We are mammals, primates, and great apes.",
                    "The idea that humans are not animals is cultural, religious, philosophical, or linguistic. It is not biological taxonomy.",
                    "But humans are unusual animals. We have symbolic language, cumulative culture, massive cooperation, abstract institutions, and technological acceleration. That makes humans different. Different does not mean separate, and it does not mean superior in every domain.",
                    "A dog smells a world we cannot smell. A bat hears a map we cannot hear. A dolphin sees through sound. A bird senses magnetic direction. A snake reads heat. A fish feels pressure and electrical change. A spider reads vibration. A bee communicates through dance. A whale sings through oceans.",
                    "The mistake is asking whether animals think like humans. The better question is: what kind of world does this animal live in? Once you ask that, every species becomes a portal."
                ]
            },
            {
                title: "Ethics or Cover-Up?",
                paragraphs: [
                    "So why won't these experiments be repeated? There are two answers.",
                    "The first answer is ethics. Many old animal experiments were cruel, invasive, or unacceptable by modern standards. Cutting animals apart, weaponizing bats, surgically modifying cats, killing offspring to test distress responses, and using animals as military tools raise serious moral questions.",
                    "Modern animal research requires ethical review, welfare standards, justification, and humane treatment. That is a good thing. Animals are sentient. They feel pain, stress, fear, attachment, and comfort. They should not be treated as disposable machines.",
                    "The second answer is worldview. Some experiments are not repeated because they are ethically impossible. Others are avoided because they are reputationally dangerous.",
                    "A researcher can study animal cognition safely if they use accepted language: memory, learning, sensory cue, conditioning, welfare, social behavior. But if they ask about telepathy, fields, death premonition, non-local connection, or consciousness beyond the brain, they risk ridicule.",
                    "The AnimalDex position is balanced: do not blindly believe every forbidden claim, but do not blindly obey every official dismissal either. Animals deserve better than exploitation. They also deserve better than reduction."
                ],
                pullQuote: "Animals are not machines. They are not symbols only. They are living beings with their own intelligence, perception, and meaning."
            },
            {
                title: "Final AnimalDex Reflection",
                paragraphs: [
                    "Every creature has a secret.",
                    "The chick asks whether desire can touch probability. The flatworm asks where memory lives. The rabbit asks whether bonds cross distance. The dog asks whether love has a field. The cat asks what waits at the threshold. The dolphin asks what sound can see.",
                    "The crow asks whether nothing can become a number. The slime mold asks whether intelligence needs a brain. The lion asks what it means to rule. The ox asks what it means to endure. The eagle asks what it means to see from above. The stag asks where pure water hides. The serpent asks what must be shed before rebirth.",
                    "This is why AnimalDex exists. Not just to identify animals. To decode them.",
                    "Because the animal kingdom is not background scenery. It is a living archive. A biological library. A symbolic language older than writing. A network of fur, feather, scale, sound, scent, blood, bone, instinct, memory, and signal.",
                    "And we are only just beginning to remember how to read it."
                ],
                media: {
                    type: "image",
                    image: forbiddenAnimalFilesImage(
                        "animal-kingdom-connected-consciousness-field.webp",
                        "World map style image showing animals connected through a shared consciousness field, representing the AnimalDex view of nature as a living network",
                        1548,
                        1296,
                        "Every creature has a secret."
                    )
                }
            }
        ],
        faq: [
            {
                question: "Are humans scientifically classified as animals?",
                answer: "Yes. Biologically, humans belong to the kingdom Animalia. Humans are mammals, primates, and great apes. The separation between humans and animals is cultural and philosophical, not biological."
            },
            {
                question: "Do animals know when they are dying?",
                answer: "Some animals appear to change behavior before death. Cats may hide, dogs may seek closeness, and social animals may withdraw or become unusually calm. Mainstream science usually explains this through illness, vulnerability, pain, scent, or instinct, but many owners report behaviors that feel emotionally significant."
            },
            {
                question: "Do animals mourn?",
                answer: "Many animals show behaviors that resemble mourning, including elephants, dolphins, whales, chimpanzees, dogs, and some birds. Scientists debate how closely animal grief resembles human grief, but animal emotional life is now taken much more seriously than it once was."
            },
            {
                question: "What was Acoustic Kitty?",
                answer: "Acoustic Kitty was a CIA project from the Cold War era that attempted to use a surgically modified cat as a covert listening device. The project was eventually judged impractical."
            },
            {
                question: "What was Project X-Ray?",
                answer: "Project X-Ray was a World War Two project that explored using bats carrying small incendiary devices as weapons. The project was canceled before deployment."
            },
            {
                question: "What is morphic resonance?",
                answer: "Morphic resonance is Rupert Sheldrake's controversial theory that nature has memory and that species may share information through field-like patterns. It is not accepted as mainstream science, but it remains influential in alternative discussions of animal behavior and consciousness."
            },
            {
                question: "What are medieval bestiaries?",
                answer: "Medieval bestiaries were illustrated books that described animals through religious, moral, and symbolic meanings. They were not just animal encyclopedias; they were spiritual and allegorical codebooks."
            },
            {
                question: "What is the AnimalDex view of animals?",
                answer: "AnimalDex treats animals as more than species labels. Each animal can be understood biologically, behaviorally, symbolically, and mythologically. The goal is to decode animals as living archives of intelligence, instinct, and meaning."
            }
        ],
        sources: [
            {label: "CIA Reading Room: Acoustic Kitty release record", href: "https://www.cia.gov/readingroom/document/06802443"},
            {label: "National Security Archive: declassified CIA memo, Views on Trained Cats", href: "https://nsarchive2.gwu.edu/NSAEBB/NSAEBB54/st27.pdf"},
            {label: "CIA: Natural Spies - Animals in Espionage, including Acoustikitty context", href: "https://www.cia.gov/stories/story/natural-spies-animals-in-espionage/"},
            {label: "Smithsonian SOVA: Bombs, Bat Bombs and Project X-Ray records", href: "https://sova.si.edu/record/nasm.xxxx.1183.s/ref1764"},
            {label: "US Navy NIWC Pacific: Marine Mammal Program official page", href: "https://www.niwcpacific.navy.mil/About/Departments/Intelligence-Surveillance-and-Reconnaissance/Marine-Mammal-Program/"},
            {label: "Planarian memory and regeneration review, PMC", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5051648/"},
            {label: "Planarian regeneration model overview, PMC", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3014342/"},
            {label: "Behavioral and neuronal representation of numerosity zero in the crow, PMC", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8260164/"},
            {label: "Cleaner wrasse outperform primates in an ecologically relevant foraging task, PMC", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3504063/"},
            {label: "Rules for biologically inspired adaptive network design, Science", href: "https://www.science.org/doi/10.1126/science.1177894"},
            {label: "Kirlian photography as corona discharge, History of Photography", href: "https://www.tandfonline.com/doi/abs/10.1080/03087290802582988"},
            {label: "Britannica: medieval bestiary genre and symbolism", href: "https://www.britannica.com/art/bestiary-medieval-literary-genre"},
            {label: "Medieval Bestiary: Pelican", href: "https://bestiary.ca/beasts/beast244.htm"},
            {label: "Medieval Bestiary: Stag", href: "https://www.bestiary.ca/beasts/beast162.htm"},
            {label: "BibleGateway: Ezekiel 1", href: "https://www.biblegateway.com/passage/?search=Ezekiel%201&version=NRSVUE"},
            {label: "BibleGateway: Revelation 4", href: "https://www.biblegateway.com/passage/?search=Revelation%204&version=NRSVUE"},
            {label: "BibleGateway: Psalm 42", href: "https://www.biblegateway.com/passage/?search=Psalm%2042&version=NRSVUE"},
            {label: "BibleGateway: Job 12", href: "https://www.biblegateway.com/passage/?search=Job%2012&version=NRSVUE"}
        ]
    },
    {
        slug: "how-to-identify-animals-in-the-wild-2026-guide",
        title: "How to identify animals in the wild (2026 guide)",
        description: "A practical 2026 guide for identifying animals in the wild using body shape, behavior, habitat context, and respectful observation habits.",
        publishedAt: "2026-04-09",
        updatedAt: "2026-04-09",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/animaldex-capturing-an-alpaca-in-the-wild.webp",
            alt: "AnimalDex featured image showing an alpaca in the wild for the animal identification guide",
            width: 1200,
            height: 675,
            caption: "Featured image source: AnimalDex CDN."
        },
        readingMinutes: 7,
        author: "AnimalDex Field Team",
        tags: ["Animal identification", "Wildlife learning", "Field guide"],
        searchIntents: ["animal identification app", "animal scanner AI", "wildlife app", "educational animal app"],
        speciesSlugs: ["white-headed-vulture", "bald-eagle", "komodo-dragon"],
        systemsSpeciesSlugs: ["bald-eagle", "white-headed-vulture"],
        sections: [
            {
                title: "Start with silhouette, movement, and context",
                paragraphs: [
                    "The fastest path to a useful ID is not guessing a species name immediately. Start broader: shape, size, movement pattern, and where the sighting happened.",
                    "A bird gliding on thermals, a reptile hugging warm ground, and a canid moving in coordinated group patterns each point to different identification paths."
                ],
                speciesSlugs: ["bald-eagle", "komodo-dragon", "african-wild-dog"]
            },
            {
                title: "Habitat clues are often as important as visual traits",
                paragraphs: [
                    "Habitat can remove many false matches quickly. Water-heavy areas, open savannah, dry scrub, and managed urban spaces all shape what species are likely.",
                    "When users combine habitat logic with scan output, confidence rises and misidentification usually drops."
                ],
                speciesSlugs: ["white-headed-vulture", "komodo-dragon"]
            },
            {
                title: "Use AI to narrow possibilities, then verify with traits",
                paragraphs: [
                    "A good animal scanner should support your judgment, not replace it. Treat AI output as a shortlist, then verify with distinguishing traits.",
                    "The goal is not only a fast answer. It is becoming better at recognition over repeated sightings."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/placeholders/feature-scan-overview.svg",
                        alt: "Diagram-style visual showing AI scan, verification, and species logging",
                        width: 1200,
                        height: 675,
                        caption: "Fast identification gets better when image recognition and human judgment work as a pair."
                    }
                },
                speciesSlugs: ["bald-eagle", "maine-coon-cat"]
            },
            {
                title: "Respectful observation leads to better IDs and better outcomes",
                paragraphs: [
                    "Stressing wildlife usually creates worse photos and worse behavior signals. Distance, patience, and calm observation produce better data and safer encounters.",
                    "Curiosity over cruelty is practical fieldcraft, not just a value statement."
                ],
                speciesSlugs: ["african-wild-dog", "white-headed-vulture"]
            }
        ],
        faq: [
            {
                question: "Should I trust an AI animal scan result without checking traits?",
                answer: "Use AI as a shortlist, then confirm with visual traits, movement, and habitat context before finalizing your ID."
            },
            {
                question: "What is the safest way to improve identification accuracy in the field?",
                answer: "Keep distance, observe longer, and capture multiple angles when possible. Calm, respectful observation usually improves both safety and ID quality."
            }
        ]
    },
    {
        slug: "best-animals-to-spot-in-bali-2026",
        title: "Best animals to spot in Bali (2026)",
        description: "A practical Bali animal-spotting guide for 2026 covering where to look, what to notice, and how to keep wildlife discovery respectful and useful.",
        publishedAt: "2026-04-09",
        updatedAt: "2026-04-09",
        featuredImage: {
            src: "https://www.balitecturerealty.com/wp-content/uploads/2025/05/Animals-in-Bali.webp",
            alt: "Animals in Bali featured image for the AnimalDex 2026 Bali spotting guide",
            width: 1200,
            height: 675,
            caption: "Featured image source: Balitecture Realty."
        },
        readingMinutes: 6,
        author: "AnimalDex Travel Desk",
        tags: ["Travel animals", "Bali wildlife", "Safari and zoo learning"],
        searchIntents: ["best animals to spot in Bali", "Bali wildlife app", "travel animal app", "wildlife photography app"],
        speciesSlugs: ["komodo-dragon", "bald-eagle", "maine-coon-cat"],
        systemsSpeciesSlugs: ["komodo-dragon"],
        sections: [
            {
                title: "Build your trip around habitats, not just checklists",
                paragraphs: [
                    "Travelers usually see more species when they think in habitats: mangrove edges, forest trails, coastal zones, and managed sanctuary environments.",
                    "A habitat-first mindset also helps you understand why certain animals are visible in one area and absent in another."
                ],
                media: {
                    type: "gallery",
                    title: "Trip-planning lenses",
                    images: [
                        {
                            src: "/images/placeholders/more-discovery.svg",
                            alt: "Illustrated habitat-first wildlife discovery approach for Bali trips",
                            width: 1200,
                            height: 675
                        },
                        {
                            src: "/images/placeholders/more-guide.svg",
                            alt: "Illustrated checklist for planning wildlife spotting routes and goals",
                            width: 1200,
                            height: 675
                        }
                    ]
                }
            },
            {
                title: "Use high-value flagship species to anchor your spotting plan",
                paragraphs: [
                    "For many visitors, iconic species anchor the trip narrative. In Indonesia-wide planning, reptiles like the Komodo dragon often become educational milestones.",
                    "Even when your route is primarily Bali, studying flagship species sharpens your identification habits and keeps your app collection goals focused."
                ],
                speciesSlugs: ["komodo-dragon"]
            },
            {
                title: "Keep family and photography goals aligned",
                paragraphs: [
                    "Families and photographers often want different pacing. Shared mini-goals help: one clean ID shot, one behavior note, one habitat note, and one collection entry per stop.",
                    "This keeps everyone engaged while turning each location into useful discovery data."
                ],
                speciesSlugs: ["bald-eagle", "maine-coon-cat"]
            }
        ],
        faq: [
            {
                question: "Can beginners still use this Bali spotting approach?",
                answer: "Yes. A habitat-first plan works for beginners and helps avoid random guessing even before you know many species names."
            },
            {
                question: "Do zoo and sanctuary visits still help with wild spotting goals?",
                answer: "Yes. Controlled environments can build recognition basics that improve confidence when you later spot animals in less predictable wild settings."
            }
        ]
    },
    {
        slug: "real-life-pokemon-animals-you-can-collect-in-the-wild",
        title: "20 Real-life Pokémon: animals you can collect in the wild",
        description: "A cross-generation guide to 20 Pokémon inspired by real animals, from Generation I through Generation IX, and how that collecting instinct maps onto wildlife discovery.",
        publishedAt: "2026-04-09",
        updatedAt: "2026-04-09",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/wild-animal-game-like-pokemon-in-real-life.webp",
            alt: "Wild animal collection image for a real-life Pokemon-style discovery article on AnimalDex",
            width: 3024,
            height: 4032,
            caption: "The creature-collection instinct gets more interesting when the animals are real and the habitats actually matter."
        },
        readingMinutes: 9,
        tags: ["Animal collection game", "Species collecting", "Pokemon-like animal app", "Real-life Pokemon"],
        searchIntents: ["Pokemon-like animal app", "animal collection app", "collect real animals app", "species collecting game", "real life pokemon animals"],
        speciesSlugs: ["african-wild-dog", "komodo-dragon", "white-headed-vulture"],
        systemsSpeciesSlugs: ["african-wild-dog", "komodo-dragon"],
        sections: [
            {
                title: "Why real-animal collecting can feel as rewarding as fantasy collecting",
                paragraphs: [
                    "The same loop still works: discover, log, compare, and complete. What changes is the depth of context because each entry exists in a real habitat and ecosystem.",
                    "That added context gives your collection more story value and stronger memory retention.",
                    "As of April 11, 2026, the latest mainline Pokemon generation is Generation IX, so a useful cross-gen list should cover Generations I through IX rather than stopping at the older classics.",
                    "These pairings are design inferences, not official biological classifications. The point is to use familiar monster designs as a bridge into noticing real animals more carefully."
                ]
            },
            {
                kicker: "20 Pokemon inspired by real animals",
                title: "Generations I to III",
                paragraphs: [],
                cards: [
                    {
                        label: "Generation I",
                        body: "Pikachu tracks closely to a pika-like small mammal. The electrical gimmick is fantasy, but the compact rodent body plan is doing the design work.",
                        links: [{text: "pika", slug: "pika"}],
                        image: {
                            src: "https://static.wikia.nocookie.net/thepokemonshow/images/8/80/20101007155439%21Ash_Pikachu.png/revision/latest?cb=20140425213328",
                            alt: "Anime image of Pikachu used in the real-life Pokemon comparison list",
                            width: 899,
                            height: 580
                        }
                    },
                    {
                        label: "Generation I",
                        body: "Ekans is one of the cleanest examples in the series because it is essentially a snake with a direct naming joke layered on top.",
                        links: [{text: "snake", slug: "snake"}],
                        image: {
                            src: "https://static.wikia.nocookie.net/pokemon/images/e/e7/Goh_Ekans.png/revision/latest?cb=20200405113459",
                            alt: "Anime image of Ekans used in the real-life Pokemon comparison list",
                            width: 1920,
                            height: 1080
                        }
                    },
                    {
                        label: "Generation I",
                        body: "Magikarp clearly draws from carp, which is why it lands so well as a weak fish that later transforms into something far more dramatic.",
                        links: [{text: "carp", slug: "carp"}],
                        image: {
                            src: "https://static.wikia.nocookie.net/pokemon/images/e/e5/Goh_Magikarp.png/revision/latest/scale-to-width-down/1200?cb=20200622002446",
                            alt: "Anime image of Magikarp used in the real-life Pokemon comparison list",
                            width: 1200,
                            height: 675
                        }
                    },
                    {
                        label: "Generation II",
                        body: "Hoothoot reads as an owl first and a stylized clock-face mascot second, which makes it one of the easier bird inspirations to spot.",
                        links: [{text: "owl", slug: "owl"}],
                        image: {
                            src: "https://static0.thegamerimages.com/wordpress/wp-content/uploads/2020/05/hoothoot-anime-bulbapedia.png?q=50&fit=crop&w=800&dpr=1.5",
                            alt: "Anime image of Hoothoot used in the real-life Pokemon comparison list",
                            width: 800,
                            height: 450
                        }
                    },
                    {
                        label: "Generation II",
                        body: "Heracross is strongly based on a rhinoceros beetle, using the horn and armored insect profile as the core silhouette.",
                        links: [{text: "rhinoceros beetle", slug: "rhinoceros-beetle"}],
                        image: {
                            src: "https://static.wikia.nocookie.net/pokemon/images/2/20/Goh_Heracross.png/revision/latest?cb=20200816110158",
                            alt: "Anime image of Heracross used in the real-life Pokemon comparison list",
                            width: 1920,
                            height: 1080
                        }
                    },
                    {
                        label: "Generation III",
                        body: "Torchic is based on a chicken, making it a straightforward poultry-based starter with exaggerated warmth and attitude.",
                        links: [{text: "chicken", slug: "domestic-chicken"}],
                        image: {
                            src: "https://www.dexerto.com/cdn-image/wp-content/uploads/2025/02/06/Pokemon-Scarlet-and-Violet-.jpg?width=1200&quality=60&format=auto",
                            alt: "Image used for Torchic in the real-life Pokemon comparison list",
                            width: 1200,
                            height: 675
                        }
                    },
                    {
                        label: "Generation III",
                        body: "Sharpedo is built on a shark template, especially in its torpedo body, exposed teeth, and forward-attack design.",
                        links: [{text: "shark", slug: "shark"}],
                        image: {
                            src: "https://static.wikia.nocookie.net/international-pokedex/images/1/15/Sharpedo_%28Ash%29.png/revision/latest?cb=20180406183156",
                            alt: "Anime image of Sharpedo used in the real-life Pokemon comparison list",
                            width: 800,
                            height: 450
                        }
                    },
                    {
                        label: "Generation III",
                        body: "Spheal maps cleanly onto a seal pup, using round body shape and marine-mammal softness as its whole appeal.",
                        links: [{text: "seal", slug: "seal"}],
                        image: {
                            src: "https://static.wikia.nocookie.net/pokemon/images/7/74/Marius%27s_Spheal.png/revision/latest?cb=20240223073311",
                            alt: "Anime image of Spheal used in the real-life Pokemon comparison list",
                            width: 1440,
                            height: 1080
                        }
                    }
                ],
                speciesSlugs: ["white-headed-vulture", "african-wild-dog"]
            },
            {
                kicker: "20 Pokemon inspired by real animals",
                title: "Generations IV to VI",
                paragraphs: [],
                cards: [
                    {
                        label: "Generation IV",
                        body: "Piplup is based on a penguin chick, and the tuxedo-like coloring is what makes the animal connection immediate.",
                        links: [{text: "penguin", slug: "penguin"}],
                        image: {
                            src: "https://comicbook.com/wp-content/uploads/sites/4/2022/01/82298dd4-0790-49ae-939c-7e5fd7734288.jpg?w=1200",
                            alt: "Image of Piplup used in the real-life Pokemon comparison list",
                            width: 1200,
                            height: 628
                        }
                    },
                    {
                        label: "Generation IV",
                        body: "Buizel draws from otters and similar semi-aquatic mustelids, especially in the flotation-ring concept around its neck.",
                        links: [{text: "otters", slug: "otter"}],
                        image: {
                            src: "https://static.wikia.nocookie.net/pokemon/images/e/e2/Ash_Buizel.png/revision/latest?cb=20230114015139",
                            alt: "Anime image of Buizel used in the real-life Pokemon comparison list",
                            width: 1920,
                            height: 1080
                        }
                    },
                    {
                        label: "Generation V",
                        body: "Sandile is a crocodile, using the low-slung body, long snout, and ambush-predator profile as the base design.",
                        links: [{text: "crocodile", slug: "crocodile"}],
                        image: {
                            src: "https://www.pokemon.com/static-assets/content-assets/cms2/img/watch-pokemon-tv/seasons/season14/season14_ep03_ss02.jpg",
                            alt: "Pokemon TV image of Sandile used in the real-life Pokemon comparison list",
                            width: 578,
                            height: 327
                        }
                    },
                    {
                        label: "Generation V",
                        body: "Deerling is an easy deer read, with seasonal variants layered onto a familiar ungulate body plan.",
                        links: [{text: "deer", slug: "deer"}],
                        image: {
                            src: "https://www.pokemon.com/static-assets/content-assets/cms2/img/watch-pokemon-tv/seasons/season15/season15_ep06_ss03.jpg",
                            alt: "Pokemon TV image of Deerling used in the real-life Pokemon comparison list",
                            width: 578,
                            height: 327
                        }
                    },
                    {
                        label: "Generation VI",
                        body: "Fletchling works as a robin- or finch-like songbird design, built around a very recognizable small-bird silhouette.",
                        links: [
                            {text: "robin", slug: "robin"},
                            {text: "finch", slug: "finch"}
                        ],
                        image: {
                            src: "https://static.wikia.nocookie.net/thepokemonshow/images/4/42/Ash%27s_Fletchling.png/revision/latest?cb=20140520024341",
                            alt: "Anime image of Fletchling used in the real-life Pokemon comparison list",
                            width: 1280,
                            height: 720
                        }
                    },
                    {
                        label: "Generation VI",
                        body: "Helioptile borrows from lizards with frilled-neck visual cues, turning a reptile template into a solar-powered creature concept.",
                        links: [{text: "lizards", slug: "lizard"}],
                        image: {
                            src: "https://static.wikia.nocookie.net/pokemon/images/8/82/Alexa_Helioptile.png/revision/latest/scale-to-width-down/1200?cb=20150901045405",
                            alt: "Anime image of Helioptile used in the real-life Pokemon comparison list",
                            width: 1200,
                            height: 675
                        }
                    }
                ],
                speciesSlugs: ["komodo-dragon", "bald-eagle"]
            },
            {
                kicker: "20 Pokemon inspired by real animals",
                title: "Generations VII to IX",
                paragraphs: [],
                cards: [
                    {
                        label: "Generation VII",
                        body: "Rowlet is an owl, but the design softens it into a round-bodied forest bird with an instantly readable face.",
                        links: [{text: "owl", slug: "owl"}],
                        image: {
                            src: "https://static.wikia.nocookie.net/pokemon/images/3/3d/Ash_Rowlet.png/revision/latest?cb=20161124113130",
                            alt: "Anime image of Rowlet used in the real-life Pokemon comparison list",
                            width: 1920,
                            height: 1080
                        }
                    },
                    {
                        label: "Generation VII",
                        body: "Crabrawler has strong crab roots, especially the oversized claws and sideways, shell-backed body logic.",
                        links: [{text: "crab", slug: "crab"}],
                        image: {
                            src: "https://media.tenor.com/2s-HnUONo_gAAAAe/pokemon-crabrawler.png",
                            alt: "Image of Crabrawler used in the real-life Pokemon comparison list",
                            width: 640,
                            height: 358
                        }
                    },
                    {
                        label: "Generation VIII",
                        body: "Nickit is based on a fox, leaning into the narrow muzzle, sly expression, and tail-heavy silhouette.",
                        links: [{text: "fox", slug: "fox"}],
                        image: {
                            src: "https://static.wikia.nocookie.net/pokemon/images/9/98/Nickit_anime.png/revision/latest?cb=20191210162308",
                            alt: "Anime image of Nickit used in the real-life Pokemon comparison list",
                            width: 1920,
                            height: 1080
                        }
                    },
                    {
                        label: "Generation VIII",
                        body: "Cramorant is a cormorant-like diving bird, which is why its long beak and awkward waterbird posture feel so specific.",
                        links: [{text: "cormorant", slug: "cormorant"}],
                        image: {
                            src: "https://i.ytimg.com/vi/K0Lg4NmvCDc/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLBYz7qKAQ5HLAi4uxkWXVjg-zx8fw",
                            alt: "Image of Cramorant used in the real-life Pokemon comparison list",
                            width: 686,
                            height: 386
                        }
                    },
                    {
                        label: "Generation IX",
                        body: "Sprigatito is unmistakably a cat, using feline posture, face shape, and playful movement as the whole design anchor.",
                        links: [{text: "cat", slug: "cat"}],
                        image: {
                            src: "https://www.pokemon.com/static-assets/content-assets/cms2/img/watch-pokemon-tv/horizons/01/horizons_ep40_ss01.png",
                            alt: "Pokemon Horizons image of Sprigatito used in the real-life Pokemon comparison list",
                            width: 578,
                            height: 327
                        }
                    },
                    {
                        label: "Generation IX",
                        body: "Nymble is built on a grasshopper-like insect body, showing that even the latest generation still pulls heavily from real-animal structure.",
                        links: [{text: "grasshopper", slug: "grasshopper"}],
                        image: {
                            src: "https://static.wikia.nocookie.net/pokemon-journeys-my-fanon/images/1/10/Ash%27s_Nymble.jpg/revision/latest?cb=20240629091346",
                            alt: "Image of Nymble used in the real-life Pokemon comparison list",
                            width: 680,
                            height: 383
                        }
                    }
                ]
            },
            {
                title: "Why this matters for real wildlife collecting",
                paragraphs: [
                    "A strong collection app should reward users with both progression and knowledge. If you complete sets but still cannot identify key traits, the loop is incomplete.",
                    "The useful crossover is attention. If Pokémon helped you care about silhouette, rarity, region, type, or evolution, those same instincts can help you notice body shape, habitat, behavior, and ecological role in real animals.",
                    "AnimalDex is designed so card progress and species understanding grow together."
                ],
                speciesSlugs: ["komodo-dragon", "bald-eagle"]
            }
        ],
        faq: [
            {
                question: "Is AnimalDex trying to copy Pokemon directly?",
                answer: "No. The collection energy is similar, but AnimalDex is grounded in real species, real sightings, and practical animal learning."
            },
            {
                question: "Can collecting still be meaningful if I am not competitive?",
                answer: "Yes. You can focus on personal discovery, set completion, and better species recognition without using battle or trading loops."
            }
        ]
    },
    {
        slug: "what-makes-an-animal-rare",
        title: "What makes an animal rare?",
        description: "A practical explanation of rarity drivers in wildlife: range limits, population pressure, habitat fragmentation, breeding constraints, and human impact.",
        publishedAt: "2026-04-09",
        updatedAt: "2026-04-09",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/animaldex-rarity-of-ostrich-shot.webp",
            alt: "AnimalDex featured image for the article explaining what makes an animal rare",
            width: 1200,
            height: 675,
            caption: "Featured image source: AnimalDex CDN."
        },
        readingMinutes: 7,
        author: "AnimalDex Research Notes",
        tags: ["Animal rarity", "Conservation learning", "Species discovery"],
        searchIntents: ["what makes an animal rare", "animal rarity explained", "animal grading app", "wildlife learning app"],
        speciesSlugs: ["white-headed-vulture", "african-wild-dog", "komodo-dragon"],
        systemsSpeciesSlugs: ["white-headed-vulture", "african-wild-dog"],
        sections: [
            {
                title: "Rarity is usually about constraints, not popularity",
                paragraphs: [
                    "In wildlife contexts, rarity often comes from ecological constraints: narrow range, low population size, slow reproduction, or unstable habitat conditions.",
                    "It is less about how famous a species is and more about how resilient its population is under real pressure."
                ]
            },
            {
                title: "Range fragmentation is a major factor",
                paragraphs: [
                    "Species spread across disconnected pockets are often harder to maintain than species with continuous healthy ranges.",
                    "Fragmentation affects feeding, breeding, migration, and resilience to local shocks."
                ],
                speciesSlugs: ["african-wild-dog", "white-headed-vulture"]
            },
            {
                title: "How this helps in an app context",
                paragraphs: [
                    "Rarity signals can make collection more engaging, but they should also teach users why rarity exists.",
                    "When rarity is linked to habitat and behavior context, users get both game value and conservation awareness."
                ],
                speciesSlugs: ["komodo-dragon"]
            }
        ],
        faq: [
            {
                question: "Does rare always mean endangered?",
                answer: "Not always. Rarity and conservation status are related but different; rarity can come from limited range, low density, or fragmented habitat."
            },
            {
                question: "Can an animal be common globally but rare in my area?",
                answer: "Yes. Local habitat conditions and geography can make a species uncommon in one region even if it is more common elsewhere."
            }
        ]
    },
    {
        slug: "zoo-vs-wild-animals-whats-the-difference",
        title: "Zoo vs wild animals: what’s the difference?",
        description: "A practical guide to understanding how zoo and wild contexts differ for behavior, spotting expectations, learning, and respectful observation.",
        publishedAt: "2026-04-09",
        updatedAt: "2026-04-09",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/animaldex-comparison-for-zoo-vs-wild.webp",
            alt: "AnimalDex featured image comparing zoo and wild animals for the observation guide",
            width: 1200,
            height: 675,
            caption: "Featured image source: AnimalDex CDN."
        },
        readingMinutes: 6,
        tags: ["Zoo animals", "Wild animals", "Family-friendly animal learning"],
        searchIntents: ["zoo vs wild animals difference", "zoo animal app", "wild animal learning app", "family-friendly animal learning app"],
        speciesSlugs: ["komodo-dragon", "bald-eagle", "african-wild-dog"],
        systemsSpeciesSlugs: ["bald-eagle", "african-wild-dog"],
        sections: [
            {
                title: "Observation conditions are fundamentally different",
                paragraphs: [
                    "Zoo settings offer higher visibility and controlled proximity, while wild settings demand patience, distance, and uncertainty tolerance.",
                    "Neither is automatically better. They are different learning environments with different strengths."
                ]
            },
            {
                title: "Behavior interpretation needs context",
                paragraphs: [
                    "In managed environments, behavior may reflect enclosure design, enrichment cycles, and human presence. In the wild, behavior is shaped more directly by ecological pressures.",
                    "Understanding that context makes your notes and IDs more accurate."
                ],
                speciesSlugs: ["komodo-dragon", "african-wild-dog"]
            },
            {
                title: "Use both contexts to build better animal literacy",
                paragraphs: [
                    "Zoo encounters can help beginners learn visual traits; wild encounters test recognition under real conditions.",
                    "When you log both in one collection system, your field awareness improves faster."
                ],
                speciesSlugs: ["bald-eagle", "white-headed-vulture"]
            }
        ],
        faq: [
            {
                question: "Do zoo observations still count for learning?",
                answer: "Yes. Zoo contexts can help beginners learn visual traits and baseline behavior cues before applying them in wild settings."
            },
            {
                question: "How can families use both zoo and wild experiences well?",
                answer: "Use a shared checklist: one clear ID clue, one behavior note, and one habitat note per sighting across both contexts."
            }
        ]
    },
    createAnimalSystemsPost({
        speciesSlug: "crow",
        slug: "what-makes-crows-so-intelligent",
        title: "What Makes Crows So Intelligent? Systems, Behavior, and Survival Strategy",
        description: "Learn what makes crows so intelligent, from memory and tool use to adaptive behavior, survival strategy, and their ecosystem role in changing environments.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/intelligent-crow-holding-ring.webp",
            alt: "Intelligent crow holding a ring, illustrating tool use, memory, and adaptive crow behavior for AnimalDex",
            width: 1200,
            height: 675,
            caption: "A crow holding a ring captures the mix of object curiosity, memory, and experimentation that makes crow intelligence so effective."
        },
        readingMinutes: 7,
        tags: ["Crow intelligence", "Animal behavior", "Tool use", "Ecosystem role"],
        searchIntents: ["crow intelligence", "crow animal behavior", "what makes crows intelligent", "crow ecosystem role", "why are crows so intelligent"],
        sections: [
            {
                title: "Why crows keep showing up in animal intelligence conversations",
                paragraphs: [
                    "Crows matter because they keep solving problems in public. They remember faces, test objects, exploit traffic, and adjust quickly when the environment changes.",
                    "That makes them useful for more than curiosity. If you want to understand animal intelligence in a real-world, messy-environment context, crows are one of the strongest case studies available."
                ]
            },
            {
                title: "What makes a crow unique?",
                paragraphs: [
                    "A crow is not the fastest flier, strongest predator, or most specialized for one niche. Its edge comes from flexible cognition, strong visual memory, and social learning that lets one bird benefit from what another bird already discovered.",
                    "That combination turns ordinary urban and rural environments into a constant stream of testable inputs. Crows do not need a perfect system. They are good at finding the leverage hidden inside an imperfect one."
                ]
            },
            {
                title: "How crows survive in changing environments",
                paragraphs: [
                    "Crow survival strategy is built on behavioral range. They scavenge, hunt, cache food, observe threats, and revise routines quickly when humans or predators change the rules.",
                    "In animal behavior terms, that means crows treat uncertainty as data rather than paralysis. They are rarely the cleanest system in the landscape, but they are often the fastest to adapt when the landscape gets weird."
                ]
            },
            {
                title: "The ecosystem role of a crow",
                paragraphs: [
                    "Crows sit in a useful middle layer of the environmental operating system. They remove waste, prey on smaller animals, move seeds, and respond quickly to disturbance across urban edges, farmland, woodland, and coastline.",
                    "That ecosystem role is why they matter beyond intelligence headlines. A crow is not just clever; it is functional hardware for volatile, human-influenced habitats."
                ]
            },
            {
                title: "What humans can learn from crows",
                paragraphs: [
                    "Crows show that adaptable systems do not wait for perfect clarity. They observe, test, remember, and circulate useful signal through the group.",
                    "That is the durable lesson. Intelligence is not just raw processing power. It is the ability to keep updating the model while the world keeps moving."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/why-crows-matter-infographic.png",
                        alt: "Why crows matter infographic summarizing crow intelligence, adaptive behavior, survival strategy, and ecosystem role",
                        width: 1024,
                        height: 1536,
                        caption: "Infographic summary: why crows matter as adaptive, socially intelligent animals in human-shaped environments."
                    }
                }
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "octopus",
        slug: "how-octopus-intelligence-works",
        title: "How Octopus Intelligence Works: Nature’s Most Advanced Problem Solver",
        description: "Explore octopus intelligence through animal behavior, flexible nervous systems, camouflage, survival strategy, and the octopus ecosystem role.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/octopus-in-blue-ocean.jpg",
            alt: "Octopus in blue ocean water, illustrating octopus intelligence, camouflage, and marine survival strategy for AnimalDex",
            width: 1500,
            height: 843,
            caption: "An octopus in open blue water captures the flexibility, perception, and camouflage-driven survival strategy that make the species so distinctive."
        },
        readingMinutes: 8,
        tags: ["Octopus intelligence", "Marine biology", "Animal behavior"],
        searchIntents: ["octopus intelligence", "how octopus survives", "octopus animal behavior", "octopus ecosystem role"],
        sections: [
            {
                title: "Why the octopus feels so different from most animals",
                paragraphs: [
                    "The octopus stands out because it does not look or behave like a standard vertebrate success story. It solves problems with a soft body, decentralized sensing, and rapid physical adaptation instead of armor, speed, or social backup.",
                    "That makes it one of the cleanest examples of how animal intelligence can emerge from an entirely different hardware stack."
                ]
            },
            {
                title: "What makes an octopus unique?",
                paragraphs: [
                    "An octopus combines a distributed nervous system, arms that sense while they move, and camouflage that can rewrite its visible identity in seconds. It is less like a single rigid machine and more like a networked set of local processors.",
                    "That design gives the animal unusual freedom. It can inspect, manipulate, hide, and escape without funneling every problem through one slow central pipeline."
                ]
            },
            {
                title: "How octopus survival strategy actually works",
                paragraphs: [
                    "Octopus survival is built around option density. If one tactic fails, it can switch shape, texture, coloration, route, or shelter almost immediately.",
                    "In animal behavior terms, that makes it hard to predict and hard to trap. The octopus does not depend on one dominant response. It survives by keeping several viable responses live at once."
                ]
            },
            {
                title: "The ecosystem role of an octopus",
                paragraphs: [
                    "Octopuses regulate crustaceans, mollusks, and other benthic prey while also serving as prey for larger marine hunters. Their ecosystem role sits inside the reef and seafloor control layer, where pressure on one level quickly affects the next.",
                    "Because they exploit crevices and tight spaces other predators cannot use efficiently, they also help define which niches stay crowded and which stay open."
                ]
            },
            {
                title: "What humans can learn from octopus intelligence",
                paragraphs: [
                    "The octopus is a reminder that smart systems do not always look centralized or symmetrical. Sometimes performance comes from placing sensing and decision-making closer to the point of action.",
                    "That is why the octopus keeps showing up in biomimicry and systems design conversations. Flexibility is not a luxury feature. In unstable environments, it is the survival engine."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/the-intelligence-of-an-octopus-infographic%20(1).png",
                        alt: "The intelligence of an octopus infographic summarizing octopus cognition, camouflage, distributed sensing, and survival strategy",
                        width: 1536,
                        height: 1024,
                        caption: "Infographic summary: the octopus combines distributed sensing, flexible movement, and rapid adaptation into a distinctive intelligence system."
                    }
                }
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "mantis-shrimp",
        slug: "mantis-shrimp-superpower-vision-and-strike",
        title: "Mantis Shrimp Vision and Strike Power: How This Animal Sees and Hits So Fast",
        description: "See how mantis shrimp combine extreme animal vision, explosive strike mechanics, reef survival strategy, and a powerful ecosystem role.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/mantis-shrimp-close-up.png",
            alt: "Close-up of a mantis shrimp illustrating extreme vision, strike mechanics, and reef survival strategy for AnimalDex",
            width: 1536,
            height: 1024,
            caption: "A mantis shrimp close-up captures the sensory precision and stored-power strike system that make the animal so distinctive."
        },
        readingMinutes: 7,
        tags: ["Mantis shrimp", "Animal vision", "Reef behavior"],
        searchIntents: ["mantis shrimp vision", "mantis shrimp strike", "mantis shrimp animal behavior", "how mantis shrimp survives"],
        sections: [
            {
                title: "Why mantis shrimp keep breaking people’s mental models",
                paragraphs: [
                    "Mantis shrimp are compelling because the same animal carries two extreme systems at once: unusually advanced visual processing and a strike mechanism built for brutal speed.",
                    "That pairing makes them more than a fun marine biology fact. They are a serious example of how sensing and force production can be co-designed for one job."
                ]
            },
            {
                title: "What makes a mantis shrimp unique?",
                paragraphs: [
                    "The eyes are famous for good reason. Mantis shrimp detect polarized and complex light in ways most animals do not, which gives them a different read on their environment and on each other.",
                    "Then there is the strike hardware: spring-loaded appendages that store energy before releasing it almost instantly. They do not just hit hard. They hit through smart mechanical staging."
                ]
            },
            {
                title: "How mantis shrimp survive on a crowded reef",
                paragraphs: [
                    "Reef survival punishes hesitation. A mantis shrimp survives by sensing fast, defending a tight burrow, and ending certain interactions before they turn into prolonged contests.",
                    "That is why its animal behavior feels so compact and decisive. It is not built to drift through the reef casually. It is built to read the signal and convert it into a short, violent answer."
                ]
            },
            {
                title: "The ecosystem role of a mantis shrimp",
                paragraphs: [
                    "Mantis shrimp pressure shelled prey, crustaceans, and small reef organisms while also contributing to reef competition around burrows and hiding space.",
                    "Their ecosystem role matters because they force local armor races. Shells, defenses, and hiding strategies are not abstract traits; they are responses to real mechanical pressure."
                ]
            },
            {
                title: "What humans can learn from mantis shrimp design",
                paragraphs: [
                    "The mantis shrimp shows that output quality often depends on what happens before the visible action. Load the spring, align the signal, and let structure do the hard work.",
                    "That is a useful systems lesson. Fast results usually come from smart preparation, not frantic improvisation."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/mantis-shrimp-infographic.png",
                        alt: "Mantis shrimp infographic summarizing vision, strike power, reef behavior, and ecosystem role",
                        width: 1536,
                        height: 1024,
                        caption: "Infographic summary: mantis shrimp combine unusual visual processing with explosive strike mechanics to control tight reef interactions."
                    }
                }
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "honey-bee",
        slug: "how-honey-bees-keep-ecosystems-running",
        title: "How Honey Bees Keep Ecosystems Running: Pollination, Behavior, and Survival Strategy",
        description: "Understand honey bee behavior, pollination logistics, colony intelligence, ecosystem role, and how honey bees survive as one of nature’s most important networks.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/honey-bees.png",
            alt: "Honey bees on flowers illustrating pollination behavior, colony coordination, and ecosystem role for AnimalDex",
            width: 1536,
            height: 1024,
            caption: "Honey bees in action show how pollination, movement, and colony coordination keep plant reproduction and food systems moving."
        },
        readingMinutes: 7,
        tags: ["Honey bee", "Pollination", "Animal behavior"],
        searchIntents: ["honey bee behavior", "honey bee ecosystem role", "how honey bees survive", "honey bee intelligence"],
        sections: [
            {
                title: "Why honey bees matter beyond honey",
                paragraphs: [
                    "Honey bees matter because they sit at the intersection of animal behavior, plant reproduction, and food systems. They are easy to romanticize, but the more useful view is operational: they are logistics hardware for pollen and plant success.",
                    "That makes them one of the clearest examples of a species whose ecosystem role spills directly into human agriculture and landscape stability."
                ]
            },
            {
                title: "What makes a honey bee unique?",
                paragraphs: [
                    "A honey bee is not powerful as an individual unit. Its edge comes from sensory precision, electrostatic pollen capture, ultraviolet vision, and communication that turns one food discovery into a colony-wide route update.",
                    "The waggle dance matters here because it converts private knowledge into shared movement. That is rare, efficient, and very easy to underestimate."
                ]
            },
            {
                title: "How honey bees survive as a colony system",
                paragraphs: [
                    "Honey bee survival is collective. Workers, drones, brood, and queen are not interchangeable parts; they are specialized roles inside one living operational stack.",
                    "That changes how we should read bee behavior. A bee foraging, cooling the hive, guarding an entrance, or feeding larvae is not performing random busyness. It is keeping the larger system from degrading."
                ]
            },
            {
                title: "The ecosystem role of honey bees",
                paragraphs: [
                    "Honey bees help move pollen between flowering plants, which supports seed set, fruit production, and downstream food-web stability. Their ecosystem role is especially visible where plant density and agricultural yield depend on consistent pollination.",
                    "They are not the only pollinators and should not be mistaken for the whole pollination story, but they are a major part of the reproductive logistics layer that keeps landscapes productive."
                ]
            },
            {
                title: "What humans can learn from honey bee systems",
                paragraphs: [
                    "Honey bees show the advantage of routing useful signal quickly. When a worker finds a strong resource patch, the colony benefits because the information does not stay trapped in one body.",
                    "That is the practical lesson: high-performing systems scale when discovery, location, and quality data move faster than ego."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/honey-bees-educational-infographic.png",
                        alt: "Honey bees educational infographic summarizing pollination, colony behavior, survival strategy, and ecosystem role",
                        width: 1536,
                        height: 1024,
                        caption: "Infographic summary: honey bees keep ecosystems productive through pollination logistics, colony coordination, and shared behavioral roles."
                    }
                }
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "wolf",
        slug: "how-wolves-hunt-survive-and-shape-ecosystems",
        title: "How Wolves Hunt, Survive, and Shape Ecosystems",
        description: "A clear guide to wolf behavior, pack intelligence, survival strategy, and ecosystem role, with a systems view of how wolves reshape landscapes.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/wolves-close-up-wildlife.webp",
            alt: "Close-up of wolves in the wild illustrating pack coordination, survival strategy, and ecosystem influence for AnimalDex",
            width: 1200,
            height: 801,
            caption: "A close-up wolf image captures the coordination, vigilance, and pack-level intelligence that make wolves such influential predators."
        },
        readingMinutes: 8,
        tags: ["Wolf behavior", "Predator ecology", "Animal intelligence"],
        searchIntents: ["wolf behavior", "how wolves survive", "wolf ecosystem role", "wolf pack intelligence"],
        sections: [
            {
                title: "Why wolves attract so much attention",
                paragraphs: [
                    "Wolves matter because they are one of the clearest examples of how animal behavior scales from individual action to landscape-level impact. A pack is not just a social group. It is a moving decision system.",
                    "That is why wolf discussions keep returning to intelligence, coordination, and ecosystem role. Few predators make those connections so visible."
                ]
            },
            {
                title: "What makes a wolf unique?",
                paragraphs: [
                    "A wolf combines endurance movement, long-range scenting, social communication, and role-based hunting behavior without needing the rigid specialization of social insects.",
                    "That balance matters. Wolves are coordinated, but they remain flexible enough to hunt different prey, move across huge territory, and adjust to changing conditions."
                ]
            },
            {
                title: "How wolves survive and hunt",
                paragraphs: [
                    "Wolf survival is built on cooperation, patience, and attrition. They test prey, read weakness, and let distance and pressure do part of the work before the final commitment.",
                    "In animal behavior terms, that means wolves often win by making the prey system spend more energy than it wanted to spend. The hunt is not just force. It is managed fatigue."
                ]
            },
            {
                title: "The ecosystem role of wolves",
                paragraphs: [
                    "Wolves shape herbivore movement, browsing pressure, and risk distribution across forests, valleys, and river corridors. Their ecosystem role is partly about what they kill and partly about what they make other animals stop doing so casually.",
                    "That is why wolves can influence vegetation and habitat recovery without needing to erase prey populations. They alter behavior, and behavior changes landscapes."
                ]
            },
            {
                title: "What humans can learn from wolf systems",
                paragraphs: [
                    "Wolves are a good reminder that disciplined coordination beats isolated brilliance over time. Clear roles, good signaling, and patient pressure can outperform raw intensity.",
                    "The deeper lesson is strategic: some systems win by staying synchronized long enough for the terrain itself to start helping."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/wolves-educational-infographic.png",
                        alt: "Wolves educational infographic summarizing pack hunting, survival strategy, and ecosystem role",
                        width: 1536,
                        height: 1024,
                        caption: "Infographic summary: wolves shape ecosystems through pack coordination, prey pressure, and landscape-level behavior effects."
                    }
                }
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "barn-owl",
        slug: "how-barn-owls-hunt-in-the-dark",
        title: "How Barn Owls Hunt in the Dark: Sound, Silence, and Survival Strategy",
        description: "Learn how barn owl behavior, hearing, silent flight, and ecosystem role make this nocturnal predator one of nature’s sharpest intercept systems.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/owl-hunting-in-the-dark.webp",
            alt: "Barn owl hunting in the dark, illustrating silent flight, hearing, and nocturnal survival strategy for AnimalDex",
            width: 1400,
            height: 788,
            caption: "A barn owl hunting at night captures the quiet precision, hearing, and silent flight that make darkness usable."
        },
        readingMinutes: 6,
        tags: ["Barn owl", "Animal behavior", "Nocturnal predators"],
        searchIntents: ["barn owl behavior", "how barn owls hunt", "barn owl ecosystem role", "barn owl survival strategy"],
        sections: [
            {
                title: "Why the barn owl feels almost engineered for night work",
                paragraphs: [
                    "Barn owls stand out because their animal behavior is built around low-light efficiency rather than visual dominance. They hunt in spaces where most animals become less certain and less precise.",
                    "That makes them useful for understanding how survival strategy changes when the environment becomes acoustically rich and visually poor."
                ]
            },
            {
                title: "What makes a barn owl unique?",
                paragraphs: [
                    "The barn owl’s facial disc is not decorative. It functions as acoustic hardware that funnels sound toward asymmetrical ears capable of three-dimensional prey localization.",
                    "Add silent flight feathers and the result is unusually clean interception. The owl hears movement, approaches without announcing itself, and closes the gap before the prey has much time to revise its plan."
                ]
            },
            {
                title: "How barn owls survive",
                paragraphs: [
                    "Barn owl survival depends on converting darkness into confidence. They patrol grassland, field margins, and open country where small mammals create audio clues that are more reliable than quick visual snapshots.",
                    "That means the owl’s hunting success comes from patient sensing and efficient execution rather than frantic searching."
                ]
            },
            {
                title: "The ecosystem role of a barn owl",
                paragraphs: [
                    "Barn owls help regulate rodent populations across agricultural and semi-open habitats. Their ecosystem role matters because they remove persistent prey pressure without needing the heavy, visible footprint of larger predators.",
                    "They are a reminder that quiet predators can do significant structural work in a system without looking dramatic while they do it."
                ]
            },
            {
                title: "What humans can learn from barn owls",
                paragraphs: [
                    "The barn owl teaches the value of reducing your own noise. Quiet systems perceive more, and perception quality often matters more than motion volume.",
                    "That is the practical insight: if you improve signal capture and lower operational noise, the right move becomes easier to see."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/hunting-owl-educational-infographic.png",
                        alt: "Barn owl educational infographic summarizing silent flight, hearing, hunting behavior, and ecosystem role",
                        width: 1536,
                        height: 1024,
                        caption: "Infographic summary: barn owls hunt by pairing low-noise flight with precise sound localization in low-light environments."
                    }
                }
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "jumping-spider",
        slug: "why-jumping-spiders-are-so-precise",
        title: "Why Jumping Spiders Are So Precise: Vision, Behavior, and Survival Strategy",
        description: "See how jumping spider behavior, animal vision, hunting precision, and ecosystem role make this tiny predator unusually intelligent and effective.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/jumping-spider-birds-eye-view.jpg",
            alt: "Jumping spider viewed from above, illustrating precision vision, targeting behavior, and survival strategy for AnimalDex",
            width: 1000,
            height: 667,
            caption: "A jumping spider from above captures the visual focus and movement precision that make this tiny hunter so effective."
        },
        readingMinutes: 6,
        tags: ["Jumping spider", "Animal behavior", "Predator strategy"],
        searchIntents: ["jumping spider behavior", "jumping spider intelligence", "how jumping spiders survive", "jumping spider ecosystem role"],
        sections: [
            {
                title: "Why jumping spiders feel smarter than their size suggests",
                paragraphs: [
                    "Jumping spiders are compelling because they act less like passive web-builders and more like compact visual hunters making deliberate targeting choices.",
                    "That changes the whole emotional read of the animal. Even people who normally ignore spiders notice that a jumping spider seems to look back, calculate, and commit."
                ]
            },
            {
                title: "What makes a jumping spider unique?",
                paragraphs: [
                    "Large forward-facing eyes give jumping spiders unusually good depth judgment for their size, and that visual quality matters because they hunt without depending on a trap web to do the hard part.",
                    "They also convert hydraulic force into fast, accurate jumps. So the system is not only about seeing well. It is about seeing well enough to make movement precise."
                ]
            },
            {
                title: "How jumping spiders survive",
                paragraphs: [
                    "Jumping spider survival strategy depends on reading distance, angle, and motion correctly before the leap. Miss too often and the energy budget gets ugly fast.",
                    "That is why their animal behavior feels measured rather than reckless. They pause, track, adjust, and then launch when the geometry starts favoring them."
                ]
            },
            {
                title: "The ecosystem role of a jumping spider",
                paragraphs: [
                    "Jumping spiders regulate insects across bark, leaves, walls, and understory surfaces. Their ecosystem role is local but constant, especially in places where many tiny interactions add up to meaningful pressure.",
                    "They also show that effective predator control does not require large size. Sometimes it requires better targeting at the right scale."
                ]
            },
            {
                title: "What humans can learn from jumping spiders",
                paragraphs: [
                    "A jumping spider is a good lesson in precision over drama. Better depth perception, better timing, and cleaner commitment beat random volume.",
                    "In systems terms, the point is simple: if you improve targeting enough, you often need less force than you thought."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/why-jumping-spiders-are-so-precise.png",
                        alt: "Jumping spider infographic summarizing vision, hunting precision, behavior, and ecosystem role",
                        width: 1536,
                        height: 1024,
                        caption: "Infographic summary: jumping spiders pair sharp visual targeting with measured movement to hunt efficiently at small scale."
                    }
                }
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "elephant",
        slug: "why-elephants-never-stop-reshaping-landscapes",
        title: "Why Elephants Never Stop Reshaping Landscapes",
        description: "Explore elephant behavior, memory, survival strategy, ecosystem role, and the systems biology behind how elephants reshape habitats over time.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/african-elephant-in-the-wild-credit-elie-wolf.jpg",
            alt: "African elephant in the wild illustrating habitat engineering, memory, and ecosystem role for AnimalDex",
            width: 2048,
            height: 1536,
            caption: "An elephant in the wild shows how memory, movement, and sheer physical presence reshape landscapes over time."
        },
        readingMinutes: 8,
        tags: ["Elephant behavior", "Ecosystem role", "Animal intelligence"],
        searchIntents: ["elephant behavior", "elephant ecosystem role", "how elephants survive", "elephant intelligence"],
        sections: [
            {
                title: "Why elephants matter at system scale",
                paragraphs: [
                    "Elephants matter because they operate above the scale of a single feeding event or single trail. When an elephant moves, digs, strips bark, opens a path, or remembers a water route, the surrounding habitat changes with it.",
                    "That makes elephants one of the clearest examples of animal behavior translating into environmental infrastructure."
                ]
            },
            {
                title: "What makes an elephant unique?",
                paragraphs: [
                    "The trunk alone is extraordinary hardware: tool, sensor, manipulator, drink tube, feeding arm, and social signal interface in one structure. Pair that with long-term memory and low-frequency communication, and the result is far more than raw size.",
                    "Elephants are powerful because they combine force with information. They do not just occupy space; they read and reuse it."
                ]
            },
            {
                title: "How elephants survive across difficult terrain",
                paragraphs: [
                    "Elephant survival depends on route memory, group knowledge, and the ability to keep finding food and water across large, seasonally unstable ranges.",
                    "In that sense, their animal behavior is logistics-heavy. The herd survives because it remembers where the system still works when conditions get thin."
                ]
            },
            {
                title: "The ecosystem role of elephants",
                paragraphs: [
                    "Elephants disperse seeds, open vegetation, create paths, modify woodland structure, and expose water sources that smaller species later use. Their ecosystem role is therefore both biological and architectural.",
                    "They do not just live in a habitat. They help determine which habitats stay closed, which become accessible, and which resources remain reachable under stress."
                ]
            },
            {
                title: "What humans can learn from elephants",
                paragraphs: [
                    "Elephants show that scale only becomes durable when it is paired with memory. Big systems fail quickly when they forget where the bottlenecks and fallback routes are.",
                    "That is the practical lesson: store useful route knowledge, not just abstract data, because resilience often depends on remembering where survival still works."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/the-ecosystem-role-of-an-elephant-infographic.png",
                        alt: "Elephant infographic summarizing landscape engineering, movement, survival strategy, and ecosystem role",
                        width: 1536,
                        height: 1024,
                        caption: "Infographic summary: elephants reshape ecosystems through movement, seed dispersal, vegetation change, and remembered routes to resources."
                    }
                }
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "tiger",
        slug: "how-tigers-survive-as-solo-apex-hunters",
        title: "How Tigers Survive as Solo Apex Hunters",
        description: "A systems look at tiger behavior, survival strategy, ecosystem role, and why this solitary predator remains one of the most effective hunters in the wild.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/bengal-tiger-close-up.webp",
            alt: "Close-up of a Bengal tiger illustrating stealth, focus, and solo apex hunting strategy for AnimalDex",
            width: 800,
            height: 519,
            caption: "A Bengal tiger close-up captures the restraint, sensory focus, and decisive commitment behind solo apex hunting."
        },
        readingMinutes: 7,
        tags: ["Tiger behavior", "Apex predator", "Animal survival"],
        searchIntents: ["tiger behavior", "how tigers survive", "tiger ecosystem role", "tiger hunting strategy"],
        sections: [
            {
                title: "Why the tiger remains such a powerful animal story",
                paragraphs: [
                    "Tigers keep attracting attention because they combine visual power with operational restraint. They are not noisy social predators. They are solitary systems that still manage to dominate high-value territory.",
                    "That makes them useful for understanding how ambush, camouflage, and energy discipline can outperform constant activity."
                ]
            },
            {
                title: "What makes a tiger unique?",
                paragraphs: [
                    "A tiger blends striped camouflage, strong night vision, padded feet, and explosive forelimb force into one close-range hunting package. The body is built for concealment and violent resolution, not for long public chases.",
                    "That matters because the tiger’s edge is timing. It narrows the gap between hidden presence and decisive contact."
                ]
            },
            {
                title: "How to tell the difference between different tigers",
                paragraphs: [
                    "The safest way to compare tiger types is to look at body build, stripe density, coat tone, and context together rather than forcing one trait to do all the work. Bengal tigers usually look larger and heavier through the chest and shoulders, with a rich orange coat and strong black striping across a broad frame.",
                    "Sumatran tigers usually read smaller, tighter, and more densely striped, often with a darker coat and a more compact build that fits dense forest conditions. If you compare Bengal tigers vs Sumatran tigers at a glance, Bengal tigers often feel broader and more open-patterned, while Sumatran tigers tend to look narrower, darker, and more tightly marked.",
                    "Those are useful visual rules, but they are not perfect on their own. Age, sex, lighting, posture, and individual variation can blur the differences, so the most reliable comparison is pattern plus proportions plus where the tiger originates."
                ],
                inlineLinks: [
                    {text: "Bengal tigers", slug: "bengal-tiger"},
                    {text: "Sumatran tigers", slug: "sumatran-tiger"}
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/types-of-tigers-how-to-tell-the-difference.jpg",
                        alt: "Comparison image showing how to tell the difference between tiger types, including Bengal and Sumatran tigers",
                        width: 900,
                        height: 1310,
                        caption: "Tiger comparison visual: build, stripe density, coat tone, and habitat context help separate Bengal and Sumatran tigers."
                    }
                }
            },
            {
                title: "How tigers survive without pack support",
                paragraphs: [
                    "Tiger survival depends on territory quality, stealth, and careful energy budgeting. Every failed hunt is expensive, so the animal benefits from selecting situations where surprise is already doing part of the work.",
                    "This is why tiger animal behavior looks patient rather than busy. The tiger does not need constant motion to stay dangerous."
                ]
            },
            {
                title: "The ecosystem role of a tiger",
                paragraphs: [
                    "Tigers regulate herbivores and other prey across forests, floodplains, and grasslands. Their ecosystem role is not just about the prey they kill, but also the caution they inject into prey movement patterns.",
                    "That risk pressure changes where animals feed, how long they stay exposed, and how vegetation recovers in response."
                ]
            },
            {
                title: "What humans can learn from tiger strategy",
                paragraphs: [
                    "The tiger is a case study in high-value commitment. It holds energy until position and surprise make the move worth making.",
                    "That is the lesson. Activity is not the same as progress, and some systems win precisely because they stop doing low-leverage work."
                ]
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "orangutan",
        slug: "how-orangutans-think-and-survive-in-the-canopy",
        title: "How Orangutans Think and Survive in the Canopy",
        description: "Discover orangutan intelligence, canopy behavior, survival strategy, and ecosystem role through a systems view of one of the forest’s best problem solvers.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/photography-orangutan.jpg",
            alt: "Orangutan in the forest canopy illustrating intelligence, reach, and arboreal survival strategy for AnimalDex",
            width: 1600,
            height: 1067,
            caption: "An orangutan in the canopy captures the patience, reach, and forest memory that support survival in complex arboreal habitats."
        },
        readingMinutes: 8,
        tags: ["Orangutan intelligence", "Canopy behavior", "Ecosystem role"],
        searchIntents: ["orangutan intelligence", "orangutan behavior", "how orangutans survive", "orangutan ecosystem role"],
        sections: [
            {
                title: "Why orangutans matter in conversations about animal intelligence",
                paragraphs: [
                    "Orangutans matter because their intelligence is not theatrical. It is patient, spatial, and deeply tied to the realities of moving and feeding in a three-dimensional forest.",
                    "That makes them a stronger systems-biology story than the usual simplified narratives about being smart in a human-like way."
                ]
            },
            {
                title: "What makes an orangutan unique?",
                paragraphs: [
                    "Long arms, strong hands and feet, slow development, and extensive learning time give orangutans a rare combination of mobility and cognitive refinement in the canopy.",
                    "They are not built for speed on the ground. They are built for solving arboreal problems in a habitat where one bad movement can be costly."
                ]
            },
            {
                title: "Types of orangutans",
                paragraphs: [
                    "There are three living orangutan species, and the most useful comparison is Bornean orangutan vs Sumatran orangutan vs Tapanuli orangutan. Bornean orangutans are generally heavier-built and more robust, while Sumatran orangutans often look slimmer, paler, and more lightly built through the face and body.",
                    "Tapanuli orangutans are the rarest and most geographically restricted. They are closely related to the Sumatran form but are recognized as their own species, with differences in skull shape, hair texture, vocalization patterns, and isolated range in the Batang Toru ecosystem.",
                    "If you are trying to tell them apart in photos, geography is still one of the best clues. Borneo points to Bornean orangutan, northern Sumatra usually points to Sumatran orangutan, and the Batang Toru region points to Tapanuli orangutan."
                ],
                inlineLinks: [
                    {text: "Bornean orangutan", slug: "bornean-orangutan"},
                    {text: "Bornean orangutans", slug: "bornean-orangutan"},
                    {text: "Sumatran orangutan", slug: "sumatran-orangutan"},
                    {text: "Sumatran orangutans", slug: "sumatran-orangutan"},
                    {text: "Tapanuli orangutan", slug: "tapanuli-orangutan"},
                    {text: "Tapanuli orangutans", slug: "tapanuli-orangutan"}
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/types-of-orangutans.png",
                        alt: "Types of orangutans comparison image covering Bornean, Sumatran, and Tapanuli orangutans",
                        width: 2482,
                        height: 2482,
                        caption: "Orangutan comparison visual: Bornean, Sumatran, and Tapanuli orangutans are easiest to separate by build, facial shape, coat texture, and geography."
                    }
                }
            },
            {
                title: "How orangutans survive in a complex forest",
                paragraphs: [
                    "Orangutans survive by remembering routes, timing fruit availability, and navigating branch architecture without wasting unnecessary energy. Their animal behavior rewards caution, planning, and habitat familiarity.",
                    "That is why forest degradation hits them hard. Break the canopy logic and you break part of the decision system they rely on."
                ]
            },
            {
                title: "The ecosystem role of orangutans",
                paragraphs: [
                    "Orangutans disperse seeds and support forest regeneration through feeding and movement. Their ecosystem role is tied to long-range plant turnover, especially in dense forest systems where large-bodied dispersers matter.",
                    "They are not just residents of the canopy. They help keep the canopy’s future inventory moving."
                ]
            },
            {
                title: "What humans can learn from orangutans",
                paragraphs: [
                    "Orangutans are a reminder that not every intelligent system should be optimized for speed. In dense, high-risk environments, patience and retained knowledge are often the premium traits.",
                    "That is the practical takeaway: if the environment is structurally complex, slow learning can be smarter than fast guessing."
                ]
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "jellyfish",
        slug: "why-jellyfish-thrive-in-changing-oceans",
        title: "Why Jellyfish Thrive in Changing Oceans",
        description: "A practical guide to jellyfish behavior, simple but effective survival strategy, ecosystem role, and why jellyfish can flourish when ocean systems shift.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/jellyfish-photography.webp",
            alt: "Jellyfish in the ocean illustrating low-cost survival strategy and adaptation to changing marine conditions for AnimalDex",
            width: 1072,
            height: 715,
            caption: "A jellyfish drifting through open water captures the simple, low-overhead design that lets jellyfish thrive when marine systems shift."
        },
        readingMinutes: 6,
        tags: ["Jellyfish", "Marine ecosystems", "Animal behavior"],
        searchIntents: ["jellyfish behavior", "how jellyfish survive", "jellyfish ecosystem role", "why jellyfish thrive"],
        sections: [
            {
                title: "Why jellyfish matter more than most people assume",
                paragraphs: [
                    "Jellyfish are often treated as background marine oddities, but that misses the point. They are low-cost biological systems that can convert shifting ocean conditions into real competitive advantage.",
                    "That is why jellyfish matter in ecology discussions. When they bloom, they often reveal something about the surrounding system."
                ]
            },
            {
                title: "What makes a jellyfish unique?",
                paragraphs: [
                    "A jellyfish does not rely on a heavy skeleton, large brain, or muscular chase strategy. It uses nematocysts, pulsed movement, and a gelatinous body plan that keeps structural costs low.",
                    "That makes it a different kind of survival hardware. It is not trying to overpower the ocean. It is trying to exploit the flow efficiently enough to stay in the game."
                ]
            },
            {
                title: "How jellyfish survive",
                paragraphs: [
                    "Jellyfish survive by pairing simple capture hardware with environmental drift. They let currents do part of the transportation work while keeping prey capture mechanisms ready.",
                    "In animal behavior terms, this is a lightweight strategy. The jellyfish does not need to dominate every interaction if the surrounding water keeps delivering opportunities."
                ]
            },
            {
                title: "Do jellyfish feel pain?",
                paragraphs: [
                    "Jellyfish respond to touch, injury, and environmental change, but that does not automatically mean they feel pain in the way vertebrates are thought to. They do not have a brain or a centralized nervous system that would strongly suggest pain processing like mammals, birds, or many other animals.",
                    "The safer interpretation is that jellyfish detect and react to harmful stimuli without good evidence for conscious pain as humans usually mean it. They have nerve nets, not a centralized mind, so the better phrase is stimulus response rather than emotional suffering.",
                    "That difference matters when people ask how predators interact with them. A sea turtle eating a jellyfish is still part of a real ecological relationship, but it is not well described by projecting mammal-style pain assumptions onto a very different kind of body plan."
                ],
                inlineLinks: [
                    {text: "sea turtle", slug: "sea-turtle"}
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/sea-turtle-eating-jellyfish.png",
                        alt: "Sea turtle eating jellyfish, illustrating predator-prey relationships and the question of whether jellyfish feel pain",
                        width: 960,
                        height: 636,
                        caption: "Sea turtle and jellyfish interaction: jellyfish clearly respond to stimuli, but current evidence does not support pain processing in the mammal-like sense."
                    }
                }
            },
            {
                title: "The ecosystem role of jellyfish",
                paragraphs: [
                    "Jellyfish feed on plankton and small organisms while also serving as food for other marine animals. Their ecosystem role is part transfer system and part warning light.",
                    "When jellyfish populations surge, it can indicate marine imbalance, altered predation, or nutrient conditions that favor opportunistic, low-overhead biology."
                ]
            },
            {
                title: "What humans can learn from jellyfish",
                paragraphs: [
                    "Jellyfish are a lesson in structural economy. A system does not need to be elaborate to be effective if it is built for the real conditions it expects to face.",
                    "That is the useful insight: sometimes the winning move is to lower the operating cost enough that the environment starts carrying more of the burden."
                ]
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "crocodile",
        slug: "how-crocodiles-dominate-the-water-edge",
        title: "How Crocodiles Dominate the Water Edge: Ambush, Behavior, and Ecosystem Role",
        description: "Understand crocodile behavior, ambush survival strategy, ecosystem role, and why riverbanks and estuaries become so dangerous when crocodiles control the chokepoints.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/how-crocodiles-dominate-the-water.webp",
            alt: "Crocodile featured image for the AnimalDex article on water-edge ambush, behavior, and ecosystem role",
            width: 1200,
            height: 675,
            caption: "Featured image source: AnimalDex CDN."
        },
        readingMinutes: 7,
        tags: ["Crocodile behavior", "Ambush predators", "Ecosystem role"],
        searchIntents: ["crocodile behavior", "how crocodiles survive", "crocodile ecosystem role", "crocodile ambush strategy"],
        sections: [
            {
                title: "Why crocodiles remain such effective predators",
                paragraphs: [
                    "Crocodiles matter because they solve one problem extremely well: control the edge between land and water where movement narrows and attention gets split.",
                    "That makes them less about constant domination and more about strategic geography. A crocodile is dangerous because the terrain is helping."
                ]
            },
            {
                title: "What makes a crocodile unique?",
                paragraphs: [
                    "Jaw pressure sensors, high-mounted eyes and nostrils, explosive tail propulsion, and a body plan that vanishes into the waterline make crocodiles specialized ambush hardware.",
                    "They are not built to waste energy in open pursuit. They are built to hold still until the environment starts doing most of the setup."
                ]
            },
            {
                title: "How crocodiles survive",
                paragraphs: [
                    "Crocodile survival strategy depends on patience, low visible profile, and decisive short-range force. The success window is narrow, so timing matters more than continuous action.",
                    "That is why crocodile animal behavior often looks lazy to casual observers. In reality, it is an energy-saving system waiting for a chokepoint to become a trap."
                ]
            },
            {
                title: "The ecosystem role of crocodiles",
                paragraphs: [
                    "Crocodiles regulate prey access around rivers, wetlands, estuaries, and shorelines. Their ecosystem role includes shifting drinking behavior, movement timing, and carcass-driven nutrient movement.",
                    "They turn exposed edges into risk zones, and that alone changes how the rest of the system allocates space."
                ]
            },
            {
                title: "What humans can learn from crocodiles",
                paragraphs: [
                    "Crocodiles are a sharp lesson in bottleneck control. You do not need to own the entire map if you understand where the map collapses into a few forced pathways.",
                    "In strategic terms, chokepoints often matter more than surface area."
                ]
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "king-cobra",
        slug: "how-king-cobras-survive-and-hunt-other-snakes",
        title: "How King Cobras Survive and Hunt Other Snakes",
        description: "Explore king cobra behavior, specialized hunting strategy, ecosystem role, and how this predator survives by focusing on one of the hardest niches in the forest.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/how-king-cobras-survive-and-hunt-other-snakes.webp",
            alt: "King cobra featured image for the AnimalDex article on hunting other snakes and survival strategy",
            width: 1200,
            height: 675,
            caption: "Featured image source: AnimalDex CDN."
        },
        readingMinutes: 7,
        tags: ["King cobra", "Reptile behavior", "Predator ecology"],
        searchIntents: ["king cobra behavior", "how king cobras survive", "king cobra ecosystem role", "king cobra hunting strategy"],
        sections: [
            {
                title: "Why the king cobra stands apart",
                paragraphs: [
                    "The king cobra matters because it is a specialist with scale. It is not just another venomous snake; it is a predator tuned to track, confront, and consume other reptiles, including other snakes.",
                    "That narrow focus gives it a distinct place in discussions about animal behavior and evolutionary strategy."
                ]
            },
            {
                title: "What makes a king cobra unique?",
                paragraphs: [
                    "The king cobra combines strong chemosensory tracking, an elevated defensive and striking posture, significant venom yield, and a long body built for efficient movement through forest structure.",
                    "Those traits create a predator that can locate difficult prey and still defend itself with intimidating presence when needed."
                ]
            },
            {
                title: "How king cobras survive",
                paragraphs: [
                    "King cobra survival is built on specialization. By focusing on reptiles that many other predators avoid or cannot manage cleanly, it reduces direct competition for one of its main food channels.",
                    "Its animal behavior reflects that economy. This is not a generalist gambler. It is a system tuned for a narrow, high-skill niche."
                ]
            },
            {
                title: "The ecosystem role of a king cobra",
                paragraphs: [
                    "King cobras regulate other snake populations and occupy a high position in reptile food chains. Their ecosystem role helps keep one difficult predator layer from going unchecked.",
                    "That matters because controlling predator density inside predator-rich systems can stabilize the broader structure in less obvious ways."
                ]
            },
            {
                title: "What humans can learn from king cobras",
                paragraphs: [
                    "The king cobra demonstrates the value of hard specialization. General competence has value, but some systems create their edge by getting extremely good at one difficult job.",
                    "The lesson is not to narrow blindly. It is to choose the niche where precision has the highest payoff."
                ]
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "dolphin",
        slug: "how-dolphin-intelligence-works-in-the-wild",
        title: "How Dolphin Intelligence Works in the Wild",
        description: "A practical guide to dolphin intelligence, animal behavior, echolocation, survival strategy, and ecosystem role in open-water hunting systems.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/dolphin-intelligence-a-pack-of-dolphins.jpg",
            alt: "A pod of dolphins illustrating social intelligence, echolocation, and coordinated survival strategy for AnimalDex",
            width: 2048,
            height: 1152,
            caption: "A pack of dolphins captures the social coordination and real-time sensing that make dolphin intelligence so effective in the wild."
        },
        readingMinutes: 7,
        tags: ["Dolphin intelligence", "Marine behavior", "Animal behavior"],
        searchIntents: ["dolphin intelligence", "dolphin behavior", "how dolphins survive", "dolphin ecosystem role"],
        sections: [
            {
                title: "Why dolphins are more than just charismatic animals",
                paragraphs: [
                    "Dolphins attract attention because their behavior looks obviously intelligent, but the deeper value is how that intelligence works under marine constraints.",
                    "They have to sense, coordinate, and hunt in an environment where visibility can be unreliable and movement never fully stops. That makes dolphin intelligence operational, not decorative."
                ]
            },
            {
                title: "What makes a dolphin unique?",
                paragraphs: [
                    "Echolocation is the obvious headline, but the real advantage comes from combining sound-based sensing with hydrodynamic efficiency and social communication.",
                    "A dolphin can keep moving, keep sensing, and keep coordinating with others without needing the environment to become visually simple first."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/dolphin-seeing-themself-in-a-mirror.jpg",
                        alt: "Dolphin seeing itself in a mirror, illustrating self-recognition and cognitive complexity in dolphin intelligence",
                        width: 1259,
                        height: 783,
                        caption: "Mirror-recognition imagery points to the kind of perception and self-modeling that often enters dolphin intelligence discussions."
                    }
                }
            },
            {
                title: "How dolphins survive and hunt",
                paragraphs: [
                    "Dolphins survive by converting uncertainty into feedback. They use sound, group movement, and flexible hunting tactics to corral fish, exploit local conditions, and reduce wasted effort.",
                    "In animal behavior terms, they are not just quick thinkers. They are continuous-loop thinkers. They sense while moving and update while committing."
                ]
            },
            {
                title: "The ecosystem role of dolphins",
                paragraphs: [
                    "Dolphins pressure fish populations, influence prey schooling behavior, and move predation pressure through coastal and pelagic systems. Their ecosystem role sits in the higher-level marine coordination layer.",
                    "That matters because smart predators do not only remove biomass. They alter how biomass organizes itself."
                ]
            },
            {
                title: "What humans can learn from dolphins",
                paragraphs: [
                    "Dolphins are a lesson in live feedback systems. Waiting for perfect visibility is usually too slow, so they build sensing into motion instead of treating it as a separate phase.",
                    "That is the insight worth stealing: strong systems do not pause the world while they think."
                ]
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "eagle",
        slug: "how-eagles-use-height-vision-and-timing",
        title: "How Eagles Use Height, Vision, and Timing to Survive",
        description: "Learn how eagle behavior, animal vision, hunting strategy, and ecosystem role turn altitude and timing into survival advantages.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/how-eagles-use-height-vision-and-timing-to-survive.webp",
            alt: "Eagle featured image for the AnimalDex article on height, vision, and timing",
            width: 1200,
            height: 675,
            caption: "Featured image source: AnimalDex CDN."
        },
        readingMinutes: 6,
        tags: ["Eagle behavior", "Animal vision", "Predator ecology"],
        searchIntents: ["eagle behavior", "how eagles survive", "eagle ecosystem role", "eagle hunting strategy"],
        sections: [
            {
                title: "Why eagles still feel like the benchmark for aerial predators",
                paragraphs: [
                    "Eagles stand out because they convert vertical space into strategic advantage. Height gives them information, and information gives them cleaner decisions.",
                    "That makes eagles useful for understanding animal behavior that depends less on speed alone and more on a premium view of the operating surface."
                ]
            },
            {
                title: "What makes an eagle unique?",
                paragraphs: [
                    "Extreme visual acuity, broad soaring wings, and concentrated grip strength in the talons give eagles one of the strongest reconnaissance-to-capture pipelines in the animal world.",
                    "They are not built just to fly well. They are built to read a large space efficiently enough that the strike can stay selective."
                ]
            },
            {
                title: "How eagles survive",
                paragraphs: [
                    "Eagle survival depends on energy efficiency and timing. Thermals, open sightlines, and selective pursuit keep the cost of hunting lower than it would be for an animal trying to chase everything directly.",
                    "Their animal behavior is therefore strategic rather than frantic. They let the environment subsidize part of the search."
                ]
            },
            {
                title: "The ecosystem role of eagles",
                paragraphs: [
                    "Eagles regulate fish, birds, and medium prey while also reflecting habitat quality in many landscapes. Their ecosystem role is especially visible where water systems and open terrain make visibility a premium asset.",
                    "They occupy the high-level pressure layer of a food web, which means their persistence often signals broader system health."
                ]
            },
            {
                title: "What humans can learn from eagles",
                paragraphs: [
                    "Eagles show the value of stepping back far enough to see the real pattern before committing scarce energy.",
                    "That is the systems lesson: better vantage often beats faster reaction."
                ]
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "termite",
        slug: "how-termites-build-living-infrastructure",
        title: "How Termites Build Living Infrastructure",
        description: "A systems guide to termite behavior, mound engineering, survival strategy, ecosystem role, and why termites matter far beyond being decomposers.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/termites-close-up.webp",
            alt: "Termites close-up featured image for the AnimalDex article on living infrastructure and mound engineering",
            width: 1200,
            height: 675,
            caption: "Featured image source: AnimalDex CDN."
        },
        readingMinutes: 7,
        tags: ["Termite behavior", "Ecosystem engineering", "Animal systems"],
        searchIntents: ["termite behavior", "termite ecosystem role", "how termites survive", "termite mound engineering"],
        sections: [
            {
                title: "Why termites deserve more respect than they usually get",
                paragraphs: [
                    "Termites are easy to reduce to a pest story, but ecologically they are one of the more impressive infrastructure systems on land. They process difficult material, regulate mound conditions, and keep nutrients moving.",
                    "That makes them important for both systems biology and environmental design conversations."
                ]
            },
            {
                title: "What makes a termite unique?",
                paragraphs: [
                    "Termites combine caste specialization, microbe-assisted digestion, and architecture that helps regulate temperature and moisture. Few animals integrate processing and building so tightly.",
                    "The colony works because the labor system and the environmental hardware support each other. Digestion, defense, ventilation, and construction are not separate departments."
                ]
            },
            {
                title: "How termites survive",
                paragraphs: [
                    "Termite survival depends on converting low-grade plant material into usable energy while keeping colony conditions stable enough for the whole system to function.",
                    "That means their animal behavior is less about visible drama and more about relentless maintenance. The colony survives because the internal environment is kept within workable limits."
                ]
            },
            {
                title: "The ecosystem role of termites",
                paragraphs: [
                    "Termites recycle dead plant matter, aerate soil, reshape nutrient availability, and create habitat conditions other organisms can exploit. Their ecosystem role is part decomposition engine and part environmental construction crew.",
                    "In many landscapes, remove termites and you do not just lose decomposers. You lose a chunk of the soil and structure management layer."
                ]
            },
            {
                title: "What humans can learn from termites",
                paragraphs: [
                    "Termites are a strong reminder that valuable systems often work on the material everyone else ignores. Waste is frequently just unprocessed input.",
                    "The second lesson is architectural: when structure helps regulate the environment, the whole operation becomes easier to sustain."
                ]
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "chameleon",
        slug: "how-chameleons-see-and-strike",
        title: "How Chameleons See and Strike: Vision, Behavior, and Survival Strategy",
        description: "Learn how chameleon vision, camouflage, tongue mechanics, animal behavior, and ecosystem role make this reptile an elite patient hunter.",
        featuredImage: {
            src: "https://chameleons101.com/wp-content/uploads/2023/04/Panther_Chameleons101_Eyes-1080x675.jpg",
            alt: "Chameleon featured image for the AnimalDex article on vision, strike behavior, and survival strategy",
            width: 1080,
            height: 675,
            caption: "Featured image source: Chameleons101."
        },
        readingMinutes: 6,
        tags: ["Chameleon behavior", "Animal vision", "Reptile survival"],
        searchIntents: ["chameleon behavior", "how chameleons survive", "chameleon ecosystem role", "chameleon vision"],
        sections: [
            {
                title: "Why chameleons are more than just color-change curiosities",
                paragraphs: [
                    "Chameleons are famous for camouflage, but the more useful systems view is that they combine surveillance, grip, and ballistic feeding into one integrated hunting platform.",
                    "That makes them interesting not because they look strange, but because their design solves a very specific arboreal problem set efficiently."
                ]
            },
            {
                title: "What makes a chameleon unique?",
                paragraphs: [
                    "Independently moving eyes give chameleons unusually broad visual coverage, while zygodactyl feet and gripping tails stabilize the body on narrow branches.",
                    "Then the tongue does the final work, converting a long visual setup phase into a rapid capture event. It is a clean example of sensor-first hunting."
                ]
            },
            {
                title: "How chameleons survive",
                paragraphs: [
                    "Chameleon survival strategy depends on patience, concealment, and precise commitment. They do not benefit from wasteful movement because movement makes them easier to notice and costs energy.",
                    "Their animal behavior therefore looks almost conservative. They hold position, keep scanning, and act when the probability turns in their favor."
                ]
            },
            {
                title: "The ecosystem role of chameleons",
                paragraphs: [
                    "Chameleons regulate insect populations in shrubs, trees, and forest edges while also serving as prey for larger animals. Their ecosystem role sits in a mid-level control band that helps keep local insect pressure from drifting upward unchecked.",
                    "They matter because fine-scale predation is still system structure, even when it happens branch by branch."
                ]
            },
            {
                title: "What humans can learn from chameleons",
                paragraphs: [
                    "Chameleons are a strong case for patient sensing. You do not need constant activity if your observation quality is high enough to make the one important move count.",
                    "That is the practical insight: better surveillance often creates more value than busier execution."
                ]
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "firefly",
        slug: "why-fireflies-use-light-so-well",
        title: "Why Fireflies Use Light So Well: Signaling, Behavior, and Survival Strategy",
        description: "Explore firefly signaling, animal behavior, survival strategy, and ecosystem role through a systems view of one of nature’s cleanest communication designs.",
        featuredImage: {
            src: "https://plunketts.net/uploads/blog/279a65cf-c701-422b-93f5-a428a926b59a/firefly-glow.jpg",
            alt: "Firefly featured image for the AnimalDex article on signaling, behavior, and survival strategy",
            width: 1200,
            height: 675,
            caption: "Featured image source: Plunkett's Pest Control."
        },
        readingMinutes: 6,
        tags: ["Firefly behavior", "Animal signaling", "Insect ecology"],
        searchIntents: ["firefly behavior", "how fireflies survive", "firefly ecosystem role", "firefly signaling"],
        sections: [
            {
                title: "Why fireflies are a better systems story than a nostalgia story",
                paragraphs: [
                    "Fireflies are often framed as magical scenery, but their real value is functional. They turn communication into a low-energy, high-legibility signaling system that works in dark environments.",
                    "That makes them one of the cleaner examples of signal design in the animal world."
                ]
            },
            {
                title: "What makes a firefly unique?",
                paragraphs: [
                    "Bioluminescence is the obvious answer, but the key is not simply producing light. It is producing the right flash pattern, at the right time, for the right audience.",
                    "That turns a tiny insect into an elegant communication platform where energy cost, recognition, and timing are tightly linked."
                ]
            },
            {
                title: "How fireflies survive",
                paragraphs: [
                    "Firefly survival depends on successful signaling, habitat conditions that support larvae and adults, and timing synchronized to night activity patterns.",
                    "Their animal behavior shows that good communication can be survival hardware. If your signal is clear enough, wasted search and wasted exposure both drop."
                ]
            },
            {
                title: "The ecosystem role of fireflies",
                paragraphs: [
                    "Fireflies contribute to local food webs and help illustrate habitat quality in moist landscapes, edges, and low-light environments where their life cycle can complete successfully.",
                    "Their ecosystem role is not about brute force. It is about supporting biodiversity and revealing whether the surrounding system still supports delicate timing-based interactions."
                ]
            },
            {
                title: "What humans can learn from fireflies",
                paragraphs: [
                    "Fireflies demonstrate that a strong signal does not have to be loud or expensive. It has to be legible, efficient, and correctly timed.",
                    "That is a useful design principle in almost any system where attention is scarce."
                ]
            }
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "whale-shark",
        slug: "how-whale-sharks-feed-at-ocean-scale",
        title: "How Whale Sharks Feed at Ocean Scale",
        description: "Understand whale shark behavior, filter-feeding survival strategy, ecosystem role, and how the largest fish on Earth thrives without acting like a classic predator.",
        featuredImage: {
            src: "https://cdn.britannica.com/33/151933-050-E7E77CA0/Whale-shark-swimming-trevallies-front-predators-filter-feeding.jpg",
            alt: "Whale shark featured image for the AnimalDex article on ocean-scale filter feeding",
            width: 1600,
            height: 900,
            caption: "Featured image source: Britannica."
        },
        readingMinutes: 7,
        tags: ["Whale shark", "Marine biology", "Ecosystem role"],
        searchIntents: ["whale shark behavior", "how whale sharks survive", "whale shark ecosystem role", "whale shark feeding strategy"],
        sections: [
            {
                title: "Why the whale shark feels like a contradiction",
                paragraphs: [
                    "The whale shark is the largest fish on Earth, yet it does not behave like a classic apex hunter. That contrast is what makes it so useful in systems thinking.",
                    "It proves that scale can come from processing flow efficiently rather than from dominating every interaction with force."
                ]
            },
            {
                title: "What makes a whale shark unique?",
                paragraphs: [
                    "A huge mouth, filtering structures, and low-cost cruising mechanics allow the whale shark to convert plankton-rich water into usable energy without high-speed pursuit.",
                    "That is unusual because the animal’s size suggests aggression, while its real advantage is throughput."
                ]
            },
            {
                title: "How whale sharks survive",
                paragraphs: [
                    "Whale shark survival depends on tracking productive water, arriving where plankton or small prey concentrations justify the movement cost, and filtering volume efficiently once the resource appears.",
                    "Their animal behavior is therefore route-aware and opportunity-driven. They do not need every part of the ocean to be good. They need to find the parts where the flow becomes worth processing."
                ]
            },
            {
                title: "The ecosystem role of a whale shark",
                paragraphs: [
                    "Whale sharks help link surface productivity to larger marine food webs by turning dense small prey into mobile biomass. Their ecosystem role also highlights where ocean conditions become seasonally productive enough to support very large filter feeders.",
                    "They are useful indicators of marine abundance hotspots rather than simple symbols of ocean size."
                ]
            },
            {
                title: "What humans can learn from whale sharks",
                paragraphs: [
                    "Whale sharks are a lesson in scale through process efficiency. You do not always grow by chasing more targets individually. Sometimes you grow by getting very good at handling the concentrated flow when it arrives.",
                    "That is the strategic insight: throughput can be a better growth engine than force."
                ]
            }
        ]
    }),
    {
        slug: "how-to-estimate-animal-breed-prices",
        title: "How to estimate animal breed prices without guessing",
        description: "A practical guide to animal breed pricing, local average cost, grading signals, and why responsible valuation needs more than a single photo.",
        publishedAt: "2026-04-24",
        updatedAt: "2026-04-24",
        featuredImage: {
            src: "/images/placeholders/phone-scan-card.svg",
            alt: "AnimalDex scan card visual for estimating breed pricing and grading context",
            width: 1200,
            height: 675,
            caption: "Breed pricing is strongest when scan evidence, grading notes, and market context stay together."
        },
        readingMinutes: 7,
        author: "AnimalDex Market Desk",
        tags: ["Breed pricing", "Animal grading", "Pet valuation"],
        searchIntents: [
            "animal breed price estimator",
            "animal breed pricing app",
            "average breed cost by area",
            "breeder pricing tool",
            "pet breed valuation",
            "animal breed grading app"
        ],
        speciesSlugs: ["maine-coon-cat", "african-wild-dog", "bald-eagle"],
        sections: [
            {
                title: "Breed price is a range, not a magic number",
                paragraphs: [
                    "The same breed can have very different prices depending on area, age, documentation, health, temperament, training, and demand. That is why a responsible estimate should start as a range.",
                    "AnimalDex should position breed pricing around structured context: likely breed signals, grading notes, profile completeness, and local comparison logic."
                ],
                inlineLinks: [
                    {
                        text: "AnimalDex",
                        slug: "animal-breed-price-estimator",
                        href: "/animal-breed-price-estimator"
                    },
                    {
                        text: "breed pricing and grading",
                        slug: "animal-breed-grading-app",
                        href: "/animal-breed-grading-app"
                    }
                ]
            },
            {
                title: "The signals that matter most",
                paragraphs: [
                    "Start with visible breed traits, then add practical valuation inputs: age, sex, condition, lineage documents, vaccination or health records, training level, rarity, and local buyer demand.",
                    "For breeder workflows, the most useful system is not just a price calculator. It is a record that explains why a price range might be reasonable."
                ],
                cards: [
                    {
                        label: "Breed evidence",
                        body: "Likely breed, lookalike notes, image quality, and confidence level should be recorded before any price conversation."
                    },
                    {
                        label: "Market context",
                        body: "Average breed cost by area depends on local demand, reputable seller supply, and what comparable animals include."
                    },
                    {
                        label: "Grading context",
                        body: "Health documentation, pedigree, age, training, and profile completeness can change how buyers interpret value."
                    },
                    {
                        label: "Buyer protection",
                        body: "Clear notes reduce vague claims and help buyers ask better questions before committing."
                    }
                ]
            },
            {
                title: "Why breeders need evidence-backed pricing",
                paragraphs: [
                    "Breeders often need to explain value clearly. A structured profile can show the difference between a casual listing and a well-documented animal.",
                    "That does not mean every animal needs a formal appraisal. It means the pricing conversation should be based on visible traits, documented facts, and comparable local expectations."
                ],
                inlineLinks: [
                    {
                        text: "pricing conversation",
                        slug: "animal-breed-pricing-grading-app",
                        href: "/use-cases/animal-breed-pricing-grading-app"
                    }
                ]
            },
            {
                title: "Where AnimalDex fits",
                paragraphs: [
                    "AnimalDex can give this search audience a useful bridge between breed identification and valuation. The app can help users collect the clues that make pricing less arbitrary.",
                    "The careful framing is important: AnimalDex should support breed pricing and grading context, not promise exact market prices from one image."
                ]
            }
        ],
        faq: [
            {
                question: "Can a breed price estimator be exact?",
                answer: "No. A responsible estimate should use a range and explain the factors behind it, including breed evidence, documentation, health, age, and local demand."
            },
            {
                question: "What is animal breed grading?",
                answer: "Breed grading is the process of recording quality and confidence signals such as trait match, documentation, condition, rarity, and profile completeness."
            }
        ]
    },
    {
        slug: "how-to-create-custom-animal-card-decks",
        title: "How to create custom animal card decks people want to collect",
        description: "Learn how to design custom animal cards and decks for pets, wildlife trips, classrooms, photography projects, gifts, and creator sales.",
        publishedAt: "2026-04-24",
        updatedAt: "2026-04-24",
        featuredImage: {
            src: "/images/placeholders/feature-collection-overview.svg",
            alt: "AnimalDex collection visual for custom animal card deck creation",
            width: 1200,
            height: 675,
            caption: "The best custom animal decks feel like complete collectible sets, not isolated cards."
        },
        readingMinutes: 7,
        author: "AnimalDex Creator Desk",
        tags: ["Animal cards", "Custom decks", "Creator tools"],
        searchIntents: [
            "custom animal card deck",
            "animal card deck creator",
            "create animal cards",
            "make animal trading cards",
            "sell custom animal cards",
            "pet trading cards"
        ],
        speciesSlugs: ["maine-coon-cat", "bald-eagle", "komodo-dragon"],
        sections: [
            {
                title: "Start with a deck theme",
                paragraphs: [
                    "A custom animal card deck needs a clear reason to exist. It might be a family pet deck, a zoo trip set, a regional wildlife pack, a classroom unit, or a photographer's best sightings.",
                    "The theme decides which animals belong, what stats matter, and why someone would want to complete the set."
                ],
                inlineLinks: [
                    {
                        text: "custom animal card deck",
                        slug: "custom-animal-card-deck",
                        href: "/custom-animal-card-deck"
                    }
                ]
            },
            {
                title: "Give every card a collectible structure",
                paragraphs: [
                    "A card should include a strong image, animal name, traits, rarity, stats, a short story, and a reason it matters inside the deck.",
                    "AnimalDex already uses animal profiles and collectible logic, so it can support cards that feel more complete than simple image templates."
                ],
                cards: [
                    {
                        label: "Identity",
                        body: "Name, species or breed, location, and deck role make the card easy to understand."
                    },
                    {
                        label: "Stats",
                        body: "Rarity, strength, speed, intelligence, adaptability, or care difficulty can create comparison value."
                    },
                    {
                        label: "Story",
                        body: "A short story turns the animal from a picture into a memorable card."
                    },
                    {
                        label: "Set logic",
                        body: "Habitats, regions, colors, traits, or owner stories can make the deck feel complete."
                    }
                ]
            },
            {
                title: "Design for personal use and creator sales",
                paragraphs: [
                    "Pet owners may want keepsake cards. Teachers may want classroom decks. Photographers may want wildlife packs. Small creators may want themed products for a niche audience.",
                    "AnimalDex should frame this as a creator-ready workflow until a direct marketplace exists: make the cards, organize the deck, and prepare the concept for sharing, printing, or selling elsewhere."
                ],
                inlineLinks: [
                    {
                        text: "creator-ready workflow",
                        slug: "sell-custom-animal-cards",
                        href: "/sell-custom-animal-cards"
                    }
                ]
            },
            {
                title: "Where AnimalDex fits",
                paragraphs: [
                    "AnimalDex has a strong foundation for custom animal cards because its product language already combines scanning, profiles, rarity, collection, and learning.",
                    "That gives the SEO story a natural product path: users do not just create a card, they build an animal deck with structure."
                ],
                inlineLinks: [
                    {
                        text: "animal deck",
                        slug: "animal-card-deck-creator",
                        href: "/animal-card-deck-creator"
                    }
                ]
            }
        ],
        faq: [
            {
                question: "What should be on a custom animal card?",
                answer: "A strong custom animal card usually includes an image, name, traits, rarity, stats, a short story, and a role inside a larger deck."
            },
            {
                question: "Can creators sell custom animal cards?",
                answer: "Creators can prepare sellable deck concepts for gifts, classrooms, photography products, or niche collections. Direct AnimalDex marketplace claims should wait until that feature exists."
            }
        ]
    },
    {
        slug: "what-animals-can-teach-us-about-self-improvement",
        title: "What animals can teach us about self-improvement",
        description: "Animals can teach focus, patience, resilience, teamwork, boundaries, and adaptability. Here is how AnimalDex can turn species learning into personal growth prompts.",
        publishedAt: "2026-04-24",
        updatedAt: "2026-04-24",
        featuredImage: {
            src: "/images/placeholders/more-guide.svg",
            alt: "AnimalDex field guide visual for learning self-improvement from animals",
            width: 1200,
            height: 675,
            caption: "Animal traits become more useful when they turn into repeatable reflection prompts."
        },
        readingMinutes: 6,
        author: "AnimalDex Learning Desk",
        tags: ["Animal learning", "Self improvement", "Nature journaling"],
        searchIntents: [
            "learn from animals",
            "what animals teach us",
            "animal lessons for life",
            "self improvement from animals",
            "animal traits personal growth",
            "animal behavior learning app"
        ],
        speciesSlugs: ["bald-eagle", "african-wild-dog", "komodo-dragon"],
        systemsSpeciesSlugs: ["bald-eagle", "african-wild-dog", "komodo-dragon"],
        sections: [
            {
                title: "Animal lessons work because they are concrete",
                paragraphs: [
                    "Self-improvement advice is often abstract. Animals make it easier to remember because their behavior gives you a vivid example of a trait in action.",
                    "A species card can become a prompt: what does this animal do well, what constraint does it solve, and what human habit does that suggest?"
                ],
                inlineLinks: [
                    {
                        text: "species card",
                        slug: "learn-from-animals",
                        href: "/learn-from-animals"
                    }
                ]
            },
            {
                title: "Six habits animals can make easier to understand",
                paragraphs: [
                    "Focus is easier to picture through a hunting bird than through a vague slogan. Teamwork becomes clearer through social animals. Adaptability becomes clearer through species that thrive across difficult conditions.",
                    "The point is not to pretend humans should copy animals literally. The point is to use animal behavior as a memorable anchor for reflection."
                ],
                cards: [
                    {
                        label: "Focus",
                        body: "Predators and foragers show how attention narrows when the target matters."
                    },
                    {
                        label: "Patience",
                        body: "Ambush hunters, nesting birds, and slow-moving reptiles show the value of timing."
                    },
                    {
                        label: "Teamwork",
                        body: "Social animals show how shared signals and roles reduce wasted effort."
                    },
                    {
                        label: "Boundaries",
                        body: "Territorial behavior can become a prompt for space, energy, and limits."
                    },
                    {
                        label: "Adaptability",
                        body: "Generalist species show how flexible systems survive changing conditions."
                    },
                    {
                        label: "Resilience",
                        body: "Migration, recovery, and seasonal behavior show how persistence often has a rhythm."
                    }
                ]
            },
            {
                title: "Turn animal learning into a journal habit",
                paragraphs: [
                    "After each sighting or card, users can ask one simple question: what useful trait does this animal demonstrate?",
                    "AnimalDex can make that repeatable by connecting identification, collection, and reflection in one learning loop."
                ],
                inlineLinks: [
                    {
                        text: "learning loop",
                        slug: "animal-inspired-self-improvement-app",
                        href: "/use-cases/animal-inspired-self-improvement-app"
                    }
                ]
            },
            {
                title: "Why this belongs inside AnimalDex",
                paragraphs: [
                    "AnimalDex already gives users a reason to collect and revisit animal cards. Self-improvement adds another layer of meaning to those cards.",
                    "The best version stays grounded in real species and real observation, so it feels like practical nature learning rather than generic motivation."
                ]
            }
        ],
        faq: [
            {
                question: "What can animals teach people?",
                answer: "Animals can teach focus, patience, teamwork, boundaries, adaptability, resilience, attention, and respect through observable behavior."
            },
            {
                question: "How can AnimalDex support self-improvement?",
                answer: "AnimalDex can turn species cards and sightings into reflection prompts that connect animal traits to human habits."
            }
        ]
    }
];

export const blogPosts: BlogPost[] = [...blogPostsData]
    .sort((a, b) =>
        b.publishedAt.localeCompare(a.publishedAt)
        || (b.updatedAt || b.publishedAt).localeCompare(a.updatedAt || a.publishedAt)
    );

export function getBlogPost(slug: string) {
    return blogPosts.find((post) => post.slug === slug);
}

export function getMentionedSpeciesSlugs(postOrSlug: BlogPost | string) {
    const post = typeof postOrSlug === "string" ? getBlogPost(postOrSlug) : postOrSlug;

    if (!post) {
        return [];
    }

    return Array.from(
        new Set([
            ...post.speciesSlugs,
            ...(post.systemsSpeciesSlugs || []),
            ...post.sections.flatMap((section) => section.speciesSlugs || [])
        ])
    );
}

export function getRelatedBlogPosts(slug: string, limit = 3) {
    const current = getBlogPost(slug);

    if (!current) {
        return [];
    }

    return blogPosts
        .filter((post) => post.slug !== slug)
        .map((post) => {
            const sharedTags = post.tags.filter((tag) => current.tags.includes(tag)).length;
            const sharedIntents = post.searchIntents.filter((intent) => current.searchIntents.includes(intent)).length;
            const sharedSpecies = post.speciesSlugs.filter((species) => current.speciesSlugs.includes(species)).length;

            return {
                post,
                score: sharedTags * 3 + sharedIntents * 2 + sharedSpecies * 2
            };
        })
        .sort((a, b) => b.score - a.score || b.post.publishedAt.localeCompare(a.post.publishedAt))
        .slice(0, limit)
        .map(({post}) => post);
}

export function getBlogPostsForSpecies(speciesSlug: string, limit = 3) {
    return blogPosts
        .filter((post) =>
            post.speciesSlugs.includes(speciesSlug)
            || (post.systemsSpeciesSlugs || []).includes(speciesSlug)
            || post.sections.some((section) => (section.speciesSlugs || []).includes(speciesSlug))
        )
        .slice(0, limit);
}

export function getRelatedChallengesForBlogPost(slug: string, limit = 3) {
    const post = getBlogPost(slug);

    if (!post) {
        return [];
    }

    const mentionedSpeciesSlugs = getMentionedSpeciesSlugs(post);
    const explicit = (post.relatedChallengeSlugs || [])
        .map((challengeSlug) => getChallenge(challengeSlug))
        .filter((entry): entry is NonNullable<ReturnType<typeof getChallenge>> => Boolean(entry));
    const explicitSlugs = new Set(explicit.map((entry) => entry.slug));

    const scored = Array.from(
        new Map(
            mentionedSpeciesSlugs
                .flatMap((speciesSlug) => getChallengesForSpecies(speciesSlug, limit + 3))
                .filter((challenge) => !explicitSlugs.has(challenge.slug))
                .map((challenge) => [challenge.slug, challenge])
        ).values()
    )
        .map((challenge) => {
            const sharedSpecies = challenge.speciesSlugs.filter((speciesSlug) => mentionedSpeciesSlugs.includes(speciesSlug)).length;

            return {
                challenge,
                score: sharedSpecies * 3 + ((post.relatedChallengeSlugs || []).includes(challenge.slug) ? 4 : 0)
            };
        })
        .sort((left, right) =>
            right.score - left.score
            || (right.challenge.updatedAt || right.challenge.publishedAt).localeCompare(left.challenge.updatedAt || left.challenge.publishedAt)
            || left.challenge.title.localeCompare(right.challenge.title)
        )
        .map(({challenge}) => challenge);

    return [...explicit, ...scored].slice(0, limit);
}

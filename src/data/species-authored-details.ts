/**
 * Hand-written facts for expansion-pack species the production catalog has no
 * field guide for (mostly broad names such as "fox" or "owl" that the catalog
 * files under a narrower key). They replace the generated template copy, which
 * `applyStaticSpeciesOverlay` would otherwise empty — dropping the page below
 * the indexing gate in `speciesHasSubstantiveFieldGuide`.
 */
export type SpeciesAuthoredDetails = {
    /** 2–3 sentences, ≥ 120 characters, answers "what is a <name>?". */
    summary: string;
    /** 3–4 field marks. */
    identification: string[];
    /** 3–4 behaviour facts. */
    behaviorTraits: string[];
    /** 2–3 specific facts with numbers where they exist. */
    whyInteresting: string[];
    /** 2–3 real lookalike species and the difference. */
    lookalikes: string[];
};

export const speciesAuthoredDetails: Record<string, SpeciesAuthoredDetails> = {
    anglerfish: {
        summary: "Anglerfish are bony fishes of the order Lophiiformes, a group of more than 300 species found in every ocean, from shallow reefs to the deep sea below 1,000 m. Most deep-sea females are smaller than 30 cm, while coastal goosefish can reach about 2 m. All of them hunt with a fishing lure: a modified dorsal-fin spine that dangles a fleshy bait over the mouth.",
        identification: [
            "Rounded or flattened body with an enormous upturned mouth lined with long, inward-pointing teeth.",
            "A rod-like spine (illicium) on the head tipped with a lure (esca); in deep-sea species the lure glows.",
            "Deep-sea species are dark brown to black with small eyes and loose, scaleless skin.",
            "Coastal goosefish are broad and flat, mottled brown, with a fringe of skin flaps around the jaw."
        ],
        behaviorTraits: [
            "Sit-and-wait predators: they hang motionless or lie on the bottom and twitch the lure to draw prey within reach of the mouth.",
            "The mouth and stomach are highly expandable, so an anglerfish can swallow prey as large as itself.",
            "Most species live alone in dark, food-poor water and spend little energy moving.",
            "In several deep-sea families the tiny males find a female by smell and some fuse permanently to her body, sharing her blood supply."
        ],
        whyInteresting: [
            "The glowing lure of deep-sea anglerfish is lit by symbiotic bioluminescent bacteria living inside it, not by the fish itself.",
            "Sexual parasitism, in which a dwarf male fuses to a female and becomes a sperm source, is known in only a few anglerfish families and nowhere else among vertebrates.",
            "The Atlantic goosefish (Lophius americanus) is fished commercially and sold as monkfish."
        ],
        lookalikes: [
            "Frogfishes are also anglerfishes but live on shallow reefs and walk on arm-like pectoral fins; their lures do not glow.",
            "Dragonfishes and viperfishes have long, slender bodies with rows of light organs along the belly instead of a rounded body with a head lure.",
            "Stargazers bury themselves in sand with upward-facing eyes; they have no rod-and-lure spine on the head."
        ]
    },
    "argentine-horned-frog": {
        summary: "The Argentine horned frog (Ceratophrys ornata) is a large, round ambush frog of the pampas grasslands and wetlands of Argentina, Uruguay and southern Brazil. Females reach about 16 cm long. Its mouth is nearly as wide as its body, which has earned it the pet-trade name Pac-Man frog.",
        identification: [
            "Squat, almost spherical body with a head that is roughly half the total length.",
            "Bright green with dark red-brown or black blotches outlined in yellow or pale green.",
            "Small fleshy points over each eye that give the horned look.",
            "Short legs and a habit of sitting half-buried in mud or leaf litter."
        ],
        behaviorTraits: [
            "Mostly nocturnal ambush predator that waits buried with only the head showing and lunges at anything that passes.",
            "Eats insects, other frogs, small snakes, lizards and rodents, and bites and holds prey with tooth-like projections on the jaw.",
            "Survives the dry season buried underground inside a cocoon formed from layers of shed skin.",
            "Breeds in temporary pools after heavy rains; the tadpoles are themselves carnivorous."
        ],
        whyInteresting: [
            "It will try to swallow prey close to its own size and sometimes chokes on it.",
            "Wild populations have declined with the conversion of the pampas to farmland, and the IUCN lists the species as Near Threatened.",
            "Tadpoles can make sounds underwater, a rare ability among frog larvae."
        ],
        lookalikes: [
            "Cranwell's horned frog (Ceratophrys cranwelli) of the Gran Chaco is usually duller olive or brown, with less contrasting markings.",
            "The Surinam horned frog (Ceratophrys cornuta) of the Amazon has much longer, pointed eyelid horns.",
            "Budgett's frog (Lepidobatrachus laevis) is flatter, grey-olive and lacks eyelid horns."
        ]
    },
    "basilisk-lizard": {
        summary: "The common basilisk (Basiliscus basiliscus) is an iguana-like lizard of the rainforests and riverbanks of Central America and northwestern South America. Adults reach about 80 cm including a tail that makes up most of the length. It is famous for sprinting across the surface of water on its hind legs.",
        identification: [
            "Slender olive to brown body with a pale or yellowish stripe along each side.",
            "Adult males carry a tall crest on the head and fin-like crests along the back and tail.",
            "Very long tail and long hind toes edged with scaly fringes.",
            "Often seen perched on branches overhanging streams."
        ],
        behaviorTraits: [
            "Active by day, basking and foraging in vegetation close to water.",
            "Omnivorous, eating insects, spiders, small vertebrates, flowers and fruit.",
            "When threatened it drops from a branch and runs bipedally across the water, then swims or hides underwater.",
            "Females lay clutches of eggs in moist soil several times a year; hatchlings are independent from birth."
        ],
        whyInteresting: [
            "Water running works by slapping the fringed feet down and pulling them back fast enough to create air pockets before sinking, which earned it the nickname Jesus Christ lizard.",
            "Young, lighter basilisks can run farther across water than adults, covering several meters.",
            "It can also stay submerged for extended periods to avoid predators."
        ],
        lookalikes: [
            "The green basilisk (Basiliscus plumifrons) is bright green with a double head crest.",
            "The brown basilisk (Basiliscus vittatus) has two yellow side stripes and males lack the tall back sail.",
            "The green iguana is bulkier, with a dewlap, a large round cheek scale and no tall head crest."
        ]
    },
    "bearded-dragon": {
        summary: "The central bearded dragon (Pogona vitticeps) is an agamid lizard of the arid woodlands and deserts of inland eastern and central Australia. Adults grow to about 50 to 60 cm including the tail. Its name comes from the spiny throat pouch that it puffs out and darkens to black during displays.",
        identification: [
            "Broad, flattened body with rows of soft spines along the sides and around the head.",
            "Expandable spiny throat (beard) that turns dark during threat and courtship displays.",
            "Tan, grey, brown or reddish coloring that lightens or darkens with temperature and mood.",
            "Triangular head and a long, tapering tail."
        ],
        behaviorTraits: [
            "Active by day, basking on rocks, logs and fence posts to raise body temperature.",
            "Omnivorous, eating insects and other invertebrates, small vertebrates, leaves and flowers.",
            "Communicates with head-bobbing (dominance) and slow arm-waving (submission).",
            "Females lay clutches of roughly a dozen to two dozen eggs in burrows; in cool months the lizards slow down in a winter dormancy called brumation."
        ],
        whyInteresting: [
            "Sex is set by chromosomes, but high nest temperatures can turn genetically male embryos into functional females.",
            "It is one of the most widely kept pet reptiles in the world, although Australia has banned the commercial export of its native wildlife since the 1960s.",
            "Researchers have recorded bearded dragons showing sleep stages similar to REM and slow-wave sleep in mammals."
        ],
        lookalikes: [
            "The eastern bearded dragon (Pogona barbata) of coastal eastern Australia is darker grey and has a yellow mouth lining.",
            "The frilled lizard has a large, loose frill around the neck rather than a spiny beard and runs on its hind legs.",
            "Rankin's dragon (Pogona henrylawsoni) is smaller, with a shorter snout and much reduced spines."
        ]
    },
    "burrowing-parrot": {
        summary: "The burrowing parrot (Cyanoliseus patagonus), also called the Patagonian conure, is a large parakeet of dry scrub and open country in Argentina and Chile. It measures about 45 cm long. It nests in tunnels it digs into cliffs, often in very large colonies.",
        identification: [
            "Olive-brown head, back and breast with a yellow lower back and rump.",
            "Orange-red patch in the center of the yellow belly and an off-white bar across the upper breast in many birds.",
            "Blue flight feathers and a long, pointed tail.",
            "Pale ring of bare skin around the eye and a dark grey bill."
        ],
        behaviorTraits: [
            "Highly social, flying, feeding and roosting in noisy flocks.",
            "Eats seeds, berries and fruit of wild plants and also forages in crops.",
            "Pairs dig burrows into soft sandstone or limestone cliffs, often more than 1 m deep, and use them for breeding.",
            "Lays 2 to 5 eggs; both parents feed the young."
        ],
        whyInteresting: [
            "The cliff colony at El Cóndor on the Atlantic coast of Argentina holds tens of thousands of nest burrows and is the largest known parrot colony in the world.",
            "Pairs are long-term and socially monogamous.",
            "Flocks undertake seasonal movements, with southern populations shifting north in winter."
        ],
        lookalikes: [
            "The monk parakeet is smaller, green with a grey face and breast, and builds bulky stick nests in trees.",
            "The austral parakeet (Enicognathus ferrugineus) is green with a dull red tail and belly patch and lives in southern beech forests.",
            "The mitred parakeet is green with red on the face and no yellow rump."
        ]
    },
    cat: {
        summary: "The domestic cat (Felis catus) is a small carnivorous mammal kept by people worldwide and also living wild as feral and free-ranging populations. Adults typically weigh about 4 to 5 kg. It descends from the African wildcat and was domesticated in the Near East roughly 10,000 years ago.",
        identification: [
            "Flexible body with a long tail, a short rounded muzzle and upright triangular ears.",
            "Pupils that narrow to vertical slits in bright light.",
            "Retractable claws, so tracks normally show no claw marks.",
            "Coat colors range from tabby and solid colors to tortoiseshell and colorpoint patterns."
        ],
        behaviorTraits: [
            "Most active at dawn and dusk, with many hours of rest across the day.",
            "Obligate carnivore that stalks, then pounces on birds, rodents and other small animals.",
            "Free-living cats form loose colonies of related females; males are usually territorial.",
            "Females have litters of about 3 to 5 kittens after a gestation of around 63 to 65 days."
        ],
        whyInteresting: [
            "A cat buried with a person on Cyprus about 9,500 years ago is among the earliest evidence of a close bond with humans.",
            "Cats hear sounds up to about 64 kHz, well above the human limit of around 20 kHz.",
            "Free-ranging cats are a major predator of birds and small mammals, and are rated among the world's most damaging invasive species."
        ],
        lookalikes: [
            "The European wildcat is stockier with a thick, blunt tail ringed in black and ending in a black tip.",
            "The African wildcat is leaner, sandy grey with faint stripes and reddish backs to the ears.",
            "The bobcat is larger, with a short bobbed tail and ear tufts."
        ]
    },
    agouti: {
        summary: "The Central American agouti (Dasyprocta punctata) is a long-legged rodent of tropical forests from southern Mexico through Central America into northwestern South America. It weighs about 3 to 4 kg and stands like a small, slender deer. It is one of the forest's main seed dispersers, burying seeds to eat later.",
        identification: [
            "Coarse, glossy orange-brown to grizzled brown fur, often darker on the back.",
            "Slender legs, three toes on each hind foot and a tiny, almost invisible tail.",
            "Long hairs on the rump that it raises when alarmed.",
            "Small rounded ears and a blunt head."
        ],
        behaviorTraits: [
            "Active by day, foraging on the forest floor and fleeing in fast, bounding runs.",
            "Eats fallen fruit, seeds and nuts, holding food in its front paws like a squirrel.",
            "Scatter-hoards seeds by burying them singly; forgotten seeds germinate.",
            "Lives in monogamous pairs that defend a territory; litters are of 1 or 2 well-developed young."
        ],
        whyInteresting: [
            "Agoutis are among the few animals with teeth strong enough to open the hard-shelled seeds of many tropical trees.",
            "Studies in Panama found agoutis dig up and re-bury the same seeds repeatedly, carrying some over 100 m from the parent tree.",
            "Young can run within hours of birth."
        ],
        lookalikes: [
            "The lowland paca is heavier, nocturnal and has rows of white spots along its sides.",
            "Acouchis (Myoprocta) are smaller, with a longer tail.",
            "Small forest deer such as brocket deer have hooves and a visible tail, and males carry spike antlers."
        ]
    },
    coati: {
        summary: "The South American coati (Nasua nasua) is a raccoon relative of forests and scrub across much of South America east of the Andes. It measures roughly 85 to 115 cm including the tail and weighs about 2 to 7 kg. Its long, flexible, upturned snout is used to root through leaf litter for food.",
        identification: [
            "Long, mobile snout that projects well beyond the lower jaw.",
            "Long tail with pale and dark rings, often held upright while walking.",
            "Reddish-brown to dark brown coat with pale markings on the face.",
            "Small rounded ears and strong claws on the front feet."
        ],
        behaviorTraits: [
            "Active by day and sleeps in trees at night.",
            "Omnivorous: digs for insects, spiders and other invertebrates, and eats fruit, eggs and small vertebrates.",
            "Females and young live in bands that can number more than 30, while adult males are mostly solitary.",
            "Females leave the band to give birth in a tree nest and rejoin it with the young a few weeks later."
        ],
        whyInteresting: [
            "Coatis can rotate their ankles to climb down trees head-first.",
            "Bands keep in contact with chirps and whistles while spread out foraging.",
            "Band members groom one another and jointly mob predators."
        ],
        lookalikes: [
            "The white-nosed coati (Nasua narica) of Central America and the southwestern United States has a white muzzle and pale marks around the eyes.",
            "The raccoon has a black face mask and a shorter snout and is mostly nocturnal.",
            "The kinkajou has a prehensile, unringed tail and a short face."
        ]
    },
    "common-brush-tailed-possum": {
        summary: "The common brushtail possum (Trichosurus vulpecula) is a nocturnal marsupial found across much of Australia, in eucalypt woodland, forest and suburbs, and introduced to New Zealand. It has a head and body length of about 32 to 58 cm and weighs up to about 4.5 kg. It is one of the Australian mammals most at home living alongside people.",
        identification: [
            "Silver-grey fur in most populations, though rufous and black forms occur, with a pale belly.",
            "Large, pointed ears and a pointed pink nose.",
            "Bushy black tail with a bare patch on the underside of the tip used for gripping.",
            "Loud hissing, coughing and chattering calls at night."
        ],
        behaviorTraits: [
            "Nocturnal, sheltering by day in tree hollows, roof spaces and dense vegetation.",
            "Mainly eats eucalyptus and other leaves, plus flowers, fruit and occasionally eggs or insects.",
            "Mostly solitary and marks its range with scent glands on the chest and under the chin.",
            "Usually raises a single young, which lives in the pouch for about 4 to 5 months and then rides on the mother's back."
        ],
        whyInteresting: [
            "Introduced to New Zealand from the 1830s for a fur industry, it became a major pest there, damaging native forest and spreading bovine tuberculosis.",
            "Gestation lasts only about 17 to 18 days.",
            "It is protected in most of Australia, where some native populations have declined."
        ],
        lookalikes: [
            "The common ringtail possum is smaller, with a thin, tightly curled tail that ends in a white tip.",
            "The short-eared (mountain) brushtail possum has shorter, rounder ears and darker fur.",
            "Sugar gliders are much smaller, have a gliding membrane and a dark stripe down the back."
        ]
    },
    harvestman: {
        summary: "The common harvestman (Phalangium opilio) is an arachnid of the order Opiliones, native to Europe and Asia and introduced to North America. Its oval body is only about 4 to 9 mm long, but its thin legs are many times longer. Unlike spiders, it has no silk, no venom and a single fused body section.",
        identification: [
            "Small, rounded body with no visible waist between front and rear sections.",
            "Eight very long, thin legs; the second pair is the longest and is used to feel the way.",
            "Two eyes set on a small raised turret on top of the body.",
            "Males have long, forward-projecting jaws that look like horns."
        ],
        behaviorTraits: [
            "Mostly active at night, often seen on walls, fences and vegetation in late summer and autumn.",
            "Feeds on small insects, mites, snails, dead animals and plant material, chewing food rather than sucking it.",
            "Can release a leg when grabbed; the detached leg keeps twitching to distract predators.",
            "Mates directly, and females use an ovipositor to lay eggs in soil, where they overwinter."
        ],
        whyInteresting: [
            "There are about 6,500 described harvestman species worldwide.",
            "Harvestmen cannot regrow lost legs, so many adults are missing one or more.",
            "Many species give off a defensive odor from glands near the front of the body."
        ],
        lookalikes: [
            "Cellar spiders (Pholcidae), also called daddy longlegs, have a clear waist between two body parts and hang in webs.",
            "Crane flies have long legs too but have six legs, wings and a slender body.",
            "Other harvestman species differ in body color, spines and the size of the male's jaws."
        ]
    },
    "midwife-toad": {
        summary: "The common midwife toad (Alytes obstetricans) is a small toad of western Europe, from Iberia through France to Germany and Switzerland. It is up to about 5 cm long. Its name comes from the male, which carries the strings of eggs wrapped around his hind legs until they are ready to hatch.",
        identification: [
            "Small, plump toad, grey, olive or brown with fine warts.",
            "Vertical pupils in a golden eye.",
            "A row of small reddish or orange warts along each side of the body.",
            "Males carrying yellowish egg strings around the hind legs in spring and summer."
        ],
        behaviorTraits: [
            "Nocturnal, hiding by day under stones, in walls and in burrows.",
            "Feeds on insects, spiders, worms and other small invertebrates.",
            "Males call with a short, high, bell-like piping note.",
            "Mating takes place on land; the male then carries the eggs for several weeks and releases them into water when the tadpoles are about to hatch."
        ],
        whyInteresting: [
            "A single male may carry egg clutches from up to three females at once.",
            "Tadpoles can overwinter and grow large, sometimes reaching about 9 cm before metamorphosis.",
            "It has been badly affected by chytrid fungal disease in parts of its range."
        ],
        lookalikes: [
            "The common toad is larger, with horizontal pupils, coppery eyes and large glands behind the eyes.",
            "The natterjack toad has a yellow stripe along the middle of the back.",
            "The common spadefoot also has vertical pupils but is larger, with a hard digging spade on each hind foot."
        ]
    },
    "common-mudpuppy": {
        summary: "The common mudpuppy (Necturus maculosus) is a large, fully aquatic salamander of lakes and rivers in eastern North America, from southern Canada through the Great Lakes and Mississippi basins. Adults are usually 20 to 33 cm long. It keeps its bushy external gills for life.",
        identification: [
            "Three pairs of feathery, dark red external gills behind the head.",
            "Grey to rusty-brown body with scattered dark spots and a dark stripe through the eye.",
            "Flattened, paddle-like tail and four toes on each foot.",
            "Small eyes and a broad, flat head."
        ],
        behaviorTraits: [
            "Mainly nocturnal and stays on the bottom under rocks and logs.",
            "Eats crayfish, aquatic insects, snails, worms and small fish.",
            "Remains active through the winter and is sometimes caught by ice anglers.",
            "Females attach eggs under rocks in spring and guard them until they hatch, typically 1 to 2 months later."
        ],
        whyInteresting: [
            "Its gills grow larger and bushier in warm, low-oxygen water and smaller in cold, well-oxygenated water.",
            "It is the only known host for the larvae of the salamander mussel (Simpsonaias ambigua).",
            "The name comes from the old belief that it makes a barking sound; it can produce only soft squeaks."
        ],
        lookalikes: [
            "The hellbender is far larger and flatter, with wrinkled skin folds and no external gills as an adult.",
            "Larval mole salamanders have five toes on the hind feet, while the mudpuppy has four.",
            "Waterdogs (other Necturus species) of the southeastern United States are smaller and differ in spotting."
        ]
    },
    "common-tree-frog": {
        summary: "The European tree frog (Hyla arborea) is a small climbing frog of Europe and western Asia, living in reedbeds, hedges and shrubby wetlands. It is about 3.5 to 5 cm long. It is one of the few European frogs that climbs, gripping plants with sticky toe pads.",
        identification: [
            "Smooth, bright green back, though it can turn grey or brown.",
            "A dark stripe from the nostril through the eye and along the side, with an upward loop in front of the hind leg.",
            "Rounded adhesive discs on the tips of the fingers and toes.",
            "Males have a large yellowish-brown vocal sac under the chin."
        ],
        behaviorTraits: [
            "Active mostly at night; by day it rests on leaves in full sun.",
            "Catches flies, beetles, spiders and moths, often by leaping from vegetation.",
            "Males gather at ponds in spring and call in loud, fast choruses.",
            "Females lay several hundred eggs in small clumps attached to water plants in sunny, fish-free ponds."
        ],
        whyInteresting: [
            "A chorus can be heard from about 1 km away.",
            "It can change color within minutes depending on light, temperature and background.",
            "It has declined across much of western Europe with the loss of small ponds and is the subject of reintroduction projects."
        ],
        lookalikes: [
            "The stripeless tree frog (Hyla meridionalis) has a side stripe that stops at the shoulder.",
            "The Italian tree frog (Hyla intermedia) is very similar and is separated mainly by range.",
            "Green water frogs (Pelophylax) are larger, lack toe pads and sit at the water's edge rather than in plants."
        ]
    },
    cormorant: {
        summary: "Cormorants and shags (family Phalacrocoracidae) are about 40 species of fish-eating diving birds found on coasts and inland waters worldwide. They range from about 45 cm long in the pygmy cormorant to around 1 m in the great cormorant. They chase fish underwater and are often seen standing with wings spread to dry.",
        identification: [
            "Long neck and a long, slender bill with a sharp hook at the tip.",
            "Mostly dark plumage, often with a green or bronze sheen; some species have white underparts.",
            "Swims low in the water with the bill tilted upward.",
            "Bare facial skin, often yellow, orange or blue, around the base of the bill."
        ],
        behaviorTraits: [
            "Active by day, diving from the surface and propelling itself with large webbed feet.",
            "Eats mainly fish, plus crustaceans and eels, caught after underwater pursuit.",
            "Nests in colonies on cliffs, islands and trees, often with herons and other waterbirds.",
            "Lays about 3 to 4 eggs; both parents incubate and feed the chicks."
        ],
        whyInteresting: [
            "Its feathers are partly wettable, which reduces buoyancy for diving and explains the wing-spreading posture.",
            "Fishing with trained cormorants has been practiced in China and Japan for more than 1,000 years.",
            "The flightless cormorant of the Galápagos Islands has wings too small for flight."
        ],
        lookalikes: [
            "The anhinga has a straight, dagger-shaped bill, a very thin neck and a long fan-shaped tail.",
            "Loons (divers) also ride low but have straight, dagger-like bills and patterned backs in breeding plumage.",
            "Grebes are smaller, with lobed rather than webbed toes and almost no tail."
        ]
    },
    "spadefoot-toad": {
        summary: "Couch's spadefoot (Scaphiopus couchii) is a burrowing toad of deserts and arid grasslands in the southwestern United States and Mexico. It is about 5.5 to 9 cm long. It spends most of the year buried underground and emerges only for summer rains, when it breeds in temporary pools.",
        identification: [
            "Greenish-yellow to olive skin marbled with dark brown or black blotches.",
            "Large eyes with vertical pupils.",
            "A single dark, sickle-shaped spade on the inner side of each hind foot.",
            "Call is a bleating, drawn-out note likened to a lamb."
        ],
        behaviorTraits: [
            "Nocturnal and emerges in large numbers after monsoon storms.",
            "Feeds heavily on termites, beetles and other insects during its brief active season.",
            "Digs backward into the soil with its hind feet and stays buried for months in a dry season.",
            "Breeds explosively in rain-filled pools, sometimes within a single night of the first storm."
        ],
        whyInteresting: [
            "Its tadpoles can complete metamorphosis in as little as about 8 days, among the fastest of any frog.",
            "While buried it can tolerate losing a large share of its body water.",
            "A few nights of feeding after the rains must fuel the toad through the rest of the year underground."
        ],
        lookalikes: [
            "The plains spadefoot (Spea bombifrons) has a raised bump between the eyes and a wedge-shaped rather than sickle-shaped spade.",
            "The Mexican spadefoot (Spea multiplicata) is smaller, greyer and has a wedge-shaped spade.",
            "True toads such as Woodhouse's toad have horizontal pupils and large glands behind the eyes."
        ]
    },
    crab: {
        summary: "Crabs (infraorder Brachyura) are decapod crustaceans with about 7,000 species living in oceans, fresh water and on land worldwide. They range from pea crabs a few millimeters wide to the Japanese spider crab, whose legs span about 3.7 m. Their short tail is folded tightly under the body, and most walk sideways.",
        identification: [
            "Broad, hard carapace covering the head and body.",
            "Ten legs, with the front pair modified into claws (chelipeds).",
            "Short abdomen tucked under the body, narrow in males and broad in females.",
            "Eyes on movable stalks and short antennae."
        ],
        behaviorTraits: [
            "Many species are most active at night or at low tide.",
            "Most are omnivores or scavengers that pick at algae, detritus, carrion and small animals with their claws.",
            "Grow by molting their shell, hiding until the new shell hardens.",
            "Females carry fertilized eggs under the abdomen until they hatch into free-swimming larvae."
        ],
        whyInteresting: [
            "On Christmas Island, tens of millions of red crabs migrate from the forest to the sea to breed each year.",
            "The coconut crab, a land-living relative, is the largest land arthropod at up to about 4 kg.",
            "Fiddler crab males have one claw that can be nearly half their body weight, waved to attract females."
        ],
        lookalikes: [
            "Hermit crabs live in borrowed snail shells and have a soft, coiled abdomen.",
            "King crabs and porcelain crabs (Anomura) show only three pairs of walking legs, with the last pair tiny or hidden.",
            "Horseshoe crabs are not crustaceans; they have a domed shell and a long spike-like tail."
        ]
    },
    deer: {
        summary: "Deer (family Cervidae) are hoofed, cud-chewing mammals with around 50 species native to the Americas, Europe, Asia and northwest Africa, and introduced to Australia and New Zealand. They range from the pudu, about 35 to 40 cm tall at the shoulder, to the moose, which can stand over 2 m. Most males grow bony antlers that are shed and regrown every year.",
        identification: [
            "Long, slender legs, split hooves and a short tail, often with a pale rump patch.",
            "Branched antlers on males of most species; in reindeer, females have them too.",
            "Large, mobile ears and eyes set on the sides of the head.",
            "Glands in front of the eyes visible as a dark slit or pit in many species."
        ],
        behaviorTraits: [
            "Most are most active at dawn and dusk.",
            "Ruminant herbivores that graze grass or browse leaves, twigs and shoots, then chew the cud.",
            "Females and young form groups; males are often separate outside the rut, when they fight with antlers.",
            "Most bear one or two spotted young that hide in vegetation for their first weeks."
        ],
        whyInteresting: [
            "Growing antlers are among the fastest-growing tissues in mammals, adding up to about 2.5 cm a day in large species.",
            "Antlers are bone, unlike the permanent keratin-covered horns of cattle and antelope.",
            "Reindeer are the only deer in which both sexes routinely grow antlers."
        ],
        lookalikes: [
            "Antelope and other bovids have permanent, unbranched horns rather than shed antlers.",
            "Musk deer lack antlers and males have long tusk-like canine teeth.",
            "Chevrotains (mouse-deer) are tiny, antlerless and have small tusks."
        ]
    },
    "dik-dik": {
        summary: "Dik-diks (genus Madoqua) are four species of tiny antelope of dry bush in eastern Africa, with Kirk's dik-dik also found in Namibia and Angola. They stand about 30 to 40 cm at the shoulder and weigh about 3 to 6 kg. They live in lifelong pairs, and their name comes from the female's alarm call.",
        identification: [
            "Grizzled grey-brown back, reddish-tan legs and flanks and a pale belly.",
            "Long, mobile snout and large dark eyes ringed with white.",
            "Tuft of hair on the forehead; only males have short, spiky horns.",
            "Large dark gland in front of each eye."
        ],
        behaviorTraits: [
            "Active mainly at dawn, dusk and night, resting in shade during the heat of the day.",
            "Browses leaves, shoots, flowers and fruit and can get most of its water from food.",
            "Pairs defend a territory marked with dung piles and secretions from the eye glands.",
            "Females give birth to a single young after a gestation of about 6 months."
        ],
        whyInteresting: [
            "The long snout contains blood vessels that cool blood as the animal pants, helping it cope with heat.",
            "Pairs mark territory together in a set ritual of urinating and defecating on the same dung pile.",
            "When alarmed they give a whistling zik-zik call and flee in zigzag bounds."
        ],
        lookalikes: [
            "The steenbok is larger and redder, with big ears and no forehead tuft.",
            "The klipspringer is stockier, with a coarse speckled coat, and stands on tiptoe on rocks.",
            "Duikers are larger, with a rounded, hunched back and a tuft of hair between short, straight horns."
        ]
    },
    "drill-monkey": {
        summary: "The drill (Mandrillus leucophaeus) is a large, short-tailed monkey of the rainforests of southeastern Nigeria, western Cameroon and Bioko Island. Males weigh about 20 kg, roughly twice the size of females. It is one of Africa's most endangered primates.",
        identification: [
            "Black, hairless face surrounded by a white fringe of fur.",
            "Olive-brown to dark brown coat and a stubby tail.",
            "Adult males have a bright red lower lip and a pink, blue and purple rump.",
            "Long muzzle with ridges along the sides."
        ],
        behaviorTraits: [
            "Active by day, foraging mostly on the forest floor and sleeping in trees.",
            "Eats fruit, seeds, roots, insects and other small animals.",
            "Lives in groups led by a dominant male that can join into gatherings of more than 100 animals.",
            "Females give birth to a single young after about 6 months."
        ],
        whyInteresting: [
            "The IUCN lists the drill as Endangered because of bushmeat hunting and forest loss.",
            "Its closest relative is the mandrill, and the two are the only members of the genus Mandrillus.",
            "Rescue and breeding programs in Nigeria have returned drills to protected forest."
        ],
        lookalikes: [
            "The mandrill has a red stripe down the nose and blue ridges on the muzzle in males.",
            "Baboons have longer tails and live in savanna rather than rainforest.",
            "Mangabeys are slimmer, with long tails and no ridged muzzle."
        ]
    },
    "brush-tailed-bettong": {
        summary: "The eastern bettong (Bettongia gaimardi) is a small hopping marsupial of the grassy woodlands of eastern Tasmania, a relative of kangaroos. It has a head and body about 30 cm long and weighs around 1.2 to 2.3 kg. It feeds mostly on underground fungi and spreads their spores.",
        identification: [
            "Grey-brown fur with paler underparts.",
            "Long, furred tail, often with a white tip.",
            "Short, rounded ears and a blunt snout.",
            "Hops on long hind feet like a tiny wallaby."
        ],
        behaviorTraits: [
            "Nocturnal, resting by day in a grass nest hidden in a shallow scrape.",
            "Digs for truffle-like fungi, roots and bulbs with strong front claws.",
            "Carries nesting material with its curled tail.",
            "Usually solitary; females raise one young, which stays in the pouch for about 3 months."
        ],
        whyInteresting: [
            "It disappeared from mainland Australia in the early 20th century, after the spread of introduced red foxes and land clearing; Tasmania has no established foxes.",
            "Tasmanian animals have been reintroduced to fenced sanctuaries in the Australian Capital Territory.",
            "By spreading fungal spores it helps eucalypts, whose roots depend on those fungi."
        ],
        lookalikes: [
            "The woylie or brush-tailed bettong (Bettongia penicillata) of Western Australia has a black crest of hair along the end of the tail.",
            "The long-nosed potoroo has a longer, pointed snout and a shorter tail.",
            "The Tasmanian pademelon is much larger and heavier, with no white tail tip."
        ]
    },
    finch: {
        summary: "Finches are small seed-eating songbirds, most of them in the true finch family Fringillidae, which has more than 200 species across the Americas, Eurasia and Africa. Most are about 10 to 20 cm long. Their short, conical bills are built for cracking seeds.",
        identification: [
            "Thick, cone-shaped bill.",
            "Notched or forked tail.",
            "Males are often brightly colored in red, yellow or pink; females are usually duller and streakier.",
            "Bouncing, undulating flight and frequent twittering calls."
        ],
        behaviorTraits: [
            "Active by day, often foraging in flocks outside the breeding season.",
            "Eats seeds and buds, and feeds nestlings seeds or insects depending on the species.",
            "Many species move nomadically following seed crops.",
            "Builds cup nests in trees or shrubs; the female usually incubates while the male brings food."
        ],
        whyInteresting: [
            "Crossbills have crossed bill tips that pry seeds out of conifer cones.",
            "Hawaiian honeycreepers, which evolved a wide range of bill shapes, are members of the finch family.",
            "Darwin's finches of the Galápagos are not true finches but belong to the tanager family."
        ],
        lookalikes: [
            "American sparrows (Passerellidae) are mostly streaked brown and have less notched tails.",
            "Waxbills and the zebra finch belong to a separate family, Estrildidae, and have shiny, often red bills.",
            "Buntings (Emberizidae) have smaller bills and often show white outer tail feathers."
        ]
    },
    fox: {
        summary: "Foxes are small to medium canids, with 12 species in the true fox genus Vulpes plus foxes in several related genera, living on every continent except Antarctica. The red fox is the best known, with a head and body of about 45 to 90 cm and a weight of up to around 14 kg. Foxes have pointed muzzles, upright ears and long bushy tails.",
        identification: [
            "Narrow, pointed muzzle and large, erect triangular ears.",
            "Long, bushy tail; in the red fox it usually ends in a white tip.",
            "Slender legs, often with darker lower legs.",
            "Pupils that close to vertical slits in bright light."
        ],
        behaviorTraits: [
            "Mostly active at night and around dawn and dusk.",
            "Opportunistic omnivores that hunt rodents, rabbits and birds and also eat insects, fruit and scraps.",
            "Hunt small mammals with a high pounce, locating them by sound under grass or snow.",
            "Pairs breed in dens; red fox litters average about 4 to 6 kits."
        ],
        whyInteresting: [
            "The red fox has the largest natural range of any wild carnivore.",
            "The fennec fox of the Sahara is the smallest canid at about 1 to 1.5 kg, with ears up to about 15 cm long.",
            "Foxes often cache surplus food and return to it later."
        ],
        lookalikes: [
            "The coyote is larger, with longer legs, and runs with its tail held low.",
            "The gray fox (Urocyon) has a salt-and-pepper coat, a black-tipped tail and can climb trees.",
            "Jackals have longer legs and a less bushy tail."
        ]
    },
    "galapagos-sea-lion": {
        summary: "The Galápagos sea lion (Zalophus wollebaeki) is an eared seal found only around the Galápagos Islands. Adult males reach about 2.5 m and 250 kg, while females are much smaller. It is the most abundant marine mammal in the archipelago and often rests on beaches and harbors close to people.",
        identification: [
            "Sleek brown coat that looks dark when wet and golden-brown when dry.",
            "Small external ear flaps and long front flippers.",
            "Adult males are much larger, with a thick neck and a raised forehead crest.",
            "Walks on all four flippers by turning the hind flippers forward."
        ],
        behaviorTraits: [
            "Feeds mainly by day on sardines and other small fish, diving in coastal waters.",
            "Males defend stretches of beach and shallow water, barking to keep rivals away.",
            "Gathers in colonies on sandy beaches and rocky shores.",
            "Females give birth to a single pup and nurse it for one to three years."
        ],
        whyInteresting: [
            "The IUCN lists it as Endangered; its population falls sharply during El Niño years when fish become scarce.",
            "It was once considered a subspecies of the California sea lion.",
            "Pups gather in nursery groups in shallow pools while mothers feed at sea."
        ],
        lookalikes: [
            "The Galápagos fur seal is smaller, with a short pointed snout, large eyes and dense fur; it rests on shaded rocky shores.",
            "The California sea lion looks very similar but does not live in the Galápagos.",
            "True seals have no ear flaps and cannot turn their hind flippers forward."
        ]
    },
    "galapagos-tortoise": {
        summary: "The Galápagos giant tortoise (Chelonoidis niger and related species) is the largest living tortoise, native only to the Galápagos Islands. Large males can exceed 250 kg, with shells over 1.5 m long. Several island populations are now treated as separate species.",
        identification: [
            "Huge, dark brown to black shell.",
            "Shell shape varies by island: domed on wet, high islands and saddle-shaped with a raised front on dry islands.",
            "Long neck and thick, scaly, elephant-like legs.",
            "No nuchal scute (the small plate above the neck), unlike the Aldabra giant tortoise."
        ],
        behaviorTraits: [
            "Active by day, basking in the morning and resting in mud wallows or shade during the heat.",
            "Grazes on grasses, leaves, cactus pads and fruit.",
            "Some populations migrate seasonally between lowlands and humid highlands.",
            "Females dig nests in dry soil and lay a few to about 16 eggs; nest temperature determines the hatchlings' sex."
        ],
        whyInteresting: [
            "Wild tortoises often live more than 100 years.",
            "Saddleback shells let tortoises on dry islands stretch their necks up to reach cactus pads.",
            "Lonesome George, the last known Pinta Island tortoise, died in 2012."
        ],
        lookalikes: [
            "The Aldabra giant tortoise of the Seychelles has a nuchal scute above the neck and a more uniform domed shell.",
            "The African spurred tortoise is smaller, sandy-colored and has large spurs on its rear thighs.",
            "The red-footed tortoise is much smaller and has red to orange scales on its legs."
        ]
    },
    gharial: {
        summary: "The gharial (Gavialis gangeticus) is a fish-eating crocodilian of the large rivers of northern India and Nepal. Males can grow to around 5 to 6 m long. It has the longest, thinnest snout of any living crocodilian and is classed as Critically Endangered.",
        identification: [
            "Extremely long, narrow snout lined with many small, interlocking teeth.",
            "Adult males have a bulbous growth called a ghara on the tip of the snout.",
            "Olive to grey body and pale belly.",
            "Weak legs; it slides on its belly rather than walking upright on land."
        ],
        behaviorTraits: [
            "Spends most of its time in water and basks on sandbanks by day.",
            "Feeds mainly on fish, sweeping its narrow snout sideways to snap them up.",
            "Males use the ghara to make buzzing sounds and visual displays during the breeding season.",
            "Females dig nests in sandbanks and lay clutches of a few dozen eggs."
        ],
        whyInteresting: [
            "Gharial numbers fell by more than 90 percent in the 20th century; the Chambal River sanctuary now holds most of the wild population.",
            "It is the only living crocodilian whose males have a nasal growth used in display.",
            "It needs deep, fast-flowing rivers with sandbanks, so dams and sand mining threaten it."
        ],
        lookalikes: [
            "The false gharial (Tomistoma) of Southeast Asia has a slender snout that widens gradually toward the head, and no ghara.",
            "The mugger crocodile, which shares its rivers, has a broad, heavy snout.",
            "The African slender-snouted crocodile has a narrow snout but a much more robust head and stronger legs."
        ]
    },
    mayfly: {
        summary: "The giant burrowing mayfly (Hexagenia limbata) is an aquatic insect of lakes and slow rivers across North America. Adults are about 2 to 3 cm long, not counting the long tail filaments. The nymphs live in burrows in mud for a year or more, while the adults live only a day or two and do not eat.",
        identification: [
            "Yellowish to light brown body with darker markings.",
            "Large triangular forewings held upright over the back and small hindwings.",
            "Two long, thin tail filaments.",
            "Males have very long front legs used to grasp females in flight."
        ],
        behaviorTraits: [
            "Nymphs dig U-shaped burrows in soft lake and river bottoms and filter food particles.",
            "Emergence happens on warm evenings in early summer, often in huge synchronized hatches.",
            "Adults have no working mouthparts and live only long enough to mate.",
            "Females drop thousands of eggs onto the water surface after mating flights."
        ],
        whyInteresting: [
            "Mayflies are the only insects that molt again after gaining functional wings, passing through a winged subimago stage.",
            "Hexagenia hatches on the Great Lakes are large enough to appear on weather radar.",
            "Because the nymphs need oxygen-rich sediment, their return to western Lake Erie in the 1990s was a sign of improved water quality."
        ],
        lookalikes: [
            "Stoneflies hold their wings flat over the back rather than upright.",
            "Caddisflies fold hairy wings like a tent and have no long tails.",
            "Smaller mayfly species often have three tails or much shorter bodies."
        ]
    },
    "giant-stick-insect": {
        summary: "The Lord Howe Island stick insect (Dryococelus australis) is a large, flightless stick insect of Lord Howe Island off eastern Australia. Adults reach about 15 cm long. Thought extinct for decades, it was rediscovered in 2001 on Ball's Pyramid, a sea stack 23 km from the main island.",
        identification: [
            "Heavy, glossy black body as an adult; nymphs are green or brown.",
            "No wings.",
            "Males have very thick hind legs with spines.",
            "Large size for a stick insect, giving it the nickname tree lobster."
        ],
        behaviorTraits: [
            "Nocturnal, hiding by day in tree hollows or dense shrubs.",
            "Feeds on the leaves of the Lord Howe melaleuca (Melaleuca howeana) and a few other plants.",
            "Pairs rest together at night, with the male's legs wrapped around the female.",
            "Females lay eggs in soil; unmated females can also produce eggs that hatch."
        ],
        whyInteresting: [
            "It vanished from Lord Howe Island after black rats arrived from a shipwreck in 1918.",
            "Only 24 individuals were found on Ball's Pyramid in 2001, living around a single shrub.",
            "Melbourne Zoo bred thousands from one pair, and rats were eradicated from Lord Howe Island in 2019, opening the way to reintroduction."
        ],
        lookalikes: [
            "The goliath stick insect (Eurycnema goliath) is green and has wings.",
            "Macleay's spectre (Extatosoma tiaratum) is covered in leaf-like flaps and spines.",
            "Most other Australian stick insects are thinner, twig-like and brown or green."
        ]
    },
    stonefly: {
        summary: "The giant stonefly or salmonfly (Pteronarcys californica) is a large aquatic insect of cold, fast rivers in western North America. Adults reach about 5 cm long. Its nymphs live under rocks in riffles for about 3 years before emerging in large spring hatches.",
        identification: [
            "Long body with orange or reddish undersides and joints.",
            "Two pairs of dark, veined wings folded flat over the back.",
            "Two short tail filaments and long antennae.",
            "Large dark nymphs with branched gills under the thorax."
        ],
        behaviorTraits: [
            "Nymphs cling to rocks in fast, cold, well-oxygenated water.",
            "Nymphs shred and eat dead leaves and other plant material.",
            "Mature nymphs crawl onto rocks and streamside plants to molt into adults, mostly in late spring.",
            "Adults are clumsy fliers and live for a few weeks; females drop eggs onto the water."
        ],
        whyInteresting: [
            "Its hatch is famous among fly anglers because trout feed heavily on the large adults.",
            "Stoneflies are sensitive to pollution, so their presence indicates clean water.",
            "The nymph stage lasts 3 or more years, while adult life is only a few weeks."
        ],
        lookalikes: [
            "Golden stoneflies (Hesperoperla) are smaller and yellow-brown rather than orange-red.",
            "Mayflies hold their wings upright and have long tail filaments.",
            "Caddisflies hold hairy wings tent-like over the body."
        ]
    },
    "giant-tortoise": {
        summary: "Giant tortoises are the largest living land tortoises, surviving today on the Galápagos Islands (Chelonoidis) and on Aldabra Atoll in the Seychelles (Aldabrachelys gigantea). Large males weigh more than 250 kg. They are among the longest-lived animals on Earth.",
        identification: [
            "Massive domed or saddle-shaped shell, dark grey to brown.",
            "Thick, columnar legs covered in heavy scales.",
            "Long neck and blunt head.",
            "Aldabra tortoises have a nuchal scute above the neck; Galápagos tortoises lack it."
        ],
        behaviorTraits: [
            "Active by day, basking in the morning and sheltering from midday heat.",
            "Grazes grasses, browses shrubs and eats fallen fruit and cactus.",
            "Lives slowly, with a low metabolism, and can go long periods without food or water.",
            "Females lay clutches of eggs in dug nests; hatchlings receive no parental care."
        ],
        whyInteresting: [
            "Aldabra Atoll holds around 100,000 giant tortoises, the largest population in the world.",
            "Jonathan, a Seychelles giant tortoise on St Helena, is believed to have hatched around 1832 and is the oldest known living land animal.",
            "Giant tortoises once lived on many Indian Ocean islands but were wiped out by sailors who took them for food."
        ],
        lookalikes: [
            "The African spurred tortoise is the largest mainland tortoise but has a flatter, sandy shell and thigh spurs.",
            "The leopard tortoise has a high, yellow shell with black spotting.",
            "Galápagos and Aldabra tortoises differ in the nuchal scute and in shell shape."
        ]
    },
    "giant-waxy-monkey-tree-frog": {
        summary: "The giant monkey frog (Phyllomedusa bicolor) is a large tree frog of the Amazon rainforest canopy. Females reach about 12 cm long. It walks slowly along branches with grasping hands instead of jumping.",
        identification: [
            "Bright leaf-green back and cream to white underside.",
            "White spots edged in dark color along the sides and legs.",
            "Long limbs with opposable first fingers and toes for gripping.",
            "Large eyes with vertical pupils."
        ],
        behaviorTraits: [
            "Nocturnal, hunting insects in the canopy.",
            "Moves with a hand-over-hand walk along branches.",
            "Females lay eggs in leaf nests folded over the water.",
            "When the tadpoles hatch they drop into the pond below."
        ],
        whyInteresting: [
            "Its skin secretion contains peptides such as dermorphin and deltorphin, studied for their potent effects on opioid receptors.",
            "The secretion is scraped from the frog and used in a traditional Amazonian practice known as kambo.",
            "Its waxy skin coating helps reduce water loss in the canopy."
        ],
        lookalikes: [
            "The waxy monkey tree frog (Phyllomedusa sauvagii) of the Gran Chaco is smaller with a white lip stripe.",
            "The tiger-legged monkey frog (Pithecopus hypochondrialis) has orange-and-black stripes on its legs.",
            "Typical tree frogs (Hyla) jump rather than walk and lack opposable digits."
        ]
    },
    goose: {
        summary: "Geese are large waterfowl in the tribe Anserini, chiefly the grey geese (Anser) and black geese (Branta) of the Northern Hemisphere. They range from about 55 cm long in the red-breasted goose to over 1 m in the Canada goose. They are grazers that fly in V-shaped formations on long migrations.",
        identification: [
            "Long neck and a heavy body with legs set near the center, so they walk well on land.",
            "Stout bill with serrated edges for cropping grass.",
            "Grey, brown, black or white plumage, often with white markings on the face or rump.",
            "Loud honking calls in flight."
        ],
        behaviorTraits: [
            "Grazes grass, sedges and crops, and feeds on aquatic plants.",
            "Pairs form long-term bonds and families migrate together.",
            "Flocks fly in V formations, which save energy for the birds behind the leader.",
            "Lays about 4 to 7 eggs; the goslings follow their parents soon after hatching."
        ],
        whyInteresting: [
            "Bar-headed geese have been tracked flying over the Himalayas at more than 7,000 m.",
            "Domestic geese descend from the greylag goose and the swan goose.",
            "Hatchling geese imprint on the first moving object they see, as Konrad Lorenz demonstrated."
        ],
        lookalikes: [
            "Swans are larger, with much longer necks.",
            "Ducks are smaller, with shorter necks and flatter bills.",
            "Brant geese are smaller and darker than Canada geese and lack the white chinstrap."
        ]
    },
    grasshopper: {
        summary: "Grasshoppers (suborder Caelifera) are plant-eating insects with more than 11,000 species found in grasslands and open country worldwide. They range from about 1 cm to over 10 cm long. They leap with powerful hind legs and many species produce songs by rubbing a hind leg against a wing.",
        identification: [
            "Large, muscular hind legs for jumping.",
            "Short antennae, shorter than the body.",
            "Hearing organs on the sides of the abdomen.",
            "Green, brown or grey colors, with some species showing bright hindwings in flight."
        ],
        behaviorTraits: [
            "Active by day, especially in warm sunshine.",
            "Eats grasses and other plants with strong chewing mouthparts.",
            "Females lay eggs in pods in the soil.",
            "Nymphs resemble small wingless adults and grow through several molts."
        ],
        whyInteresting: [
            "Locusts are grasshoppers that change color and behavior when crowded and can form swarms of billions.",
            "A grasshopper can leap about 20 times its body length.",
            "Grasshoppers are eaten by people in many countries and are rich in protein."
        ],
        lookalikes: [
            "Katydids have very long, thread-like antennae and their ears are on the front legs.",
            "Crickets have long antennae, flat bodies and two tail-like cerci.",
            "Pygmy grasshoppers are small, with a long shield extending over the abdomen."
        ]
    },
    hartebeest: {
        summary: "The hartebeest (Alcelaphus buselaphus) is a large antelope of the African savannas and grasslands. It stands about 1.1 to 1.5 m at the shoulder and weighs roughly 100 to 200 kg. It has a long, narrow face and bracket-shaped horns on both sexes.",
        identification: [
            "Long, narrow face and high shoulders that slope to the rump.",
            "Both sexes have ringed horns rising from a bony pedicle and bending sharply back.",
            "Tawny to reddish-brown coat with darker markings in some subspecies.",
            "Short tail with a dark tuft."
        ],
        behaviorTraits: [
            "Active by day, grazing on grasses.",
            "Lives in herds of females and young, while adult males hold territories.",
            "Herd members keep watch for predators, often from termite mounds.",
            "Females give birth to a single calf after about 8 months."
        ],
        whyInteresting: [
            "It is one of the fastest antelopes, able to run at about 70 km/h.",
            "The North African subspecies, the bubal hartebeest, became extinct in the 20th century.",
            "Many subspecies, such as Coke's and the red hartebeest, differ in horn shape and color."
        ],
        lookalikes: [
            "The topi and tsessebe have dark purple patches on the legs and lack the tall horn pedicle.",
            "The wildebeest is darker, with a beard and mane.",
            "Lichtenstein's hartebeest has flatter horns and lives in miombo woodland."
        ]
    },
    hippopotamus: {
        summary: "The common hippopotamus (Hippopotamus amphibius) is a huge, semi-aquatic mammal of rivers and lakes in sub-Saharan Africa. Adult males commonly weigh about 1,500 kg, and large bulls exceed 3,000 kg. It spends the day in water and comes out at night to graze.",
        identification: [
            "Barrel-shaped body, short legs and a massive head.",
            "Eyes, ears and nostrils placed on top of the head so it can breathe and see while submerged.",
            "Grey-brown skin with pinkish areas and a reddish secretion.",
            "Huge mouth with tusk-like canine teeth."
        ],
        behaviorTraits: [
            "Rests in water by day and grazes on land at night, walking several kilometers.",
            "Eats mainly grass, taking about 35 kg or more each night.",
            "Lives in groups of 10 to 30 led by a dominant male.",
            "Females give birth to a single calf, often in water, after about 8 months."
        ],
        whyInteresting: [
            "Its skin produces a red secretion that acts as a sunscreen and antimicrobial.",
            "Its closest living relatives are whales and dolphins.",
            "Its canines can grow to about 50 cm long."
        ],
        lookalikes: [
            "The pygmy hippopotamus is much smaller, around 200 kg, and lives alone in West African forests.",
            "Rhinoceroses have horns and do not spend the day in water.",
            "Submerged hippos showing only eyes and nostrils can be mistaken for Nile crocodiles, which have long, narrow snouts and ridged, scaly backs."
        ]
    },
    "horned-lizard": {
        summary: "The Texas horned lizard (Phrynosoma cornutum) is a flat-bodied lizard of deserts and dry grasslands in the south-central United States and northern Mexico. Adults reach about 7 to 11 cm from snout to vent. It is famous for squirting blood from its eyes to deter predators.",
        identification: [
            "Wide, flat body covered in pointed scales.",
            "Crown of horns on the head, with two long central horns.",
            "Two rows of fringe scales along each side.",
            "Brown, tan or reddish color with dark spots and a pale stripe down the back."
        ],
        behaviorTraits: [
            "Active by day and buries itself in sand at night.",
            "Feeds mainly on harvester ants, licking them up from the ground.",
            "Relies on camouflage and stays still when approached.",
            "Females lay clutches of about two dozen eggs in burrows."
        ],
        whyInteresting: [
            "It can squirt blood from its eyes up to about 1.5 m, which deters dogs and coyotes.",
            "It is the state reptile of Texas.",
            "It has declined because of pesticide use, habitat loss and the spread of invasive fire ants."
        ],
        lookalikes: [
            "The round-tailed horned lizard is smaller, with short horns and no fringe scales.",
            "The desert horned lizard has short horns and a single row of fringe scales.",
            "Spiny lizards have no horns, long tails and climb trees."
        ]
    },
    "jewel-wasp": {
        summary: "The jewel wasp or emerald cockroach wasp (Ampulex compressa) is a solitary wasp of tropical Africa, southern Asia and Pacific islands. Females are about 2 cm long. It turns cockroaches into living hosts for its larvae.",
        identification: [
            "Metallic blue-green body.",
            "Red upper parts of the middle and hind legs.",
            "Slender waist and long legs.",
            "Short antennae."
        ],
        behaviorTraits: [
            "Active by day, foraging for nectar and honeydew.",
            "Females hunt cockroaches, stinging them twice to paralyze and sedate them.",
            "The wasp leads the cockroach by its antenna to a burrow and lays a single egg on it.",
            "The larva feeds on the cockroach, pupates inside it, and emerges as an adult."
        ],
        whyInteresting: [
            "The second sting goes into the cockroach's brain, which suppresses its escape behavior.",
            "It was introduced to Hawaii in 1941 to control cockroaches.",
            "Its venom effects are studied by neuroscientists."
        ],
        lookalikes: [
            "Cuckoo wasps are metallic but have pitted bodies and can roll into a ball.",
            "Orchid bees are metallic green but hairy and bee-shaped.",
            "Sweat bees can be metallic green but are smaller and hairy."
        ]
    },
    "kirk-dik-dik": {
        summary: "Kirk's dik-dik (Madoqua kirkii) is a tiny antelope of thorn scrub in East Africa and southwestern Africa. It stands about 35 to 45 cm at the shoulder and weighs about 4 to 7 kg. It lives in monogamous pairs that defend small territories.",
        identification: [
            "Grizzled grey-brown back and tan flanks.",
            "Large dark eyes ringed in white.",
            "Long, mobile snout.",
            "Males have short, spiky horns, often partly hidden by a forehead tuft."
        ],
        behaviorTraits: [
            "Active at dawn, dusk and night.",
            "Browses leaves, shoots and fruit, and rarely needs to drink.",
            "Pairs mark their territory with dung piles and eye-gland secretions.",
            "Females give birth to a single young after about 6 months."
        ],
        whyInteresting: [
            "It has two separate populations: one in Kenya and Tanzania and another in Namibia and Angola.",
            "Females are slightly larger than males.",
            "Its alarm call gives the dik-dik its name."
        ],
        lookalikes: [
            "Günther's dik-dik has a longer snout and lives in northern Kenya, Somalia and Ethiopia.",
            "Salt's dik-dik lives in Ethiopia and Somalia and has more reddish coloring.",
            "The steenbok is larger, redder and lacks a forehead tuft."
        ]
    },
    lammergeier: {
        summary: "The lammergeier or bearded vulture (Gypaetus barbatus) is a large vulture of high mountains in southern Europe, Africa, the Middle East and Central Asia to the Himalayas. Its wingspan is about 2.3 to 2.8 m. It is the only vertebrate whose diet is made up mostly of bone.",
        identification: [
            "Long, narrow, pointed wings and a long, wedge- or diamond-shaped tail that make it look like a giant falcon in flight.",
            "Tuft of black bristles hanging below the bill, giving the beard of its name.",
            "Rust-orange head, breast and belly in adults, contrasting with slate-grey upperparts.",
            "Pale eye surrounded by a bright red ring; juveniles are dark brown all over."
        ],
        behaviorTraits: [
            "Active by day, gliding low along cliffs and slopes to search for carcasses.",
            "Swallows bones up to about the size of a lamb's vertebra whole and digests them with very strong stomach acid.",
            "Carries larger bones up to 50 m or more and drops them onto rock slabs to shatter them.",
            "Pairs breed in winter in cliff caves, laying 1 or 2 eggs; normally only one chick is raised."
        ],
        whyInteresting: [
            "Bone and marrow make up about 70 to 90 percent of its diet.",
            "The orange color is cosmetic: the birds bathe in iron-oxide-rich mud and water, staining feathers that would otherwise be white.",
            "After being wiped out in the Alps by the early 20th century, it was reintroduced there from 1986 and now breeds in the wild again."
        ],
        lookalikes: [
            "The Egyptian vulture is much smaller, mostly white with a bare yellow face and a short wedge-shaped tail.",
            "The golden eagle has broader wings, a shorter square tail and no beard.",
            "The griffon vulture has broad, rectangular wings, a short tail and a pale bare head and neck."
        ]
    },
    lizard: {
        summary: "Lizards are scaled reptiles of the suborder Lacertilia, with more than 7,000 species living on every continent except Antarctica. They range from dwarf geckos and chameleons under 2 cm long to the Komodo dragon at about 3 m. Most have four legs, external ear openings and movable eyelids, which separate them from snakes.",
        identification: [
            "Dry, scaly skin and, in most species, four legs with clawed toes.",
            "Visible ear openings and eyelids that can blink, although geckos and some others have fixed clear eyelids.",
            "Long tail that in many species can be shed and partly regrown.",
            "Shapes range from flat, spiny horned lizards and crested iguanas to legless glass lizards."
        ],
        behaviorTraits: [
            "Most are active by day and regulate body temperature by basking and seeking shade; geckos are mostly nocturnal.",
            "Most eat insects and other invertebrates; iguanas and some others are herbivores, and monitors take vertebrate prey.",
            "Many species defend territories with displays such as head-bobbing, push-ups and throat fans.",
            "Most lay eggs, but many skinks and other cold-climate species give birth to live young."
        ],
        whyInteresting: [
            "Several whiptail lizard species consist entirely of females that reproduce by parthenogenesis.",
            "Geckos climb glass using millions of microscopic hair-like setae on their toe pads.",
            "The Komodo dragon is the heaviest living lizard, with large males weighing around 70 kg or more."
        ],
        lookalikes: [
            "Salamanders and newts have smooth, moist skin without scales and no claws.",
            "Snakes have no eyelids or external ear openings, which distinguishes them from legless lizards.",
            "The tuatara of New Zealand looks like a lizard but is the last member of a separate reptile order, Rhynchocephalia."
        ]
    },
    "mantled-guereza": {
        summary: "The mantled guereza (Colobus guereza) is a black-and-white colobus monkey of forests across central and East Africa, from Nigeria and Cameroon to Ethiopia, Kenya and Tanzania. Males weigh about 13.5 kg and females about 9 kg. It is named for the long white fringe, or mantle, that hangs along its sides and back.",
        identification: [
            "Glossy black body with a long white U-shaped mantle of hair along the flanks and lower back.",
            "White fur framing the black face and a long tail ending in a large, bushy white tuft.",
            "Hands with no thumb, or only a tiny stub, an adaptation for swinging through branches.",
            "Newborn infants are entirely white."
        ],
        behaviorTraits: [
            "Active by day and spends most of its time in the canopy, resting for long periods after feeding.",
            "Eats mainly leaves, plus fruit and seeds, digested by bacteria in a multi-chambered stomach.",
            "Lives in groups of about 3 to 15 animals, usually with one adult male, several females and young.",
            "Males give loud, rolling roars, especially at dawn, which help space groups apart."
        ],
        whyInteresting: [
            "Its chambered stomach ferments leaves much as a cow's stomach does, letting it live on hard-to-digest foliage.",
            "Females other than the mother often carry and care for infants, a behavior called allomothering.",
            "Its pelts were heavily traded in the 19th and early 20th centuries."
        ],
        lookalikes: [
            "The Angola colobus (Colobus angolensis) has long white shoulder tufts rather than a mantle along the flanks.",
            "The king colobus (Colobus polykomos) of West Africa has a white chest and tail but no long side mantle.",
            "The ursine colobus (Colobus vellerosus) has white thigh patches and a white face ring but lacks the mantle."
        ]
    },
    "mata-mata-turtle": {
        summary: "The mata mata (Chelus fimbriata) is a freshwater side-necked turtle of the Amazon basin in South America, living in slow streams, swamps and flooded forest. Its shell reaches about 45 cm long. It catches fish by suction, gaping its mouth and expanding its throat to pull prey in.",
        identification: [
            "Broad, flat, triangular head fringed with loose flaps of skin.",
            "Long, tube-like snout used as a snorkel to breathe while staying on the bottom.",
            "Rough brown carapace with three knobby ridges running lengthwise.",
            "Long, thick neck that folds sideways under the edge of the shell instead of pulling straight back."
        ],
        behaviorTraits: [
            "Lies motionless in shallow, murky water and waits for fish to come close.",
            "Feeds mainly on fish and aquatic invertebrates, swallowing them whole because it cannot chew.",
            "Strikes by opening the mouth and suddenly expanding the throat, then expels the excess water.",
            "Females come ashore to lay clutches of about 12 to 28 nearly spherical eggs."
        ],
        whyInteresting: [
            "A 2020 genetic study split it into two species, Chelus fimbriata of the Amazon and Chelus orinocensis of the Orinoco and Rio Negro.",
            "Algae often grows on its shell, adding to its camouflage as a pile of leaves or bark.",
            "It is so poorly built for walking that it rarely leaves the water except to nest."
        ],
        lookalikes: [
            "The alligator snapping turtle of North America has a hooked beak, a worm-like tongue lure and pulls its head straight back.",
            "South American snake-necked turtles (Hydromedusa) have smooth shells and narrow, pointed heads without skin flaps.",
            "The twist-necked turtle (Platemys platycephala) is much smaller, with a flat, orange-and-brown shell."
        ]
    },
    "assassin-bug": {
        summary: "The milkweed assassin bug (Zelus longipes) is a predatory true bug of gardens, fields and scrub from the southern United States through Central America and the Caribbean to South America. It is about 1.5 cm long. It ambushes other insects on plants and stabs them with a curved, piercing beak.",
        identification: [
            "Slender orange-red to reddish body with black markings on the head, thorax and wing membranes.",
            "Very long, thin legs, the hind pair banded black and pale.",
            "Narrow head with a long, curved beak tucked under the body at rest.",
            "Long, thin antennae."
        ],
        behaviorTraits: [
            "Active by day, waiting motionless on flowers, stems and leaves for prey.",
            "Catches flies, caterpillars, beetles, bees and other soft-bodied insects.",
            "Injects saliva that paralyzes the prey and liquefies its tissues, then sucks out the contents.",
            "Females lay clusters of eggs glued upright on leaves; nymphs are also predators."
        ],
        whyInteresting: [
            "It coats its forelegs with sticky plant resin and gland secretions that help hold struggling prey.",
            "Its bite is painful to people but not dangerous.",
            "Despite its common name it does not depend on milkweed and hunts on many kinds of plants."
        ],
        lookalikes: [
            "The large milkweed bug (Oncopeltus fasciatus) is orange and black with shorter legs and a broader body, and feeds on milkweed seeds.",
            "The wheel bug (Arilus cristatus) is a larger, grey assassin bug with a cogwheel-shaped crest on its back.",
            "The pale green assassin bug (Zelus luridus) has a similar build but is mostly green."
        ]
    },
    "walking-stick": {
        summary: "The northern walkingstick (Diapheromera femorata) is a wingless stick insect of deciduous forests in eastern and central North America. Females reach about 9.5 cm long and males about 7.5 cm. It relies on its twig-like shape and slow movement to escape notice.",
        identification: [
            "Long, thin, cylindrical body with long legs and no wings.",
            "Males are usually brown and slimmer; females are larger and greenish-brown or grey.",
            "Antennae about two-thirds the length of the body.",
            "Males have thickened, banded middle legs and clasping appendages at the tip of the abdomen."
        ],
        behaviorTraits: [
            "Mainly active at night, feeding in the tree canopy and staying still by day.",
            "Eats the leaves of oaks, hazelnut, black cherry and other broadleaf trees.",
            "Sways gently when moving, imitating a twig in the breeze.",
            "Females drop eggs one by one from the canopy to the forest floor, where they overwinter."
        ],
        whyInteresting: [
            "Some eggs take two winters before hatching.",
            "In outbreak years it has defoliated large areas of oak forest in the Midwest.",
            "It is the most widespread stick insect in North America."
        ],
        lookalikes: [
            "The southern two-striped walkingstick (Anisomorpha buprestoides) is stout, brown with black stripes and sprays a defensive chemical.",
            "Praying mantises have triangular heads, wings and raptorial front legs.",
            "The giant walkingstick (Megaphasma denticrus) is longer, often over 15 cm, and is the longest insect in the United States."
        ]
    },
    "norwegian-forest-cat": {
        summary: "The Norwegian Forest Cat is a large, long-haired domestic cat breed (Felis catus) that developed naturally in the cold forests and farms of Norway. Males usually weigh about 5.5 to 9 kg. Its dense double coat sheds water and keeps out cold.",
        identification: [
            "Long, water-resistant topcoat over a thick woolly undercoat, with a full ruff around the neck and long fur on the hind legs.",
            "Long, bushy tail about as long as the body.",
            "Triangular head with a straight profile from brow to nose tip.",
            "Large, tufted ears and almond-shaped eyes."
        ],
        behaviorTraits: [
            "Strong, agile climber with heavy claws, often choosing high perches.",
            "Like other cats it is most active at dawn and dusk and eats a meat-based diet.",
            "Sheds much of its undercoat each spring.",
            "Typically sociable with people but less demanding than many breeds."
        ],
        whyInteresting: [
            "The breed was recognized internationally by FIFé in 1977 after Norwegian breeders worked to preserve it.",
            "Norwegian folklore describes forest cats, the skogkatt, and the breed is often linked to them.",
            "It matures slowly and may not reach full size until about 5 years old."
        ],
        lookalikes: [
            "The Maine Coon has a more rectangular body, a squarer muzzle and a gently curved profile.",
            "The Siberian has a rounder head and body and a less triangular face.",
            "The Ragdoll is a long-haired breed with a colorpoint pattern and blue eyes."
        ]
    },
    "fire-bellied-toad": {
        summary: "The oriental fire-bellied toad (Bombina orientalis) is a small, semi-aquatic frog of ponds, streams and wet woodland in Korea, northeastern China and the Russian Far East. It is about 4 to 5 cm long. Its bright red or orange belly warns predators that its skin is toxic.",
        identification: [
            "Bright green to brown back with irregular black blotches and small warts.",
            "Vivid red, orange or yellow-orange belly marbled with black.",
            "Triangular or heart-shaped pupils.",
            "Flattened body; males give a soft, repeated barking or ringing call from the water."
        ],
        behaviorTraits: [
            "Active by day, floating in shallow water or sitting at the edge.",
            "Eats insects, worms, snails and other small invertebrates, lunging at them because its tongue cannot be flicked out.",
            "When threatened it arches its back and raises its limbs to flash the bright underside, a posture called the unken reflex.",
            "Breeds in spring and summer, attaching small clumps of eggs to underwater plants and stones."
        ],
        whyInteresting: [
            "Its skin secretions contain irritant peptides, including bombesin, which has been studied in medical research.",
            "It is one of the most widely kept frogs in the pet trade.",
            "Bombina toads belong to an old lineage separate from typical frogs and toads."
        ],
        lookalikes: [
            "The European fire-bellied toad (Bombina bombina) has a dark grey-brown back and a red-and-black belly.",
            "The yellow-bellied toad (Bombina variegata) of Europe has a yellow-and-black belly.",
            "Asian tree frogs and pond frogs lack the bright belly and have smoother skin and round pupils."
        ]
    },
    otter: {
        summary: "Otters are 13 species of semi-aquatic carnivores in the weasel family subfamily Lutrinae, living in rivers, lakes and coasts on every continent except Australia and Antarctica. They range from the Asian small-clawed otter at a few kilograms to the sea otter, which can weigh about 45 kg, and the giant otter at about 1.8 m long. All have dense, waterproof fur and webbed feet.",
        identification: [
            "Long, streamlined body, short legs and a thick, tapering tail.",
            "Dense brown fur that looks dark and sleek when wet.",
            "Broad, flat head with small ears and long whiskers.",
            "Swims low with only the head showing, often porpoising in and out of the water."
        ],
        behaviorTraits: [
            "Activity varies by species and disturbance; many river otters are most active at night, dawn and dusk.",
            "Eats fish, crabs, crayfish, frogs and shellfish; sea otters also eat sea urchins.",
            "Eurasian and North American river otters are mostly solitary, while giant otters live in family groups.",
            "Most species have litters of 1 to 4 cubs born in a den or holt."
        ],
        whyInteresting: [
            "Sea otters have the densest fur of any mammal, up to about 150,000 hairs per square centimeter.",
            "Sea otters use rocks as tools to crack open shellfish.",
            "Eurasian otters mark their ranges with droppings called spraints."
        ],
        lookalikes: [
            "The American mink is smaller, with less webbed feet and a shorter tail, and lacks a broad, flat head.",
            "The beaver has a flat, paddle-shaped tail and swims with the head and back showing.",
            "The muskrat is smaller, with a thin, scaly tail."
        ]
    },
    owl: {
        summary: "Owls are birds of prey in the order Strigiformes, with about 250 species found on every continent except Antarctica. They range from the elf owl at about 13 cm long to the Eurasian eagle-owl, which can reach about 75 cm with a wingspan near 2 m. Most hunt at night using sharp hearing and silent flight.",
        identification: [
            "Large, forward-facing eyes set in a flat facial disc.",
            "Hooked bill and strong, sharp talons.",
            "Soft plumage, often barred or mottled in brown, grey or white.",
            "Some species have feather tufts on the head that look like ears."
        ],
        behaviorTraits: [
            "Most species are nocturnal or crepuscular, but some, like the snowy owl and the burrowing owl, hunt by day.",
            "Hunts rodents, birds, insects and fish, swallowing prey whole and later regurgitating pellets.",
            "Many species nest in tree cavities, old nests of other birds or burrows.",
            "Eggs are white and hatch at intervals, so chicks in one nest differ in size."
        ],
        whyInteresting: [
            "An owl can rotate its head about 270 degrees because its eyes cannot move in their sockets.",
            "The barn owl's ears are set at different heights, letting it locate prey in total darkness.",
            "Comb-like edges on the flight feathers break up air flow and make flight almost silent."
        ],
        lookalikes: [
            "Hawks have eyes on the sides of the head and no facial disc.",
            "Nightjars are nocturnal but have tiny bills, wide gapes and long, pointed wings.",
            "The northern harrier has an owl-like facial disc but a long tail and a white rump."
        ]
    },
    "pallas-cat": {
        summary: "Pallas's cat or the manul (Otocolobus manul) is a small wild cat of cold steppes and rocky high plateaus in Central Asia, from Iran to Mongolia and the Tibetan Plateau. It is about the size of a domestic cat, with a head and body of about 46 to 65 cm and a weight of 2.5 to 4.5 kg. Its long, dense fur and low, flat face give it a stocky look.",
        identification: [
            "Flat, broad face with short, rounded ears set low on the sides of the head.",
            "Long, dense grey to yellowish-buff fur with faint dark bars on the back.",
            "Thick tail with narrow black rings and a black tip.",
            "Round pupils, unlike the slit pupils of most small cats."
        ],
        behaviorTraits: [
            "Most active at dawn and dusk, resting by day in rock crevices and old marmot burrows.",
            "Hunts pikas, voles and other small rodents by stalking or waiting near burrows.",
            "Solitary except during the short breeding season.",
            "Females give birth to litters of about 2 to 6 kittens after about 66 to 75 days."
        ],
        whyInteresting: [
            "It has the longest and densest fur of any cat, which helps it survive temperatures well below freezing.",
            "Its low ears help it peer over rocks without being seen.",
            "Pika poisoning campaigns on the steppe have reduced its main prey in parts of its range."
        ],
        lookalikes: [
            "The domestic cat has taller ears, slit pupils and a less flattened face.",
            "The Asiatic wildcat has longer legs, spotting on the body and a thinner tail.",
            "The sand cat is smaller, pale sandy and has large ears."
        ]
    },
    penguin: {
        summary: "Penguins are flightless seabirds of the family Spheniscidae, with about 18 species found almost entirely in the Southern Hemisphere. They range from the little penguin at about 30 cm tall and 1 kg to the emperor penguin at about 1.1 m and up to around 40 kg. Their wings have evolved into stiff flippers for swimming.",
        identification: [
            "Upright posture on land, walking or hopping on short legs.",
            "Dark back and white front, with some species showing yellow crests, orange bills or neck bands.",
            "Stiff, flattened flippers instead of flying wings.",
            "Dense, short feathers that form a waterproof layer."
        ],
        behaviorTraits: [
            "Active by day at sea, diving to catch fish, squid and krill.",
            "Breeds in colonies that can number in the hundreds of thousands.",
            "Pairs often reunite with the same mate at the same site each year.",
            "Most species lay 1 or 2 eggs, and both parents share incubation and feeding."
        ],
        whyInteresting: [
            "Emperor penguins have been recorded diving to more than 500 m and holding their breath for over 20 minutes.",
            "Male emperor penguins incubate the egg on their feet for about 2 months during the Antarctic winter without eating.",
            "The Galápagos penguin lives near the equator, the farthest north of any penguin."
        ],
        lookalikes: [
            "Auks such as puffins and murres look similar but can fly and live in the Northern Hemisphere.",
            "Cormorants swim like penguins but fly and have hooked bills.",
            "Among penguins, macaroni penguins have yellow crests that meet across the forehead, while rockhopper crests start above each eye and stay separate."
        ]
    },
    pig: {
        summary: "The domestic pig (Sus scrofa domesticus) is a hoofed mammal domesticated from the wild boar around 9,000 to 10,000 years ago in the Near East and China. It is now raised worldwide, with adults commonly weighing 50 to more than 300 kg. It is intelligent, social and omnivorous.",
        identification: [
            "Heavy body, short legs and a flat, disc-shaped snout.",
            "Sparse bristly hair in pink, black, brown, red or spotted coloring depending on breed.",
            "Cloven hooves with two main toes on each foot.",
            "Small eyes and upright or floppy ears."
        ],
        behaviorTraits: [
            "Active by day and spends much time rooting in soil for food.",
            "Eats plants, roots, insects and almost any other food it can find.",
            "Sows live in groups with their young; males are usually kept separate.",
            "Sows give birth to litters of about 8 to 12 piglets after about 114 days."
        ],
        whyInteresting: [
            "There are about one billion pigs in the world.",
            "Pigs have few sweat glands and cool themselves by wallowing in mud.",
            "Pigs can use mirrors to find hidden food, showing advanced problem-solving."
        ],
        lookalikes: [
            "The wild boar has a dense, dark bristly coat and a larger head, and its piglets are striped.",
            "Peccaries look pig-like but have a scent gland on the back and three toes on the hind feet.",
            "Warthogs have large tusks and warts on the face."
        ]
    },
    pigeon: {
        summary: "The domestic pigeon (Columba livia domestica) is a bird descended from the rock dove, now found in cities and farmland worldwide. It is about 30 to 35 cm long and weighs around 300 g. It is famous for its ability to find its way home over long distances.",
        identification: [
            "Plump body with a small head and short legs.",
            "Grey plumage with two dark wing bars and iridescent green and purple on the neck.",
            "White rump in the wild-type pattern, though colors vary widely.",
            "Soft cooing calls."
        ],
        behaviorTraits: [
            "Active by day, walking on the ground with a head-bobbing gait while it feeds.",
            "Eats seeds and grain and, in cities, bread and other food scraps.",
            "Lives in flocks and nests on building ledges, bridges and cliffs, as its wild rock dove ancestor nests on sea cliffs.",
            "Pairs can breed year-round, raising several broods of 2 eggs each in a flimsy nest."
        ],
        whyInteresting: [
            "Racing pigeons can return home from more than 1,000 km away, navigating with the sun and Earth's magnetic field.",
            "Pigeons drink by sucking water, unlike most birds, which tip their heads back.",
            "Both parents feed the young on crop milk, a protein-rich secretion from the lining of the crop."
        ],
        lookalikes: [
            "The Eurasian collared dove is paler, with a black half-collar.",
            "The mourning dove is slimmer, with a long, pointed tail.",
            "The common wood pigeon is larger, with white neck and wing patches."
        ]
    },
    raven: {
        summary: "The common raven (Corvus corax) is the largest member of the crow family, found across the Northern Hemisphere from Arctic tundra to deserts and mountains. It is about 54 to 67 cm long, with a wingspan of up to about 1.5 m. It is known for problem-solving, play and a wide range of calls.",
        identification: [
            "Entirely glossy black plumage, legs and bill.",
            "Heavy, deep bill and shaggy feathers on the throat.",
            "Long, wedge-shaped tail visible in flight.",
            "Deep, croaking gronk call, quite different from a crow's caw."
        ],
        behaviorTraits: [
            "Active by day and often soars or performs aerial rolls.",
            "Omnivorous scavenger that eats carrion, small animals, eggs, grain and human food waste.",
            "Pairs hold territories for years and often mate for life.",
            "Builds large stick nests on cliffs, trees or towers and lays 3 to 7 eggs."
        ],
        whyInteresting: [
            "Ravens hide surplus food and will move their caches if they see another raven watching.",
            "They follow wolves and other predators to scavenge from their kills.",
            "Captive ravens have solved multi-step puzzles and planned for future tool use in experiments."
        ],
        lookalikes: [
            "The American crow and carrion crow are smaller, with fan-shaped tails and a higher caw.",
            "The Chihuahuan raven of the southwestern United States is smaller, with white bases to the neck feathers.",
            "The rook has a bare, greyish-white face patch at the base of the bill."
        ]
    },
    "robber-fly": {
        summary: "The red-footed cannibalfly (Promachus rufipes) is a large robber fly of fields and woodland edges in the eastern and southern United States. It is one of the biggest robber flies in North America, often more than 3 cm long. It catches insects in midair, including bees, wasps and dragonflies.",
        identification: [
            "Large, elongated body with a dark thorax and a black abdomen marked with pale bands.",
            "Reddish-brown legs covered in stiff bristles.",
            "Bristly mustache (mystax) on the face below large compound eyes.",
            "Smoky-brown wings held over the back at rest."
        ],
        behaviorTraits: [
            "Active on sunny summer days, perching on twigs or tall plants to watch for prey.",
            "Launches out to seize flying insects with its legs, then returns to a perch to feed.",
            "Injects saliva that paralyzes the prey and digests its tissues, then sucks out the fluids.",
            "Larvae live in soil or rotting wood and prey on other insect larvae."
        ],
        whyInteresting: [
            "Robber flies (family Asilidae) include more than 7,000 species worldwide.",
            "This species is a frequent predator of honey bees and will take large prey such as cicadas.",
            "Its name reflects the habit of robber flies catching other robber flies."
        ],
        lookalikes: [
            "Horse flies are stouter with very large eyes and no facial beard.",
            "Other Promachus bee killers have a similar shape but differ in leg color and abdominal banding.",
            "Dragonflies have four long transparent wings and catch prey in flight but lack the bearded face."
        ]
    },
    "reeves-muntjac": {
        summary: "Reeves's muntjac (Muntiacus reevesi) is a small deer native to southeastern China and Taiwan, introduced to England and other parts of Europe. It stands about 45 to 52 cm at the shoulder and weighs about 10 to 18 kg. It is known as the barking deer because of its loud, repetitive alarm call.",
        identification: [
            "Small, compact, reddish-brown body with a pale belly and throat.",
            "Males have short, single antlers on long, furry pedicles and tusk-like upper canines.",
            "V-shaped dark ridges on the face from the antlers toward the nose.",
            "Tail raised to show a white underside when alarmed."
        ],
        behaviorTraits: [
            "Most active at dawn and dusk, browsing in dense cover.",
            "Eats leaves, shoots, fruit, nuts and fungi.",
            "Solitary or found in pairs; males defend small territories.",
            "Breeds at any time of year; females can mate again soon after giving birth."
        ],
        whyInteresting: [
            "Its barking call can continue for many minutes.",
            "Since escaping from Woburn Abbey in the early 20th century, it has spread across much of England.",
            "The related Indian muntjac has the lowest chromosome number of any mammal, with females having only 6."
        ],
        lookalikes: [
            "The Chinese water deer has no antlers, larger tusks and round teddy-bear ears.",
            "The roe deer is larger, with a white rump and no tusks.",
            "The Indian muntjac is larger and more reddish, with longer antlers."
        ]
    },
    robin: {
        summary: "Robin is the name of two different songbirds: the European robin (Erithacus rubecula), an Old World flycatcher of Europe and western Asia, and the American robin (Turdus migratorius), a thrush of North America. The European robin is about 13 cm long, while the American robin is about 25 cm. Both have orange-red breasts and are common in gardens.",
        identification: [
            "European robin: small, round, olive-brown above with an orange-red face and breast bordered with grey.",
            "American robin: larger, grey-brown above with a brick-red breast and a dark head.",
            "Both have thin bills and upright posture.",
            "Both sing clear, melodic songs, often at dawn."
        ],
        behaviorTraits: [
            "Both forage on the ground for earthworms and insects, the American robin running and pausing to look.",
            "European robins hold territories year-round, and both sexes sing in winter.",
            "American robins form flocks in winter and eat berries.",
            "Both build cup nests; the American robin lays 3 to 5 sky-blue eggs."
        ],
        whyInteresting: [
            "European robins often follow gardeners and wild boars to catch disturbed worms.",
            "The American robin is the state bird of Connecticut, Michigan and Wisconsin.",
            "The color robin's egg blue is named after the American robin's eggs."
        ],
        lookalikes: [
            "The Eurasian bullfinch has a pinkish breast and a black cap.",
            "The varied thrush has an orange breast with a black band.",
            "The eastern towhee has a black hood and rufous sides."
        ]
    },
    sable: {
        summary: "The sable (Martes zibellina) is a small carnivore of the weasel family that lives in the taiga forests of Russia, northern Mongolia, northeastern China and Hokkaido. It has a head and body about 35 to 56 cm long and weighs about 0.7 to 1.8 kg. It is famous for its soft, dark fur.",
        identification: [
            "Long, slender body with short legs and a bushy tail.",
            "Glossy brown to almost black fur, often with a paler throat patch.",
            "Large, furry paws for walking on snow.",
            "Pointed face and rounded ears."
        ],
        behaviorTraits: [
            "Active mainly at dawn and dusk, hunting on the ground and in trees.",
            "Eats voles, chipmunks, pikas and birds, plus pine nuts and berries.",
            "Solitary, with each animal holding its own range.",
            "Mates in summer, but delayed implantation means young are born the following spring."
        ],
        whyInteresting: [
            "The search for sable fur drove Russian expansion into Siberia from the 16th century.",
            "Including delayed implantation, pregnancy lasts about 250 to 300 days.",
            "It often makes its den in tree hollows or under roots and snow."
        ],
        lookalikes: [
            "The pine marten is larger with a yellow-orange throat bib and a longer tail.",
            "The American marten is lighter brown with a pale throat.",
            "The American mink lives near water and has only a small white chin patch."
        ]
    },
    sailfish: {
        summary: "The sailfish (Istiophorus platypterus) is a large billfish of warm and tropical seas worldwide. It can reach about 3 m long and around 100 kg. It has a tall, sail-like dorsal fin and a long, spear-shaped bill.",
        identification: [
            "Huge dorsal fin that can be raised like a sail or folded into a groove.",
            "Long, slender bill.",
            "Dark blue back, silvery sides and pale vertical bars or spots.",
            "Long, thin pelvic fins."
        ],
        behaviorTraits: [
            "Hunts near the surface in open water.",
            "Groups herd schools of sardines and anchovies into bait balls.",
            "Slashes prey with its bill to stun or injure it.",
            "Spawns in open water; females release millions of eggs."
        ],
        whyInteresting: [
            "Popular claims of speeds above 100 km/h are not supported by modern measurements, which show burst speeds closer to 30 km/h.",
            "It can change color rapidly, flashing stripes while hunting.",
            "Filmed hunts show sailfish taking turns to attack a bait ball, with only a few prey injured per bill slash."
        ],
        lookalikes: [
            "Marlins have a lower, shorter dorsal fin and bulkier bodies.",
            "The swordfish has a flat, broad bill and no pelvic fins.",
            "Spearfish have shorter bills and lower dorsal fins."
        ]
    },
    "sea-turtle": {
        summary: "Sea turtles (superfamily Chelonioidea) are seven species of marine reptiles found in tropical and temperate oceans worldwide. They range from Kemp's ridley, with a shell about 65 cm long, to the leatherback, which can exceed 2 m and 500 kg. Females return to the beaches where they hatched to lay their eggs.",
        identification: [
            "Streamlined shell and paddle-like front flippers.",
            "Head and flippers cannot be pulled into the shell.",
            "Shell colors range from olive-green and brown to the leathery black skin of the leatherback.",
            "Species are told apart by head shape and the number and arrangement of shell and face scales."
        ],
        behaviorTraits: [
            "Spends nearly all its life at sea, coming ashore only to nest or, in some species, to bask.",
            "Diets vary: green turtles graze seagrass and algae, hawksbills eat sponges, loggerheads crush crabs and mollusks, and leatherbacks eat jellyfish.",
            "Many migrate thousands of kilometers between feeding and nesting areas.",
            "Females lay clutches of about 100 eggs in sand pits several times in a season."
        ],
        whyInteresting: [
            "Nest temperature determines the sex of hatchlings; warmer sand produces more females.",
            "Leatherbacks have been recorded diving deeper than 1,000 m.",
            "Six of the seven species are listed as threatened by the IUCN or classed as Data Deficient."
        ],
        lookalikes: [
            "Freshwater turtles have clawed, webbed feet rather than flippers and can usually retract the head.",
            "The green turtle has a small, rounded head with one pair of scales between the eyes, while the loggerhead has a large head with two pairs.",
            "The hawksbill has a narrow, pointed beak and overlapping shell plates."
        ]
    },
    seal: {
        summary: "Seals are marine mammals in the group Pinnipedia, which includes about 33 species of true seals, eared seals (sea lions and fur seals) and the walrus. They range from the ringed seal at about 1.5 m and 70 kg to the southern elephant seal, whose males can reach about 4,000 kg. They hunt at sea but rest and give birth on land or ice.",
        identification: [
            "Torpedo-shaped body with flippers instead of legs.",
            "True seals have no visible ear flaps and move on land by wriggling on their bellies.",
            "Eared seals have small ear flaps and can turn their hind flippers forward to walk.",
            "Short fur over a thick layer of blubber."
        ],
        behaviorTraits: [
            "Most feed at sea on fish, squid and crustaceans, diving repeatedly.",
            "Haul out on beaches, rocks or ice to rest, molt and give birth.",
            "Many species gather in large colonies during breeding.",
            "Most females give birth to a single pup each year."
        ],
        whyInteresting: [
            "Southern elephant seals can dive deeper than 2,000 m.",
            "The Baikal seal lives only in Lake Baikal, a freshwater lake in Siberia.",
            "Weddell seals can stay underwater for over an hour."
        ],
        lookalikes: [
            "Sea lions have ear flaps and walk on four flippers, unlike true seals.",
            "The walrus has long tusks and a heavy, wrinkled body.",
            "The sea otter is much smaller, with dense fur and front paws."
        ]
    },
    shark: {
        summary: "Sharks are cartilaginous fishes of the group Selachimorpha, with more than 500 species in oceans worldwide. They range from the dwarf lanternshark at about 20 cm to the whale shark, the largest fish, at about 12 m or more. They have skeletons of cartilage rather than bone and replace their teeth throughout life.",
        identification: [
            "Streamlined body with five to seven gill slits on each side of the head.",
            "Rough skin covered in tiny tooth-like scales called dermal denticles.",
            "Tail with a larger upper lobe in most species.",
            "Triangular dorsal fin and stiff pectoral fins."
        ],
        behaviorTraits: [
            "Many species hunt at dusk or night, though some feed by day.",
            "Most are predators of fish, squid and other animals; the whale shark and basking shark filter plankton.",
            "Detect prey with smell, lateral lines and electroreceptors called ampullae of Lorenzini.",
            "Fertilization is internal; some species lay egg cases, while others give birth to live young."
        ],
        whyInteresting: [
            "The Greenland shark is estimated to live at least 272 years, the longest known lifespan of any vertebrate.",
            "A shark can lose and replace thousands of teeth in its lifetime.",
            "Sharks first appeared more than 400 million years ago."
        ],
        lookalikes: [
            "Rays are flattened, with gill slits on the underside.",
            "Dolphins have a blowhole and horizontal tail flukes.",
            "Sturgeons have rows of bony plates and a protruding snout with barbels."
        ]
    },
    "siberian-cat": {
        summary: "The Siberian is a large, semi-long-haired domestic cat breed (Felis catus) that developed naturally among the farm and forest cats of Russia. Males usually weigh about 6 to 9 kg, females less. Its thick, three-layered coat is built for long, cold winters.",
        identification: [
            "Thick, water-resistant triple coat with a heavy ruff around the neck.",
            "Rounded head, rounded muzzle and medium-large ears with tufts.",
            "Muscular, heavy body with large, rounded paws.",
            "Thick, bushy tail and any coat color, including colorpoint."
        ],
        behaviorTraits: [
            "Powerful jumper and climber with strong hindquarters.",
            "Like other cats it is most active at dawn and dusk and needs a meat-based diet.",
            "Molts its heavy undercoat in spring and grows it back in autumn.",
            "Breeders describe it as people-oriented and tolerant of children and other pets."
        ],
        whyInteresting: [
            "The first Siberians were imported to the United States around 1990.",
            "It matures slowly and may not reach full size until about 5 years old.",
            "Claims that it is hypoallergenic are not proven, though some cats produce lower levels of the allergen Fel d 1."
        ],
        lookalikes: [
            "The Norwegian Forest Cat has a triangular head and a straight profile.",
            "The Maine Coon has a rectangular body and a squarer muzzle.",
            "The Neva Masquerade is the colorpoint form of the Siberian."
        ]
    },
    "musk-deer": {
        summary: "The Siberian musk deer (Moschus moschiferus) is a small deer-like mammal of mountain forests in Siberia, Mongolia, northern China, Korea and Sakhalin. It stands about 60 cm at the shoulder and weighs about 7 to 17 kg. Males have long, tusk-like upper canines instead of antlers.",
        identification: [
            "Small body with hind legs longer than the front, so the rump stands higher than the shoulders.",
            "Dark brown coat with pale spots or stripes and a pale throat.",
            "Males have long, curved upper canines that hang below the lips like small tusks.",
            "No antlers in either sex, and a very short tail.",
            "Large, rounded ears and a hunched, bounding gait."
        ],
        behaviorTraits: [
            "Most active at dawn and dusk, resting in dense cover or on rock ledges by day.",
            "Eats tree lichens in winter, plus leaves, grasses, shoots and conifer needles, often climbing leaning trunks to reach them.",
            "Solitary, keeping to a small home range marked with scent glands and dung latrines.",
            "Males fight with their tusks in the winter rut; females give birth to 1 or 2 fawns in early summer."
        ],
        whyInteresting: [
            "Males carry a musk gland on the abdomen, and the musk has long been used in perfume and traditional medicine.",
            "Poaching for musk has made the species Vulnerable on the IUCN Red List.",
            "Musk deer belong to their own family, Moschidae, and are not true deer."
        ],
        lookalikes: [
            "The Chinese water deer also has tusks but is a true deer with larger, rounded ears that lives in reedbeds and wetlands.",
            "The Siberian roe deer is larger, males grow antlers and it shows a white rump patch.",
            "Muntjacs have short antlers on fur-covered pedicles and much shorter tusks."
        ]
    },
    snake: {
        summary: "Snakes are legless reptiles in the suborder Serpentes, with more than 4,000 species on every continent except Antarctica. They range from the Barbados threadsnake at about 10 cm to the reticulated python at more than 6 m. All are carnivores that swallow their prey whole.",
        identification: [
            "Long, limbless body covered in overlapping scales.",
            "No eyelids; the eyes are covered by a clear scale.",
            "No external ear openings.",
            "Forked tongue that flicks in and out to collect scents."
        ],
        behaviorTraits: [
            "Activity varies by species; many hunt at night or at dawn and dusk.",
            "Kills prey by constriction, venom or simply swallowing it alive.",
            "Most are solitary, though some gather to hibernate.",
            "Most lay eggs, but many give birth to live young."
        ],
        whyInteresting: [
            "Snakes can swallow prey larger than their heads because their jaws are loosely connected.",
            "Pit vipers, pythons and boas can sense infrared heat from warm prey.",
            "About 600 species are venomous, and about 200 can cause serious harm to people."
        ],
        lookalikes: [
            "Legless lizards have eyelids and ear openings.",
            "Caecilians are amphibians with smooth, ringed skin.",
            "Eels are fish with fins and gills."
        ]
    },
    "southern-viscacha": {
        summary: "The southern viscacha (Lagidium viscacia) is a rodent of the chinchilla family that lives on rocky slopes and cliffs in the Andes of southern Peru, Bolivia, Chile and Argentina. It has a head and body of about 30 to 45 cm and weighs about 1.5 to 3 kg. It looks like a rabbit with a long, curled, bushy tail.",
        identification: [
            "Soft, dense grey to brownish fur, paler on the belly.",
            "Long, rabbit-like ears and long black whiskers.",
            "Long tail with a bushy tuft that curls upward over the back.",
            "Often a dark stripe running down the middle of the back."
        ],
        behaviorTraits: [
            "Active by day, especially in the early morning and late afternoon, when it sits on rocks to sunbathe.",
            "Eats grasses, mosses and lichens, foraging close to rock shelter.",
            "Lives in colonies of family groups that shelter in rock crevices.",
            "Females give birth to a single well-developed young after a gestation of about 4 months."
        ],
        whyInteresting: [
            "It is closely related to chinchillas and shares their very dense fur.",
            "Colony members give high whistles to warn others of hawks and foxes.",
            "It lives at altitudes up to about 5,000 m in parts of its range."
        ],
        lookalikes: [
            "Rabbits and hares have short, fluffy tails and longer hind legs.",
            "The plains viscacha (Lagostomus maximus) is larger, has a bold black-and-white face and digs burrows in the lowland pampas.",
            "Chinchillas are smaller, with large rounded ears and shorter tails."
        ]
    },
    "spiny-tailed-lizard": {
        summary: "The Egyptian spiny-tailed lizard (Uromastyx aegyptia) is a large, plant-eating lizard of rocky deserts and gravel plains in Egypt, the Arabian Peninsula and parts of the Middle East. It is the largest Uromastyx, reaching about 75 cm long. Its thick tail is ringed with sharp spines that it uses as a club and to block its burrow.",
        identification: [
            "Heavy, flattened body covered in small, smooth scales.",
            "Short, thick tail with rings of large, spiny scales.",
            "Grey to brown or olive color that darkens in cool weather and pales as it warms.",
            "Small, rounded head with a blunt snout."
        ],
        behaviorTraits: [
            "Active by day, basking near its burrow in the morning before feeding.",
            "Eats leaves, flowers and seeds, getting most of its water from plants.",
            "Digs long burrows in firm soil and retreats into them at night and during extreme heat.",
            "Females lay clutches of eggs in burrows, usually in late spring."
        ],
        whyInteresting: [
            "Dark coloring in the morning helps it absorb heat quickly, and it lightens as body temperature rises.",
            "When threatened in its burrow it wedges itself in and swings its spiked tail at intruders.",
            "It is hunted for food and traditional medicine in parts of its range and is listed as Vulnerable by the IUCN."
        ],
        lookalikes: [
            "Smaller Uromastyx species such as the ornate mastigure are more brightly colored.",
            "The desert monitor is long-necked, carnivorous and has a forked tongue.",
            "Agamas are smaller, slimmer lizards with long, thin tails."
        ]
    },
    antlion: {
        summary: "The spotted-winged antlion (Myrmeleon immaculatus) is a North American insect of the family Myrmeleontidae, related to lacewings. Adults are slender, damselfly-like insects about 3 to 4 cm long. Its larvae, called doodlebugs, dig funnel-shaped pits in dry sand to trap ants and other insects.",
        identification: [
            "Adults have a long, thin abdomen and two pairs of clear, net-veined wings.",
            "Short antennae with clubbed tips.",
            "Larvae are plump, grey-brown, bristly and have large, sickle-shaped jaws.",
            "Small conical pits in dry sand under overhangs, porches and trees."
        ],
        behaviorTraits: [
            "Adults are mostly nocturnal and weak, fluttering fliers.",
            "Larvae wait buried at the bottom of their pits and flick sand at prey to make it slide down.",
            "Larvae inject digestive enzymes and suck out the prey's body fluids.",
            "Larvae pupate inside a round cocoon of silk and sand."
        ],
        whyInteresting: [
            "Larvae have no anus, storing waste until it is expelled during pupation.",
            "The larval stage can last 1 to 3 years, depending on food supply.",
            "The winding trails larvae make in sand inspired the name doodlebug."
        ],
        lookalikes: [
            "Damselflies have short, bristle-like antennae and hold their wings above the body at rest.",
            "Owlflies have very long, clubbed antennae.",
            "Green lacewings are smaller and pale green, with golden eyes."
        ]
    },
    "striped-polecat": {
        summary: "The striped polecat or zorilla (Ictonyx striatus) is a small carnivore of the weasel family found in savannas and grasslands across sub-Saharan Africa. It has a head and body of about 28 to 38 cm and weighs about 0.6 to 1.4 kg. It sprays a foul-smelling fluid from anal glands, much like a skunk.",
        identification: [
            "Glossy black body with four bold white stripes running from the head along the back.",
            "White patches on the cheeks and a white spot between the eyes.",
            "Long, bushy tail that is largely white.",
            "Long body on short legs, with long claws on the front feet."
        ],
        behaviorTraits: [
            "Nocturnal and solitary, resting by day in burrows, rock crevices or under buildings.",
            "Hunts rodents, insects, reptiles and ground-nesting birds, digging prey out with its front claws.",
            "When threatened it fluffs its fur, raises its tail, sprays from its anal glands and may play dead.",
            "Females give birth to litters of 1 to 3 young in a burrow."
        ],
        whyInteresting: [
            "Its black-and-white warning pattern evolved separately from that of skunks but serves the same purpose.",
            "It belongs to the weasel family (Mustelidae), while skunks have their own family, Mephitidae, found in the Americas and Southeast Asia.",
            "It is one of the most widespread small carnivores in Africa, found from Senegal to Sudan and south to the Cape."
        ],
        lookalikes: [
            "The African striped weasel (Poecilogale albinucha) is smaller and slimmer, with very short legs and a white tail.",
            "The honey badger is much larger, with a solid grey to white mantle over a black body.",
            "The Saharan striped polecat (Ictonyx libycus) of North Africa has narrower, broken stripes and a white band across the face."
        ]
    },
    "sunda-flying-lemur": {
        summary: "The Sunda flying lemur or Sunda colugo (Galeopterus variegatus) is a gliding mammal of rainforests and plantations in Southeast Asia, from southern Thailand to Borneo and Java. It has a head and body of about 33 to 42 cm and weighs about 1 to 2 kg. Despite its name, it is not a lemur and cannot truly fly.",
        identification: [
            "Large gliding membrane (patagium) stretching from neck to fingers, toes and tail tip.",
            "Mottled grey-brown fur that blends with tree bark.",
            "Large eyes adapted for night vision.",
            "Small head with short, rounded ears."
        ],
        behaviorTraits: [
            "Nocturnal, resting by day clinging to tree trunks or hanging under branches.",
            "Eats leaves, buds, flowers and fruit.",
            "Glides from tree to tree to feed.",
            "Females give birth to a single young, which clings to the mother's belly."
        ],
        whyInteresting: [
            "It can glide more than 100 m with little loss of height.",
            "Colugos belong to their own order, Dermoptera, with only two species.",
            "The mother can fold her membrane into a pouch to carry her young."
        ],
        lookalikes: [
            "Giant flying squirrels have a bushy tail free of the gliding membrane.",
            "The Philippine flying lemur (Cynocephalus volans) is very similar but lives only in the southern Philippines.",
            "Fruit bats have true wings and fly by flapping."
        ]
    },
    uakari: {
        summary: "The bald uakari (Cacajao calvus) is a short-tailed monkey of flooded forests in the western Amazon of Brazil and Peru. It weighs about 3 kg, with a head and body of about 36 to 57 cm. Its bare, bright red face is its most striking feature.",
        identification: [
            "Hairless, bright red face and scalp.",
            "Long, shaggy coat ranging from white to reddish-orange depending on subspecies.",
            "Short, bushy tail, much shorter than the body.",
            "Thin, bony frame under the shaggy coat."
        ],
        behaviorTraits: [
            "Active by day, spending most of its time in the canopy of flooded forest.",
            "Eats mainly seeds of unripe fruit, cracking them with strong teeth.",
            "Lives in groups that can number more than 100.",
            "Females give birth to a single young every two years."
        ],
        whyInteresting: [
            "The red color comes from blood vessels close to the skin; studies link pale faces to malaria infection, so a bright face may signal good health to mates.",
            "It is one of the few New World monkeys with a short tail.",
            "The IUCN lists it as Vulnerable because of hunting and habitat loss."
        ],
        lookalikes: [
            "The black-headed uakari has a black face and fur.",
            "Red howler monkeys have long, prehensile tails and beards.",
            "Saki monkeys have long, bushy tails."
        ]
    },
    frogfish: {
        summary: "The warty frogfish (Antennarius maculatus), also called the clown frogfish, is a small anglerfish of shallow coral reefs and lagoons in the Indo-Pacific. It grows to about 15 cm long. It fishes for prey with a lure on its head and engulfs it in a fraction of a second.",
        identification: [
            "Round, lumpy body covered in small wart-like bumps, with no visible scales.",
            "Color varies from white, yellow and orange to red, brown or black, often with dark saddles and orange-ringed patches.",
            "A short rod on the snout tipped with a lure that resembles a small fish.",
            "Arm-like pectoral fins with an elbow-like joint, used to walk over the bottom."
        ],
        behaviorTraits: [
            "Sits motionless on sponges, rock or rubble, matching its surroundings, and waits for prey.",
            "Wiggles its lure to attract small fish and crustaceans within striking range.",
            "Moves by walking on its pectoral and pelvic fins or by jet propulsion, pushing water out of its gill openings.",
            "Females release eggs in a floating, jelly-like raft."
        ],
        whyInteresting: [
            "Frogfish can open their mouths to about 12 times their resting size and swallow prey as long as themselves.",
            "The strike takes only a few thousandths of a second, among the fastest feeding movements of any vertebrate.",
            "An individual can change its base color over a few weeks to match a new background."
        ],
        lookalikes: [
            "The painted frogfish (Antennarius pictus) has fewer warts, more uniform spotting and lacks the dark saddles.",
            "The giant frogfish (Antennarius commerson) grows much larger, to about 38 cm, with smoother skin.",
            "Scorpionfish also sit camouflaged on reefs but have venomous dorsal spines, a large flattened head and no lure."
        ]
    },
    wombat: {
        summary: "Wombats are three species of burrowing marsupials from Australia; the best known, the common wombat (Vombatus ursinus), lives in forests and heaths of southeastern Australia and Tasmania. Adults are about 1 m long and weigh roughly 20 to 35 kg. They dig extensive burrows with powerful claws and are the only animals known to produce cube-shaped droppings.",
        identification: [
            "Stocky, barrel-shaped body with short, strong legs and almost no tail.",
            "Coarse brown, grey or black fur; the common wombat has a bare, granular nose.",
            "Small eyes and short, rounded ears.",
            "Flat-footed, waddling walk, although it can run at speed over short distances."
        ],
        behaviorTraits: [
            "Mainly nocturnal, spending the day in burrows and emerging to graze in the evening.",
            "Eats grasses, sedges, roots and bark, and has a slow metabolism that conserves water and energy.",
            "Mostly solitary, marking its feeding range with droppings on logs and rocks.",
            "Females raise a single young in a backward-facing pouch for about 6 to 7 months."
        ],
        whyInteresting: [
            "Its cube-shaped droppings are formed in the final part of the intestine, where varying wall stiffness shapes them.",
            "Common wombat burrows can be more than 20 m long with several entrances.",
            "When chased into a burrow it blocks the entrance with its rump, which is reinforced by a tough plate of cartilage."
        ],
        lookalikes: [
            "Hairy-nosed wombats have softer fur, a furry muzzle and longer, pointed ears.",
            "The koala is smaller, lives in trees and has large, fluffy ears.",
            "The quokka is smaller, hops like a wallaby and has a long tail."
        ]
    },
    "xantus-hummingbird": {
        summary: "Xantus's hummingbird (Basilinna xantusii) is a hummingbird found only in the southern Baja California Peninsula of Mexico, in desert scrub, oases and mountain woodland. It is about 8 to 9 cm long. Both sexes have a bold white stripe behind the eye and cinnamon underparts, unusual among North American hummingbirds.",
        identification: [
            "Green upperparts with a bold white stripe behind the eye, bordered by a black cheek.",
            "Males have an iridescent green throat; females have a pale cinnamon throat.",
            "Cinnamon-buff underparts and a rufous tail.",
            "Straight red bill with a dark tip."
        ],
        behaviorTraits: [
            "Active by day, feeding at flowers and catching small insects in flight.",
            "Males defend feeding territories and chase other hummingbirds away.",
            "Females build small cup nests from plant down and spider silk, often on shrubs.",
            "Females lay 2 eggs and raise the young alone."
        ],
        whyInteresting: [
            "It is named after John Xantus, a Hungarian collector who worked in Baja California in the 1850s.",
            "It has been recorded as a rare vagrant in California and British Columbia.",
            "It is one of the few hummingbirds endemic to Baja California."
        ],
        lookalikes: [
            "The white-eared hummingbird (Basilinna leucotis) of mainland Mexico has a similar eye stripe but whitish rather than cinnamon underparts.",
            "Costa's hummingbird has a purple throat and no eye stripe.",
            "Female black-chinned hummingbirds lack the white eye stripe and cinnamon belly."
        ]
    },
    "xantus-murrelet": {
        summary: "Xantus's murrelet was a small seabird of islands off southern California and Baja California, split in 2012 into Scripps's murrelet and the Guadalupe murrelet (Synthliboramphus hypoleucus). Both are about 24 cm long and weigh about 170 g. Their chicks leave the nest for the open sea when only one or two days old.",
        identification: [
            "Small, compact auk, black above and white below.",
            "Thin, pointed black bill.",
            "Guadalupe murrelets have white extending above the eye; Scripps's murrelets have a black face.",
            "Fast, low flight over the water."
        ],
        behaviorTraits: [
            "Nests in rock crevices and under shrubs on offshore islands.",
            "Visits nesting colonies only at night to avoid gulls and other predators.",
            "Feeds at sea on small fish and krill caught by diving.",
            "Lays 2 eggs; the precocial chicks go to sea with their parents after a day or two."
        ],
        whyInteresting: [
            "Its chicks are never fed at the nest; parents raise them at sea.",
            "Each egg weighs about 22 percent of the female's body weight.",
            "Introduced rats and cats on nesting islands have caused major declines."
        ],
        lookalikes: [
            "Craveri's murrelet has a longer, thinner bill and dark underwings.",
            "The ancient murrelet has a black throat and grey back.",
            "Cassin's auklet is dark grey with a stubby bill."
        ]
    },
    yak: {
        summary: "The yak (Bos grunniens) is a large, long-haired bovine of the Tibetan Plateau and Himalayan highlands, kept as a domestic animal by herders, with a smaller population of wild yaks (Bos mutus). Domestic males weigh about 350 to 580 kg, while wild bulls can reach about 1,000 kg. It is adapted to living above 4,000 m.",
        identification: [
            "Massive body with a hump over the shoulders.",
            "Long, shaggy hair that hangs from the flanks like a skirt.",
            "Long, curved horns in both sexes.",
            "Wild yaks are dark brown to black; domestic yaks may be brown, black, white or pied."
        ],
        behaviorTraits: [
            "Grazes grasses, herbs and lichens in alpine meadows.",
            "Lives in herds; wild females and young form large groups, while bulls are often alone or in small groups.",
            "Breeds in late summer and autumn, with calves born after about 9 months.",
            "Makes a grunting call, which gives the species its scientific name grunniens."
        ],
        whyInteresting: [
            "Wild yaks have been recorded at altitudes of about 6,000 m.",
            "It has large lungs and few sweat glands, adaptations for cold, thin air.",
            "There are about 14 million domestic yaks, mostly in China."
        ],
        lookalikes: [
            "The American bison has a larger hump, short horns and lives in North America.",
            "The musk ox is smaller, with horns that curve down and a thick wool coat.",
            "The dzo is a hybrid between a yak and domestic cattle, with shorter hair."
        ]
    },
    caecilian: {
        summary: "The Ceylon caecilian (Ichthyophis glutinosus) is a limbless, burrowing amphibian of moist forests and stream banks in Sri Lanka, one of about 220 species in the order Gymnophiona. Adults are roughly 30 cm long. It looks like a large earthworm but has a skull, teeth and a backbone.",
        identification: [
            "Long, limbless body ringed by skin folds called annuli.",
            "Dark blue-grey to brown with a yellow stripe along each side.",
            "Tiny eyes under the skin and a small sensory tentacle between eye and nostril.",
            "Blunt head and very short tail."
        ],
        behaviorTraits: [
            "Burrows in soil and leaf litter near streams.",
            "Eats earthworms, insects and other small invertebrates.",
            "Mostly active at night or after rain.",
            "Females coil around their eggs to guard them until they hatch into aquatic larvae."
        ],
        whyInteresting: [
            "The tentacle, unique to caecilians, carries scent molecules to the nose so it can track prey underground.",
            "Its larvae hatch with external gills and a tail fin, live in streams, and later move onto land as burrowing adults.",
            "Egg-guarding in this species was described by the Swiss naturalists Paul and Fritz Sarasin in Sri Lanka in the 1880s, one of the first accounts of caecilian parental care."
        ],
        lookalikes: [
            "Earthworms have true segments, no skull, eyes or jaws, and a pale saddle (clitellum) in adults.",
            "Blind snakes (Typhlopidae) have smooth overlapping scales, a forked tongue and no skin rings.",
            "Other Ichthyophis species in South Asia look very similar and are separated mainly by range, stripe pattern and ring counts."
        ]
    },
    "zebra-mongoose": {
        summary: "The banded mongoose (Mungos mungo), sometimes called the zebra mongoose, is a small carnivore of savannas, open woodland and scrub across sub-Saharan Africa. It has a head and body of about 30 to 45 cm and weighs about 1.5 to 2.25 kg. It lives in packs and is named for the dark bands across its back.",
        identification: [
            "Grizzled grey-brown body with dark transverse bands across the back.",
            "Long, tapering tail with a dark tip.",
            "Small, rounded ears and a pointed snout.",
            "Short legs and long claws for digging."
        ],
        behaviorTraits: [
            "Active by day, foraging in groups for insects, millipedes, beetles and eggs.",
            "Lives in packs of about 10 to 20, sometimes more than 40.",
            "Females in a pack often give birth on the same day.",
            "Adults escort and feed pups, with each pup forming a bond with one escort."
        ],
        whyInteresting: [
            "It cracks eggs by throwing them backward between its legs against a rock.",
            "Packs fight with neighboring packs over territory.",
            "In Uganda, banded mongooses have been filmed climbing onto resting warthogs and picking ticks off them."
        ],
        lookalikes: [
            "The common dwarf mongoose is much smaller, about 300 g, with a plain brown coat and no bands.",
            "The meerkat often stands upright, has dark eye patches and a thin, dark-tipped tail, and lives in drier southern African country.",
            "The Egyptian mongoose is larger and grizzled grey without bands, with a black tuft at the tail tip."
        ]
    },
    kangal: {
        summary: "The Kangal Shepherd Dog is a large livestock guardian breed of domestic dog (Canis lupus familiaris) from central Anatolia in Turkey, named after the Kangal district of Sivas Province. Males commonly stand about 75 cm at the shoulder and weigh roughly 50 to 65 kg. It was bred to live with flocks of sheep and drive off wolves, bears and jackals.",
        identification: [
            "Large, powerful but athletic build, taller and less bulky than a mastiff.",
            "Short, dense double coat in pale fawn to sandy dun.",
            "Black mask over the muzzle and black, drop ears.",
            "Long tail carried low at rest and curled high over the back when alert."
        ],
        behaviorTraits: [
            "Stays with the flock day and night, patrolling and watching from high ground rather than herding.",
            "Responds to threats first by barking and standing its ground, and attacks only if a predator keeps coming.",
            "Works independently with little direction from people, which makes it strong-willed as a pet.",
            "Typically wary of strangers but calm and protective with its own family and animals."
        ],
        whyInteresting: [
            "In Namibia and Kenya, conservation groups place Kangal and Anatolian guardian dogs with farmers to cut livestock losses to cheetahs and reduce retaliatory killing.",
            "Turkey regards the Kangal as a national breed and restricts export of dogs from its home region.",
            "Like most large breeds, it usually lives about 12 to 15 years."
        ],
        lookalikes: [
            "The Anatolian Shepherd Dog, developed from the same Turkish guardian dogs, is accepted in many more coat colors and patterns.",
            "The Akbash is another Turkish guardian breed but is all white with a leaner build.",
            "The English Mastiff is heavier and shorter-legged, with a wrinkled, broad head."
        ]
    }
};

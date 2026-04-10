import {SystemsIntelligenceEntry} from "@/data/content-schema";

const baseSpeciesSystemsIntelligenceData: Record<string, SystemsIntelligenceEntry> = {
    "african-wild-dog": {
        roleTitle: "The Distributed Pursuit Engine",
        specializedHardware: "Oversized ears, endurance-focused limbs, and a social communication stack built on posture, vocal cues, and pack coordination turn the African wild dog into elite pursuit hardware.",
        systemsScript: "African wild dogs pressure prey populations through coordinated movement rather than isolated brute force. They help shape herbivore behavior, redistribute risk across landscapes, and reward connected ecosystems over fragmented ones.",
        strategicInsight: "High-performance teams do not need constant hierarchy chatter. Shared rules, clean signals, and role clarity create speed that solo talent cannot match."
    },
    "bald-eagle": {
        roleTitle: "The Watershed Signal Pilot",
        specializedHardware: "Long-range vision, broad soaring wings, and a hooked bill optimized for fish capture make the bald eagle a precision hunter built for scanning large water systems with minimal wasted energy.",
        systemsScript: "Bald eagles sit near the top of aquatic food chains, linking fish-rich waterways to wider nutrient and predator dynamics. Where they persist, they often reflect habitat quality, prey stability, and protected nesting space.",
        strategicInsight: "Altitude is a strategy. Step back, widen the field, and let pattern recognition do work before you commit energy to the dive."
    },
    "barn-owl": {
        roleTitle: "The Acoustic Intercept Platform",
        specializedHardware: "A facial disc that funnels sound, asymmetrical ears that triangulate prey in three dimensions, and feather geometry built for near-silent flight make the barn owl elite nocturnal capture hardware.",
        systemsScript: "Barn owls convert darkness into rodent control. They reduce small-mammal pressure in grassland, farmland, and edge habitats while proving that low-noise predators can reshape a system without announcing themselves.",
        strategicInsight: "If you want cleaner decisions, lower your own signal first. Quiet systems detect more than loud ones."
    },
    chameleon: {
        roleTitle: "The Directional Surveillance Turret",
        specializedHardware: "Independently mobile eyes, a ballistic tongue, and branch-gripping feet let a chameleon scan multiple angles before converting visual lock into a precise strike.",
        systemsScript: "Chameleons operate as small-scale insect regulators in arboreal environments. They show how patient sensory coverage can stabilize a niche without high-speed roaming or constant conflict.",
        strategicInsight: "Do not confuse stillness with inactivity. Good surveillance buys better timing than constant motion."
    },
    crocodile: {
        roleTitle: "The Estuary Pressure Valve",
        specializedHardware: "Pressure-sensitive receptors around the jaws, eyes and nostrils mounted high on the skull, and a tail built for explosive propulsion make crocodiles effective ambush hardware at the land-water edge.",
        systemsScript: "Crocodiles control chokepoints where rivers, wetlands, and shorelines concentrate traffic. They regulate prey behavior, move nutrients through kills and carcasses, and add caution to landscapes that would otherwise become too predictable.",
        strategicInsight: "You do not need to dominate every square meter. Control the bottlenecks and the rest of the map starts behaving differently."
    },
    crow: {
        roleTitle: "The Opportunistic Forensics Analyst",
        specializedHardware: "A large relative brain, strong visual memory, versatile beak use, and social learning make crows excellent at pattern detection, tool use, and rapid behavioral updates.",
        systemsScript: "Crows work the ecosystem's edge cases: scavenging waste, moving seeds, preying on smaller animals, and extracting signal from human-altered environments. They thrive where flexibility matters more than purity.",
        strategicInsight: "General intelligence scales when memory, experimentation, and information sharing stay connected. Learn fast, keep the useful parts, and drop the vanity."
    },
    dolphin: {
        roleTitle: "The Sonar Coordination Engine",
        specializedHardware: "Echolocation, dense auditory processing, hydrodynamic bodies, and strong social communication give dolphins active-sensing hardware for hunting where visibility is unreliable.",
        systemsScript: "Dolphins shape fish movement, coordinate predation, and move information through pods faster than many prey systems can adapt. They show how intelligence and locomotion become more powerful when fused with live sensing.",
        strategicInsight: "When the environment is noisy or opaque, do not wait for perfect visibility. Build feedback loops that let you sense while moving."
    },
    eagle: {
        roleTitle: "The Thermal Recon Commander",
        specializedHardware: "Extreme visual acuity, broad wings tuned for soaring, and grip strength concentrated in the talons make eagles efficient aerial reconnaissance and strike hardware.",
        systemsScript: "Eagles connect height, heat, and prey detection across open landscapes. They pressure medium-sized prey, exploit thermals as free transport, and turn large territories into readable operating surfaces.",
        strategicInsight: "Use the energy already available in the environment. Systems that borrow momentum from context outperform systems that brute-force everything themselves."
    },
    elephant: {
        roleTitle: "The Landscape Memory Engine",
        specializedHardware: "A multipurpose trunk, low-frequency communication, seismic sensitivity through the feet, and long-term spatial memory make elephants large-scale environmental navigation hardware.",
        systemsScript: "Elephants open paths, disperse seeds, modify vegetation, and uncover water access points that other species later use. They are not just large animals inside a habitat; they help write the habitat's infrastructure.",
        strategicInsight: "Scale is most useful when paired with memory. The bigger the system, the more it wins by remembering routes, resources, and failure points."
    },
    firefly: {
        roleTitle: "The Bioluminescent Signaling Protocol",
        specializedHardware: "Luciferin-based light production, species-specific flash timing, and low-light visual sensitivity make fireflies highly efficient communication hardware for dark environments.",
        systemsScript: "Fireflies turn mating, territory, and species recognition into precise light code. They show that even small organisms can coordinate behavior cleanly when signals are cheap, legible, and well-timed.",
        strategicInsight: "A strong signal is not necessarily a loud one. The best signals are energy-efficient, hard to confuse, and tuned to the right audience."
    },
    "honey-bee": {
        roleTitle: "The Pollination Logistics Network",
        specializedHardware: "Ultraviolet-sensitive vision, electrostatic body hairs, pollen baskets, and the waggle dance give honey bees precise hardware for locating, collecting, and routing floral resources.",
        systemsScript: "Honey bees help translate flowers into fruit, seed, and agricultural yield. They sit inside a massive reproductive logistics layer that links plant success to food webs, landscapes, and human food systems.",
        strategicInsight: "Do not just report outcomes. Share routes, quality signals, and location data so the rest of the system can move faster."
    },
    jellyfish: {
        roleTitle: "The Drift-Based Capture Array",
        specializedHardware: "Nematocysts, a gelatinous low-cost body plan, pulsed propulsion, and a simple nerve net allow jellyfish to capture prey with minimal structural expense.",
        systemsScript: "Jellyfish convert plankton-rich water into higher trophic energy and can rapidly exploit imbalanced marine conditions. Their blooms often reveal that the surrounding system has become easier to game.",
        strategicInsight: "Lightweight systems can become dominant when the environment does most of the transport for them. Reduce overhead before you add muscle."
    },
    "jumping-spider": {
        roleTitle: "The Micro Targeting Computer",
        specializedHardware: "Large forward-facing eyes, sharp depth judgment, and hydraulically powered jumps make jumping spiders unusually accurate visual hunters without the need for capture webs.",
        systemsScript: "Jumping spiders regulate insect traffic at a tiny scale across leaves, bark, walls, and understory surfaces. They show how precision predation can emerge from compact hardware and strong sensory computation.",
        strategicInsight: "Accuracy compounds. At small scales, the cleanest win usually comes from better targeting, not more force."
    },
    "king-cobra": {
        roleTitle: "The Reptile Specialist Regulator",
        specializedHardware: "Long-range chemosensory tracking, elevated striking posture, large venom yield, and a body built to move efficiently through forest structure make the king cobra specialized anti-snake hardware.",
        systemsScript: "King cobras sit high in reptile food chains and apply pressure to other snake populations. They occupy a narrow but strategic niche, proving that specialization can stabilize a system by targeting one hard problem well.",
        strategicInsight: "Broad competence is useful, but deep specialization can create uncontested territory. Pick the problem where precision matters more than popularity."
    },
    "komodo-dragon": {
        roleTitle: "The Island Apex Regulator",
        specializedHardware: "Heavy skeletal architecture, serrated bite mechanics, tongue-based chemical sensing, and heat-efficient reptile metabolism make the Komodo dragon premium hardware for ambush, tracking, and territorial control.",
        systemsScript: "The Komodo dragon operates as apex environmental hardware inside a constrained island system. It removes weak links, regulates prey pressure, and keeps limited ecosystems from drifting into easy imbalance.",
        strategicInsight: "Premium energy should not be spent on noise. Position well, sense early, and commit hard only when the leverage justifies the burn."
    },
    "mantis-shrimp": {
        roleTitle: "The Ballistic Spectrum Analyst",
        specializedHardware: "Hyper-specialized eyes that detect polarized and complex light, plus spring-loaded raptorial appendages that release extreme acceleration, make mantis shrimp elite sensing-and-strike hardware.",
        systemsScript: "Mantis shrimp pressure reef prey with a combination of signal processing and mechanical violence. They help drive local armor races in shells and exoskeletons while occupying tight, defensible burrow systems.",
        strategicInsight: "Speed is often designed before it is expressed. Preload the mechanism, then let structure deliver the force."
    },
    "maine-coon-cat": {
        roleTitle: "The Domestic Climate Adapter",
        specializedHardware: "A robust frame, insulating coat, tufted ears, and high social tolerance give the Maine Coon specialized hardware for cold-climate resilience, household adaptability, and sustained interaction with humans.",
        systemsScript: "In domestic systems, the Maine Coon shows how selective pressure can favor versatility over extremism. It is less about wild-terrain domination and more about thriving across changing human-managed environments.",
        strategicInsight: "Durability scales. Build systems that stay effective across different settings instead of optimizing so hard for one environment that everything else breaks."
    },
    octopus: {
        roleTitle: "The Soft-Bodied Escape Engineer",
        specializedHardware: "A distributed nervous system, dexterous arms loaded with sensory receptors, chromatophore camouflage, and a body that can compress through tiny gaps make the octopus extraordinary adaptive hardware.",
        systemsScript: "Octopuses regulate crustaceans, mollusks, and reef-floor prey while occupying crevices other predators cannot exploit. They show how flexible architecture can compete with armored design by turning shape itself into strategy.",
        strategicInsight: "Do not centralize every decision. Put sensing and action closer together and the whole system becomes faster under pressure."
    },
    orangutan: {
        roleTitle: "The Arboreal Problem Solver",
        specializedHardware: "Long, powerful arms, hook-like hands and feet, strong spatial memory, and an unusually long learning period make orangutans high-capacity canopy navigation and problem-solving hardware.",
        systemsScript: "Orangutans disperse seeds, prune movement routes through the canopy, and help maintain forest regeneration over long timescales. Their niche rewards cognition, patience, and memory more than constant aggression.",
        strategicInsight: "Complex environments do not always reward speed first. Sometimes the edge comes from learning slowly enough that the model actually holds."
    },
    termite: {
        roleTitle: "The Cellulose Conversion Factory",
        specializedHardware: "Microbe-assisted digestion, caste-based labor specialization, and climate-regulating mound architecture allow termites to process material most animals cannot use directly.",
        systemsScript: "Termites convert dead plant matter into accessible nutrients, aerate soils, and build structures that alter temperature, moisture, and habitat availability for other organisms. They are infrastructure builders disguised as insects.",
        strategicInsight: "Some of the best systems create value by turning low-grade input into usable output. Waste is often just a resource without the right processing stack."
    },
    tiger: {
        roleTitle: "The Solitary Ambush Accountant",
        specializedHardware: "Striped camouflage, padded feet, strong night vision, and explosive forelimb power make the tiger highly effective close-range strike hardware in dense cover.",
        systemsScript: "Tigers regulate herbivore pressure and prey behavior across forests, wetlands, and grasslands. Their presence changes how other animals move, feed, and allocate risk, which then reshapes vegetation and recovery patterns.",
        strategicInsight: "A high-value move beats a high-volume one. Save force for the window where surprise and position make the cost worth paying."
    },
    "whale-shark": {
        roleTitle: "The Pelagic Filter Cruiser",
        specializedHardware: "An enormous mouth, fine filtering structures, and low-cost cruising mechanics allow the whale shark to process huge volumes of plankton-rich water without high-speed pursuit.",
        systemsScript: "Whale sharks connect surface productivity to larger marine food webs by converting diffuse plankton pulses into mobile biomass. Their movement patterns also mark productive ocean zones where energy concentrates seasonally.",
        strategicInsight: "Scale does not always come from chasing more targets. Sometimes it comes from building a system that can process volume efficiently once the flow arrives."
    },
    wolf: {
        roleTitle: "The Cooperative Territory Governor",
        specializedHardware: "Long-distance scent detection, endurance locomotion, social signaling, and coordinated pack behavior give wolves durable hardware for tracking, testing, and wearing down prey across large territories.",
        systemsScript: "Wolves apply top-down pressure that changes prey distribution, browsing intensity, and risk behavior. They remind ecosystems that movement patterns matter as much as raw population numbers.",
        strategicInsight: "Endurance and coordination beat isolated bursts of talent. A disciplined group with shared direction can reshape a landscape over time."
    },
    "white-headed-vulture": {
        roleTitle: "The Silent Recycler",
        specializedHardware: "Exceptional eyesight, soaring efficiency, and scavenger-grade feeding hardware allow the white-headed vulture to locate carcasses quickly and convert death into cleanup before disease risk spreads.",
        systemsScript: "This species is part of the ecosystem sanitation layer. By clearing carrion, vultures reduce pathogen buildup, accelerate nutrient cycling, and keep the wider environmental operating system cleaner and more stable.",
        strategicInsight: "Not every valuable system creates by adding more. Some create advantage by removing waste faster than everyone else."
    }
};

const expandedSpeciesSystemsIntelligenceData: Record<string, SystemsIntelligenceEntry> = {};

Object.assign(expandedSpeciesSystemsIntelligenceData, {
    lion: {
        roleTitle: "The Pride-Based Pressure Broker",
        specializedHardware: "Heavy forequarters, social coordination, strong jaws, and low-light hunting ability turn lions into open-country control hardware built for decisive close-range force.",
        systemsScript: "Lions regulate herd behavior and prey distribution across grassland systems. Their influence is partly in the kill and partly in the fear patterns that reshape where herbivores linger.",
        strategicInsight: "Shared force works best when roles are clear. Good teams do not all do the same thing at once."
    },
    "red-fox": {
        roleTitle: "The Adaptive Edge Operator",
        specializedHardware: "Acute hearing, agile gait, opportunistic dentition, and a flexible sensory package let the red fox exploit patchy food webs with minimal commitment to one niche.",
        systemsScript: "Foxes thrive on boundaries: field edges, towns, scrub, and woodland seams. They convert fragmented environments into workable hunting maps rather than waiting for pristine conditions.",
        strategicInsight: "Versatility is not compromise when the environment keeps changing. It is insurance with teeth."
    },
    "snow-leopard": {
        roleTitle: "The Mountain Ghost Accountant",
        specializedHardware: "Wide snow-ready paws, balancing tail mass, dense insulation, and stealth-oriented build make snow leopards elite vertical ambush hardware for broken cold terrain.",
        systemsScript: "Snow leopards regulate mountain ungulates in ecosystems where every movement route matters. They force caution into ridgelines, saddles, and cliff approaches that prey would otherwise overuse.",
        strategicInsight: "In hard terrain, position outranks volume. A good route is worth more than a loud push."
    },
    "giant-panda": {
        roleTitle: "The Bamboo Conversion Specialist",
        specializedHardware: "Massive jaw musculature, crushing molars, and a pseudo-thumb for gripping stems let giant pandas extract value from an abundant but low-yield food stream.",
        systemsScript: "Pandas show what a narrow feeding niche looks like when supported by the right forest structure. Their success depends less on competition and more on whether the bamboo system remains intact.",
        strategicInsight: "Specialization only works when the supply chain is real. Protect the input before celebrating the output."
    },
    giraffe: {
        roleTitle: "The Vertical Browse Optimizer",
        specializedHardware: "Extreme neck height, prehensile tongue, and cardiovascular reinforcement let giraffes turn browsing height into a competitive lane few herbivores can match.",
        systemsScript: "Giraffes redirect feeding pressure upward, changing how trees, shrubs, and other herbivores share vegetation. They help split the landscape into vertical resource layers rather than one flat buffet.",
        strategicInsight: "If competition is crowded at one level, find the unused tier instead of fighting harder on the ground floor."
    },
    "plains-zebra": {
        roleTitle: "The Herd-Scale Early Warning Grid",
        specializedHardware: "Fast acceleration, durable grazing physiology, and many eyes distributed across a moving herd make plains zebras effective vigilance hardware for open systems.",
        systemsScript: "Zebras convert group movement into risk buffering on exposed grassland. They absorb grazing pressure while helping keep predator detection active across wide visible terrain.",
        strategicInsight: "Open environments reward distributed awareness. One watcher is fragile; many watchers become infrastructure."
    },
    "red-kangaroo": {
        roleTitle: "The Desert Elastic Runner",
        specializedHardware: "Massive hind limbs, spring-loaded tendons, and a balancing tail make the red kangaroo low-cost locomotion hardware for sparse arid landscapes.",
        systemsScript: "Red kangaroos track rain-driven productivity across desert systems and turn brief green windows into usable population gain. They are built to exploit pulses, not pretend the desert is stable.",
        strategicInsight: "In volatile systems, efficiency beats bravado. Save energy until the good window opens."
    },
    koala: {
        roleTitle: "The Canopy Energy Minimalist",
        specializedHardware: "Digestive specialization, strong climbing limbs, and low-output metabolism let koalas survive on leaves that offer little fast return.",
        systemsScript: "Koalas show how some niches work by lowering demand rather than raising throughput. They tie forest quality directly to whether a slow, selective feeder can still function at all.",
        strategicInsight: "Not every system wins by scaling up. Some survive by cutting the burn rate to match reality."
    },
    "three-toed-sloth": {
        roleTitle: "The Low-Metabolism Camouflage Platform",
        specializedHardware: "Curved claws, hanging limb structure, and exceptionally slow energy use make three-toed sloths built for invisibility through understatement.",
        systemsScript: "Sloths reduce predation pressure by refusing the pace most predators expect. They are reminders that ecosystems also make room for organisms whose main move is not being worth noticing.",
        strategicInsight: "Sometimes the strongest defense is lowering your signal below the threshold that triggers attention."
    },
    capybara: {
        roleTitle: "The Wetland Calm Regulator",
        specializedHardware: "Semi-aquatic body design, social vigilance, and grazing efficiency make capybaras reliable herbivore hardware for river and marsh systems.",
        systemsScript: "Capybaras convert shoreline vegetation into mobile biomass while feeding predators and keeping wetland edges busy but readable. They help turn water access into a shared, constantly negotiated zone.",
        strategicInsight: "Calm is not softness when escape routes are already built in. Confidence works better when the fallback is real."
    },
    "polar-bear": {
        roleTitle: "The Sea-Ice Ambush Auditor",
        specializedHardware: "Insulation, scent range, swimming power, and seal-focused hunting behavior make polar bears predatory hardware tuned to a moving frozen platform.",
        systemsScript: "Polar bears link sea-ice structure to upper food-web pressure. When the platform changes, the hunter changes, and the whole Arctic operating system starts losing predictability.",
        strategicInsight: "If your system depends on one platform, monitor the platform harder than the performance metrics built on top of it."
    },
    cheetah: {
        roleTitle: "The Burst-Speed Precision Trader",
        specializedHardware: "Lightweight frame, oversized lungs, long tail steering, and traction-focused claws make cheetahs acceleration hardware built for short high-value outcomes.",
        systemsScript: "Cheetahs pressure mid-sized grazers in open country but pay dearly for failed commitments. Their niche rewards clean setup and punishes wasted effort.",
        strategicInsight: "Speed is expensive. Use it where the odds are already tilted, not where you are merely impatient."
    },
    "spotted-hyena": {
        roleTitle: "The Bone-Crushing Network Manager",
        specializedHardware: "Crushing jaws, powerful forequarters, stamina, and clan-level coordination make spotted hyenas high-efficiency carnivore hardware across long feeding windows.",
        systemsScript: "Hyenas reduce waste, compete directly for prey, and keep carcass nutrients moving through the system fast. They are part predator, part cleanup crew, and fully structural to savannah ecology.",
        strategicInsight: "Do not ignore the value of finishing what others leave behind. Efficiency often hides inside the leftovers."
    },
    leopard: {
        roleTitle: "The Stealth Generalist",
        specializedHardware: "Rosette camouflage, climbing strength, night vision, and prey flexibility make leopards multipurpose predatory hardware across very different landscapes.",
        systemsScript: "Leopards persist by reading local opportunity better than more specialized rivals. They keep prey pressure alive in systems where adaptability matters more than dominance displays.",
        strategicInsight: "Generalism becomes elite when it stays quiet, competent, and hard to pin down."
    },
    binturong: {
        roleTitle: "The Canopy Seed Courier",
        specializedHardware: "Prehensile tail support, strong climbing limbs, and fruit-oriented digestive strategy make binturongs effective arboreal transport hardware for tropical forests.",
        systemsScript: "Binturongs help move seeds through forest canopies and edges where fruit availability shapes wildlife traffic. They are not flashy apex actors; they are logistics embedded in fur.",
        strategicInsight: "Systems often depend on carriers more than stars. Move the valuable material and the structure keeps rebuilding itself."
    },
    "proboscis-monkey": {
        roleTitle: "The River-Corridor Browser",
        specializedHardware: "Multi-chambered digestion, strong swimming ability, and group movement through mangrove and riverside canopy make proboscis monkeys wet-forest browsing hardware.",
        systemsScript: "They tie river edges, mangroves, and lowland leaves into one living corridor system. Where they persist, riparian forest still functions as more than scenery.",
        strategicInsight: "Protect the corridors, not just the endpoints. Systems fail in transit before they fail on paper."
    },
    "sun-bear": {
        roleTitle: "The Tropical Extraction Unit",
        specializedHardware: "Curved claws, long tongue, climbing power, and compact bear build make sun bears excellent hardware for tearing into insect nests, fruit patches, and rotten wood.",
        systemsScript: "Sun bears convert hidden forest resources into usable trophic movement while also dispersing seeds and opening logs. They work the hard-to-access layer of the tropical food system.",
        strategicInsight: "Value often sits behind a shell, log, or locked box. Build tools for extraction, not just consumption."
    },
    "malayan-tapir": {
        roleTitle: "The Lowland Forest Browser",
        specializedHardware: "A flexible snout, heavy low-light body plan, and quiet nocturnal movement make the Malayan tapir browsing hardware for dense wet lowland cover.",
        systemsScript: "Tapirs move plant matter and seeds through forests that many large mammals no longer occupy consistently. Their presence helps keep lowland forest food webs from thinning into silence.",
        strategicInsight: "Large systems do not need spectacle to matter. Quiet persistence can hold more structure than visible noise."
    },
    "sunda-pangolin": {
        roleTitle: "The Armor-Plated Nest Breaker",
        specializedHardware: "Heavy digging claws, overlapping scales, and a long adhesive tongue make Sunda pangolins specialized hardware for opening insect fortresses cleanly.",
        systemsScript: "Pangolins convert ant and termite abundance into predator pressure that other mammals often cannot apply efficiently. They are niche specialists that keep one huge invertebrate resource from remaining unchallenged.",
        strategicInsight: "A narrow toolset can still be premium if it solves a hard problem no one else wants."
    },
    meerkat: {
        roleTitle: "The Cooperative Sentinel Mesh",
        specializedHardware: "Upright vigilance posture, coordinated alarm language, and digging-ready limbs make meerkats social detection hardware for open dry ground.",
        systemsScript: "Meerkats reduce predation uncertainty by turning many small mammals into one shared warning network. They prove that survival at small body size depends on information quality as much as escape speed.",
        strategicInsight: "Small units become formidable when they pool watch duty instead of pretending every member can do everything alone."
    },
    "red-panda": {
        roleTitle: "The Cool-Canopy Browser",
        specializedHardware: "Insulating fur, balancing tail, climbing skill, and bamboo-tolerant digestion make red pandas mountain forest browsing hardware with low-noise precision.",
        systemsScript: "Red pandas move through cool bamboo forests where canopy continuity and understory structure decide everything. They are a signal that the mountain system still has enough texture to support specialists.",
        strategicInsight: "Fragile systems often depend on continuity more than scale. Break the chain and the specialist disappears first."
    },
    "fennec-fox": {
        roleTitle: "The Desert Listening Post",
        specializedHardware: "Oversized ears, sand-ready feet, and heat-dumping body proportions make the fennec fox sensory hardware for dry low-cover hunting.",
        systemsScript: "Fennecs convert small nighttime signals into survival in habitats with little margin for wasted motion. They show how desert systems reward detection and cooling more than brute power.",
        strategicInsight: "In harsh environments, the best upgrade is often better sensing, not more force."
    },
    "ring-tailed-lemur": {
        roleTitle: "The Scent-Driven Social Router",
        specializedHardware: "Long balancing tail, strong group awareness, and heavy reliance on scent communication make ring-tailed lemurs robust dry-forest social hardware.",
        systemsScript: "They move seeds, browse selectively, and maintain social traffic through patchy Madagascar habitats. Their behavior keeps fragmented dry forest from functioning like isolated scraps.",
        strategicInsight: "When visibility is limited or conditions are patchy, durable communication keeps groups from dissolving into guesswork."
    },
    babirusa: {
        roleTitle: "The Island Forest Rooter",
        specializedHardware: "Long legs, strong snout, and agile forest movement make babirusas specialized for wet tropical foraging rather than classic pig-style plowing alone.",
        systemsScript: "Babirusas recycle fallen forest material and disturb soil lightly while moving through island ecosystems already short on redundancy. Their rarity makes them biologically strategic even when they stay unseen.",
        strategicInsight: "Do not judge system importance by visibility. Rare movers can still carry disproportionate structural value."
    },
    wolverine: {
        roleTitle: "The Cold-Range Persistence Engine",
        specializedHardware: "Broad snow-travel feet, powerful jaws, and relentless endurance make wolverines scavenger-predator hardware built for low-density cold landscapes.",
        systemsScript: "Wolverines keep carcasses, caches, and sparse prey networks connected across huge territories. They thrive where persistence and reach matter more than elegance.",
        strategicInsight: "When resources are sparse, range and follow-through become competitive advantages of their own."
    }
});

Object.assign(expandedSpeciesSystemsIntelligenceData, {
    "peregrine-falcon": {
        roleTitle: "The Vertical Strike Specialist",
        specializedHardware: "Pointed wings, deep chest, visual lock, and impact-tuned talons make peregrines aerial interception hardware built for velocity with control.",
        systemsScript: "Peregrines regulate bird movement in open airspace, coastlines, and cliffs. They turn altitude into a killing advantage and keep flock behavior from becoming complacent.",
        strategicInsight: "If gravity can do part of the work, let it. Great systems borrow force from setup."
    },
    "greater-flamingo": {
        roleTitle: "The Saline Filter Processor",
        specializedHardware: "Long legs, downturned filter-feeding bill, and flock-scale movement make flamingos wetland processing hardware for shallow nutrient-rich water.",
        systemsScript: "Flamingos convert microscopic productivity into visible biomass and signal whether a saline wetland is still functioning at scale. Their abundance is often a readout of the whole water chemistry story.",
        strategicInsight: "Do not ignore low-level input streams. Tiny resources, processed well, can support very large systems."
    },
    "common-kingfisher": {
        roleTitle: "The Streamside Precision Dart",
        specializedHardware: "A spear-like bill, compact flight profile, and water-reading vision make the kingfisher efficient strike hardware for clear shallow channels.",
        systemsScript: "Kingfishers translate small-fish movement into predator pressure across ponds and streams. They connect perch availability, bank stability, and water clarity into one visible hunting system.",
        strategicInsight: "Precision wins when the window is brief. Hold the perch, read the surface, then commit cleanly."
    },
    "toco-toucan": {
        roleTitle: "The Canopy Reach Tool",
        specializedHardware: "An oversized but lightweight bill and fruit-handling agility make toucans canopy access hardware for resources hanging beyond easy branch reach.",
        systemsScript: "Toucans move seeds through tropical woodland and edge habitats while working fruit layers other birds handle less efficiently. They are distribution systems disguised as spectacle.",
        strategicInsight: "A strange tool is still a good tool if it extends your reach into profitable territory."
    },
    "indian-peafowl": {
        roleTitle: "The Display-Weighted Forager",
        specializedHardware: "Ground-running legs, omnivorous feeding hardware, and visually extravagant male trains make peafowl a blend of practical forager and display machine.",
        systemsScript: "Peafowl connect insect control, seed use, and visual signaling in human-adjacent landscapes. They prove that showmanship can coexist with very practical resource use.",
        strategicInsight: "A system can carry a costly display only if the operational core still works."
    },
    "rhinoceros-hornbill": {
        roleTitle: "The Old-Growth Courier",
        specializedHardware: "A heavy fruit-handling bill, strong flight, and dependence on giant cavity trees make rhinoceros hornbills distribution hardware for mature tropical forest.",
        systemsScript: "Hornbills move seeds across large canopy distances and tie reproduction directly to old trees. They are part courier network, part forest continuity alarm.",
        strategicInsight: "Do not separate logistics from infrastructure. If the nesting platform disappears, the delivery system goes with it."
    },
    "southern-cassowary": {
        roleTitle: "The Rainforest Seed Bulldozer",
        specializedHardware: "Powerful legs, large fruit-swallowing gape, and dense-forest mobility make cassowaries heavy transport hardware for big-seed tropical plants.",
        systemsScript: "Cassowaries move large fruits through rainforest systems that lack many equivalent dispersers. They help forests rebuild from the inside by carrying tomorrow’s canopy away from today’s tree.",
        strategicInsight: "Some systems scale by moving what others cannot. Do not underestimate the value of heavy transport."
    },
    "emperor-penguin": {
        roleTitle: "The Colony Heat Engine",
        specializedHardware: "Dense insulation, deep-dive physiology, and huddle-driven heat management make emperor penguins collective survival hardware for polar extremes.",
        systemsScript: "They connect Antarctic sea ice, marine prey, and breeding success in one brutally exposed loop. If the ice platform shifts, the colony’s entire operating model is stressed.",
        strategicInsight: "In severe conditions, shared buffering beats isolated strength. The group can hold what the individual cannot."
    },
    "ruby-throated-hummingbird": {
        roleTitle: "The Hovering Nectar Probe",
        specializedHardware: "Rapid wingbeats, a needle bill, and a metabolism built for constant refueling make hummingbirds micro-scale energy extraction hardware.",
        systemsScript: "They tie flower spacing to pollination flow and turn scattered nectar points into a navigable network. Their survival depends on route efficiency more than brute endurance.",
        strategicInsight: "When margins are thin, optimize the route. Tiny inefficiencies become existential at high burn rates."
    },
    "great-blue-heron": {
        roleTitle: "The Wetland Spear Platform",
        specializedHardware: "Long legs, telescoping neck mechanics, and a stabbing bill make herons patient interception hardware for shallow water prey.",
        systemsScript: "Herons regulate fish, frogs, and small aquatic animals while mapping wetland productivity in plain sight. They turn still water into an arena of timed precision rather than random waiting.",
        strategicInsight: "Stillness is useful when it shortens the distance between signal and strike."
    },
    "wandering-albatross": {
        roleTitle: "The Ocean Wind Broker",
        specializedHardware: "Extreme wingspan and dynamic soaring control make albatrosses atmospheric energy-harvesting hardware for long-range ocean movement.",
        systemsScript: "Albatrosses convert wind structure into global-scale foraging reach, linking isolated marine resources across vast distances. They are proof that motion efficiency can outcompete raw exertion by orders of magnitude.",
        strategicInsight: "Learn the currents first. Systems that ride existing energy go farther on less."
    },
    "scarlet-macaw": {
        roleTitle: "The Canopy Seed Cracker",
        specializedHardware: "A crushing bill, mobile zygodactyl feet, and loud social flight make macaws forest processing hardware for hard fruits and seeds.",
        systemsScript: "Macaws open tough plant resources and redistribute seeds through long flights between fruiting trees. Their presence helps keep canopy food systems dynamic instead of localized.",
        strategicInsight: "Some value stays locked until the right tool arrives. Build for access, not just speed."
    },
    shoebill: {
        roleTitle: "The Swamp Stillness Engine",
        specializedHardware: "A giant gripping bill, long wetland legs, and remarkable motion control make the shoebill ambush hardware for dense marsh channels.",
        systemsScript: "Shoebills convert hidden swamp prey into top-level pressure in habitats too cluttered for many other large birds. They remind the wetland that concealment is never complete.",
        strategicInsight: "If the target lives in noise and clutter, patience becomes part of the equipment."
    },
    "secretary-bird": {
        roleTitle: "The Ground-Stroke Enforcer",
        specializedHardware: "Long shock-absorbing legs, raptor vision, and precise kicking force make secretarybirds unusual strike hardware built for open-ground reptile control.",
        systemsScript: "Secretarybirds apply predatory pressure where grassland reptiles and small animals might otherwise move with too much freedom. They occupy a narrow but highly strategic lane among raptors.",
        strategicInsight: "Do not copy the standard model if the terrain wants a different tool. Fit the method to the surface."
    },
    "bali-myna": {
        roleTitle: "The Island Signal Fragility Meter",
        specializedHardware: "A cavity-nesting body plan, conspicuous plumage, and flexible insect-fruit feeding make Bali mynas light woodland hardware with unusually high exposure to human pressure.",
        systemsScript: "The species reveals how quickly a tiny island system can lose resilience when trapping and habitat loss converge. It is less a backup component than a warning light about scarcity.",
        strategicInsight: "Scarcity magnifies every mistake. The smaller the system, the less room there is for casual damage."
    },
    "barn-swallow": {
        roleTitle: "The Aerial Insect Net",
        specializedHardware: "Forked tail steering, narrow wings, and high-frequency turning control make swallows efficient flying insect capture hardware.",
        systemsScript: "Barn swallows skim insect populations over fields, wetlands, and human settlements while linking migration routes to everyday architecture. They turn open air into a working harvest zone.",
        strategicInsight: "If the resource is moving, your system has to move with equal fluency."
    },
    "atlantic-puffin": {
        roleTitle: "The Burrow-Sea Commuter",
        specializedHardware: "Wing-powered diving, fish-carrying bill design, and colony nesting behavior make puffins two-environment logistics hardware.",
        systemsScript: "Puffins shuttle marine productivity from cold seas into cliff and island colonies. Their success depends on whether ocean food pulses still line up with breeding deadlines.",
        strategicInsight: "A good system can work across environments, but only if the timing between them still syncs."
    },
    hoopoe: {
        roleTitle: "The Soil Probe Specialist",
        specializedHardware: "A curved probing bill and open-ground foraging posture make hoopoes efficient extraction hardware for hidden invertebrates in shallow soil.",
        systemsScript: "Hoopoes turn insect-rich ground into accessible bird energy while tying cavity nests to open feeding zones. They thrive where structure and exposed soil remain in workable balance.",
        strategicInsight: "Surface appearances lie. Good operators know where to probe beneath them."
    },
    "laughing-kookaburra": {
        roleTitle: "The Perch-and-Drop Controller",
        specializedHardware: "A heavy bill, broad perch vision, and short decisive strike pattern make kookaburras ambush hardware for mixed prey below branch height.",
        systemsScript: "They convert elevated waiting points into predatory control over reptiles, insects, and small mammals. Their territory calls also make acoustic space part of the operating system.",
        strategicInsight: "You do not need constant motion when you already own the perch."
    },
    "greater-bird-of-paradise": {
        roleTitle: "The Display-Driven Recruiter",
        specializedHardware: "Elaborate flank plumes, strong canopy mobility, and behavior tuned for repeated performance make this bird a signaling system built for mate selection pressure.",
        systemsScript: "Birds-of-paradise shift reproductive competition into visible display arenas that concentrate attention and choice. They show how sexual selection can become a structural force in its own right.",
        strategicInsight: "A strong signal only matters if the audience can evaluate it clearly. Design for legibility, not just spectacle."
    },
    "rainbow-bee-eater": {
        roleTitle: "The Aerial Stinger Filter",
        specializedHardware: "Fine flight control, long bill, and prey-handling precision make bee-eaters specialized hardware for catching and disarming flying insects.",
        systemsScript: "Bee-eaters reduce aerial insect abundance while converting open sky and sandy nest banks into a tightly linked feeding-breeding system. They make niche precision look easy.",
        strategicInsight: "Specialization pays when the handling protocol is as important as the catch."
    },
    "green-sea-turtle": {
        roleTitle: "The Seagrass Route Keeper",
        specializedHardware: "Strong foreflippers, ocean navigation, and herbivorous marine feeding make green turtles long-range coastal maintenance hardware.",
        systemsScript: "Green turtles graze seagrass and move nutrients between nesting beaches and feeding grounds. They connect coastlines separated by huge distance but one reproductive cycle.",
        strategicInsight: "Long systems need reliable return points. Migration works because some coordinates stay non-negotiable."
    },
    "american-alligator": {
        roleTitle: "The Freshwater Edge Governor",
        specializedHardware: "Broad-snouted ambush design, armored body, and wetland excavation behavior make alligators control hardware for warm freshwater systems.",
        systemsScript: "Alligators regulate shoreline prey and create physical wetland features other species later use. They do not just occupy swamps; they help structure them.",
        strategicInsight: "Real power shows up when control and habitat-building happen in the same system."
    },
    "reticulated-python": {
        roleTitle: "The Long-Range Constrictor",
        specializedHardware: "Thermal sensing pits, immense muscular length, and camouflage patterning make reticulated pythons flexible ambush hardware for dense tropical cover.",
        systemsScript: "They apply pressure across river margins, forests, and edge habitats while converting body length into access to many prey sizes. Their strength is range plus concealment, not just size.",
        strategicInsight: "Flexibility scales when one system can operate across water, ground, and canopy edges without redesign."
    },
    "green-anaconda": {
        roleTitle: "The Swamp Coil Anchor",
        specializedHardware: "Heavy aquatic body mass, low-profile head placement, and constriction strength make anacondas ambush hardware for slow dark wetlands.",
        systemsScript: "Anacondas own the murky zone where visibility collapses and surface confidence gets punished. They keep wetland prey from treating shallow cover as safety by default.",
        strategicInsight: "If the environment hides you for free, let the environment subsidize your advantage."
    }
});

Object.assign(expandedSpeciesSystemsIntelligenceData, {
    "marine-iguana": {
        roleTitle: "The Tidal Algae Harvester",
        specializedHardware: "Salt-expelling nasal glands, laterally compressed tail, and dark heat-absorbing skin make marine iguanas shoreline hardware built for cold surf grazing.",
        systemsScript: "Marine iguanas convert intertidal algae into reptile biomass in a niche most lizards cannot touch. They prove that evolutionary design can turn a rocky hazard zone into a dependable feeding lane.",
        strategicInsight: "If a resource looks unusable to everyone else, specialized handling can turn it into your home field."
    },
    "frilled-lizard": {
        roleTitle: "The Bluff Display Specialist",
        specializedHardware: "Expandable neck frill, bipedal sprint escape, and tree-ready claw structure make this lizard rapid-escalation hardware for exposed woodland edges.",
        systemsScript: "Frilled lizards survive by turning visibility into a deterrence tool before a chase becomes expensive. They are a reminder that defense is often about changing the opponent's math early.",
        strategicInsight: "A good warning system resolves conflict before you spend premium energy on full engagement."
    },
    "leopard-gecko": {
        roleTitle: "The Dryland Night Operator",
        specializedHardware: "Movable eyelids, fat-storing tail, and low-light hunting senses make leopard geckos resilient nocturnal hardware for arid and rocky terrain.",
        systemsScript: "They clean up insects and small prey in the cooler hours when daytime heat loses its advantage. Their niche runs on timing discipline and energy storage rather than brute force.",
        strategicInsight: "Resilience improves when you carry reserves and choose the shift that fits your hardware."
    },
    "black-mamba": {
        roleTitle: "The High-Speed Pressure Unit",
        specializedHardware: "Long muscular body, elevated head carriage, and fast-acting venom delivery make black mambas strike hardware optimized for speed, reach, and decisiveness.",
        systemsScript: "Black mambas regulate small mammal and bird populations across dry African landscapes while showing how mobility changes predator geometry. They do not own one hiding place; they own the gap between them.",
        strategicInsight: "Velocity matters most when it is paired with accuracy and a clear exit route."
    },
    axolotl: {
        roleTitle: "The Permanent Juvenile Repair Lab",
        specializedHardware: "External gills, aquatic neoteny, and unusual regenerative capacity make axolotls living hardware for low-motion survival and tissue rebuilding.",
        systemsScript: "Axolotls occupy cool freshwater systems where regeneration, camouflage, and patience outperform speed. They are less about domination and more about biological repair efficiency under pressure.",
        strategicInsight: "Some systems win not by avoiding damage entirely, but by rebuilding faster than disruption compounds."
    },
    "poison-dart-frog": {
        roleTitle: "The Color-Coded Micro Fortress",
        specializedHardware: "Skin alkaloid defenses, bright warning coloration, and precise moisture dependence make poison dart frogs compact hardware for high-risk tropical floor systems.",
        systemsScript: "They help regulate small invertebrate populations while translating chemical defense into a public signal. Their whole design says the strongest deterrent is one your environment can recognize instantly.",
        strategicInsight: "If you must defend a small footprint, make the cost of testing you obvious."
    },
    "red-eyed-tree-frog": {
        roleTitle: "The Startle-Signal Sleeper",
        specializedHardware: "Adhesive toe pads, bright concealed eye color, and leaf-resting camouflage make this frog arboreal hardware built for hiding until surprise becomes useful.",
        systemsScript: "Red-eyed tree frogs operate in canopy-edge moisture systems where stillness is the main budget saver and sudden contrast buys escape time. They use visibility strategically, not constantly.",
        strategicInsight: "Not every capability belongs in your default state. Some advantages work best when revealed late."
    },
    "glass-frog": {
        roleTitle: "The Transparency Engineer",
        specializedHardware: "Semi-transparent body tissues, underside leaf use, and streamside egg-guarding behavior make glass frogs stealth hardware for wet tropical margins.",
        systemsScript: "Glass frogs tie forest leaves to stream reproduction, turning delicate microhabitats into viable nurseries. Their niche works because concealment and site choice reinforce each other.",
        strategicInsight: "When the environment is noisy, the cleanest strategy can be to remove obvious edges from your profile."
    },
    "chinese-giant-salamander": {
        roleTitle: "The Riverbed Ambush Relic",
        specializedHardware: "Massive flattened body, sensory skin folds, and low-light aquatic hunting design make this salamander bottom-channel hardware for fast freshwater systems.",
        systemsScript: "It occupies cold river systems as a quiet apex amphibian, converting hidden structure into predatory leverage. Its decline also makes one point painfully clear: specialized hardware collapses fast when the channel is redesigned.",
        strategicInsight: "Do not mistake ancient design for outdated design. Some systems are optimized so tightly they fail only when the operating environment is broken."
    },
    "american-bullfrog": {
        roleTitle: "The Wetland Expansionist",
        specializedHardware: "Large gape, powerful hind limbs, and broad diet flexibility make bullfrogs generalist hardware for ponds, marshes, and human-shaped water bodies.",
        systemsScript: "Bullfrogs turn almost any still-water system into an opportunity by eating widely and reproducing effectively. They show how generalist biology can become infrastructure-level competitive advantage.",
        strategicInsight: "Breadth becomes power when you can perform adequately across many conditions while specialists wait for perfect ones."
    },
    hellbender: {
        roleTitle: "The Oxygen Channel Monitor",
        specializedHardware: "Wrinkled skin for gas exchange, flattened body shape, and rock-crevice occupation make hellbenders stream hardware built around clean fast water.",
        systemsScript: "Hellbenders are living diagnostics for river quality because their biology leaves little room for dirty or stagnant conditions. When they disappear, the system is usually confessing something.",
        strategicInsight: "The best indicators are not loud. They simply stop working when the environment falls below standard."
    },
    "wallaces-flying-frog": {
        roleTitle: "The Canopy Glide Connector",
        specializedHardware: "Extensive webbed feet, long limbs, and controlled gliding posture make this frog transitional hardware for moving between trees without needless descent.",
        systemsScript: "It links vertical forest space by treating air as a transport layer rather than a void. That lets it reduce exposure on the ground while exploiting dispersed canopy resources.",
        strategicInsight: "When movement between nodes is risky, redesign the route instead of accepting the default path."
    },
    "monarch-butterfly": {
        roleTitle: "The Generational Navigator",
        specializedHardware: "Long-distance flight efficiency, sun-compass orientation, and milkweed-linked chemical defense make monarchs migration hardware spread across multiple life stages.",
        systemsScript: "Monarchs stitch continents together through pollination, herbivory, and migration timing. Their life cycle demonstrates that a system can exceed one lifespan if the rules persist across generations.",
        strategicInsight: "You can build long-range continuity when each stage inherits direction, not just momentum."
    },
    dragonfly: {
        roleTitle: "The Aerial Interceptor",
        specializedHardware: "Independent wing control, near-360-degree vision, and predictive flight tracking make dragonflies elite hardware for midair capture.",
        systemsScript: "Dragonflies suppress mosquitoes and other insects across wetland systems while bridging aquatic juvenile stages and aerial adulthood. Few designs switch domains this cleanly and stay lethal in both.",
        strategicInsight: "Precision compounds when sensing and maneuverability improve together instead of separately."
    },
    "praying-mantis": {
        roleTitle: "The Patience Blade",
        specializedHardware: "Raptorial forelegs, swiveling vision, and camouflage posture make mantises capture hardware optimized for stillness followed by abrupt violence.",
        systemsScript: "Mantises help regulate insect traffic by turning leaves, stems, and garden edges into ambush platforms. They are a case study in how posture can be part of the weapon system.",
        strategicInsight: "Do not confuse inactivity with passivity. Some of the sharpest systems spend most of their time waiting correctly."
    },
    "dung-beetle": {
        roleTitle: "The Waste Logistics Engineer",
        specializedHardware: "Compact pushing strength, scent tracking, and ball-rolling behavior make dung beetles nutrient-transfer hardware for grasslands and forests.",
        systemsScript: "Dung beetles bury waste, suppress parasites, and move fertility back into the soil. They perform janitorial work that every productive ecosystem quietly depends on.",
        strategicInsight: "Systems improve when someone handles the unglamorous throughput everyone else would rather ignore."
    },
    "atlas-moth": {
        roleTitle: "The One-Cycle Messenger",
        specializedHardware: "Massive wing display, stored larval energy, and adult life focused almost entirely on reproduction make atlas moths short-window signaling hardware.",
        systemsScript: "Atlas moths compress their adult mission into mating, while caterpillars do the real accumulation phase earlier. The design is blunt but effective: build first, signal later.",
        strategicInsight: "Not every phase should multitask. Some windows are for building, others are for deploying."
    },
    "leafcutter-ant": {
        roleTitle: "The Distributed Agriculture Platform",
        specializedHardware: "Mandible cutting tools, caste-based labor, and fungus cultivation behavior make leafcutter ants farm hardware running at colony scale.",
        systemsScript: "Leafcutter ants move plant material into underground fungal production systems, effectively outsourcing digestion to a cultivated partner. They demonstrate what happens when logistics and biology merge into one supply chain.",
        strategicInsight: "Scale becomes durable when you stop doing every task yourself and start designing symbiotic infrastructure."
    },
    "rhinoceros-beetle": {
        roleTitle: "The Leverage Combat Specialist",
        specializedHardware: "Horn-based lifting geometry, armored exoskeleton, and powerful thoracic muscles make rhinoceros beetles close-quarters contest hardware.",
        systemsScript: "They turn decomposer-rich habitats into arenas where strength and leverage decide access to mates and resources. Their lesson is mechanical: shape can convert force into dominance efficiently.",
        strategicInsight: "Raw power matters less than where your structure lets you apply it."
    },
    cicada: {
        roleTitle: "The Delayed Emergence Amplifier",
        specializedHardware: "Subterranean juvenile development, synchronized emergence, and high-volume acoustic organs make cicadas timing hardware on a mass scale.",
        systemsScript: "Cicadas move nutrients from roots to surface food webs and overwhelm predators through sheer emergence volume. They show how timing can be a defense, not just a schedule.",
        strategicInsight: "If you cannot win by being scarce, sometimes you win by arriving all at once."
    },
    "orchid-mantis": {
        roleTitle: "The Floral Ambush Illusion",
        specializedHardware: "Petal-like limbs, color mimicry, and still hunting posture make orchid mantises deception hardware tuned for pollinator-rich environments.",
        systemsScript: "This mantis exploits the visual trust insects place in flowers, converting attraction into predation. It is an elegant reminder that signal systems can always be gamed by a skilled mimic.",
        strategicInsight: "If attention flows predictably, someone will learn to intercept it. Design with signal security in mind."
    },
    clownfish: {
        roleTitle: "The Mutualism Tenant",
        specializedHardware: "Protective mucus coating, maneuverable reef swimming, and social hierarchy make clownfish reef hardware built for living inside another species' defenses.",
        systemsScript: "Clownfish turn sea anemones into fortified homes while providing cleaning and nutrient benefits in return. Their niche works because partnership is the architecture, not an optional extra.",
        strategicInsight: "A strong alliance is not decorative. It should change what each side can survive."
    },
    seahorse: {
        roleTitle: "The Vertical Drift Sniper",
        specializedHardware: "Prehensile tail, independently moving eyes, and suction feeding snout make seahorses precision hardware for structured shallow waters.",
        systemsScript: "Seahorses patrol seagrass and reef-edge habitats by anchoring themselves in moving water and striking tiny prey with minimal motion. Their design is strange only if you expect speed to solve everything.",
        strategicInsight: "Stability can be the enabling technology that makes precision possible."
    },
    "manta-ray": {
        roleTitle: "The Plankton Flight Wing",
        specializedHardware: "Enormous pectoral fins, cephalic lobes, and filter-feeding architecture make manta rays open-water hardware for efficient suspended feeding.",
        systemsScript: "Mantas convert plankton blooms into large graceful biomass while linking reef cleaning stations, migration routes, and productivity pulses. They ride resource patterns instead of trying to manufacture them.",
        strategicInsight: "Efficiency increases when you learn the flow of abundance and enter it at the right scale."
    },
    "great-white-shark": {
        roleTitle: "The Thermal Pursuit Apex",
        specializedHardware: "Regional endothermy, electroreception, and high-torque swimming design make great white sharks pursuit hardware for powerful marine predation.",
        systemsScript: "They regulate marine food webs by pressuring seals, fish, and other prey species across coastal and pelagic routes. Great whites keep movement honest in the upper tiers of the oceanic system.",
        strategicInsight: "Top performance is rarely one feature. It is a stack of sensing, power, and timing that works under load."
    },
    "scalloped-hammerhead": {
        roleTitle: "The Wide-Array Sensor Platform",
        specializedHardware: "Hammer-shaped head, expanded electroreception spacing, and coordinated schooling behavior make hammerheads broad-scan hardware for complex marine hunting.",
        systemsScript: "Scalloped hammerheads convert unusual head geometry into better prey detection and maneuvering, especially around reefs and seamounts. Their design proves shape can be a sensing strategy.",
        strategicInsight: "A wider information array can change decision quality more than simply moving faster."
    },
    cuttlefish: {
        roleTitle: "The Instant Interface Designer",
        specializedHardware: "Dynamic skin chromatophores, advanced eyes, and flexible arm control make cuttlefish adaptive display hardware for camouflage, hunting, and signaling.",
        systemsScript: "Cuttlefish move through reef and seafloor systems by changing the visible interface faster than most predators or prey can parse it. Their biology treats appearance as an active operating layer.",
        strategicInsight: "Presentation is not superficial when it directly changes survival, access, and interpretation."
    },
    "chambered-nautilus": {
        roleTitle: "The Buoyancy Archivist",
        specializedHardware: "Gas-filled shell chambers, simple but effective sensory setup, and vertical migration behavior make nautiluses depth-management hardware.",
        systemsScript: "Nautiluses occupy a slow, deliberate niche in deep reef-adjacent waters, turning buoyancy control into long-term stability. They are proof that elegant engineering does not always need novelty to remain viable.",
        strategicInsight: "A durable system often comes from careful calibration, not constant reinvention."
    },
    "sea-cucumber": {
        roleTitle: "The Seafloor Recycler",
        specializedHardware: "Sediment-processing feeding structures, flexible body design, and chemical defense options make sea cucumbers benthic cleanup hardware.",
        systemsScript: "They recycle organic matter on the seabed and keep nutrient flow moving through marine bottom systems. Remove them and the floor gets dirtier, slower, and less efficient.",
        strategicInsight: "Maintenance is easy to underrate until the system starts choking on what nobody processed."
    },
    lionfish: {
        roleTitle: "The Venom-Spined Invader",
        specializedHardware: "Venomous fin spines, ambush feeding style, and broad habitat tolerance make lionfish predatory hardware that scales too well in the wrong system.",
        systemsScript: "In native ranges they are one predator among many; in invaded reefs they become a stress test for ecological defenses. Lionfish show how dangerous efficient hardware becomes when checks are missing.",
        strategicInsight: "Performance without constraints is not excellence. It is often a system failure in disguise."
    },
    "bluefin-tuna": {
        roleTitle: "The Oceanic Endurance Engine",
        specializedHardware: "Streamlined body, powerful red muscle, and heat-conserving circulation make bluefin tuna long-range pursuit hardware for open water.",
        systemsScript: "Bluefin tuna connect distant ocean regions through migration and predation, converting speed into access across enormous marine grids. Their operating model is scale, stamina, and relentless directional efficiency.",
        strategicInsight: "When the arena is huge, endurance and routing intelligence outperform short bursts of brilliance."
    }
});

export const speciesSystemsIntelligence = {
    ...baseSpeciesSystemsIntelligenceData,
    ...expandedSpeciesSystemsIntelligenceData
};

export function getSystemsIntelligenceBySpeciesSlug(slug: string) {
    return speciesSystemsIntelligence[slug];
}

export function getSystemsIntelligenceEntriesForSpeciesSlugs(slugs: string[]) {
    return slugs
        .map((slug) => {
            const entry = getSystemsIntelligenceBySpeciesSlug(slug);

            if (!entry) {
                return null;
            }

            return {
                slug,
                entry
            };
        })
        .filter((item): item is {slug: string; entry: SystemsIntelligenceEntry} => Boolean(item));
}

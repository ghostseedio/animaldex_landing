/**
 * Hand-written "what animal is it based on" answers for the most-searched
 * Pokémon pages. They describe resemblance and widely reported inspiration;
 * only name-based or long-documented links are stated as fact, and none are
 * presented as official design statements. Each answer runs 120–200 words.
 */
export type PokemonAnimalNote = {
    /** Paragraphs rendered under the page's one-line answer. */
    paragraphs: string[];
};

export const pokemonAnimalNotes: Record<string, PokemonAnimalNote> = {
    mewtwo: {
        paragraphs: [
            "Mewtwo is not a real animal in any sense: in the Pokémon story it is a genetically engineered clone created from the DNA of Mew, then altered to make it more powerful. That artificial origin is why it has no single animal counterpart.",
            "Its body still borrows from real animals. The rounded head, short ear-like horns, three-fingered paws and digitigrade legs (standing on its toes, like a cat) give Mewtwo a strongly feline look, and it inherits that cat-like shape from Mew. The thick, muscular tail and upright stance are often compared to a kangaroo, which uses its tail as a counterweight and a prop when standing.",
            "The tube running from the back of its head to its spine has no animal equivalent and is usually read as part of its laboratory design. The fairest answer is that Mewtwo is a feline humanoid: a cat-like body plan with kangaroo-like proportions, built around a science-fiction idea rather than one species."
        ]
    },
    mew: {
        paragraphs: [
            "Mew does not copy one real animal. It is presented as the ancestor of all Pokémon, and its design reflects that: a small, pink, big-headed creature with large eyes, short limbs and a very long, thin tail.",
            "The resemblance most people notice is to a cat. Mew's rounded head, triangular ears, paw-like hands and feet, and its playful, curious behavior all read as feline. Its clone, Mewtwo, keeps the same cat-like frame on a larger body.",
            "The other common comparison is to an embryo or a newborn mammal. Mew's oversized head, smooth hairless-looking skin and curled floating pose look like the early stage of a mammal, which suits its role as a genetic ancestor that contains the code of every Pokémon.",
            "So the answer is a cat-like mammal with embryo-like proportions. The real animal page below covers the domestic cat, the closest match for its body shape."
        ]
    },
    pikachu: {
        paragraphs: [
            "Pikachu is officially classified as the Mouse Pokémon, so a mouse is the first answer. Its rounded body, small paws, large ears and habit of storing electricity in its cheek pouches all fit a small rodent.",
            "The second answer comes from its name. \"Pika\" is the Japanese sound for a spark, and it is also the name of a real animal: the pika, a small, round-eared relative of rabbits that lives on rocky mountain slopes. Pikachu's compact body, short limbs and rounded ears look much more like a pika than a typical long-snouted mouse, which is why many fans treat the pika as its closest real counterpart.",
            "Squirrels are another often-cited influence, for its bushy lightning-bolt tail and cheek pouches. Pikachu's evolution, Raichu, keeps the same rodent body with a longer tail.",
            "The real animals below are the pika and the house mouse, the two animals its shape and name point to."
        ]
    },
    eevee: {
        paragraphs: [
            "Eevee is a small mammal composite rather than one species, which suits its role as the Evolution Pokémon that can turn into many different forms.",
            "The resemblance most people see first is a fox. Eevee's large pointed ears, bushy tail, slender muzzle and the thick ruff of fur around its neck are all fox-like, and its brown coat with a cream collar recalls a red fox in its winter coat. Others see a small dog or puppy in its playful body language and round eyes, and some point to a cat in its face and body size.",
            "Its evolutions push those traits in different directions. Flareon is the fluffiest and most fox-like, Jolteon spikes its fur, Umbreon and Espeon take on more cat-like proportions, and Vaporeon gains fins and a fish-like tail.",
            "The closest real matches are the red fox and the domestic dog, both covered below with their real diet, lifespan and AnimalDex stats."
        ]
    },
    charizard: {
        paragraphs: [
            "Charizard is a dragon, and dragons are mythical, so it has no exact real-animal counterpart. In Western terms it is a classic winged, fire-breathing dragon with a long neck and tail.",
            "Its evolution line explains where the reptile look comes from. Charmander is the Lizard Pokémon, and its name blends \"char\" with \"salamander\". In European folklore the salamander was said to live in fire, which is where the flame on the tail fits in. Real salamanders are amphibians that prefer damp places, not fire.",
            "As the line evolves, the body becomes a large upright lizard. Among real animals, the closest match for Charizard's heavy, long-tailed reptile frame is a monitor lizard such as the Komodo dragon, the largest living lizard. Its wings are often compared to a bat's or a pterosaur's, since no lizard has wings.",
            "The real animal below is the Komodo dragon, the nearest living thing to Charizard's body shape, not to its wings or fire."
        ]
    },
    lucario: {
        paragraphs: [
            "Lucario's closest real animal is a canine, most often described as a jackal or a wolf. Its category, the Aura Pokémon, does not name an animal, but the design is clearly dog-like.",
            "The long, pointed snout, tall upright ears, black face mask and slim build are the features usually compared to a jackal, and many fans connect it to Anubis, the jackal-headed figure of Egyptian mythology. Its fur pattern, blue and black with a cream chest, and its pack-loyal personality also suggest a wolf. Its pre-evolution Riolu looks more like a young puppy.",
            "Lucario stands and fights on two legs, and the spikes on its paws and chest are fantasy additions with no animal equivalent. They link to its aura-reading abilities rather than to anything a real canid does.",
            "Wolves and jackals both hunt cooperatively, communicate with body posture and rely on a strong sense of smell, which fits Lucario's story as a Pokémon that senses the feelings of others. The real golden jackal and gray wolf are covered below."
        ]
    },
    snorlax: {
        paragraphs: [
            "Snorlax is most often compared to a bear. Its huge round body, small rounded ears, broad face and thick, short limbs all fit a bear, and its two famous habits, eating enormous amounts of food and then sleeping for long stretches, echo the way bears feed heavily before winter and then den up.",
            "Other suggested influences include a giant panda, for its cream-and-dark coloring and plant-heavy appetite, and a sloth or cat, for its lazy posture. Its pre-evolution Munchlax keeps the same body on a smaller, hungrier scale.",
            "Real bears do not hibernate in quite the way the cartoon idea suggests. Many enter a long, deep winter rest, called torpor, during which their heart rate and metabolism drop sharply and they live off stored fat.",
            "Snorlax's size also matches a bear's role as one of the largest land carnivores, though Snorlax is far heavier than any real bear. The real grizzly bear below shows how close the comparison gets."
        ]
    },
    gengar: {
        paragraphs: [
            "Gengar is a Ghost-type Pokémon and is usually described as having no single real-animal counterpart. Its official category, the Shadow Pokémon, refers to its ghostly nature rather than to an animal.",
            "When people do compare it to animals, the usual suggestions are a cat, for its pointed ears and wide grin, which many link to the Cheshire Cat, and a bat, for its spiky silhouette and habit of lurking in the dark. Its round body and stubby limbs also recall an imp or a goblin from folklore more than any living species.",
            "A popular theory points out that Gengar looks like a shadow of Clefairy, with a similar body shape and ears, which fits its story of hiding in people's shadows.",
            "The fairest answer is that Gengar is a ghost or shadow creature built from cat-like and imp-like cues. No real animal is a close match, so AnimalDex pairs it loosely with the Egyptian fruit bat below, the bat it also pairs with Clefairy, and with the aye-aye, a wide-eyed nocturnal primate long feared in folklore."
        ]
    },
    psyduck: {
        paragraphs: [
            "Psyduck is officially the Duck Pokémon, so the first answer is a duck. Its flat bill, webbed feet and love of water are duck traits, and its name combines \"psychic\" with \"duck\".",
            "Its body, though, is not very bird-like. Psyduck stands upright on a stocky body with short arms and a small, flat tail, and many fans think it looks more like a platypus. The platypus is a real egg-laying mammal from eastern Australia with a soft, duck-like bill, webbed feet and a broad tail, so the comparison fits Psyduck's shape well. Golduck, its evolution, is sleeker and more streamlined, like a swimming platypus.",
            "Psyduck's constant headaches are a fantasy trait. Real platypuses do have an unusual sense, though: their bills detect the weak electric fields of prey underwater.",
            "The real animals below are the platypus and the mallard, the duck its name and bill most resemble."
        ]
    },
    magikarp: {
        paragraphs: [
            "Magikarp is a carp. Its name combines \"magic\" with \"carp\", and its orange-red scales, barbels (whisker-like feelers) and large, round eyes are all carp features.",
            "The design is also tied to a well-known East Asian legend. In the story of the Dragon Gate, a carp that manages to leap up a great waterfall is transformed into a dragon. Magikarp follows that story exactly: a famously weak fish that, after enough effort, evolves into the huge, dragon-like Gyarados. The legend is the source of the Japanese carp streamers flown on Children's Day as a symbol of perseverance.",
            "Real carp are tougher than Magikarp. The common carp lives in slow rivers and lakes across Europe and Asia, can grow to a large size, and is one of the hardiest freshwater fish, tolerating cold water and low oxygen.",
            "The real carp below includes its diet, lifespan and AnimalDex stats."
        ]
    },
    gyarados: {
        paragraphs: [
            "Gyarados is a sea serpent or dragon, so it has no exact real-animal counterpart. Its closest real link is the carp, because it evolves from the carp-like Magikarp.",
            "That evolution follows the East Asian legend of the Dragon Gate, in which a carp that leaps a great waterfall is transformed into a dragon. Gyarados is the dragon at the end of that story: a long, serpentine body, a huge open mouth, whisker-like barbels and fin crests, much like the dragons in Chinese and Japanese art.",
            "Some fans also compare its body to a sea snake or an eel, both long-bodied water animals, and the Atrocious Pokémon category points to its violent temper rather than to an animal.",
            "Gyarados is a Water and Flying type rather than a Dragon type, a nod to its fish origins. The real animal below is the carp, the fish its line starts from."
        ]
    },
    bulbasaur: {
        paragraphs: [
            "Bulbasaur is a plant-and-animal composite, so its answer has two parts: the plant bulb on its back, and the animal underneath it.",
            "The animal part is most often compared to a frog or toad. Bulbasaur's squat four-legged body, wide mouth and short limbs read as amphibian, and its blue-green, spotted skin fits a frog. Its evolutions make the link stronger, and Venusaur in particular looks like a large, heavy toad.",
            "Other suggested influences include a small dinosaur, which matches the \"saur\" ending of its name, and a turtle-like back. Its official category, the Seed Pokémon, refers to the plant.",
            "Frogs and toads are a good fit in another way: many real species spend part of their lives in damp, plant-covered places, just as Bulbasaur relies on light and water for its bulb. The real common frog and American toad below give the real facts behind the comparison."
        ]
    },
    squirtle: {
        paragraphs: [
            "Squirtle is a turtle. Its official category is the Tiny Turtle Pokémon, and its shell, beak-like mouth and short, sturdy limbs are all turtle traits. Its name blends \"squirt\" with \"turtle\".",
            "The main difference from a real turtle is posture. Squirtle stands upright on two legs and has a curled tail, which is a fantasy addition. Real turtles move on four legs and cannot leave their shells, which are fused to their spine and ribs.",
            "Its evolution Wartortle adds fluffy, wing-like ears and tail, often linked to the minogame, a mythical long-lived turtle from Japanese folklore whose tail grows trailing algae. Blastoise, the final form, keeps the heavy shell and adds water cannons.",
            "The real green sea turtle below shows the kind of aquatic turtle Squirtle's line most resembles, including its diet, lifespan and AnimalDex stats."
        ]
    },
    jigglypuff: {
        paragraphs: [
            "Jigglypuff does not have a clear real-animal counterpart. Its official category, the Balloon Pokémon, describes its round, inflatable body rather than an animal.",
            "When people look for an animal, the usual suggestions are a rabbit or a small round mammal, for its pointed ears, and a balloon or marshmallow for its shape. Its evolution Wigglytuff has much longer, rabbit-like ears, which is why AnimalDex groups the line under a rabbit-like fantasy creature.",
            "Its name and singing are often linked to \"jiggly\" softness and to a puffball, while its signature move, putting listeners to sleep with a lullaby, is a fantasy trait. Some fans have also compared its swelling body to a pufferfish, which inflates itself with water.",
            "The fairest answer is that Jigglypuff is a fantasy creature with light rabbit-like cues. No single species fits well, so AnimalDex pairs it loosely with the European rabbit below, alongside the pufferfish its swelling body recalls."
        ]
    },
    dragonite: {
        paragraphs: [
            "Dragonite is a dragon, so it has no exact real-animal counterpart. Unlike most dragons, though, it is friendly, round and soft-looking, with small wings, short antennae and a large belly.",
            "Its evolution line points to a water creature. Dratini and Dragonair are long, serpentine dragons that live in water, which suggests a sea serpent or a long-bodied water animal such as an eel or sea snake. Dragonite itself is often compared to the Loch Ness Monster and to sea serpents in sailors' tales, and its Pokédex entries describe it rescuing people at sea.",
            "Some fans see a seal or sea lion in its rounded face and gentle expression, and its small wings look more like a bird's than a bat's.",
            "The fairest answer is that Dragonite is a friendly sea-dragon design. No real animal matches its body well; the nearest living comparison is the West African manatee below, a gentle, round-bodied sea mammal that sailors' sea-monster tales are often traced to."
        ]
    },
    umbreon: {
        paragraphs: [
            "Umbreon is one of Eevee's evolutions, so it keeps the same fox-or-dog mammal base. Its slim body, long legs, large ears and bushy tail are canine, and AnimalDex groups it with the red fox and domestic dog.",
            "Its look also borrows from a black cat. The sleek black coat, glowing red eyes and long tail give Umbreon a cat-like silhouette, and black cats carry the same night and moon associations in folklore. Its yellow rings, which glow under moonlight, have no real-animal equivalent.",
            "Umbreon's Moonlight Pokémon category connects it to the night, which fits several real animals. Red foxes are often active at dusk and after dark, and their eyes have a reflective layer, the tapetum lucidum, that makes them shine in a light beam, much like the glow of Umbreon's eyes.",
            "The real animals below are the red fox and the domestic dog."
        ]
    },
    sylveon: {
        paragraphs: [
            "Sylveon is an Eevee evolution, so it keeps the fox-or-dog mammal body of its line: a slim build, large ears, a long tail and four slender legs. AnimalDex groups it with the red fox and domestic dog.",
            "Its Fairy-type design adds traits that have no real-animal match. The ribbon-like feelers that flow from its ear and neck are fantasy features, described as letting it soothe others, and its pastel pink and blue coloring is decorative rather than natural.",
            "Some fans compare its face and soft coat to a cat or a fennec fox, and its bows to a pet's collar ribbon. Others note that many real canids greet and calm one another through touch, grooming and body posture, which fits the way Sylveon uses its feelers.",
            "The fairest answer is a fox-like mammal with fairy-tale decoration. The real red fox and domestic dog below are its closest real counterparts."
        ]
    },
    greninja: {
        paragraphs: [
            "Greninja is a frog. Its line starts with Froakie, the Bubble Frog Pokémon, and Greninja keeps a frog's wide mouth, large eyes, long hind legs and webbed feet. Its name blends \"grenouille\", French for frog, with \"ninja\".",
            "The ninja theme shapes the rest of the design. Its long tongue is wrapped around its neck like a scarf, and it throws shuriken made of compressed water. Real frogs use their tongues as weapons too, flicking them out at high speed to catch insects.",
            "Frogs are also strong jumpers, which suits Greninja's acrobatic fighting style. Some species can leap many times their own body length, powered by long, muscular hind legs, and many frogs have colors and patterns that hide them among leaves and water, a natural form of stealth.",
            "The real common frog below gives the actual diet, lifespan and AnimalDex stats behind the comparison."
        ]
    },
    rayquaza: {
        paragraphs: [
            "Rayquaza is a dragon, so it has no real-animal counterpart. It is a huge, serpentine sky dragon that lives in the ozone layer in the Pokémon world.",
            "The design follows the dragons of Chinese and Japanese art more than European ones. Its long, snake-like body, small limbs, whisker-like features and ability to fly without large wings all match the East Asian dragon, which is pictured as a long serpent moving through clouds. Its yellow ring patterns and fins are often compared to these dragons' markings.",
            "When people name real animals, the usual suggestions are a snake, for its long body, and an eel or sea serpent for the way it moves. Its role as the ruler of the sky, calming the conflict between Groudon of the land and Kyogre of the sea, is mythological rather than biological.",
            "No single species fits well. The nearest real comparison is the paradise flying snake below, a long, slender snake that flattens its body to glide from tree to tree."
        ]
    },
    lapras: {
        paragraphs: [
            "Lapras most closely resembles a plesiosaur, a group of long-necked marine reptiles that lived in the age of the dinosaurs and became extinct about 66 million years ago. Its long neck, small head, broad body and four large flippers match the classic plesiosaur shape.",
            "That same shape is the popular image of the Loch Ness Monster, which is why Lapras is often linked to Nessie. Its shell adds a turtle-like element, and the knobs on the shell are sometimes compared to a sea turtle's scutes. Its gentle nature and habit of ferrying people across water are fantasy traits.",
            "Lapras is also an endangered species in the Pokémon world, hunted almost to extinction, which some fans connect to real whales and sea turtles.",
            "Plesiosaurs are extinct, so the nearest living comparison on AnimalDex is the leatherback sea turtle below: a huge, ocean-crossing marine reptile with four flippers and a ridged back."
        ]
    }
};

export function getPokemonAnimalNote(slug: string): PokemonAnimalNote | null {
    return pokemonAnimalNotes[slug] ?? null;
}

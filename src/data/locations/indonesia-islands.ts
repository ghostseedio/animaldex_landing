import type {LocationPageInput} from "@/data/location-types";

export const indonesiaIslandLocationPages: LocationPageInput[] = [
    {
        slug: "sumatra",
        name: "Sumatra",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "indonesia",
        coordinate: {lat: -0.5897, lng: 101.3431, zoom: 6},
        captureArea: {bbox: {north: 6.1, south: -6.2, east: 106.0, west: 95.0}, excludeBboxes: [{north: -1.4, south: -3.15, east: 106.0, west: 105.1}]},
        title: "Animals in Sumatra: What You Can Spot, Learn, and Collect",
        description: "Sumatra wildlife guide: orangutans at Bukit Lawang, Way Kambas elephants, tigers and tapirs in Kerinci, hornbills, and the macaques and monitors you will see.",
        searchIntents: [
            "animals in Sumatra",
            "wildlife in Sumatra",
            "what animals can be found in Sumatra",
            "what wildlife is there in Sumatra",
            "what animals can you see in Sumatra",
            "hewan di Sumatera",
            "Sumatra wildlife travel"
        ],
        quickAnswer: "Sumatra is the only island on earth with wild orangutans, tigers, elephants and rhinos together. Realistic sightings are Sumatran orangutans and Thomas's langurs on the Bukit Lawang trails in Gunung Leuser, Asian elephants at Way Kambas, siamang and rhinoceros hornbills calling from the canopy, and water monitors, macaques and tree sparrows around every town and river.",
        introduction: [
            "Sumatra runs 1,800 kilometres from Aceh to Lampung and still holds the largest blocks of lowland rainforest left in western Indonesia. Gunung Leuser in the north, Kerinci Seblat down the Bukit Barisan spine and Way Kambas and Bukit Barisan Selatan in the south are the parks that hold the headline mammals.",
            "The honest version for travellers: orangutans at Bukit Lawang are close to guaranteed, elephants at Way Kambas are reliable, and tigers, rhinos and tapirs are camera-trap animals you should not expect to see. Around that core sits a lot of easy wildlife, from hornbills over Lake Toba to monitors in the Musi river at Palembang."
        ],
        whyItMatters: [
            "Sumatra has lost more than half its forest since 1985, mostly to oil palm and pulp. The Sumatran tiger, rhino, elephant and orangutan are all Critically Endangered, and every sighting logged here is a data point for where they still hang on.",
            "For a collector the island covers a huge spread of tiers in one trip: a Critically Endangered ape in the morning, a hornbill at lunch, and the geckos, ants and sparrows of a losmen courtyard at night."
        ],
        animalsToSpot: [
            {speciesSlug: "sumatran-orangutan", whyItFits: "Semi-wild and wild orangutans use the forest above Bukit Lawang on the edge of Gunung Leuser National Park; a two-day trek usually produces several encounters, often with mothers and young.", rarityHint: "Near-certain at Bukit Lawang with a licensed guide; wild sightings deeper in Leuser or Ketambe take days."},
            {speciesSlug: "sumatran-tiger", whyItFits: "Around 400 remain, mostly in Kerinci Seblat and Bukit Barisan Selatan, where pugmarks on muddy trails are the usual evidence.", rarityHint: "Essentially never seen; tracks and camera-trap images are the realistic outcome."},
            {speciesSlug: "asian-elephant", whyItFits: "Way Kambas in Lampung has a wild population and the Elephant Response Unit patrol herd, so you can see both captive-managed and free-ranging animals in a day.", rarityHint: "Reliable at Way Kambas; wild herds also roam the Leuser lowlands around Tangkahan."},
            {speciesSlug: "sumatran-rhinoceros", whyItFits: "The Sumatran Rhino Sanctuary inside Way Kambas keeps the breeding population that produced the only calves born in captivity in decades.", rarityHint: "Wild animals are effectively unseeable; the sanctuary is visit-by-arrangement only."},
            {speciesSlug: "malayan-tapir", whyItFits: "Sumatra is the tapir's last Indonesian stronghold, with the black-and-white adults wading rivers in Kerinci Seblat and Way Kambas at night.", rarityHint: "Rare; night walks at Way Kambas or river edges in Kerinci give the only real chance."},
            {speciesSlug: "siamang", whyItFits: "The biggest gibbon fills the dawn with throat-sac booming across Bukit Lawang, Kerinci and the Bukit Barisan foothills.", rarityHint: "Heard most mornings in forest; seen with patience when a pair crosses a gap."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "Pairs commute over the Bohorok river valley and the Harau canyon with wingbeats that sound like a steam engine.", rarityHint: "Regular in good lowland forest; look up when you hear the whoosh."},
            {speciesSlug: "helmeted-hornbill", whyItFits: "Its maniacal laughing call still echoes through the Leuser and Kerinci lowlands, though poaching for the solid casque has emptied many valleys.", rarityHint: "Uncommon and declining; a serious prize in the deeper Leuser forest."},
            {speciesSlug: "sun-bear", whyItFits: "Claw marks and ripped-open termite nests along Gunung Leuser trails are usually the first sign of the world's smallest bear.", rarityHint: "Rare but logged by AnimalDex users in North Sumatra; dawn and dusk in fruiting forest."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops shadow the suspension bridges and losmen of Bukit Lawang and raid Lake Toba picnic spots on Samosir.", rarityHint: "Guaranteed anywhere tourists eat near forest."},
            {speciesSlug: "water-monitor", whyItFits: "Big monitors cruise the Musi at Palembang, the Bohorok shallows and the drainage canals of Medan.", rarityHint: "Common along any lowland river; most active late morning."},
            {speciesSlug: "oriental-pied-hornbill", whyItFits: "The small hornbill of forest edge and rubber gardens, already logged by users in North Sumatra, and the easiest hornbill to start with.", rarityHint: "Fairly common around Bukit Lawang and Tangkahan."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The most-captured bird by Indonesian AnimalDex users, nesting under every warung roof from Banda Aceh to Bandar Lampung.", rarityHint: "Guaranteed in every town."},
            {speciesSlug: "asian-weaver-ant", whyItFits: "Red weaver ants stitch leaf nests in the mango and rambutan trees of every village and bite anyone who leans on the trunk.", rarityHint: "Guaranteed; the most-logged invertebrate in Sumatra."}
        ],
        bestFor: [
            "Orangutan trekking at Bukit Lawang and Ketambe",
            "Elephant watching at Way Kambas",
            "Hornbill and gibbon birding in Kerinci Seblat and Harau",
            "Multi-day jungle treks for serious collectors"
        ],
        spottingTips: [
            "Book a licensed guide at Bukit Lawang and insist on no feeding; the forest-edge orangutans are habituated enough without it.",
            "Reach Way Kambas for the 6 am elephant patrol departure and stay for a night walk, which is the only realistic tapir chance.",
            "Hornbills are loudest 7 to 9 am; sit on a ridge with a view over the canopy rather than walking under it.",
            "Carry leech socks in the wet season (October to March) and keep a headtorch handy for geckos and civets around your losmen."
        ],
        relatedLocationSlugs: ["indonesia", "bangka-belitung", "borneo", "java"],
        challengeSlugs: ["tiger-vs-leopard", "dolphin-vs-orangutan-intelligence"],
        faq: [
            {question: "What wildlife is there in Sumatra?", answer: "Sumatra has orangutans, tigers, elephants, rhinos, tapirs, sun bears, siamang and several hornbill species in its national parks, plus abundant macaques, monitors and birds in towns and along rivers. Orangutans at Bukit Lawang and elephants at Way Kambas are the two reliable big-mammal sightings."},
            {question: "What animals can be found in Sumatra?", answer: "The flagship species are the Sumatran orangutan, Sumatran tiger, Sumatran rhinoceros, Asian elephant and Malayan tapir. Everyday animals include long-tailed macaques, water monitors, oriental pied hornbills, tree sparrows and weaver ants."},
            {question: "Can you see wild tigers in Sumatra?", answer: "Realistically no. Around 400 Sumatran tigers survive in dense forest and almost all sightings are by camera trap. Treks in Kerinci Seblat can turn up fresh tracks, which is a good outcome in itself."},
            {question: "When is the best time to visit Sumatra for wildlife?", answer: "The drier months from May to September make trekking easier and rivers safer to cross. Fruiting peaks vary by park, but Bukit Lawang orangutans are seen year-round."}
        ]
    },
    {
        slug: "java",
        name: "Java",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "indonesia",
        coordinate: {lat: -7.4, lng: 110.0, zoom: 6},
        captureArea: {bbox: {north: -5.6, south: -8.9, east: 114.5, west: 105.0}},
        title: "Animals in Java: What You Can Spot, Learn, and Collect",
        description: "Java wildlife guide: Javan rhinos in Ujung Kulon, silvery gibbons at Gede Pangrango, banteng and green peafowl at Baluran, and the mynas and herons of the cities.",
        searchIntents: [
            "animals in Java",
            "wildlife in Java",
            "what animals can be found in Java",
            "what wildlife is there in Java",
            "what animals can you see in Java Indonesia",
            "hewan di Pulau Jawa",
            "Java wildlife travel"
        ],
        quickAnswer: "Java holds the last Javan rhinos in Ujung Kulon, silvery gibbons and Javan surili in the Gede Pangrango cloud forest, and banteng, rusa deer and green peafowl on the Baluran savanna in the far east. In between, 150 million people share the island with macaques, pond herons, Javan mynas, bulbuls and tree sparrows.",
        introduction: [
            "Java is the most crowded big island on earth, yet its ends are wild. The west has Ujung Kulon and the volcano forests of Halimun Salak and Gede Pangrango; the east has the dry savanna of Baluran, the turtle beaches of Alas Purwo and the Meru Betiri rainforest.",
            "Most visitors never leave Jakarta, Yogyakarta and the Bromo circuit, and that is fine for a starter list. Rice paddies, kampung gardens and city parks turn up herons, kingfishers, mynas, sunbirds, geckos and a surprising number of raptors."
        ],
        whyItMatters: [
            "Several of Java's animals exist nowhere else: the Javan rhino, silvery gibbon, Javan surili, Javan slow loris and Javan hawk-eagle. All are threatened by the simple fact that the island has very little forest left.",
            "AnimalDex captures from West and East Java show what people really find: brahminy kites over the coast, green peafowl in Baluran, crested serpent eagles in the hills, and sooty-headed bulbuls and tree sparrows in every town."
        ],
        animalsToSpot: [
            {speciesSlug: "javan-rhinoceros", whyItFits: "Fewer than 80 survive, all of them inside Ujung Kulon on Java's western tip, where rangers find wallows and dung along the river trails.", rarityHint: "Not realistically seeable; the park's camera traps are the closest most people get."},
            {speciesSlug: "silvery-gibbon", whyItFits: "The island's only ape sings at dawn in the montane forest of Gede Pangrango, Halimun Salak and the Dieng plateau.", rarityHint: "Heard most mornings at Cibodas; seen on the Gede trail with an early start."},
            {speciesSlug: "javan-surili", whyItFits: "Grey leaf monkeys that move in small, quiet family groups through the canopy of Gede Pangrango and Halimun Salak, already logged by users in West Java.", rarityHint: "Uncommon; scan the mid-canopy on the Cibodas and Cikaniki trails."},
            {speciesSlug: "banteng", whyItFits: "Wild cattle graze the Bekol savanna in Baluran National Park at dawn and dusk, often alongside rusa deer and peafowl.", rarityHint: "Reliable at Baluran's Bekol and Bama in the dry season; also in Alas Purwo's Sadengan feeding ground."},
            {speciesSlug: "javan-rusa-deer", whyItFits: "Herds of rusa cross the Baluran grassland and Alas Purwo's Sadengan clearing in the open, a scene often compared with East Africa.", rarityHint: "Guaranteed at Baluran and Alas Purwo; logged by users in East Java."},
            {speciesSlug: "green-peafowl", whyItFits: "Males drag their trains across the Baluran savanna and call from the acacia at first light; this is the peafowl Indonesian users photograph most.", rarityHint: "Common at Baluran and Alas Purwo; rare elsewhere."},
            {speciesSlug: "javan-slow-loris", whyItFits: "A venomous, slow-moving primate of garden edges and bamboo in the West Java hills, hunted hard for the pet trade.", rarityHint: "Rare; night walks around Gede Pangrango or Garut with a red torch."},
            {speciesSlug: "crested-serpent-eagle", whyItFits: "Whistles over tea estates and hill forest from Puncak to Ijen and sits on roadside poles after rain.", rarityHint: "Regular in the hills; logged by users in East Java."},
            {speciesSlug: "brahminy-kite", whyItFits: "The chestnut-and-white kite of Java's north coast, fish markets and reservoirs, and the most-captured raptor in Indonesia on AnimalDex.", rarityHint: "Common on coasts and large rivers."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Roadside troops beg at the Puncak pass, raid Pangandaran beach and swarm the Alas Purwo temple area.", rarityHint: "Guaranteed at any tourist site with trees."},
            {speciesSlug: "javan-pond-heron", whyItFits: "The default heron of Java's paddies, standing hunched between rice stems from Karawang to Banyuwangi.", rarityHint: "Abundant in wet rice country."},
            {speciesSlug: "sooty-headed-bulbul", whyItFits: "Black-capped bulbul with a yellow vent that sings from garden wires and roadside trees in every Javan town; a frequent user capture in Jakarta and Central Java.", rarityHint: "Very common island-wide."},
            {speciesSlug: "javan-myna", whyItFits: "Grey mynas with white wing flashes own the car parks, cattle pastures and markets of Java.", rarityHint: "Guaranteed in towns and farmland."},
            {speciesSlug: "sunda-scops-owl", whyItFits: "A small owl that calls a soft 'wook' from kampung trees and plantation edges after dark, photographed by users in West Java.", rarityHint: "Common but heard more than seen; check mango trees near lights."}
        ],
        bestFor: [
            "Savanna wildlife drives at Baluran and Alas Purwo",
            "Gibbon and leaf-monkey hikes from Cibodas",
            "Rice-paddy and city birding around Yogyakarta and Jakarta",
            "Turtle nesting beaches at Sukamade (Meru Betiri)"
        ],
        spottingTips: [
            "Baluran is best from July to October when the savanna is brown and animals bunch at the Bekol waterhole; go at 5.30 am.",
            "At Cibodas take the Gede Pangrango trail before 7 am and stop every few hundred metres to listen for gibbons.",
            "Paddy edges at dawn give pond herons, egrets, munias and kingfishers; a kampung at dusk gives scops owls and geckos.",
            "Skip roadside animal markets; the lorises, owls and civets on sale were taken from the forest you are trying to see."
        ],
        relatedLocationSlugs: ["west-java", "jakarta", "ujung-kulon", "bali"],
        challengeSlugs: ["eagle-vs-owl", "elephant-vs-rhino"],
        faq: [
            {question: "What wildlife is there in Java?", answer: "Java has Javan rhinos in Ujung Kulon, silvery gibbons, Javan surili and slow lorises in the West Java mountains, and banteng, rusa deer and green peafowl on the Baluran and Alas Purwo savannas. Macaques, pond herons, bulbuls, mynas and brahminy kites are everywhere."},
            {question: "What animals can be found in Java?", answer: "Endemics include the Javan rhinoceros, silvery gibbon, Javan surili, Javan slow loris and Javan hawk-eagle. Widespread animals include long-tailed macaques, water monitors, Javan pond herons, sooty-headed bulbuls and crested serpent eagles."},
            {question: "Where is the best place to see wildlife in Java?", answer: "Baluran National Park in the far east is the most rewarding single site, with banteng, deer, peafowl and macaques visible from the road. Gede Pangrango near Cibodas is best for gibbons and montane birds."},
            {question: "Can you see Javan rhinos in Ujung Kulon?", answer: "Almost never. The population is under 80 and lives in dense swamp forest; visitors see footprints, wallows and camera-trap footage. The park is still worth it for banteng, gibbons, hornbills and the Peucang island deer."}
        ]
    },
    {
        slug: "sulawesi",
        name: "Sulawesi",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "indonesia",
        coordinate: {lat: -1.9, lng: 120.9, zoom: 6},
        captureArea: {bbox: {north: 2.2, south: -6.3, east: 125.4, west: 118.8}, excludeBboxes: [{north: -1.5, south: -2.6, east: 125.4, west: 124.1}]},
        title: "Animals in Sulawesi: What You Can Spot, Learn, and Collect",
        description: "Sulawesi wildlife guide: tarsiers and crested macaques at Tangkoko, babirusa and anoa at Nantu, knobbed hornbills, and the reefs of Bunaken and Lembeh.",
        searchIntents: [
            "animals in Sulawesi",
            "wildlife in Sulawesi",
            "what animals can be found in Sulawesi",
            "what wildlife is there in Sulawesi",
            "what animals can you see in Sulawesi",
            "hewan di Sulawesi",
            "Sulawesi wildlife travel"
        ],
        quickAnswer: "Sulawesi sits in Wallacea, so most of its mammals are found nowhere else: spectral tarsiers, Celebes crested macaques, babirusa, anoa and the knobbed hornbill. Tangkoko near Manado shows tarsiers and macaques in an afternoon, and Bunaken and the Lembeh Strait add turtles, pygmy seahorses and flamboyant cuttlefish.",
        introduction: [
            "Sulawesi's four long peninsulas were never joined to Asia or Australia, and the result is an island where almost every mammal is endemic. Tangkoko Batuangus near Bitung is the easy showcase, Lore Lindu in Central Sulawesi and Nantu in Gorontalo are the deeper options.",
            "The sea is the other half of the story. Bunaken's walls off Manado and the black-sand muck of the Lembeh Strait hold some of the strangest small marine life on earth, and AnimalDex users around Manado log the ants, cockroaches and geckos of the city too."
        ],
        whyItMatters: [
            "Crested macaques have lost around 80 percent of their population in 40 years to hunting and forest loss; Tangkoko is one of the last places they are habituated and safe to watch.",
            "Wallacea is a natural experiment in evolution, and a Sulawesi list sits apart from any other Indonesian island in a collection."
        ],
        animalsToSpot: [
            {speciesSlug: "spectral-tarsier", whyItFits: "At dusk the Tangkoko tarsiers leave their strangler-fig roost in a chorus of squeaks and leap between saplings a metre from the trail.", rarityHint: "Near-guaranteed at Tangkoko with a ranger at 5.30 pm."},
            {speciesSlug: "celebes-crested-macaque", whyItFits: "Habituated troops of black, punk-crested macaques forage along the Tangkoko beach forest and let you sit among them.", rarityHint: "Reliable at Tangkoko; wild elsewhere in the north and Critically Endangered."},
            {speciesSlug: "babirusa", whyItFits: "The 'deer-pig' with tusks curling through its snout visits the Adudu salt lick in Nantu forest, Gorontalo, most mornings.", rarityHint: "Rare; Nantu's hide is the only reliable site and needs permits."},
            {speciesSlug: "lowland-anoa", whyItFits: "A dwarf buffalo of dense forest that also comes to the Nantu salt lick and leaves hoofprints on Lore Lindu trails.", rarityHint: "Very rare; most visitors see tracks only."},
            {speciesSlug: "knobbed-hornbill", whyItFits: "Sulawesi's big red-knobbed hornbill gathers at fruiting figs in Tangkoko and Lore Lindu and is logged by users in Banten's bird parks too.", rarityHint: "Common in Tangkoko; listen for the barking call."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Turtles graze the walls of Bunaken National Park and rest on ledges at Lekuan, often several on one dive.", rarityHint: "Near-guaranteed on Bunaken dives and snorkels."},
            {speciesSlug: "pygmy-seahorse", whyItFits: "Lembeh and Bunaken guides know individual sea fans where Bargibant's pygmy seahorses live.", rarityHint: "Reliable with a guide who knows the fan; hard to find alone."},
            {speciesSlug: "flamboyant-cuttlefish", whyItFits: "The Lembeh Strait's signature find, walking across black sand while pulsing purple and yellow.", rarityHint: "Regular on Lembeh muck dives."},
            {speciesSlug: "mimic-octopus", whyItFits: "First described from Sulawesi sand flats, where it imitates flatfish and lionfish on the Lembeh slopes.", rarityHint: "Uncommon; a prize on Lembeh dives."},
            {speciesSlug: "hairy-frogfish", whyItFits: "Sits on the Lembeh sand looking like a clump of algae while luring prey with a worm-shaped bait.", rarityHint: "Regular in Lembeh with a sharp-eyed guide."},
            {speciesSlug: "dugong", whyItFits: "Dugongs still graze seagrass off Bunaken, Siladen and the Togean islands, surfacing briefly to breathe.", rarityHint: "Rare and lucky; most often seen from boats early in the morning."},
            {speciesSlug: "asian-weaver-ant", whyItFits: "The most-logged animal by AnimalDex users in North Sulawesi, nesting in clove and coconut trees around Manado.", rarityHint: "Guaranteed in any garden."},
            {speciesSlug: "cockroach", whyItFits: "Logged in Manado and Makassar kitchens; the humidity of coastal Sulawesi suits them perfectly.", rarityHint: "Guaranteed after dark, like it or not."}
        ],
        bestFor: [
            "Tarsier and crested macaque walks at Tangkoko",
            "Muck diving in the Lembeh Strait",
            "Wall diving and turtles at Bunaken",
            "Deep-forest endemics at Lore Lindu and Nantu"
        ],
        spottingTips: [
            "Do Tangkoko as an afternoon walk: macaques on the beach forest at 3 pm, tarsiers emerging at the fig roost at 5.30 pm.",
            "Lembeh is a guide's game; tell your dive guide exactly which species you want and let them hunt.",
            "Nantu requires permits through the Gorontalo conservation office and a night in the field station near the salt lick.",
            "Lore Lindu's Anaso track above Lake Tambing is the easiest place for hornbills, tarsiers and endemic birds in Central Sulawesi."
        ],
        relatedLocationSlugs: ["togean-islands", "maluku", "indonesia", "kalimantan"],
        challengeSlugs: ["cuttlefish-vs-octopus-intelligence"],
        faq: [
            {question: "What wildlife is there in Sulawesi?", answer: "Sulawesi has endemic mammals including the spectral tarsier, Celebes crested macaque, babirusa and anoa, plus the knobbed hornbill and maleo among its birds. Its reefs at Bunaken and Lembeh hold turtles, pygmy seahorses, flamboyant cuttlefish and mimic octopus."},
            {question: "What animals can be found in Sulawesi?", answer: "Tarsiers and crested macaques are easy at Tangkoko near Manado. Babirusa and anoa are rare forest animals best tried at Nantu in Gorontalo. Everyday animals include weaver ants, geckos, macaques and sea turtles."},
            {question: "Where can you see tarsiers in Sulawesi?", answer: "Tangkoko Batuangus Nature Reserve near Bitung, about two hours from Manado, has habituated spectral tarsiers that emerge from fig-tree roosts at dusk almost every evening. Rangers walk you to the roost trees."},
            {question: "Is Sulawesi good for diving?", answer: "Yes. Bunaken has steep coral walls with turtles and reef fish, while the Lembeh Strait is arguably the world's best muck-diving site for small, strange species such as frogfish, flamboyant cuttlefish and pygmy seahorses."}
        ]
    },
    {
        slug: "kalimantan",
        name: "Kalimantan",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "borneo",
        coordinate: {lat: 0.1, lng: 114.5, zoom: 6},
        captureArea: {bbox: {north: 4.4, south: -4.4, east: 119.0, west: 108.7}},
        title: "Animals in Kalimantan: What You Can Spot, Learn, and Collect",
        description: "Kalimantan wildlife guide: Tanjung Puting orangutans by klotok, proboscis monkeys on the Sekonyer, Derawan turtles and mantas, and Kakaban's jellyfish lake.",
        searchIntents: [
            "animals in Kalimantan",
            "wildlife in Kalimantan",
            "what animals can be found in Kalimantan",
            "what wildlife is there in Kalimantan",
            "what animals can you see in Indonesian Borneo",
            "hewan di Kalimantan",
            "Kalimantan wildlife travel"
        ],
        quickAnswer: "Kalimantan is the Indonesian three-quarters of Borneo. Tanjung Puting's Camp Leakey shows Bornean orangutans and proboscis monkeys from a klotok houseboat, the Mahakam river has Irrawaddy dolphins near Muara Pahu, and the Derawan islands off East Kalimantan add green turtles, mantas and the stingless jellyfish of Kakaban lake.",
        introduction: [
            "The three classic Kalimantan trips are a klotok up the Sekonyer river in Tanjung Puting (Central Kalimantan), a river journey on the Mahakam from Samarinda (East Kalimantan), and a dive trip to Derawan, Maratua, Kakaban and Sangalaki.",
            "Between them lies a lot of peat swamp and oil palm, and some of the best remaining forest is in the Heart of Borneo around Betung Kerihun and Kayan Mentarang, which few travellers reach. Users in South Kalimantan mostly log water monitors, which tells you how much of daily life happens on the rivers."
        ],
        whyItMatters: [
            "Kalimantan holds most of the world's Bornean orangutans, and the 2015 and 2019 peat fires showed how quickly that habitat can go. Camp Leakey has run since 1971 and is the longest orangutan study anywhere.",
            "The Derawan archipelago is one of Indonesia's most important green turtle nesting areas, with turtles coming ashore on Sangalaki and Derawan itself most nights of the year."
        ],
        animalsToSpot: [
            {speciesSlug: "bornean-orangutan", whyItFits: "Wild and ex-captive orangutans visit the feeding platforms at Camp Leakey, Pondok Tanggui and Tanjung Harapan along the Sekonyer river.", rarityHint: "Near-guaranteed on a two-night klotok trip in Tanjung Puting."},
            {speciesSlug: "proboscis-monkey", whyItFits: "Troops of big-nosed monkeys settle in riverside trees at dusk on the Sekonyer and the Mahakam, leaping into the water when alarmed; logged by users in West Java zoos too.", rarityHint: "Reliable from the boat in the last hour of light."},
            {speciesSlug: "bornean-bearded-pig", whyItFits: "Bearded pigs root around the Camp Leakey feeding platform for dropped bananas and wander the camp paths.", rarityHint: "Common at Camp Leakey; scarce in logged forest."},
            {speciesSlug: "sun-bear", whyItFits: "Claw-scarred trees along the Tanjung Puting trails and the Samboja Lestari sanctuary near Balikpapan, which rehabilitates rescued bears.", rarityHint: "Wild sightings rare; Samboja Lestari shows rescued bears by arrangement."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "The Dayak sacred bird flies over the Sekonyer and the upper Mahakam with loud wingbeats and a honking call.", rarityHint: "Regular in Tanjung Puting and the Heart of Borneo forest."},
            {speciesSlug: "silvery-lutung", whyItFits: "Grey langurs with orange babies feed in riverside trees in Tanjung Puting, often near proboscis troops.", rarityHint: "Common along the Sekonyer."},
            {speciesSlug: "water-monitor", whyItFits: "The most-captured animal by AnimalDex users in South Kalimantan, swimming the Barito and Martapura canals in Banjarmasin.", rarityHint: "Guaranteed on any river journey."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "Big crocodiles live in the Sekonyer and Kumai estuaries and the Mahakam delta; guides forbid swimming for good reason.", rarityHint: "Occasional on night spotlighting from the boat."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Derawan island turtles graze seagrass off the jetties in a metre of water and nest on the beach most nights.", rarityHint: "Guaranteed at Derawan; dozens nest on Sangalaki each night."},
            {speciesSlug: "manta-ray", whyItFits: "Mantas feed on plankton at the surface off Sangalaki island and are watched from boats and on snorkel.", rarityHint: "Regular at Sangalaki, best around the full moon."},
            {speciesSlug: "whale-shark", whyItFits: "Whale sharks gather at the bagan fishing platforms off Talisayan, north of Derawan, feeding on the anchovy bycatch at dawn.", rarityHint: "Reliable at Talisayan on early-morning boat trips."},
            {speciesSlug: "jellyfish", whyItFits: "Kakaban island's brackish lake holds four species of stingless jellyfish that have lost their sting over thousands of years of isolation.", rarityHint: "Guaranteed in Kakaban lake; swim with no fins and no sunscreen."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Camp guards, boat raiders and mangrove foragers along every Kalimantan river and in Balikpapan's city forest.", rarityHint: "Guaranteed."},
            {speciesSlug: "bornean-slow-loris", whyItFits: "Spotlighting from the klotok at night picks up the orange eyeshine of lorises in riverside tangles.", rarityHint: "Rare; try a night walk at Camp Leakey or the Rimba lodge."}
        ],
        bestFor: [
            "Klotok houseboat trips in Tanjung Puting",
            "Turtle and manta diving around Derawan and Sangalaki",
            "Whale sharks at Talisayan",
            "River journeys on the Mahakam"
        ],
        spottingTips: [
            "Book a two-night klotok from Kumai so you reach Camp Leakey for the 2 pm feeding and sleep on the river for proboscis monkeys at dusk.",
            "At Derawan, snorkel off the village jetty at high tide for turtles; Kakaban and Sangalaki are a short speedboat hop.",
            "Talisayan whale sharks are a dawn activity; leave Derawan at 4 am or stay in Talisayan.",
            "Ask your boat crew to spotlight the banks after dark for crocodile eyeshine, lorises and tarsier-sized surprises."
        ],
        relatedLocationSlugs: ["borneo", "sulawesi", "sumatra", "indonesia"],
        challengeSlugs: ["gorilla-vs-orangutan", "crocodile-vs-shark"],
        faq: [
            {question: "What wildlife is there in Kalimantan?", answer: "Kalimantan has Bornean orangutans, proboscis monkeys, bearded pigs, sun bears, hornbills and crocodiles in its river forests, and green turtles, mantas, whale sharks and stingless jellyfish in the Derawan islands off the east coast."},
            {question: "What animals can be found in Kalimantan?", answer: "Tanjung Puting is the place for orangutans, proboscis monkeys, silvery lutungs and bearded pigs. Derawan, Sangalaki, Kakaban and Talisayan cover turtles, mantas, whale sharks and jellyfish. Water monitors and macaques are everywhere along the rivers."},
            {question: "Where is the best place to see orangutans in Kalimantan?", answer: "Tanjung Puting National Park in Central Kalimantan, reached by klotok boat from Kumai near Pangkalan Bun. The feeding platforms at Camp Leakey and Pondok Tanggui bring wild and rehabilitated orangutans close almost every day."},
            {question: "Is it safe to swim in Kalimantan rivers?", answer: "No. Saltwater crocodiles live in the Sekonyer, Kumai and Mahakam systems and have attacked people. Swim at the sea islands instead, or in Kakaban lake where the jellyfish cannot sting."}
        ]
    },
    {
        slug: "papua",
        name: "Papua",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "indonesia",
        coordinate: {lat: -4.0, lng: 137.5, zoom: 5},
        captureArea: {bbox: {north: 0.9, south: -9.3, east: 141.1, west: 129.6}},
        title: "Animals in Papua: What You Can Spot, Learn, and Collect",
        description: "Papua wildlife guide: birds-of-paradise in the Arfak hills, cassowaries and crowned pigeons, cuscus and wallabies at Wasur, and Cenderawasih Bay whale sharks.",
        searchIntents: [
            "animals in Papua",
            "wildlife in Papua",
            "what animals can be found in Papua",
            "what wildlife is there in Papua",
            "what animals can you see in West Papua",
            "hewan di Papua",
            "Papua Indonesia wildlife travel"
        ],
        quickAnswer: "Indonesian Papua is the western half of New Guinea, where the wildlife is Australian rather than Asian: birds-of-paradise, cassowaries, cuscus, echidnas, tree kangaroos and giant crowned pigeons instead of monkeys and cats. The Arfak mountains above Manokwari are the birding hub, Lorentz National Park runs from glaciers to mangroves, and Raja Ampat and Cenderawasih Bay hold the richest reefs on earth.",
        introduction: [
            "Indonesian Papua is now six provinces, with Jayapura, Sorong, Manokwari and Timika as the gateways. Travel is slow and permits are needed for the interior, so most wildlife trips concentrate on the Arfak hides near Manokwari, the Nimbokrang lowlands near Jayapura, Wasur National Park by Merauke, and the sea around Raja Ampat.",
            "The reward is a list that reads like nothing else in Indonesia: lesser and magnificent birds-of-paradise displaying on cleared courts, Victoria crowned pigeons on the forest floor, spotted cuscus in village trees, and whale sharks drifting under fishing platforms in Cenderawasih Bay."
        ],
        whyItMatters: [
            "New Guinea has more plant species than any other island and most of its 40 or so birds-of-paradise; Lorentz is Southeast Asia's largest protected area and a UNESCO site.",
            "Logging roads, palm oil near Sorong and the Grasberg mine put pressure on lowland forest, and birds-of-paradise are still trapped for feathers. Visitor money for village-run hides at Arfak and Waigeo is one of the things that keeps display trees standing."
        ],
        animalsToSpot: [
            {speciesSlug: "lesser-bird-of-paradise", whyItFits: "Males display in groups in tall lowland trees at Nimbokrang near Jayapura and around Klasow valley east of Sorong, cackling and shaking yellow plumes.", rarityHint: "Reliable at known display trees at dawn with a local guide."},
            {speciesSlug: "magnificent-bird-of-paradise", whyItFits: "Clears a display court on the forest floor in the Arfak foothills, where hides at Syioubri and Mokwam let you watch from a few metres.", rarityHint: "Regular from the Arfak hides between 6 and 8 am."},
            {speciesSlug: "king-bird-of-paradise", whyItFits: "A tiny crimson bird that displays in vine tangles in the lowland forest around Nimbokrang and Sorong.", rarityHint: "Uncommon; guides know individual display vines."},
            {speciesSlug: "twelve-wired-bird-of-paradise", whyItFits: "Displays on bare dead trunks in the Nimbokrang swamp forest at first light, wiping its wire plumes across the female.", rarityHint: "Regular at Nimbokrang with a pre-dawn start."},
            {speciesSlug: "southern-cassowary", whyItFits: "Wild cassowaries walk the lowland forest of Wasur and the Lorentz coast and are kept in Papuan villages; AnimalDex users have logged them in Sumatra and Java zoos.", rarityHint: "Wild sightings rare and slightly dangerous; village birds and zoo birds are the usual capture."},
            {speciesSlug: "victoria-crowned-pigeon", whyItFits: "The largest pigeon on earth walks the forest floor of Papua's northern lowlands around Nimbokrang and Biak.", rarityHint: "Uncommon and shy; booming calls give it away."},
            {speciesSlug: "western-crowned-pigeon", whyItFits: "The Vogelkop peninsula's own crowned pigeon forages under the trees of the Klasow valley and lowland Sorong forest.", rarityHint: "Uncommon; best around Klasow and Waigeo lowlands."},
            {speciesSlug: "spotted-cuscus", whyItFits: "A slow, round-faced marsupial that dozes in village fruit trees and mangroves across lowland Papua, logged by users at Indonesian zoos.", rarityHint: "Fairly common; spotlight fruiting trees at night."},
            {speciesSlug: "short-beaked-echidna", whyItFits: "Echidnas snuffle through the Wasur savanna and Trans-Fly grasslands near Merauke, Indonesia's slice of Australian wildlife.", rarityHint: "Rare; dusk drives at Wasur in the dry season."},
            {speciesSlug: "agile-wallaby", whyItFits: "Mobs of wallabies graze the Wasur National Park grasslands at dusk, the only kangaroo relatives you can see in Indonesia in the open.", rarityHint: "Common at Wasur from July to November."},
            {speciesSlug: "palm-cockatoo", whyItFits: "Huge black cockatoos with red cheek patches drum on hollow trees with sticks in the lowland forest of Wasur and the south coast.", rarityHint: "Uncommon; most reliable at Wasur and Lorentz lowlands."},
            {speciesSlug: "green-tree-python", whyItFits: "Coils on branches in lowland and hill forest from Sorong to Biak, bright green as an adult and yellow or red as a juvenile.", rarityHint: "Rare by day; night walks with a guide give a real chance."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "The Mamberamo, Digul and Lorentz rivers hold some of the largest crocodile populations left in the region.", rarityHint: "Common in lowland rivers; seen from boats in Lorentz and Wasur."},
            {speciesSlug: "whale-shark", whyItFits: "In Cenderawasih Bay whale sharks hang under bagan fishing platforms year-round, taking anchovies the fishermen throw to them.", rarityHint: "Near-guaranteed at Kwatisore in Cenderawasih Bay by liveaboard or from Nabire."}
        ],
        bestFor: [
            "Birds-of-paradise hides in the Arfak mountains and Nimbokrang",
            "Whale sharks in Cenderawasih Bay",
            "Marsupials and wallabies at Wasur National Park",
            "Reef diving in Raja Ampat"
        ],
        spottingTips: [
            "Arrange hides through village guides at Mokwam or Syioubri above Manokwari; you sleep in the village and sit in the hide before 5.30 am.",
            "Nimbokrang, two hours from Jayapura, covers lowland birds-of-paradise and crowned pigeons; book a local guide well ahead.",
            "Carry passport copies and ask your guide whether the district still wants a surat jalan police permit; rules change and interior checkpoints still ask.",
            "Wasur near Merauke is a dry-season park (July to November); in the wet it floods and the roads close."
        ],
        relatedLocationSlugs: ["raja-ampat", "maluku", "indonesia", "australia"],
        challengeSlugs: ["greater-bird-of-paradise-vs-indian-peafowl-agility", "southern-cassowary-vs-secretary-bird"],
        faq: [
            {question: "What wildlife is there in Papua?", answer: "Indonesian Papua has birds-of-paradise, cassowaries, crowned pigeons, palm cockatoos, tree kangaroos, cuscus, echidnas and wallabies on land, plus saltwater crocodiles in its rivers and whale sharks, mantas and reef fish in Cenderawasih Bay and Raja Ampat."},
            {question: "What animals can be found in Papua?", answer: "The animals are Australian in character: marsupials such as spotted cuscus and agile wallabies, egg-laying echidnas, and birds including lesser, magnificent, king and twelve-wired birds-of-paradise. Green tree pythons and crocodiles are the notable reptiles."},
            {question: "Where can you see birds-of-paradise in Papua?", answer: "The Arfak mountains above Manokwari (Mokwam and Syioubri hides) for magnificent and other montane species, Nimbokrang near Jayapura for lesser and twelve-wired, and Waigeo in Raja Ampat for red and Wilson's. All use village guides and dawn hides."},
            {question: "Do I need a permit to travel in Papua?", answer: "It depends where you go. The surat jalan police permit has been formally relaxed but interior districts still ask for it, and guides in Jayapura, Manokwari or Sorong can arrange one. Raja Ampat and the main towns need only the marine park fee or no permit at all."}
        ]
    },
    {
        slug: "maluku",
        name: "Maluku Islands",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "indonesia",
        coordinate: {lat: -2.5, lng: 128.0, zoom: 6},
        captureArea: {bbox: {north: 2.9, south: -8.4, east: 135.0, west: 124.1}, excludeBboxes: [{north: 2.9, south: 0.2, east: 127.2, west: 124.1}, {north: 2.9, south: -4.9, east: 135.0, west: 129.6}]},
        title: "Animals in the Maluku Islands: What You Can Spot, Learn, and Collect",
        description: "Maluku wildlife guide: Wallace's standardwing on Halmahera, umbrella and salmon-crested cockatoos, red lories on Ambon, and the sea kraits of the Banda islands.",
        searchIntents: [
            "animals in Maluku",
            "wildlife in the Maluku Islands",
            "what animals can be found in Maluku",
            "what wildlife is there in the Moluccas",
            "what animals can you see in Ambon and Halmahera",
            "hewan di Maluku",
            "Moluccas wildlife travel"
        ],
        quickAnswer: "The Maluku Islands are the original Spice Islands and the heart of Wallacea. Halmahera has Wallace's standardwing bird-of-paradise and the white umbrella cockatoo, Seram has the salmon-crested cockatoo and Manusela National Park, Ambon has red lories and world-class muck diving, and the Banda islands have sea kraits, big reef fish and the odd hammerhead.",
        introduction: [
            "Maluku is two provinces, North Maluku around Ternate and Halmahera, and Maluku around Ambon, Seram and the Banda, Kei and Tanimbar islands. Alfred Russel Wallace posted his natural-selection essay from Ternate in 1858 and discovered the standardwing on Bacan later that year.",
            "Travel runs through Ambon and Ternate airports and onward by ferry and speedboat. Birders head for Weda Bay or Foli on Halmahera and Manusela on Seram; divers base in Ambon Bay or the Banda islands."
        ],
        whyItMatters: [
            "Maluku's parrots and cockatoos have been hammered by the cage-bird trade; the salmon-crested cockatoo is Vulnerable and the Goffin's cockatoo of Tanimbar is traded in the thousands. Seeing them wild on Seram or Halmahera is the point.",
            "Standardwing display sites on Halmahera are run by villages, and Weda Bay's nickel mining boom makes every documented sighting more valuable."
        ],
        animalsToSpot: [
            {speciesSlug: "standardwing-bird-of-paradise", whyItFits: "Wallace's standardwing displays at dawn in communal trees in the Halmahera lowlands near Weda and Foli, raising white shoulder plumes and spinning.", rarityHint: "Reliable at known display trees with a village guide; a 4.30 am start."},
            {speciesSlug: "umbrella-cockatoo", whyItFits: "Pure white cockatoos scream over the Halmahera forest edge and village coconut groves at dusk; logged by AnimalDex users at bird parks in West Java.", rarityHint: "Fairly common on Halmahera, Bacan and Ternate forest edge."},
            {speciesSlug: "salmon-crested-cockatoo", whyItFits: "Seram's own pink-tinged cockatoo feeds in fruiting trees around Manusela National Park and the Sawai coast.", rarityHint: "Uncommon; best around Sawai and the Wae Fufa trail."},
            {speciesSlug: "red-lory", whyItFits: "Flocks of scarlet lories race between flowering trees on Ambon, Seram and Buru; the species is native only to these islands.", rarityHint: "Common on Seram and in Ambon's hill gardens."},
            {speciesSlug: "eclectus-parrot", whyItFits: "Green males and red-and-blue females nest in hollows across Halmahera and Seram, calling with a harsh screech over the canopy.", rarityHint: "Common in lowland forest across Maluku."},
            {speciesSlug: "tanimbar-corella", whyItFits: "Goffin's cockatoo is endemic to the Tanimbar islands in the far south of Maluku, feeding in flocks on coastal forest and gardens.", rarityHint: "Common on Yamdena but a long way from anywhere."},
            {speciesSlug: "spotted-cuscus", whyItFits: "Seram, Ambon, Buru and the Kei islands are the western edge of its natural range; it rests in dense foliage by day.", rarityHint: "Uncommon; spotlight fruiting trees near villages."},
            {speciesSlug: "nicobar-pigeon", whyItFits: "Iridescent pigeons roost on small offshore islets around Halmahera and the Kei islands and fly to larger islands to feed.", rarityHint: "Uncommon; boat trips to uninhabited islets at dawn."},
            {speciesSlug: "sea-krait", whyItFits: "Banded sea kraits swarm around Gunung Api in the Banda islands and the Ambon Bay shoreline, coming ashore to rest in rock crevices.", rarityHint: "Near-guaranteed on Banda dives; venomous but not aggressive."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Hawksbills nibble sponges on the Banda, Seram and Halmahera reefs and nest on remote Kei beaches.", rarityHint: "Regular on reef dives throughout Maluku."},
            {speciesSlug: "mandarinfish", whyItFits: "Pairs rise from the rubble at dusk to spawn in Ambon Bay and Banda harbour, a classic Maluku dive.", rarityHint: "Reliable on dusk dives in Banda harbour and off Ambon."},
            {speciesSlug: "psychedelic-frogfish", whyItFits: "Discovered in Ambon Bay in 2008 and still found only here, hopping across the rubble with its swirled pattern.", rarityHint: "Very rare; a few are found each year by Ambon dive guides."},
            {speciesSlug: "dugong", whyItFits: "Seagrass beds off Seram's north coast and the Kei islands still support small dugong groups.", rarityHint: "Rare; fishermen at Sawai sometimes know where one is grazing."},
            {speciesSlug: "fruit-bat", whyItFits: "Maluku has its own flying foxes rather than the large flying fox of western Indonesia; they pour out of mangrove roosts over Ambon Bay and Ternate at dusk and feed in the clove and nutmeg groves.", rarityHint: "Common at dusk across the islands."}
        ],
        bestFor: [
            "Standardwing dawn displays on Halmahera",
            "Wild cockatoos and lories on Seram and Ambon",
            "Sea kraits and big-fish diving in the Banda islands",
            "Muck diving and rare frogfish in Ambon Bay"
        ],
        spottingTips: [
            "For the standardwing, sleep in Weda or Foli and be at the display tree before 5 am; the show lasts about an hour.",
            "Parrots and cockatoos are easiest at dusk from a village clearing or beach where they fly to roost.",
            "Banda is reached by Pelni ferry or small plane from Ambon; the sea kraits at Gunung Api are a snorkel, not a dive.",
            "Ambon Bay's rubble slopes reward slow, patient dives with a guide who knows where this week's frogfish are sitting."
        ],
        relatedLocationSlugs: ["papua", "sulawesi", "indonesia", "raja-ampat"],
        faq: [
            {question: "What wildlife is there in the Maluku Islands?", answer: "Maluku has Wallace's standardwing bird-of-paradise, umbrella and salmon-crested cockatoos, red lories and eclectus parrots in its forests, spotted cuscus in its trees, and sea kraits, hawksbill turtles, mandarinfish and rare frogfish on its reefs."},
            {question: "What animals can be found in Maluku?", answer: "Halmahera has the standardwing and umbrella cockatoo, Seram has the salmon-crested cockatoo and Manusela's forest birds, Ambon has red lories and muck-diving species, and the Banda islands are famous for banded sea kraits. Flying foxes and sea turtles occur throughout."},
            {question: "Where is the best place to see Wallace's standardwing?", answer: "Halmahera, at display trees near Weda Bay on the east coast or Foli in the north-east. Village guides walk you in before dawn and the males display for about an hour after first light."},
            {question: "Are the Maluku Islands good for diving?", answer: "Yes, for two different reasons. Ambon Bay is a top muck-diving site for frogfish, rhinopias and mandarinfish, while the Banda islands have clear water, big reef fish, sea kraits and occasional hammerheads from September to December."}
        ]
    },
    {
        slug: "raja-ampat",
        name: "Raja Ampat",
        regionType: "park",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "papua",
        coordinate: {lat: -0.65, lng: 130.55, zoom: 8},
        captureArea: {bbox: {north: 0.6, south: -2.4, east: 131.1, west: 129.6}},
        title: "Animals in Raja Ampat: What You Can Spot, Learn, and Collect",
        description: "Raja Ampat wildlife guide: reef mantas at Manta Sandy, walking sharks and wobbegongs, record reef fish counts, and red and Wilson's birds-of-paradise on Waigeo.",
        searchIntents: [
            "animals in Raja Ampat",
            "wildlife in Raja Ampat",
            "what animals can be found in Raja Ampat",
            "what wildlife is there in Raja Ampat",
            "what animals can you see in Raja Ampat",
            "hewan di Raja Ampat",
            "Raja Ampat marine life"
        ],
        quickAnswer: "Raja Ampat has the highest reef fish diversity ever recorded, with more than 1,600 species. Expect reef mantas at Manta Sandy and Manta Ridge, oceanic mantas at Blue Magic, walking sharks and tasselled wobbegongs on night dives, turtles on almost every reef, and on Waigeo the red and Wilson's birds-of-paradise displaying at dawn.",
        introduction: [
            "The Four Kings, Waigeo, Batanta, Salawati and Misool, sit off the Bird's Head peninsula of West Papua, reached by ferry from Sorong to Waisai. Homestays on Kri, Gam and Arborek and liveaboards cover the central Dampier Strait; Misool in the south is a separate trip.",
            "The Dampier Strait funnels plankton past Cape Kri, where a single dive once counted 374 fish species. The forest behind the beaches is Papuan, with cockatoos, hornbills and two birds-of-paradise found only here."
        ],
        whyItMatters: [
            "Raja Ampat's marine protected area network covers over 2 million hectares and has banned shark and manta fishing since 2010; reef shark and manta numbers have recovered visibly as a result.",
            "Blue tree monitors, found only on Batanta, and Wilson's bird-of-paradise, found only on Waigeo and Batanta, are both targeted by collectors, so documented sightings here carry real weight."
        ],
        animalsToSpot: [
            {speciesSlug: "reef-manta-ray", whyItFits: "Reef mantas queue at the cleaning station of Manta Sandy off Arborek and barrel-roll through plankton at Manta Ridge in the Dampier Strait.", rarityHint: "Near-guaranteed October to April; regular the rest of the year."},
            {speciesSlug: "manta-ray", whyItFits: "The giant oceanic manta turns up at Blue Magic and Magic Mountain, sometimes alongside its smaller reef cousin.", rarityHint: "Regular in season at Blue Magic; a six-metre wingspan is possible."},
            {speciesSlug: "epaulette-shark", whyItFits: "Raja Ampat's walking sharks are close relatives of the epaulette shark, and AnimalDex logs them under this entry; they crawl over the reef flat on their fins at night.", rarityHint: "Regular on night dives and shallow night snorkels off Kri and Arborek."},
            {speciesSlug: "tasselled-wobbegong", whyItFits: "A fringed carpet shark that lies under table corals at Cape Kri and Sardine Reef by day, almost invisible until it moves.", rarityHint: "Common once your guide shows you where to look."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Patrols the shallows off the Kri and Arborek jetties in knee-deep water, especially at dusk.", rarityHint: "Guaranteed from any homestay jetty."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Green and hawksbill turtles graze and rest on every central Raja Ampat reef, including right under the homestay jetties.", rarityHint: "Guaranteed on most dives and snorkels."},
            {speciesSlug: "humphead-parrotfish", whyItFits: "Schools of metre-long bumphead parrotfish crunch coral at Cape Kri and sleep in caves at Mioskon.", rarityHint: "Common in the Dampier Strait."},
            {speciesSlug: "napoleon-wrasse", whyItFits: "Big humphead wrasse cruise the drop-offs at Cape Kri and Blue Magic, now protected across the park.", rarityHint: "Regular on current-swept points."},
            {speciesSlug: "pygmy-seahorse", whyItFits: "Bargibant's and Denise's pygmy seahorses live on sea fans at Melissa's Garden and Mike's Point.", rarityHint: "Reliable with a guide who knows the fans."},
            {speciesSlug: "dugong", whyItFits: "Seagrass beds off Waigeo, Gam and Misool still carry dugongs, occasionally seen from homestay jetties at dawn.", rarityHint: "Rare and memorable."},
            {speciesSlug: "red-bird-of-paradise", whyItFits: "Found only on Waigeo and Batanta; males display in a tall tree above Saporkren village on Waigeo at dawn.", rarityHint: "Reliable at the Saporkren display tree with a village guide."},
            {speciesSlug: "wilsons-bird-of-paradise", whyItFits: "A tiny bird with a bare blue skullcap that clears a ground court in the Waigeo hills near Saporkren and Yenbekwan.", rarityHint: "Regular from hides at dawn; the hike starts at 4 am."},
            {speciesSlug: "blue-tree-monitor", whyItFits: "A turquoise-spotted monitor found only on Batanta island, hunting insects high in the trees.", rarityHint: "Very rare; most seen by researchers rather than visitors."},
            {speciesSlug: "coconut-crab", whyItFits: "Robber crabs emerge on the smaller uninhabited islets at night to crack fallen coconuts.", rarityHint: "Uncommon; ask homestay hosts which islets still have them."}
        ],
        bestFor: [
            "Manta cleaning stations at Manta Sandy and Manta Ridge",
            "Fish-count record dives at Cape Kri",
            "Walking sharks and wobbegongs on night dives",
            "Red and Wilson's birds-of-paradise on Waigeo"
        ],
        spottingTips: [
            "Pay the marine park entry fee in Waisai; it funds the patrols that keep sharks and mantas on the reefs.",
            "Manta Sandy has a rope line; stay behind it and let the mantas come to the cleaning station.",
            "Night snorkel off your homestay jetty with a torch for walking sharks, octopus and hunting lionfish.",
            "For the birds-of-paradise, arrange a guide at Saporkren the day before and leave by 4.30 am; both species finish displaying soon after sunrise."
        ],
        relatedLocationSlugs: ["papua", "maluku", "indonesia", "komodo-national-park"],
        challengeSlugs: ["shark-vs-bull-shark", "dolphin-vs-shark-intelligence"],
        faq: [
            {question: "What wildlife is there in Raja Ampat?", answer: "Raja Ampat has reef and oceanic manta rays, blacktip reef sharks, walking sharks, tasselled wobbegongs, green and hawksbill turtles, bumphead parrotfish and more than 1,600 reef fish species. On land Waigeo has the red and Wilson's birds-of-paradise."},
            {question: "What animals can be found in Raja Ampat?", answer: "Marine life dominates: mantas, reef sharks, turtles, pygmy seahorses, napoleon wrasse and huge fish schools. The islands also hold cockatoos, hornbills, coconut crabs, the Batanta blue tree monitor and two endemic birds-of-paradise."},
            {question: "When is the best time to see mantas in Raja Ampat?", answer: "October to April is peak manta season in the Dampier Strait, with the calmest seas from October to December. Mantas are present year-round in smaller numbers."},
            {question: "Can you snorkel Raja Ampat without diving?", answer: "Yes. The reefs off the Kri, Arborek and Gam homestays start in a metre of water, and Manta Sandy and the Arborek jetty are regularly snorkelled. Many homestay guests never dive."}
        ]
    },
    {
        slug: "flores",
        name: "Flores",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "east-nusa-tenggara",
        coordinate: {lat: -8.65, lng: 121.1, zoom: 7},
        captureArea: {bbox: {north: -8.0, south: -9.1, east: 123.1, west: 119.78}},
        title: "Animals in Flores: What You Can Spot, Learn, and Collect",
        description: "Flores wildlife guide: wild Komodo dragons at Wae Wuul, Riung flying foxes, Flores hawk-eagles over Kelimutu, rusa deer, macaques and pit vipers along the road.",
        searchIntents: [
            "animals in Flores",
            "wildlife in Flores Indonesia",
            "what animals can be found in Flores",
            "what wildlife is there in Flores",
            "what animals can you see in Flores",
            "hewan di Flores",
            "Flores Indonesia wildlife travel"
        ],
        quickAnswer: "Flores is the gateway to Komodo and has its own wild Komodo dragons in the Wae Wuul reserve and around Pota in the north. Along the Trans-Flores road expect rusa deer, long-tailed macaques, water monitors, brahminy kites and Sundas pit vipers, while Riung's Seventeen Islands have a flying-fox colony that fills the sky at dusk.",
        introduction: [
            "Flores is 350 kilometres of volcanoes between Labuan Bajo in the west and Larantuka in the east, with Kelimutu's three coloured crater lakes near Moni as the centrepiece. It is drier and more open than Java or Bali, which makes the wildlife easier to see.",
            "The famous animals live on the edges: Komodo dragons in the western reserves and the north coast, flying foxes and reef fish at Riung, and sperm and blue whales in the straits off the far east. Inland, the Ruteng forest and the Mbeliling hills above Labuan Bajo are where the island's endemic birds live."
        ],
        whyItMatters: [
            "Flores still has wild Komodo dragons outside the national park, a population that is declining and poorly protected compared with Komodo and Rinca.",
            "Several birds exist only on Flores and its closest neighbours, including the Flores hawk-eagle, Flores monarch and Flores crow, and the island's dry forest is being cleared for cashew and candlenut."
        ],
        animalsToSpot: [
            {speciesSlug: "komodo-dragon", whyItFits: "Wild dragons still live on Flores itself in the Wae Wuul reserve south of Labuan Bajo and around Pota and Riung on the north coast, hunting deer and goats.", rarityHint: "Uncommon on Flores; Wae Wuul needs a ranger and luck, Rinca is the reliable option."},
            {speciesSlug: "large-flying-fox", whyItFits: "A huge colony roosts in the mangroves of Pulau Ontoloe in Riung's Seventeen Islands park and streams out over the boats at dusk.", rarityHint: "Guaranteed on a Riung sunset boat trip."},
            {speciesSlug: "javan-rusa-deer", whyItFits: "Timor deer graze the dry grassland of western Flores and are the main prey of the island's dragons.", rarityHint: "Fairly common around Wae Wuul and the north coast at dawn."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops sit on the Trans-Flores road hairpins near Ruteng and raid the fruit stalls at Bajawa; logged by users in East Nusa Tenggara.", rarityHint: "Common along roads and at waterfalls."},
            {speciesSlug: "water-monitor", whyItFits: "Big monitors forage along the Riung mangroves and the river mouths at Maumere and Labuan Bajo.", rarityHint: "Common on the coast."},
            {speciesSlug: "sundas-pit-viper", whyItFits: "The green pit viper of the Lesser Sundas coils in bamboo and coffee bushes around Bajawa and Moni after dark.", rarityHint: "Uncommon; night walks near villages, and never handle it."},
            {speciesSlug: "brahminy-kite", whyItFits: "Chestnut kites patrol every harbour and fish market from Labuan Bajo to Maumere, and are a frequent East Nusa Tenggara capture.", rarityHint: "Guaranteed on the coast."},
            {speciesSlug: "white-bellied-sea-eagle", whyItFits: "Nests on the sea cliffs of the Seventeen Islands and fishes the bays around Maumere.", rarityHint: "Regular on boat trips."},
            {speciesSlug: "sulphur-crested-cockatoo", whyItFits: "Flores's small yellow-crested cockatoos, filed in AnimalDex under their larger cousin, survive in a few dry-forest pockets near Riung and in the Mbeliling hills.", rarityHint: "Rare and Critically Endangered; most reliable on Komodo and Rinca."},
            {speciesSlug: "edible-nest-swiftlet", whyItFits: "Swiftlets pour out of limestone caves near Riung and Maumere and are farmed in concrete nest-houses along the coast, as users in NTT have logged.", rarityHint: "Common at dusk near caves and nest-houses."},
            {speciesSlug: "wild-boar", whyItFits: "Pigs root through the dry forest of Wae Wuul and the Mbeliling foothills and are the dragons' other main meal.", rarityHint: "Common but shy; look for churned ground."},
            {speciesSlug: "spinner-dolphin", whyItFits: "Pods ride the bow waves of boats crossing from Labuan Bajo to Komodo and off Maumere bay.", rarityHint: "Regular on morning crossings."},
            {speciesSlug: "sperm-whale", whyItFits: "The Lamalera whalers of Lembata, just east of Flores, still hunt sperm whales by hand; the whales migrate through the Savu Sea from May to October.", rarityHint: "Seasonal; boat trips from Lamalera or Larantuka between May and October."},
            {speciesSlug: "zebra-finch", whyItFits: "Wild Timor zebra finches, the species behind every pet-shop bird, hop through the dry grass of eastern Flores and Lembata.", rarityHint: "Common in dry open country in the east."}
        ],
        bestFor: [
            "Flying-fox sunsets at Riung's Seventeen Islands",
            "Wild Komodo dragons outside the national park",
            "Trans-Flores road trips with roadside macaques and deer",
            "Whale watching in the Savu Sea from Lembata"
        ],
        spottingTips: [
            "Riung boat trips leave around 9 am for snorkelling and return past the flying-fox island at 5.30 pm; insist the boatman stays until the bats fly.",
            "Wae Wuul reserve is 20 km from Labuan Bajo by motorbike; register at the BBKSDA office first and take a ranger.",
            "Drive the Trans-Flores road early; macaques and deer cross before 8 am and the mist lifts off Ruteng's forest for birds.",
            "The Mbeliling hills above Labuan Bajo hold Flores's endemic birds; Puarlolo at dawn is the standard spot."
        ],
        relatedLocationSlugs: ["labuan-bajo", "komodo-national-park", "east-nusa-tenggara", "sumba"],
        challengeSlugs: ["komodo-dragon-vs-king-cobra"],
        faq: [
            {question: "What wildlife is there in Flores?", answer: "Flores has wild Komodo dragons in its western and northern reserves, Timor rusa deer, wild boar, macaques, water monitors, flying foxes, pit vipers and endemic birds such as the Flores hawk-eagle. Dolphins and, in season, sperm and blue whales pass through the straits at either end."},
            {question: "What animals can be found in Flores?", answer: "Along the main road you will see long-tailed macaques, brahminy kites and rusa deer. Riung has a flying-fox colony and reef fish, Wae Wuul has dragons, and the Mbeliling and Ruteng forests hold the island's endemic birds."},
            {question: "Are there Komodo dragons on Flores island itself?", answer: "Yes, but far fewer than on Komodo and Rinca. Wild dragons survive in the Wae Wuul reserve near Labuan Bajo and along the north coast around Pota and Riung. Sightings are not guaranteed, so most visitors go to Rinca."},
            {question: "When is the best time to visit Flores for wildlife?", answer: "The dry season from April to October gives easy roads, clear boat trips and concentrated wildlife at waterholes. Whale watching off Lembata runs May to October."}
        ]
    },
    {
        slug: "labuan-bajo",
        name: "Labuan Bajo",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "flores",
        coordinate: {lat: -8.4964, lng: 119.8877, zoom: 10},
        captureArea: {bbox: {north: -8.3, south: -8.75, east: 120.05, west: 119.6}},
        title: "Animals in Labuan Bajo: What You Can Spot, Learn, and Collect",
        description: "Labuan Bajo wildlife guide: Komodo dragons on Rinca, mantas at Manta Point, flying foxes at Kalong island, Padar deer, and the kites and monitors of the harbour.",
        searchIntents: [
            "animals in Labuan Bajo",
            "wildlife in Labuan Bajo",
            "what animals can be found in Labuan Bajo",
            "what wildlife is there in Labuan Bajo",
            "what animals can you see in Labuan Bajo",
            "hewan di Labuan Bajo",
            "Labuan Bajo wildlife travel"
        ],
        quickAnswer: "Labuan Bajo is the harbour town where every Komodo trip starts. A standard day or overnight boat gives you Komodo dragons at Loh Buaya on Rinca, reef mantas at Manta Point off Makassar reef, thousands of flying foxes leaving Kalong island at dusk, and rusa deer and sea eagles at Padar. In town itself expect brahminy kites, water monitors, geckos and macaques in the hills behind the harbour.",
        introduction: [
            "The town has grown from a fishing village into Flores's main airport and marina, and the harbour fleet runs everything from six-hour speedboat tours to three-day liveaboards. Rinca is 90 minutes away, Komodo island about three hours.",
            "The land around Labuan Bajo is dry monsoon forest and grassland. The Wae Wuul reserve to the south has wild dragons, the Mbeliling hills to the east have Flores's endemic birds, and the Batu Cermin cave on the edge of town has bats and swiftlets."
        ],
        whyItMatters: [
            "Komodo National Park charges a conservation fee and limits dragon encounters to ranger-led walks; the money and rules are what keep roughly 3,000 dragons and the reef mantas protected.",
            "The town is a good place to see how tourism pressure plays out: boat traffic at Manta Point and anchoring damage are live issues, and well-behaved visitors matter."
        ],
        animalsToSpot: [
            {speciesSlug: "komodo-dragon", whyItFits: "Rangers at Loh Buaya on Rinca walk you past dragons basking by the kitchen and nesting in the hillside mounds; Komodo island's Loh Liang is the longer walk.", rarityHint: "Near-guaranteed on Rinca; dry season (April to November) is best."},
            {speciesSlug: "reef-manta-ray", whyItFits: "Manta Point on Makassar reef is a shallow drift over rubble where reef mantas feed and clean, often a dozen at once.", rarityHint: "Reliable December to March; regular all year."},
            {speciesSlug: "large-flying-fox", whyItFits: "Kalong island's mangroves hold thousands of flying foxes that stream over the boats towards Flores at sunset.", rarityHint: "Guaranteed on any overnight boat anchored off Kalong at dusk."},
            {speciesSlug: "javan-rusa-deer", whyItFits: "Rusa deer walk the beach at Padar and Loh Liang in the open, unbothered by boats.", rarityHint: "Common on Komodo, Rinca and Padar."},
            {speciesSlug: "wild-boar", whyItFits: "Pigs trot along the Rinca mangrove edge and the Loh Liang trails, the dragons' second favourite meal.", rarityHint: "Regular on Rinca walks."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Macaques work the Rinca mangroves at low tide and sit on the roadside above Labuan Bajo's harbour at dusk.", rarityHint: "Guaranteed."},
            {speciesSlug: "water-monitor", whyItFits: "Small monitors mop up around the Labuan Bajo fish market and the river mouth south of the marina.", rarityHint: "Common in town; often mistaken for baby dragons."},
            {speciesSlug: "brahminy-kite", whyItFits: "Kites hang over the harbour waiting for fish scraps and perch on the masts of the phinisi fleet.", rarityHint: "Guaranteed over the harbour."},
            {speciesSlug: "white-bellied-sea-eagle", whyItFits: "A pair nests on the Padar cliffs and others fish the Komodo channels; the big raptor of every boat trip.", rarityHint: "Regular around Padar and Komodo."},
            {speciesSlug: "sulphur-crested-cockatoo", whyItFits: "The yellow-crested cockatoos of Komodo and Rinca, logged under this entry, screech from the tamarind trees above Loh Liang beach.", rarityHint: "Regular on Komodo island; one of the species' last strongholds."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Small sharks hunt the shallows at Pink Beach and Kanawa island, visible from the sand.", rarityHint: "Common at Pink Beach and Kanawa."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Turtles graze the seagrass and reef at Siaba Besar, nicknamed Turtle City, and around Kanawa.", rarityHint: "Near-guaranteed at Siaba Besar."},
            {speciesSlug: "spinner-dolphin", whyItFits: "Pods surf the wake of boats in the channel between Flores and Rinca most mornings.", rarityHint: "Regular on morning crossings."},
            {speciesSlug: "common-house-gecko", whyItFits: "Every guesthouse wall and harbour cafe light in Labuan Bajo has geckos working the insects after dark.", rarityHint: "Guaranteed."}
        ],
        bestFor: [
            "Day and overnight Komodo dragon boat trips",
            "Manta snorkelling at Manta Point",
            "Flying-fox sunsets at Kalong island",
            "Padar viewpoint with deer and sea eagles"
        ],
        spottingTips: [
            "Take the overnight boat rather than the day trip if you want the Kalong flying foxes; the day boats are back in port before dusk.",
            "At Loh Buaya stay behind the ranger and never crouch near a dragon for a photo; they move faster than they look.",
            "Manta Point works best on a falling tide; ask the captain to check conditions and drift rather than anchor.",
            "Wae Wuul reserve, 20 km south of town, has wild dragons outside the park with no boat needed; book a ranger at the BBKSDA office."
        ],
        relatedLocationSlugs: ["komodo-national-park", "flores", "east-nusa-tenggara", "bali"],
        challengeSlugs: ["komodo-dragon-vs-king-cobra", "crocodile-monitor-vs-komodo-dragon"],
        faq: [
            {question: "What wildlife is there in Labuan Bajo?", answer: "Labuan Bajo is the base for Komodo dragons on Rinca and Komodo, reef mantas at Manta Point, flying foxes at Kalong island and rusa deer, wild boar and sea eagles on Padar. The town has brahminy kites, water monitors, macaques and geckos."},
            {question: "What animals can be found in Labuan Bajo?", answer: "On the boats you will see dragons, deer, boar, macaques, cockatoos, mantas, turtles, reef sharks and dolphins. In town the common animals are kites over the harbour, monitors at the fish market and geckos on every wall."},
            {question: "Can you see Komodo dragons in one day from Labuan Bajo?", answer: "Yes. Day trips by speedboat visit Rinca or Komodo plus Padar, Pink Beach and Manta Point in eight to ten hours. Rinca is closer and dragon sightings there are almost certain."},
            {question: "Is Labuan Bajo good for families?", answer: "Yes, with limits. Children can do the Rinca walk with a ranger, snorkel Pink Beach and watch the flying foxes, but the dragon trails need close supervision and the long day boats are tiring in the heat."}
        ]
    },
    {
        slug: "lombok",
        name: "Lombok",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "indonesia",
        coordinate: {lat: -8.65, lng: 116.32, zoom: 9},
        captureArea: {bbox: {north: -8.1, south: -9.15, east: 116.8, west: 115.75}},
        title: "Animals in Lombok: What You Can Spot, Learn, and Collect",
        description: "Lombok wildlife guide: macaques on the Pusuk pass, leaf monkeys and deer on Rinjani, Gili turtles and reef sharks, Sekotong reefs, flying foxes and tokay geckos.",
        searchIntents: [
            "animals in Lombok",
            "wildlife in Lombok",
            "what animals can be found in Lombok",
            "what wildlife is there in Lombok",
            "what animals can you see in Lombok",
            "hewan di Lombok",
            "Lombok wildlife travel"
        ],
        quickAnswer: "Lombok sits just east of the Wallace Line, so it mixes Bali-style wildlife with the first Australasian birds. Long-tailed macaques line the Pusuk monkey forest road, ebony leaf monkeys and rusa deer live on Rinjani's slopes, and the Gili islands and Sekotong peninsula give turtles, reef sharks and clownfish in a few metres of water. Users on the island mostly log geckos, sparrows, zebra doves and the insects of guesthouse gardens.",
        introduction: [
            "Mount Rinjani fills the north of Lombok, with the Senaru waterfalls and the Pusuk pass forest as the easy wildlife stops. The south coast around Kuta and Selong Belanak is dry hills and surf beaches, and the west has Senggigi and the three Gilis.",
            "The island is less built-up than Bali and the countryside opens quickly: rice plains full of egrets and pond herons, tobacco fields with zebra doves, and hills where helmeted friarbirds and honeyeaters show you are east of Wallace's line."
        ],
        whyItMatters: [
            "Rinjani's forest is the water source for the whole island and the last refuge of Lombok's leaf monkeys and the hill birds that mark the start of Australasia; the national park is a UNESCO Global Geopark.",
            "Gili Trawangan's turtle population recovered through hatcheries and dive-operator pressure on fishing, making the Gilis one of the easiest places in Asia to see wild sea turtles."
        ],
        animalsToSpot: [
            {speciesSlug: "long-tailed-macaque", whyItFits: "The Pusuk pass road between Mataram and Senaru is lined with macaques waiting for passing cars, and more troops live at Senaru's waterfalls.", rarityHint: "Guaranteed on the Pusuk road."},
            {speciesSlug: "javan-rusa-deer", whyItFits: "Rusa deer graze the Sembalun grasslands on Rinjani's eastern flank and the dry hills of the south coast.", rarityHint: "Fairly common on the Sembalun trek at dawn."},
            {speciesSlug: "wild-boar", whyItFits: "Pigs root through the Rinjani forest and around the crater-rim campsites at night, drawn by trekkers' food.", rarityHint: "Common around Rinjani camps."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Turtles feed on the seagrass off Gili Meno and Gili Trawangan and rest on the Sekotong reefs.", rarityHint: "Near-guaranteed snorkelling the Gilis."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Hawksbills pick at sponges on the Gili reefs and nest on quiet beaches at Sekotong and the south coast.", rarityHint: "Regular on Gili snorkels and dives."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Juvenile sharks patrol the shallows at Shark Point off Gili Trawangan and in the Gili Nanggu lagoon at Sekotong.", rarityHint: "Common at Shark Point."},
            {speciesSlug: "clownfish", whyItFits: "Anemones with clownfish sit in a metre of water off the Gili Air and Gili Nanggu beaches.", rarityHint: "Guaranteed on any reef snorkel."},
            {speciesSlug: "large-flying-fox", whyItFits: "Fruit bats leave mangrove and fig roosts on the west coast at dusk and feed in the Senggigi hills.", rarityHint: "Regular at dusk."},
            {speciesSlug: "water-monitor", whyItFits: "Monitors hunt crabs in the Sekotong and Gili Gede mangroves and raid chicken runs on the rice plain.", rarityHint: "Common near water."},
            {speciesSlug: "tokay-gecko", whyItFits: "Lombok's homestay roofs ring with the 'to-kay' call after dark; the island's big gecko is hard to miss.", rarityHint: "Heard nightly; seen on walls near lights."},
            {speciesSlug: "common-house-gecko", whyItFits: "The most-captured animal by AnimalDex users in West Nusa Tenggara, hunting insects on every guesthouse wall.", rarityHint: "Guaranteed."},
            {speciesSlug: "zebra-dove", whyItFits: "Zebra doves feed on the tobacco and rice-field tracks of central Lombok and have been logged by users on the island.", rarityHint: "Very common in farmland."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The sparrow of every Lombok market and mosque courtyard, a frequent user capture.", rarityHint: "Guaranteed in towns."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "Logged by a user in West Nusa Tenggara; crocodiles occasionally turn up in Lombok's east-coast mangroves and the Alas strait.", rarityHint: "Rare and mostly a straying animal; treat east-coast estuaries with care."}
        ],
        bestFor: [
            "Turtle snorkelling in the Gili islands",
            "Roadside macaques at the Pusuk pass",
            "Rinjani treks with deer and boar at the camps",
            "Quiet reef snorkelling at Sekotong"
        ],
        spottingTips: [
            "Drive the Pusuk pass in the early morning when the macaques sit on the road edge and the forest birds are active.",
            "On the Gilis, snorkel the Meno Wall and the seagrass off Trawangan's east beach at high tide for turtles.",
            "At Rinjani camps hang food in a bag; the boar and macaques visit every night.",
            "Ebony leaf monkeys are shy; scan the big fig trees along the Senaru waterfall trail rather than the roadside."
        ],
        relatedLocationSlugs: ["gili-islands", "bali", "indonesia", "nusa-penida"],
        faq: [
            {question: "What wildlife is there in Lombok?", answer: "Lombok has long-tailed macaques, ebony leaf monkeys, rusa deer and wild boar on Mount Rinjani, flying foxes and water monitors on the coasts, and green and hawksbill turtles, reef sharks and clownfish around the Gili islands and Sekotong."},
            {question: "What animals can be found in Lombok?", answer: "Easy animals include macaques at the Pusuk pass, turtles at the Gilis, geckos on every wall, and zebra doves and tree sparrows in the fields and towns. Harder ones are Rinjani's leaf monkeys and the friarbirds of the dry hills."},
            {question: "Where can you see turtles in Lombok?", answer: "Gili Meno and Gili Trawangan have resident green and hawksbill turtles on the seagrass beds and reef walls; snorkel from the beach at high tide. Gili Nanggu at Sekotong is a quieter alternative."},
            {question: "Are there monkeys in Lombok?", answer: "Yes. Long-tailed macaques are common and sit along the Pusuk pass road waiting for food, and the darker ebony leaf monkey lives in Rinjani's forest and is seen on the Senaru trails with patience."}
        ]
    },
    {
        slug: "gili-islands",
        name: "Gili Islands",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "lombok",
        coordinate: {lat: -8.35, lng: 116.05, zoom: 12},
        captureArea: {bbox: {north: -8.30, south: -8.40, east: 116.12, west: 115.99}},
        title: "Animals in the Gili Islands: What You Can Spot, Learn, and Collect",
        description: "Gili Islands wildlife guide: green and hawksbill turtles off Gili Meno, blacktip reef sharks at Shark Point, clownfish, morays and octopus on three car-free islands.",
        searchIntents: [
            "animals in the Gili Islands",
            "wildlife in Gili Trawangan",
            "what animals can be found in the Gili Islands",
            "what wildlife is there in the Gili Islands",
            "what animals can you see in Gili Meno",
            "hewan di Gili Trawangan",
            "Gili Islands marine life"
        ],
        quickAnswer: "The three Gilis off north-west Lombok are a turtle destination first: green and hawksbill turtles graze the seagrass off Gili Meno and Trawangan within swimming distance of the beach. Add blacktip reef sharks at Shark Point, clownfish, moray eels, cuttlefish and octopus on the reefs, and on land the geckos, hermit crabs and brahminy kites of islands with no cars at all.",
        introduction: [
            "Gili Trawangan is the party island, Gili Air the relaxed one and Gili Meno the quiet one, but all three share the same reef system and the same resident turtles. Boats cross from Bangsal on Lombok in 15 minutes or from Bali in two hours.",
            "There are no cars or motorbikes, so the loudest sounds at night are tokay geckos and the horse carts. The reefs were damaged by bleaching and the 2018 earthquake but have come back well in the protected zones."
        ],
        whyItMatters: [
            "The Gili Eco Trust and dive operators have run turtle hatcheries, Biorock reef restoration and a fishing ban for two decades; the turtles you see are the result.",
            "For a collector the Gilis are the simplest place in Indonesia to log a dozen marine species from the beach without a dive certificate."
        ],
        animalsToSpot: [
            {speciesSlug: "green-sea-turtle", whyItFits: "Big green turtles feed on the seagrass off Gili Meno's west side and Trawangan's north-east beach, surfacing every few minutes to breathe.", rarityHint: "Near-guaranteed from the beach at high tide."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Smaller hawksbills work the coral at Meno Wall and Turtle Heaven, picking sponges from the reef.", rarityHint: "Regular on snorkels and dives."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Juvenile blacktips cruise the shallow coral garden at Shark Point off Trawangan's north coast.", rarityHint: "Common at Shark Point; mornings are best."},
            {speciesSlug: "clownfish", whyItFits: "Anemones with clownfish families sit in the shallows off Gili Air's east beach and at Meno's Bounty wreck.", rarityHint: "Guaranteed on any snorkel."},
            {speciesSlug: "moray-eel", whyItFits: "Giant and honeycomb morays gape from holes in the Meno Wall and Halik reef.", rarityHint: "Common on dives, occasional on snorkels."},
            {speciesSlug: "cuttlefish", whyItFits: "Broadclub cuttlefish hover over the sandy slopes at Hans Reef and Meno Slope, flashing colour bands.", rarityHint: "Regular on dives."},
            {speciesSlug: "octopus", whyItFits: "Reef octopus hunt in the open on the shallow reef flats at dusk and on night dives at Halik.", rarityHint: "Regular at dusk and night."},
            {speciesSlug: "lionfish", whyItFits: "Lionfish hang under the Bounty wreck pontoon at Meno and in reef overhangs on night dives.", rarityHint: "Common at the wreck."},
            {speciesSlug: "humphead-parrotfish", whyItFits: "A school of bumphead parrotfish rounds Shark Point and Deep Turbo at dawn, grinding coral into sand.", rarityHint: "Regular on early dives."},
            {speciesSlug: "mantis-shrimp", whyItFits: "Peacock mantis shrimp peer from burrows in the rubble at Meno Slope and Secret Reef.", rarityHint: "Uncommon; slow searching over rubble."},
            {speciesSlug: "long-spined-sea-urchin", whyItFits: "Black urchins pack the rocky shallows at the beach entries, the reason every snorkeller wears reef shoes.", rarityHint: "Guaranteed; watch your feet."},
            {speciesSlug: "hermit-crab", whyItFits: "Hundreds of hermit crabs march across the sand at night along every Gili beach.", rarityHint: "Guaranteed after dark."},
            {speciesSlug: "tokay-gecko", whyItFits: "The big barking gecko of every bungalow roof, far louder than anything the islands have on wheels.", rarityHint: "Heard every night; seen near porch lights."},
            {speciesSlug: "brahminy-kite", whyItFits: "Kites circle the Bangsal and Trawangan harbours for fish scraps and nest in the Meno salt-lake trees.", rarityHint: "Common around the harbours."}
        ],
        bestFor: [
            "Beach-entry turtle snorkelling at Gili Meno",
            "First dives with reef sharks at Shark Point",
            "Night snorkels and dives for octopus and lionfish",
            "Car-free island nights with geckos and hermit crabs"
        ],
        spottingTips: [
            "Turtle Point off Meno's west beach and the seagrass north of Trawangan's harbour are best at high tide, 8 to 10 am before the boats churn the water.",
            "Wear reef shoes for every beach entry; the urchins are thick in the rocky shallows.",
            "Book a dusk or night dive at Halik or Meno Slope for octopus, cuttlefish and hunting morays.",
            "Walk the beach after 9 pm with a torch for hermit crabs and ghost crabs; keep lights off the water where turtles might nest."
        ],
        relatedLocationSlugs: ["lombok", "bali", "nusa-penida", "indonesia"],
        challengeSlugs: ["octopus-vs-crab"],
        faq: [
            {question: "What wildlife is there in the Gili Islands?", answer: "The Gilis have resident green and hawksbill turtles, blacktip reef sharks, clownfish, moray eels, cuttlefish, octopus, lionfish and bumphead parrotfish on their reefs. On land there are tokay geckos, hermit crabs and brahminy kites, but no cars."},
            {question: "What animals can be found in the Gili Islands?", answer: "Turtles are the headline and are seen from the beach almost daily at Gili Meno and Gili Trawangan. Reef sharks live at Shark Point, and the reefs hold clownfish, morays, cuttlefish and mantis shrimp."},
            {question: "Which Gili island is best for turtles?", answer: "Gili Meno, especially the west-side seagrass beds and Meno Wall, has the most reliable turtles and the fewest boats. Trawangan's north-east beach is a close second."},
            {question: "Can you see sharks while snorkelling in the Gilis?", answer: "Yes. Blacktip reef sharks, mostly juveniles under a metre long, patrol Shark Point off Gili Trawangan in two to five metres of water. They are harmless to snorkellers."}
        ]
    },
    {
        slug: "sumba",
        name: "Sumba",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "east-nusa-tenggara",
        coordinate: {lat: -9.65, lng: 119.95, zoom: 8},
        captureArea: {bbox: {north: -9.2, south: -10.35, east: 120.9, west: 118.9}},
        title: "Animals in Sumba: What You Can Spot, Learn, and Collect",
        description: "Sumba wildlife guide: endemic birds and the citron-crested cockatoo at Manupeu Tanah Daru, savanna rusa deer and buffalo, sea turtles and reef sharks on the coast.",
        searchIntents: [
            "animals in Sumba",
            "wildlife in Sumba",
            "what animals can be found in Sumba",
            "what wildlife is there in Sumba",
            "what animals can you see in Sumba Indonesia",
            "hewan di Sumba",
            "Sumba wildlife travel"
        ],
        quickAnswer: "Sumba is a dry savanna island with its own birds: the Sumba hornbill, Sumba boobook, Sumba green pigeon and the citron-crested form of the yellow-crested cockatoo all live in the forest patches of Manupeu Tanah Daru and Laiwangi Wanggameti national parks. The grasslands have rusa deer, wild boar and semi-wild horses, the coast has sea turtles nesting and reef sharks, and the villages have macaques, monitors, zebra finches and swiftlets.",
        introduction: [
            "Sumba sits south of Flores and feels closer to northern Australia than to Bali: brown hills, stone-tomb villages, horse culture and empty surf beaches. Tambolaka in the west and Waingapu in the east are the airports.",
            "The two national parks protect the last big forest blocks. Manupeu Tanah Daru, an hour from Waikabubak, has the Lapopu and Matayangu waterfalls and most of the endemic birds; Laiwangi Wanggameti in the south-east is higher and wetter."
        ],
        whyItMatters: [
            "Sumba's seven endemic bird species depend on forest that covers less than 10 percent of the island, and the citron-crested cockatoo has been reduced to a small, fragmented population after decades of trapping.",
            "Community conservation around Manupeu Tanah Daru pays villages to protect hornbill nest trees, and visitor birding is part of the income."
        ],
        animalsToSpot: [
            {speciesSlug: "sulphur-crested-cockatoo", whyItFits: "Sumba's citron-crested cockatoo, filed in AnimalDex under its larger sulphur-crested cousin, feeds in the forest canopy of Manupeu Tanah Daru and roosts in tall trees near Lapopu waterfall.", rarityHint: "Rare and Critically Endangered; Manupeu Tanah Daru is the only realistic site."},
            {speciesSlug: "javan-rusa-deer", whyItFits: "Rusa deer graze the open savanna of eastern Sumba around Waingapu and the Wanggameti foothills at dawn.", rarityHint: "Fairly common in the east; hunted, so wary."},
            {speciesSlug: "wild-boar", whyItFits: "Pigs are the main game of Sumbanese horseback hunts and root through the savanna and forest edge everywhere.", rarityHint: "Common but shy."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops live in the gallery forest along Sumba's rivers and raid gardens near Waikabubak.", rarityHint: "Common near forested valleys."},
            {speciesSlug: "water-buffalo", whyItFits: "Buffalo are Sumba's wealth, wallowing in every village pond and grazing the savanna in herds that are the closest thing to wild.", rarityHint: "Guaranteed across the island."},
            {speciesSlug: "water-monitor", whyItFits: "Monitors patrol the river pools below Lapopu waterfall and the mangroves of the north coast.", rarityHint: "Common near water."},
            {speciesSlug: "sundas-pit-viper", whyItFits: "Green pit vipers hang in shrubs along the Manupeu Tanah Daru trails and village hedges after dark.", rarityHint: "Uncommon; a careful night walk."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "Crocodiles live in the estuaries of eastern and southern Sumba; locals avoid swimming at river mouths for good reason.", rarityHint: "Occasional in east-coast estuaries."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Green turtles nest on the quiet south-coast beaches near Nihiwatu and feed on the reef flats off Tarimbang.", rarityHint: "Regular on reef snorkels; nesting in the wet season."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Small sharks hunt the lagoon flats at Walakiri and the reef edge off Mandorak at high tide.", rarityHint: "Common in shallow lagoons."},
            {speciesSlug: "brahminy-kite", whyItFits: "Kites patrol the Waingapu harbour and the fishing villages of the north coast.", rarityHint: "Guaranteed on the coast."},
            {speciesSlug: "white-bellied-sea-eagle", whyItFits: "Sea eagles nest on the cliffs of the south coast and fish the bays at Tarimbang and Nihiwatu.", rarityHint: "Regular along the south coast."},
            {speciesSlug: "zebra-finch", whyItFits: "Wild zebra finches flock in the dry grass of eastern Sumba, the native setting for the world's most familiar cage finch.", rarityHint: "Common in the savanna around Waingapu."},
            {speciesSlug: "edible-nest-swiftlet", whyItFits: "Swiftlets nest in the limestone caves of western Sumba and in the nest-houses of Waingapu's outskirts.", rarityHint: "Common at dusk."}
        ],
        bestFor: [
            "Endemic birding at Manupeu Tanah Daru",
            "Savanna deer, buffalo and horses in eastern Sumba",
            "Turtle and reef snorkelling on the south coast",
            "Waterfall walks with monitors and macaques"
        ],
        spottingTips: [
            "Hire a guide from the Manupeu Tanah Daru office at Waikabubak; the cockatoo roost trees change and only the rangers know this year's.",
            "Birding is best at dawn in the dry season (May to October) when forest birds concentrate at fruiting figs and waterholes.",
            "Walakiri mangrove beach at sunset gives reef sharks in the shallows and kites and herons overhead.",
            "Ask before swimming at any river mouth on the east coast; crocodiles are a real presence."
        ],
        relatedLocationSlugs: ["east-nusa-tenggara", "flores", "komodo-national-park", "australia"],
        faq: [
            {question: "What wildlife is there in Sumba?", answer: "Sumba has seven endemic birds including the Sumba hornbill and Sumba boobook, plus the citron-crested cockatoo, in its two national parks. The savanna holds rusa deer, wild boar, buffalo and horses, and the coast has sea turtles, reef sharks, sea eagles and crocodiles in some estuaries."},
            {question: "What animals can be found in Sumba?", answer: "Everyday animals are long-tailed macaques, water monitors, buffalo, brahminy kites, zebra finches and swiftlets. The rarer prizes are the forest birds of Manupeu Tanah Daru and nesting green turtles on the south coast."},
            {question: "Where is the best place to see birds in Sumba?", answer: "Manupeu Tanah Daru National Park near Waikabubak, particularly the forest around Lapopu and Matayangu waterfalls, holds most of the endemics and the cockatoo roosts. Go with a park ranger at dawn."},
            {question: "Is it safe to swim in Sumba?", answer: "Surf beaches on the south and west coasts are fine for swimming and snorkelling in calm conditions. Avoid river mouths and mangrove estuaries, especially in the east, where saltwater crocodiles occur."}
        ]
    },
    {
        slug: "east-nusa-tenggara",
        name: "East Nusa Tenggara",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "indonesia",
        coordinate: {lat: -9.5, lng: 121.8, zoom: 6},
        captureArea: {bbox: {north: -7.9, south: -11.1, east: 125.3, west: 118.8}},
        title: "Animals in East Nusa Tenggara: What You Can Spot, Learn, and Collect",
        description: "East Nusa Tenggara wildlife guide: Komodo dragons, Timor deer, Kupang Bay crocodiles, Savu Sea sperm and blue whales, Alor dugongs, lorikeets and swiftlets.",
        searchIntents: [
            "animals in East Nusa Tenggara",
            "wildlife in Nusa Tenggara Timur",
            "what animals can be found in East Nusa Tenggara",
            "what wildlife is there in East Nusa Tenggara",
            "what animals can you see in Kupang and Timor",
            "hewan di Nusa Tenggara Timur",
            "NTT Indonesia wildlife travel"
        ],
        quickAnswer: "East Nusa Tenggara (NTT) covers Flores, Sumba, Timor, Alor, Lembata and the Komodo islands, the driest province in Indonesia. Komodo dragons are the headline, but the province also has sperm and blue whales in the Savu Sea, dugongs at Alor, saltwater crocodiles in Kupang Bay, Timor rusa deer on the savannas, and a long list of Lesser Sundas birds from iris lorikeets to zebra finches. Around Kupang AnimalDex users mostly log swiftlets, mynas, kites, ants and the insects of the dry season.",
        introduction: [
            "NTT is Indonesia's far south-east, closer to Darwin than to Jakarta. Kupang on Timor is the capital, with flights to Labuan Bajo, Maumere, Ende, Waingapu, Alor and Rote. The landscape is savanna, eucalyptus and dry monsoon forest with a short wet season from December to March.",
            "Wildlife is spread across the islands: dragons in the west, whales and dugongs in the Alor and Solor straits, endemic birds on Sumba and Timor, and a Kupang Bay crocodile population that makes the news every year. The sea between the islands is the richest part, with reef walls at Alor to rival anywhere in Indonesia."
        ],
        whyItMatters: [
            "The Savu Sea Marine National Park is the largest in Indonesia and a migration corridor for sperm, blue and pilot whales; the Lamalera subsistence whale hunt on Lembata is one of the last of its kind.",
            "Timor's Mutis-Timau forest and the Bipolo lowland remnant hold birds found only on Timor, and almost all of it is unprotected community land."
        ],
        animalsToSpot: [
            {speciesSlug: "komodo-dragon", whyItFits: "The province's emblem lives on Komodo, Rinca, Gili Motang, Nusa Kode and western Flores, all inside NTT.", rarityHint: "Near-guaranteed on Rinca; nowhere else in the world."},
            {speciesSlug: "javan-rusa-deer", whyItFits: "Timor deer are native to Timor and the Lesser Sundas and graze the savannas of Sumba, Timor, Flores and the Komodo islands.", rarityHint: "Common on Komodo and Rinca, fairly common elsewhere."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "Kupang Bay and the Timor river mouths have a growing crocodile population, with animals regularly seen near Oesapa and Lasiana beaches.", rarityHint: "Regular around Kupang Bay; follow local warnings about swimming."},
            {speciesSlug: "sperm-whale", whyItFits: "Sperm whales pass through the Savu Sea and the Lamalera waters of Lembata between May and October, where the village still hunts them by hand.", rarityHint: "Seasonal; boat trips from Lamalera or Lewoleba."},
            {speciesSlug: "blue-whale", whyItFits: "Pygmy blue whales migrate through the Ombai and Solor straits between Alor, Lembata and Timor in the second half of the year.", rarityHint: "Rare but regular from Alor and Lembata boats, August to November."},
            {speciesSlug: "dugong", whyItFits: "Alor's Mali beach near the airport has a famous resident dugong that local boatmen take visitors to see.", rarityHint: "Reliable at Mali, Alor, with a local boatman; rare elsewhere."},
            {speciesSlug: "spinner-dolphin", whyItFits: "Pods of hundreds surf alongside the Kupang to Rote ferry and the Alor dive boats most mornings.", rarityHint: "Regular on any sea crossing."},
            {speciesSlug: "iris-lorikeet", whyItFits: "A small lorikeet native to Timor and Wetar, feeding in flowering eucalyptus and casuarina around Camplong and Bipolo near Kupang.", rarityHint: "Uncommon; Camplong forest and Bipolo at dawn."},
            {speciesSlug: "edible-nest-swiftlet", whyItFits: "The most distinctive user capture from Nusa Tenggara Timur; swiftlets stream from limestone caves and nest-houses around Kupang and Soe at dusk.", rarityHint: "Common at dusk across Timor."},
            {speciesSlug: "brahminy-kite", whyItFits: "Logged by users in East Nusa Tenggara, the kite hangs over Kupang's Tenau harbour, Oeba fish market and every coastal village.", rarityHint: "Guaranteed on the coast."},
            {speciesSlug: "javan-myna", whyItFits: "Logged in NTT by AnimalDex users, the myna struts on Kupang's lawns and traffic islands and roosts in the market trees.", rarityHint: "Common in Kupang and the bigger towns."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Macaques live on Flores, Sumba and Timor, where they were probably introduced long ago, and have been logged by users in the province.", rarityHint: "Common in gallery forest and near waterfalls."},
            {speciesSlug: "zebra-finch", whyItFits: "The Timor zebra finch is native across NTT's savannas, flocking in dry grass around Kupang, Soe and Waingapu.", rarityHint: "Common in open country."},
            {speciesSlug: "asian-weaver-ant", whyItFits: "Weaver ants and black ants are the most-logged animals by AnimalDex users around Kupang, stitching nests in tamarind and mango trees.", rarityHint: "Guaranteed in any garden."}
        ],
        bestFor: [
            "Komodo dragons in the west of the province",
            "Whale watching in the Savu Sea from Lembata and Alor",
            "Dugong and reef-wall diving at Alor",
            "Timor endemic birds around Kupang and Mount Mutis"
        ],
        spottingTips: [
            "Camplong and Bipolo, an hour from Kupang, are the standard half-day birding sites for Timor endemics; go at first light before the heat.",
            "Alor's Mali beach dugong is best at high tide in the morning; ask at the beach warungs for the boatmen who know it.",
            "Whale season in Lamalera is May to October; stay in the village and go out with a non-hunting boat at dawn.",
            "Do not swim at Kupang's city beaches after dark or near river mouths; crocodile sightings are frequent."
        ],
        relatedLocationSlugs: ["komodo-national-park", "flores", "sumba", "labuan-bajo"],
        challengeSlugs: ["komodo-dragon-vs-king-cobra", "crocodile-vs-shark"],
        faq: [
            {question: "What wildlife is there in East Nusa Tenggara?", answer: "NTT has Komodo dragons, Timor rusa deer, wild boar and macaques on land, saltwater crocodiles in Kupang Bay and the Timor estuaries, and sperm whales, blue whales, dolphins and dugongs in the Savu Sea and Alor straits. Birds include iris lorikeets, zebra finches, swiftlets and the endemics of Sumba and Timor."},
            {question: "What animals can be found in East Nusa Tenggara?", answer: "Around Kupang the common animals are brahminy kites, Javan mynas, swiftlets, weaver ants and geckos, with crocodiles in the bay. Flores and Komodo add dragons and deer, Alor adds dugongs and whales, and Sumba adds endemic birds and savanna wildlife."},
            {question: "Are there crocodiles in Kupang?", answer: "Yes. Saltwater crocodiles live in Kupang Bay and the surrounding estuaries and are seen near Oesapa, Lasiana and the Tenau harbour several times a year. Follow local advice and avoid swimming near river mouths or at night."},
            {question: "When can you see whales in East Nusa Tenggara?", answer: "Sperm whales pass Lembata and the Savu Sea from May to October, and pygmy blue whales move through the Ombai and Solor straits between Alor and Timor from about August to November."}
        ]
    },
    {
        slug: "thousand-islands",
        name: "Thousand Islands (Kepulauan Seribu)",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "jakarta",
        coordinate: {lat: -5.75, lng: 106.6, zoom: 9},
        captureArea: {bbox: {north: -5.2, south: -6.05, east: 106.95, west: 106.3}},
        title: "Animals in the Thousand Islands: What You Can Spot, Learn, and Collect",
        description: "Kepulauan Seribu wildlife guide: hawksbill hatchlings at Pramuka island, blacktip reef sharks, clownfish, mudskippers, fiddler crabs and sea eagles near Jakarta.",
        searchIntents: [
            "animals in the Thousand Islands",
            "wildlife in Kepulauan Seribu",
            "what animals can be found in the Thousand Islands",
            "what wildlife is there in the Thousand Islands Jakarta",
            "what animals can you see in Pulau Seribu",
            "hewan di Kepulauan Seribu",
            "Thousand Islands Jakarta snorkelling"
        ],
        quickAnswer: "The Thousand Islands are Jakarta's offshore national park, about 110 small coral islands starting an hour by boat from Ancol. Pramuka island runs a hawksbill turtle hatchery and a reef-shark nursery, the outer islands have clownfish, morays and sea stars on recovering reefs, and the mangroves hold mudskippers, fiddler crabs, herons and sea eagles. Hermit crabs and house geckos cover the rest.",
        introduction: [
            "Kepulauan Seribu Marine National Park covers the northern islands around Pramuka, Harapan, Kelapa and Tidung. The southern islands near Bidadari and Onrust are too close to the Jakarta river plumes for good coral; the further north you go, the clearer the water.",
            "Weekend homestays on Pramuka, Harapan and Tidung include snorkelling trips to small uninhabited islets. The Jakarta parks office and local groups replant mangroves and release turtle hatchlings, and visitors can join both."
        ],
        whyItMatters: [
            "The park is one of the few places where a city of 30 million people can see wild sea turtles and sharks, and that visibility is what has kept hawksbill nesting beaches and the reef-shark nursery funded.",
            "Jakarta Bay's pollution and sediment reach the southern islands, so the northern reefs are a live indicator of what the capital's rivers are doing."
        ],
        animalsToSpot: [
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Pramuka island's hatchery incubates hawksbill eggs collected from Peteloran and the outer islands and releases hatchlings at dusk.", rarityHint: "Guaranteed at the Pramuka hatchery; adults seen on snorkels at the outer islets."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Green turtles graze seagrass off Pulau Semak Daun and Pulau Gosong and surface near anchored boats.", rarityHint: "Regular on snorkel trips north of Pramuka."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Pramuka's shark nursery pen and the shallows of Pulau Semak Daun hold juvenile blacktips; AnimalDex users in West Jakarta have logged the species at the Ancol aquarium too.", rarityHint: "Guaranteed in the nursery; occasional free-swimming at outer islets."},
            {speciesSlug: "clownfish", whyItFits: "Anemones with clownfish are the standard find on the house reefs at Pulau Air, Macan and Semak Daun.", rarityHint: "Near-guaranteed on any snorkel."},
            {speciesSlug: "moray-eel", whyItFits: "Morays sit in the coral heads off Pulau Kotok and Pulau Sepa, the islands with the best remaining reef.", rarityHint: "Regular on dives, occasional for snorkellers."},
            {speciesSlug: "chocolate-chip-sea-star", whyItFits: "Horned sea stars sit on the seagrass and sand flats at Tidung and Pramuka in shin-deep water; logged by users in Jakarta.", rarityHint: "Common on shallow sand flats."},
            {speciesSlug: "long-spined-sea-urchin", whyItFits: "Black urchins crowd the jetty pilings and rocky edges at Pramuka and Harapan.", rarityHint: "Guaranteed around jetties."},
            {speciesSlug: "jellyfish", whyItFits: "Seasonal jellyfish drift through the Pramuka channel in the west monsoon, when swimmers wear rash guards.", rarityHint: "Seasonal, December to February."},
            {speciesSlug: "mudskipper", whyItFits: "Mudskippers skip across the mangrove mud at Pramuka's replanting boardwalk and Pulau Kelapa Dua at low tide.", rarityHint: "Common at low tide in the mangroves."},
            {speciesSlug: "fiddler-crab", whyItFits: "Males wave their single big claw from burrows on the mudflats behind the Pramuka and Harapan mangroves.", rarityHint: "Common at low tide."},
            {speciesSlug: "hermit-crab", whyItFits: "The beaches of Tidung and Harapan crawl with hermit crabs after dark, dragging shells across the sand.", rarityHint: "Guaranteed at night."},
            {speciesSlug: "white-bellied-sea-eagle", whyItFits: "A pair nests on the casuarinas of Pulau Rambut bird sanctuary and fishes the channels between the islands.", rarityHint: "Regular near Pulau Rambut and the outer islets."},
            {speciesSlug: "black-naped-tern", whyItFits: "Terns fish the channels between Pramuka and Semak Daun and roost on sand spits at low tide.", rarityHint: "Common in the dry season."},
            {speciesSlug: "little-egret", whyItFits: "Egrets stalk the reef flats and mangrove edges and roost by the thousand on Pulau Rambut with herons and cormorants.", rarityHint: "Common; Pulau Rambut's roost is spectacular at dusk."}
        ],
        bestFor: [
            "Turtle hatchery visits on Pramuka island",
            "Beginner snorkelling an hour from Jakarta",
            "Mangrove boardwalks with mudskippers and crabs",
            "Seabird roosts at Pulau Rambut"
        ],
        spottingTips: [
            "Go midweek and head to the northern islands (Pramuka, Harapan, Semak Daun); southern water near Jakarta is too murky for reef life.",
            "Ask your homestay to time a snorkel trip for the morning slack tide when visibility peaks.",
            "Hatchling releases at Pramuka happen at dusk when eggs are hatching; ask the park office (Balai TN Kepulauan Seribu) that morning.",
            "Pulau Rambut needs a permit from the Jakarta conservation office but gives egrets, herons, cormorants and sea eagles coming in to roost."
        ],
        relatedLocationSlugs: ["jakarta", "west-java", "ujung-kulon", "indonesia"],
        faq: [
            {question: "What wildlife is there in the Thousand Islands?", answer: "Kepulauan Seribu has hawksbill and green sea turtles, juvenile blacktip reef sharks, clownfish, morays, sea stars and urchins on its reefs, mudskippers and fiddler crabs in the mangroves, and sea eagles, terns and egrets overhead. Pulau Rambut is a protected bird roost."},
            {question: "What animals can be found in the Thousand Islands?", answer: "Pramuka island has a turtle hatchery and shark nursery you can visit. The reefs around Semak Daun, Air and Macan have clownfish and turtles, and every beach has hermit crabs at night and geckos on the homestay walls."},
            {question: "Can you see turtles in the Thousand Islands?", answer: "Yes. The Pramuka hatchery guarantees hawksbill hatchlings and juveniles, and wild green and hawksbill turtles are seen on snorkel trips to the islets north of Pramuka. Nesting happens on remote islands such as Peteloran."},
            {question: "Is the water clean enough to snorkel near Jakarta?", answer: "In the northern park islands, yes, with visibility of 5 to 15 metres on good days. The islands within 20 km of Jakarta are affected by river sediment and are best for beaches, not reefs."}
        ]
    },
    {
        slug: "nusa-penida",
        name: "Nusa Penida",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "bali",
        coordinate: {lat: -8.73, lng: 115.54, zoom: 11},
        captureArea: {bbox: {north: -8.63, south: -8.85, east: 115.68, west: 115.42}},
        title: "Animals in Nusa Penida: What You Can Spot, Learn, and Collect",
        description: "Nusa Penida wildlife guide: reef mantas at Manta Point, ocean sunfish at Crystal Bay, reintroduced Bali mynas, sea kraits, turtles and sea eagles on the cliffs.",
        searchIntents: [
            "animals in Nusa Penida",
            "wildlife in Nusa Penida",
            "what animals can be found in Nusa Penida",
            "what wildlife is there in Nusa Penida",
            "what animals can you see in Nusa Penida",
            "hewan di Nusa Penida",
            "Nusa Penida manta snorkelling"
        ],
        quickAnswer: "Nusa Penida is Bali's manta island. Reef mantas clean and feed at Manta Point and Manta Bay under the southern cliffs year-round, ocean sunfish rise to the Crystal Bay cleaning stations from July to October, and the north-coast reefs have turtles, reef sharks and dense fish life. On land the island is the other home of the Bali myna, released into village temples by a conservation project, with sea eagles and kites on the cliffs.",
        introduction: [
            "The island lies 40 minutes by fast boat from Sanur and is dry, limestone and cliff-edged, nothing like mainland Bali. Kelingking, Broken Beach and Angel's Billabong draw the crowds, while the boats work the south-west corner for mantas and the Toyapakeh channel for reefs.",
            "Nusa Penida has been a bird sanctuary since 2006 under the Friends of the National Parks Foundation, which released Bali mynas, Java sparrows and lesser sulphur-crested cockatoos across the villages. The mynas now breed wild in the temple trees."
        ],
        whyItMatters: [
            "The Nusa Penida marine protected area covers 20,000 hectares and the manta population here is one of the best-studied in Indonesia, with hundreds of individuals identified by belly pattern.",
            "The Bali myna is one of the rarest birds in the world; the Nusa Penida flock is a second population that insures against the West Bali National Park birds being poached."
        ],
        animalsToSpot: [
            {speciesSlug: "reef-manta-ray", whyItFits: "Manta Point under the southern cliffs is a cleaning station where reef mantas circle in a few metres of water; Manta Bay next door is the feeding site.", rarityHint: "Near-guaranteed year-round; rough seas can cancel the trip."},
            {speciesSlug: "ocean-sunfish", whyItFits: "Mola come up from deep water to be cleaned by bannerfish at Crystal Bay and Blue Corner during the cool-water season.", rarityHint: "Seasonal, July to October; regular but not guaranteed, usually for divers."},
            {speciesSlug: "bali-myna", whyItFits: "Released by FNPF, Bali mynas now nest in the temple trees of Ped and Bodong villages on the north coast and feed in the gardens.", rarityHint: "Regular around Ped village; ask at the FNPF centre."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Turtles rest on the ledges of the Toyapakeh and SD drift reefs and graze off Gamat Bay.", rarityHint: "Near-guaranteed on north-coast dives and snorkels."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Hawksbills browse the sponge-covered walls at Crystal Bay and the Lembongan channel.", rarityHint: "Regular."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Small reef sharks hunt the shallows at Gamat Bay and the Crystal Bay drop-off.", rarityHint: "Common on morning dives."},
            {speciesSlug: "sea-krait", whyItFits: "Banded sea kraits hunt eels in the coral at Crystal Bay and rest in the cliff-base rocks, ignoring snorkellers.", rarityHint: "Regular at Crystal Bay; venomous but placid."},
            {speciesSlug: "humphead-parrotfish", whyItFits: "Bumphead parrotfish schools crunch along the Toyapakeh reef at dawn.", rarityHint: "Regular on early drift dives."},
            {speciesSlug: "napoleon-wrasse", whyItFits: "Big humphead wrasse patrol the walls at Crystal Bay and Blue Corner.", rarityHint: "Regular on current dives."},
            {speciesSlug: "clownfish", whyItFits: "Anemones line the shallow reef at Gamat Bay and the Lembongan mangrove channel.", rarityHint: "Guaranteed on snorkels."},
            {speciesSlug: "white-bellied-sea-eagle", whyItFits: "Sea eagles nest on the Kelingking and Banah cliffs and fish the manta bays below.", rarityHint: "Regular along the south cliffs."},
            {speciesSlug: "brahminy-kite", whyItFits: "Kites hang over the Toyapakeh and Sampalan harbours for fish scraps.", rarityHint: "Guaranteed on the north coast."},
            {speciesSlug: "sulphur-crested-cockatoo", whyItFits: "FNPF released lesser sulphur-crested cockatoos on Nusa Penida and a small flock survives in the dry forest near Ped, logged under this entry.", rarityHint: "Rare; a handful of birds around the north-coast villages."},
            {speciesSlug: "tokay-gecko", whyItFits: "Tokays bark from every guesthouse roof in Toyapakeh and Crystal Bay after dark.", rarityHint: "Heard nightly."}
        ],
        bestFor: [
            "Manta snorkelling at Manta Point and Manta Bay",
            "Mola diving at Crystal Bay in the cool season",
            "Bali myna watching at Ped village",
            "Drift diving the north-coast reefs"
        ],
        spottingTips: [
            "Book the first manta boat of the day from Toyapakeh or Crystal Bay; the swell and the crowds build after 9 am.",
            "Mola season is July to October when the water drops below 24 degrees; divers at 20 to 30 metres see them, snorkellers rarely do.",
            "Visit the FNPF centre at Ped for current Bali myna nest sites; the birds feed in gardens near the temple in the late afternoon.",
            "Stay out of the water at Kelingking and Angel's Billabong; the swell there has killed visitors and the mantas are elsewhere."
        ],
        relatedLocationSlugs: ["bali", "gili-islands", "lombok", "indonesia"],
        faq: [
            {question: "What wildlife is there in Nusa Penida?", answer: "Nusa Penida has reef manta rays year-round, ocean sunfish in the cool season, green and hawksbill turtles, blacktip reef sharks, sea kraits and bumphead parrotfish on its reefs, and reintroduced Bali mynas, sea eagles and kites on land."},
            {question: "What animals can be found in Nusa Penida?", answer: "Mantas at Manta Point and Manta Bay are the main draw and are seen on most trips. Turtles and reef fish fill the north-coast reefs, and the villages around Ped hold the island's Bali myna population."},
            {question: "When is the best time to see mola in Nusa Penida?", answer: "July to October, when cold upwellings bring ocean sunfish to the cleaning stations at Crystal Bay and Blue Corner. Divers have the best chance in the early morning."},
            {question: "Can you snorkel with mantas in Nusa Penida?", answer: "Yes. Manta Point is shallow enough for snorkellers and most boats from Toyapakeh, Crystal Bay and Nusa Lembongan run morning manta snorkel trips. Keep still at the surface and let the mantas pass beneath you."}
        ]
    },
    {
        slug: "bangka-belitung",
        name: "Bangka Belitung Islands",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "indonesia",
        coordinate: {lat: -2.55, lng: 106.6, zoom: 8},
        captureArea: {bbox: {north: -1.4, south: -3.3, east: 108.4, west: 105.1}},
        title: "Animals in Bangka Belitung: What You Can Spot, Learn, and Collect",
        description: "Bangka Belitung wildlife guide: Belitung's boulder beaches and reef fish, tarsiers and lutungs in the forest, mouse-deer, mangrove monitors and mudskippers.",
        searchIntents: [
            "animals in Bangka Belitung",
            "wildlife in Belitung",
            "what animals can be found in Bangka Belitung",
            "what wildlife is there in Belitung",
            "what animals can you see in Bangka island",
            "hewan di Bangka Belitung",
            "Belitung wildlife travel"
        ],
        quickAnswer: "Bangka and Belitung sit off south-east Sumatra and are known for granite boulder beaches and tin mines. Belitung has one of the last populations of the Horsfield's tarsier outside Borneo in its remaining forest, plus silvery lutungs, mouse-deer, slow lorises and pangolins, while the reefs around Lengkuas and Kepayang islands have clownfish, turtles and reef fish. Mangroves hold monitors, mudskippers and fiddler crabs, and village gardens the giant snails and weaver ants users log.",
        introduction: [
            "Belitung became famous through the film Laskar Pelangi and now has daily flights from Jakarta to Tanjung Pandan. The north-coast beaches at Tanjung Tinggi and Tanjung Kelayang, with their house-sized granite boulders, are the base for island-hopping boats.",
            "Bangka is bigger, more mined and less visited. Both islands have lost most of their lowland forest to tin and oil palm, but patches around Gunung Tajam on Belitung and Gunung Maras on Bangka keep the mammals going."
        ],
        whyItMatters: [
            "The Belitung tarsier population is isolated and threatened by forest loss and the pet trade; a few village-based night tours now show it responsibly.",
            "Tin dredging has left flooded craters across both islands, and coastal mining still damages reefs; the Lengkuas area is one of the healthier remaining stretches."
        ],
        animalsToSpot: [
            {speciesSlug: "silvery-lutung", whyItFits: "Grey leaf monkeys with orange infants move through the mangroves and forest patches of Belitung and Bangka, including near Tanjung Pandan.", rarityHint: "Fairly common in remaining forest and mangrove."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Macaques patrol the boulder beaches at Tanjung Tinggi and the mangroves along the Belitung coast roads.", rarityHint: "Guaranteed."},
            {speciesSlug: "lesser-mouse-deer", whyItFits: "Tiny mouse-deer tiptoe through the forest around Gunung Tajam and are seen on night walks with a torch.", rarityHint: "Uncommon; night walks near forest edge."},
            {speciesSlug: "slow-loris", whyItFits: "Sunda slow lorises hunt insects in Bangka's rubber and durian gardens at night, giving orange eyeshine to a torch.", rarityHint: "Rare; night spotlighting in orchards."},
            {speciesSlug: "sunda-pangolin", whyItFits: "Pangolins still occur in both islands' forest remnants and are occasionally found crossing plantation roads at night.", rarityHint: "Very rare and heavily poached."},
            {speciesSlug: "oriental-pied-hornbill", whyItFits: "Small hornbills fly between fig trees in the Belitung lowlands and around Gunung Maras on Bangka.", rarityHint: "Uncommon; forest edge in the early morning."},
            {speciesSlug: "water-monitor", whyItFits: "Monitors cruise the mangrove creeks at Tanjung Kelayang and the tin-mine lakes of Bangka.", rarityHint: "Common near water."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Turtles graze the seagrass off Kepayang island, where a small conservation centre protects nests.", rarityHint: "Regular around Kepayang; nesting in season."},
            {speciesSlug: "clownfish", whyItFits: "Anemones with clownfish fill the shallow reef off Lengkuas lighthouse island, the standard Belitung snorkel.", rarityHint: "Guaranteed at Lengkuas."},
            {speciesSlug: "mudskipper", whyItFits: "Mudskippers hop across the mangrove mud at low tide along the Belitung coast roads.", rarityHint: "Common at low tide."},
            {speciesSlug: "fiddler-crab", whyItFits: "Fiddler crabs wave from burrows on the mudflats behind every mangrove stand.", rarityHint: "Common at low tide."},
            {speciesSlug: "giant-african-land-snail", whyItFits: "Logged by AnimalDex users in Bangka Belitung; the introduced snail is out in numbers after every rain.", rarityHint: "Guaranteed after rain."},
            {speciesSlug: "asian-weaver-ant", whyItFits: "Weaver ants nest in the mango and rambutan trees of every Bangka garden and have been logged by users in the province.", rarityHint: "Guaranteed."},
            {speciesSlug: "brahminy-kite", whyItFits: "Kites patrol the fishing harbours at Tanjung Pandan and Muntok and the granite headlands.", rarityHint: "Common on the coast."}
        ],
        bestFor: [
            "Boulder-beach island hopping and Lengkuas snorkelling",
            "Night walks for tarsiers, lorises and mouse-deer",
            "Mangrove wildlife along the Belitung coast",
            "Quiet, uncrowded beginner birding"
        ],
        spottingTips: [
            "Island-hopping boats from Tanjung Kelayang stop at Lengkuas for snorkelling; go early before the day-trip crowd stirs up the sand.",
            "Ask homestays about tarsier night tours in the Belitung forest villages and insist on red torches and no handling.",
            "Mangrove boardwalks at low tide give mudskippers, fiddler crabs and monitors in one stop.",
            "The tin-mine lakes on Bangka attract monitors and herons but the water is not safe to swim in."
        ],
        relatedLocationSlugs: ["sumatra", "riau-islands", "jakarta", "indonesia"],
        faq: [
            {question: "What wildlife is there in Bangka Belitung?", answer: "Belitung and Bangka have Horsfield's tarsiers, silvery lutungs, macaques, mouse-deer, slow lorises and pangolins in their forest remnants, hornbills and kites overhead, and turtles, clownfish and reef fish around the offshore islets."},
            {question: "What animals can be found in Bangka Belitung?", answer: "On a typical trip you will see macaques and lutungs near the beaches, clownfish and reef fish at Lengkuas, mudskippers and fiddler crabs in the mangroves, and giant snails and weaver ants in the gardens. Tarsiers need a dedicated night tour."},
            {question: "Can you see tarsiers in Belitung?", answer: "Yes, with a local guide at night in the forest villages inland from Tanjung Pandan. The Belitung tarsier is a form of the Horsfield's tarsier and is nocturnal and shy, so sightings are brief."},
            {question: "Is Belitung good for snorkelling?", answer: "Yes for beginners. Lengkuas and Kepayang islands have shallow, calm reefs with clownfish, turtles and small reef fish, best in the dry season from March to October."}
        ]
    },
    {
        slug: "riau-islands",
        name: "Riau Islands",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "indonesia",
        coordinate: {lat: 0.95, lng: 104.4, zoom: 8},
        captureArea: {bbox: {north: 4.9, south: -1.0, east: 109.05, west: 103.3}},
        title: "Animals in the Riau Islands: What You Can Spot, Learn, and Collect",
        description: "Riau Islands wildlife guide: Bintan mangrove fireflies and otters, Batam macaques and monitors, hornbills, sea eagles, estuary crocodiles and Anambas reefs.",
        searchIntents: [
            "animals in the Riau Islands",
            "wildlife in Bintan",
            "what animals can be found in the Riau Islands",
            "what wildlife is there in Batam and Bintan",
            "what animals can you see in Kepulauan Riau",
            "hewan di Kepulauan Riau",
            "Bintan wildlife travel"
        ],
        quickAnswer: "The Riau Islands are the 1,700 islands between Singapore and Borneo, with Batam, Bintan and Tanjung Pinang as the hubs. Bintan's Sebung river mangroves give fireflies, smooth-coated otters, monitors and kingfishers by boat, Batam's forest remnants have macaques and hornbills, the estuaries hold saltwater crocodiles, and the remote Anambas and Natuna islands have the best reefs. Users in Kepulauan Riau mostly log tree sparrows, red junglefowl, house geckos and the rats and roaches of a busy port.",
        introduction: [
            "Batam is a factory and ferry city 45 minutes from Singapore; Bintan's north coast is a resort strip with golf courses and mangrove tours; Tanjung Pinang is the old Malay capital. Beyond them lie Lingga, Karimun and the far-flung Anambas and Natuna groups in the South China Sea.",
            "The islands have a Malaysian-style fauna of mangrove and secondary forest animals, and the mangrove rivers are where most of the easy wildlife is seen. Bintan's Sebung river firefly tour is the standard evening trip."
        ],
        whyItMatters: [
            "Mangroves around Bintan and Batam are being cleared for resorts, sand mining and reclamation, and they are the nursery for the fish, otters and crocodiles of the whole strait.",
            "Anambas was named one of Asia's top island groups and still has untouched reefs; its remoteness is the only protection it has."
        ],
        animalsToSpot: [
            {speciesSlug: "firefly", whyItFits: "The Sebung river mangroves on Bintan light up with synchronous fireflies after dark, seen from small boats out of Sebung village.", rarityHint: "Near-guaranteed on moonless, dry nights; book a Bintan mangrove firefly tour."},
            {speciesSlug: "smooth-coated-otter", whyItFits: "Otter families hunt the Sebung and Kawal river mouths on Bintan and the Batam mangroves at dawn.", rarityHint: "Uncommon; early mangrove boat trips."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Macaques raid the resort grounds at Lagoi and sit on the Batam ring road near Barelang bridge.", rarityHint: "Guaranteed."},
            {speciesSlug: "water-monitor", whyItFits: "Big monitors swim the Sebung river and the drains of Tanjung Pinang and Batam.", rarityHint: "Common near any water."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "Crocodiles live in the mangrove estuaries of Bintan and Batam, with sightings and occasional attacks around Barelang and the east Bintan rivers.", rarityHint: "Occasional; heed warning signs at river mouths."},
            {speciesSlug: "oriental-pied-hornbill", whyItFits: "Hornbills fly between fig trees at the Bintan Resorts forest and the Gunung Bintan foothills.", rarityHint: "Uncommon; mornings around Lagoi and Gunung Bintan."},
            {speciesSlug: "white-bellied-sea-eagle", whyItFits: "Sea eagles nest on tall trees along the Bintan north coast and fish the Riau strait.", rarityHint: "Regular on the coast and from ferries."},
            {speciesSlug: "brahminy-kite", whyItFits: "Kites scavenge over Batam's Nagoya waterfront and the Tanjung Pinang harbour.", rarityHint: "Guaranteed."},
            {speciesSlug: "red-junglefowl", whyItFits: "Wild chickens scratch at the edge of Bintan's secondary forest and have been logged by AnimalDex users in Kepulauan Riau.", rarityHint: "Fairly common in scrub and plantations."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The most-logged bird by users in Kepulauan Riau, nesting under the eaves of every Batam and Tanjung Pinang shophouse.", rarityHint: "Guaranteed."},
            {speciesSlug: "large-flying-fox", whyItFits: "Fruit bats roost in the mangroves of eastern Bintan and feed in the durian orchards at night.", rarityHint: "Regular at dusk in the east."},
            {speciesSlug: "mudskipper", whyItFits: "Mudskippers skitter across the mud at low tide on every Bintan and Batam mangrove boardwalk.", rarityHint: "Common at low tide."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Hawksbills nest on the Anambas and Natuna beaches and feed on the reefs off Bintan's north-east coast.", rarityHint: "Regular in Anambas; occasional off Bintan."},
            {speciesSlug: "common-house-gecko", whyItFits: "Logged by users across the province, the gecko of every Batam hotel wall and Bintan resort lamp.", rarityHint: "Guaranteed."}
        ],
        bestFor: [
            "Firefly boat trips on Bintan's Sebung river",
            "Mangrove kayaking for otters, monitors and kingfishers",
            "Easy wildlife on a weekend from Singapore",
            "Remote reef trips to Anambas and Natuna"
        ],
        spottingTips: [
            "Book the Sebung mangrove tour for the hour after sunset on a night with little moon; the fireflies are brightest in the dry months.",
            "Go out at dawn rather than at dusk if otters are the target; they hunt the river mouths on the rising tide.",
            "Do not swim at mangrove river mouths on Bintan or Batam; crocodiles are present and signs mean it.",
            "Anambas is reached by flight or overnight ferry from Tanjung Pinang; allow a week and expect basic homestays."
        ],
        relatedLocationSlugs: ["singapore", "sumatra", "bangka-belitung", "indonesia"],
        challengeSlugs: ["crocodile-vs-shark"],
        faq: [
            {question: "What wildlife is there in the Riau Islands?", answer: "Kepulauan Riau has mangrove wildlife: fireflies, smooth-coated otters, water monitors, saltwater crocodiles, mudskippers and kingfishers, plus macaques, hornbills, sea eagles and kites in the forest and on the coasts. The Anambas and Natuna islands have turtles and good reefs."},
            {question: "What animals can be found in the Riau Islands?", answer: "Everyday animals in Batam and Tanjung Pinang are tree sparrows, kites, macaques, geckos and red junglefowl. Bintan's mangroves add fireflies, otters, monitors and flying foxes, and the estuaries hold crocodiles."},
            {question: "Where can you see fireflies in Bintan?", answer: "The Sebung river mangroves on Bintan's north coast, about 20 minutes from the Lagoi resorts. Tours leave after sunset by small boat and the fireflies gather in the riverside trees, best on dark, dry nights."},
            {question: "Are there crocodiles in Batam and Bintan?", answer: "Yes. Saltwater crocodiles live in the mangrove estuaries of both islands and are seen around Barelang on Batam and the eastern rivers of Bintan. Avoid swimming or wading at river mouths."}
        ]
    },
    {
        slug: "togean-islands",
        name: "Togean Islands",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "sulawesi",
        coordinate: {lat: -0.4, lng: 121.9, zoom: 9},
        captureArea: {bbox: {north: 0.1, south: -0.8, east: 122.6, west: 121.3}},
        title: "Animals in the Togean Islands: What You Can Spot, Learn, and Collect",
        description: "Togean Islands wildlife guide: coconut crabs, Togean babirusa and knobbed hornbills, stingless jellyfish at Mariona lake, dugongs, turtles and reef sharks.",
        searchIntents: [
            "animals in the Togean Islands",
            "wildlife in the Togean Islands",
            "what animals can be found in the Togean Islands",
            "what wildlife is there in the Togean Islands",
            "what animals can you see in Togean",
            "hewan di Kepulauan Togean",
            "Togean Islands marine life"
        ],
        quickAnswer: "The Togeans are a scatter of forested islands in the middle of Tomini Gulf, Central Sulawesi, reached by slow ferry from Ampana or Gorontalo. They have coconut crabs on the beaches at night, the Togean babirusa and knobbed hornbills in the forest, a stingless jellyfish lake at Mariona on Togean island, and reefs with turtles, dugongs, reef sharks, bumphead parrotfish and some of the healthiest coral in Sulawesi.",
        introduction: [
            "Togean Islands National Park covers the whole archipelago: Batudaka, Togean, Talatakoh, Una Una and Walea Kodi, plus hundreds of islets. There is no mobile signal on most islands and electricity runs a few hours a night, which is the point.",
            "Homestays on Kadidiri, Bomba and Malenge run snorkel and dive trips to atoll walls, the B24 bomber wreck and the Una Una volcano reefs. Bajau sea-nomad villages sit on stilts over the shallows at Pulau Papan and Kabalutan."
        ],
        whyItMatters: [
            "The Togean babirusa is a separate species from the Sulawesi mainland babirusa and is Endangered, with a small population spread over a handful of islands.",
            "Tomini Gulf is the largest gulf in Indonesia and the Togean reefs have escaped much of the bleaching and blast fishing that hit Sulawesi's mainland coast."
        ],
        animalsToSpot: [
            {speciesSlug: "coconut-crab", whyItFits: "Robber crabs climb the coconut palms and raid homestay kitchens on Kadidiri and the smaller islets after dark.", rarityHint: "Regular at night on quieter islands; ask hosts where they still come out."},
            {speciesSlug: "babirusa", whyItFits: "The Togean babirusa, a smaller island species of the Sulawesi deer-pig, roots along the forest edge and beaches of Togean and Malenge islands at night, filed in AnimalDex under the babirusa entry.", rarityHint: "Rare; night walks and beach tracks on Malenge and Togean."},
            {speciesSlug: "knobbed-hornbill", whyItFits: "Red-knobbed hornbills fly between fruiting figs on Batudaka and Togean islands with heavy wingbeats and barking calls.", rarityHint: "Fairly common in forest; mornings."},
            {speciesSlug: "jellyfish", whyItFits: "Mariona lake on Togean island is a brackish lake of stingless jellyfish, one of only a handful in the world.", rarityHint: "Guaranteed in Mariona lake; swim without fins and sunscreen."},
            {speciesSlug: "dugong", whyItFits: "Dugongs graze the seagrass beds off Malenge and Walea Kodi and surface near the Bajau villages.", rarityHint: "Rare; Bajau fishermen sometimes know where one is feeding."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Turtles rest on the atoll walls off Kadidiri and nest on quiet Togean beaches.", rarityHint: "Near-guaranteed on dives and most snorkels."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Hawksbills pick at sponges on the walls at Una Una and the Pasir Tengah atoll.", rarityHint: "Regular."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Small reef sharks hunt the shallows at the Kadidiri jetty and the Pasir Tengah atoll lagoon.", rarityHint: "Common."},
            {speciesSlug: "humphead-parrotfish", whyItFits: "Schools of bumphead parrotfish graze the Una Una reefs below the active volcano.", rarityHint: "Regular at Una Una."},
            {speciesSlug: "napoleon-wrasse", whyItFits: "Big humphead wrasse hang on the atoll drop-offs at Pasir Tengah and the Apollo reef.", rarityHint: "Regular on wall dives."},
            {speciesSlug: "giant-trevally", whyItFits: "Trevally hunt in the current at Una Una's Apollo point and around the B24 wreck.", rarityHint: "Regular at Una Una."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "Crocodiles inhabit the mangrove channels of Togean and Batudaka islands; homestays warn against swimming near mangroves.", rarityHint: "Occasional; respect the mangrove warnings."},
            {speciesSlug: "fruit-bat", whyItFits: "Sulawesi's black flying foxes, not the large flying fox of the western islands, pour out of mangrove roosts near Bomba and Wakai at dusk.", rarityHint: "Regular at dusk."},
            {speciesSlug: "white-bellied-sea-eagle", whyItFits: "Sea eagles nest on the island headlands and fish the Tomini Gulf shallows around the Bajau villages.", rarityHint: "Regular from any boat."}
        ],
        bestFor: [
            "Stingless jellyfish swimming at Mariona lake",
            "Atoll-wall diving and snorkelling from Kadidiri",
            "Coconut crabs and babirusa on night beach walks",
            "Off-grid island time with turtles and reef sharks"
        ],
        spottingTips: [
            "Ferries from Ampana run on fixed days; plan a week so you can reach Malenge or Una Una as well as Kadidiri.",
            "Mariona jellyfish lake is a short boat and walk from Wakai; swim slowly and leave sunscreen off to protect the jellyfish.",
            "Coconut crabs come out an hour or two after dark; walk the back of the beach with a red torch and look at the base of the palms.",
            "The best coral is at Una Una and the atolls, where current brings trevally, sharks and parrotfish; book these as full-day trips."
        ],
        relatedLocationSlugs: ["sulawesi", "raja-ampat", "indonesia", "maluku"],
        challengeSlugs: ["octopus-vs-crab"],
        faq: [
            {question: "What wildlife is there in the Togean Islands?", answer: "The Togeans have coconut crabs, the endangered Togean babirusa, knobbed hornbills and flying foxes on land, a stingless jellyfish lake at Mariona, and reefs with green and hawksbill turtles, dugongs, blacktip reef sharks, bumphead parrotfish, napoleon wrasse and trevally."},
            {question: "What animals can be found in the Togean Islands?", answer: "From a homestay jetty you can see reef sharks, turtles and sea eagles. Night walks on the beach produce coconut crabs and occasionally babirusa, and dive trips to Una Una and the atolls add big reef fish and healthy coral."},
            {question: "Where is the jellyfish lake in the Togean Islands?", answer: "Mariona lake is on Togean island, near Wakai. It is a brackish lagoon with thousands of stingless jellyfish; homestays arrange boat trips and you can swim among them safely."},
            {question: "How do you get to the Togean Islands?", answer: "By ferry from Ampana in Central Sulawesi (several times a week) or the overnight ferry from Gorontalo to Wakai. Ampana is reached by road or flight from Palu or Luwuk. Allow a full week for the trip."}
        ]
    }
];

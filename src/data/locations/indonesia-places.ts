import type {LocationPageInput} from "@/data/location-types";

export const indonesiaPlaceLocationPages: LocationPageInput[] = [
    {
        slug: "east-java",
        name: "East Java",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "java",
        coordinate: {lat: -7.8, lng: 112.7, zoom: 8},
        captureArea: {bbox: {north: -5.5, south: -8.85, east: 114.5, west: 110.9}},
        title: "Animals in East Java: What You Can Spot, Learn, and Collect",
        description: "East Java wildlife guide: banteng and green peafowl on Baluran's savanna, nesting turtles at Sukamade, rusa deer under Bromo, kites and civets around Malang.",
        searchIntents: [
            "animals in East Java",
            "wildlife in East Java",
            "what animals can be found in East Java",
            "what wildlife is there in East Java",
            "hewan di Jawa Timur",
            "Baluran National Park animals",
            "East Java wildlife travel"
        ],
        quickAnswer: "East Java holds Java's best open-country wildlife. Baluran National Park puts banteng, rusa deer, green peafowl and wild boar on a savanna you can scan from a tower, Alas Purwo adds dholes and nesting turtles, Meru Betiri's Sukamade beach has green and olive ridley turtles most nights, and the Bromo highlands turn up lutung, leopard cat and rusa deer. Around Malang, Surabaya and Batu the common captures are macaques, kites, civets, porcupines and house geckos.",
        introduction: [
            "The province that most Java visitors cross on the way to Bromo is also the one with the most wildlife left in the open. Baluran, in the far north-east corner, is the only place on Java where you can stand on a viewing tower at dawn and count large mammals on grassland. Alas Purwo and Meru Betiri on the south coast protect long stretches of forest and turtle beach, and the Bromo Tengger Semeru highlands sit in the middle of it all.",
            "AnimalDex users have logged more wild and zoo captures in East Java than anywhere else in Indonesia. The roster below mixes the park flagships with the kites, civets, porcupines and garden birds that actually fill people's collections around Malang, Batu and Surabaya."
        ],
        whyItMatters: [
            "Baluran's savanna is the closest thing Java has to an African game drive, and banteng are now much easier to see there than they were a decade ago thanks to a programme that cleared invasive acacia from the grassland.",
            "The south coast turtle beaches, Sukamade above all, are among the few places in Indonesia where you can watch a green turtle nest with rangers rather than a crowd. Pairing one coastal night with a Baluran dawn is a complete trip."
        ],
        animalsToSpot: [
            {speciesSlug: "banteng", whyItFits: "Java's wild cattle graze the Bekol savanna in Baluran National Park, often with cattle egrets on their backs.", rarityHint: "Reliable from the Bekol tower at first light, especially in the dry season."},
            {speciesSlug: "javan-rusa-deer", whyItFits: "Herds of rusa cross Baluran's grassland every morning and smaller groups browse the Bromo highlands below Ranu Pani.", rarityHint: "Very likely in Baluran; regular at dusk around Bromo's grasslands."},
            {speciesSlug: "green-peafowl", whyItFits: "Baluran is the best place in Java to see wild green peafowl, which strut along the road to Bekol and call from the acacia edge.", rarityHint: "Common in Baluran and Alas Purwo; a frequent user capture in the province."},
            {speciesSlug: "dhole", whyItFits: "Packs of Asian wild dog hunt rusa in Baluran and Alas Purwo and are sometimes met on the park roads at dawn.", rarityHint: "Rare and lucky; look for them where deer are bolting."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Sukamade beach in Meru Betiri National Park is the province's main green turtle nesting site, patrolled nightly by rangers.", rarityHint: "Near-nightly between April and September; expect a long, dark wait."},
            {speciesSlug: "olive-ridley-sea-turtle", whyItFits: "The smaller turtle that also nests at Sukamade and on Alas Purwo's Ngagelan beach.", rarityHint: "Less frequent than green turtles; hatchling releases are common at dawn."},
            {speciesSlug: "bawean-deer", whyItFits: "A deer found nowhere on earth except Bawean, the island 120 km north of Gresik that belongs to this province.", rarityHint: "Very hard to see in the wild; a captive herd is kept on the island."},
            {speciesSlug: "silvery-lutung", whyItFits: "Black leaf monkeys with orange infants move through the forest at Alas Purwo and on the slopes above Bromo's sea of sand.", rarityHint: "Regular in Alas Purwo and the Semeru foothills if you listen for branches."},
            {speciesSlug: "brahminy-kite", whyItFits: "The chestnut-and-white kite patrols the Madura Strait, fish ponds and rice fields from Surabaya to Banyuwangi.", rarityHint: "One of the most-logged wild birds in the province."},
            {speciesSlug: "crested-serpent-eagle", whyItFits: "Calls over every forested slope from Coban Rondo to Baluran's hills and sits on roadside snags after rain.", rarityHint: "Common where forest meets open ground."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops haunt the waterfall car parks at Coban Rondo and Madakaripura and the forest edges of every park.", rarityHint: "Guaranteed at tourist waterfalls; keep bags closed."},
            {speciesSlug: "asian-palm-civet", whyItFits: "The civet behind Dampit and Bondowoso kopi luwak, crossing plantation roads at night.", rarityHint: "Nocturnal; realistic on evening drives through coffee country."},
            {speciesSlug: "malayan-porcupine", whyItFits: "Java's porcupine is the Sunda porcupine, filed here under its Malayan cousin; quills on the trail are the usual evidence in the Malang and Bromo highlands and the animal itself appears on night walks.", rarityHint: "Nocturnal and shy; a genuine user capture here."},
            {speciesSlug: "chital", whyItFits: "Not native, but Taman Safari Prigen's drive-through herd is where most East Java visitors photograph their first spotted deer.", rarityHint: "Captive only; guaranteed at Prigen."}
        ],
        bestFor: [
            "A Java 'safari' at Baluran's Bekol savanna",
            "Turtle nesting nights at Sukamade",
            "Highland birds and deer around Bromo and Semeru",
            "Zoo and safari park days near Malang and Pasuruan"
        ],
        spottingTips: [
            "Be on the Bekol tower in Baluran before 06:00; banteng and peafowl retreat into the acacia once the sun is up.",
            "Sukamade needs a 4x4 and a river crossing; arrive before dark, follow the ranger, and use only the red light they give you.",
            "Dry season (June to October) concentrates Baluran's mammals at the remaining waterholes and shortens the grass.",
            "Scan the Madura Strait bridges and fish ponds for brahminy kites; they are the easiest big bird to log from a car."
        ],
        relatedLocationSlugs: ["bromo-tengger-semeru", "malang-and-batu", "surabaya", "java"],
        rankingSlugs: ["rarest-animals"],
        faq: [
            {question: "What wildlife is there in East Java?", answer: "Banteng, rusa deer, green peafowl, wild boar and dholes on Baluran's savanna; nesting green and olive ridley turtles at Sukamade and Alas Purwo; lutung, leopard cat and rusa deer in the Bromo Tengger Semeru highlands; and brahminy kites, serpent eagles, civets and porcupines across farmland and forest edges."},
            {question: "What animals can be found in East Java?", answer: "The most-photographed wild animals in the province are brahminy kites, long-tailed macaques, green peafowl, rusa deer, civets, porcupines and house geckos. The flagships are banteng at Baluran, turtles at Sukamade and the Bawean deer on Bawean island."},
            {question: "When is the best time to visit Baluran for animals?", answer: "June to October. The grass is short, the waterholes shrink and banteng, rusa and peafowl are easy to see from the Bekol tower in the first hour of light."},
            {question: "Can I see turtles in East Java?", answer: "Yes. Sukamade in Meru Betiri National Park has ranger-led nesting walks most nights from April to September, with hatchling releases at dawn. Alas Purwo's Ngagelan beach runs a smaller hatchery."}
        ]
    },
    {
        slug: "central-java",
        name: "Central Java",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "java",
        coordinate: {lat: -7.2, lng: 110.2, zoom: 8},
        captureArea: {bbox: {north: -5.6, south: -8.3, east: 111.8, west: 108.7}, excludeBboxes: [{north: -7.5, south: -8.25, east: 110.85, west: 110.0}]},
        title: "Animals in Central Java: What You Can Spot, Learn, and Collect",
        description: "Central Java wildlife: Karimunjawa's turtles and reef sharks, surili and macaques on Merbabu, Semarang's mangrove monitors, barn owls over the paddies.",
        searchIntents: [
            "animals in Central Java",
            "wildlife in Central Java",
            "what animals can be found in Central Java",
            "what wildlife is there in Central Java",
            "hewan di Jawa Tengah",
            "Karimunjawa wildlife",
            "Central Java wildlife travel"
        ],
        quickAnswer: "Central Java is a province of farmland and volcanoes with wildlife at its edges. Karimunjawa, the island group off Jepara, has green turtles, blacktip reef sharks and clownfish on shallow reefs. Mount Merbabu and the Dieng plateau hold Javan surili, long-tailed macaques and junglefowl, Semarang's mangroves have water monitors and mudskippers, and the paddies around Borobudur and Demak are worked by pond herons, egrets and barn owls.",
        introduction: [
            "Most people come to Central Java for Borobudur and leave without noticing the animals around it. That is a shame, because the paddies that surround the temple are full of herons and swiftlets, the volcano forests above them still hold an endemic monkey, and two hours north the Karimunjawa islands have some of the most beginner-friendly reefs on Java.",
            "This is a page for travellers who want to add wildlife to a culture trip rather than build a trip around it. The roster leans on what users actually log here: junglefowl and bulbuls in the hills, mangrove reptiles on the Semarang coast, and reef life offshore."
        ],
        whyItMatters: [
            "Karimunjawa is a marine national park an overnight ferry from Semarang, and its sheltered reefs are shallow enough that a snorkeller sees turtles and reef sharks without a dive certificate.",
            "Central Java's rice farmers were among the first in Indonesia to put up barn owl boxes to control rats, so the province is an easy place to watch an owl work a paddy at dusk."
        ],
        animalsToSpot: [
            {speciesSlug: "green-sea-turtle", whyItFits: "Grazes the seagrass between Karimunjawa's islands and surfaces beside snorkel boats off Menjangan Kecil.", rarityHint: "Likely on any calm-day snorkel trip in the national park."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Patrols the reef flats of Karimunjawa and is kept in a shallow pen at Menjangan Besar where you can wade among them.", rarityHint: "Guaranteed in the pen; common but fast on the open reef."},
            {speciesSlug: "clownfish", whyItFits: "Anemones on Karimunjawa's inner reefs hold the orange-and-white fish every snorkeller is looking for.", rarityHint: "Very common in two to five metres of water."},
            {speciesSlug: "javan-surili", whyItFits: "The grey leaf monkey endemic to western and central Java survives on the forested slopes of Merbabu and Merapi.", rarityHint: "Uncommon; best on the Selo side of Merbabu at dawn."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops meet hikers on the Merbabu trail and hang around the Dieng plateau viewpoints.", rarityHint: "Common wherever trekkers eat."},
            {speciesSlug: "red-junglefowl", whyItFits: "The wild ancestor of the chicken crows from scrub on the volcano slopes and is a real user capture in the province.", rarityHint: "Heard often at dawn; seen crossing quiet tracks."},
            {speciesSlug: "sooty-headed-bulbul", whyItFits: "A chattering bulbul of hedges and village gardens across the Borobudur plain and the hill towns.", rarityHint: "Abundant and already logged by users here."},
            {speciesSlug: "javan-pond-heron", whyItFits: "Stands in every flooded paddy around Borobudur and Prambanan, flashing white when it lifts.", rarityHint: "Very common in the rice landscape."},
            {speciesSlug: "cattle-egret", whyItFits: "Follows buffalo and tractors through the Kedu plain's rice fields in loose flocks.", rarityHint: "Abundant on farmland."},
            {speciesSlug: "barn-owl", whyItFits: "Demak and Pati farmers put up nest boxes for the Javan barn owl to control rats; the birds hunt over the paddies at dusk.", rarityHint: "Realistic at dusk near villages with owl boxes."},
            {speciesSlug: "edible-nest-swiftlet", whyItFits: "The swiftlets whose nests are farmed in the concrete 'walet' houses you see all along the north coast road.", rarityHint: "Constant overhead in coastal towns."},
            {speciesSlug: "water-monitor", whyItFits: "Hunts the mangrove channels of Semarang's Mangunharjo and Tapak and the fish ponds of the north coast.", rarityHint: "Regular in mangroves; often seen swimming."},
            {speciesSlug: "mudskipper", whyItFits: "Skips across the mud at low tide in the Semarang and Pekalongan mangroves.", rarityHint: "Easy at low tide on any mangrove boardwalk."},
            {speciesSlug: "zebra-dove", whyItFits: "Feeds on dusty lanes and temple lawns from Borobudur to Solo.", rarityHint: "Abundant and approachable."}
        ],
        bestFor: [
            "Snorkelling with turtles and reef sharks at Karimunjawa",
            "Birds in the paddies around Borobudur",
            "Dawn monkey watching on Merbabu",
            "Mangrove reptiles and fish on the Semarang coast"
        ],
        spottingTips: [
            "Karimunjawa ferries from Jepara or Semarang run only a few days a week and stop in rough weather; build in a spare day.",
            "Walk the lanes around Borobudur at 06:00 before the temple opens; herons, egrets and swiftlets are all working the paddies then.",
            "On Merbabu, start the Selo trail before dawn and stop at the first forest band; surili are quiet and give themselves away by dropping leaves.",
            "Visit the Semarang mangroves on a falling tide so the mudflats and the mudskippers are exposed."
        ],
        relatedLocationSlugs: ["yogyakarta", "java", "east-java"],
        faq: [
            {question: "What wildlife is there in Central Java?", answer: "Reef life at Karimunjawa (green turtles, blacktip reef sharks, clownfish), Javan surili and macaques on the Merbabu and Merapi slopes, junglefowl and bulbuls in the hills, water monitors and mudskippers in the Semarang mangroves, and herons, egrets and barn owls over the rice plain."},
            {question: "What animals can be found in Central Java?", answer: "The animals users log most are red junglefowl, sooty-headed bulbuls, pond herons and the usual village geckos and ants. Karimunjawa adds turtles and sharks, and the volcano forests add the endemic Javan surili."},
            {question: "Is Karimunjawa worth it for wildlife?", answer: "Yes, for easy snorkelling: turtles, blacktip reef sharks and clownfish in shallow, sheltered water. Allow three nights because the ferry schedule is thin and weather-dependent."},
            {question: "Can you see animals around Borobudur?", answer: "Plenty of birds. The paddies and lanes around the temple hold pond herons, egrets, swiftlets, zebra doves and bulbuls, best in the first hour after sunrise."}
        ]
    },
    {
        slug: "yogyakarta",
        name: "Yogyakarta",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "java",
        coordinate: {lat: -7.8, lng: 110.37, zoom: 10},
        captureArea: {bbox: {north: -7.5, south: -8.25, east: 110.85, west: 110.0}},
        title: "Animals in Yogyakarta: What You Can Spot, Learn, and Collect",
        description: "Yogyakarta wildlife guide: cave bats and swiftlets in Gunung Kidul's karst, macaques on Merapi, hermit crabs and turtles on the south coast, Gembira Loka Zoo.",
        searchIntents: [
            "animals in Yogyakarta",
            "wildlife in Yogyakarta",
            "what animals can be found in Yogyakarta",
            "what wildlife is there in Yogyakarta",
            "hewan di Yogyakarta",
            "Gunung Kidul wildlife",
            "Yogyakarta wildlife travel"
        ],
        quickAnswer: "Yogyakarta's wildlife lives on its edges. The Gunung Kidul karst south-east of the city is riddled with caves full of bats and swiftlets, the Merapi slopes at Kaliurang have long-tailed macaques and forest birds, and the Parangtritis and Gunung Kidul coast has hermit crabs on every beach and olive ridley turtles at small community hatcheries. In town, geckos, garden lizards, weaver ants and pond herons in the Sleman paddies are the everyday captures.",
        introduction: [
            "Yogyakarta is a university city ringed by very different habitats: an active volcano to the north, a karst plateau to the south-east and a black-sand coast to the south. Each has its own animals, and all three are within ninety minutes of the kraton.",
            "Users here log small things most of all: mosquitoes, weaver ants, moths and a macaque at Kaliurang. This page takes that honest baseline and adds the caves, beaches and the city zoo that reward a planned half-day."
        ],
        whyItMatters: [
            "The Gunung Kidul caves, Jomblang and Goa Pindul among them, are the most accessible cave ecosystems on Java. Bats, swiftlets and cave invertebrates are part of the standard tour whether the operators advertise them or not.",
            "Yogyakarta is also a good place to think about captive wildlife honestly. Gembira Loka Zoo, in the city, has improved markedly and is the simplest way for a family to see an orangutan or a Komodo dragon in the region."
        ],
        animalsToSpot: [
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops roam the Kaliurang forest park on Merapi's southern slope and the viewpoint car parks above it.", rarityHint: "Likely at Kaliurang; a confirmed user capture in the province."},
            {speciesSlug: "fruit-bat", whyItFits: "Fruit bats and smaller insect bats roost in the Gunung Kidul caves and stream out at dusk over the karst villages.", rarityHint: "Guaranteed on a cave tour; spectacular at dusk from the cave mouths."},
            {speciesSlug: "edible-nest-swiftlet", whyItFits: "Nests on the walls of sea caves along the Gunung Kidul coast and in the vertical shaft at Jomblang.", rarityHint: "Common around karst cliffs and cave entrances."},
            {speciesSlug: "olive-ridley-sea-turtle", whyItFits: "Nests in small numbers on the beaches west of Parangtritis, where community hatcheries at Pelangi and Samas release hatchlings.", rarityHint: "Seasonal (roughly May to September); hatchling releases are easier than nesting."},
            {speciesSlug: "hermit-crab", whyItFits: "Covers the strandline of Indrayanti, Krakal and Drini beaches after dark, dragging borrowed shells across the sand.", rarityHint: "Very common on quiet beaches at night."},
            {speciesSlug: "javan-pond-heron", whyItFits: "Works the irrigated paddies of Sleman and Bantul that still surround the city's edges.", rarityHint: "Common in any wet field."},
            {speciesSlug: "cattle-egret", whyItFits: "Follows ploughing buffalo and tractors through the rice fields north of the airport road.", rarityHint: "Abundant on farmland."},
            {speciesSlug: "oriental-garden-lizard", whyItFits: "Sits on garden walls and campus hedges, the males flushing red-headed in the breeding season.", rarityHint: "Common in gardens and along lanes."},
            {speciesSlug: "tokay-gecko", whyItFits: "The big spotted gecko that barks from guesthouse rafters around Prawirotaman after dark.", rarityHint: "Heard nightly; seen with a torch on walls."},
            {speciesSlug: "common-house-gecko", whyItFits: "Patrols every lit wall in the city and is the first capture most visitors make.", rarityHint: "Guaranteed indoors at night."},
            {speciesSlug: "common-sun-skink", whyItFits: "Basks on temple stones at Prambanan and Ratu Boko and bolts into the grass when approached.", rarityHint: "Common on sunny stonework."},
            {speciesSlug: "asian-weaver-ant", whyItFits: "Builds leaf nests in the mango and rambutan trees of kampung gardens; a logged user capture here.", rarityHint: "Abundant in fruit trees."},
            {speciesSlug: "mosquito", whyItFits: "The most-logged animal in the province, which says something true about Yogyakarta evenings.", rarityHint: "Unavoidable; peak at dusk in the wet season."},
            {speciesSlug: "orangutan", whyItFits: "Gembira Loka Zoo in the east of the city keeps orangutans in one of its better enclosures.", rarityHint: "Captive only; guaranteed at Gembira Loka."}
        ],
        bestFor: [
            "Cave tours with bats and swiftlets in Gunung Kidul",
            "Night beachcombing on the south coast",
            "Temple-stone reptiles at Prambanan and Ratu Boko",
            "A family zoo day at Gembira Loka"
        ],
        spottingTips: [
            "Book Jomblang for the morning light shaft but stay for the bats; the vertical cave wakes up as the light fades.",
            "Gunung Kidul beaches are safest for night walks at low tide; the surf here is dangerous and lifeguards go home at dusk.",
            "Prambanan opens at 06:00; the sun skinks and garden lizards are out on the warm stone before the tour buses arrive.",
            "Turtle hatchery releases at Pelangi beach are announced locally; ask at your guesthouse rather than searching online."
        ],
        relatedLocationSlugs: ["central-java", "java", "east-java"],
        challengeSlugs: ["gorilla-vs-orangutan"],
        faq: [
            {question: "What wildlife is there in Yogyakarta?", answer: "Bats and swiftlets in the Gunung Kidul caves, long-tailed macaques at Kaliurang on Merapi, hermit crabs and seasonal olive ridley turtles on the south coast, and pond herons, egrets, garden lizards and geckos around the city."},
            {question: "What animals can be found in Yogyakarta?", answer: "Everyday captures are house geckos, tokay geckos, garden lizards, sun skinks, weaver ants and mosquitoes. Half-day trips add cave bats, swiftlets, macaques and beach crabs, and Gembira Loka Zoo adds orangutans and other large mammals."},
            {question: "Are the Gunung Kidul caves good for wildlife?", answer: "Yes. Jomblang, Pindul and the smaller caves hold large bat roosts and nesting swiftlets, and the dusk exodus from the cave mouths is the best wildlife moment in the region."},
            {question: "Is there a zoo in Yogyakarta?", answer: "Gembira Loka Zoo, in the east of the city, is a mid-sized zoo with orangutans, elephants, Komodo dragons and a bird collection. It is the easiest wildlife option for families with small children."}
        ]
    },
    {
        slug: "banten",
        name: "Banten",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "java",
        coordinate: {lat: -6.4, lng: 106.1, zoom: 8},
        captureArea: {bbox: {north: -5.9, south: -7.1, east: 106.72, west: 105.0}},
        title: "Animals in Banten: What You Can Spot, Learn, and Collect",
        description: "Banten wildlife guide: Javan rhino and banteng country at Ujung Kulon, sea eagles on the Anyer coast, whistling ducks in Tangerang and bird-park hornbills.",
        searchIntents: [
            "animals in Banten",
            "wildlife in Banten",
            "what animals can be found in Banten",
            "what wildlife is there in Banten",
            "hewan di Banten",
            "Tangerang animals",
            "Banten wildlife travel"
        ],
        quickAnswer: "Banten runs from Jakarta's western suburbs to the last Javan rhinos. Ujung Kulon National Park on the province's south-west tip protects rhinos, banteng, silvery gibbons, green peafowl and macaques. The Anyer and Carita coast has white-bellied sea eagles and brahminy kites, Tangerang's remaining wetlands hold whistling ducks and herons, and the bird parks and aquariums of South Tangerang account for most of the captures users log here, from wreathed hornbills to walking-leaf insects.",
        introduction: [
            "Banten is two provinces in one. The eastern third is Greater Jakarta: Tangerang's towers, toll roads and shrinking fish ponds. The western two thirds are quiet coast and hill country ending in Ujung Kulon, the peninsula that holds the only wild Javan rhinoceros left on earth.",
            "AnimalDex captures tell the same story. Around South Tangerang they are overwhelmingly captive: hornbills, parakeets, firebacks and insect-house leaf mimics. On the coast and in the parks they are wild: sea eagles, garden lizards, macaques and peafowl. This page covers both honestly."
        ],
        whyItMatters: [
            "Ujung Kulon is a UNESCO World Heritage site and the single most important place for the Javan rhinoceros. You will almost certainly not see one, but the forest, beaches and reefs around Peucang and Handeuleum are superb and the banteng and peafowl are real.",
            "Closer to the capital, Banten's bird parks are where Jakarta families meet Indonesian hornbills for the first time. Knowing which species are endemic to Java and which are from Sulawesi or Sumatra makes those visits more useful."
        ],
        animalsToSpot: [
            {speciesSlug: "javan-rhinoceros", whyItFits: "Ujung Kulon holds the entire wild population of roughly 80 animals in its lowland forest and swamps.", rarityHint: "Almost never seen; fresh footprints and wallows along the Cigenter river are the realistic goal."},
            {speciesSlug: "banteng", whyItFits: "Graze the Cidaon grazing ground opposite Peucang island at dawn and dusk.", rarityHint: "Reliable at Cidaon in the early morning with a ranger."},
            {speciesSlug: "silvery-gibbon", whyItFits: "The Javan gibbon's whooping dawn chorus carries across Ujung Kulon's Gunung Honje forests.", rarityHint: "Heard most mornings; seen with patience at Honje."},
            {speciesSlug: "green-peafowl", whyItFits: "Displays on the Cidaon and Cibunar grasslands of Ujung Kulon; also a frequent capture at the province's bird parks.", rarityHint: "Common in the park's open ground; guaranteed captive."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Raids campsites on Peucang island and loiters at the Carita waterfall car park.", rarityHint: "Guaranteed on Peucang; common at tourist sites."},
            {speciesSlug: "white-bellied-sea-eagle", whyItFits: "Hunts the Anyer and Carita shoreline and the Ujung Kulon reefs on broad upswept wings; a logged wild capture here.", rarityHint: "Regular along the west coast."},
            {speciesSlug: "brahminy-kite", whyItFits: "Works the Sunda Strait fishing harbours at Labuan and Karangantu and the fish ponds of north Tangerang.", rarityHint: "Common on the coast."},
            {speciesSlug: "lesser-whistling-duck", whyItFits: "Small flocks sit on Tangerang's remaining fish ponds and retention lakes and whistle as they fly over at dusk.", rarityHint: "Regular on suburban wetlands; a confirmed user capture."},
            {speciesSlug: "oriental-garden-lizard", whyItFits: "The default lizard on hedges and fences from Serpong to Serang; a real wild capture in the province.", rarityHint: "Very common in gardens."},
            {speciesSlug: "wreathed-hornbill", whyItFits: "The most-logged animal in Banten, thanks to the bird parks of South Tangerang where visitors photograph them at arm's length; wild pairs still cross the Ujung Kulon canopy.", rarityHint: "Guaranteed captive; wild birds are a real but uncommon sight over Ujung Kulon."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "Another bird-park staple here; the rare Javan subspecies survives in Ujung Kulon's tall forest but is seldom seen.", rarityHint: "Realistic only in captivity; wild Javan birds are very rare."},
            {speciesSlug: "straw-headed-bulbul", whyItFits: "Kept and bred at South Tangerang bird parks; the wild species has been trapped almost to extinction for its song.", rarityHint: "Captive only; a critically endangered songbird."},
            {speciesSlug: "walking-leaf", whyItFits: "Insect houses at the province's bird and butterfly parks show these leaf mimics up close; a logged user capture.", rarityHint: "Captive; look for them on the branch, not the floor."},
            {speciesSlug: "leopard-lacewing", whyItFits: "A common butterfly of Banten's gardens and forest edge that is also flown in the butterfly houses near Serpong.", rarityHint: "Common wild on sunny days; guaranteed captive."}
        ],
        bestFor: [
            "Rhino country trekking at Ujung Kulon",
            "Coastal raptors along Anyer and Carita",
            "Wetland birds on the edge of Greater Jakarta",
            "Family bird-park and aquarium days in South Tangerang"
        ],
        spottingTips: [
            "Ujung Kulon needs a permit from the park office in Labuan and a licensed guide; the Cidaon banteng walk from Peucang is the surest wildlife on the trip.",
            "On the Anyer coast, watch the headlands at mid-morning when the thermals start and sea eagles lift off the trees.",
            "Tangerang's whistling ducks sit on retention lakes inside new housing estates; scan them from the perimeter road at dusk.",
            "At bird parks, check the label before you log: most hornbills shown here are Sumatran, Bornean or Sulawesi species rather than Javan."
        ],
        relatedLocationSlugs: ["ujung-kulon", "jakarta", "west-java", "java"],
        rankingSlugs: ["rarest-animals"],
        challengeSlugs: ["rhinoceros-hornbill-vs-toco-toucan"],
        faq: [
            {question: "What wildlife is there in Banten?", answer: "Javan rhinoceros, banteng, silvery gibbon, green peafowl and macaques in Ujung Kulon National Park; white-bellied sea eagles and brahminy kites on the west coast; whistling ducks and herons on Tangerang's wetlands; and a wide captive collection of hornbills and songbirds in South Tangerang's bird parks."},
            {question: "What animals can be found in Banten?", answer: "Wild captures users log here include white-bellied sea eagles, brahminy kites, lesser whistling ducks, garden lizards and green peafowl. Captive captures dominate around Tangerang: wreathed, rhinoceros and knobbed hornbills, firebacks, parakeets and leaf insects."},
            {question: "Can you see a Javan rhino in Ujung Kulon?", answer: "Realistically no. Fewer than a hundred survive and they avoid people. Guided treks find footprints, wallows and dung along the Cigenter river, and the banteng, peafowl and gibbons are the sightings you can plan on."},
            {question: "Is Banten good for wildlife with children?", answer: "Yes, if you use the South Tangerang bird parks and aquariums for guaranteed close views, then add a coastal day at Anyer for sea eagles and rock pools."}
        ]
    },
    {
        slug: "bandung",
        name: "Bandung",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "west-java",
        coordinate: {lat: -6.9, lng: 107.6, zoom: 10},
        captureArea: {bbox: {north: -6.6, south: -7.2, east: 107.95, west: 107.3}},
        title: "Animals in Bandung: What You Can Spot, Learn, and Collect",
        description: "Bandung wildlife guide: macaques in the Juanda forest park, surili, slow loris and scops owls in the Lembang hills, Tangkuban Perahu birds and Bandung Zoo.",
        searchIntents: [
            "animals in Bandung",
            "wildlife in Bandung",
            "what animals can be found in Bandung",
            "what wildlife is there in Bandung",
            "hewan di Bandung",
            "Lembang wildlife",
            "Bandung wildlife travel"
        ],
        quickAnswer: "Bandung sits in a highland basin with forest on three sides. Taman Hutan Raya Djuanda, ten minutes above Dago, has long-tailed macaques, bulbuls and sunbirds; the Lembang and Parongpong hills hold Javan surili, slow loris and Sunda scops owls; and Tangkuban Perahu's crater forest adds highland birds. Bandung Zoo keeps Sumatran elephants and sun bears. The city itself is good for tree sparrows, garden lizards, stick insects and house geckos.",
        introduction: [
            "Bandung is cooler, wetter and greener than Jakarta, and its forests begin where the last housing estate ends. The Djuanda forest park above Dago is the obvious start, but the real interest is in the tea and pine country of Lembang, Cihideung and Parongpong, where users have logged a surprising mix of garden and forest animals.",
            "A wildlife day here is a short drive followed by a slow walk. Nothing is far, and the altitude means mornings are cool enough for birds and monkeys to stay active until mid-morning."
        ],
        whyItMatters: [
            "West Java's forests hold two endangered primates that are easy to miss unless you know they are there: the Javan surili and the Javan slow loris. The Lembang hills are among the most accessible places to look for both.",
            "Bandung is also a city where ordinary urban captures matter. Tree sparrows, stick insects and black ants photographed in Parongpong gardens make up a real part of the Indonesian record on AnimalDex."
        ],
        animalsToSpot: [
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops patrol the paths and Dutch tunnels of Taman Hutan Raya Djuanda and the Maribaya waterfall trail; a logged wild capture in the province.", rarityHint: "Near-guaranteed at Djuanda, especially around picnic spots."},
            {speciesSlug: "javan-surili", whyItFits: "Grey leaf monkeys persist in the forest remnants of Burangrang and Tangkuban Perahu north of Lembang.", rarityHint: "Uncommon; early morning on the Burangrang trail is the best chance."},
            {speciesSlug: "javan-slow-loris", whyItFits: "The Lembang and Ciwidey plantations are known loris habitat, and the animals cross bamboo and fruit trees at night.", rarityHint: "Nocturnal and rare; a red torch on a still night is the only method."},
            {speciesSlug: "sunda-scops-owl", whyItFits: "Calls from pines and garden trees in Parongpong and Cihideung after dark; a confirmed user capture in West Java.", rarityHint: "Heard most nights in the hills; seen with patience."},
            {speciesSlug: "sooty-headed-bulbul", whyItFits: "The noisy bulbul of Lembang's hedges, strawberry farms and the Djuanda forest edge.", rarityHint: "Abundant."},
            {speciesSlug: "olive-backed-sunbird", whyItFits: "Hangs upside-down in hibiscus and banana flowers in every Bandung garden.", rarityHint: "Common wherever there are flowers."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The brown sparrow of Bandung's cafés, markets and Parongpong rooftops; a frequent user capture here.", rarityHint: "Everywhere."},
            {speciesSlug: "oriental-garden-lizard", whyItFits: "Basks on fences and garden walls in Dago and Setiabudi through the midday heat.", rarityHint: "Common in gardens."},
            {speciesSlug: "common-house-gecko", whyItFits: "Patrols lamp-lit walls in every Bandung guesthouse once the evening cools.", rarityHint: "Guaranteed indoors."},
            {speciesSlug: "stick-insect", whyItFits: "Found on hedges and shrubs in the Cihideung flower nurseries; one of the province's more surprising logged captures.", rarityHint: "Easy to overlook; check shrubs at night with a torch."},
            {speciesSlug: "asian-weaver-ant", whyItFits: "Weaves leaf nests in the mango and guava trees of hillside kampungs.", rarityHint: "Abundant in fruit trees."},
            {speciesSlug: "black-ant", whyItFits: "The ant most people photograph in Bandung gardens, trailing across patios and up tree trunks.", rarityHint: "Everywhere."},
            {speciesSlug: "asian-elephant", whyItFits: "Bandung Zoo on Jalan Tamansari keeps Sumatran elephants in a central paddock.", rarityHint: "Captive only; guaranteed."},
            {speciesSlug: "sun-bear", whyItFits: "A sun bear at Bandung Zoo is the only way to see this species on Java, where it does not occur wild.", rarityHint: "Captive only."}
        ],
        bestFor: [
            "An easy forest-park walk with macaques above Dago",
            "Night walks for owls and loris in the Lembang hills",
            "Crater-edge birding at Tangkuban Perahu",
            "A compact city zoo visit"
        ],
        spottingTips: [
            "Enter Taman Hutan Raya Djuanda at opening time and walk toward Maribaya; the macaques are on the path before the weekend crowds.",
            "For scops owls and loris, stand still in a Parongpong or Cihideung garden after 20:00 and listen first; use a red light, never white.",
            "Tangkuban Perahu's crater rim is close to 2,000 m; bring a jacket and bird the forest edge on the walk down rather than the crater itself.",
            "Bandung's wet season afternoons are reliably rainy; do all your wildlife before noon."
        ],
        relatedLocationSlugs: ["west-java", "bogor", "jakarta", "java"],
        faq: [
            {question: "What wildlife is there in Bandung?", answer: "Long-tailed macaques in the Djuanda forest park, Javan surili and slow loris in the Lembang and Burangrang forests, Sunda scops owls in hillside gardens, bulbuls and sunbirds everywhere, and garden lizards, geckos, stick insects and ants in the city."},
            {question: "What animals can be found in Bandung?", answer: "The most-logged wild animals around Bandung are tree sparrows, black ants, house geckos, garden lizards, stick insects and macaques. Bandung Zoo adds elephants, sun bears and other large mammals."},
            {question: "Where can I see monkeys in Bandung?", answer: "Taman Hutan Raya Ir. H. Djuanda above Dago has a resident long-tailed macaque troop along the main path to the Dutch and Japanese tunnels. Javan surili are harder and need an early walk on Burangrang."},
            {question: "Is Bandung Zoo worth visiting?", answer: "It is a small, old city zoo with elephants, sun bears, deer and a bird collection. It is convenient for families but the forest park above Dago is the better wildlife experience."}
        ]
    },
    {
        slug: "surabaya",
        name: "Surabaya",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "east-java",
        coordinate: {lat: -7.26, lng: 112.75, zoom: 11},
        captureArea: {bbox: {north: -7.1, south: -7.45, east: 112.95, west: 112.55}},
        title: "Animals in Surabaya: What You Can Spot, Learn, and Collect",
        description: "Surabaya wildlife guide: macaques, monitors and mudskippers in the Wonorejo mangroves, brahminy kites over the Madura Strait, Komodo dragons at the zoo.",
        searchIntents: [
            "animals in Surabaya",
            "wildlife in Surabaya",
            "what animals can be found in Surabaya",
            "what wildlife is there in Surabaya",
            "hewan di Surabaya",
            "Wonorejo mangrove animals",
            "Surabaya wildlife travel"
        ],
        quickAnswer: "Surabaya is a port city with a working mangrove belt. The Wonorejo and Gunung Anyar mangroves on the east coast have long-tailed macaques, water monitors, mudskippers, fiddler crabs and roosting herons, and brahminy kites patrol the Madura Strait beside the Suramadu bridge. In the streets, Javan mynas, tree sparrows, house and tokay geckos are the daily captures. Surabaya Zoo, one of the oldest in the country, is known for its Komodo dragon breeding group.",
        introduction: [
            "Indonesia's second city is not a wildlife destination, but it has one habitat most big cities have lost: several kilometres of intact mangrove along its eastern shore. A boardwalk and boat trip at Wonorejo puts you among monkeys, monitors and herons within sight of apartment towers.",
            "The rest of Surabaya's wildlife is the honest urban kind, mynas on wires, geckos on walls, spiders in corners, and the city logs those in numbers. This page shows how to turn an afternoon in the mangroves and a zoo visit into a real list."
        ],
        whyItMatters: [
            "The Wonorejo mangroves are a migratory stopover on the East Asian flyway as well as a nursery for the Madura Strait fishery, and the city has protected them as an ecotourism zone rather than reclaiming them.",
            "Surabaya Zoo has a poor historical reputation but has been reformed under city management, and its Komodo dragon programme is one of the oldest in the world. It is a useful place to see the species outside its islands."
        ],
        animalsToSpot: [
            {speciesSlug: "long-tailed-macaque", whyItFits: "A wild troop lives in the Wonorejo mangroves and meets boats at the jetty.", rarityHint: "Near-guaranteed on a Wonorejo boat trip."},
            {speciesSlug: "water-monitor", whyItFits: "Swims the mangrove channels at Wonorejo and Gunung Anyar and basks on the mud at low tide.", rarityHint: "Regular; look along channel banks from the boat."},
            {speciesSlug: "mudskipper", whyItFits: "Skips over the exposed mud under the Wonorejo boardwalk at low tide.", rarityHint: "Abundant at low tide."},
            {speciesSlug: "fiddler-crab", whyItFits: "Thousands of males wave their single big claw on the mudflats beside the mangrove boardwalk.", rarityHint: "Abundant at low tide."},
            {speciesSlug: "little-egret", whyItFits: "Feeds in the shallow fish ponds between Wonorejo and the sea and roosts in the mangroves at dusk.", rarityHint: "Common."},
            {speciesSlug: "javan-pond-heron", whyItFits: "Hunts the pond edges and the last paddies along the eastern ring road.", rarityHint: "Common in wet ground."},
            {speciesSlug: "black-crowned-night-heron", whyItFits: "Roosts in the Wonorejo mangroves by day and flies out over the fish ponds at dusk with a hoarse croak.", rarityHint: "Regular at dusk."},
            {speciesSlug: "brahminy-kite", whyItFits: "Quarters the Madura Strait around the Suramadu bridge and the Kenjeran shoreline for dead fish.", rarityHint: "Common along the coast; a frequent user capture in the province."},
            {speciesSlug: "javan-myna", whyItFits: "Struts through the city's parks and car parks in pairs; a logged capture here.", rarityHint: "Abundant."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The sparrow of Surabaya's warungs, malls and station roofs.", rarityHint: "Everywhere."},
            {speciesSlug: "common-house-gecko", whyItFits: "Patrols every lit wall in the city after dark; the most-logged reptile in East Java.", rarityHint: "Guaranteed indoors."},
            {speciesSlug: "tokay-gecko", whyItFits: "Barks from older houses in Ampel and Peneleh and from hotel roof voids at night.", rarityHint: "Heard more than seen."},
            {speciesSlug: "komodo-dragon", whyItFits: "Surabaya Zoo has bred Komodo dragons for decades and keeps one of the largest captive groups in the world.", rarityHint: "Captive only; guaranteed at the zoo."},
            {speciesSlug: "asian-small-clawed-otter", whyItFits: "Surabaya Zoo's otter enclosure is where this species has been logged in the province.", rarityHint: "Captive only."}
        ],
        bestFor: [
            "A mangrove boardwalk and boat trip at Wonorejo",
            "Coastal raptors from the Kenjeran shore",
            "Everyday city captures: mynas, sparrows, geckos",
            "Komodo dragons at Surabaya Zoo"
        ],
        spottingTips: [
            "Go to Wonorejo on a falling tide in the late afternoon; the mud is exposed for crabs and mudskippers and the herons come in to roost.",
            "Take the boat to the river mouth rather than just walking the boardwalk; the monitors and macaques are along the channels.",
            "Kenjeran beach at dawn has brahminy kites and fishing boats with gulls and terns following them in.",
            "Surabaya Zoo is quietest on weekday mornings; the Komodo dragons are most active once the sun reaches their yards."
        ],
        relatedLocationSlugs: ["east-java", "malang-and-batu", "java"],
        challengeSlugs: ["komodo-dragon-vs-king-cobra"],
        faq: [
            {question: "What wildlife is there in Surabaya?", answer: "Long-tailed macaques, water monitors, mudskippers, fiddler crabs and roosting herons in the Wonorejo and Gunung Anyar mangroves; brahminy kites and egrets along the Madura Strait; and mynas, sparrows and geckos throughout the city."},
            {question: "What animals can be found in Surabaya?", answer: "Everyday captures are Javan mynas, tree sparrows, house geckos, tokay geckos and spiders. The mangroves add macaques, monitors and herons, and Surabaya Zoo adds Komodo dragons, otters and other large animals."},
            {question: "Where are the Wonorejo mangroves and how do I visit?", answer: "They are on the east coast of the city near Rungkut, about 30 minutes from the centre. There is a boardwalk and a small jetty with boats to the river mouth; go on a low afternoon tide."},
            {question: "Is Surabaya Zoo worth visiting?", answer: "For the Komodo dragons, yes. The zoo has improved under city management since 2013 and the dragon breeding group is one of the oldest anywhere, but it remains a traditional urban zoo."}
        ]
    },
    {
        slug: "malang-and-batu",
        name: "Malang and Batu",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "east-java",
        coordinate: {lat: -7.93, lng: 112.6, zoom: 10},
        captureArea: {bbox: {north: -7.65, south: -8.45, east: 112.85, west: 112.3}},
        title: "Animals in Malang and Batu: What You Can Spot, Learn, and Collect",
        description: "Malang and Batu wildlife guide: cassowaries and lories at Batu Secret Zoo, Coban Rondo's macaques, rusa deer and serpent eagles on the Bromo roads, civets.",
        searchIntents: [
            "animals in Malang",
            "wildlife in Malang and Batu",
            "what animals can be found in Malang",
            "what wildlife is there in Malang",
            "hewan di Malang",
            "Batu Secret Zoo animals",
            "Malang wildlife travel"
        ],
        quickAnswer: "Malang and the hill town of Batu are the single biggest cluster of AnimalDex captures in Indonesia, split between zoos and highland forest. Batu Secret Zoo at Jatim Park 2 is where most people log cassowaries, red lories, crested firebacks, wood owls and marabou storks. Outside, Coban Rondo's waterfall has long-tailed macaques, the Pujon forests have serpent eagles and yellow-vented bulbuls, the Bromo road has rusa deer and porcupines, and the coffee country toward Dampit has palm civets.",
        introduction: [
            "Malang is a university city at 450 m and Batu is its cool hill resort at 900 m, and between them they act as the base for Bromo, Semeru and the waterfall country of Pujon. They are also home to the most thorough zoo in East Java, which is why so many Indonesian captures on AnimalDex carry a Batu location.",
            "Treat the two as one destination. Spend a morning in the highland forest for wild birds and monkeys, an afternoon at the zoo for the species you will never see wild on Java, and keep a torch handy for porcupines and civets on the drive back."
        ],
        whyItMatters: [
            "Batu Secret Zoo is a modern zoo with a strong Indonesian bird collection, so it is an unusually good place to learn the difference between a Maluku lory, a Sumatran fireback and a Javan peafowl before you look for them in the wild.",
            "The forests above Batu and along the Bromo road are the last foothills before the national park, and they still hold rusa deer, porcupines, civets and raptors within an hour of a city of a million people."
        ],
        animalsToSpot: [
            {speciesSlug: "southern-cassowary", whyItFits: "Batu Secret Zoo's walk-through aviary section puts visitors a fence away from this New Guinea bird; it is the zoo's most-logged animal.", rarityHint: "Captive only; guaranteed at Jatim Park 2."},
            {speciesSlug: "red-lory", whyItFits: "The bright Maluku parrot that feeds from visitors' hands in Batu Secret Zoo's lory aviary.", rarityHint: "Captive only; a frequent user capture here."},
            {speciesSlug: "crested-fireback", whyItFits: "A Sumatran and Bornean forest pheasant shown in the zoo's pheasant walk, where its blue facial skin is easy to photograph.", rarityHint: "Captive only."},
            {speciesSlug: "brown-wood-owl", whyItFits: "Logged at the Batu zoos' nocturnal house; the wild species lives in tall highland forest on Java but is rarely seen.", rarityHint: "Captive is realistic; wild sightings on Semeru's slopes are exceptional."},
            {speciesSlug: "marabou-stork", whyItFits: "Stalks the African savanna section of Batu Secret Zoo and was logged there by users.", rarityHint: "Captive only."},
            {speciesSlug: "chital", whyItFits: "Taman Safari Prigen's drive-through, north of Malang, has a large herd of spotted deer that walk up to car windows.", rarityHint: "Captive only; guaranteed at Prigen."},
            {speciesSlug: "javan-rusa-deer", whyItFits: "Wild rusa graze the grassland around Ranu Pani and the Tumpang road into Bromo Tengger Semeru at dawn; a logged wild capture in the province.", rarityHint: "Regular at dawn and dusk above Tumpang."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "The Coban Rondo waterfall troop sits on the car park wall and picnic tables waiting for food.", rarityHint: "Guaranteed at Coban Rondo."},
            {speciesSlug: "yellow-vented-bulbul", whyItFits: "The bulbul of Batu's apple orchards and guesthouse gardens; a confirmed wild capture here.", rarityHint: "Abundant."},
            {speciesSlug: "crested-serpent-eagle", whyItFits: "Calls over the Pujon and Coban Rondo pine forest and perches on roadside snags after rain.", rarityHint: "Common on sunny mornings."},
            {speciesSlug: "malayan-porcupine", whyItFits: "The Sunda porcupine, filed here under its Malayan cousin, crosses the Tumpang and Pujon roads at night and leaves quills on forest trails; a logged user capture in East Java.", rarityHint: "Nocturnal; realistic on a late drive."},
            {speciesSlug: "asian-palm-civet", whyItFits: "The civet behind Dampit's kopi luwak, active at night in the coffee plantations south-east of Malang.", rarityHint: "Nocturnal; common but shy. Avoid caged 'coffee' civets."},
            {speciesSlug: "javan-pond-heron", whyItFits: "Works the terraced paddies between Malang and Tumpang all year.", rarityHint: "Common in wet fields."},
            {speciesSlug: "common-house-gecko", whyItFits: "The gecko on every homestay wall in Batu once the evening cools.", rarityHint: "Guaranteed indoors."}
        ],
        bestFor: [
            "The best zoo day in East Java at Batu Secret Zoo",
            "Waterfall macaques at Coban Rondo",
            "Dawn deer and raptors on the Bromo approach roads",
            "Night drives for porcupines and civets"
        ],
        spottingTips: [
            "Arrive at Batu Secret Zoo when it opens; the lory aviary and the cassowary paddock are quiet and the birds are active before the heat.",
            "The Tumpang to Ranu Pani road is best at first light for rusa deer; stop at the grassland pull-offs rather than driving through.",
            "At Coban Rondo, photograph the macaques from the car park and keep food packed; the troop is bold.",
            "If you want kopi luwak, choose a plantation that shows you free-ranging civet droppings rather than caged animals."
        ],
        relatedLocationSlugs: ["bromo-tengger-semeru", "east-java", "surabaya"],
        faq: [
            {question: "What wildlife is there in Malang and Batu?", answer: "Wild: long-tailed macaques at Coban Rondo, rusa deer and porcupines on the Bromo approach roads, serpent eagles and bulbuls in the Pujon forests, and palm civets in the coffee plantations. Captive: Batu Secret Zoo's cassowaries, lories, firebacks, owls and storks, and the drive-through herds at Taman Safari Prigen."},
            {question: "What animals can be found in Malang?", answer: "Users log more animals here than anywhere else in Indonesia, led by Batu Secret Zoo captures (cassowary, red lory, crested fireback, marabou stork) and wild highland species (rusa deer, porcupine, macaque, serpent eagle, yellow-vented bulbul)."},
            {question: "Is Batu Secret Zoo good for Indonesian wildlife?", answer: "Yes. Its bird collection is strong on Indonesian species from Maluku, Sulawesi, Sumatra and Papua, and the layout lets you see them closely, which makes later wild identification much easier."},
            {question: "Can I see wild animals near Malang without going to Bromo?", answer: "Yes. Coban Rondo has wild macaques, the Pujon pine forests have serpent eagles and bulbuls, and the Tumpang paddies have herons and egrets. A torch on the drive back often finds a porcupine."}
        ]
    },
    {
        slug: "bogor",
        name: "Bogor",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "west-java",
        coordinate: {lat: -6.6, lng: 106.8, zoom: 10},
        captureArea: {bbox: {north: -6.35, south: -6.95, east: 107.1, west: 106.55}},
        title: "Animals in Bogor: What You Can Spot, Learn, and Collect",
        description: "Bogor wildlife guide: the Botanical Gardens' flying fox roost, silvery gibbons in Gede Pangrango, Cisarua's slow loris, and Taman Safari's tigers and elephants.",
        searchIntents: [
            "animals in Bogor",
            "wildlife in Bogor",
            "what animals can be found in Bogor",
            "what wildlife is there in Bogor",
            "hewan di Bogor",
            "Taman Safari Bogor animals",
            "Bogor wildlife travel"
        ],
        quickAnswer: "Bogor is the wettest city on Java and its wildlife reflects that. The Botanical Gardens in the centre hold a famous large flying fox roost plus orioles, flamebacks and magpie-robins; Gede Pangrango National Park above Cibodas has silvery gibbons, Javan surili and macaques; the Cisarua tea country is slow loris habitat; and Taman Safari Indonesia at Cisarua is where most visitors photograph Sumatran tigers, elephants, sun bears and baboons.",
        introduction: [
            "An hour south of Jakarta, Bogor has been the capital's green escape since the Dutch built a palace and a botanical garden there. The garden is still the best urban wildlife site in Greater Jakarta: 87 hectares of old trees with a colony of flying foxes hanging over the ponds in daylight.",
            "Beyond the city the road climbs through Cisarua's tea estates to Puncak and the Gede Pangrango forest. Taman Safari Indonesia sits halfway up and dominates the local capture record, but the forest above it is where Java's endangered gibbon still sings."
        ],
        whyItMatters: [
            "Gede Pangrango is the oldest national park on Java and one of the last strongholds of the silvery gibbon, with a trail from Cibodas that gets you into gibbon forest within an hour's walk.",
            "Taman Safari Indonesia is the country's largest safari park and a serious conservation breeder of Sumatran tigers and elephants. Knowing which of its animals are Indonesian and which are not makes the drive-through more than a photo stop."
        ],
        animalsToSpot: [
            {speciesSlug: "large-flying-fox", whyItFits: "Hundreds roost in the tall trees of Bogor Botanical Gardens in daylight and stream out over the palace at dusk.", rarityHint: "Guaranteed in the gardens; best from the pond side in the late afternoon."},
            {speciesSlug: "silvery-gibbon", whyItFits: "Gede Pangrango's Cibodas trail enters gibbon forest within an hour; the dawn chorus carries across the valley.", rarityHint: "Heard most mornings; seen on perhaps one walk in three."},
            {speciesSlug: "javan-surili", whyItFits: "Small grey leaf monkeys forage along the Cibodas trail toward Cibeureum waterfall and above the Telaga Warna tea estates.", rarityHint: "Uncommon; quiet and easy to miss in the canopy."},
            {speciesSlug: "javan-slow-loris", whyItFits: "The Cisarua and Cipanas plantations are core loris habitat and the species is still trafficked from here, which is why a rescue centre works nearby.", rarityHint: "Nocturnal and rare; a red torch on a plantation edge is the only chance."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops meet walkers at the Cibodas gate and raid the Telaga Warna car park on the Puncak pass.", rarityHint: "Guaranteed at Cibodas and Telaga Warna."},
            {speciesSlug: "crested-serpent-eagle", whyItFits: "Circles the Gede Pangrango forest edge above Cibodas calling through the morning.", rarityHint: "Regular on sunny mornings."},
            {speciesSlug: "black-naped-oriole", whyItFits: "A yellow flash and a fluting whistle in the tall figs of the Botanical Gardens.", rarityHint: "Common in the gardens."},
            {speciesSlug: "dinopium-javanense", whyItFits: "The common flameback woodpecker works the old trunks of the Botanical Gardens and is heard long before it is seen.", rarityHint: "Regular in the gardens."},
            {speciesSlug: "oriental-magpie-robin", whyItFits: "Sings from the garden lawns at dawn and hops around the café tables for crumbs.", rarityHint: "Common in the gardens and city parks."},
            {speciesSlug: "water-monitor", whyItFits: "Hunts the Ciliwung river bank where it borders the Botanical Gardens and basks on the pond edges.", rarityHint: "Regular around the garden ponds."},
            {speciesSlug: "sumatran-tiger", whyItFits: "Taman Safari Indonesia at Cisarua breeds Sumatran tigers and shows them in the drive-through and the tiger house.", rarityHint: "Captive only; guaranteed."},
            {speciesSlug: "asian-elephant", whyItFits: "Taman Safari's Sumatran elephant herd is one of the largest captive groups in Indonesia.", rarityHint: "Captive only; guaranteed."},
            {speciesSlug: "sun-bear", whyItFits: "Logged by users in Taman Safari's bear section; the species survives wild on Sumatra and Borneo but not Java.", rarityHint: "Captive only."},
            {speciesSlug: "hamadryas-baboon", whyItFits: "The baboon troop in Taman Safari's drive-through climbs on cars and is the most-photographed primate on the route.", rarityHint: "Captive only; keep windows closed."}
        ],
        bestFor: [
            "A flying fox roost in the middle of a city",
            "Gibbon forest walks from Cibodas",
            "Garden birds for beginners in Kebun Raya Bogor",
            "Indonesia's biggest safari park at Cisarua"
        ],
        spottingTips: [
            "Enter the Botanical Gardens at 08:00 and head for the ponds; the flying foxes are visible all day but the birds are busiest early.",
            "For gibbons, be at the Cibodas gate when it opens and walk quietly uphill for the first hour; the chorus is loudest between 06:00 and 08:00.",
            "Bogor rains most afternoons year-round; plan every outdoor stop for the morning.",
            "At Taman Safari, drive the loop first thing and the baboon section with windows up; the animal shows later in the day are optional."
        ],
        relatedLocationSlugs: ["west-java", "jakarta", "bandung", "java"],
        rankingSlugs: ["rarest-animals"],
        challengeSlugs: ["tiger-vs-leopard"],
        faq: [
            {question: "What wildlife is there in Bogor?", answer: "Large flying foxes, orioles, flamebacks, magpie-robins and water monitors in the Botanical Gardens; silvery gibbons, Javan surili, macaques and serpent eagles in Gede Pangrango National Park; slow loris in the Cisarua plantations; and tigers, elephants, sun bears and baboons at Taman Safari Indonesia."},
            {question: "What animals can be found in Bogor?", answer: "The city's signature animal is the flying fox colony in Kebun Raya Bogor. Users also log macaques, monitors and garden birds wild, and tigers, elephants, sun bears and baboons at Taman Safari in Cisarua."},
            {question: "Can I see gibbons near Bogor?", answer: "Yes. Gede Pangrango National Park, entered at Cibodas about 90 minutes from Bogor, has silvery gibbons along the trail to Cibeureum waterfall. Start at dawn and listen for the chorus."},
            {question: "Is Taman Safari Bogor ethical?", answer: "It is a large, accredited safari park with breeding programmes for Sumatran tigers and elephants, and its animals have far more space than a city zoo. Skip the animal shows if that matters to you and focus on the drive-through."}
        ]
    },
    {
        slug: "north-sumatra",
        name: "North Sumatra",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "sumatra",
        coordinate: {lat: 2.5, lng: 98.9, zoom: 7},
        captureArea: {bbox: {north: 4.3, south: 0.9, east: 100.4, west: 97.0}},
        title: "Animals in North Sumatra: What You Can Spot, Learn, and Collect",
        description: "North Sumatra wildlife guide: Bukit Lawang's wild orangutans, Tapanuli orangutans in Batang Toru, Tangkahan elephants, siamang and hornbills, Lake Toba.",
        searchIntents: [
            "animals in North Sumatra",
            "wildlife in North Sumatra",
            "what animals can be found in North Sumatra",
            "what wildlife is there in North Sumatra",
            "hewan di Sumatera Utara",
            "Bukit Lawang animals",
            "North Sumatra wildlife travel"
        ],
        quickAnswer: "North Sumatra is the orangutan province. Bukit Lawang on the edge of Gunung Leuser National Park gives the most reliable wild Sumatran orangutan sightings anywhere, with Thomas's leaf monkeys, siamang, hornbills and macaques on the same trails. Tangkahan has a patrol herd of Sumatran elephants, the Batang Toru forest south of Lake Toba holds the Tapanuli orangutan, and the province's forests still shelter Sumatran tigers, sun bears and rhinoceros hornbills.",
        introduction: [
            "If a traveller sees one wild great ape in Asia it is probably here. The rehabilitated and wild orangutans around Bukit Lawang have made this stretch of the Bohorok river the most visited piece of rainforest in Sumatra, and the surrounding Gunung Leuser park is large enough to hold tigers, elephants and rhinos as well.",
            "North Sumatra is also bigger and more varied than the Bukit Lawang circuit. Lake Toba's highlands have their own birds, the Batang Toru forest south of the lake holds a great ape species only described in 2017, and Medan's zoo and parks account for the province's captive captures."
        ],
        whyItMatters: [
            "Two of the world's three orangutan species live only in this province and the neighbouring Aceh forests. The Tapanuli orangutan, with fewer than 800 individuals in Batang Toru, is the rarest great ape on earth.",
            "Bukit Lawang shows both the value and the cost of ape tourism. Choose guides who keep distance and never feed the animals; the orangutans that approach for fruit are the ones at risk."
        ],
        animalsToSpot: [
            {speciesSlug: "sumatran-orangutan", whyItFits: "The Bukit Lawang trails along the Bohorok river give the most reliable wild orangutan sightings in Asia, from semi-wild females to fully wild males.", rarityHint: "Very likely on a one-day trek; near-certain on two days."},
            {speciesSlug: "tapanuli-orangutan", whyItFits: "Found only in the Batang Toru forest south of Lake Toba, where a small research-based tourism effort is starting.", rarityHint: "Very rare and remote; a multi-day expedition with local guides."},
            {speciesSlug: "siamang", whyItFits: "The largest gibbon's booming duet rolls across the Bukit Lawang and Ketambe forests every morning.", rarityHint: "Heard daily; seen with patience in tall trees."},
            {speciesSlug: "asian-elephant", whyItFits: "Tangkahan's Conservation Response Unit keeps a patrol herd of Sumatran elephants that visitors bathe in the river; wild herds roam the park behind.", rarityHint: "Guaranteed with the CRU herd at Tangkahan; wild herds rarely seen."},
            {speciesSlug: "sumatran-tiger", whyItFits: "Gunung Leuser's lowland and hill forest is core tiger habitat, and camera traps around Bukit Lawang record them regularly.", rarityHint: "Almost never seen by visitors; tracks on river sand are the realistic find."},
            {speciesSlug: "sun-bear", whyItFits: "Claw marks on trees along the Bukit Lawang trails are common; a confirmed user capture in the province.", rarityHint: "Rarely seen in the wild; sign is easy, the bear is not."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "Pairs cross the Bohorok valley with loud wingbeats and nest in big fig trees above the river.", rarityHint: "Regular around Bukit Lawang on clear mornings."},
            {speciesSlug: "oriental-pied-hornbill", whyItFits: "The small hornbill of forest edge and village fruit trees around Bukit Lawang and Tangkahan; a logged wild capture here.", rarityHint: "Common on forest edges."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops wait at the Bukit Lawang bridges and tubing exits for dropped food.", rarityHint: "Guaranteed at Bukit Lawang."},
            {speciesSlug: "water-monitor", whyItFits: "Swims the Bohorok river below the guesthouses and basks on boulders at midday.", rarityHint: "Regular along the river."},
            {speciesSlug: "asian-weaver-ant", whyItFits: "Leaf nests in roadside fruit trees from Medan to the park boundary; a logged user capture in the province.", rarityHint: "Abundant."},
            {speciesSlug: "carpenter-ant", whyItFits: "Big black ants trail along logs and guesthouse beams at Bukit Lawang at night; a confirmed capture here.", rarityHint: "Common after dark in the forest."},
            {speciesSlug: "field-cricket", whyItFits: "The loudest night sound around Lake Toba's guesthouses and farmland; logged by users in the province.", rarityHint: "Heard every night; found under lights."},
            {speciesSlug: "black-ant", whyItFits: "The everyday ant of Medan gardens and Toba homestays that fills casual captures.", rarityHint: "Everywhere."}
        ],
        bestFor: [
            "Wild Sumatran orangutans at Bukit Lawang",
            "Elephant river-bathing at Tangkahan",
            "Gibbons, hornbills and macaques on rainforest trails",
            "Highland lake scenery and birds at Toba"
        ],
        spottingTips: [
            "Hire a licensed Bukit Lawang guide and insist on no feeding and a ten-metre distance; the best sightings come from waiting quietly under a fruiting tree.",
            "Two-day treks with a river-tube return see more wild orangutans than day trips, and the forest camps add night insects and frogs.",
            "Tangkahan elephant bathing happens mid-morning; arrive early and ask for the walk with the mahouts rather than riding.",
            "The dry months from February to August give clearer trails; the wettest period is October to December."
        ],
        relatedLocationSlugs: ["gunung-leuser", "sumatra", "indonesia"],
        rankingSlugs: ["smartest-animals", "rarest-animals"],
        challengeSlugs: ["gorilla-vs-orangutan", "dolphin-vs-orangutan-intelligence"],
        faq: [
            {question: "What wildlife is there in North Sumatra?", answer: "Sumatran orangutans, siamang, Thomas's leaf monkeys, macaques, hornbills and sun bears in Gunung Leuser National Park around Bukit Lawang; Sumatran elephants at Tangkahan; Tapanuli orangutans in Batang Toru; and tigers that are present but almost never seen."},
            {question: "What animals can be found in North Sumatra?", answer: "On the trails: Sumatran orangutans, siamang, long-tailed macaques, rhinoceros and oriental pied hornbills, water monitors and sun bear sign. Around towns and Lake Toba: weaver ants, carpenter ants, crickets and the usual geckos and sparrows."},
            {question: "Is Bukit Lawang the best place to see orangutans?", answer: "For reliability, yes. Most one-day treks see at least one orangutan and two-day treks often see several, including fully wild animals. Ketambe in Aceh is quieter and wilder but less predictable."},
            {question: "When is the best time to visit Bukit Lawang?", answer: "February to August is drier with better trail conditions. Fruiting seasons vary, and a good guide will know which trees are fruiting that week."}
        ]
    },
    {
        slug: "south-sumatra",
        name: "South Sumatra",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "sumatra",
        coordinate: {lat: -3.3, lng: 104.2, zoom: 7},
        captureArea: {bbox: {north: -1.6, south: -4.95, east: 106.3, west: 102.0}, excludeBboxes: [{north: -1.4, south: -3.15, east: 106.3, west: 105.1}]},
        title: "Animals in South Sumatra: What You Can Spot, Learn, and Collect",
        description: "South Sumatra wildlife guide: Sembilang's shorebirds and storks, crocodiles and false gharials in the peat rivers, otters on Palembang's Musi, garden insects.",
        searchIntents: [
            "animals in South Sumatra",
            "wildlife in South Sumatra",
            "what animals can be found in South Sumatra",
            "what wildlife is there in South Sumatra",
            "hewan di Sumatera Selatan",
            "Palembang wildlife",
            "South Sumatra wildlife travel"
        ],
        quickAnswer: "South Sumatra's wildlife is wetland wildlife. Sembilang National Park on the east coast is one of the most important shorebird sites in Asia, with tens of thousands of godwits and sandpipers, lesser adjutant storks and saltwater crocodiles in the mangroves. The Berbak-Sembilang peat swamps hold false gharials and a tiger population, the Musi river through Palembang has smooth-coated otters and monitors, and the city's gardens produce the butterflies, orb-weaver spiders and grasshoppers that fill users' logs.",
        introduction: [
            "Palembang is one of the oldest cities in Indonesia and sits on one of its widest rivers. The Musi is still the province's main road, and following it downstream takes you past fish ponds and mangroves to Sembilang, a national park most Indonesians have never heard of that is a world-class site for migratory shorebirds.",
            "Inland, South Sumatra is plantation and peat swamp. The peat rivers are difficult country for people and good country for crocodiles, false gharials and the tigers that still hold on in Berbak-Sembilang. Users in Palembang itself log the small stuff: butterflies, spiders, grasshoppers and tree sparrows."
        ],
        whyItMatters: [
            "Sembilang's mudflats host up to a hundred thousand migratory waders between September and April, including species that breed in Siberia and Alaska. It is one of the few places on Sumatra where birding is about numbers.",
            "The false gharial, a slender-snouted crocodilian found only in Southeast Asian peat swamps, still breeds in the Berbak-Sembilang rivers. Very few visitors have seen one, which is a reason to go rather than a reason not to."
        ],
        animalsToSpot: [
            {speciesSlug: "bar-tailed-godwit", whyItFits: "Flocks of thousands feed on Sembilang's mudflats on migration and in the northern winter.", rarityHint: "Abundant September to April on a boat trip to the flats."},
            {speciesSlug: "lesser-adjutant-stork", whyItFits: "Sembilang holds one of the largest breeding populations of this stork in Asia, nesting in mangrove and peat forest trees.", rarityHint: "Regular on the Sembilang mudflats and river edges."},
            {speciesSlug: "great-egret", whyItFits: "Lines the Musi's fish ponds and the Sembilang mangrove channels in loose white ranks.", rarityHint: "Common on any waterway."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "Patrols the Sembilang mangrove creeks and the lower Musi estuary; a genuine danger to fishermen here.", rarityHint: "Regular in the mangroves; never swim in brackish water."},
            {speciesSlug: "false-gharial", whyItFits: "The peat rivers of Berbak-Sembilang are one of the last breeding strongholds of this slender-snouted crocodilian.", rarityHint: "Very rare to see; night boat trips with a spotlight are the only realistic method."},
            {speciesSlug: "sumatran-tiger", whyItFits: "Berbak-Sembilang's swamp forest supports a small tiger population recorded on camera traps.", rarityHint: "Almost never seen."},
            {speciesSlug: "smooth-coated-otter", whyItFits: "Family groups fish the Musi and its tributaries at dawn, sometimes within sight of the Ampera bridge.", rarityHint: "Uncommon; best from a boat at first light."},
            {speciesSlug: "water-monitor", whyItFits: "Hauls out on the Musi's floating houses and fish-pond banks all along the river.", rarityHint: "Common along the river."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops live in the riverside trees of Kemaro island and the Musi's mangrove fringe.", rarityHint: "Common on river trips."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The sparrow of Palembang's markets and warungs; the province's most-logged bird.", rarityHint: "Everywhere."},
            {speciesSlug: "dingy-bushbrown", whyItFits: "A small brown butterfly of shaded gardens and plantation edges, logged by users in Palembang.", rarityHint: "Common in dappled shade."},
            {speciesSlug: "giant-golden-orb-weaver", whyItFits: "Strings metre-wide golden webs between trees on plantation and garden edges; a confirmed capture in the province.", rarityHint: "Common in the wet season."},
            {speciesSlug: "rice-grasshopper", whyItFits: "Fills the flooded paddies and wet grass around Palembang's outskirts; a logged user capture.", rarityHint: "Abundant in wet fields."},
            {speciesSlug: "field-cricket", whyItFits: "Chirps from every patch of waste ground in the city after dark; another real capture here.", rarityHint: "Heard nightly."}
        ],
        bestFor: [
            "Mass shorebird flocks at Sembilang",
            "River wildlife on the Musi by boat",
            "Crocodile and false gharial country in the peat swamps",
            "Garden insects and spiders around Palembang"
        ],
        spottingTips: [
            "Sembilang is reached by speedboat from Palembang or Sungsang; go with a local operator at a spring low tide between October and March for the biggest flocks.",
            "Hire a Musi river boat at dawn from Benteng Kuto Besak and head downstream past Kemaro; otters and monitors are out before the traffic.",
            "Peat-swamp rivers are crocodile water; stay in the boat and let the boatman spotlight the banks at night.",
            "Palembang's garden butterflies and orb-weavers are easiest after rain in the late afternoon when the sun returns."
        ],
        relatedLocationSlugs: ["sumatra", "lampung", "indonesia"],
        rankingSlugs: ["most-dangerous-animals"],
        challengeSlugs: ["tiger-vs-crocodile"],
        faq: [
            {question: "What wildlife is there in South Sumatra?", answer: "Huge migratory shorebird flocks, lesser adjutant storks, egrets and saltwater crocodiles in Sembilang National Park; false gharials and a small tiger population in the Berbak-Sembilang peat swamps; smooth-coated otters, monitors and macaques along the Musi river; and garden butterflies, spiders and grasshoppers around Palembang."},
            {question: "What animals can be found in South Sumatra?", answer: "Users in Palembang mostly log tree sparrows, dingy bushbrown butterflies, giant golden orb-weavers, rice grasshoppers and crickets. The wetlands add godwits, storks, egrets, crocodiles and otters."},
            {question: "How do I visit Sembilang National Park?", answer: "By boat from Palembang or the fishing town of Sungsang at the Musi mouth, typically a long day or an overnight trip arranged through a local guide. October to March brings the biggest shorebird numbers."},
            {question: "Are there crocodiles in the Musi river?", answer: "Saltwater crocodiles live in the lower Musi and the Sembilang mangroves, and attacks on fishermen do occur. In central Palembang they are rare, but treat all brackish water as crocodile habitat."}
        ]
    },
    {
        slug: "lampung",
        name: "Lampung",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "sumatra",
        coordinate: {lat: -5.0, lng: 105.0, zoom: 8},
        captureArea: {bbox: {north: -3.7, south: -5.95, east: 106.1, west: 103.8}},
        title: "Animals in Lampung: What You Can Spot, Learn, and Collect",
        description: "Lampung wildlife guide: Sumatran elephants and the rhino sanctuary at Way Kambas, tigers and tapirs in Bukit Barisan Selatan, spinner dolphins off Kiluan.",
        searchIntents: [
            "animals in Lampung",
            "wildlife in Lampung",
            "what animals can be found in Lampung",
            "what wildlife is there in Lampung",
            "hewan di Lampung",
            "Way Kambas animals",
            "Lampung wildlife travel"
        ],
        quickAnswer: "Lampung, at Sumatra's southern tip, has two of the island's great national parks. Way Kambas on the east coast is the place to see Sumatran elephants and the only place to see a Sumatran rhinoceros, at its sanctuary. Bukit Barisan Selatan in the west holds tigers, tapirs, siamang, sun bears and great argus pheasants. Kiluan bay on the south coast has dawn spinner dolphin trips, and the coast toward Krui has nesting green turtles.",
        introduction: [
            "Lampung is a short ferry from Java and feels like a different island. Transmigrant farmland covers the lowlands, but the two national parks that bracket the province still hold the full Sumatran large-mammal set: elephant, rhino, tiger, tapir and sun bear.",
            "Way Kambas is the easy park, flat and close to Bandar Lampung, with elephants you will see and a rhino sanctuary you can visit by arrangement. Bukit Barisan Selatan is the hard park, steep and wet, where the reward is pheasants, gibbons and tiger tracks rather than guaranteed sightings."
        ],
        whyItMatters: [
            "The Sumatran Rhino Sanctuary in Way Kambas is the only captive breeding facility for the species and has produced calves; the handful of animals there are the most important rhinos in Asia.",
            "Kiluan bay's spinner dolphin pods are among the largest regularly seen from the Sumatran coast, and the small fishing community runs the boats itself."
        ],
        animalsToSpot: [
            {speciesSlug: "asian-elephant", whyItFits: "Way Kambas has both wild herds in the swamp forest and a trained patrol herd at the Elephant Response Unit camps.", rarityHint: "Guaranteed at the camps; wild herds likely on evening drives in the dry season."},
            {speciesSlug: "sumatran-rhinoceros", whyItFits: "The Sumatran Rhino Sanctuary inside Way Kambas is the only place anywhere a visitor can see this species.", rarityHint: "Captive only, by prior arrangement with the sanctuary."},
            {speciesSlug: "sumatran-tiger", whyItFits: "Bukit Barisan Selatan and Way Kambas both hold tigers, with fresh pugmarks on the Way Kanan river sand a common find.", rarityHint: "Almost never seen; tracks are realistic."},
            {speciesSlug: "malayan-tapir", whyItFits: "Bukit Barisan Selatan's lowland forest around Sukaraja is one of the last strongholds of Sumatra's tapirs.", rarityHint: "Rare; night walks near salt licks are the method."},
            {speciesSlug: "siamang", whyItFits: "Booming duets fill the Bukit Barisan Selatan forest at dawn and can be heard from the Kubu Perahu trail.", rarityHint: "Heard daily in the western park; seen with patience."},
            {speciesSlug: "sun-bear", whyItFits: "Claw-scarred trees and torn termite nests line the trails in Bukit Barisan Selatan.", rarityHint: "Rarely seen; sign is common."},
            {speciesSlug: "great-argus", whyItFits: "The long-tailed pheasant's two-note call rings through the Bukit Barisan Selatan lowlands, and cleared dancing grounds show up on trails.", rarityHint: "Heard often; glimpsed occasionally crossing a path."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "Pairs commute over the Way Kanan river and the Sukaraja forest with wingbeats like a steam engine.", rarityHint: "Regular in both parks."},
            {speciesSlug: "lesser-adjutant-stork", whyItFits: "Stalks the open swamp grassland of Way Kambas, especially along the Way Kanan.", rarityHint: "Regular on boat trips at Way Kanan."},
            {speciesSlug: "crested-serpent-eagle", whyItFits: "Calls over Way Kambas's forest edge and sits on roadside snags after rain.", rarityHint: "Common."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops hang around the Way Kanan boat landing and the elephant camps.", rarityHint: "Guaranteed."},
            {speciesSlug: "spinner-dolphin", whyItFits: "Kiluan bay's fishermen run dawn boats to pods that often number in the hundreds.", rarityHint: "Very likely on a calm dawn between April and October."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Nests on the beaches of the Krui coast and the Lampung bay islands, where small hatcheries operate.", rarityHint: "Seasonal; hatchling releases are easier than nesting."},
            {speciesSlug: "water-monitor", whyItFits: "Swims the Way Kanan and basks on the banks below the boat landing.", rarityHint: "Regular along the river."}
        ],
        bestFor: [
            "Sumatran elephants at Way Kambas",
            "The only Sumatran rhinos a visitor can see",
            "Tough rainforest trekking in Bukit Barisan Selatan",
            "Dawn dolphin boats at Kiluan"
        ],
        spottingTips: [
            "Way Kambas is driest and best from June to October; book the Way Kanan boat and an evening drive through the grassland for wild elephants.",
            "Rhino sanctuary visits must be arranged in advance through the park and are limited; do not expect to turn up.",
            "In Bukit Barisan Selatan, base at Sukaraja or Kubu Perahu with a ranger guide and plan on sign and sound rather than sightings.",
            "Kiluan boats leave at 06:00 from the village; the sea is calmest from April to October."
        ],
        relatedLocationSlugs: ["way-kambas", "sumatra", "south-sumatra", "java"],
        rankingSlugs: ["rarest-animals", "biggest-animals"],
        challengeSlugs: ["elephant-vs-rhino"],
        faq: [
            {question: "What wildlife is there in Lampung?", answer: "Sumatran elephants, rhinos (at the sanctuary), tigers, tapirs, siamang, sun bears, great argus pheasants and hornbills in the Way Kambas and Bukit Barisan Selatan national parks; spinner dolphins off Kiluan bay; and nesting green turtles on the west coast."},
            {question: "What animals can be found in Lampung?", answer: "Realistic sightings are elephants, macaques, monitors, storks, serpent eagles and hornbills at Way Kambas, and dolphins at Kiluan. Tigers, tapirs and sun bears are present but usually known only from tracks and sign."},
            {question: "Can you see a Sumatran rhino in Lampung?", answer: "Only at the Sumatran Rhino Sanctuary inside Way Kambas, which holds a small breeding group in large forest enclosures. Visits are by prior arrangement and not guaranteed."},
            {question: "How do I get to Way Kambas?", answer: "It is about two hours by road from Bandar Lampung, which is a ferry and bus journey or a short flight from Jakarta. Simple homestays at Labuhan Ratu village sit right outside the park gate."}
        ]
    },
    {
        slug: "north-sulawesi",
        name: "North Sulawesi",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "sulawesi",
        coordinate: {lat: 1.3, lng: 124.9, zoom: 8},
        captureArea: {bbox: {north: 4.9, south: 0.2, east: 127.2, west: 123.5}},
        title: "Animals in North Sulawesi: What You Can Spot, Learn, and Collect",
        description: "North Sulawesi wildlife guide: Tangkoko's tarsiers and crested macaques, Bunaken's turtles and walls, Lembeh's mimic octopus, Sulawesi's endemic hornbills.",
        searchIntents: [
            "animals in North Sulawesi",
            "wildlife in North Sulawesi",
            "what animals can be found in North Sulawesi",
            "what wildlife is there in North Sulawesi",
            "hewan di Sulawesi Utara",
            "Manado wildlife",
            "North Sulawesi wildlife travel"
        ],
        quickAnswer: "North Sulawesi packs Wallacea's strangest animals into a small, well-connected area. Tangkoko reserve near Bitung has spectral tarsiers and crested black macaques within a short walk, Bunaken National Park off Manado has turtles, dugongs and reef walls, and the Lembeh Strait is the world capital of muck diving for mimic octopus, flamboyant cuttlefish and pygmy seahorses. Inland forests hold knobbed hornbills, babirusa and anoa, and the Minahasa farmland is full of weaver ants and finch-billed mynas.",
        introduction: [
            "Sulawesi sits east of Wallace's line, and North Sulawesi is where that matters most to a traveller. Its monkeys, hornbills, pigs and buffalo are found nowhere else, and most of them can be seen from one base at Manado or Bitung with a rental car and a boat.",
            "The province is also two of the best dive destinations in the world, Bunaken for walls and turtles and Lembeh for small, bizarre things on black sand. A week here splits naturally between forest mornings and reef afternoons."
        ],
        whyItMatters: [
            "The Celebes crested macaque is critically endangered and Tangkoko holds its best-protected population; sitting with a troop at dawn is one of the great primate experiences in Asia.",
            "Bunaken and Lembeh are an hour and a half apart by road yet show opposite marine worlds. Learning to look for a two-centimetre seahorse one day and a dugong the next changes how you see any reef afterwards."
        ],
        animalsToSpot: [
            {speciesSlug: "spectral-tarsier", whyItFits: "Family groups emerge from strangler-fig roosts in Tangkoko at dusk, calling in high duets before they hunt.", rarityHint: "Near-guaranteed at known roost trees with a ranger at dusk."},
            {speciesSlug: "celebes-crested-macaque", whyItFits: "Tangkoko's black, crested, punk-haired macaques forage along the beach forest in troops of fifty or more.", rarityHint: "Very likely on a morning walk in Tangkoko."},
            {speciesSlug: "knobbed-hornbill", whyItFits: "Sulawesi's big red-knobbed hornbill crashes into fruiting figs at Tangkoko and over the Tomohon highlands.", rarityHint: "Regular in Tangkoko; heard before seen."},
            {speciesSlug: "babirusa", whyItFits: "The curly-tusked 'deer-pig' of Sulawesi survives in Bogani Nani Wartabone National Park and the Nantu forest to the west.", rarityHint: "Rare; salt-lick hides at Nantu are the realistic chance."},
            {speciesSlug: "lowland-anoa", whyItFits: "Sulawesi's dwarf buffalo still lives in the forests of Bogani Nani Wartabone and the Minahasa highlands.", rarityHint: "Very rare; tracks and camera traps rather than sightings."},
            {speciesSlug: "finch-billed-myna", whyItFits: "Flocks of this Sulawesi-endemic starling nest in dead trees across the Minahasa farmland and Tangkoko's edge.", rarityHint: "Common in open country."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Grazes the shallows and rests on the ledges of Bunaken's reef walls, often several on a single dive.", rarityHint: "Near-guaranteed at Bunaken."},
            {speciesSlug: "dugong", whyItFits: "A few dugongs feed on the seagrass meadows around Bunaken and the Lembeh Strait.", rarityHint: "Rare and lucky; most often seen from the boat on calm mornings."},
            {speciesSlug: "mimic-octopus", whyItFits: "Lembeh's black-sand slopes are where this shape-shifting octopus was first filmed and remain the best place to find it.", rarityHint: "Regular with a Lembeh dive guide; impossible without one."},
            {speciesSlug: "flamboyant-cuttlefish", whyItFits: "Walks across Lembeh's sand on its arms flashing purple and yellow, a signature find of the strait.", rarityHint: "Regular on Lembeh muck dives."},
            {speciesSlug: "pygmy-seahorse", whyItFits: "Lives on gorgonian fans along the Bunaken walls and in Lembeh, where guides know the individual fans.", rarityHint: "Reliable with a guide who knows the fan."},
            {speciesSlug: "brahminy-kite", whyItFits: "Patrols the Manado waterfront, the Bitung harbour and every fishing village in between.", rarityHint: "Common on the coast."},
            {speciesSlug: "asian-weaver-ant", whyItFits: "Leaf nests in the clove and nutmeg trees of Minahasa; a logged user capture in the province.", rarityHint: "Abundant."},
            {speciesSlug: "ghost-ant", whyItFits: "The tiny pale-legged ant of Manado kitchens and guesthouses; a confirmed capture here.", rarityHint: "Common indoors."}
        ],
        bestFor: [
            "Tarsiers and crested macaques in one reserve",
            "Wall diving and turtles at Bunaken",
            "World-class macro and muck diving in Lembeh",
            "Endemic hornbills and mynas in the Minahasa highlands"
        ],
        spottingTips: [
            "Stay the night at Batu Putih so you can do Tangkoko's dawn macaque walk and the dusk tarsier roost on the same day.",
            "Bunaken's walls are best at the Lekuan sites on an incoming tide; Lembeh is a guide-led hunt, so pick a resort with experienced spotters.",
            "The Tomohon market sells wild meat including bats and pythons; it is a difficult but honest picture of the pressure on Sulawesi's wildlife.",
            "Dry season (May to October) gives clearer water and easier forest trails; Lembeh's critters are good year-round."
        ],
        relatedLocationSlugs: ["tangkoko", "bunaken", "sulawesi", "indonesia"],
        rankingSlugs: ["animals-with-best-camouflage", "smartest-animals"],
        challengeSlugs: ["cuttlefish-vs-octopus-intelligence", "octopus-vs-crab"],
        faq: [
            {question: "What wildlife is there in North Sulawesi?", answer: "Spectral tarsiers, Celebes crested macaques and knobbed hornbills at Tangkoko; babirusa and anoa in the western forests; green turtles, dugongs and pygmy seahorses at Bunaken; and mimic octopus and flamboyant cuttlefish in the Lembeh Strait."},
            {question: "What animals can be found in North Sulawesi?", answer: "On land, the endemic macaques, tarsiers, hornbills and finch-billed mynas are the realistic targets. Underwater, turtles are near-certain at Bunaken and the Lembeh muck sites produce octopus, cuttlefish, frogfish and seahorses on almost every dive."},
            {question: "Can you see tarsiers without diving or long treks?", answer: "Yes. Tangkoko is a 90-minute drive from Manado and the tarsier roost trees are a 20-minute flat walk from the entrance. Go with a ranger at dusk."},
            {question: "Bunaken or Lembeh for a first-time diver?", answer: "Bunaken. Its walls are clear, warm and full of turtles and big fish, which suits new divers. Lembeh rewards patience and a trained eye and is better once you know what you are looking for."}
        ]
    },
    {
        slug: "bunaken",
        name: "Bunaken National Park",
        regionType: "park",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "north-sulawesi",
        coordinate: {lat: 1.62, lng: 124.76, zoom: 11},
        captureArea: {bbox: {north: 1.85, south: 1.42, east: 124.95, west: 124.55}},
        title: "Animals in Bunaken National Park: What You Can Spot, Learn, and Collect",
        description: "Bunaken marine park guide: green and hawksbill turtles on the walls, pygmy seahorses on the fans, reef sharks, Napoleon wrasse, bumphead parrotfish, dugong.",
        searchIntents: [
            "animals in Bunaken",
            "wildlife in Bunaken National Park",
            "what animals can be found in Bunaken",
            "what wildlife is there in Bunaken",
            "Bunaken marine life",
            "Bunaken snorkelling animals",
            "Bunaken wildlife travel"
        ],
        quickAnswer: "Bunaken is a marine park of vertical reef walls off Manado, and its animals are reef animals. Green turtles are seen on almost every dive and snorkel, hawksbills are regular, pygmy seahorses live on the gorgonian fans, blacktip reef sharks patrol the shallows, and Napoleon wrasse and bumphead parrotfish cruise the drop-offs. The seagrass beds between the islands hold a few dugongs and sea kraits, and spinner dolphins cross Manado Bay on the boat ride out.",
        introduction: [
            "Five islands, 20 kilometres of coral wall dropping into water over a kilometre deep, and a half-hour boat ride from a provincial capital: Bunaken is one of the easiest world-class reefs to reach in Indonesia. Its walls are so sheer that snorkellers on the reef flat look straight down at divers on the wall below.",
            "The park's fame rests on turtles. Bunaken has some of the densest green turtle numbers in the region, and seeing six or eight on a single dive is normal rather than exceptional. Everything else on this page is a bonus to that baseline."
        ],
        whyItMatters: [
            "Bunaken was one of Indonesia's first marine parks and one of the first to fund itself with a visitor fee that goes to local villages and patrols. It is a working example of reef tourism paying for reef protection.",
            "The combination of wall diving, calm reef-flat snorkelling and short boat rides makes it a park where mixed-ability groups and families can all see turtles and sharks on the same day."
        ],
        animalsToSpot: [
            {speciesSlug: "green-sea-turtle", whyItFits: "Rests on ledges along the Lekuan and Fukui walls and grazes the reef flat under snorkellers; the park's signature animal.", rarityHint: "Near-guaranteed on every dive and most snorkels."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Picks at sponges on the wall at Mandolin and Siladen, distinguished by its hooked beak and serrated shell edge.", rarityHint: "Regular; expect one for every several green turtles."},
            {speciesSlug: "pygmy-seahorse", whyItFits: "Lives on pink and orange gorgonian fans on the Lekuan walls, where dive guides know the individual fans.", rarityHint: "Reliable with a guide; invisible without one."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Hunts the shallow reef flats off Bunaken village and Siladen at high tide.", rarityHint: "Regular for snorkellers at high tide; shy of divers."},
            {speciesSlug: "napoleon-wrasse", whyItFits: "Big, humped individuals patrol the drop-offs at Lekuan and Alung Banua.", rarityHint: "Regular on the walls, especially early morning."},
            {speciesSlug: "humphead-parrotfish", whyItFits: "Schools of these metre-long bumpheads crunch coral along the Mandolin and Fukui reef tops at dawn.", rarityHint: "Likely on early-morning dives."},
            {speciesSlug: "clownfish", whyItFits: "Every anemone on the reef flat has a family, and the shallow water makes them easy for snorkellers.", rarityHint: "Guaranteed."},
            {speciesSlug: "giant-clam", whyItFits: "Metre-wide clams with electric blue and green mantles sit in the shallows off Siladen.", rarityHint: "Common on the reef flats."},
            {speciesSlug: "moorish-idol", whyItFits: "Pairs and small groups drift along the wall tops at every site.", rarityHint: "Very common."},
            {speciesSlug: "bluestreak-cleaner-wrasse", whyItFits: "Runs cleaning stations on the wall where turtles and big wrasse queue to be picked clean.", rarityHint: "Guaranteed; watch the stations rather than the fish."},
            {speciesSlug: "ribbon-eel", whyItFits: "Blue-and-yellow males poke their heads from sand burrows at the base of the walls at Siladen and Timur.", rarityHint: "Regular with a guide who knows the burrows."},
            {speciesSlug: "sea-krait", whyItFits: "Banded sea kraits hunt the reef flats and come ashore on Bunaken's beaches to rest.", rarityHint: "Regular; venomous but placid, never handle."},
            {speciesSlug: "dugong", whyItFits: "A few dugongs graze the seagrass between Bunaken and Manado Tua and are occasionally met by boats.", rarityHint: "Rare and lucky; calm mornings give the best odds."},
            {speciesSlug: "spinner-dolphin", whyItFits: "Pods cross Manado Bay between the mainland and the park on most calm mornings.", rarityHint: "Likely from the dive boat on the way out."}
        ],
        bestFor: [
            "Turtle-dense wall dives",
            "Beginner-friendly reef-flat snorkelling",
            "Macro life on the gorgonian fans",
            "A quick marine park from a city base"
        ],
        spottingTips: [
            "Dive the Lekuan sites early; the bumphead parrotfish schools and Napoleon wrasse are on the wall before the day boats arrive.",
            "Snorkel the reef flat at high tide when the blacktip reef sharks come in over the coral.",
            "Ask your guide for the pygmy seahorse fans by name; every operator knows a few and they rarely move.",
            "Watch the water on the boat ride from Manado; spinner dolphins and, rarely, a dugong surface in the bay."
        ],
        relatedLocationSlugs: ["north-sulawesi", "tangkoko", "sulawesi"],
        rankingSlugs: ["biggest-animals"],
        challengeSlugs: ["crocodile-vs-shark"],
        faq: [
            {question: "What wildlife is there in Bunaken National Park?", answer: "Green and hawksbill turtles, blacktip reef sharks, Napoleon wrasse, bumphead parrotfish, pygmy seahorses, ribbon eels, giant clams, sea kraits and a huge range of reef fish along vertical coral walls. Dugongs and spinner dolphins are seen in the bay."},
            {question: "What animals can be found in Bunaken?", answer: "Turtles are the headline and are seen on almost every dive. Snorkellers also get clownfish, giant clams, Moorish idols and reef sharks on the shallow flats, and divers add pygmy seahorses and big wrasse on the walls."},
            {question: "Can you snorkel with turtles in Bunaken?", answer: "Yes. Green turtles rest on the wall tops at two to five metres and graze the reef flats, so snorkellers see them routinely at sites like Lekuan and Fukui."},
            {question: "When is the best time to dive Bunaken?", answer: "May to October has the calmest seas and best visibility. The park is diveable year-round, but December to February can bring wind and rain from the north."}
        ]
    },
    {
        slug: "tangkoko",
        name: "Tangkoko Nature Reserve",
        regionType: "park",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "north-sulawesi",
        coordinate: {lat: 1.55, lng: 125.18, zoom: 12},
        captureArea: {bbox: {north: 1.70, south: 1.45, east: 125.30, west: 125.08}},
        title: "Animals in Tangkoko Nature Reserve: What You Can Spot, Learn, and Collect",
        description: "Tangkoko guide: spectral tarsiers at dusk, Celebes crested macaques in the beach forest, knobbed hornbills in the figs, flying dragons and pythons.",
        searchIntents: [
            "animals in Tangkoko",
            "wildlife in Tangkoko Nature Reserve",
            "what animals can be found in Tangkoko",
            "what wildlife is there in Tangkoko",
            "Tangkoko tarsier",
            "Tangkoko macaques",
            "Tangkoko wildlife travel"
        ],
        quickAnswer: "Tangkoko is where Sulawesi's endemics are easiest. Spectral tarsiers emerge from strangler-fig roosts at dusk a short walk from the gate, troops of Celebes crested macaques forage along the beach forest at dawn, and knobbed hornbills feed in the fig trees overhead. Flying dragons, water monitors, reticulated pythons, sea eagles and a wealth of insects fill in the rest of a very productive day.",
        introduction: [
            "The reserve covers the lowland forest between the dormant Tangkoko volcano and a black-sand beach on the Molucca Sea, less than two hours from Manado. It is small, flat and crossed by well-kept trails, which is why it has become the standard place to see the animals that make Sulawesi different from the rest of Indonesia.",
            "Two sessions make a visit: a dawn walk with the macaques, and a dusk vigil at a tarsier tree. Both are led by local rangers from Batu Putih village, and both work almost every day of the year."
        ],
        whyItMatters: [
            "Tangkoko's crested macaques are the best-studied and best-protected population of a critically endangered primate, and the troops are habituated enough that you can sit among them without changing their behaviour.",
            "Alfred Russel Wallace collected here in 1859, and the reserve still shows the faunal break he described: the macaques and hornbills are Asian in origin, the cuscus is a marsupial from the Australian side, and none of them live on Java."
        ],
        animalsToSpot: [
            {speciesSlug: "spectral-tarsier", whyItFits: "Family groups roost in the hollows of strangler figs near the main trail and emerge at dusk with high-pitched duets.", rarityHint: "Near-guaranteed with a ranger at a known roost; be in place by 17:30."},
            {speciesSlug: "celebes-crested-macaque", whyItFits: "Troops of up to a hundred forage along the beach forest and the Batu Putih trail every morning, grooming and fighting at close range.", rarityHint: "Very likely on a dawn walk."},
            {speciesSlug: "knobbed-hornbill", whyItFits: "Feeds in the big fruiting figs along the main trail and nests in tree cavities the rangers monitor.", rarityHint: "Regular; heard crashing into the canopy."},
            {speciesSlug: "flying-dragon", whyItFits: "Draco lizards glide between trunks along the sunlit trail edges, flashing orange dewlaps.", rarityHint: "Common on sunny mornings if you watch tree trunks at eye level."},
            {speciesSlug: "reticulated-python", whyItFits: "Big pythons hunt the forest floor and the stream edges and are met occasionally on night walks.", rarityHint: "Uncommon; a real possibility after dark."},
            {speciesSlug: "water-monitor", whyItFits: "Patrols the stream that runs to the beach and basks on the black sand at midday.", rarityHint: "Regular around the stream mouth."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Surfaces off the reserve's beach and occasionally nests on the black sand.", rarityHint: "Occasional from the shore; nesting is rare."},
            {speciesSlug: "white-bellied-sea-eagle", whyItFits: "Patrols the shoreline below the volcano and perches on dead trees at the forest edge.", rarityHint: "Regular along the coast."},
            {speciesSlug: "brahminy-kite", whyItFits: "Hunts the beach and the Batu Putih fishing boats for scraps.", rarityHint: "Common."},
            {speciesSlug: "giant-golden-orb-weaver", whyItFits: "Strings huge golden webs across trail gaps; walk with a stick in front of your face.", rarityHint: "Abundant, especially in the wet season."},
            {speciesSlug: "stick-insect", whyItFits: "Found on night walks on shrubs along the trail, where torches catch them moving.", rarityHint: "Common after dark with a torch."},
            {speciesSlug: "cicada", whyItFits: "The reserve's dusk soundtrack, deafening in the half hour before the tarsiers emerge.", rarityHint: "Heard every evening."},
            {speciesSlug: "asian-weaver-ant", whyItFits: "Leaf nests in the beach-edge trees and the village fruit trees; a logged user capture in the province.", rarityHint: "Abundant."}
        ],
        bestFor: [
            "Tarsiers at dusk a short walk from the gate",
            "Sitting with habituated crested macaques",
            "Sulawesi's endemic hornbill",
            "Night walks for reptiles and insects"
        ],
        spottingTips: [
            "Sleep in Batu Putih; the macaque walk starts at 05:30 and the tarsier roost needs you in place before 17:30.",
            "Keep two metres from the macaques and do not make eye contact with the males; the rangers will tell you when to sit.",
            "Use red light at the tarsier tree and no flash; white light and flash make the animals stay inside.",
            "Add a night walk for pythons, stick insects and spiders; the rangers run them on request."
        ],
        relatedLocationSlugs: ["north-sulawesi", "bunaken", "sulawesi"],
        rankingSlugs: ["animals-with-best-eyesight"],
        challengeSlugs: ["python-vs-cobra"],
        faq: [
            {question: "What wildlife is there in Tangkoko Nature Reserve?", answer: "Spectral tarsiers, Celebes crested macaques, knobbed hornbills, bear cuscus, flying dragons, water monitors, reticulated pythons, sea eagles and kites, and a wealth of forest insects and spiders, all within a small lowland forest reserve on the coast."},
            {question: "What animals can be found in Tangkoko?", answer: "The two reliable headline species are the tarsier and the crested macaque, and almost every visitor sees both in a day. Hornbills, flying dragons and monitors are regular, pythons and cuscus are occasional."},
            {question: "How do I see the tarsiers?", answer: "Hire a ranger at the Batu Putih gate for the dusk walk. The roost trees are about 20 minutes along a flat trail, and the family emerges around 18:00. Red light only, no flash."},
            {question: "Is Tangkoko suitable for children?", answer: "Yes. The trails are flat and short, the macaques are habituated, and the tarsier vigil is an hour at most. Keep children close around the macaque troop and away from the males."}
        ]
    },
    {
        slug: "tanjung-puting",
        name: "Tanjung Puting National Park",
        regionType: "park",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "kalimantan",
        coordinate: {lat: -2.75, lng: 111.9, zoom: 10},
        captureArea: {bbox: {north: -2.5, south: -3.3, east: 112.3, west: 111.55}},
        title: "Animals in Tanjung Puting National Park: What You Can Spot, Learn, and Collect",
        description: "Tanjung Puting guide: Camp Leakey's orangutans, proboscis monkeys on the Sekonyer at dusk, hornbills from the klotok deck, crocodiles and fireflies.",
        searchIntents: [
            "animals in Tanjung Puting",
            "wildlife in Tanjung Puting National Park",
            "what animals can be found in Tanjung Puting",
            "what wildlife is there in Tanjung Puting",
            "Camp Leakey orangutans",
            "Sekonyer river wildlife",
            "Tanjung Puting wildlife travel"
        ],
        quickAnswer: "Tanjung Puting is the classic Bornean orangutan trip. From a slow klotok boat on the Sekonyer river you reach the feeding platforms at Tanjung Harapan, Pondok Tanggui and Camp Leakey, where rehabilitated and wild orangutans come in most afternoons. The river itself delivers proboscis monkeys in the trees at dusk, macaques, hornbills, kites, monitors, crocodiles and, after dark, trees full of fireflies.",
        introduction: [
            "Everything about Tanjung Puting happens from the water. You board a two-storey wooden klotok at Kumai, turn into the tea-coloured Sekonyer river and spend two or three days drifting between orangutan camps, eating and sleeping on the roof deck. The forest comes to the riverbank, which makes this the easiest serious wildlife trip in Kalimantan.",
            "Camp Leakey, founded in 1971, is the oldest orangutan research station in the world and still the best place to see big flanged males at close range. The feeding platforms are a managed experience; the proboscis monkeys, crocodiles and birds along the river are entirely wild."
        ],
        whyItMatters: [
            "The park protects over 4,000 km2 of peat swamp and heath forest and one of the largest wild orangutan populations anywhere, with released rehabilitants mixing into it over fifty years.",
            "The Sekonyer is also one of the best rivers in Borneo for proboscis monkeys, which are endemic to the island and gather in riverside trees every evening to sleep."
        ],
        animalsToSpot: [
            {speciesSlug: "bornean-orangutan", whyItFits: "Camp Leakey, Pondok Tanggui and Tanjung Harapan feeding platforms draw rehabilitated and wild orangutans most afternoons, including flanged males.", rarityHint: "Near-guaranteed over a two-day trip; fruiting seasons reduce platform visits."},
            {speciesSlug: "proboscis-monkey", whyItFits: "Harems settle into the riverside trees of the Sekonyer every evening and sit out in the open at dawn.", rarityHint: "Guaranteed at dusk from the klotok deck."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops forage on the riverbanks and raid the camp docks, swimming between trees when disturbed.", rarityHint: "Guaranteed."},
            {speciesSlug: "bornean-bearded-pig", whyItFits: "Wanders under the feeding platforms at Camp Leakey cleaning up dropped fruit.", rarityHint: "Likely at Camp Leakey."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "The lower Sekonyer and Kumai river are crocodile water, and big animals bask on the mud at low water.", rarityHint: "Occasional from the boat; never swim in the river."},
            {speciesSlug: "false-gharial", whyItFits: "The slender-snouted peat-swamp crocodilian lives in the upper Sekonyer and its black-water tributaries.", rarityHint: "Rare; spotlighting from the boat at night is the method."},
            {speciesSlug: "water-monitor", whyItFits: "Swims the river edges and climbs onto fallen logs beside the klotok.", rarityHint: "Regular."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "Pairs cross the river with loud wingbeats and feed in figs along the Sekonyer Kanan branch.", rarityHint: "Regular, especially early morning."},
            {speciesSlug: "oriental-pied-hornbill", whyItFits: "The small, noisy hornbill of the river edge and the camp clearings.", rarityHint: "Common."},
            {speciesSlug: "brahminy-kite", whyItFits: "Patrols the Kumai estuary and the lower river beside the klotok.", rarityHint: "Common."},
            {speciesSlug: "firefly", whyItFits: "Riverside trees along the Sekonyer light up with synchronised fireflies after dark, best seen with the boat engine off.", rarityHint: "Near-nightly in the dry season."},
            {speciesSlug: "large-flying-fox", whyItFits: "Streams over the river at dusk toward fruiting trees in the swamp forest.", rarityHint: "Regular at dusk."},
            {speciesSlug: "sun-bear", whyItFits: "Claw marks on trees around the camps are common and the bears occasionally raid the platforms.", rarityHint: "Rare to see; sign is easy."},
            {speciesSlug: "sunda-clouded-leopard", whyItFits: "Present in the park's forest and photographed by camera traps near Camp Leakey.", rarityHint: "Almost never seen."}
        ],
        bestFor: [
            "Big male orangutans at Camp Leakey",
            "Proboscis monkeys from a boat deck at dusk",
            "River birds, monitors and crocodiles without walking",
            "Firefly trees after dark"
        ],
        spottingTips: [
            "Book a three-day klotok so you reach all three feeding platforms and have a full dusk and dawn on the upper river.",
            "Sit on the roof deck with binoculars from 16:30; proboscis monkeys settle in the riverside trees before sunset.",
            "Ask the crew to cut the engine and drift at night for fireflies and to spotlight the banks for crocodiles.",
            "Dry season (June to September) has more orangutans at the platforms and clearer skies; wet season can flood the trails."
        ],
        relatedLocationSlugs: ["kalimantan", "borneo", "indonesia"],
        rankingSlugs: ["smartest-animals"],
        challengeSlugs: ["gorilla-vs-orangutan", "chimpanzee-vs-orangutan"],
        faq: [
            {question: "What wildlife is there in Tanjung Puting National Park?", answer: "Bornean orangutans at three feeding platforms, proboscis monkeys and macaques along the Sekonyer river, bearded pigs, water monitors, saltwater crocodiles and false gharials, rhinoceros and pied hornbills, kites, flying foxes and fireflies. Sun bears and clouded leopards are present but rarely seen."},
            {question: "What animals can be found in Tanjung Puting?", answer: "Orangutans and proboscis monkeys are near-certain on a two-day trip. Macaques, monitors, hornbills and kites are daily, crocodiles are occasional, and fireflies light the riverbank trees most dry-season nights."},
            {question: "How do I visit Tanjung Puting?", answer: "Fly to Pangkalan Bun, transfer to Kumai and board a klotok houseboat with crew, cook and guide. Two nights is the minimum to reach Camp Leakey; three is better."},
            {question: "Are the orangutans wild?", answer: "Both. The feeding platforms attract released rehabilitants and their descendants, and wild orangutans also visit, especially when wild fruit is scarce. Flanged males at Camp Leakey are often fully wild."}
        ]
    },
    {
        slug: "way-kambas",
        name: "Way Kambas National Park",
        regionType: "park",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "lampung",
        coordinate: {lat: -4.93, lng: 105.75, zoom: 10},
        captureArea: {bbox: {north: -4.6, south: -5.25, east: 106.0, west: 105.5}},
        title: "Animals in Way Kambas National Park: What You Can Spot, Learn, and Collect",
        description: "Way Kambas guide: wild and patrol-herd Sumatran elephants, the world's only Sumatran rhino sanctuary, tiger tracks, storks and hornbills on the Way Kanan.",
        searchIntents: [
            "animals in Way Kambas",
            "wildlife in Way Kambas National Park",
            "what animals can be found in Way Kambas",
            "what wildlife is there in Way Kambas",
            "Way Kambas elephants",
            "Sumatran rhino sanctuary Way Kambas",
            "Way Kambas wildlife travel"
        ],
        quickAnswer: "Way Kambas is Sumatra's flat, accessible big-mammal park. Sumatran elephants are the certainty, both the trained patrol herd at the Elephant Response Unit camps and wild herds in the swamp grassland. The Sumatran Rhino Sanctuary inside the park is the only place a visitor can see the species. Tigers and tapirs are present but known from tracks, while the Way Kanan river gives storks, hornbills, macaques, monitors and sambar deer from a boat.",
        introduction: [
            "The park occupies 1,300 km2 of lowland swamp forest and grassland on Lampung's east coast, two hours from Bandar Lampung. Logging and fire flattened much of it before protection, and the result is unusually open country for Sumatra, which is why elephants and deer are easier to see here than in the hill parks.",
            "Way Kambas is also a place to see conservation at work. The Elephant Response Units keep wild herds out of crops, the rhino sanctuary is breeding the rarest large mammal in Asia, and the Way Kanan research station monitors tigers that nobody will ever meet on foot."
        ],
        whyItMatters: [
            "The Sumatran Rhino Sanctuary has produced the only captive-born Sumatran rhinos in Asia and holds most of the species' managed population; a visit, where permitted, is a look at a species with fewer than 50 animals left.",
            "Human-elephant conflict is the defining problem on this coast, and the patrol herds here are the model that other Sumatran parks have copied."
        ],
        animalsToSpot: [
            {speciesSlug: "asian-elephant", whyItFits: "Wild herds graze the Way Kambas swamp grassland at dusk and the Elephant Response Unit camps keep trained Sumatran elephants that visitors walk with.", rarityHint: "Guaranteed at the camps; wild herds likely on dry-season evening drives."},
            {speciesSlug: "sumatran-rhinoceros", whyItFits: "The Sumatran Rhino Sanctuary's forest enclosures hold a small breeding group, the only viewable Sumatran rhinos anywhere.", rarityHint: "Captive, by prior arrangement only."},
            {speciesSlug: "sumatran-tiger", whyItFits: "Way Kambas holds a monitored tiger population and fresh pugmarks on the Way Kanan sandbanks are a common find.", rarityHint: "Almost never seen; tracks are realistic."},
            {speciesSlug: "malayan-tapir", whyItFits: "Tapirs use the swamp forest trails around Way Kanan and leave distinctive three-toed prints.", rarityHint: "Rare; night walks near wallows give a slim chance."},
            {speciesSlug: "siamang", whyItFits: "Duets from the taller forest behind Way Kanan carry across the river at dawn.", rarityHint: "Heard most mornings; seen occasionally."},
            {speciesSlug: "lesser-adjutant-stork", whyItFits: "Stalks the Way Kanan river margins and the open swamp grassland.", rarityHint: "Regular on boat trips."},
            {speciesSlug: "crested-fireback", whyItFits: "Pairs scratch along the forest trails near Way Kanan at first light.", rarityHint: "Regular on quiet early walks."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "Crosses the Way Kanan river with heavy wingbeats and feeds in riverside figs.", rarityHint: "Regular."},
            {speciesSlug: "oriental-pied-hornbill", whyItFits: "The common hornbill of the forest edge around the camps and the park road.", rarityHint: "Common."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops at the Way Kanan landing and the elephant camps.", rarityHint: "Guaranteed."},
            {speciesSlug: "sambar-deer", whyItFits: "Steps out onto the swamp grassland and the park road at dusk.", rarityHint: "Likely on evening drives."},
            {speciesSlug: "wild-boar", whyItFits: "Rootles along the park road and the grassland edge, often in family groups.", rarityHint: "Common at dusk."},
            {speciesSlug: "water-monitor", whyItFits: "Swims the Way Kanan and basks on the banks below the research station.", rarityHint: "Regular."},
            {speciesSlug: "large-flying-fox", whyItFits: "Streams out over the swamp forest at dusk from roosts along the river.", rarityHint: "Regular at dusk."}
        ],
        bestFor: [
            "Sumatran elephants, wild and at the response units",
            "The only Sumatran rhinos a visitor can see",
            "River boat trips for storks, hornbills and deer",
            "Tiger country you can actually reach by road"
        ],
        spottingTips: [
            "Come between June and October; the grassland dries, the wild elephants gather at remaining water and the roads are passable.",
            "Book the Way Kanan boat for early morning and an open-vehicle drive for the last two hours of light.",
            "Arrange any rhino sanctuary visit weeks ahead through the park; access is limited and never guaranteed.",
            "Stay at a Labuhan Ratu homestay by the gate so you can be inside the park before dawn."
        ],
        relatedLocationSlugs: ["lampung", "sumatra", "indonesia"],
        rankingSlugs: ["rarest-animals", "biggest-animals"],
        challengeSlugs: ["elephant-vs-rhino"],
        faq: [
            {question: "What wildlife is there in Way Kambas National Park?", answer: "Sumatran elephants, Sumatran rhinos at the sanctuary, Sumatran tigers and Malayan tapirs (mostly tracks), siamang, sambar deer, wild boar, lesser adjutant storks, crested firebacks, rhinoceros and pied hornbills, macaques, monitors and flying foxes."},
            {question: "What animals can be found in Way Kambas?", answer: "Elephants, macaques, deer, boar, storks, hornbills and monitors are realistic on a two-day visit. Tigers and tapirs are present but seen only on camera traps, and the rhinos are in the sanctuary's forest enclosures."},
            {question: "Can I see wild elephants at Way Kambas?", answer: "Often, yes, in the dry season on an evening drive through the grassland or from the Way Kanan boat. The Elephant Response Unit herds are a guaranteed close encounter if the wild ones stay in the forest."},
            {question: "Is the rhino sanctuary open to visitors?", answer: "Only by prior arrangement and in small numbers, because the animals are part of a breeding programme. Ask the park office well in advance and be prepared for a no."}
        ]
    },
    {
        slug: "bromo-tengger-semeru",
        name: "Bromo Tengger Semeru National Park",
        regionType: "park",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "east-java",
        coordinate: {lat: -7.94, lng: 112.95, zoom: 11},
        captureArea: {bbox: {north: -7.75, south: -8.2, east: 113.15, west: 112.8}},
        title: "Animals in Bromo Tengger Semeru National Park: What You Can Spot, Learn, and Collect",
        description: "Bromo Tengger Semeru wildlife: rusa deer on the Ranu Pani grassland, lutung in the Semeru forest, leopard cat and muntjac, raptors on the caldera rim.",
        searchIntents: [
            "animals in Bromo",
            "wildlife in Bromo Tengger Semeru National Park",
            "what animals can be found in Bromo",
            "what wildlife is there in Bromo Tengger Semeru",
            "hewan di Bromo",
            "Mount Semeru wildlife",
            "Bromo wildlife travel"
        ],
        quickAnswer: "Bromo's sea of sand is almost lifeless, but the forested caldera rim and the Semeru highlands behind it are not. Rusa deer graze the Ranu Pani grassland at dusk, lutung and muntjac move through the Semeru forest, leopard cats hunt the scrub at night, and the rim holds serpent eagles, honey buzzards, white-eyes and bulbuls. Ranu Pani and Ranu Regulo lakes are full of dragonflies, and the villages add tree sparrows and the usual macaques.",
        introduction: [
            "Most visitors see Bromo in the dark, photograph a sunrise and leave by nine. The wildlife starts where the jeeps stop: in the casuarina and montane forest on the caldera rim, on the grassland around Ranu Pani, and in the tall forest on the flanks of Semeru, Java's highest volcano.",
            "This is a highland page. The animals are cold-adapted Javan species, the mornings are near freezing, and the best sightings come to people who stay a night at Ranu Pani or walk the rim trails after the sunrise crowd has gone."
        ],
        whyItMatters: [
            "The park protects the largest block of montane forest in East Java and is one of the few places on the island where a visitor can combine open grassland mammals with highland forest birds in a single day.",
            "Ranu Pani is the trailhead for Semeru and a real highland village, and treating the walk-in as a wildlife day rather than a transit day turns up deer, lutung and raptors that climbers in a hurry never notice."
        ],
        animalsToSpot: [
            {speciesSlug: "javan-rusa-deer", whyItFits: "Herds graze the savanna around Ranu Pani and the grassland below Ranu Kumbolo at dawn and dusk.", rarityHint: "Likely at dusk around Ranu Pani; common on the Ranu Kumbolo trail."},
            {speciesSlug: "silvery-lutung", whyItFits: "Black leaf monkeys with orange infants move through the Semeru forest between Ranu Pani and Ranu Kumbolo.", rarityHint: "Regular on the lower trail if you walk quietly."},
            {speciesSlug: "indian-muntjac", whyItFits: "The barking deer's alarm call echoes from the forest edge at Ranu Pani in the evening.", rarityHint: "Heard often; seen occasionally crossing the trail."},
            {speciesSlug: "prionailurus-bengalensis", whyItFits: "Leopard cats hunt rats and birds in the scrub and casuarina on the caldera rim after dark.", rarityHint: "Rare; a torch along the rim road late at night is the only chance."},
            {speciesSlug: "wild-boar", whyItFits: "Churned ground along the Ranu Pani fields and forest edge gives them away.", rarityHint: "Common but shy; sign is easier than the animal."},
            {speciesSlug: "crested-serpent-eagle", whyItFits: "Soars over the caldera rim forest at Cemoro Lawang and Penanjakan once the morning thermals start.", rarityHint: "Regular mid-morning."},
            {speciesSlug: "peregrine-falcon", whyItFits: "Hunts swifts and pigeons along the caldera cliffs and the Penanjakan escarpment.", rarityHint: "Uncommon; check the cliff faces."},
            {speciesSlug: "zosterops-palpebrosus", whyItFits: "Flocks of white-eyes work the casuarina and scrub on the rim and around Ranu Pani.", rarityHint: "Common in highland scrub."},
            {speciesSlug: "sooty-headed-bulbul", whyItFits: "The bulbul of the Cemoro Lawang and Ranu Pani village gardens and hedges.", rarityHint: "Abundant."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The sparrow of every homestay roof in Cemoro Lawang and Ngadisari.", rarityHint: "Everywhere in the villages."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops live in the forest on the lower slopes toward Tumpang and at the Coban Pelangi waterfall approach.", rarityHint: "Common on the lower, western approaches."},
            {speciesSlug: "asian-palm-civet", whyItFits: "Crosses the Tumpang to Ranu Pani road at night and raids village fruit trees.", rarityHint: "Nocturnal; realistic on a late drive."},
            {speciesSlug: "dragonfly", whyItFits: "Ranu Pani, Ranu Regulo and Ranu Kumbolo lakes hum with dragonflies on sunny mornings.", rarityHint: "Abundant at the lakes in sun."}
        ],
        bestFor: [
            "Dusk deer on the Ranu Pani grassland",
            "Highland forest monkeys on the Semeru trail",
            "Raptors over the caldera rim",
            "Lake-edge insects at Ranu Kumbolo"
        ],
        spottingTips: [
            "Stay at Ranu Pani rather than Cemoro Lawang if wildlife is the goal; the deer and muntjac are on the grassland at dusk and dawn.",
            "Walk the first two hours of the Semeru trail toward Ranu Kumbolo slowly and in silence for lutung; most hikers pass straight through.",
            "After the sunrise crowd leaves Penanjakan, bird the rim forest between 08:00 and 10:00 when the thermals bring up the raptors.",
            "Nights fall below 5 degrees; bring real warm layers for any dusk or night session."
        ],
        relatedLocationSlugs: ["east-java", "malang-and-batu", "java"],
        faq: [
            {question: "What wildlife is there in Bromo Tengger Semeru National Park?", answer: "Rusa deer, lutung, muntjac, wild boar and leopard cat in the Semeru highlands and on the caldera rim; serpent eagles, peregrines, white-eyes and bulbuls in the rim forest; and dragonflies at the Ranu Pani and Ranu Kumbolo lakes."},
            {question: "What animals can be found in Bromo?", answer: "Around the sea of sand, very little beyond the ponies and village birds. The animals are on the forested rim and at Ranu Pani: deer, monkeys, raptors and small highland birds."},
            {question: "Are there animals on the Semeru trek?", answer: "Yes. Rusa deer are common at Ranu Kumbolo, lutung move through the forest on the first section, muntjac bark at dusk, and the lakes are full of dragonflies. Above Kalimati the volcano is bare."},
            {question: "When is the best time for wildlife in Bromo?", answer: "The dry season from May to October gives clear mornings and firm trails. Deer and muntjac are seen year-round at dusk; the Semeru trail is often closed during the wettest months."}
        ]
    },
    {
        slug: "gunung-leuser",
        name: "Gunung Leuser National Park",
        regionType: "park",
        hubRegion: "asia",
        countryCode: "ID",
        parentSlug: "north-sumatra",
        coordinate: {lat: 3.5, lng: 97.6, zoom: 9},
        captureArea: {bbox: {north: 4.4, south: 2.8, east: 98.4, west: 96.8}},
        title: "Animals in Gunung Leuser National Park: What You Can Spot, Learn, and Collect",
        description: "Gunung Leuser guide: wild Sumatran orangutans at Bukit Lawang and Ketambe, siamang, rhinoceros and helmeted hornbills, great argus, and unseen tigers and rhinos.",
        searchIntents: [
            "animals in Gunung Leuser",
            "wildlife in Gunung Leuser National Park",
            "what animals can be found in Gunung Leuser",
            "what wildlife is there in Gunung Leuser",
            "Leuser ecosystem animals",
            "Bukit Lawang jungle trek animals",
            "Gunung Leuser wildlife travel"
        ],
        quickAnswer: "Gunung Leuser is the only place on earth where orangutans, tigers, elephants and rhinos still share one forest. Visitors at Bukit Lawang and Ketambe reliably see Sumatran orangutans, Thomas's leaf monkeys, siamang, macaques, hornbills and monitors. Sun bears, great argus pheasants, flying dragons and colugos are realistic with time. Tigers, elephants and Sumatran rhinos are present across the park's 8,000 km2 but encountered by almost no one.",
        introduction: [
            "The park spans the border of North Sumatra and Aceh and anchors the Leuser Ecosystem, the largest intact forest left on Sumatra. Its eastern gateway at Bukit Lawang is a guesthouse village on a clear river; its northern gateway at Ketambe in Aceh is a research station with far fewer visitors and more fully wild apes.",
            "Treks here are hot, steep and slippery, and the forest is dense enough that most of what lives in it stays unseen. The point is the orangutans, which are seen on the great majority of walks, and the sounds and sign of everything else."
        ],
        whyItMatters: [
            "Leuser is the last stronghold of the Sumatran orangutan, with the majority of the species' 14,000 or so remaining individuals, and the only remaining place where all four Sumatran megafauna species coexist.",
            "The park is under constant pressure from roads, palm oil and a proposed geothermal plant, and visitor fees at Bukit Lawang and Ketambe are a real part of the argument for keeping it standing."
        ],
        animalsToSpot: [
            {speciesSlug: "sumatran-orangutan", whyItFits: "Bukit Lawang's trails and the Ketambe research forest give the most reliable wild orangutan sightings on earth, including fully wild flanged males.", rarityHint: "Very likely on a day trek; near-certain over two days."},
            {speciesSlug: "siamang", whyItFits: "The big black gibbon's duet rolls down the Bohorok and Alas valleys every morning from tall emergent trees.", rarityHint: "Heard daily; seen with patience."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops on the Bukit Lawang riverbank and at every trail junction waiting for food.", rarityHint: "Guaranteed."},
            {speciesSlug: "sun-bear", whyItFits: "Fresh claw marks on trunks and ripped termite mounds along the trails are frequent; the bear itself appears rarely.", rarityHint: "Sign common; sightings rare."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "Pairs commute over the Bohorok valley and feed in figs above the Bukit Lawang guesthouses.", rarityHint: "Regular on clear mornings."},
            {speciesSlug: "helmeted-hornbill", whyItFits: "The maniacal laughing call of this critically endangered hornbill still rings over Leuser's tall forest, especially at Ketambe.", rarityHint: "Heard occasionally; seen rarely. Poached heavily for its solid casque."},
            {speciesSlug: "great-argus", whyItFits: "Calls from the hill forest and keeps cleared dancing grounds that guides can show you.", rarityHint: "Heard often; glimpsed occasionally."},
            {speciesSlug: "flying-dragon", whyItFits: "Draco lizards glide between trunks on sunlit trail edges, flashing coloured throat fans.", rarityHint: "Common on sunny mornings if you watch tree trunks."},
            {speciesSlug: "sunda-colugo", whyItFits: "Flying lemurs cling to trunks by day near the forest camps and glide between trees at dusk.", rarityHint: "Uncommon; guides know favoured trees."},
            {speciesSlug: "lesser-mouse-deer", whyItFits: "The smallest hoofed mammal tiptoes through the understorey near the river camps at dusk.", rarityHint: "Uncommon; best on quiet evenings at camp."},
            {speciesSlug: "water-monitor", whyItFits: "Swims the Bohorok and Alas rivers and basks on boulders by the guesthouses.", rarityHint: "Regular along the rivers."},
            {speciesSlug: "sumatran-tiger", whyItFits: "Leuser holds one of the largest remaining tiger populations, recorded on camera traps near both gateways.", rarityHint: "Almost never seen; tracks on river sand are realistic."},
            {speciesSlug: "asian-elephant", whyItFits: "Wild herds move through the eastern lowlands around Tangkahan and the Besitang forest.", rarityHint: "Rarely seen wild; the Tangkahan patrol herd is guaranteed."},
            {speciesSlug: "sumatran-rhinoceros", whyItFits: "A few dozen Sumatran rhinos survive in Leuser's remotest valleys, the largest wild population left.", rarityHint: "Never seen by visitors; known only from camera traps and sign."}
        ],
        bestFor: [
            "Wild orangutans at Bukit Lawang and Ketambe",
            "Gibbons and hornbills from forest camps",
            "Multi-day rainforest treks with river-tube returns",
            "The last forest with orangutan, tiger, elephant and rhino together"
        ],
        spottingTips: [
            "Choose a licensed guide who refuses to feed orangutans and keeps you ten metres back; the semi-wild females at Bukit Lawang can be aggressive when fed.",
            "Ketambe sees far fewer visitors and the orangutans there are fully wild; allow an extra day for the longer journey from Medan.",
            "Camp at least one night in the forest; dusk and dawn at camp bring mouse-deer, colugos, hornbills and the gibbon chorus.",
            "Wear long trousers and leech socks; the forest floor is leech country, especially after rain."
        ],
        relatedLocationSlugs: ["north-sumatra", "sumatra", "indonesia"],
        rankingSlugs: ["smartest-animals", "rarest-animals"],
        challengeSlugs: ["gorilla-vs-orangutan", "rhinoceros-hornbill-vs-toco-toucan"],
        faq: [
            {question: "What wildlife is there in Gunung Leuser National Park?", answer: "Sumatran orangutans, siamang, Thomas's leaf monkeys and macaques; sun bears; rhinoceros, helmeted and other hornbills; great argus pheasants; flying dragons, colugos, mouse-deer and monitors; and the unseen giants, Sumatran tigers, elephants and rhinos."},
            {question: "What animals can be found in Gunung Leuser?", answer: "On a typical two-day trek from Bukit Lawang you can expect orangutans, macaques, Thomas's leaf monkeys, hornbills, monitors and the sound of siamang. Sun bear sign, argus calls and flying dragons are regular; tigers, elephants and rhinos are not."},
            {question: "Bukit Lawang or Ketambe?", answer: "Bukit Lawang is easier to reach, busier and nearly guarantees orangutans, some of them habituated. Ketambe is a longer journey into Aceh, quieter, and its orangutans are entirely wild; it suits a second visit or anyone who wants fewer people."},
            {question: "Is Gunung Leuser safe to trek?", answer: "With a licensed guide, yes. The risks are heat, slippery trails and leeches rather than animals. Keep distance from orangutans and macaques, carry water, and do not trek alone."}
        ]
    }
];

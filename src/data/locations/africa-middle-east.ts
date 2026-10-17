import type {LocationPageInput} from "@/data/location-types";

export const africaMiddleEastLocationPages: LocationPageInput[] = [
    {
        slug: "algeria",
        name: "Algeria",
        regionType: "country",
        hubRegion: "africa",
        countryCode: "DZ",
        coordinate: {lat: 28.0, lng: 2.6, zoom: 5},
        captureArea: {countryCodes: ["DZ"]},
        title: "Animals in Algeria: What You Can Spot, Learn, and Collect",
        description: "Algeria wildlife guide: Barbary macaques in the Chréa cedars, flamingos at El Kala, fennec foxes in the Sahara and the wall geckos AnimalDex users log around Blida.",
        searchIntents: [
            "animals in Algeria",
            "wildlife in Algeria",
            "what animals can be found in Algeria",
            "what wildlife is there in Algeria",
            "what animals live in the Algerian Sahara",
            "animaux en Algérie",
            "Algeria wildlife travel"
        ],
        quickAnswer: "Algeria splits into three wildlife zones: the Mediterranean Tell with Barbary macaques, white storks and wetland flamingos, the high plateaus with jackals and porcupines, and the Sahara with fennec foxes, Barbary sheep and horned vipers. Around Algiers the realistic daily sightings are wall geckos, two-tailed pasha butterflies and gulls, with Ben Aknoun zoo for a guaranteed close look at the bigger species.",
        introduction: [
            "Most of Algeria is desert, which makes people assume there is little to see. The opposite is true if you plan around the few places where water, cedar forest or rock meet: the cedar slopes of Chréa National Park above Blida, the lakes and cork-oak forest of El Kala in the far north-east, and the oases and sandstone massifs of the Sahara.",
            "AnimalDex captures from Algeria cluster around Blida and Oran, and they are honest: wall geckos on warm walls, a two-tailed pasha on a fig, a woodlouse hunter spider under a flowerpot. That everyday layer is where most collections start, and the headline species sit a day trip away."
        ],
        whyItMatters: [
            "Algeria holds one of the last strongholds of the Barbary macaque, the only wild monkey north of the Sahara, and a large share of the remaining Barbary sheep in the Saharan Atlas and Hoggar. Few visitors realise either animal is on the doorstep of Algiers or Djanet.",
            "The country is also under-recorded. A logged sighting of a flamingo at Lac Tonga or a horned viper track in Tassili n'Ajjer adds genuine information to a map that still has big gaps."
        ],
        animalsToSpot: [
            {speciesSlug: "barbary-macaque", whyItFits: "Troops live in the Atlas cedar forest of Chréa National Park above Blida and in the Djurdjura range, and they come down to car parks and picnic spots looking for handouts.", rarityHint: "Reliable at Chréa on weekends; keep food out of sight and do not feed them."},
            {speciesSlug: "fennec-fox", whyItFits: "Algeria's national animal and the mascot of its football team. Big-eared foxes hunt the dunes around Timimoun, Taghit and the Grand Erg Occidental after dark.", rarityHint: "Nocturnal and shy; tracks at dawn around dune bases are the usual proof."},
            {speciesSlug: "barbary-sheep", whyItFits: "The aoudad still clings to the cliffs of the Ahaggar and Tassili n'Ajjer, where guides find it on ledges above the wadis at first light.", rarityHint: "Uncommon; a Saharan trek with a local guide gives the best odds."},
            {speciesSlug: "greater-flamingo", whyItFits: "Flocks winter and increasingly breed on the sebkhas of the high plateaus and the lakes of El Kala, with Lac des Oiseaux and Lac Tonga the classic sites.", rarityHint: "Common in winter at El Kala and on the salt lakes near Oran."},
            {speciesSlug: "white-stork", whyItFits: "Nests on minarets, pylons and chimneys across the Tell from spring, and parades through ploughed fields in the Mitidja plain.", rarityHint: "Common March to August in the north."},
            {speciesSlug: "golden-jackal", whyItFits: "Algeria's jackals are now treated as African wolves by many researchers, but either way you will hear them yipping at dusk on the high plateaus and the edge of oasis towns.", rarityHint: "Heard far more than seen; dusk on the steppe is the window."},
            {speciesSlug: "crested-porcupine", whyItFits: "Leaves black-and-white quills on trails in the Tell forests and raids gardens on the edge of hill towns.", rarityHint: "Nocturnal; quills and digging are the common evidence."},
            {speciesSlug: "greek-tortoise", whyItFits: "The spur-thighed tortoise grazes maquis and olive groves across northern Algeria and is most active after spring rain.", rarityHint: "Fairly common in the north in spring; never take one home."},
            {speciesSlug: "sahara-spiny-tailed-lizard", whyItFits: "The dob basks on the sandstone and boulder plains of the Tassili n'Ajjer and the Ahaggar around Djanet and Tamanrasset, retreating to a burrow when the shadow of a car falls on it.", rarityHint: "Regular in the central Sahara on warm mornings."},
            {speciesSlug: "desert-horned-viper", whyItFits: "Lies buried in sand with only its eyes and horns showing. Sidewinding tracks across a dune at dawn are the safe way to log it.", rarityHint: "Rarely seen alive; watch where you put your hands and feet."},
            {speciesSlug: "common-wall-gecko", whyItFits: "The most-logged wild animal in AnimalDex's Algeria captures, hunting moths under lights on house walls in Blida and Oran every warm night.", rarityHint: "Near-guaranteed on any lit wall from April to October."},
            {speciesSlug: "two-tailed-pasha", whyItFits: "A big, fast butterfly tied to the strawberry tree, logged by users around Blida. It patrols hilltops and comes down to rotting figs.", rarityHint: "Seasonal in the Tell hills, late spring and again in late summer."},
            {speciesSlug: "yellow-legged-gull", whyItFits: "The default large gull of Algiers harbour, Oran's corniche and every fishing port in between.", rarityHint: "Abundant along the whole coast."},
            {speciesSlug: "woodlouse-hunter", whyItFits: "A red-and-cream spider with oversized fangs that users have turned up under stones and plant pots in Blida gardens.", rarityHint: "Common but hidden; lift a damp stone at night."}
        ],
        bestFor: [
            "Travellers combining Algiers and the Kabylie hills with a day in the Chréa cedars.",
            "Saharan trekkers heading to Tassili n'Ajjer or the Hoggar with a local guide.",
            "Birders chasing winter wetlands at El Kala and the Oran salt lakes.",
            "Collectors who want a genuinely under-recorded country on their map."
        ],
        spottingTips: [
            "Chréa's macaques are easiest on a weekday morning before the picnic crowds arrive, and they stay calmer if nobody is feeding them.",
            "In the Sahara, walk dune edges at dawn for tracks: fennec, jerboa, horned viper and beetle trails are all readable in cold sand.",
            "El Kala's lakes are best in winter for flamingos, ducks and herons; bring a scope because the birds sit far out.",
            "Ben Aknoun zoo in Algiers is fine for a close look at lions and Barbary sheep, but log them as zoo sightings, not wild ones."
        ],
        relatedLocationSlugs: ["morocco", "egypt", "spain"],
        rankingSlugs: ["most-adaptable-animals"],
        faq: [
            {question: "What wildlife is there in Algeria?", answer: "Barbary macaques and white storks in the north, flamingos on the wetlands and salt lakes, jackals and porcupines on the high plateaus, and fennec foxes, Barbary sheep and horned vipers in the Sahara."},
            {question: "What animals can be found in Algeria?", answer: "Around 100 mammal species including the Barbary macaque, fennec fox, Barbary sheep, striped hyena and dorcas gazelle, plus about 400 bird species and a rich desert reptile fauna. In towns the everyday wildlife is wall geckos, gulls, storks and butterflies."},
            {question: "Where can you see monkeys in Algeria?", answer: "Chréa National Park above Blida, about an hour from Algiers, has habituated Barbary macaque troops along the road and picnic areas. The Djurdjura range in Kabylie and Gouraya near Béjaïa also hold wild troops."},
            {question: "Is the Algerian Sahara good for wildlife?", answer: "Yes, if you go with a guide and accept that most animals are nocturnal. Tassili n'Ajjer and the Hoggar hold Barbary sheep, fennec, sand cat and dorcas gazelle, and dawn tracking in the dunes is very productive."}
        ]
    },
    {
        slug: "reunion",
        name: "Réunion",
        regionType: "island",
        hubRegion: "africa",
        countryCode: "RE",
        coordinate: {lat: -21.115, lng: 55.536, zoom: 9},
        captureArea: {countryCodes: ["RE"], bbox: {north: -20.80, south: -21.45, east: 55.90, west: 55.15}},
        title: "Animals in Réunion: What You Can Spot, Learn, and Collect",
        description: "Réunion wildlife guide: humpback whales off Saint-Gilles, tropicbirds over the cirques, panther chameleons in gardens and turtles in the Saint-Paul lagoon.",
        searchIntents: [
            "animals in Réunion",
            "wildlife in Réunion",
            "what animals can be found in Réunion",
            "what wildlife is there in Réunion",
            "animaux à La Réunion",
            "Reunion Island whale watching",
            "Réunion wildlife travel"
        ],
        quickAnswer: "Réunion's wildlife is mostly in the sea and the sky: humpback whales from June to October, sperm whales and spinner dolphins year-round off the west coast, white-tailed tropicbirds over every ravine, and green and hawksbill turtles in the Saint-Paul and l'Ermitage lagoon. On land, panther chameleons and giant day geckos in gardens are the big colour, and the island's own forest birds live high in the cirques.",
        introduction: [
            "Réunion is a volcanic island with no large native land mammals, so a wildlife trip here looks different from Africa or Madagascar. The headline encounters are whales breaching off Saint-Gilles, tropicbirds riding the updrafts of the Cirque de Mafate, and the lagoon reef inside the barrier between Saint-Paul and Saint-Leu.",
            "AnimalDex captures from Réunion come almost entirely from Saint-Paul, and they are small: ghost ants on a kitchen counter, wasp moths on a hibiscus. That is a good reminder that the island's accessible wildlife is garden-scale, with the big animals a boat trip away."
        ],
        whyItMatters: [
            "The west coast is one of the Indian Ocean's best humpback whale nurseries, and the island is a resident home for sperm whales, which makes it one of the few places where a half-day boat trip can produce both.",
            "Réunion also shows what islands lose and keep. Its endemic birds survive in the high forests, while introduced chameleons, geckos and mynas own the lowlands. Logging both honestly is a lesson in island ecology."
        ],
        animalsToSpot: [
            {speciesSlug: "humpback-whale", whyItFits: "Mothers and calves rest in the shallow water off Saint-Gilles, Saint-Leu and Saint-Paul every austral winter, often visible from the coast road and the Cap La Houssaye lookout.", rarityHint: "Near-certain from boats June to October; peak July to September."},
            {speciesSlug: "sperm-whale", whyItFits: "A resident population lives over the steep drop-off a few kilometres off the west coast, and specialist operators out of Saint-Gilles find them year-round.", rarityHint: "Regular on dedicated trips; the deep water starts very close to shore."},
            {speciesSlug: "spinner-dolphin", whyItFits: "Pods rest in the bay off Saint-Paul and Saint-Gilles in the morning and spin clear of the water on the way out to feed.", rarityHint: "Common at dawn off the west coast."},
            {speciesSlug: "white-tailed-tropicbird", whyItFits: "The paille-en-queue is the island's emblem, nesting on cliffs in the cirques and the coastal ravines and trailing its long tail over Cilaos and Saint-Gilles.", rarityHint: "Common; look up at any cliff or ravine."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Grazes the seagrass inside the l'Ermitage and Saint-Leu lagoons and has started nesting again on west-coast beaches after decades of absence. Kélonia in Saint-Leu rehabilitates injured ones.", rarityHint: "Regular for snorkellers in the lagoon; guaranteed at Kélonia (a care centre)."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Picks at sponges on the outer reef slope off Saint-Leu and l'Ermitage and turns up at the same cleaning spots as the greens.", rarityHint: "Less common than green turtles; divers see it more than snorkellers."},
            {speciesSlug: "panther-chameleon", whyItFits: "Introduced from Madagascar and now called the endormi, it sits motionless in hedges and fruit trees across the dry west coast lowlands.", rarityHint: "Common but hard to spot; check the sunlit side of garden shrubs."},
            {speciesSlug: "giant-day-gecko", whyItFits: "Bright green Madagascar day geckos have colonised gardens and hotel grounds around Saint-Paul and Saint-Gilles, hunting insects on palm trunks in full sun.", rarityHint: "Common in the west-coast lowlands."},
            {speciesSlug: "common-myna", whyItFits: "The martin triste is the loudest bird on the island, nesting in roofs and streetlights and working every café terrace.", rarityHint: "Abundant everywhere below the forest line."},
            {speciesSlug: "zebra-dove", whyItFits: "The tourterelle striée walks under tables and along paths in every coastal town, introduced long ago and now the island's default small dove.", rarityHint: "Abundant and approachable."},
            {speciesSlug: "moray-eel", whyItFits: "Peers from holes in the coral inside the l'Ermitage lagoon and along the Saint-Leu drop-off.", rarityHint: "Regular for snorkellers who look into crevices."},
            {speciesSlug: "ghost-ant", whyItFits: "The most-logged animal in AnimalDex's Réunion captures: tiny pale-legged ants trailing across kitchen counters and balcony rails in Saint-Paul.", rarityHint: "Everywhere indoors in the lowlands."},
            {speciesSlug: "wasp-moth", whyItFits: "Day-flying moths with clear wings and wasp stripes, logged repeatedly on flowers in Saint-Paul gardens.", rarityHint: "Common in gardens after rain."},
            {speciesSlug: "hermit-crab", whyItFits: "Scuttles across the coral rubble beaches of l'Ermitage and the black sand of Étang-Salé after dark.", rarityHint: "Very common on quiet beaches at night."}
        ],
        bestFor: [
            "Whale watchers who want humpbacks and resident sperm whales on one coast.",
            "Snorkellers using the shallow, sheltered lagoon between Saint-Paul and Saint-Leu.",
            "Hikers in the cirques who will see tropicbirds and endemic forest birds on the way.",
            "Families who like garden wildlife: chameleons, geckos and butterflies at the hotel."
        ],
        spottingTips: [
            "Book whale trips from Saint-Gilles with an operator that follows the local approach charter; mornings are calmer and sightings are better.",
            "Snorkel the l'Ermitage lagoon at high tide in the morning for turtles; the water is clearer before the wind picks up.",
            "Look for chameleons on the sunny side of hedges in the afternoon, and on fences at night with a torch when they go pale.",
            "Swimming outside the lagoon is restricted because of shark risk; stay inside the reef or at supervised beaches."
        ],
        relatedLocationSlugs: ["mauritius", "madagascar", "south-africa"],
        rankingSlugs: ["biggest-animals"],
        faq: [
            {question: "What wildlife is there in Réunion?", answer: "Humpback whales in winter, resident sperm whales and dolphins, tropicbirds and other seabirds, green and hawksbill turtles in the lagoon, and introduced chameleons, day geckos and mynas on land. There are no large native land mammals."},
            {question: "What animals can be found in Réunion?", answer: "Marine mammals and turtles off the west coast, reef fish and morays inside the lagoon, the paille-en-queue tropicbird and endemic forest birds in the highlands, panther chameleons and giant day geckos in gardens, plus a large introduced insect and gecko fauna."},
            {question: "When is the best time to see whales in Réunion?", answer: "Humpback whales arrive in June and leave by October, with July to September the peak for mothers and calves close to shore. Sperm whales and dolphins can be seen all year."},
            {question: "Can you swim with turtles in Réunion?", answer: "Yes, inside the lagoon at l'Ermitage and Saint-Leu green turtles graze in shallow water. Keep your distance, do not touch them, and visit Kélonia to understand the recovery work."}
        ]
    },
    {
        slug: "morocco",
        name: "Morocco",
        regionType: "country",
        hubRegion: "africa",
        countryCode: "MA",
        coordinate: {lat: 31.8, lng: -7.1, zoom: 5},
        captureArea: {countryCodes: ["MA"]},
        title: "Animals in Morocco: What You Can Spot, Learn, and Collect",
        description: "Morocco wildlife guide: Barbary macaques in the Ifrane cedars, northern bald ibis at Souss-Massa, storks on every minaret, fennec foxes and camels at Merzouga.",
        searchIntents: [
            "animals in Morocco",
            "wildlife in Morocco",
            "what animals can be found in Morocco",
            "what wildlife is there in Morocco",
            "what animals live in the Sahara desert in Morocco",
            "animaux au Maroc",
            "Morocco wildlife travel"
        ],
        quickAnswer: "Morocco gives you Barbary macaques in the Middle Atlas cedar forest around Azrou and Ifrane, the world's largest wild colony of northern bald ibis at Souss-Massa near Agadir, white storks nesting on city walls from Marrakech to Chellah, and fennec foxes, horned vipers and camels in the dunes at Merzouga. Flamingos and waders fill the lagoons at Oualidia and Merja Zerga.",
        introduction: [
            "Morocco is a mountain and desert country with a long Atlantic coast, and each zone has its own animals. The cedar forests of the Middle Atlas hold the largest remaining population of Barbary macaques; the High Atlas has Barbary sheep and lammergeiers; the Souss-Massa coast protects the bald ibis; and the Saharan fringe at Merzouga and M'Hamid is fennec and dorcas gazelle country.",
            "Cities count too. Storks nest on the Chellah ruins in Rabat and the Koutoubia in Marrakech, house buntings sing in riad courtyards, and Moorish geckos work the walls of every medina after dark."
        ],
        whyItMatters: [
            "The northern bald ibis was down to a few hundred birds worldwide and Souss-Massa is the reason it is recovering. Seeing them feed on the clifftop steppe above the Atlantic is one of the rarest-bird experiences available on a normal holiday.",
            "Morocco is also a migration corridor. Spring and autumn push raptors, storks and millions of songbirds through the Strait of Gibraltar, and a visitor with binoculars at Tangier or Merja Zerga can watch it happen."
        ],
        animalsToSpot: [
            {speciesSlug: "barbary-macaque", whyItFits: "Cedar forest troops around Azrou and Ifrane in the Middle Atlas are the biggest wild population left, and the Cèdre Gouraud car park troop is habituated to tourists.", rarityHint: "Near-guaranteed at Azrou; do not feed them, which is spoiling their diet and behaviour."},
            {speciesSlug: "northern-bald-ibis", whyItFits: "Souss-Massa National Park south of Agadir holds most of the world's wild colony, feeding on the coastal steppe near Tamri and roosting on sea cliffs.", rarityHint: "Reliable with a park guide at Tamri and Oued Massa; globally rare."},
            {speciesSlug: "white-stork", whyItFits: "Nests on the Chellah necropolis in Rabat, the ramparts of Marrakech and Meknès, and every pylon along the Gharb plain.", rarityHint: "Common and conspicuous February to August."},
            {speciesSlug: "greater-flamingo", whyItFits: "Flocks feed in the Oualidia and Sidi Moussa lagoons, Merja Zerga and the Khnifiss lagoon on the Saharan coast.", rarityHint: "Common in winter on the Atlantic lagoons."},
            {speciesSlug: "barbary-sheep", whyItFits: "The aoudad is protected on the slopes of Toubkal National Park and in the eastern High Atlas, where it moves between cliffs and scree at first light.", rarityHint: "Uncommon; best with a mountain guide in Toubkal."},
            {speciesSlug: "fennec-fox", whyItFits: "Lives in the Erg Chebbi dunes at Merzouga and the Erg Chigaga near M'Hamid, emerging at dusk to hunt beetles and gerbils.", rarityHint: "Nocturnal and shy; tracks at dawn are common, sightings are a bonus. Avoid camps that keep tame ones."},
            {speciesSlug: "dromedary-camel", whyItFits: "Working camels carry tourists into the Erg Chebbi dunes every evening, and semi-wild herds graze the hammada between Zagora and Foum Zguid.", rarityHint: "Guaranteed at Merzouga; log the free-ranging herds as domestic."},
            {speciesSlug: "chameleon", whyItFits: "The common chameleon lives in argan scrub and gardens along the Atlantic coast and the Souss valley, and is still sold in medina markets, which you should not support.", rarityHint: "Uncommon to see wild; argan branches near Essaouira and Agadir are the place."},
            {speciesSlug: "greek-tortoise", whyItFits: "Spur-thighed tortoises graze the argan and olive country of the Souss and the Rif foothills after spring rain.", rarityHint: "Fairly common in spring in the north and west; never buy one."},
            {speciesSlug: "common-wall-gecko", whyItFits: "The Moorish gecko hunts under riad lights and on medina walls in every Moroccan town from Tangier to Tiznit.", rarityHint: "Near-guaranteed on warm nights."},
            {speciesSlug: "european-bee-eater", whyItFits: "Arrives in April and nests in sandy banks across the Gharb and Souss plains, calling in flocks over farmland and river valleys.", rarityHint: "Common April to September."},
            {speciesSlug: "crested-porcupine", whyItFits: "Leaves quills along Middle Atlas trails and raids vegetable gardens on the edge of mountain villages. Quills are sold in souks, which is a reason not to buy them.", rarityHint: "Nocturnal; signs are common, sightings are rare."},
            {speciesSlug: "egyptian-mongoose", whyItFits: "Slips across tracks in the Souss argan forest and the Merja Zerga reedbeds, usually in family lines with tails held low.", rarityHint: "Uncommon but regular in the north-west and the Souss."},
            {speciesSlug: "hoopoe", whyItFits: "Probes lawns and olive groves with its curved bill across the whole country and nests in walls and hollow trees in the Atlas foothills.", rarityHint: "Common in spring; present year-round in the south."}
        ],
        bestFor: [
            "Travellers combining Fes or Marrakech with the Middle Atlas cedars and the Merzouga dunes.",
            "Birders targeting the northern bald ibis at Souss-Massa and the Oualidia lagoon.",
            "Trekkers in Toubkal and the Dadès gorges looking for Barbary sheep and raptors.",
            "Families who like storks on city walls and geckos on riad ceilings."
        ],
        spottingTips: [
            "Visit the Azrou macaques early and keep food locked away; the troop is in better health where tourists do not feed it.",
            "At Souss-Massa, hire a park guide at the Oued Massa or Tamri entrance; the ibis feed on specific clifftop fields and move with the season.",
            "In Merzouga, walk out of camp at first light before the camel caravans and read the tracks on the dune faces.",
            "Do not buy chameleons, tortoises or porcupine quills in the souks; the trade is illegal and drives local declines."
        ],
        relatedLocationSlugs: ["algeria", "spain", "egypt"],
        rankingSlugs: ["rarest-animals", "most-adaptable-animals"],
        faq: [
            {question: "What wildlife is there in Morocco?", answer: "Barbary macaques in the Middle Atlas cedars, Barbary sheep in the High Atlas, northern bald ibis and flamingos on the Atlantic coast, white storks in the cities, and fennec foxes, dorcas gazelles and horned vipers in the Saharan dunes."},
            {question: "What animals can be found in Morocco?", answer: "Around 105 mammal species, over 450 bird species and a strong reptile fauna. The headline animals are the Barbary macaque, Barbary sheep, northern bald ibis, fennec fox and common chameleon, with storks, hoopoes, bee-eaters and geckos the everyday sightings."},
            {question: "Where can you see monkeys in Morocco?", answer: "The cedar forest around Azrou and Ifrane in the Middle Atlas, about an hour from Fes, has habituated troops of Barbary macaques along the road to the Cèdre Gouraud. Wild troops also live in the Rif mountains near Chefchaouen."},
            {question: "Are there dangerous animals in Morocco?", answer: "A few. Horned vipers and Moorish vipers live in the desert and mountains, scorpions are common in dry areas, and the medina monkeys and tame fennecs used for photos can bite. Watch where you step in the dunes and do not handle wildlife."}
        ]
    },
    {
        slug: "egypt",
        name: "Egypt",
        regionType: "country",
        hubRegion: "africa",
        countryCode: "EG",
        coordinate: {lat: 26.8, lng: 30.8, zoom: 5},
        captureArea: {countryCodes: ["EG"]},
        title: "Animals in Egypt: What You Can Spot, Learn, and Collect",
        description: "Egypt wildlife guide: dugongs and Napoleon wrasse on the Red Sea reefs, Sataya's spinner dolphins, Nubian ibex in Sinai, Fayoum flamingos and Nile kingfishers.",
        searchIntents: [
            "animals in Egypt",
            "wildlife in Egypt",
            "what animals can be found in Egypt",
            "what wildlife is there in Egypt",
            "what animals live in the Red Sea",
            "animals you can see in Egypt",
            "Egypt wildlife travel"
        ],
        quickAnswer: "Egypt's richest wildlife is underwater: Red Sea reefs at Marsa Alam, Hurghada and Sharm el-Sheikh hold dugongs, green turtles, Napoleon wrasse, lionfish, morays and spinner dolphins, with oceanic whitetips at the offshore islands. Inland, the Nile and the Fayoum lakes give you pied kingfishers, egrets and flamingos, while the Sinai mountains hold Nubian ibex, rock hyrax and fennec country starts at the desert edge.",
        introduction: [
            "Egypt is a desert with a river through it and a reef along its side. Nearly every land animal lives within a few kilometres of the Nile or an oasis, which means a felucca ride at Aswan or a walk through Luxor's farmland produces more birds than most people expect: pied kingfishers hovering over the water, cattle egrets following the plough, hoopoes on the lawns.",
            "The Red Sea is the other Egypt. Marsa Alam's Abu Dabbab bay has resident dugongs, Sataya reef has a resting pod of spinner dolphins, and Ras Mohammed off Sharm is one of the most famous dive parks in the world. Wadi El Rayan and Lake Qarun in the Fayoum add flamingos and migrating waders within a day trip of Cairo."
        ],
        whyItMatters: [
            "The northern Red Sea is one of the few reef systems still in good shape, and Egypt's dugongs are among the most accessible anywhere. A snorkeller at Abu Dabbab can watch one graze the seagrass in three metres of water.",
            "Egypt's animals are also woven into its history. The ibis, baboon, falcon, cobra and cat on temple walls were real residents of the Nile valley, and seeing a sacred ibis cousin or a hooded cobra sign today connects the two."
        ],
        animalsToSpot: [
            {speciesSlug: "dugong", whyItFits: "A few individuals graze the seagrass bay at Abu Dabbab near Marsa Alam and are seen by snorkellers from the beach; Marsa Mubarak holds others.", rarityHint: "Regular at Abu Dabbab in the morning; keep your distance and never chase them."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Grazes alongside the dugongs at Abu Dabbab and Marsa Mubarak and rests under coral ledges at Ras Mohammed.", rarityHint: "Near-certain for snorkellers at Abu Dabbab."},
            {speciesSlug: "spinner-dolphin", whyItFits: "A pod rests inside the Sataya (Dolphin House) lagoon south of Marsa Alam by day and another uses Samadai reef, where access is managed.", rarityHint: "Reliable on day boats to Sataya; follow the no-chase rules."},
            {speciesSlug: "napoleon-wrasse", whyItFits: "Big humphead wrasse patrol the walls of Ras Mohammed, the Thistlegorm wreck and the Brothers, often following divers.", rarityHint: "Regular on the famous dive sites of Sharm and the offshore islands."},
            {speciesSlug: "lionfish", whyItFits: "Hangs under overhangs on every Red Sea reef from Dahab's Blue Hole to Hurghada's house reefs, fins spread, waiting for small fish.", rarityHint: "Very common; look but do not touch the venomous spines."},
            {speciesSlug: "oceanic-whitetip-shark", whyItFits: "Cruises the surface at the Brothers, Daedalus and Elphinstone in autumn, where liveaboard divers watch it circle the boats.", rarityHint: "Seasonal, October to December at the offshore reefs; rare near shore."},
            {speciesSlug: "greater-flamingo", whyItFits: "Feeds on the salt lakes of Wadi El Rayan and Lake Qarun in the Fayoum and on the Mediterranean lagoons at Lake Burullus.", rarityHint: "Common in winter in the Fayoum and the Delta lakes."},
            {speciesSlug: "pied-kingfisher", whyItFits: "Hovers over the Nile at Aswan and Luxor and perches on felucca masts, diving for fish right beside the boats.", rarityHint: "Abundant on the Nile year-round."},
            {speciesSlug: "cattle-egret", whyItFits: "The 'friend of the farmer' follows ploughs through Nile valley fields and roosts in thousands in city trees, including Cairo's zoo garden.", rarityHint: "Abundant everywhere there is farmland."},
            {speciesSlug: "nubian-ibex", whyItFits: "Lives on the granite of the St Katherine Protectorate in South Sinai and the cliffs of the Eastern Desert wadis near Wadi Gemal.", rarityHint: "Uncommon; a Bedouin guide at St Katherine or Wadi Gemal gives the best chance."},
            {speciesSlug: "fennec-fox", whyItFits: "Hunts the sand seas of the Western Desert around Siwa and the Great Sand Sea, and the Sinai dunes near Nuweiba, after dark.", rarityHint: "Nocturnal and rarely seen; tracks around dune bases are the usual record."},
            {speciesSlug: "egyptian-fruit-bat", whyItFits: "Roosts in tombs, temples and old buildings along the Nile and streams out at dusk over Luxor and Cairo to feed on figs and dates.", rarityHint: "Common at dusk near fruit trees and ancient sites."},
            {speciesSlug: "egyptian-cobra", whyItFits: "The cobra of the pharaohs' crowns still lives in Nile valley farmland and the Delta, hunting rodents at the edge of fields at night.", rarityHint: "Rarely seen; give any snake a wide berth."},
            {speciesSlug: "ornate-spiny-tailed-lizard", whyItFits: "The ornate mastigure, a blue, green and yellow spiny-tailed lizard, basks on granite boulders in the wadis around St Katherine and Dahab and in the Eastern Desert near Wadi Gemal.", rarityHint: "Regular on sunny rock in South Sinai from spring to autumn; the blue Sinai agama shares the same boulders."}
        ],
        bestFor: [
            "Snorkellers and divers using Marsa Alam, Hurghada, Dahab or Sharm el-Sheikh as a base.",
            "Nile cruise passengers who want to add kingfishers, egrets and bats to the temples.",
            "Day-trippers from Cairo heading to the Fayoum lakes and Wadi El Rayan waterfalls.",
            "Hikers in the St Katherine mountains with a Bedouin guide."
        ],
        spottingTips: [
            "At Abu Dabbab, enter from the beach early before the day boats arrive; the dugong and turtles feed on the seagrass in the middle of the bay.",
            "On the Nile, sit on the shaded side of the felucca and watch the papyrus edges and sandbanks for kingfishers, herons and the occasional Nile monitor.",
            "Dolphin trips to Sataya are better from Hamata than from Marsa Alam, and operators that follow the no-swim-at rules get calmer, longer encounters.",
            "Giza Zoo in Cairo is a place to see hippos and big cats up close, but log them as zoo sightings; the wild hippo left Egypt in the 1800s."
        ],
        relatedLocationSlugs: ["jordan", "saudi-arabia", "israel", "ethiopia"],
        rankingSlugs: ["most-sacred-animals-in-history", "most-dangerous-animals"],
        challengeSlugs: ["crocodile-vs-shark"],
        faq: [
            {question: "What wildlife is there in Egypt?", answer: "Red Sea reef life including dugongs, turtles, dolphins, wrasse and sharks; Nile birds such as pied kingfishers, egrets and herons; flamingos and waders on the Fayoum and Delta lakes; and desert and mountain animals including Nubian ibex, fennec fox, Egyptian cobra and Sinai agama."},
            {question: "What animals can be found in Egypt?", answer: "Around 100 mammal species, more than 470 bird species and some 1,200 Red Sea fish species. Realistic sightings are reef fish and turtles on the coast, kingfishers and egrets along the Nile, fruit bats at dusk, and ibex and hyrax in Sinai with a guide."},
            {question: "Are there crocodiles in the Nile in Egypt?", answer: "Only above the Aswan High Dam in Lake Nasser. The river north of Aswan, where the cruise boats run, has had no wild crocodiles for over a century. Nubian villages near Aswan keep small captive ones for tourists."},
            {question: "Where is the best snorkelling for wildlife in Egypt?", answer: "Abu Dabbab near Marsa Alam for dugongs and turtles, Sataya for dolphins, Ras Mohammed at Sharm for big fish and walls, and the Dahab reefs for lionfish and morays in shallow water."}
        ]
    },
    {
        slug: "namibia",
        name: "Namibia",
        regionType: "country",
        hubRegion: "africa",
        countryCode: "NA",
        coordinate: {lat: -22.5, lng: 17.1, zoom: 5},
        captureArea: {countryCodes: ["NA"]},
        title: "Animals in Namibia: What You Can Spot, Learn, and Collect",
        description: "Namibia wildlife guide: Etosha's waterhole lions and black rhinos, Damaraland desert elephants, Cape Cross fur seals, Sossusvlei oryx and wild cheetahs.",
        searchIntents: [
            "animals in Namibia",
            "wildlife in Namibia",
            "what animals can be found in Namibia",
            "what wildlife is there in Namibia",
            "what animals live in the Namib desert",
            "Etosha National Park animals",
            "Namibia wildlife travel"
        ],
        quickAnswer: "Namibia is waterhole country. Etosha's floodlit waterholes at Okaukuejo and Halali deliver lions, black rhinos, elephants and giraffes with almost no effort; Damaraland has desert-adapted elephants and rhinos tracked on foot; Cape Cross holds over 100,000 Cape fur seals; and the Sossusvlei dunes have oryx, springbok and ostrich walking across red sand. Namibia also has more wild cheetahs than any other country.",
        introduction: [
            "Namibia's wildlife is spread thin across a huge, dry country, but it concentrates hard around water. That is why Etosha works so well: a 22,000 square kilometre park where the animals come to the few permanent waterholes and the visitor simply waits. Sitting at Okaukuejo at night, with black rhinos drinking under floodlights, is one of Africa's great low-effort experiences.",
            "Outside the park the story is desert adaptation. Elephants dig for water in the Hoanib and Huab riverbeds, oryx walk the Sossusvlei dunes at midday, fog-basking beetles stand on their heads in the Namib, and the Skeleton Coast seal colonies feed on the cold Benguela current a few metres from the sand."
        ],
        whyItMatters: [
            "Namibia holds the largest free-roaming black rhino population in the world and most of the planet's remaining wild cheetahs, largely on communal conservancies and farmland rather than in fenced parks. That model, with local communities earning from wildlife, is why its numbers have grown while others fell.",
            "The Namib also shows how life manages on almost nothing: beetles that drink fog, lizards that swim in sand, elephants that go days between drinks. It is the best place in Africa to see adaptation rather than abundance."
        ],
        animalsToSpot: [
            {speciesSlug: "african-bush-elephant", whyItFits: "Big Etosha herds crowd the waterholes in the dry season, and the famous desert-adapted elephants of Damaraland walk the dry Huab, Ugab and Hoanib riverbeds eating ana tree pods.", rarityHint: "Near-certain at Etosha waterholes June to October; the desert herds need a guided drive."},
            {speciesSlug: "black-rhinoceros", whyItFits: "Etosha has one of the largest populations anywhere and the Okaukuejo waterhole is the most reliable spot in Africa to watch them drink at night. Damaraland's free-roaming rhinos are tracked on foot with Save the Rhino Trust guides.", rarityHint: "Reliable at Okaukuejo after dark in the dry season."},
            {speciesSlug: "lion", whyItFits: "Etosha prides lie up near the waterholes around Okaukuejo and Namutoni, and a small desert population hunts seals and oryx along the Skeleton Coast.", rarityHint: "Common in Etosha; the desert lions are rare and need a specialist guide."},
            {speciesSlug: "cheetah", whyItFits: "Namibia's farmland and conservancies hold the world's largest wild cheetah population, and the Cheetah Conservation Fund near Otjiwarongo and the Okonjima reserve let you see rehabilitated and wild ones.", rarityHint: "Wild sightings are luck; near-certain at Okonjima and CCF (managed reserves)."},
            {speciesSlug: "gemsbok", whyItFits: "Namibia's national animal, the oryx, walks the red dunes of Sossusvlei at midday and stands in the white clay of Deadvlei for the classic photograph.", rarityHint: "Common throughout the Namib and Etosha."},
            {speciesSlug: "springbok", whyItFits: "Herds pronk across the Etosha pan edge and graze the gravel plains around Sesriem and Solitaire.", rarityHint: "Abundant in Etosha and the Namib."},
            {speciesSlug: "mountain-zebra", whyItFits: "Hartmann's mountain zebra climbs the escarpment between the Namib and the highlands, best seen in the NamibRand reserve, Naukluft and western Etosha around Dolomite camp.", rarityHint: "Regular in the Naukluft mountains and western Etosha."},
            {speciesSlug: "giraffe", whyItFits: "Splay-legged giraffes drinking at Etosha waterholes are a park signature, and desert giraffes browse the ephemeral rivers of Damaraland and Kaokoland.", rarityHint: "Common in Etosha and the north-west."},
            {speciesSlug: "seal", whyItFits: "Cape Cross on the Skeleton Coast holds one of the largest Cape fur seal colonies on earth, over 100,000 animals on the rocks, and smaller colonies haul out at Pelican Point near Walvis Bay.", rarityHint: "Guaranteed at Cape Cross; the smell arrives before the view."},
            {speciesSlug: "greater-flamingo", whyItFits: "Thousands feed in the Walvis Bay lagoon and the salt works at Swakopmund, pink against the dunes.", rarityHint: "Common year-round at Walvis Bay; peak numbers in summer."},
            {speciesSlug: "sociable-weaver", whyItFits: "Builds haystack-sized communal nests in camelthorn trees and on telegraph poles across the Kalahari and southern Namibia.", rarityHint: "The nests are unmissable along the C- and D-roads; the birds swarm at them at dawn."},
            {speciesSlug: "kori-bustard", whyItFits: "The world's heaviest flying bird strides across the Etosha grasslands and the plains around Sesriem, often alongside springbok.", rarityHint: "Regular in Etosha and the Namib plains."},
            {speciesSlug: "namib-desert-beetle", whyItFits: "Fog-basking beetles climb the Namib dune crests at dawn and tilt into the sea mist so droplets run down to their mouths. The Living Desert tours out of Swakopmund find them with other dune specialists.", rarityHint: "Reliable on a guided dune walk on a foggy morning."},
            {speciesSlug: "bat-eared-fox", whyItFits: "Family groups trot across the short grass of Etosha and the Kalahari at dusk, swivelling their huge ears to listen for termites underground.", rarityHint: "Regular at dusk and dawn in Etosha and around Sesriem."}
        ],
        bestFor: [
            "Self-drivers who want a safari without a guide; Etosha's roads and waterholes are made for it.",
            "Photographers chasing oryx on red dunes and rhinos under floodlights.",
            "Travellers interested in community conservation and the cheetah and rhino recovery story.",
            "Anyone who wants desert adaptations: fog beetles, sand-swimming lizards and desert elephants."
        ],
        spottingTips: [
            "In Etosha, park at a waterhole and wait rather than driving; the dry-season (June to October) brings everything to Okaukuejo, Nebrownii and Chudop in turn.",
            "Book the Okaukuejo or Halali waterhole-side rooms, or at least stay in camp after dark, for black rhino.",
            "Visit Cape Cross in November and December when the pups are born, but expect noise, smell and jackals working the colony edge.",
            "Take a Living Desert tour at Swakopmund before 9am; the small dune animals retreat as soon as the sand heats up."
        ],
        relatedLocationSlugs: ["botswana", "south-africa", "african-safari"],
        rankingSlugs: ["fastest-animals", "most-resilient-animals"],
        challengeSlugs: ["ostrich-vs-cheetah-speed", "elephant-vs-rhino"],
        faq: [
            {question: "What wildlife is there in Namibia?", answer: "Lions, elephants, black and white rhinos, giraffes, cheetahs, leopards and large herds of oryx, springbok and zebra in Etosha and the conservancies; desert-adapted elephants and rhinos in Damaraland; Cape fur seals and flamingos on the coast; and a specialised Namib fauna of fog beetles, geckos and sidewinding adders."},
            {question: "What animals can be found in Namibia?", answer: "About 200 mammal species including the largest wild cheetah population on earth and the biggest free-roaming black rhino population, over 650 bird species, and desert specialists found nowhere else such as the Namib dune gecko and the fog-basking beetle."},
            {question: "When is the best time to see animals in Namibia?", answer: "The dry season from June to October, when the waterholes in Etosha are the only water for miles and the animals queue up. November to April is greener, hotter and better for birds and newborn antelope, but the game spreads out."},
            {question: "Can you see the Big Five in Namibia?", answer: "Four of them easily: lion, elephant, rhino and leopard are all in Etosha and the private reserves. Buffalo only occur in the wetter far north-east, in Bwabwata and the Zambezi region, so the classic Big Five needs a trip to the Caprivi strip."}
        ]
    },
    {
        slug: "botswana",
        name: "Botswana",
        regionType: "country",
        hubRegion: "africa",
        countryCode: "BW",
        coordinate: {lat: -22.3, lng: 24.7, zoom: 5},
        captureArea: {countryCodes: ["BW"]},
        title: "Animals in Botswana: What You Can Spot, Learn, and Collect",
        description: "Botswana wildlife guide: Okavango Delta mokoro trips with hippos and lechwe, Chobe's river elephants, wild dogs in Moremi, Makgadikgadi meerkats and the zebra migration.",
        searchIntents: [
            "animals in Botswana",
            "wildlife in Botswana",
            "what animals can be found in Botswana",
            "what wildlife is there in Botswana",
            "Okavango Delta animals",
            "Chobe National Park elephants",
            "Botswana wildlife travel"
        ],
        quickAnswer: "Botswana is elephant and water country. Chobe's riverfront holds the densest elephant population in Africa, the Okavango Delta's channels are full of hippos, crocodiles, red lechwe and fish eagles, and Moremi is one of the best places on the continent for African wild dogs and leopards. In the dry Makgadikgadi pans you can sit with habituated meerkats and watch southern Africa's largest zebra migration.",
        introduction: [
            "Botswana chose low-volume, high-value tourism and kept most of its wilderness unfenced, so the animals still move on their old routes. The Okavango floods from the Angolan highlands, arriving in the dry season when everything else is parched, and the game concentrates on its edges. Explore it from a mokoro, a poled canoe at water level, and the hippos, kingfishers and jacanas are at eye height.",
            "Chobe in the north-east is the elephant river: in the late dry season herds of hundreds come down to drink and swim in the late afternoon, best seen from a boat. The Kalahari side is different again, with black-maned lions, brown hyenas and the meerkat colonies of the Makgadikgadi salt pans."
        ],
        whyItMatters: [
            "Botswana holds about 130,000 elephants, roughly a third of all that remain in Africa, and the Okavango Delta is a UNESCO World Heritage wetland that has stayed almost pristine. Seeing both is seeing the continent's wildlife as it was.",
            "It is also the stronghold of the African wild dog, Africa's most endangered large carnivore, with Moremi and the Linyanti among the few places where packs are seen regularly rather than by luck."
        ],
        animalsToSpot: [
            {speciesSlug: "african-bush-elephant", whyItFits: "Chobe's riverfront has the highest elephant density in Africa, with herds swimming the river to Sedudu Island in the afternoon; the Okavango and Linyanti herds are almost as big.", rarityHint: "Guaranteed at Chobe in the dry season, hundreds at a time on boat cruises."},
            {speciesSlug: "hippopotamus", whyItFits: "Pods fill the Okavango lagoons and channels and grunt all night outside the camps; mokoro polers know every pool to avoid.", rarityHint: "Near-certain in the Delta and along the Chobe."},
            {speciesSlug: "crocodile", whyItFits: "Big Nile crocodiles bask on the Chobe and Okavango sandbanks and ambush lechwe at the channel crossings.", rarityHint: "Common on riverbanks; watch any water edge."},
            {speciesSlug: "african-wild-dog", whyItFits: "Moremi, Khwai and the Linyanti hold some of the most-watched packs in Africa, denning in the winter months and hunting impala at dawn and dusk.", rarityHint: "Realistic over several days in Moremi or Khwai; June to August denning season is best."},
            {speciesSlug: "lion", whyItFits: "Delta prides have learnt to hunt buffalo in the shallows and swim between islands; the Kalahari's black-maned lions roam the Central Kalahari Game Reserve.", rarityHint: "Common in Moremi, Savuti and the Delta concessions."},
            {speciesSlug: "leopard", whyItFits: "Moremi's riverine forest along the Khwai river is leopard habitat at its best, with cats draped in sausage trees above the tracks.", rarityHint: "Regular along the Khwai; the Delta is among Africa's best leopard areas."},
            {speciesSlug: "southern-lechwe", whyItFits: "Red lechwe splash across the Okavango floodplains in herds, bounding through knee-deep water where predators struggle to follow.", rarityHint: "Abundant across the Delta floodplains."},
            {speciesSlug: "plains-zebra", whyItFits: "Tens of thousands migrate between the Boteti river and the Makgadikgadi and Nxai pans with the rains, one of the longest land migrations in Africa.", rarityHint: "Common year-round; the pans in December to March for the migration."},
            {speciesSlug: "meerkat", whyItFits: "Habituated colonies on the edge of the Makgadikgadi pans near Jack's Camp and Planet Baobab let you sit with the group while a sentry uses your head as a lookout post.", rarityHint: "Reliable on guided meerkat walks in the Makgadikgadi."},
            {speciesSlug: "cape-buffalo", whyItFits: "Herds of a thousand cross the Chobe floodplain and the Okavango islands, trailed by Delta lions.", rarityHint: "Common in the north; big herds in the dry season."},
            {speciesSlug: "african-fish-eagle", whyItFits: "The call of Africa, heard over every Okavango lagoon, with pairs perched on dead trees above the channels and snatching bream from the surface.", rarityHint: "Abundant across the Delta and Chobe."},
            {speciesSlug: "carmine-bee-eater", whyItFits: "Thousands nest in the sand cliffs of the Linyanti and Chobe rivers from September, erupting in pink clouds as boats pass.", rarityHint: "Seasonal, September to November, spectacular at the colonies."},
            {speciesSlug: "african-jacana", whyItFits: "The lily-trotter walks on floating leaves beside every mokoro, picking insects from the water lilies.", rarityHint: "Very common in the Delta from a mokoro."},
            {speciesSlug: "malachite-kingfisher", whyItFits: "A tiny blue-and-orange kingfisher perched low on papyrus stems along every Okavango channel, usually noticed only from a slow boat.", rarityHint: "Common from a mokoro if you scan the reed edge."}
        ],
        bestFor: [
            "Safari travellers who want water-based game viewing from boats and mokoros.",
            "Predator fans; Moremi and Khwai are prime wild dog and leopard country.",
            "Photographers at the Chobe riverfront in the late dry season.",
            "Families who want the Makgadikgadi meerkat walk and the salt-pan night sky."
        ],
        spottingTips: [
            "Combine a dry-land camp in Moremi or Khwai with a water camp in the inner Delta; the species lists are very different.",
            "Take the afternoon boat cruise on the Chobe from Kasane between August and October for the elephant swims.",
            "From a mokoro, stay quiet and low; the poler will show you painted reed frogs, jacanas and sitatunga tracks you would never see from a vehicle.",
            "Khwai and the Linyanti allow night drives, which is when the honey badgers, civets and genets appear."
        ],
        relatedLocationSlugs: ["namibia", "south-africa", "african-safari"],
        rankingSlugs: ["biggest-animals", "animals-with-best-teamwork"],
        challengeSlugs: ["african-wild-dog-vs-hyena", "hippopotamus-vs-crocodile", "lion-vs-elephant"],
        faq: [
            {question: "What wildlife is there in Botswana?", answer: "Elephants in huge numbers, hippos, crocodiles, lions, leopards, cheetahs, African wild dogs, buffalo, giraffes, zebra, red lechwe, sitatunga and over 590 bird species including fish eagles, carmine bee-eaters and Pel's fishing owl. The Kalahari adds meerkats, brown hyenas and black-maned lions."},
            {question: "What animals can be found in Botswana?", answer: "The Big Five minus abundant rhino (small reintroduced populations exist), plus Botswana specialities: red lechwe and sitatunga in the Okavango, African wild dogs in Moremi, the Makgadikgadi zebra migration and habituated meerkats on the salt pans."},
            {question: "When is the best time to visit the Okavango Delta?", answer: "June to October, when the flood is high but the land is dry, so animals crowd the water and mokoro trips run everywhere. November to March is hot and wet with newborn animals and migrant birds, and the zebra are on the Makgadikgadi pans."},
            {question: "Is Botswana good for seeing wild dogs?", answer: "It is one of the best countries in Africa for them. Moremi Game Reserve, the Khwai concession and the Linyanti hold resident packs, and June to August, when they den, gives the most predictable sightings."}
        ]
    },
    {
        slug: "uganda",
        name: "Uganda",
        regionType: "country",
        hubRegion: "africa",
        countryCode: "UG",
        coordinate: {lat: 1.37, lng: 32.3, zoom: 6},
        captureArea: {countryCodes: ["UG"]},
        title: "Animals in Uganda: What You Can Spot, Learn, and Collect",
        description: "Uganda wildlife guide: mountain gorillas in Bwindi, Kibale chimpanzees, shoebills at Mabamba swamp, Murchison Falls hippos and elephants, tree-climbing lions in Ishasha.",
        searchIntents: [
            "animals in Uganda",
            "wildlife in Uganda",
            "what animals can be found in Uganda",
            "what wildlife is there in Uganda",
            "where to see gorillas in Uganda",
            "shoebill Uganda Mabamba",
            "Uganda wildlife travel"
        ],
        quickAnswer: "Uganda is the primate capital of Africa: about half the world's mountain gorillas live in Bwindi Impenetrable Forest, Kibale has the easiest chimpanzee tracking anywhere, and Queen Elizabeth and Murchison Falls add classic savanna game with hippos, elephants, Uganda kob and tree-climbing lions. Mabamba swamp on Lake Victoria is the most reliable place on earth to see a shoebill.",
        introduction: [
            "Uganda sits where the East African savanna meets the Congo rainforest, which is why its species list is so long for a small country. In one trip you can track gorillas in misty bamboo at 2,500 metres, watch chimpanzees drum on tree buttresses in Kibale, boat under Murchison Falls past hundreds of hippos, and paddle a canoe into a papyrus swamp an hour from Kampala to find a shoebill.",
            "The capital itself has wildlife: marabou storks nest on Kampala's office blocks, grey crowned cranes feed on the wetlands at the city edge, and Entebbe Botanical Gardens has black-and-white colobus and vervets in the trees above the lake."
        ],
        whyItMatters: [
            "Mountain gorillas are the great conservation success of the region, up from about 250 to over 1,000, and gorilla permits fund the parks and the communities around Bwindi. Spending an hour with a family is the best way a visitor can support that.",
            "Uganda also protects the shoebill, Africa's strangest bird, in the wetlands of Lake Victoria and the Nile, where a single prehistoric-looking bird standing in the papyrus is the reason many birders fly in."
        ],
        animalsToSpot: [
            {speciesSlug: "mountain-gorilla", whyItFits: "Bwindi Impenetrable National Park has over 20 habituated families across the Buhoma, Ruhija, Rushaga and Nkuringo sectors, and Mgahinga adds one more on the Virunga slopes.", rarityHint: "Guaranteed with a permit; the hike can take one to six hours."},
            {speciesSlug: "chimpanzee", whyItFits: "Kibale National Park has about 1,500 chimps and the most reliable tracking in Africa; Kyambura gorge in Queen Elizabeth and Budongo forest near Murchison are the alternatives.", rarityHint: "Over 90 percent success at Kibale; Ngamba Island sanctuary on Lake Victoria guarantees a look at rescued chimps."},
            {speciesSlug: "shoebill", whyItFits: "Mabamba swamp near Entebbe is the easiest shoebill site in the world, reached by motorised canoe through the papyrus channels; the Nile delta in Murchison Falls is the second.", rarityHint: "High odds at Mabamba with a local guide in the morning."},
            {speciesSlug: "grey-crowned-crane", whyItFits: "Uganda's national bird dances in pairs on wetland edges across the country, including the marshes along the Kampala to Entebbe road.", rarityHint: "Common in wetlands; declining, so every sighting counts."},
            {speciesSlug: "black-and-white-colobus", whyItFits: "Leaps through the canopy of Kibale, Bwindi and Entebbe Botanical Gardens with its white cape streaming behind it.", rarityHint: "Common in forest parks and at Entebbe Botanical Gardens."},
            {speciesSlug: "ugandan-kob", whyItFits: "The antelope on the national coat of arms crowds the Kasenyi plains of Queen Elizabeth and the Buligi grasslands of Murchison, with males holding breeding leks.", rarityHint: "Abundant in both savanna parks."},
            {speciesSlug: "hippopotamus", whyItFits: "The Kazinga Channel in Queen Elizabeth and the Nile below Murchison Falls hold some of the densest hippo populations in Africa, viewed from launch cruises.", rarityHint: "Guaranteed on the Kazinga and Murchison boat trips."},
            {speciesSlug: "crocodile", whyItFits: "Huge Nile crocodiles line the banks of the Victoria Nile below Murchison Falls, mouths open in the sun.", rarityHint: "Common on the Murchison launch trip."},
            {speciesSlug: "african-bush-elephant", whyItFits: "Murchison and Queen Elizabeth herds are recovering strongly, and Kidepo in the far north-east has big-tusked bulls on the Narus valley.", rarityHint: "Common in all three savanna parks."},
            {speciesSlug: "lion", whyItFits: "The Ishasha sector of Queen Elizabeth is famous for lions that rest in fig trees through the heat of the day; Murchison and Kidepo have conventional prides.", rarityHint: "Regular in Ishasha, Murchison and Kidepo; the tree-climbers need patience."},
            {speciesSlug: "great-blue-turaco", whyItFits: "A turkey-sized blue bird with a black crest that glides between fruiting trees in Kibale, Bwindi, Mabira and even Entebbe gardens.", rarityHint: "Common in forest; loud and conspicuous."},
            {speciesSlug: "marabou-stork", whyItFits: "Kampala's unofficial city bird, nesting on trees along the main roads and office blocks and scavenging at the markets.", rarityHint: "Abundant in Kampala; impossible to miss."},
            {speciesSlug: "olive-baboon", whyItFits: "Troops sit on the road verges at the Murchison and Queen Elizabeth gates and work the forest edge in Kibale, bold and best not fed.", rarityHint: "Common in all the parks; keep car windows up."},
            {speciesSlug: "african-fish-eagle", whyItFits: "Pairs call from dead trees along the Kazinga Channel, the Nile and Lake Mburo, and dive for tilapia beside the boats.", rarityHint: "Common on all the big lakes and rivers."}
        ],
        bestFor: [
            "Primate trips: gorillas, chimpanzees, golden monkeys and colobus in one itinerary.",
            "Birders chasing the shoebill, green-breasted pitta and 1,000-plus species.",
            "Travellers who want savanna game and rainforest without flying between countries.",
            "Families using Entebbe as a base for Mabamba, Ngamba Island and the botanical gardens."
        ],
        spottingTips: [
            "Book gorilla permits months ahead and choose the Bwindi sector by fitness level: Buhoma and Ruhija are usually shorter hikes than Rushaga and Nkuringo.",
            "At Mabamba, go early with a community guide; shoebills stand still in the papyrus and the boat has to approach slowly and quietly.",
            "In Queen Elizabeth, take the afternoon Kazinga Channel cruise for hippos, buffalo, elephants and dozens of waterbirds at close range.",
            "Wear long trousers and gaiters in Kibale and Bwindi; the trails are steep and the ants and nettles are real."
        ],
        relatedLocationSlugs: ["rwanda", "kenya", "tanzania", "ethiopia"],
        rankingSlugs: ["smartest-animals", "rarest-animals"],
        challengeSlugs: ["gorilla-vs-chimpanzee", "shoebill-vs-great-blue-heron"],
        faq: [
            {question: "What wildlife is there in Uganda?", answer: "Mountain gorillas in Bwindi and Mgahinga, chimpanzees in Kibale and Budongo, 13 primate species in all, savanna game including elephants, hippos, lions, buffalo and Uganda kob in Murchison Falls and Queen Elizabeth, and over 1,000 bird species headlined by the shoebill."},
            {question: "What animals can be found in Uganda?", answer: "About 340 mammal species and more than 1,000 birds. The signature animals are the mountain gorilla, chimpanzee, shoebill, grey crowned crane, Uganda kob, Rothschild's giraffe (in Murchison) and the tree-climbing lions of Ishasha."},
            {question: "Is Uganda or Rwanda better for gorilla trekking?", answer: "Uganda has far more habituated families and cheaper permits, and Bwindi's forest is wilder; Rwanda's Volcanoes park is closer to the airport and the treks are often shorter. Many people do Bwindi from Kigali, which is only four or five hours away."},
            {question: "Where can you see a shoebill in Uganda?", answer: "Mabamba swamp on the Lake Victoria shore near Entebbe is the most reliable site, by canoe with a local guide in the morning. The Nile delta in Murchison Falls National Park and Lake Mburo's Rubanga swamp are the other options."}
        ]
    },
    {
        slug: "rwanda",
        name: "Rwanda",
        regionType: "country",
        hubRegion: "africa",
        countryCode: "RW",
        coordinate: {lat: -1.94, lng: 29.87, zoom: 7},
        captureArea: {countryCodes: ["RW"]},
        title: "Animals in Rwanda: What You Can Spot, Learn, and Collect",
        description: "Rwanda wildlife guide: mountain gorillas and golden monkeys in Volcanoes NP, Nyungwe chimpanzees and colobus, Akagera's reintroduced lions and rhinos.",
        searchIntents: [
            "animals in Rwanda",
            "wildlife in Rwanda",
            "what animals can be found in Rwanda",
            "what wildlife is there in Rwanda",
            "Volcanoes National Park gorillas",
            "Akagera National Park animals",
            "Rwanda wildlife travel"
        ],
        quickAnswer: "Rwanda packs three very different parks into a country you can cross in a day. Volcanoes National Park on the Virunga slopes has a dozen habituated mountain gorilla families and troops of golden monkeys in the bamboo; Nyungwe Forest in the south-west has chimpanzees, huge colobus troops and a canopy walkway; and Akagera in the east has become a Big Five park again with reintroduced lions and black rhinos alongside hippos, giraffes and crowned cranes.",
        introduction: [
            "Rwanda rebuilt its wildlife with intent. Akagera, almost emptied of large animals by the late 1990s, now has lions brought in from South Africa, eastern black rhinos from across Africa and Europe, and growing herds of elephant, buffalo and giraffe on the lake-studded savanna. Volcanoes National Park's gorilla families are the most visited in the world and the permit income has transformed the villages around the park.",
            "The country is small and the roads are good, so gorillas in the morning and Kigali by evening is normal. Add Nyungwe, one of Africa's oldest montane rainforests, for chimpanzees, Ruwenzori colobus in troops of several hundred, and a forest bird list that keeps serious birders busy for days."
        ],
        whyItMatters: [
            "Rwanda proved that a densely populated country can bring large animals back. Akagera went from poached-out to Big Five in under a decade and the gorilla population in the Virungas has roughly doubled since the 1980s.",
            "The annual Kwita Izina ceremony, where baby gorillas are named in front of thousands of Rwandans, is the clearest sign anywhere in Africa that wildlife has become part of national identity."
        ],
        animalsToSpot: [
            {speciesSlug: "mountain-gorilla", whyItFits: "Volcanoes National Park has about a dozen habituated families on the slopes of Karisimbi, Bisoke and Sabyinyo, where Dian Fossey did her research, with treks starting from Kinigi.", rarityHint: "Guaranteed with a permit; hikes range from one to five hours."},
            {speciesSlug: "chimpanzee", whyItFits: "Nyungwe Forest has habituated communities tracked from the Uwinka and Gisakura sides, and a smaller group in Cyamudongo forest.", rarityHint: "Good odds at Nyungwe; the chimps move fast through steep forest."},
            {speciesSlug: "black-and-white-colobus", whyItFits: "Nyungwe's Ruwenzori colobus, the Angolan form of the black-and-white colobus rather than the guereza of Uganda and Kenya, live in troops of 300 to 400, the largest primate groups in Africa, crashing through the canopy near Gisakura.", rarityHint: "Near-certain on the colobus trek at Gisakura."},
            {speciesSlug: "lion", whyItFits: "Reintroduced to Akagera in 2015 after a twenty-year absence, the prides now hunt on the plains around the Kilala and Mutumba hills.", rarityHint: "Regular in Akagera, especially on the northern plains."},
            {speciesSlug: "black-rhinoceros", whyItFits: "Eastern black rhinos were returned to Akagera in 2017 and 2019 and now breed in the park's thicket country.", rarityHint: "Uncommon; a guide and a full day in the north give the best chance."},
            {speciesSlug: "african-bush-elephant", whyItFits: "Akagera's herds feed along the lakeshores and papyrus edges of Lake Ihema and Lake Hago.", rarityHint: "Regular around the lakes in Akagera."},
            {speciesSlug: "hippopotamus", whyItFits: "Lake Ihema holds one of the densest hippo populations in East Africa, seen from the boat trips that leave the Akagera park headquarters.", rarityHint: "Guaranteed on the Lake Ihema boat."},
            {speciesSlug: "giraffe", whyItFits: "Masai giraffes introduced from Kenya in the 1980s browse the acacia of central Akagera in growing numbers.", rarityHint: "Common in the central and southern park."},
            {speciesSlug: "plains-zebra", whyItFits: "Herds graze the open Mutumba plains in northern Akagera alongside topi and buffalo.", rarityHint: "Common in Akagera."},
            {speciesSlug: "topi", whyItFits: "Akagera is one of the few places outside the Serengeti ecosystem to see big topi herds, standing on termite mounds as lookouts.", rarityHint: "Common on the northern plains."},
            {speciesSlug: "grey-crowned-crane", whyItFits: "Rwanda's wetlands hold a recovering population after a campaign to free captive cranes; Rugezi marsh and the Akagera lakes are the strongholds.", rarityHint: "Regular in Akagera's wetlands and at Rugezi; also in Kigali's Umusambi Village (a rehabilitation centre)."},
            {speciesSlug: "shoebill", whyItFits: "A handful live in the papyrus swamps along the Akagera river and Lake Ihema, one of the species' southernmost outposts.", rarityHint: "Rare; a boat trip with a bird guide is the only realistic chance."},
            {speciesSlug: "crocodile", whyItFits: "Nile crocodiles bask on the shores of Lake Ihema and the Akagera river channels.", rarityHint: "Common on the Lake Ihema boat trip."},
            {speciesSlug: "african-fish-eagle", whyItFits: "Pairs call from the fig trees along Akagera's lakes and perch above Lake Kivu's shoreline near Gisenyi and Kibuye.", rarityHint: "Common on all the lakes."}
        ],
        bestFor: [
            "Gorilla trekkers who want short transfers and good lodges near the park.",
            "Travellers combining primates in Nyungwe with a classic savanna safari in Akagera.",
            "Birders; Nyungwe has over 300 species including 29 Albertine Rift endemics.",
            "People interested in how a country rebuilds its wildlife and ties it to community benefit."
        ],
        spottingTips: [
            "Gorilla permits are limited and expensive; book well ahead and stay in Kinigi or Musanze the night before to make the 7am briefing.",
            "In Nyungwe, do the canopy walkway early for turacos and sunbirds, then the colobus trek at Gisakura in the afternoon.",
            "Akagera is best as a two-night trip; take the Lake Ihema boat at sunset for hippos, crocodiles and fish eagles, and drive the northern plains at dawn for lions.",
            "Golden monkeys in Volcanoes National Park are a separate permit and an easier walk than the gorillas, good for a second day."
        ],
        relatedLocationSlugs: ["uganda", "tanzania", "kenya"],
        rankingSlugs: ["rarest-animals", "smartest-animals"],
        challengeSlugs: ["gorilla-vs-chimpanzee", "lion-vs-gorilla"],
        faq: [
            {question: "What wildlife is there in Rwanda?", answer: "Mountain gorillas and golden monkeys in Volcanoes National Park, chimpanzees and Ruwenzori colobus in Nyungwe Forest, and the Big Five plus hippos, giraffes, zebra, topi and crowned cranes in Akagera National Park. The country lists over 700 bird species."},
            {question: "What animals can be found in Rwanda?", answer: "Thirteen primate species headed by the mountain gorilla, reintroduced lions and black rhinos in Akagera, elephants, buffalo, hippos, crocodiles, Masai giraffe and a rich wetland bird fauna including grey crowned cranes and a few shoebills."},
            {question: "How hard is gorilla trekking in Rwanda?", answer: "It varies with the family you are assigned. Some groups are an hour from the trailhead through farmland and bamboo; others are four or five hours up steep, muddy slopes at over 3,000 metres. Porters are available and worth hiring."},
            {question: "Can you see the Big Five in Rwanda?", answer: "Yes, in Akagera National Park, since lions were reintroduced in 2015 and black rhinos in 2017. Leopards are present but shy, so a full Big Five sighting takes luck and a couple of days."}
        ]
    },
    {
        slug: "zanzibar",
        name: "Zanzibar",
        regionType: "island",
        hubRegion: "africa",
        countryCode: "TZ",
        parentSlug: "tanzania",
        coordinate: {lat: -6.16, lng: 39.30, zoom: 9},
        captureArea: {bbox: {north: -4.80, south: -6.55, east: 39.95, west: 39.05}},
        title: "Animals in Zanzibar: What You Can Spot, Learn, and Collect",
        description: "Zanzibar wildlife guide: red colobus in Jozani forest, dolphins at Kizimkazi, turtles and reef fish at Mnemba, Prison Island giant tortoises and mangrove crabs.",
        searchIntents: [
            "animals in Zanzibar",
            "wildlife in Zanzibar",
            "what animals can be found in Zanzibar",
            "what wildlife is there in Zanzibar",
            "Zanzibar red colobus Jozani",
            "snorkelling Mnemba Zanzibar marine life",
            "Zanzibar wildlife travel"
        ],
        quickAnswer: "Zanzibar's wildlife headline is the Zanzibar red colobus, a monkey found nowhere else, which is easy to see in Jozani-Chwaka Bay National Park. Beyond that it is a marine island: dolphins off Kizimkazi, green and hawksbill turtles and reef fish around Mnemba atoll, blacktip reef sharks on the drop-offs, giant tortoises on Prison Island and fiddler crabs and mudskippers in the Jozani mangroves.",
        introduction: [
            "Zanzibar is better known for beaches and Stone Town than for animals, but the island of Unguja has one genuinely unique primate and a reef system that rewards anyone with a mask. Jozani forest is a half-hour from the east coast resorts and the red colobus troops sit in the trees beside the boardwalk. The Jozani mangrove walk adds crabs, mudskippers and kingfishers.",
            "Offshore, Mnemba atoll off the north-east coast is the snorkelling and dive centre, Kizimkazi in the south runs dolphin trips, and Chumbe Island off Stone Town protects one of the best shallow reefs in East Africa. Pemba, the greener northern island, has its own flying fox and quieter reefs."
        ],
        whyItMatters: [
            "The Zanzibar red colobus numbers only a few thousand and lives only on this island, so Jozani is one of those places where a tourist stop supports the survival of a whole species.",
            "The island's reefs and turtle beaches are under pressure from fast-growing tourism, and operators that follow the rules at Mnemba and Kizimkazi are the ones worth choosing."
        ],
        animalsToSpot: [
            {speciesSlug: "dolphin", whyItFits: "Indo-Pacific bottlenose and humpback dolphins live off Kizimkazi on the south coast, where boats go out at dawn; Mnemba also has regular pods.", rarityHint: "Common at Kizimkazi in the morning; choose boats that do not chase or drop swimmers on the pods."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Grazes the seagrass around Mnemba and nests on the quiet beaches of Mnemba island and the north-east; Nungwi and Baraka aquariums hold rescued ones in sea pools.", rarityHint: "Regular for snorkellers at Mnemba; guaranteed at the Nungwi turtle pools (captive)."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Feeds on sponges along the Mnemba reef and the Chumbe Island coral garden and nests on a few east-coast beaches.", rarityHint: "Less common than greens; divers see them at Mnemba and Chumbe."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Small sharks cruise the shallow reef edge and sandy channels at Mnemba and inside the Chumbe reef at high tide.", rarityHint: "Regular for divers at Mnemba; harmless and skittish."},
            {speciesSlug: "moray-eel", whyItFits: "Peers from coral heads on the Chumbe reef and the Mnemba drop-off, and from the rocks off Stone Town's Prison Island.", rarityHint: "Common on every reef if you look into holes."},
            {speciesSlug: "lionfish", whyItFits: "Hangs under ledges on the Mnemba wall and the Stone Town wrecks, fins fanned out.", rarityHint: "Common on reef dives; keep hands clear."},
            {speciesSlug: "aldabra-giant-tortoise", whyItFits: "A colony on Changuu (Prison Island), a short boat ride from Stone Town, descends from four tortoises gifted by the Seychelles in 1919 and now includes animals over a century old.", rarityHint: "Guaranteed on Prison Island (a managed colony)."},
            {speciesSlug: "suni", whyItFits: "The Zanzibar suni, a hare-sized antelope, slips through the undergrowth of Jozani forest and the coral-rag thickets of the south-east.", rarityHint: "Uncommon and shy; dawn on the Jozani trails."},
            {speciesSlug: "tree-hyrax", whyItFits: "Tree hyraxes scream from the Jozani canopy after dark; the island's form is usually treated as the eastern tree hyrax, a close relative of the mainland species, and shares the forest with the endemic red colobus.", rarityHint: "Heard on night walks far more than seen."},
            {speciesSlug: "fiddler-crab", whyItFits: "Thousands wave their single big claw on the mud below the Jozani mangrove boardwalk and along the Chwaka Bay flats at low tide.", rarityHint: "Abundant at low tide on the mangrove walk."},
            {speciesSlug: "mudskipper", whyItFits: "Skips across the mud and climbs mangrove roots at Jozani and Michamvi, breathing air between tides.", rarityHint: "Common on mangrove edges at low tide."},
            {speciesSlug: "metopograpsus-messor", whyItFits: "Mangrove crabs scuttle over the roots and boardwalk posts at Jozani and in the mangroves behind Stone Town's Maruhubi ruins.", rarityHint: "Very common in any mangrove stand."},
            {speciesSlug: "house-crow", whyItFits: "Introduced Indian house crows swarm Stone Town and the resort beaches, stealing from tables and raiding nests of native birds.", rarityHint: "Abundant and invasive; log it as such."},
            {speciesSlug: "fruit-bat", whyItFits: "Pemba flying foxes roost in big colonies in Pemba's forests and the Kidike roost near Chake Chake, and smaller fruit bats stream over Stone Town at dusk.", rarityHint: "Guaranteed at Kidike on Pemba; dusk flights over Unguja are common."}
        ],
        bestFor: [
            "Beach holidays that want one guaranteed unique mammal in Jozani.",
            "Snorkellers and divers using Nungwi, Matemwe or Paje as a base for Mnemba and Chumbe.",
            "Families who like Prison Island tortoises and the Jozani mangrove boardwalk.",
            "Birders and bat watchers heading to the quieter island of Pemba."
        ],
        spottingTips: [
            "Visit Jozani in the early morning or late afternoon when the colobus feed low in the trees near the car park and the forest is cooler.",
            "Go to Mnemba on a day with little wind; the snorkelling is from boats and turtles are easiest at slack water.",
            "Kizimkazi dolphin trips are best at first light before the fleet arrives; pick an operator that keeps engines off near the pod.",
            "Night walks at Jozani or near Michamvi bring out hyraxes, bushbabies and chameleons; bring a red-filtered torch."
        ],
        relatedLocationSlugs: ["tanzania", "dar-es-salaam", "serengeti", "kenya"],
        rankingSlugs: ["rarest-animals"],
        challengeSlugs: ["dolphin-vs-shark-intelligence"],
        faq: [
            {question: "What wildlife is there in Zanzibar?", answer: "The endemic Zanzibar red colobus in Jozani forest, dolphins off Kizimkazi, green and hawksbill turtles and reef fish at Mnemba and Chumbe, blacktip reef sharks, giant tortoises on Prison Island, suni antelope and tree hyrax in the forest, and mangrove crabs and mudskippers along the coast."},
            {question: "What animals can be found in Zanzibar?", answer: "A small land fauna led by the red colobus, Sykes' monkey, suni, bushbaby and Pemba flying fox, with a much larger marine fauna of reef fish, turtles, dolphins, rays and the occasional whale shark in season."},
            {question: "Where can you see the Zanzibar red colobus?", answer: "Jozani-Chwaka Bay National Park, about 35 kilometres south-east of Stone Town, where habituated troops feed in the trees along the road and beside the visitor centre. Guided walks run all day and the fee includes the mangrove boardwalk."},
            {question: "Is swimming with dolphins in Zanzibar ethical?", answer: "It depends on the operator. The Kizimkazi pods are resident and heavily visited; boats that chase, box in or drop swimmers on top of them cause real harm. Choose a guide who keeps distance and let the dolphins approach if they choose."}
        ]
    },
    {
        slug: "dar-es-salaam",
        name: "Dar es Salaam",
        regionType: "city",
        hubRegion: "africa",
        countryCode: "TZ",
        parentSlug: "tanzania",
        coordinate: {lat: -6.79, lng: 39.28, zoom: 11},
        captureArea: {bbox: {north: -6.50, south: -7.20, east: 39.60, west: 38.95}},
        title: "Animals in Dar es Salaam: What You Can Spot, Learn, and Collect",
        description: "Dar es Salaam wildlife guide: reef fish and hermit crabs on Bongoyo island, nesting turtles at Kigamboni, vervets in the Pugu hills and the city's crows and egrets.",
        searchIntents: [
            "animals in Dar es Salaam",
            "wildlife in Dar es Salaam",
            "what animals can be found in Dar es Salaam",
            "what wildlife is there in Dar es Salaam",
            "wanyama Dar es Salaam",
            "Bongoyo island snorkelling",
            "Dar es Salaam wildlife travel"
        ],
        quickAnswer: "Dar es Salaam is a working port city, not a safari stop, but its coast is alive. Bongoyo and Mbudya islands in the marine reserve twenty minutes offshore have reef fish, morays and hermit crabs; the Kigamboni and Kunduchi beaches have nesting green turtles protected by Sea Sense; the Msimbazi creek and Kunduchi mangroves hold kingfishers, fiddler crabs and mudskippers; and the Pugu forest hills on the city edge have vervet monkeys, butterflies and forest birds. In the streets, pied crows, house crows and cattle egrets are the constant company.",
        introduction: [
            "Most travellers see Dar es Salaam only on the way to Zanzibar or the southern parks, which is a shame because the city sits on a coast with a protected marine reserve, mangrove creeks and the last coastal forest hills within reach of a daladala. A morning on Bongoyo island with a mask and an afternoon walk in the Pugu hills produce a surprisingly long list.",
            "The city itself has its own wildlife rhythm: cattle egrets flying to roost over Oyster Bay at dusk, giant land snails crossing wet garden paths after rain, tropical house geckos on every veranda ceiling, and the big, slow dragonflies that patrol the Coco Beach seafront. These are the species AnimalDex users in Dar realistically log, and they count."
        ],
        whyItMatters: [
            "Dar es Salaam's beaches are among the last mainland Tanzanian nesting sites for green turtles, and the community monitors who guard the nests at Kigamboni and Ras Kutani are a model for how a city of seven million can share its shore with wildlife.",
            "The Pugu and Kazimzumbwi forest reserves protect a remnant of East African coastal forest, one of the most threatened habitats on the continent, and public attention is part of what keeps the charcoal cutters out."
        ],
        animalsToSpot: [
            {speciesSlug: "house-crow", whyItFits: "The introduced Indian house crow is the most visible animal in Dar, mobbing fish markets, rooftops and hotel breakfast terraces across the whole city.", rarityHint: "Abundant and invasive everywhere."},
            {speciesSlug: "pied-crow", whyItFits: "The native black-and-white crow holds its own against the house crows on the city edge, around the University of Dar es Salaam and the Pugu road.", rarityHint: "Common on the outskirts, scarcer in the centre."},
            {speciesSlug: "cattle-egret", whyItFits: "Flocks follow the mowers on the golf course and the goats on the Kigamboni side, and stream over Oyster Bay to roost each evening.", rarityHint: "Abundant, especially at dusk."},
            {speciesSlug: "pied-kingfisher", whyItFits: "Hovers over the Msimbazi creek and the fish ponds along the Kunduchi road, and works the Kigamboni ferry channel at low tide.", rarityHint: "Common on any open water."},
            {speciesSlug: "vervet-monkey", whyItFits: "Troops live in the Pugu hills forest and along the Kigamboni coast around Ras Kutani, raiding fruit trees and beach bars.", rarityHint: "Regular at Pugu and on the south coast beaches."},
            {speciesSlug: "tropical-house-gecko", whyItFits: "The pale gecko on every lit veranda ceiling in Masaki and Mikocheni, snapping up moths and mosquitoes after dark.", rarityHint: "Guaranteed on any warm night."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Nests on the beaches south of the city at Kigamboni, Ras Kutani and Kimbiji, where Sea Sense monitors protect the nests and announce hatchings.", rarityHint: "Nesting March to July; hatchling releases are advertised locally and worth attending."},
            {speciesSlug: "dolphin", whyItFits: "Humpback and bottlenose dolphins pass the Kigamboni headlands and are seen from the Bongoyo and Mbudya boats on calm mornings.", rarityHint: "Occasional from the island boats; more regular off Kigamboni's southern beaches."},
            {speciesSlug: "hermit-crab", whyItFits: "Bongoyo island's beaches crawl with hermit crabs in borrowed shells, especially in the afternoon shade of the baobabs.", rarityHint: "Very common on Bongoyo and Mbudya."},
            {speciesSlug: "fiddler-crab", whyItFits: "Carpets the mud of the Kunduchi and Mbweni mangroves and the Mtoni creek at low tide, waving one oversized claw.", rarityHint: "Abundant at low tide in any mangrove."},
            {speciesSlug: "mudskipper", whyItFits: "Skips over the exposed mud at the Msimbazi river mouth and between mangrove roots at Kunduchi.", rarityHint: "Common at low tide."},
            {speciesSlug: "giant-african-land-snail", whyItFits: "Fist-sized snails cross garden paths and compound walls in Mikocheni and Mbezi after the long rains.", rarityHint: "Common in the rainy seasons, March to May and November."},
            {speciesSlug: "giant-african-millipede", whyItFits: "Glossy black millipedes as long as a forearm cross the Pugu forest trails and suburban gardens after rain.", rarityHint: "Common in the wet season on the city edge."},
            {speciesSlug: "wandering-glider", whyItFits: "The world's most widespread dragonfly patrols the Coco Beach seafront and every puddle and football pitch in the rains.", rarityHint: "Abundant in and after the rainy seasons."}
        ],
        bestFor: [
            "Travellers with a day in Dar before or after a safari or Zanzibar ferry.",
            "Snorkellers who want an easy half-day on Bongoyo or Mbudya island.",
            "City residents who want to log the real local wildlife rather than wait for a park trip.",
            "Families keen on turtle hatchling releases on the Kigamboni beaches."
        ],
        spottingTips: [
            "Take the Bongoyo boat from the Slipway in the morning and snorkel the north-west reef before the wind picks up after midday.",
            "Follow Sea Sense for turtle hatchling release dates at Kigamboni; they happen in the early morning and are open to the public.",
            "Walk the Pugu hills with a local guide early; the forest birds and vervets are active before 9am and the trails are hard to follow alone.",
            "Mangroves at Kunduchi and Mbweni are best an hour either side of low tide for crabs, mudskippers and waders."
        ],
        relatedLocationSlugs: ["tanzania", "zanzibar", "serengeti"],
        rankingSlugs: ["most-invasive-species"],
        faq: [
            {question: "What wildlife is there in Dar es Salaam?", answer: "Reef fish, morays and hermit crabs on Bongoyo and Mbudya islands, nesting green turtles on the Kigamboni beaches, kingfishers, crabs and mudskippers in the mangroves, vervet monkeys and forest birds in the Pugu hills, and crows, egrets, geckos and giant snails throughout the city."},
            {question: "What animals can be found in Dar es Salaam?", answer: "No large game in the city, but a lively coastal fauna: green and hawksbill turtles, dolphins offshore, over 200 bird species including pied kingfishers and egrets, vervets and bushbabies in the Pugu forest, and plenty of insects, geckos and land snails in gardens."},
            {question: "Is there a zoo or wildlife park in Dar es Salaam?", answer: "There is no major zoo. The Dar es Salaam Marine Reserve islands (Bongoyo, Mbudya, Pangavini and Fungu Yasini) are the main protected area, and the Pugu Hills forest reserve on the western edge is the nearest wild forest. Saadani National Park, with elephants and a beach, is about four hours north."},
            {question: "Can you see turtles in Dar es Salaam?", answer: "Yes. Green turtles nest on the south-coast beaches at Kigamboni, Ras Kutani and Kimbiji from March to July, and Sea Sense runs public hatchling releases. Snorkellers at Bongoyo and Mbudya occasionally see turtles over the reef."}
        ]
    },
    {
        slug: "serengeti",
        name: "Serengeti",
        regionType: "safari",
        hubRegion: "africa",
        countryCode: "TZ",
        parentSlug: "tanzania",
        coordinate: {lat: -2.33, lng: 34.83, zoom: 8},
        captureArea: {bbox: {north: -1.00, south: -3.60, east: 35.95, west: 33.80}},
        title: "Animals in the Serengeti: What You Can Spot, Learn, and Collect",
        description: "Serengeti wildlife guide: the wildebeest migration and river crossings, lions, leopards and cheetahs, black rhinos on the Ngorongoro crater floor and big-sky birds.",
        searchIntents: [
            "animals in the Serengeti",
            "wildlife in the Serengeti",
            "what animals can be found in the Serengeti",
            "what wildlife is there in the Serengeti",
            "Serengeti great migration when",
            "Ngorongoro crater animals",
            "Serengeti safari wildlife"
        ],
        quickAnswer: "The Serengeti holds about 1.5 million wildebeest and hundreds of thousands of zebra and gazelle that circle the ecosystem all year, followed by the largest lion population in Africa. Leopards sit in the kopjes and sausage trees of the Seronera valley, cheetahs hunt the short-grass plains in the south, and the neighbouring Ngorongoro crater floor is the most reliable place in Tanzania to see black rhino. Elephants, giraffes, hyenas, crocodiles at the river crossings and birds from ostrich to lilac-breasted roller fill in the rest.",
        introduction: [
            "The Serengeti is the one safari destination that lives up to the brochure. The migration is not a single event but a year-long loop: calving on the southern short-grass plains around Ndutu in January to March, the long trek north-west through the Western Corridor and the Grumeti river in May and June, the Mara river crossings in the north from July to October, and the return south with the November rains.",
            "Away from the herds, the central Seronera valley has resident lions, leopards and the big elephant herds, and the granite kopjes that break the plains are where cats rest and klipspringers stand sentry. The Ngorongoro crater on the ecosystem's eastern edge is a 260 square kilometre bowl with its own resident game, including black rhinos that are easy to find from the crater rim roads."
        ],
        whyItMatters: [
            "This is the last place on earth where a land migration of this size still runs unfenced. Watching a column of wildebeest stretch to the horizon, or a herd commit to a crocodile-filled river, is the closest thing to seeing Africa before people.",
            "The Serengeti is also where much of what we know about lions, hyenas and wild dogs was learned, through decades of continuous research at Seronera. Every tourist sighting of a collared lioness is part of that record."
        ],
        animalsToSpot: [
            {speciesSlug: "lion", whyItFits: "About 3,000 lions live in the ecosystem, the most anywhere in Africa; the Seronera and Moru kopjes prides are the most-watched and often rest on the rocks in plain view.", rarityHint: "Near-certain on any multi-day safari."},
            {speciesSlug: "leopard", whyItFits: "The sausage trees and yellow-barked acacias along the Seronera river are the classic leopard spot, with cats draped over branches in the heat of the day.", rarityHint: "Regular in Seronera; guides check the known trees each morning."},
            {speciesSlug: "cheetah", whyItFits: "Hunts Thomson's gazelle on the open short-grass plains around Ndutu, Gol and the Namiri plains in the east, where it can be watched running at full speed.", rarityHint: "Regular in the south and east, especially December to April."},
            {speciesSlug: "spotted-hyena", whyItFits: "Clans of dozens follow the migration and dominate many kills; they den in culverts and old aardvark burrows and are vocal all night around the camps.", rarityHint: "Abundant; dawn drives find them trotting home."},
            {speciesSlug: "blue-wildebeest", whyItFits: "The migration itself: over a million animals calving at Ndutu in February, crossing the Grumeti in June and the Mara river in the north from July to October.", rarityHint: "Guaranteed somewhere in the ecosystem; the location depends on the month."},
            {speciesSlug: "plains-zebra", whyItFits: "A few hundred thousand zebra move ahead of the wildebeest, grazing the long grass down, and are the first to test the river crossings.", rarityHint: "Abundant year-round."},
            {speciesSlug: "african-bush-elephant", whyItFits: "Big breeding herds live in the Seronera woodlands and the northern Lobo and Kogatende areas, and a few old bulls walk the Ngorongoro crater floor.", rarityHint: "Common in central and northern Serengeti."},
            {speciesSlug: "black-rhinoceros", whyItFits: "The Ngorongoro crater floor holds a closely guarded population that is seen from the crater roads most days, and the Moru kopjes in the Serengeti hold a small protected group.", rarityHint: "Likely at Ngorongoro; rare in the Serengeti proper."},
            {speciesSlug: "giraffe", whyItFits: "Masai giraffes browse the acacias of the Seronera valley and the northern woodlands, often in groups of a dozen or more.", rarityHint: "Common throughout the park except the open south."},
            {speciesSlug: "crocodile", whyItFits: "The Grumeti and Mara rivers hold enormous Nile crocodiles that wait all year for the migration crossings and take wildebeest in the shallows.", rarityHint: "Common at the river pools; dramatic at crossings."},
            {speciesSlug: "topi", whyItFits: "Stands on termite mounds across the Western Corridor and the northern plains, a glossy, long-faced antelope that the Serengeti has in bigger numbers than anywhere else.", rarityHint: "Common in the west and north."},
            {speciesSlug: "secretarybird", whyItFits: "Stalks the short grass in pairs, stamping on snakes and grasshoppers, and nests on flat-topped acacias across the plains.", rarityHint: "Regular on the open plains."},
            {speciesSlug: "lilac-breasted-roller", whyItFits: "The safari bird, perched on roadside shrubs and termite mounds across the whole park and flashing turquoise when it flies.", rarityHint: "Abundant; the first bird most visitors photograph."},
            {speciesSlug: "lappet-faced-vulture", whyItFits: "The biggest vulture on the plains, dominating carcasses after the hyenas leave and nesting on acacias in the south and around Ndutu.", rarityHint: "Regular at kills; declining across Africa, so worth logging."}
        ],
        bestFor: [
            "First-time safari travellers who want the classic plains, big cats and the migration.",
            "Photographers at the Ndutu calving season or the Mara river crossings.",
            "People combining the park with the Ngorongoro crater for rhinos.",
            "Birders; the park has over 500 species, from ostrich to tiny cisticolas."
        ],
        spottingTips: [
            "Choose your month and your region together: Ndutu for January to March, the Western Corridor for May and June, the north around Kogatende for July to October, and Seronera for resident game any time.",
            "River crossings cannot be scheduled; park at a crossing point in the north and wait, sometimes for hours.",
            "Check every kopje and every large tree near a river with binoculars; lions and leopards use the same rocks and branches day after day.",
            "Ngorongoro crater is best entered at the 6am gate opening before the crowds; rhinos are easiest in the Lerai forest and Gorigor swamp areas early."
        ],
        relatedLocationSlugs: ["tanzania", "masai-mara", "kenya", "zanzibar"],
        rankingSlugs: ["fastest-animals", "best-hunters", "biggest-animals"],
        challengeSlugs: ["lion-vs-hyena", "leopard-vs-cheetah", "giraffe-vs-lion"],
        faq: [
            {question: "What wildlife is there in the Serengeti?", answer: "The migrating herds of wildebeest, zebra and gazelle; Africa's largest lion population plus leopards, cheetahs and spotted hyenas; elephants, giraffes, buffalo, hippos and crocodiles; black rhinos in the Ngorongoro crater and at Moru; and over 500 bird species."},
            {question: "What animals can be found in the Serengeti?", answer: "About 70 large mammal species and 500 birds. The Big Five are all present, with rhino the hardest to see outside Ngorongoro, and the park's specialities are the migration, cheetahs on the short-grass plains, topi herds and the kopje-dwelling leopards and klipspringers."},
            {question: "When is the great migration in the Serengeti?", answer: "It never stops. The herds calve in the south around Ndutu from January to March, move through the Western Corridor in May and June, cross the Mara river in the north from July to October, and return south with the short rains in November and December."},
            {question: "Is the Serengeti or the Masai Mara better?", answer: "They are the same ecosystem across a border. The Serengeti is far bigger, less crowded and holds the migration for most of the year; the Mara is smaller, closer to Nairobi and has the densest predator viewing and the famous crossings from July to October."}
        ]
    },
    {
        slug: "masai-mara",
        name: "Masai Mara",
        regionType: "safari",
        hubRegion: "africa",
        countryCode: "KE",
        parentSlug: "kenya",
        coordinate: {lat: -1.49, lng: 35.14, zoom: 9},
        captureArea: {bbox: {north: -0.95, south: -1.95, east: 35.65, west: 34.70}},
        title: "Animals in the Masai Mara: What You Can Spot, Learn, and Collect",
        description: "Masai Mara wildlife guide: Mara river wildebeest crossings, the Marsh and Topi lion prides, cheetahs on the plains, leopards along the Talek, hippos and elephants.",
        searchIntents: [
            "animals in the Masai Mara",
            "wildlife in the Masai Mara",
            "what animals can be found in the Masai Mara",
            "what wildlife is there in the Masai Mara",
            "Masai Mara river crossing season",
            "Maasai Mara big cats",
            "Masai Mara safari wildlife"
        ],
        quickAnswer: "The Masai Mara has the densest big-cat viewing in Africa: lion prides made famous by television around Musiara marsh and the Talek river, cheetahs hunting on the open plains, and leopards along the wooded rivers. From July to October over a million wildebeest and zebra pour in from the Serengeti and cross the crocodile-filled Mara river. Elephants, buffalo, hippos, topi, eland, giraffes and more than 450 bird species fill the rest of the reserve and the surrounding conservancies.",
        introduction: [
            "The Mara is the Kenyan quarter of the Serengeti ecosystem, 1,500 square kilometres of rolling grassland cut by the Mara and Talek rivers. It is small enough that a good guide can find lions, cheetahs and leopards in a single day, and it is where the migration's river crossings happen, with wildebeest leaping from the banks into waiting crocodiles between July and October.",
            "Around the reserve, Maasai-owned conservancies such as Mara North, Naboisho, Olare Motorogi and Ol Kinyei limit vehicle numbers, allow night drives and walking, and now hold some of the best cheetah and lion viewing in the ecosystem with a fraction of the traffic."
        ],
        whyItMatters: [
            "The Mara's prides have been filmed and studied for decades, and they are the reason most people can picture a lion hunt. Seeing the Marsh pride's descendants, or a cheetah mother teaching cubs on the Posee plains, is watching those stories continue.",
            "The conservancy model around the reserve pays Maasai landowners to keep land open for wildlife instead of fencing it for cattle and crops, which is what has kept the ecosystem from shrinking."
        ],
        animalsToSpot: [
            {speciesSlug: "lion", whyItFits: "The Mara has one of the highest lion densities anywhere, with the Marsh, Topi, Rekero and Paradise prides holding territories along Musiara marsh, the Talek and the Mara river that guides check every morning.", rarityHint: "Near-certain daily."},
            {speciesSlug: "cheetah", whyItFits: "Hunts Thomson's gazelle on the open plains of the Mara triangle, the Posee plains and the Naboisho and Olare Motorogi conservancies, often using vehicles as shade and lookout posts.", rarityHint: "Regular; the conservancies give the calmest views."},
            {speciesSlug: "leopard", whyItFits: "Lives in the riverine forest along the Talek, Olare Orok and Mara rivers and is regularly found in fig trees above the water.", rarityHint: "Regular along the rivers with a patient guide."},
            {speciesSlug: "spotted-hyena", whyItFits: "Clans here outnumber lions and have been studied continuously since 1988; they follow the herds, den beside the tracks and contest kills at dawn.", rarityHint: "Abundant, especially early morning."},
            {speciesSlug: "blue-wildebeest", whyItFits: "The migration arrives from the Serengeti in July and masses on the Mara plains until October, with the crossings at the Mara river's Lookout, Serena and Cul-de-sac points.", rarityHint: "Guaranteed July to October; resident Loita herds year-round."},
            {speciesSlug: "hippopotamus", whyItFits: "Pods crowd the deep pools of the Mara river at the Hippo Pools and below the Mara Serena bridge, grunting all day and grazing the banks at night.", rarityHint: "Guaranteed at the Mara river pools."},
            {speciesSlug: "crocodile", whyItFits: "Five-metre Nile crocodiles lie on the Mara river sandbanks all year and feed heavily at the wildebeest crossings.", rarityHint: "Common on the Mara river banks."},
            {speciesSlug: "african-bush-elephant", whyItFits: "Breeding herds move between the Musiara marsh, the Mara triangle forest and the conservancies, and a few huge bulls still carry long tusks.", rarityHint: "Common throughout the reserve."},
            {speciesSlug: "cape-buffalo", whyItFits: "Herds of several hundred graze the marsh edges and old bulls wallow in the Talek, a favourite target of the bigger lion prides.", rarityHint: "Abundant."},
            {speciesSlug: "topi", whyItFits: "The Mara's signature antelope, standing on termite mounds across the plains with its purple thigh patches, and the namesake of the Topi pride.", rarityHint: "Abundant on the open grassland."},
            {speciesSlug: "common-eland", whyItFits: "Africa's largest antelope grazes the Mara plains and the conservancies in herds of twenty or more, with dewlapped bulls that weigh close to a tonne.", rarityHint: "Regular; bigger herds in the conservancies."},
            {speciesSlug: "superb-starling", whyItFits: "The glossy blue-and-orange starling that works every picnic site, lodge lawn and Maasai village in the ecosystem.", rarityHint: "Abundant and fearless at camps."},
            {speciesSlug: "bateleur", whyItFits: "A short-tailed eagle that rocks from side to side as it quarters the plains at low level, scanning for carcasses and small game.", rarityHint: "Regular overhead on sunny days."},
            {speciesSlug: "serval", whyItFits: "The long-legged cat hunts rodents in the tall grass of the Musiara marsh and the conservancies, and the Mara is one of Africa's best places to see one by day.", rarityHint: "Uncommon but regular in the marsh and at dawn in the conservancies."}
        ],
        bestFor: [
            "Big-cat fans who want lions, cheetahs and leopards in the same day.",
            "Migration watchers aiming for the Mara river crossings in August and September.",
            "Travellers who want night drives, walking safaris and fewer vehicles in the conservancies.",
            "Photographers; the open country and resident prides make for close, predictable sightings."
        ],
        spottingTips: [
            "Stay in a conservancy such as Mara North or Naboisho for calmer cat viewing, and drive into the reserve for the crossings.",
            "Crossings happen when the herds decide; park at a crossing point mid-morning and wait, and let the guide read the lead animals.",
            "Early morning is cheetah time; they hunt before the heat and before the vehicles, so leave camp at first light.",
            "Scan the fig and sausage trees along the Talek and Olare Orok for leopards, and the termite mounds for topi, cheetahs and servals."
        ],
        relatedLocationSlugs: ["kenya", "serengeti", "tanzania", "african-safari"],
        rankingSlugs: ["fastest-animals", "best-hunters", "stealthiest-hunters"],
        challengeSlugs: ["lion-vs-hyena", "leopard-vs-cheetah", "hippopotamus-vs-crocodile"],
        faq: [
            {question: "What wildlife is there in the Masai Mara?", answer: "Lions, cheetahs, leopards and spotted hyenas at some of the highest densities in Africa, the migrating wildebeest and zebra from July to October, resident elephants, buffalo, hippos, crocodiles, giraffes, topi and eland, and over 450 bird species."},
            {question: "What animals can be found in the Masai Mara?", answer: "About 95 mammal species including the Big Five (black rhino is present but scarce), plus servals, bat-eared foxes, jackals, hyenas, Masai giraffe, topi, eland, impala and the full savanna bird list from ostrich and secretarybird to lilac-breasted roller."},
            {question: "When is the best time to visit the Masai Mara?", answer: "July to October for the migration and the river crossings, when the reserve is also busiest. January to March is quieter with excellent resident cat viewing and newborn animals; April and May are wet and cheapest."},
            {question: "Is the Masai Mara safe for children?", answer: "Yes, most camps welcome children and the game drives are in open vehicles with experienced guides. Some conservancy camps set minimum ages for walking safaris and bush dinners, so check before booking."}
        ]
    },
    {
        slug: "kruger-national-park",
        name: "Kruger National Park",
        regionType: "park",
        hubRegion: "africa",
        countryCode: "ZA",
        parentSlug: "south-africa",
        coordinate: {lat: -24.0, lng: 31.5, zoom: 7},
        captureArea: {bbox: {north: -22.20, south: -25.60, east: 32.10, west: 30.80}},
        title: "Animals in Kruger National Park: What You Can Spot, Learn, and Collect",
        description: "Kruger National Park wildlife guide: Big Five self-drives, wild dogs and leopards in Sabi Sands, Sabie river hippos, ground hornbills, honey badgers and 500 bird species.",
        searchIntents: [
            "animals in Kruger National Park",
            "wildlife in Kruger National Park",
            "what animals can be found in Kruger National Park",
            "what wildlife is there in Kruger National Park",
            "Kruger Big Five",
            "Sabi Sands leopards",
            "Kruger safari wildlife"
        ],
        quickAnswer: "Kruger is the easiest place in Africa to see the Big Five on your own: lions, leopards, elephants, white rhinos and buffalo all live along the tarred roads of the southern park between Skukuza, Lower Sabie and Satara. The park and the private Sabi Sands and Timbavati reserves on its western edge also hold African wild dogs, spotted hyenas, hippos and crocodiles in the Sabie and Olifants rivers, big antelope such as kudu and nyala, and a bird list of over 500 species including the southern ground hornbill.",
        introduction: [
            "Kruger is almost 20,000 square kilometres, the size of a small country, with 2,000 kilometres of road and a dozen rest camps where you can self-drive, braai and walk to the fence at night. The southern third between the Crocodile and Sabie rivers has the densest game and the best chance of the Big Five in a weekend; the north around Punda Maria and Pafuri is wilder, hotter and the best birding in South Africa.",
            "The unfenced private reserves on the western boundary, Sabi Sands above all, are where Kruger's leopards became famous. Off-road driving and tracking there mean leopard sightings on most drives and regular encounters with wild dog packs and hyena dens that the public roads only hint at."
        ],
        whyItMatters: [
            "Kruger holds one of the largest white rhino populations on earth and has been the front line of the poaching crisis for over a decade. Every tourist vehicle on the southern roads is part of the deterrent, and every logged rhino sighting matters.",
            "It is also a park built for ordinary people: affordable rest camps, self-drive roads and a century of records mean a family in a hatchback can collect the same species as a luxury safari, and that accessibility is rare in Africa."
        ],
        animalsToSpot: [
            {speciesSlug: "lion", whyItFits: "About 1,600 lions live in the park; the roads around Satara, Lower Sabie and the S100 are classic lion country, and Sabi Sands prides are watched daily.", rarityHint: "Likely over a few days of self-driving; near-certain in Sabi Sands."},
            {speciesSlug: "leopard", whyItFits: "The Sabie river drive between Skukuza and Lower Sabie is the best public road for leopards, and Sabi Sands has the most habituated leopards in the world.", rarityHint: "Regular in Sabi Sands; luck on the public roads, best at dawn and dusk."},
            {speciesSlug: "african-bush-elephant", whyItFits: "Over 30,000 elephants fill the park, with big herds at the Letaba and Olifants rivers and bulls wandering through the rest camps' fence lines.", rarityHint: "Guaranteed anywhere in the park."},
            {speciesSlug: "white-rhinoceros", whyItFits: "The southern park between Pretoriuskop, Skukuza and Lower Sabie holds one of the largest rhino populations in Africa, grazing the open grass in small groups.", rarityHint: "Regular in the south; do not post sightings with locations."},
            {speciesSlug: "cape-buffalo", whyItFits: "Herds of hundreds cross the roads around Satara and drink at the Sabie and Olifants rivers in the dry season.", rarityHint: "Common throughout."},
            {speciesSlug: "african-wild-dog", whyItFits: "Kruger has one of the few viable wild dog populations left, with packs denning in the southern and central park in winter and regularly seen in Sabi Sands and Timbavati.", rarityHint: "Uncommon but realistic over a week; June to August denning season is best."},
            {speciesSlug: "impala", whyItFits: "The most numerous antelope in the park, in herds along every road, and the main prey of leopards, wild dogs and cheetahs.", rarityHint: "Abundant; the rutting roar of males fills the autumn evenings."},
            {speciesSlug: "greater-kudu", whyItFits: "Spiral-horned bulls stand in the mopane and riverine thicket along the Letaba and Shingwedzi rivers, melting into the bush when disturbed.", rarityHint: "Common across the park."},
            {speciesSlug: "hippopotamus", whyItFits: "The Sabie river pools at Lower Sabie and the Sunset Dam, the Olifants river and Lake Panic hide hundreds of hippos within view of the picnic sites.", rarityHint: "Guaranteed at Sunset Dam and the river viewpoints."},
            {speciesSlug: "southern-ground-hornbill", whyItFits: "Turkey-sized black birds with red faces walk the woodland in family groups, and Kruger is their most important stronghold in South Africa.", rarityHint: "Regular in the central and northern park."},
            {speciesSlug: "saddle-billed-stork", whyItFits: "Stalks the shallows of the Sabie, Letaba and Luvuvhu rivers, the tallest and most colourful of the park's storks.", rarityHint: "Regular on the rivers; scarce elsewhere in South Africa."},
            {speciesSlug: "honey-badger", whyItFits: "Raids rest camp bins at night and trots across the roads at dawn, and the park's camps have had to badger-proof their dustbins.", rarityHint: "Uncommon; night drives from the camps give the best odds."},
            {speciesSlug: "leopard-tortoise", whyItFits: "Crosses the tar roads after rain across the whole park, the biggest of the 'Little Five' and worth slowing down for.", rarityHint: "Common in the wet season, November to March."},
            {speciesSlug: "dung-beetle", whyItFits: "Rolls balls of elephant and rhino dung across the roads after summer rain, one of the Little Five and protected by a park rule against driving over them.", rarityHint: "Abundant after rain in summer."}
        ],
        bestFor: [
            "Self-drive safaris on a budget using the SANParks rest camps.",
            "Big Five first-timers who want them in a long weekend from Johannesburg.",
            "Leopard and wild dog fans staying in Sabi Sands or Timbavati.",
            "Birders heading to Pafuri and the Luvuvhu river in the far north."
        ],
        spottingTips: [
            "Be at the camp gate when it opens and drive the river roads first; the H4-1 along the Sabie and the S100 near Satara are the most productive tarred and gravel roads in the park.",
            "Drive slowly, 20 to 30 km/h, and stop at every waterhole and dam; most sightings come from scanning, not covering distance.",
            "Book a sunset or night drive from your rest camp; honey badgers, civets, genets and owls only show after dark.",
            "Winter (May to September) is the best game viewing: thin bush, dry waterholes and no malaria mosquitoes to speak of."
        ],
        relatedLocationSlugs: ["south-africa", "cape-town", "botswana", "african-safari"],
        rankingSlugs: ["most-dangerous-animals", "best-hunters", "animals-with-best-camouflage"],
        challengeSlugs: ["lion-vs-leopard", "elephant-vs-rhino", "honey-badger-vs-snake", "african-wild-dog-vs-hyena"],
        faq: [
            {question: "What wildlife is there in Kruger National Park?", answer: "All of the Big Five, with the largest white rhino and one of the largest elephant populations in Africa, plus African wild dogs, cheetahs, spotted hyenas, hippos, crocodiles, giraffes, zebra, kudu, nyala, impala and over 500 bird species."},
            {question: "What animals can be found in Kruger National Park?", answer: "About 147 mammal species, 507 birds, 114 reptiles and 49 fish. Visitors talk about the Big Five, the Little Five (elephant shrew, buffalo weaver, leopard tortoise, ant lion and rhino beetle) and the Big Six birds, led by the southern ground hornbill and saddle-billed stork."},
            {question: "Can you self-drive in Kruger National Park?", answer: "Yes, Kruger is designed for it. Tarred and gravel roads link a dozen rest camps, the gates open at dawn and close at dusk, and a normal car is fine. Guided drives and walks can be booked at every camp."},
            {question: "Which part of Kruger is best for the Big Five?", answer: "The south, between the Crocodile and Sabie rivers. Base yourself at Skukuza, Lower Sabie or Berg-en-Dal and drive the river roads; the Sabi Sands private reserve next door is the surest place for leopard."}
        ]
    },
    {
        slug: "cape-town",
        name: "Cape Town",
        regionType: "city",
        hubRegion: "africa",
        countryCode: "ZA",
        parentSlug: "south-africa",
        coordinate: {lat: -33.93, lng: 18.42, zoom: 10},
        captureArea: {bbox: {north: -33.55, south: -34.45, east: 18.95, west: 18.25}},
        title: "Animals in Cape Town: What You Can Spot, Learn, and Collect",
        description: "Cape Town wildlife guide: Boulders Beach penguins, Hout Bay fur seals, Table Mountain dassies, southern right whales in False Bay and the kelp-forest octopus.",
        searchIntents: [
            "animals in Cape Town",
            "wildlife in Cape Town",
            "what animals can be found in Cape Town",
            "what wildlife is there in Cape Town",
            "Boulders Beach penguins",
            "whale watching False Bay",
            "Cape Town wildlife travel"
        ],
        quickAnswer: "Cape Town is the only big city with a penguin colony on a swimming beach. Boulders Beach near Simon's Town has around 2,000 African penguins; Cape fur seals crowd Duiker Island off Hout Bay and the V&A Waterfront jetties; rock hyraxes (dassies) sun themselves on Table Mountain; southern right whales calve in False Bay from June to November; and great white sharks, bronze whalers, dolphins and the kelp-forest octopus live in the cold water around the peninsula. Cape Point has bontebok, eland, ostrich and baboons.",
        introduction: [
            "The Cape Peninsula is a national park with a city attached. Table Mountain National Park runs from the cableway down to Cape Point, and fynbos, cliffs and two oceans meet within a half-hour drive of the centre. That gives Cape Town a wildlife list no other city can match: a penguin colony, a whale nursery, a seal island, a mountain full of dassies and sunbirds, and the kelp forests that made My Octopus Teacher.",
            "In the suburbs, helmeted guineafowl march across lawns, Egyptian geese nest on office roofs, sacred ibis stalk the sports fields and hadedas scream at dawn. Kirstenbosch Botanical Garden on the mountain's eastern slope is the best place in the city for sugarbirds, sunbirds and spotted eagle-owls."
        ],
        whyItMatters: [
            "The African penguin has crashed by more than 90 percent in a century and Boulders is one of its few growing colonies, right next to a town. Visiting on the boardwalk, and not on the beach where the birds nest, is how the public helps keep it that way.",
            "False Bay is also where shark science and whale recovery meet: southern right whales have come back from near-extinction to calve in sight of the shore, while the great whites that made Seal Island famous have largely moved on since 2017, a change visitors can watch being studied."
        ],
        animalsToSpot: [
            {speciesSlug: "african-penguin", whyItFits: "The Boulders Beach colony at Simon's Town nests in the granite boulders and swims with bathers at Foxy Beach, viewed from the SANParks boardwalk; a second colony is at Stony Point in Betty's Bay.", rarityHint: "Guaranteed at Boulders year-round."},
            {speciesSlug: "seal", whyItFits: "Cape fur seals pack Duiker Island off Hout Bay, reached by a short boat trip, and loaf on the V&A Waterfront jetties; snorkelling with them is offered from Hout Bay.", rarityHint: "Guaranteed at Hout Bay and the Waterfront."},
            {speciesSlug: "rock-hyrax", whyItFits: "Dassies sun themselves on the rocks at the top of the Table Mountain cableway and around the Cape Point lighthouse, used to people but quick to vanish.", rarityHint: "Near-certain at the upper cable station on a sunny day."},
            {speciesSlug: "great-white-shark", whyItFits: "False Bay's Seal Island was the world's great white hotspot until 2017; the sharks are now scarce there, and cage-diving operators out of Gansbaai and Simon's Town mostly see bronze whalers with occasional whites.", rarityHint: "Rare in False Bay now; Gansbaai, two hours east, has better odds."},
            {speciesSlug: "southern-right-whale", whyItFits: "Mothers and calves rest in False Bay and off the Atlantic seaboard from June to November, visible from Boyes Drive, Clarence Drive and the Cape Point road.", rarityHint: "Common from land in winter and spring; September is peak."},
            {speciesSlug: "dusky-dolphin", whyItFits: "Pods ride the cold Atlantic water off Hout Bay and Cape Point and are seen from the Duiker Island boats and the Cape Point cliffs.", rarityHint: "Regular offshore; more often from boats than from shore."},
            {speciesSlug: "common-octopus", whyItFits: "The kelp forests of False Bay, where My Octopus Teacher was filmed, hide octopus in dens among the boulders at Windmill Beach and Miller's Point for snorkellers in 12-degree water.", rarityHint: "Regular for patient snorkellers and divers in the kelp."},
            {speciesSlug: "bontebok", whyItFits: "The Cape Point section of the park holds a herd of this once nearly extinct antelope, grazing the fynbos near the Olifantsbos and Buffels Bay roads.", rarityHint: "Regular at Cape Point."},
            {speciesSlug: "ostrich", whyItFits: "Wild ostriches walk the beaches and fynbos of Cape Point and are often photographed against the Atlantic surf at Olifantsbos.", rarityHint: "Common at Cape Point."},
            {speciesSlug: "cape-dwarf-chameleon", whyItFits: "A small chameleon of Cape Town gardens and fynbos, found on garden shrubs in the southern suburbs and at Kirstenbosch at night by torchlight.", rarityHint: "Common but very hard to see; a torch at night helps."},
            {speciesSlug: "angulate-tortoise", whyItFits: "Grazes the fynbos of Cape Point and the West Coast and crosses the roads on warm mornings; the most common tortoise on the peninsula.", rarityHint: "Regular at Cape Point in spring and summer."},
            {speciesSlug: "helmeted-guineafowl", whyItFits: "Flocks patrol the southern suburbs, Kirstenbosch lawns and golf courses, calling loudly at dusk.", rarityHint: "Abundant in the suburbs."},
            {speciesSlug: "egyptian-goose", whyItFits: "Nests on rooftops, roundabouts and the Company's Garden ponds, and honks over the city at dawn.", rarityHint: "Abundant everywhere there is grass and water."},
            {speciesSlug: "sacred-ibis", whyItFits: "Stalks sports fields, Rondebosch Common and the Rietvlei wetland, and roosts in the Zandvlei reedbeds.", rarityHint: "Common on open grass across the city."}
        ],
        bestFor: [
            "City-break travellers who want wildlife without a safari: penguins, seals and whales in a weekend.",
            "Snorkellers and cold-water divers exploring the False Bay kelp forests.",
            "Hikers on Table Mountain and the Cape Point trails with birds and dassies along the way.",
            "Families; Boulders, the Two Oceans Aquarium and Hout Bay seals are all easy with children."
        ],
        spottingTips: [
            "Arrive at Boulders before 9am or after 4pm; the penguins are most active, the light is better and the boardwalk is quieter.",
            "In whale season, drive Boyes Drive above Muizenberg or Clarence Drive past Gordon's Bay and stop at the lay-bys with binoculars.",
            "Snorkel the kelp at Windmill Beach at high tide on a calm day with a thick wetsuit; octopus, pyjama sharks and cuttlefish live in the boulders.",
            "Do not feed the Cape Point baboons and keep car windows up; they have learned to open doors."
        ],
        relatedLocationSlugs: ["south-africa", "kruger-national-park", "namibia"],
        rankingSlugs: ["most-dangerous-animals", "smartest-animals"],
        challengeSlugs: ["great-white-shark-vs-bull-shark", "orca-vs-great-white-shark", "dolphin-vs-octopus-intelligence"],
        faq: [
            {question: "What wildlife is there in Cape Town?", answer: "African penguins at Boulders Beach, Cape fur seals at Hout Bay and the Waterfront, rock hyraxes on Table Mountain, southern right whales and dolphins in False Bay, great white and bronze whaler sharks offshore, octopus and reef life in the kelp forests, and bontebok, eland, ostrich and chacma baboons at Cape Point."},
            {question: "What animals can be found in Cape Town?", answer: "No big game inside the city, but a long list of coastal and mountain species: penguins, seals, whales, dolphins, sharks, several antelope at Cape Point, baboons, porcupines, caracals (occasionally in the suburbs), tortoises, chameleons and over 300 bird species including sugarbirds, sunbirds and spotted eagle-owls."},
            {question: "When can you see whales in Cape Town?", answer: "Southern right whales are in False Bay and along the Atlantic coast from June to November, with August to October the peak; humpbacks pass in spring and summer. Hermanus, 90 minutes east, is the best land-based whale watching in the country."},
            {question: "Are there still great white sharks in False Bay?", answer: "Far fewer than before. Great whites largely disappeared from Seal Island after 2017, probably because of orca predation on sharks, and cage-diving trips now mostly see bronze whaler sharks. Gansbaai, two hours away, still has occasional great whites."}
        ]
    },
    {
        slug: "ethiopia",
        name: "Ethiopia",
        regionType: "country",
        hubRegion: "africa",
        countryCode: "ET",
        coordinate: {lat: 9.1, lng: 40.5, zoom: 5},
        captureArea: {countryCodes: ["ET"]},
        title: "Animals in Ethiopia: What You Can Spot, Learn, and Collect",
        description: "Ethiopia wildlife guide: gelada troops and walia ibex in the Simien Mountains, Ethiopian wolves on the Bale plateau, Harar's hyenas and Lake Tana pelicans.",
        searchIntents: [
            "animals in Ethiopia",
            "wildlife in Ethiopia",
            "what animals can be found in Ethiopia",
            "what wildlife is there in Ethiopia",
            "Simien Mountains gelada",
            "Ethiopian wolf Bale Mountains",
            "Ethiopia wildlife travel"
        ],
        quickAnswer: "Ethiopia's wildlife is mostly its own. Geladas, the grass-eating 'bleeding heart' monkeys, live in troops of hundreds on the Simien escarpment alongside walia ibex and lammergeiers; the Bale Mountains' Sanetti plateau is the best place in the world to see the Ethiopian wolf, the rarest canid on earth, and mountain nyala live on its slopes. Add Harar's hand-fed hyenas, Grevy's zebra and wild ass in the Afar lowlands, pelicans and hippos on Lake Tana, crocodiles at Lake Chamo and more than 30 endemic bird species.",
        introduction: [
            "Ethiopia's highlands rise above 4,000 metres, cut off from the rest of Africa for long enough to produce animals found nowhere else. In the Simien Mountains, geladas graze the cliff-top meadows and climb down the escarpment to sleep on ledges, and the walia ibex stands on crags above a kilometre of air. The Bale Mountains in the south hold the Afroalpine Sanetti plateau, where Ethiopian wolves hunt giant mole-rats in full view of the road.",
            "The lowlands are a different country: the Danakil and Afar deserts with camels, wild ass and Grevy's zebra at Alledeghi, the Rift Valley lakes with pelicans, flamingos and the 'crocodile market' at Lake Chamo, and the walled city of Harar, where hyena men feed spotted hyenas by hand every night."
        ],
        whyItMatters: [
            "With fewer than 500 Ethiopian wolves left, all in these highlands, and the gelada and walia ibex restricted to the same mountains, Ethiopia is the one place to see this set of animals. Tourism in the Simien and Bale parks is a direct income for the communities that share the land with them.",
            "Ethiopia also holds one of Africa's great endemic bird lists, from the wattled ibis and blue-winged goose to the thick-billed raven, which makes a highland trip rewarding even when the mammals stay hidden."
        ],
        animalsToSpot: [
            {speciesSlug: "gelada", whyItFits: "Troops of several hundred graze the meadows along the Simien escarpment between Sankaber and Chenek and let walkers sit within metres as they feed and squabble.", rarityHint: "Guaranteed in the Simien Mountains; also at Guassa and Debre Libanos near Addis."},
            {speciesSlug: "ethiopian-wolf", whyItFits: "The Sanetti plateau in Bale Mountains National Park holds the largest population, hunting giant mole-rats beside the highest all-weather road in Africa; a smaller group lives in the Simien.", rarityHint: "Likely on a day on the Sanetti plateau; the Simien wolves are harder."},
            {speciesSlug: "walia-ibex", whyItFits: "Found only in the Simien Mountains, where the Chenek camp area and the cliffs below Bwahit are the usual places to find them on the ledges at dawn.", rarityHint: "Regular around Chenek with a scout; the population is under 1,000."},
            {speciesSlug: "mountain-nyala", whyItFits: "Lives only in the Bale highlands and Arsi mountains; the Gaysay grassland and Dinsho headquarters area of Bale park have habituated herds.", rarityHint: "Near-certain at Dinsho and Gaysay."},
            {speciesSlug: "hamadryas-baboon", whyItFits: "The sacred baboon of ancient Egypt lives in big troops in the Awash and Afar lowlands and around the Rift Valley lakes, sleeping on cliffs in groups of hundreds.", rarityHint: "Common in Awash National Park and the eastern lowlands."},
            {speciesSlug: "lammergeier", whyItFits: "Bearded vultures patrol the Simien escarpment at eye level from the Chenek viewpoints, dropping bones onto rocks to break them.", rarityHint: "Regular in the Simien and Bale highlands."},
            {speciesSlug: "abyssinian-ground-hornbill", whyItFits: "Walks the savanna and farmland of the western and southern lowlands in pairs, a huge black bird with a blue and red throat.", rarityHint: "Regular in Awash, Gambella and the south."},
            {speciesSlug: "spotted-hyena", whyItFits: "In Harar, hyena men feed wild hyenas by hand at the city walls every night, a tradition centuries old; wild clans also roam Awash and the Bale lowlands.", rarityHint: "Guaranteed at Harar after dark; common in the lowland parks."},
            {speciesSlug: "grevys-zebra", whyItFits: "The Alledeghi plains north of Awash hold Ethiopia's remaining Grevy's zebra, alongside Soemmerring's gazelle and ostrich.", rarityHint: "Uncommon; a day trip from Awash with a guide."},
            {speciesSlug: "hippopotamus", whyItFits: "Pods live in Lake Tana near the Blue Nile outlet at Bahir Dar and in Lake Chamo at Arba Minch.", rarityHint: "Regular on the Lake Tana and Lake Chamo boat trips."},
            {speciesSlug: "crocodile", whyItFits: "Lake Chamo's 'crocodile market' is a shore where dozens of huge Nile crocodiles bask together, reached by boat from Arba Minch.", rarityHint: "Guaranteed at Lake Chamo."},
            {speciesSlug: "great-white-pelican", whyItFits: "Flocks fish the Rift Valley lakes, with Lake Ziway's harbour and Lake Tana's Bahir Dar shore giving close views.", rarityHint: "Common on the Rift Valley lakes."},
            {speciesSlug: "dromedary-camel", whyItFits: "Afar caravans carry salt from the Danakil depression and camels graze the acacia scrub around Awash and Harar.", rarityHint: "Guaranteed in the eastern lowlands; log as domestic."},
            {speciesSlug: "marabou-stork", whyItFits: "Stands in flocks on the Lake Ziway and Hawassa fish-market shores and scavenges on the edge of every Rift Valley town.", rarityHint: "Common around the lakes and towns."}
        ],
        bestFor: [
            "Trekkers who want geladas, ibex and vultures at 4,000 metres in the Simien Mountains.",
            "Wildlife travellers chasing the Ethiopian wolf and mountain nyala in Bale.",
            "Birders; over 860 species with 30-plus endemics.",
            "Culture-and-nature trips combining Lalibela, Harar's hyenas and the Rift Valley lakes."
        ],
        spottingTips: [
            "In the Simien, walk the escarpment between Sankaber and Chenek slowly; geladas are everywhere, and the scouts know where the ibex rest.",
            "Drive the Sanetti plateau road in Bale in the early morning and late afternoon when the wolves are hunting; stop and scan every few hundred metres.",
            "Hawassa's lakeside fish market at dawn has marabous, pelicans and hamerkops at arm's length.",
            "Altitude is real above 3,500 metres; give yourself a day to acclimatise in Debark or Dinsho before long walks."
        ],
        relatedLocationSlugs: ["kenya", "uganda", "egypt", "saudi-arabia"],
        rankingSlugs: ["rarest-animals", "most-resilient-animals"],
        challengeSlugs: ["lion-vs-hyena", "lappet-faced-vulture-vs-giant-tortoise"],
        faq: [
            {question: "What wildlife is there in Ethiopia?", answer: "Endemic highland mammals including the gelada, Ethiopian wolf, walia ibex and mountain nyala; hamadryas baboons, Grevy's zebra and wild ass in the lowlands; hippos, crocodiles and pelicans on the Rift Valley lakes; and more than 860 bird species with over 30 endemics."},
            {question: "What animals can be found in Ethiopia?", answer: "About 280 mammal species including 31 found nowhere else, lions in the Bale and Gambella lowlands, elephants in Babile and Omo, spotted hyenas almost everywhere, and a bird list that includes lammergeiers, wattled ibis, blue-winged geese, Abyssinian ground hornbills and thick-billed ravens."},
            {question: "Where can you see the Ethiopian wolf?", answer: "The Sanetti plateau in Bale Mountains National Park, about 400 kilometres south-east of Addis Ababa, holds more than half the world's population and the wolves hunt in daylight beside the road. The Simien Mountains and Guassa plateau have smaller numbers."},
            {question: "Is Ethiopia a safari destination?", answer: "Not in the classic sense. Big game is limited to a few lowland parks such as Awash, Omo and Gambella, and infrastructure is basic. Ethiopia is instead the place for endemic highland animals and birds, trekking with geladas and the unique Harar hyena feeding."}
        ]
    },
    {
        slug: "mauritius",
        name: "Mauritius",
        regionType: "island",
        hubRegion: "africa",
        countryCode: "MU",
        coordinate: {lat: -20.28, lng: 57.55, zoom: 9},
        captureArea: {countryCodes: ["MU"]},
        title: "Animals in Mauritius: What You Can Spot, Learn, and Collect",
        description: "Mauritius wildlife guide: pink pigeons in Black River Gorges, giant tortoises on Île aux Aigrettes, flying foxes at dusk, Tamarin Bay dolphins and lagoon turtles.",
        searchIntents: [
            "animals in Mauritius",
            "wildlife in Mauritius",
            "what animals can be found in Mauritius",
            "what wildlife is there in Mauritius",
            "animaux à Maurice",
            "Mauritius dolphins Tamarin Bay",
            "Mauritius wildlife travel"
        ],
        quickAnswer: "Mauritius lost the dodo but saved the pink pigeon, the Mauritius kestrel and the echo parakeet, all of which you can see in Black River Gorges National Park and on Île aux Aigrettes with the Mauritian Wildlife Foundation. The lagoon has green and hawksbill turtles and reef fish, spinner and bottlenose dolphins rest in Tamarin Bay every morning, humpbacks pass from July to October and sperm whales live off the west coast year-round. Giant Aldabra tortoises roam Île aux Aigrettes and the La Vanille reserve, and flying foxes fill the sky at dusk.",
        introduction: [
            "Mauritius is famous for what it lost, and the dodo is on every souvenir. The more interesting story is what was saved: the Mauritius kestrel was down to four wild birds in 1974 and now numbers several hundred, the pink pigeon came back from ten, and the echo parakeet from a few dozen. All three live in the forested south-west around Black River Gorges and on the restored island of Île aux Aigrettes, where guided walks run daily.",
            "Around the coast the lagoon inside the fringing reef is calm and shallow, which makes turtles and reef fish easy for snorkellers at Blue Bay and Trou aux Biches. Tamarin Bay on the west coast has resident dolphins, and the deep water just off Le Morne holds sperm whales and, in winter, humpbacks."
        ],
        whyItMatters: [
            "Mauritius wrote the playbook for island species recovery. The techniques used here for kestrels, pigeons and parakeets, from captive rearing to predator-free islands, are now used worldwide, and the Mauritian Wildlife Foundation walks on Île aux Aigrettes let visitors see the results.",
            "The island also shows what introduced animals do. Mynas, rose-ringed parakeets, mongooses and macaques are everywhere, and logging them honestly alongside the endemics tells the full story."
        ],
        animalsToSpot: [
            {speciesSlug: "pink-pigeon", whyItFits: "Rescued from ten birds, the pink pigeon now feeds at supplementary stations in Black River Gorges and on Île aux Aigrettes, where guided visits get very close.", rarityHint: "Reliable on Île aux Aigrettes and at the Pétrin and Bel Ombre feeding sites."},
            {speciesSlug: "aldabra-giant-tortoise", whyItFits: "Introduced to Île aux Aigrettes and Round Island to replace the extinct Mauritian tortoises as grazers; La Vanille Nature Park in the south has hundreds you can walk among.", rarityHint: "Guaranteed on Île aux Aigrettes and at La Vanille (managed populations)."},
            {speciesSlug: "fruit-bat", whyItFits: "The Mauritius flying fox, the island's last native mammal, streams out over the coast and the hotel gardens at dusk to feed on mangoes and lychees.", rarityHint: "Common at dusk across the island, especially in fruiting season."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Grazes seagrass inside the lagoon at Blue Bay marine park, Pointe d'Esny and off Trou aux Biches, where snorkellers see them from the beach.", rarityHint: "Regular for snorkellers at Blue Bay and Trou aux Biches."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Feeds on the outer reef slope at Blue Bay and the Coin de Mire drop-off, and is seen by divers more than snorkellers.", rarityHint: "Less common than green turtles; regular on dives."},
            {speciesSlug: "spinner-dolphin", whyItFits: "Pods rest in Tamarin Bay on the west coast every morning after feeding offshore, and boats from Black River go out at dawn to find them.", rarityHint: "Near-daily at Tamarin; choose boats that keep their distance."},
            {speciesSlug: "humpback-whale", whyItFits: "Passes the west coast between Le Morne and Flic en Flac from July to October, often visible from the Le Morne beaches and the Tamarin dolphin boats.", rarityHint: "Regular July to October offshore."},
            {speciesSlug: "sperm-whale", whyItFits: "A resident population lives over the deep water a few kilometres off the west coast and dedicated trips from Black River find them year-round.", rarityHint: "Regular on specialist trips; needs a permit-holding operator."},
            {speciesSlug: "white-tailed-tropicbird", whyItFits: "The paille-en-queue nests on the cliffs of Black River Gorges and the islets off the north coast and trails its long tail over the Chamarel waterfall.", rarityHint: "Common over the gorges and the coast."},
            {speciesSlug: "common-myna", whyItFits: "The loud, strutting myna owns every hotel terrace, car park and sugar-cane field on the island.", rarityHint: "Abundant everywhere."},
            {speciesSlug: "zebra-dove", whyItFits: "The tourterelle walks under restaurant tables and along beach paths in every coastal village.", rarityHint: "Abundant and approachable."},
            {speciesSlug: "rose-ringed-parakeet", whyItFits: "Introduced green parakeets screech over Port Louis and the coastal towns; be careful not to confuse them with the rarer endemic echo parakeet of the gorges.", rarityHint: "Common in towns and lowland gardens."},
            {speciesSlug: "moray-eel", whyItFits: "Peers from coral heads at Blue Bay and the Trou aux Biches reef, and from the rocks around Coin de Mire.", rarityHint: "Common on any reef snorkel."},
            {speciesSlug: "lionfish", whyItFits: "Hangs under ledges on the outer reef and the wrecks off Trou aux Biches and Grand Baie.", rarityHint: "Regular on dives; venomous, so look only."}
        ],
        bestFor: [
            "Beach holidays that want one serious conservation visit: Île aux Aigrettes or Black River Gorges.",
            "Snorkellers in the calm lagoon at Blue Bay, Trou aux Biches and Pointe d'Esny.",
            "Dolphin and whale watchers on the west coast between Tamarin and Le Morne.",
            "Families who like giant tortoises and flying foxes at dusk."
        ],
        spottingTips: [
            "Book the Mauritian Wildlife Foundation guided walk on Île aux Aigrettes from Pointe d'Esny; it is the single best place for pink pigeons, tortoises, Telfair's skinks and the restored ebony forest.",
            "Walk the Macchabée or Parakeet trails in Black River Gorges early for echo parakeets and kestrels; the Pétrin visitor centre has feeding times.",
            "Go to Tamarin Bay at first light and pick a dolphin operator that does not drop swimmers on the pod; the dolphins are resting there.",
            "Snorkel Blue Bay at high tide in the morning from the public beach; the turtles graze the seagrass in the middle of the bay."
        ],
        relatedLocationSlugs: ["reunion", "madagascar", "south-africa"],
        rankingSlugs: ["rarest-animals", "most-invasive-species"],
        challengeSlugs: ["honey-badger-vs-giant-tortoise"],
        faq: [
            {question: "What wildlife is there in Mauritius?", answer: "Rescued endemic birds including the pink pigeon, Mauritius kestrel and echo parakeet in Black River Gorges and on Île aux Aigrettes, the Mauritius flying fox, giant Aldabra tortoises on restored islands, spinner and bottlenose dolphins at Tamarin Bay, humpback and sperm whales offshore, and turtles and reef fish in the lagoon."},
            {question: "What animals can be found in Mauritius?", answer: "Only one native land mammal survives, the flying fox; the rest are introduced macaques, mongooses, deer and tenrecs. Birds include a handful of endemics and many introduced mynas, parakeets and doves. The sea is far richer, with turtles, dolphins, whales and hundreds of reef fish species."},
            {question: "Can you still see the dodo in Mauritius?", answer: "No, the dodo was extinct by about 1680. The Natural History Museum in Port Louis has a reconstructed skeleton, and Île aux Aigrettes gives the best feel for the forest it lived in, now home to the saved pink pigeons and tortoises."},
            {question: "Where is the best snorkelling for turtles in Mauritius?", answer: "Blue Bay Marine Park in the south-east, where green turtles graze seagrass inside the lagoon within swimming distance of the beach, and Trou aux Biches and Pointe aux Piments on the north-west coast."}
        ]
    },
    {
        slug: "saudi-arabia",
        name: "Saudi Arabia",
        regionType: "country",
        hubRegion: "asia",
        countryCode: "SA",
        coordinate: {lat: 24.0, lng: 45.0, zoom: 5},
        captureArea: {countryCodes: ["SA"]},
        title: "Animals in Saudi Arabia: What You Can Spot, Learn, and Collect",
        description: "Saudi Arabia wildlife guide: Arabian oryx at AlUla, hamadryas baboons in the Asir highlands, Red Sea whale sharks, Farasan gazelles, dugongs and Gulf flamingos.",
        searchIntents: [
            "animals in Saudi Arabia",
            "wildlife in Saudi Arabia",
            "what animals can be found in Saudi Arabia",
            "what wildlife is there in Saudi Arabia",
            "what animals live in the Arabian desert",
            "Red Sea Saudi Arabia marine life",
            "Saudi Arabia wildlife travel"
        ],
        quickAnswer: "Saudi Arabia's wildlife ranges from the Arabian oryx, back from extinction in the wild and now roaming the Sharaan reserve at AlUla and the Mahazat as-Sayd fences, to hamadryas baboons on the Asir and Taif escarpments, Nubian ibex in the mountains and sand cats, striped hyenas and spiny-tailed lizards in the desert. The Red Sea coast is the richest part: whale sharks off Al Lith, dugongs and turtles in the Farasan Islands, Napoleon wrasse and healthy reefs around Yanbu and Jeddah, and flamingos on the Gulf coast near Jubail.",
        introduction: [
            "Saudi Arabia opened to tourism in 2019 and most of its wildlife is still rarely visited. The country is 95 percent desert, but desert here means wadis with acacia and ibex, the Asir mountains rising to 3,000 metres with juniper forest and baboons, and lava fields and sandstone around AlUla where the Royal Commission is rewilding oryx, gazelles and ibex in the Sharaan reserve.",
            "The Red Sea is the other half. Saudi's coast has 1,800 kilometres of largely undived reef, from the Farasan Islands marine reserve in the south, with dugongs, turtles and the Farasan gazelle on the islands, to the whale shark aggregation off Al Lith and the drop-offs near Yanbu. On the Gulf side, the mudflats around Jubail and Tarut Bay hold flamingos and tens of thousands of wintering waders."
        ],
        whyItMatters: [
            "The Arabian oryx is the first species ever to go from extinct in the wild back to vulnerable, and Saudi Arabia's reserves hold the largest numbers. Seeing one against red sandstone at AlUla is a conservation story you can stand inside.",
            "The Saudi Red Sea reefs are among the least damaged in the region because so few people have dived them, and the giga-projects now planned along the coast make the next decade critical."
        ],
        animalsToSpot: [
            {speciesSlug: "arabian-oryx", whyItFits: "Reintroduced herds live in the Sharaan Nature Reserve at AlUla, the Mahazat as-Sayd protected area near Taif and the Uruq Bani Ma'arid reserve on the Empty Quarter edge.", rarityHint: "Regular on guided drives in Sharaan and Mahazat as-Sayd (fenced reserves)."},
            {speciesSlug: "hamadryas-baboon", whyItFits: "Big troops line the escarpment roads around Taif, Al Baha and Abha, sleeping on cliffs and begging at lay-bys, where feeding them has become a problem.", rarityHint: "Guaranteed on the Asir and Taif mountain roads; do not feed."},
            {speciesSlug: "nubian-ibex", whyItFits: "Lives on the cliffs of the Asir, the Hijaz mountains and the sandstone of AlUla and Tabuk, descending to wadis at dawn.", rarityHint: "Uncommon; the Sharaan reserve and Jabal Shada near Al Baha give the best chance."},
            {speciesSlug: "sand-cat", whyItFits: "Hunts gerbils in the sand seas of the Nafud and the Empty Quarter and has been recorded in the Mahazat as-Sayd and Uruq Bani Ma'arid reserves.", rarityHint: "Rare and nocturnal; tracks are the realistic record."},
            {speciesSlug: "striped-hyena", whyItFits: "Scavenges around desert villages and the Asir foothills at night and is still widespread though seldom seen.", rarityHint: "Rare; night drives in the reserves and roadside sightings."},
            {speciesSlug: "goitered-gazelle", whyItFits: "Arabian sand gazelles, treated by many as a form of the goitered gazelle, have been reintroduced to Mahazat as-Sayd, Uruq Bani Ma'arid and the AlUla reserves, while the Farasan Islands hold their own mountain gazelle population.", rarityHint: "Regular in the fenced reserves; the Farasan gazelles are seen on the main island."},
            {speciesSlug: "dromedary-camel", whyItFits: "Camels graze free across the whole country and gather at the Buraydah camel market and the King Abdulaziz Camel Festival outside Riyadh.", rarityHint: "Guaranteed anywhere outside the cities; log as domestic."},
            {speciesSlug: "spiny-tailed-lizard", whyItFits: "The dhub basks outside burrows on gravel plains across the Najd and the north and is still hunted for food in some areas.", rarityHint: "Common on warm mornings on open gravel plains."},
            {speciesSlug: "camel-spider", whyItFits: "Fast, hairy solifugids race across desert camps at night chasing insects under lamps.", rarityHint: "Common on summer nights in the desert."},
            {speciesSlug: "dugong", whyItFits: "The Red Sea population feeds on seagrass around the Farasan Islands and the Gulf population grazes the shallows off Jubail and Tarut Bay.", rarityHint: "Uncommon; boat trips in the Farasan marine reserve give the best odds."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Nests on the Farasan Islands and the Ras Baridi beaches north of Yanbu, and feeds on the reefs off Jeddah and Umluj.", rarityHint: "Regular for divers off Yanbu and Jeddah; nesting May to July."},
            {speciesSlug: "whale-shark", whyItFits: "Gathers off Al Lith south of Jeddah in spring, one of the Red Sea's few known aggregations, where snorkel trips find them at the surface.", rarityHint: "Seasonal, March to May off Al Lith."},
            {speciesSlug: "greater-flamingo", whyItFits: "Thousands winter on the Gulf coast mudflats at Jubail, Tarut Bay and Dammam, and smaller numbers use the Red Sea lagoons at Jizan.", rarityHint: "Common in winter on the Gulf coast."},
            {speciesSlug: "osprey", whyItFits: "Nests on the ground on the Farasan Islands and the Red Sea islets, one of the densest osprey populations anywhere, and fishes the lagoons year-round.", rarityHint: "Common along the Red Sea coast, especially the Farasan Islands."}
        ],
        bestFor: [
            "Travellers to AlUla who want oryx and ibex alongside the Nabataean tombs.",
            "Divers and snorkellers exploring undived Red Sea reefs from Jeddah, Yanbu or Al Lith.",
            "Birders on the Gulf coast in winter and the Asir highlands in spring.",
            "Desert campers who want to read tracks of sand cats, foxes and gerbils at dawn."
        ],
        spottingTips: [
            "Book the Sharaan reserve safari through Experience AlUla; independent access to the reserve is not allowed and the guides know where the oryx herds are.",
            "On the Taif and Abha escarpment roads, keep windows up around baboon troops and never feed them; it is what makes them dangerous.",
            "For whale sharks, go to Al Lith in April with a licensed operator; sightings depend on calm seas and plankton blooms.",
            "Gulf coast birding at Jubail and Tarut Bay is best two hours around high tide in winter, when the waders and flamingos are pushed close to the shore."
        ],
        relatedLocationSlugs: ["oman", "united-arab-emirates", "jordan", "egypt"],
        rankingSlugs: ["most-resilient-animals", "rarest-animals"],
        faq: [
            {question: "What wildlife is there in Saudi Arabia?", answer: "Arabian oryx, sand gazelles and Nubian ibex in the protected areas, hamadryas baboons in the south-western mountains, sand cats, striped hyenas, Arabian wolves and red foxes in the desert, spiny-tailed lizards and desert reptiles, and a Red Sea coast with whale sharks, dugongs, turtles, reef fish and ground-nesting ospreys."},
            {question: "What animals can be found in Saudi Arabia?", answer: "Around 80 mammal species, nearly 500 recorded birds including huge numbers of migrants, and a very rich Red Sea marine fauna. Most desert mammals are nocturnal, so the realistic daytime sightings are baboons, ibex, oryx in reserves, dhub lizards, camels and birds."},
            {question: "Can you see Arabian oryx in Saudi Arabia?", answer: "Yes, in the Sharaan Nature Reserve at AlUla on guided safaris, and in the Mahazat as-Sayd and Uruq Bani Ma'arid protected areas, where reintroduced herds now breed in large fenced landscapes."},
            {question: "Is the Saudi Red Sea good for diving?", answer: "Very good and still quiet. Jeddah has reefs and wrecks within an hour's boat ride, Yanbu has steep walls and sharks, Al Lith has whale sharks in spring, and the Farasan Islands in the south have dugongs, turtles and mangroves."}
        ]
    },
    {
        slug: "oman",
        name: "Oman",
        regionType: "country",
        hubRegion: "asia",
        countryCode: "OM",
        coordinate: {lat: 21.0, lng: 57.0, zoom: 5},
        captureArea: {countryCodes: ["OM"]},
        title: "Animals in Oman: What You Can Spot, Learn, and Collect",
        description: "Oman wildlife guide: nesting green turtles at Ras Al Jinz, Arabian leopards in Dhofar, humpback whales and dolphins off Muscat, Daymaniyat whale sharks and oryx.",
        searchIntents: [
            "animals in Oman",
            "wildlife in Oman",
            "what animals can be found in Oman",
            "what wildlife is there in Oman",
            "Ras Al Jinz turtles",
            "Daymaniyat Islands snorkelling",
            "Oman wildlife travel"
        ],
        quickAnswer: "Oman is the most wildlife-rich country on the Arabian peninsula. Green turtles nest every night of the year at Ras Al Jinz, and Masirah Island has the world's largest loggerhead nesting beach; the Daymaniyat Islands off Muscat have whale sharks, turtles and reef fish; Muscat's bays hold spinner dolphins and an isolated, non-migrating population of humpback whales; and the Dhofar mountains in the south are the last stronghold of the Arabian leopard, with Nubian ibex, hyrax and striped hyenas on the same cliffs. Arabian oryx roam the Al Wusta reserve.",
        introduction: [
            "Oman has mountains that reach 3,000 metres, a monsoon-green corner at Salalah, 3,000 kilometres of coast and the edge of the Empty Quarter, and the animals follow that variety. The coast is the easy part: Ras Al Jinz turtle reserve near Sur runs guided night and dawn walks to watch green turtles lay and hatchlings run to the sea, the Daymaniyat Islands north of Muscat are the best snorkelling in the Gulf region, and dolphin boats leave Muscat marina every morning.",
            "Inland is harder and more rewarding. Jabal Samhan in Dhofar holds a few dozen Arabian leopards, almost never seen but camera-trapped regularly, with ibex, hyrax, hyenas and Arabian wolves sharing the escarpment. Wadis in the Hajar mountains have Arabian tahr, and the gravel plains of Al Wusta have reintroduced oryx."
        ],
        whyItMatters: [
            "The Arabian Sea humpback whales off Oman are the only population in the world that does not migrate, isolated for tens of thousands of years, and there are fewer than 100 of them. Oman's coast is their whole world.",
            "Ras Al Jinz is one of the few places where turtle nesting is managed for tourism properly, with limited numbers and red lights, and visiting there supports the model. The Arabian leopard, with perhaps 200 left in the wild, depends on Dhofar's cliffs."
        ],
        animalsToSpot: [
            {speciesSlug: "green-sea-turtle", whyItFits: "Ras Al Jinz turtle reserve east of Sur has nesting every night of the year, with guided walks at 9pm and dawn; peak season sees dozens of females on the beach at once.", rarityHint: "Guaranteed on the guided walks; June to September is peak."},
            {speciesSlug: "loggerhead-sea-turtle", whyItFits: "Masirah Island hosts the largest loggerhead nesting population on earth, tens of thousands of nests a year on its eastern beaches.", rarityHint: "Nesting April to August on Masirah; needs a ferry and a local guide."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Nests on the Daymaniyat Islands in spring and feeds on the reefs there and at Bandar Khayran near Muscat.", rarityHint: "Regular for snorkellers at the Daymaniyats."},
            {speciesSlug: "humpback-whale", whyItFits: "The Arabian Sea population lives year-round off the Oman coast between Masirah and Dhofar, and is occasionally seen from Muscat dolphin boats.", rarityHint: "Rare and precious; the Hallaniyat Islands and Masirah give the best chance."},
            {speciesSlug: "spinner-dolphin", whyItFits: "Big pods feed off Muscat every morning and the boats from Bandar Al Rowdha and Al Mouj find them within half an hour.", rarityHint: "Near-daily on Muscat dolphin trips."},
            {speciesSlug: "whale-shark", whyItFits: "Gathers around the Daymaniyat Islands and Fahal Island off Muscat in late summer and autumn when the plankton blooms.", rarityHint: "Seasonal, August to October at the Daymaniyats."},
            {speciesSlug: "leopard", whyItFits: "The Arabian leopard, the smallest and rarest leopard, survives in Jabal Samhan Nature Reserve above Mirbat in Dhofar, where camera traps record a few dozen animals.", rarityHint: "Almost never seen in the wild; scrapes and camera-trap photos are the realistic record."},
            {speciesSlug: "arabian-oryx", whyItFits: "Reintroduced to the Al Wusta Wildlife Reserve on the Jiddat al-Harasis gravel plain, where the herds are kept in large fenced enclosures after poaching losses.", rarityHint: "Reliable at Al Wusta with permission from the reserve."},
            {speciesSlug: "nubian-ibex", whyItFits: "Lives on the Dhofar escarpment and in Jabal Samhan, and a separate population in the Hajar mountains, descending to wadi pools at dawn.", rarityHint: "Uncommon; dawn in the Jabal Samhan wadis."},
            {speciesSlug: "caracal", whyItFits: "Hunts rodents and birds in the Hajar and Dhofar mountains and is sometimes seen on night drives in Jabal Samhan.", rarityHint: "Rare; camera traps and night drives."},
            {speciesSlug: "striped-hyena", whyItFits: "Scavenges around Dhofar villages and the escarpment at night and is the most common large carnivore in Jabal Samhan.", rarityHint: "Uncommon but regular on night drives in Dhofar."},
            {speciesSlug: "rock-hyrax", whyItFits: "Colonies sun themselves on the boulders of the Dhofar escarpment around Wadi Darbat and Jabal Samhan.", rarityHint: "Common in Dhofar on sunny mornings."},
            {speciesSlug: "spiny-tailed-lizard", whyItFits: "Dhub lizards bask at burrow mouths on the gravel plains between Muscat and Sur and along the Al Wusta road.", rarityHint: "Common on warm mornings on gravel plains."},
            {speciesSlug: "greater-flamingo", whyItFits: "Flocks feed in the Barr Al Hikman and Masirah channel mudflats, one of the most important wader sites in the Middle East, and in the Salalah khawrs.", rarityHint: "Common in winter at Barr Al Hikman and the Salalah lagoons."}
        ],
        bestFor: [
            "Turtle watchers at Ras Al Jinz, the most reliable nesting site in the region.",
            "Snorkellers and divers at the Daymaniyat Islands and Bandar Khayran.",
            "Dolphin and whale watchers out of Muscat.",
            "Mountain and desert travellers heading to Dhofar's leopard country or the Al Wusta oryx reserve."
        ],
        spottingTips: [
            "Book Ras Al Jinz walks in advance and choose the dawn slot; the light is better, the crowd smaller, and hatchlings are often still running.",
            "Daymaniyat trips run from Al Mouj marina and Seeb; the islands are closed for seabird nesting from May to October, but snorkelling around them continues.",
            "In Dhofar, drive the Jabal Samhan plateau at dusk and dawn with a local guide; hyenas, foxes and hyraxes are realistic, the leopard is not.",
            "Barr Al Hikman is best in winter at rising tide; it is remote, so take a 4x4 and plenty of water."
        ],
        relatedLocationSlugs: ["united-arab-emirates", "saudi-arabia", "dubai"],
        rankingSlugs: ["rarest-animals", "biggest-animals"],
        challengeSlugs: ["leopard-vs-cheetah"],
        faq: [
            {question: "What wildlife is there in Oman?", answer: "Green, loggerhead and hawksbill turtles nesting on the coast, humpback whales, spinner dolphins and whale sharks offshore, reef fish around the Daymaniyat Islands, and in the mountains the Arabian leopard, Nubian ibex, Arabian tahr, caracal, striped hyena and rock hyrax. Arabian oryx live in the Al Wusta reserve and flamingos and waders fill the coastal lagoons."},
            {question: "What animals can be found in Oman?", answer: "About 80 mammal species including the rarest leopard in the world, over 500 bird species, five species of sea turtle and some 20 whale and dolphin species. Realistic sightings are turtles, dolphins, dhub lizards, hyraxes, camels and the migrant birds of the Salalah lagoons."},
            {question: "When is the best time to see turtles in Oman?", answer: "Green turtles nest at Ras Al Jinz all year, with the heaviest nesting from June to September, and hatchlings emerge about two months after laying. Loggerheads on Masirah nest from April to August."},
            {question: "Can you see Arabian leopards in Oman?", answer: "Realistically no. Jabal Samhan in Dhofar holds a few dozen, the largest wild population left, but they are nocturnal and extremely wary; visitors see tracks and scrapes, and the camera-trap images at the reserve. Supporting the Dhofar conservation work is the useful outcome."}
        ]
    },
    {
        slug: "jordan",
        name: "Jordan",
        regionType: "country",
        hubRegion: "asia",
        countryCode: "JO",
        coordinate: {lat: 31.2, lng: 36.5, zoom: 6},
        captureArea: {countryCodes: ["JO"]},
        title: "Animals in Jordan: What You Can Spot, Learn, and Collect",
        description: "Jordan wildlife guide: Nubian ibex and hyraxes in Dana, Arabian oryx and onagers at Shaumari, Azraq wetland flamingos and storks, Aqaba's Red Sea reef and Wadi Rum.",
        searchIntents: [
            "animals in Jordan",
            "wildlife in Jordan",
            "what animals can be found in Jordan",
            "what wildlife is there in Jordan",
            "Dana Biosphere Reserve wildlife",
            "Aqaba Red Sea snorkelling marine life",
            "Jordan wildlife travel"
        ],
        quickAnswer: "Jordan's wildlife sits in a chain of RSCN reserves. Dana Biosphere Reserve has Nubian ibex, rock hyrax, striped hyena and caracal on the cliffs above the Wadi Araba; Shaumari near Azraq breeds Arabian oryx and Persian onagers; Azraq wetland pulls flamingos, storks and millions of migrants through the desert each spring and autumn; Wadi Rum has camels, dhub lizards and blue Sinai agamas on the sandstone; and the Aqaba coast is the northern tip of the Red Sea reef, with lionfish, Napoleon wrasse and turtles a few metres off the beach.",
        introduction: [
            "Jordan is small and mostly desert, but it bridges Africa, Asia and Europe, which makes it a crossroads for animals as much as people. Dana, the country's biggest reserve, drops 1,600 metres from Mediterranean oak forest to Saharan sand in a single valley and holds ibex, hyenas, wolves and over 200 bird species. Mujib, on the Dead Sea shore, is the lowest nature reserve on earth, with ibex on its cliffs and hyraxes in its canyons.",
            "Azraq oasis in the eastern desert was once a vast wetland; what remains is still a magnet for migrating birds, and the neighbouring Shaumari reserve is where the Arabian oryx was first bred back in the Middle East. At Aqaba, the Red Sea's northernmost coral reefs sit right off the public beaches and the marine park."
        ],
        whyItMatters: [
            "Shaumari was the first reserve in the region to bring the Arabian oryx back from captive stock in 1978, and Dana pioneered the idea that a reserve can fund local villages through ecotourism. Both models spread across the Middle East from here.",
            "Jordan's position on the Rift Valley flyway means that hundreds of thousands of raptors, storks and pelicans pass over Aqaba and Azraq twice a year, one of the great bird migrations on the planet, visible from a hotel balcony."
        ],
        animalsToSpot: [
            {speciesSlug: "arabian-oryx", whyItFits: "Shaumari Wildlife Reserve near Azraq holds the herd that began the species' return to the Middle East, viewed from the reserve's safari vehicles and watchtower.", rarityHint: "Reliable at Shaumari (a fenced breeding reserve); also in Wadi Rum's protected area in small numbers."},
            {speciesSlug: "onager", whyItFits: "Persian onagers were brought to Shaumari to replace Jordan's extinct Syrian wild ass and now run alongside the oryx on the reserve's plains.", rarityHint: "Reliable at Shaumari (managed herd)."},
            {speciesSlug: "nubian-ibex", whyItFits: "Dana Biosphere Reserve and the Mujib cliffs above the Dead Sea hold the strongest populations, and Mujib's reintroduced herd is seen from the reserve's trails and the Dead Sea road.", rarityHint: "Regular at Mujib and Dana at dawn and dusk."},
            {speciesSlug: "striped-hyena", whyItFits: "Dana's night-time scavenger, leaving tracks on the Wadi Dana trail and sometimes seen in headlights on the roads around the reserve.", rarityHint: "Uncommon; tracks and night sightings."},
            {speciesSlug: "caracal", whyItFits: "Hunts birds and rodents in Dana's rocky valleys and the Ajloun forests, and is camera-trapped regularly in both.", rarityHint: "Rare; camera traps are the realistic record."},
            {speciesSlug: "rock-hyrax", whyItFits: "Colonies sun themselves on the boulders at Petra, in Wadi Mujib's canyon and along the Dana trails, whistling alarms as hikers pass.", rarityHint: "Common at Petra and Dana on sunny days."},
            {speciesSlug: "spiny-tailed-lizard", whyItFits: "Dhub lizards bask at burrow mouths on the gravel plains of Wadi Rum and the eastern desert around Azraq.", rarityHint: "Common on warm mornings in Wadi Rum."},
            {speciesSlug: "golden-jackal", whyItFits: "Jackals yip at dusk around Dana village, the Azraq fields and the Jordan valley farms, and trot along the Wadi Rum camp edges after the fires die down.", rarityHint: "Heard most evenings in the reserves; seen in headlights on the Dana and Azraq roads."},
            {speciesSlug: "dromedary-camel", whyItFits: "Bedouin camels carry visitors through Wadi Rum and graze free across the desert, and the camel race track at Disi hosts winter races.", rarityHint: "Guaranteed in Wadi Rum; log as domestic."},
            {speciesSlug: "greater-flamingo", whyItFits: "Flocks stop at the Azraq wetland pools on migration and a few winter when water levels allow.", rarityHint: "Seasonal at Azraq, mainly spring and autumn."},
            {speciesSlug: "white-stork", whyItFits: "Hundreds of thousands pass over the Jordan valley and Azraq on migration between Europe and Africa, with flocks resting in the Azraq fields.", rarityHint: "Spectacular in March to April and August to September."},
            {speciesSlug: "steppe-eagle", whyItFits: "Migrates through the Rift Valley over Aqaba and the Dead Sea in large numbers each spring and autumn, with Azraq and Dana as stopover sites.", rarityHint: "Regular on migration; count them from Dana's viewpoints."},
            {speciesSlug: "lionfish", whyItFits: "Hangs under coral ledges at the Aqaba Marine Park reefs and the Cedar Pride wreck, metres from the shore.", rarityHint: "Common on any Aqaba snorkel or dive."},
            {speciesSlug: "napoleon-wrasse", whyItFits: "Big humphead wrasse patrol the Aqaba reef walls at the Japanese Garden and Seven Sisters sites.", rarityHint: "Regular for divers at Aqaba; occasional from the surface."}
        ],
        bestFor: [
            "Hikers in Dana and Mujib who want ibex, hyraxes and raptors with their canyons.",
            "Travellers combining Petra and Wadi Rum with a look at desert reptiles and camels.",
            "Birders on the Rift Valley flyway in spring and autumn at Azraq and Aqaba.",
            "Snorkellers and divers using Aqaba's shore reefs and wrecks."
        ],
        spottingTips: [
            "Stay a night in Dana village or at Feynan Ecolodge and walk the Wadi Dana trail at dawn; the ibex and hyraxes are on the cliffs before the heat.",
            "Visit Shaumari and Azraq together from Amman; the oryx safari runs on fixed times and the wetland is best early morning.",
            "At Aqaba, snorkel from the Marine Park beaches or the South Beach; the reef starts within 20 metres of shore.",
            "In Wadi Rum, ask your Bedouin guide to stop at dhub burrows and sunlit rock faces; the agamas and lizards are easy to miss from a moving pickup."
        ],
        relatedLocationSlugs: ["israel", "egypt", "saudi-arabia"],
        rankingSlugs: ["most-resilient-animals", "rarest-animals"],
        faq: [
            {question: "What wildlife is there in Jordan?", answer: "Nubian ibex, rock hyrax, striped hyena, caracal and Arabian wolf in the Dana and Mujib reserves; reintroduced Arabian oryx and Persian onagers at Shaumari; flamingos, storks and huge numbers of migrant birds at Azraq; desert reptiles such as the dhub and Sinai agama in Wadi Rum; and Red Sea reef life at Aqaba."},
            {question: "What animals can be found in Jordan?", answer: "Around 80 mammal species, more than 400 recorded birds and over 100 reptiles. Most mammals are nocturnal and shy, so the realistic daytime sightings are ibex, hyraxes, camels, lizards and birds, plus reef fish and turtles at Aqaba."},
            {question: "Where is the best place to see wildlife in Jordan?", answer: "Dana Biosphere Reserve for mammals and birds, Shaumari for oryx and onagers, Azraq for migrating birds, Wadi Mujib for ibex above the Dead Sea, and the Aqaba Marine Park for Red Sea reef life. All are run or co-managed by the RSCN."},
            {question: "Can you snorkel with turtles in Aqaba?", answer: "Sometimes. Green and hawksbill turtles feed on the Aqaba reefs and are seen by divers at the Japanese Garden and Cedar Pride wreck sites, but they are far less common than in Egypt's Red Sea. Lionfish, wrasse, morays and clouds of reef fish are the reliable sightings."}
        ]
    },
    {
        slug: "united-arab-emirates",
        name: "United Arab Emirates",
        regionType: "country",
        hubRegion: "asia",
        countryCode: "AE",
        coordinate: {lat: 24.3, lng: 54.3, zoom: 7},
        captureArea: {countryCodes: ["AE"]},
        title: "Animals in the United Arab Emirates: What You Can Spot, Learn, and Collect",
        description: "UAE wildlife guide: Ras Al Khor flamingos in Dubai, Arabian oryx and sand gazelles in the desert reserves, Sir Bani Yas Island, Abu Dhabi's dugongs and dhub lizards.",
        searchIntents: [
            "animals in the United Arab Emirates",
            "wildlife in the UAE",
            "what animals can be found in the United Arab Emirates",
            "what wildlife is there in the UAE",
            "what animals live in the UAE desert",
            "Ras Al Khor flamingos",
            "UAE wildlife travel"
        ],
        quickAnswer: "The UAE keeps more wildlife than its skyline suggests. Greater flamingos feed at Ras Al Khor in the middle of Dubai; Arabian oryx and sand gazelles roam the Dubai Desert Conservation Reserve and Sir Bani Yas Island; Abu Dhabi's shallow Gulf waters hold the second-largest dugong population in the world plus hawksbill and green turtles and humpback dolphins; dhub lizards, sand cats and Arabian foxes live in the dunes; and Al Ain Zoo and the Sir Bani Yas safari add Arabian and African species in managed settings.",
        introduction: [
            "The Emirates are two habitats, desert and sea, with cities in between. The desert is not empty: the Dubai Desert Conservation Reserve, Al Marmoom and the Al Wathba wetland outside Abu Dhabi hold oryx, gazelles, foxes and thousands of flamingos, and the dunes are busy with dhubs, geckos and beetles once the sun drops. Sir Bani Yas Island, off the western coast, is a 1970s wildlife project turned safari island with free-roaming oryx, gazelles, giraffes and cheetahs behind the fence.",
            "The Gulf side of Abu Dhabi, with Bu Tinah and the Marawah marine reserve, is seagrass and coral country for dugongs, turtles and dolphins, while Dubai's Ras Al Khor sanctuary is a flamingo lagoon with a skyline backdrop. For the city of Dubai itself, including the aquarium and the Ras Al Khor hides, see the separate Dubai page."
        ],
        whyItMatters: [
            "Abu Dhabi's dugong herd, about 3,000 animals, is the largest outside Australia and depends on seagrass beds right beside one of the fastest-developing coasts on earth. Its protection in the Marawah reserve is one of the Gulf's most important conservation decisions.",
            "The UAE was also central to bringing the Arabian oryx back, breeding herds that were later released across the peninsula, and Sir Bani Yas and the Dubai reserve are where visitors can see that work on the ground."
        ],
        animalsToSpot: [
            {speciesSlug: "greater-flamingo", whyItFits: "Ras Al Khor Wildlife Sanctuary in Dubai has free hides where hundreds of flamingos feed against the towers, and Al Wathba wetland near Abu Dhabi hosts a breeding colony of thousands.", rarityHint: "Guaranteed at Ras Al Khor in winter; Al Wathba from October to April."},
            {speciesSlug: "arabian-oryx", whyItFits: "Herds roam the 225 square kilometre Dubai Desert Conservation Reserve, Al Marmoom and Sir Bani Yas Island, and the UAE bred much of the stock used to restore the species.", rarityHint: "Reliable on desert safaris in the DDCR and on Sir Bani Yas (fenced reserves)."},
            {speciesSlug: "goitered-gazelle", whyItFits: "Arabian sand gazelles, treated by many as a form of the goitered gazelle, graze the DDCR and Sir Bani Yas, and mountain gazelles live on the same reserves.", rarityHint: "Regular on reserve safaris."},
            {speciesSlug: "dugong", whyItFits: "Around 3,000 feed on the seagrass beds of the Marawah marine reserve and Bu Tinah shoals west of Abu Dhabi, the largest population outside Australia.", rarityHint: "Rarely seen by visitors; the Bu Tinah area is restricted. Jubail Mangrove Park kayak trips occasionally spot them."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Nests on Sir Bu Nair and the Abu Dhabi islands in spring and feeds on the Gulf reefs; the Dubai Turtle Rehabilitation Project at Jumeirah releases rescued ones each year.", rarityHint: "Nesting March to June on protected islands; rescued turtles are on view at the Burj Al Arab turtle lagoon (a rehabilitation centre)."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Grazes the seagrass of the Abu Dhabi islands and Ras Al Khaimah coast and is a regular sight from the Jubail Mangrove Park kayaks.", rarityHint: "Regular in the Abu Dhabi mangroves and shallows."},
            {speciesSlug: "dolphin", whyItFits: "Indo-Pacific humpback and bottlenose dolphins live in Abu Dhabi's channels and off Dubai's coast and are seen from the Jubail mangroves and the Palm Jumeirah boats.", rarityHint: "Regular on coastal boat trips."},
            {speciesSlug: "dromedary-camel", whyItFits: "Racing camels train at Al Marmoom and Al Wathba every morning, and free-grazing herds cross the Liwa and Al Ain roads.", rarityHint: "Guaranteed on any desert drive; log as domestic."},
            {speciesSlug: "spiny-tailed-lizard", whyItFits: "The dhub sits outside its burrow on the gravel plains of the DDCR and the Al Ain road at mid-morning, and is a protected species in the UAE.", rarityHint: "Common in the reserves on warm mornings."},
            {speciesSlug: "sand-cat", whyItFits: "Rediscovered in Abu Dhabi's western desert in 2015 by camera traps and now known from several sites around Baynouna and the Liwa dunes.", rarityHint: "Very rare; a camera-trap animal, not a sighting to plan for."},
            {speciesSlug: "osprey", whyItFits: "Nests on the Abu Dhabi islands and fishes the lagoons at Ras Al Khor and Khor Kalba on the east coast.", rarityHint: "Regular along the coast in winter."},
            {speciesSlug: "rose-ringed-parakeet", whyItFits: "Flocks screech over the parks of Dubai, Sharjah and Abu Dhabi, an introduced species now one of the commonest city birds.", rarityHint: "Abundant in city parks."},
            {speciesSlug: "common-myna", whyItFits: "The default bird of every café terrace, car park and lawn in the Emirates.", rarityHint: "Abundant everywhere."},
            {speciesSlug: "cheetah", whyItFits: "Sir Bani Yas Island's Arabian Wildlife Park keeps cheetahs in a large fenced landscape alongside the oryx and gazelle herds, and Al Ain Zoo runs a breeding programme.", rarityHint: "Reliable on the Sir Bani Yas safari and at Al Ain Zoo (both managed settings)."}
        ],
        bestFor: [
            "City visitors who want oryx and flamingos within an hour of a Dubai or Abu Dhabi hotel.",
            "Families combining Sir Bani Yas Island or Al Ain Zoo with a beach stay.",
            "Kayakers in the Abu Dhabi and Khor Kalba mangroves for turtles, dolphins and herons.",
            "Birders at Ras Al Khor, Al Wathba and the east coast in winter."
        ],
        spottingTips: [
            "Ras Al Khor's hides are free; go late afternoon in winter when the flamingos are closest and the light is behind you.",
            "Book a DDCR safari with a licensed operator rather than a dune-bashing tour; the reserve limits numbers and the guides know where the oryx herds drink.",
            "Kayak the Jubail Mangrove Park at high tide in the early morning for turtles, rays and sometimes dolphins in the channels.",
            "Sir Bani Yas is a two-and-a-half hour drive west of Abu Dhabi; stay a night for the dawn safari when the cheetahs and gazelles are active."
        ],
        relatedLocationSlugs: ["dubai", "oman", "saudi-arabia"],
        rankingSlugs: ["most-resilient-animals", "fastest-animals"],
        challengeSlugs: ["ostrich-vs-cheetah-speed"],
        faq: [
            {question: "What wildlife is there in the UAE?", answer: "Greater flamingos and wetland birds at Ras Al Khor and Al Wathba, Arabian oryx and sand gazelles in the desert reserves and on Sir Bani Yas, dugongs, turtles and dolphins in the Abu Dhabi marine reserves, and desert reptiles and small mammals such as dhubs, geckos, sand cats and Arabian foxes in the dunes."},
            {question: "What animals can be found in the United Arab Emirates?", answer: "About 50 native mammal species, mostly small and nocturnal, around 450 recorded birds including large numbers of migrants, over 70 reptiles, and a Gulf marine fauna with the world's second-largest dugong population. Managed reserves and zoos add cheetahs, giraffes and other African species."},
            {question: "Where can you see flamingos in Dubai?", answer: "Ras Al Khor Wildlife Sanctuary at the head of Dubai Creek, which has three free bird hides open daily. Hundreds of greater flamingos feed there from October to April, with smaller numbers in summer."},
            {question: "Are there wild animals in the UAE desert?", answer: "Yes, though most are nocturnal. Arabian oryx and gazelles live in the reserves, and Arabian red foxes, sand foxes, sand cats, hedgehogs, gerbils and dhub lizards live across the dunes and gravel plains. A guided night drive or a dawn walk reading tracks is the best way to see them."}
        ]
    }
];

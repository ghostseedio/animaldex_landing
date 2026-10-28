import type {LocationPageInput} from "@/data/location-types";

export const latinAmericaLocationPages: LocationPageInput[] = [
    {
        slug: "rio-de-janeiro",
        name: "Rio de Janeiro",
        regionType: "region",
        hubRegion: "south-america",
        countryCode: "BR",
        parentSlug: "brazil",
        coordinate: {lat: -22.9068, lng: -43.1729, zoom: 9},
        captureArea: {bbox: {north: -22.40, south: -23.45, east: -42.60, west: -44.75}},
        title: "Animals in Rio de Janeiro: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Rio de Janeiro: marmosets and sloths in Tijuca Forest, capybaras on the Barra lagoons, frigatebirds over Sugarloaf and whales off Ilha Grande.",
        searchIntents: [
            "animals in Rio de Janeiro",
            "wildlife in Rio de Janeiro",
            "what animals can be found in Rio de Janeiro",
            "what wildlife is there in Rio de Janeiro",
            "what animals can you see in Rio de Janeiro",
            "animais no Rio de Janeiro",
            "Tijuca Forest animals"
        ],
        quickAnswer: "Rio is a city with a rainforest inside it. Tijuca National Park holds marmosets, capuchins, three-toed sloths, toucans and roadside hawks; the Barra da Tijuca and Jacarepaguá lagoons have capybaras and broad-snouted caimans a few metres from cycle paths; frigatebirds and black vultures ride the thermals over Sugarloaf, and humpback whales pass Ilha Grande between July and November.",
        introduction: [
            "Most visitors arrive for beaches and views and leave having seen more wild animals than they expected. The Tijuca massif is one of the largest urban forests on earth, and it leaks wildlife into the Jardim Botânico, Parque Lage and the Corcovado road every single morning.",
            "The flat west of the city is a different system: a chain of brackish lagoons behind Barra and Recreio where capybaras graze the banks, caimans sun on the mud and herons and spoonbills work the shallows. Add the Costa Verde coast towards Ilha Grande and you have forest, wetland and ocean in one state."
        ],
        whyItMatters: [
            "Rio sits in the Atlantic Forest, one of the most threatened biomes on the planet, and the state still protects golden lion tamarins and maned sloths in reserves an hour or two from the city. Seeing a sloth in Tijuca makes that fragility concrete.",
            "For AnimalDex users the city is also simply productive. Captures logged here run from boa constrictors and great kiskadees to lava lizards on the Arpoador rocks, which means a walk, a hike and a lagoon cycle each fill a different part of your collection."
        ],
        animalsToSpot: [
            {speciesSlug: "common-marmoset", whyItFits: "Introduced marmosets are now the most-seen monkey in the city, chattering through the trees at Parque Lage, the Jardim Botânico and along the Corcovado road.", rarityHint: "Near-guaranteed in Tijuca and the botanical garden; do not feed them."},
            {speciesSlug: "tufted-capuchin", whyItFits: "Bold capuchins raid picnic tables on the Vista Chinesa road and move in noisy troops through the Tijuca canopy.", rarityHint: "Common on the forest roads, especially mid-morning."},
            {speciesSlug: "three-toed-sloth", whyItFits: "Tijuca sloths hang in the cecropia trees near the park entrances and sometimes cross the road at walking pace.", rarityHint: "Uncommon; scan cecropia crowns slowly, or ask the rangers at the Floresta visitor centre."},
            {speciesSlug: "toco-toucan", whyItFits: "The toucan of the Tijuca canopy is the channel-billed; the toco, with its giant orange bill, is an open-country bird of the state's lowlands and interior, and the BioParque do Rio at Quinta da Boa Vista keeps them.", rarityHint: "Occasional wild in the city; regular in the farmland and gallery forest of the state's interior, guaranteed at the BioParque."},
            {speciesSlug: "capybara", whyItFits: "Families graze the grass verges of Lagoa de Marapendi and Lagoa de Jacarepaguá in Barra da Tijuca, ignoring joggers entirely.", rarityHint: "Reliable at dawn and dusk on the Barra lagoon paths."},
            {speciesSlug: "magnificent-frigatebird", whyItFits: "Frigatebirds hang motionless over Sugarloaf, Copacabana and Guanabara Bay waiting to rob terns and boobies of their catch.", rarityHint: "Daily from any beach or the Sugarloaf cable car."},
            {speciesSlug: "black-vulture", whyItFits: "The most photographed bird in Rio without anyone meaning to: it circles Corcovado and perches on the Christ statue's platform rails.", rarityHint: "Everywhere, all day."},
            {speciesSlug: "great-kiskadee", whyItFits: "The loud yellow flycatcher that shouts its own name from every lamppost and hotel garden in Ipanema.", rarityHint: "Abundant; the first bird most visitors log."},
            {speciesSlug: "brazilian-lava-lizard", whyItFits: "Sun-loving lizards bask on the Arpoador rocks and the stone walls of Urca, bobbing their heads at each other.", rarityHint: "Common on any warm rock face by mid-morning."},
            {speciesSlug: "roadside-hawk", whyItFits: "A small, vocal hawk that hunts the Tijuca forest edges and perches on wires along the Estrada das Paineiras.", rarityHint: "Regular; listen for the rising scream."},
            {speciesSlug: "boa-constrictor", whyItFits: "Big boas live in the Tijuca forest and the Pedra Branca massif and occasionally turn up in gardens on the forest fringe.", rarityHint: "Rare to see; most sightings are road crossings at night."},
            {speciesSlug: "golden-lion-tamarin", whyItFits: "The state's conservation icon survives in the lowland forest of Poço das Antas and the Silva Jardim reserves, about two hours northeast of the city.", rarityHint: "Only with a guided visit to the tamarin reserves; impossible in the city."},
            {speciesSlug: "humpback-whale", whyItFits: "Humpbacks migrate past Ilha Grande and Arraial do Cabo from July to November and are increasingly seen from boats out of Rio itself.", rarityHint: "Seasonal; best from boat trips in August and September."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Green turtles graze the seagrass in the clear bays of Ilha Grande and are a regular sight for snorkellers at Lagoa Azul.", rarityHint: "Likely on a calm-day snorkel at Ilha Grande."}
        ],
        bestFor: [
            "Urban rainforest hiking with monkeys and sloths inside city limits",
            "Lagoon cycling past capybaras and caimans in Barra da Tijuca",
            "Seabird watching from Sugarloaf, Arpoador and the beaches",
            "Island snorkelling and winter whale trips around Ilha Grande"
        ],
        spottingTips: [
            "Walk the Jardim Botânico right at opening (08:00) for marmosets, toucans and capuchins before the crowds arrive.",
            "Cycle the Lagoa de Marapendi path in Barra at first light; the capybaras move back into cover once the sun is up.",
            "Scan cecropia trees along the Estrada das Paineiras for sloths; they look like a dark clump of leaves until they move.",
            "Keep food zipped away on the Vista Chinesa and Corcovado roads, the capuchins have learnt what backpacks mean."
        ],
        relatedLocationSlugs: ["brazil", "sao-paulo", "minas-gerais"],
        rankingSlugs: ["smartest-animals"],
        faq: [
            {question: "What wildlife is there in Rio de Janeiro?", answer: "Marmosets, capuchin monkeys, three-toed sloths, toucans, boas and roadside hawks live in the Tijuca forest; capybaras, caimans and herons use the Barra lagoons; frigatebirds and vultures patrol the coast, and humpback whales pass offshore in winter."},
            {question: "What animals can be found in Rio de Janeiro?", answer: "The easiest are marmosets and capuchins in the Jardim Botânico and Parque Lage, capybaras along Lagoa de Marapendi, lava lizards on the Arpoador rocks and black vultures over Corcovado. Sloths and toucans need more patience, and golden lion tamarins live only in reserves outside the city."},
            {question: "Is it safe to hike in Tijuca National Park to see animals?", answer: "The main trails from the Floresta sector and the Paineiras road are well used and policed in daylight. Go with company, start early, avoid carrying valuables openly and stay off unmarked trails that drop towards the favelas on the massif's edges."},
            {question: "Can you see whales from Rio de Janeiro?", answer: "Yes. Humpbacks pass the Rio coast from roughly July to November on their way to and from the Abrolhos breeding grounds. Boat trips from Rio, Arraial do Cabo and Ilha Grande have the best odds in August and September."}
        ]
    },
    {
        slug: "rio-grande-do-sul",
        name: "Rio Grande do Sul",
        regionType: "region",
        hubRegion: "south-america",
        countryCode: "BR",
        parentSlug: "brazil",
        coordinate: {lat: -30.0346, lng: -51.2177, zoom: 6},
        captureArea: {bbox: {north: -27.05, south: -33.80, east: -49.60, west: -57.70}},
        title: "Animals in Rio Grande do Sul: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Rio Grande do Sul: capybaras and marsh deer at Taim, flamingos and black-necked swans at Lagoa do Peixe, rheas on the Pampas, right whales at Torres.",
        searchIntents: [
            "animals in Rio Grande do Sul",
            "wildlife in Rio Grande do Sul",
            "what animals can be found in Rio Grande do Sul",
            "what wildlife is there in Rio Grande do Sul",
            "animais do Rio Grande do Sul",
            "Lagoa do Peixe birds",
            "Taim wildlife"
        ],
        quickAnswer: "Brazil's southernmost state is grassland and lagoon country rather than rainforest. Capybaras, marsh deer and caimans crowd the Taim reserve, Chilean flamingos and black-necked swans gather at Lagoa do Peixe, greater rheas stride the Pampas ranches, and southern right whales calve off Torres and the northern beaches from July to November.",
        introduction: [
            "Rio Grande do Sul feels more like Uruguay than Amazonia: rolling Pampas, eucalyptus windbreaks, rice paddies and the enormous Lagoa dos Patos, the largest lagoon in South America. The wildlife follows that geography, with open-country birds, grazing mammals and huge wetland flocks instead of canopy species.",
            "The coastal strip between Lagoa dos Patos and the Atlantic is the heart of it. Lagoa do Peixe National Park is a stopover for migratory shorebirds and flamingos, and the Taim Ecological Station further south has one of the densest capybara populations anywhere, visible from the BR-471 highway."
        ],
        whyItMatters: [
            "The Pampas is one of Brazil's least protected biomes, and the state's grassland species, from rheas to burrowing owls, depend on how ranchers manage their fields. Logging sightings here documents a landscape that is quietly disappearing under soy.",
            "The coast matters too. Torres is the northern limit of a southern right whale nursery that stretches down into Santa Catarina, and Magellanic penguins wash up on the beaches every winter, a reminder that this is where tropical Brazil meets the cold Southern Ocean."
        ],
        animalsToSpot: [
            {speciesSlug: "capybara", whyItFits: "Taim's capybaras graze the roadside verges in herds and are the reason the BR-471 has wildlife fences and speed limits.", rarityHint: "Guaranteed at Taim at dawn and dusk; frequent around Porto Alegre's Guaíba shore too."},
            {speciesSlug: "marsh-deer", whyItFits: "Brazil's largest deer wades the Taim marshes with its long black legs, often standing belly-deep in the reeds.", rarityHint: "Uncommon; scan the wet grassland edges from the Taim viewpoints early."},
            {speciesSlug: "greater-rhea", whyItFits: "Rheas stride across the Pampas ranches of the campanha around Bagé and Santana do Livramento, often in loose family groups.", rarityHint: "Common on open ranchland in the southwest of the state."},
            {speciesSlug: "black-necked-swan", whyItFits: "Hundreds gather on Lagoa do Peixe and the shallow lagoons south of Mostardas, the most elegant waterbird of the southern coast.", rarityHint: "Reliable at Lagoa do Peixe, especially in winter."},
            {speciesSlug: "coscoroba-swan", whyItFits: "The smaller white swan with a coral-pink bill shares the coastal lagoons with its black-necked cousin.", rarityHint: "Regular at Lagoa do Peixe and Taim."},
            {speciesSlug: "southern-right-whale", whyItFits: "Mothers and calves rest in the shallow bays off Torres and the northern beaches, sometimes within a hundred metres of the sand.", rarityHint: "Seasonal, July to November; Torres' headlands are the best shore viewpoints."},
            {speciesSlug: "magellanic-penguin", whyItFits: "Juveniles from Patagonia follow the cold currents north and come ashore along the Rio Grande do Sul beaches each winter.", rarityHint: "Winter beaches only; many are exhausted, so report rather than approach."},
            {speciesSlug: "southern-lapwing", whyItFits: "The quero-quero screams at anyone who crosses its field and nests on football pitches and ranch pastures across the state.", rarityHint: "Abundant everywhere there is short grass."},
            {speciesSlug: "burrowing-owl", whyItFits: "Pairs stand beside their burrows on sandy ground near Mostardas and the coastal dunes, glaring at passing cars.", rarityHint: "Common along the coastal road and on open grazing land."},
            {speciesSlug: "rufous-hornero", whyItFits: "The rufous hornero's clay oven nests sit on fence posts and power poles the length of the Pampas.", rarityHint: "Very common; the nests are easier to spot than the bird."},
            {speciesSlug: "black-howler-monkey", whyItFits: "Black males and blonde females howl from the gallery forests of the Uruguay, Ibicuí and Jacuí rivers in the west of the state; the howler in Itapuã State Park outside Porto Alegre is the brown howler, a different species.", rarityHint: "Uncommon; dawn roars in riverside forest around Uruguaiana and Santa Maria are the best lead."},
            {speciesSlug: "argentine-black-and-white-tegu", whyItFits: "Big tegus patrol the dunes and farm edges of the coastal plain through the warm months.", rarityHint: "Regular in summer, dormant from May to September."},
            {speciesSlug: "melipona", whyItFits: "Stingless bee hives are kept across the state and wild colonies nest in old fence posts and hollow trees.", rarityHint: "Common wherever flowers bloom; one of the species users actually log here."},
            {speciesSlug: "southern-mole-cricket", whyItFits: "A burrowing cricket of the sandy coastal soils that turns up on paths after rain and under lights at night.", rarityHint: "Common after wet nights near the coast."}
        ],
        bestFor: [
            "Wetland birding at Lagoa do Peixe and Taim",
            "Shore-based whale watching at Torres from July to November",
            "Pampas road trips with rheas, lapwings and burrowing owls",
            "Family-friendly capybara spotting without leaving the car"
        ],
        spottingTips: [
            "Drive the BR-471 through Taim at dawn and stop at the official viewpoints; capybaras and marsh deer feed closest to the road before 08:00.",
            "At Lagoa do Peixe hire a local guide in Mostardas, the lagoon tracks flood and the best shorebird flats shift with the season.",
            "In Torres walk the Morro do Farol and Guarita headlands on calm winter mornings with binoculars for right whales.",
            "Winter penguins on the beach are usually sick or starving; photograph from a distance and call the local wildlife rescue rather than touching them."
        ],
        relatedLocationSlugs: ["brazil", "uruguay", "sao-paulo"],
        faq: [
            {question: "What wildlife is there in Rio Grande do Sul?", answer: "Capybaras, marsh deer, caimans and huge waterbird flocks in the Taim and Lagoa do Peixe reserves, greater rheas and burrowing owls on the Pampas, black and brown howler monkeys in the river forests and southern right whales off the northern beaches in winter."},
            {question: "What animals can be found in Rio Grande do Sul?", answer: "The sure things are capybaras at Taim, southern lapwings and horneros on any farmland, black-necked and coscoroba swans at Lagoa do Peixe, and rheas on the ranches of the campanha. Right whales and Magellanic penguins are seasonal winter visitors to the coast."},
            {question: "When can you see whales in Rio Grande do Sul?", answer: "Southern right whales arrive off Torres and the northern coast in July and stay until about November, with August to October the peak for mothers and calves close to shore."},
            {question: "Are there flamingos in Rio Grande do Sul?", answer: "Yes. Chilean flamingos feed in the shallow coastal lagoons of Lagoa do Peixe National Park, mostly in winter and spring, and smaller groups use the lagoons around Taim."}
        ]
    },
    {
        slug: "sao-paulo",
        name: "São Paulo",
        regionType: "region",
        hubRegion: "south-america",
        countryCode: "BR",
        parentSlug: "brazil",
        coordinate: {lat: -23.5505, lng: -46.6333, zoom: 7},
        captureArea: {bbox: {north: -22.80, south: -24.70, east: -44.80, west: -48.20}},
        title: "Animals in São Paulo: What You Can Spot, Learn, and Collect",
        description: "Wildlife in São Paulo: capybaras on the Pinheiros river, howler monkeys and toucans in Cantareira, whales and turtles at Ilhabela, plus the São Paulo Zoo.",
        searchIntents: [
            "animals in São Paulo",
            "wildlife in São Paulo",
            "what animals can be found in São Paulo",
            "what wildlife is there in São Paulo",
            "animais em São Paulo",
            "Cantareira animals",
            "Ilhabela wildlife"
        ],
        quickAnswer: "São Paulo is a megacity ringed by Atlantic Forest. Capybaras graze the banks of the Pinheiros river and the Tietê parks, toco toucans and marmosets visit Ibirapuera, brown howler monkeys roar in Cantareira State Park on the northern edge, and the Serra do Mar drops to a coast where humpback whales and green turtles pass Ilhabela.",
        introduction: [
            "Twelve million people live in the city and the forest still presses in from every side. Cantareira State Park, directly north of the centre, is one of the largest urban forest reserves on earth, and a sunrise walk there means howlers, capuchins and toucans before the traffic builds.",
            "Beyond the city the state is remarkably varied: the Serra do Mar escarpment carries unbroken rainforest to the sea, Ilhabela is an island park with sloths and whale-watching boats, and the interior cerrado and farmland hold maned wolves and seriemas. The São Paulo Zoo, inside the Fontes do Ipiranga forest, is Brazil's largest."
        ],
        whyItMatters: [
            "Several of the captures users log in São Paulo are the city's real wildlife problems: recluse spiders, wandering spiders and giant African land snails are all abundant here and worth recognising. Knowing them matters as much as spotting a toucan.",
            "The region also shows the Atlantic Forest working as a corridor. Capybaras returned to the Pinheiros river once water quality improved, and the Cantareira and Serra do Mar parks still connect enough forest for ocelots and tapirs to hang on within sight of the skyline."
        ],
        animalsToSpot: [
            {speciesSlug: "capybara", whyItFits: "Herds graze the Marginal Pinheiros embankments and the lawns of Parque Ecológico do Tietê, the city's most famous urban wildlife story.", rarityHint: "Reliable along the Pinheiros river at dawn and late afternoon."},
            {speciesSlug: "toco-toucan", whyItFits: "Toucans have moved into Ibirapuera, the Jardim Botânico and the Horto Florestal, feeding on palm fruit above the joggers.", rarityHint: "Regular at the big city parks, best early morning."},
            {speciesSlug: "common-marmoset", whyItFits: "Introduced marmosets chatter through Ibirapuera, Trianon and almost any wooded square in the city.", rarityHint: "Very common in city parks."},
            {speciesSlug: "tufted-capuchin", whyItFits: "Capuchin troops work the Cantareira trails and the Horto Florestal edge, and raid fruit trees in northern suburbs.", rarityHint: "Common in Cantareira and Fontes do Ipiranga."},
            {speciesSlug: "three-toed-sloth", whyItFits: "Sloths hang in the roadside trees of Ilhabela and the Serra do Mar foothills, especially where cecropia grows.", rarityHint: "Uncommon; Ilhabela's north-coast roads give the best odds."},
            {speciesSlug: "humpback-whale", whyItFits: "Humpbacks pass the São Sebastião channel and the outer coast of Ilhabela between June and November on their migration.", rarityHint: "Seasonal; boat trips from Ilhabela in August and September."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Juvenile green turtles feed around the rocky points of Ilhabela and Ubatuba, where the Tamar project runs a visitor centre.", rarityHint: "Likely on a snorkel at Ilhabela or at Tamar Ubatuba."},
            {speciesSlug: "maned-wolf", whyItFits: "The long-legged wolf of the interior cerrado survives around the Itirapina and Vassununga reserves, and is a signature animal at the São Paulo Zoo.", rarityHint: "Rare in the wild; guaranteed at the zoo."},
            {speciesSlug: "jaguar", whyItFits: "The Serra do Mar and the Paranapiacaba forests still hold a few jaguars, and the São Paulo Zoo keeps a breeding group under the Atlantic Forest canopy.", rarityHint: "Essentially unseen in the wild; a zoo sighting here is realistic."},
            {speciesSlug: "great-kiskadee", whyItFits: "The bem-te-vi is the soundtrack of every São Paulo neighbourhood, shouting from antennas and plane trees.", rarityHint: "Abundant across the city."},
            {speciesSlug: "rufous-bellied-thrush", whyItFits: "Brazil's national bird, the rufous-bellied thrush, sings from garden walls across the city before dawn from August onwards.", rarityHint: "Very common; the spring dawn chorus is unmissable."},
            {speciesSlug: "brazilian-wandering-spider", whyItFits: "The armadeira hides in banana plants, woodpiles and shoes across the state and is the spider that gives São Paulo's hospitals real work.", rarityHint: "Occasional in gardens and markets; never handle."},
            {speciesSlug: "golden-lancehead", whyItFits: "The world-famous snake island, Ilha da Queimada Grande, lies 35 km off the São Paulo coast and holds the only population of this viper.", rarityHint: "Off limits to visitors; seen only in documentaries and at the Butantan Institute."}
        ],
        bestFor: [
            "Urban wildlife on the Pinheiros river and in Ibirapuera",
            "Atlantic Forest hiking with howlers and capuchins in Cantareira",
            "Whale and turtle trips from Ilhabela and Ubatuba",
            "A full day at the São Paulo Zoo and the Butantan snake institute"
        ],
        spottingTips: [
            "Book Cantareira's Pedra Grande trail for the first slot of the day; howler monkeys call loudest in the hour after sunrise.",
            "Look for capybaras from the Cidade Universitária and Ponte Cidade Jardim stretches of the Pinheiros cycle path at dusk.",
            "The Butantan Institute's serpentarium is the safe way to see lanceheads, rattlesnakes and the wandering spider up close.",
            "On Ilhabela, drive the north-coast road slowly in the early morning and check cecropia crowns for sloths."
        ],
        relatedLocationSlugs: ["brazil", "rio-de-janeiro", "minas-gerais"],
        rankingSlugs: ["most-dangerous-animals"],
        challengeSlugs: ["rhinoceros-hornbill-vs-toco-toucan"],
        faq: [
            {question: "What wildlife is there in São Paulo?", answer: "Capybaras on the Pinheiros river, toucans and marmosets in the city parks, howler and capuchin monkeys in Cantareira State Park, sloths and whales around Ilhabela, maned wolves in the interior cerrado, and a notable set of urban spiders including recluses and wandering spiders."},
            {question: "What animals can be found in São Paulo?", answer: "In the city itself the reliable animals are capybaras, toco toucans, marmosets, great kiskadees and rufous-bellied thrushes. Within a few hours you add howler monkeys, sloths, sea turtles and seasonal humpback whales."},
            {question: "Is the São Paulo Zoo worth visiting for Brazilian animals?", answer: "Yes. It is Brazil's largest zoo and sits inside a protected Atlantic Forest fragment, so wild toucans and capuchins visit the grounds. It is the realistic place to see jaguars, maned wolves, tapirs and harpy eagles that you will not find on a city walk."},
            {question: "Are there dangerous animals in São Paulo?", answer: "The ones that matter are small: recluse spiders indoors and wandering spiders in bananas and woodpiles. Shake out shoes, check gloves, and visit the Butantan Institute to learn to recognise them."}
        ]
    },
    {
        slug: "minas-gerais",
        name: "Minas Gerais",
        regionType: "region",
        hubRegion: "south-america",
        countryCode: "BR",
        parentSlug: "brazil",
        coordinate: {lat: -19.9167, lng: -44.5000, zoom: 6},
        captureArea: {bbox: {north: -14.20, south: -22.95, east: -39.80, west: -51.10}},
        title: "Animals in Minas Gerais: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Minas Gerais: giant anteaters and rheas on the Serra da Canastra plateau, maned wolves at the Caraça sanctuary, giant armadillos and seriemas.",
        searchIntents: [
            "animals in Minas Gerais",
            "wildlife in Minas Gerais",
            "what animals can be found in Minas Gerais",
            "what wildlife is there in Minas Gerais",
            "animais de Minas Gerais",
            "Serra da Canastra animals",
            "Caraça maned wolf"
        ],
        quickAnswer: "Minas Gerais is Brazil's best state for cerrado wildlife. Giant anteaters, greater rheas, seriemas and the occasional giant armadillo roam the Serra da Canastra plateau, maned wolves climb the steps of the Caraça sanctuary at night, and the Serra do Cipó holds tapirs, hummingbirds and rock-dwelling cavies above Belo Horizonte.",
        introduction: [
            "The highlands of Minas are open grassland on ancient rock, cut by waterfalls and gallery forest. That is cerrado, the most species-rich savanna on earth, and the Serra da Canastra National Park is the place where it is easiest to see: anteaters and rheas feed in plain view beside the dirt road across the plateau.",
            "Caraça is the other essential stop. Every evening since the 1980s the monks of the Santuário do Caraça have put food on the church steps for wild maned wolves, and the animals still come. It is the most reliable maned wolf sighting on earth, in a cold mountain valley two hours from Belo Horizonte."
        ],
        whyItMatters: [
            "The cerrado is losing ground to soy and eucalyptus faster than any other Brazilian biome, and Canastra is one of the few places where its big mammals, from giant anteaters to pampas deer, still live at natural densities. Visitors who log sightings add to that record.",
            "Minas also delivers for people who never leave the car. Burrowing owls on fence posts, caracaras over the road, lava lizards on every warm rock and horneros building ovens on the power lines mean a drive between historic towns fills a collection on its own."
        ],
        animalsToSpot: [
            {speciesSlug: "giant-anteater", whyItFits: "Canastra's anteaters forage the plateau grassland in daylight, swinging their long snouts through termite mounds beside the park road.", rarityHint: "Very likely on the Canastra plateau, best early and late."},
            {speciesSlug: "maned-wolf", whyItFits: "Wild maned wolves come to the Caraça sanctuary steps most nights for the plate of meat the monks leave out.", rarityHint: "Near-nightly at Caraça; a genuine wild encounter."},
            {speciesSlug: "giant-armadillo", whyItFits: "The largest armadillo on earth digs enormous burrows across the Canastra plateau and the Grande Sertão Veredas grasslands of the north.", rarityHint: "Rare and nocturnal; fresh burrows are far easier to find than the animal."},
            {speciesSlug: "greater-rhea", whyItFits: "Rheas stride across the upper plateau of Canastra in small groups, often alongside anteaters and pampas deer.", rarityHint: "Common on the Canastra plateau."},
            {speciesSlug: "red-legged-seriema", whyItFits: "The long-legged cerrado bird whose rattling duets carry across Canastra and the farmland around Uberaba.", rarityHint: "Regular; heard far more than seen, usually on a fence post."},
            {speciesSlug: "lowland-tapir", whyItFits: "Tapirs feed in the gallery forest and marshes of Canastra and the Serra do Cipó and leave three-toed tracks on the river crossings.", rarityHint: "Uncommon; dusk at the Casca d'Anta forest is the best bet."},
            {speciesSlug: "cougar", whyItFits: "Pumas hunt the rock fields of Serra do Cipó and Canastra, and camera traps catch them along the plateau roads.", rarityHint: "Rarely seen; tracks on sandy tracks are common."},
            {speciesSlug: "horned-sungem", whyItFits: "A cerrado hummingbird with a glittering horned crown that feeds on low flowers across the Canastra and Cipó grasslands.", rarityHint: "Uncommon but conspicuous when it perches on a shrub top."},
            {speciesSlug: "rock-cavy", whyItFits: "The mocó lives on rocky outcrops in the dry north of the state, basking on boulders near Januária and the Peruaçu caves.", rarityHint: "Localised; realistic at Cavernas do Peruaçu National Park."},
            {speciesSlug: "burrowing-owl", whyItFits: "Pairs stand on fence posts and termite mounds beside almost every dirt road in the cerrado.", rarityHint: "Very common in open country."},
            {speciesSlug: "crested-caracara", whyItFits: "Caracaras walk the roadsides and pastures of Minas looking for carrion and insects turned up by cattle.", rarityHint: "Common along any country road."},
            {speciesSlug: "toco-toucan", whyItFits: "Toco toucans cross the cerrado between fruiting trees and gather at the gallery forests along Canastra's São Francisco headwaters.", rarityHint: "Regular in the lower Canastra valleys and around Capitólio."},
            {speciesSlug: "brazilian-lava-lizard", whyItFits: "Lava lizards bask on the quartzite rock of Cipó and on the stone walls of Ouro Preto and Tiradentes.", rarityHint: "Abundant on any sunny rock face; one of the state's most logged captures."},
            {speciesSlug: "blue-winged-macaw", whyItFits: "Small macaws screech over the cerrado edges and palm groves of western Minas and the Triângulo region.", rarityHint: "Uncommon; dawn and dusk flights along gallery forest."}
        ],
        bestFor: [
            "Daylight anteater and rhea watching on the Canastra plateau",
            "Nightly wild maned wolves at the Caraça sanctuary",
            "Cerrado birding with seriemas, hummingbirds and owls",
            "Combining historic towns with roadside wildlife"
        ],
        spottingTips: [
            "Enter Serra da Canastra by the São Roque de Minas gate at opening and drive the plateau road slowly; anteaters are most active in the first two hours of light.",
            "Stay overnight at the Santuário do Caraça; the wolves usually arrive between 20:00 and midnight and non-residents cannot wait.",
            "Look for giant armadillo burrows, a metre wide with a crescent-shaped mouth, along the Canastra plateau tracks.",
            "Pack warm layers: Caraça and the Cipó plateau drop near freezing on winter nights, which is exactly when the mammals move."
        ],
        relatedLocationSlugs: ["brazil", "sao-paulo", "rio-de-janeiro", "pantanal"],
        rankingSlugs: ["rarest-animals", "animals-with-strongest-armor"],
        faq: [
            {question: "What wildlife is there in Minas Gerais?", answer: "Cerrado specialists: giant anteaters, maned wolves, giant armadillos, greater rheas, red-legged seriemas, tapirs, pumas, blue-winged macaws, toucans and hummingbirds like the horned sungem, plus rock cavies on the dry northern outcrops."},
            {question: "What animals can be found in Minas Gerais?", answer: "The Serra da Canastra plateau is the place for anteaters, rheas and seriemas in daylight. Caraça delivers wild maned wolves almost every night. Burrowing owls, caracaras, toucans and lava lizards are easy along roads anywhere in the state."},
            {question: "How do you see a maned wolf in Minas Gerais?", answer: "Book a night at the Santuário do Caraça near Santa Bárbara. The monks place food on the church steps after dinner and wild wolves have come to take it almost nightly for decades. Sit quietly, no flash, and expect a wait of an hour or two."},
            {question: "When is the best time to visit Serra da Canastra for animals?", answer: "The dry season from May to September gives clear plateau roads, cool mornings and short grass, so anteaters and rheas are easy to see. The wet season greens the grassland but tracks turn to mud."}
        ]
    },
    {
        slug: "amazon-rainforest",
        name: "Amazon Rainforest",
        regionType: "region",
        hubRegion: "south-america",
        countryCode: "BR",
        parentSlug: "brazil",
        coordinate: {lat: -3.4653, lng: -62.2159, zoom: 4},
        captureArea: {bbox: {north: 5.30, south: -13.50, east: -48.00, west: -79.50}, bboxCountryCodes: ["BR", "PE", "EC", "CO", "BO", "VE", "GY", "SR", "GF"]},
        title: "Animals in the Amazon Rainforest: What You Can Spot, Learn, and Collect",
        description: "What animals live in the Amazon rainforest: pink river dolphins, sloths, macaws, hoatzins, caimans and giant otters, and how realistic a jaguar sighting is.",
        searchIntents: [
            "animals in the Amazon rainforest",
            "wildlife in the Amazon rainforest",
            "what animals can be found in the Amazon rainforest",
            "what wildlife is there in the Amazon rainforest",
            "what animals live in the Amazon",
            "Amazon jungle animals",
            "animais da Amazônia"
        ],
        quickAnswer: "The Amazon holds roughly a tenth of all known species, but what you actually see from a lodge is a specific set: pink river dolphins and black caimans on the rivers, three-toed sloths, squirrel monkeys and hoatzins along the banks, scarlet and blue-and-yellow macaws at clay licks, piranhas and arapaima in the lakes, and leafcutter ants, bullet ants and morpho butterflies on every trail. Jaguars and harpy eagles are real but need luck or a specialist trip.",
        introduction: [
            "The forest covers nine countries, but visitors reach it through a handful of gateways: Manaus and the Rio Negro in Brazil, Puerto Maldonado and the Tambopata reserve in Peru, Coca and the Yasuní lodges in Ecuador, and Leticia on the Colombian border. The wildlife is broadly the same across all of them, with the western Amazon richer in monkeys and macaw clay licks.",
            "Animals here hide in a canopy forty metres up or in brown water, so the river is your best road. Boat trips at dawn and after dark produce most of the mammals and reptiles; forest walks produce the insects, frogs and birds that make the Amazon the most species-dense place on the planet."
        ],
        whyItMatters: [
            "There is no bigger prize for a collector, and no more misleading one. Documentaries promise jaguars and anacondas; a week at a good lodge delivers dolphins, sloths, monkeys, caimans, macaws and a hundred smaller species you have never heard of. Setting expectations right makes the trip far better.",
            "The Amazon is also the place to understand scale. Mamirauá's flooded forest, Tambopata's parrot licks and Yasuní's oil-threatened canopy are each fighting a separate battle, and every tourist dollar and logged sighting supports the local reserves that hold them."
        ],
        animalsToSpot: [
            {speciesSlug: "amazon-river-dolphin", whyItFits: "Pink botos surface at river confluences and the mouths of oxbow lakes, and at the Meeting of the Waters near Manaus they are seen on almost every trip.", rarityHint: "Near-certain on any multi-day river trip."},
            {speciesSlug: "three-toed-sloth", whyItFits: "Sloths hang in the riverside cecropia trees and are spotted from boats along the Rio Negro and the Napo.", rarityHint: "Likely; guides scan the bank trees for them on every excursion."},
            {speciesSlug: "squirrel-monkey", whyItFits: "Troops of fifty or more pour through the riverside canopy in a chatter of leaps, the most frequently seen monkey in the western Amazon.", rarityHint: "Very common around Tambopata and Yasuní lodges."},
            {speciesSlug: "hoatzin", whyItFits: "Prehistoric-looking, clumsy and loud, hoatzins crash around the vegetation of every oxbow lake, grunting and hissing.", rarityHint: "Guaranteed at lakes like Sandoval, Tres Chimbadas and Añangu."},
            {speciesSlug: "scarlet-macaw", whyItFits: "Scarlet macaws gather by the dozen at riverbank clay licks like Chuncho and Colorado in Tambopata to eat mineral-rich mud.", rarityHint: "Reliable at a clay lick on a dry-season morning."},
            {speciesSlug: "black-caiman", whyItFits: "Eyes glow red in the torch beam on night boat trips, and big adults haul out on lake edges in the dry season.", rarityHint: "Common on night spotlighting trips."},
            {speciesSlug: "giant-otter", whyItFits: "Family groups of giant otters fish the oxbow lakes of Tambopata and Manu, snorting at canoes that come too close.", rarityHint: "Likely at Sandoval and Cocha Salvador; rare elsewhere."},
            {speciesSlug: "jaguar", whyItFits: "Jaguars walk the beaches of the Tambopata and Manu rivers in the dry season, and camera traps catch them on every lodge trail.", rarityHint: "Rare; perhaps one in ten river trips in August and September."},
            {speciesSlug: "harpy-eagle", whyItFits: "The largest eagle in the Americas nests in emergent trees, and a few lodges know active nests and can take you there.", rarityHint: "Rare without a known nest; ask before booking."},
            {speciesSlug: "arapaima", whyItFits: "The giant air-breathing fish rolls at the surface of floodplain lakes, especially in the Mamirauá reserve where fishing is managed.", rarityHint: "Regular at Mamirauá; occasional elsewhere."},
            {speciesSlug: "red-bellied-piranha", whyItFits: "Piranha fishing with a stick and a bit of meat is on almost every lodge itinerary, and the fish are genuinely abundant.", rarityHint: "Guaranteed if you fish for them."},
            {speciesSlug: "poison-dart-frog", whyItFits: "Tiny, brilliantly coloured frogs hop through the leaf litter on wet mornings along lodge trails.", rarityHint: "Common after rain if you look down."},
            {speciesSlug: "blue-morpho", whyItFits: "Electric-blue wings flash along every sunlit trail and river edge in the mid-morning heat.", rarityHint: "Daily; photographing one with wings open is the hard part."},
            {speciesSlug: "bullet-ant", whyItFits: "The ant with the most painful sting on earth patrols tree trunks at head height on lodge trails.", rarityHint: "Common; your guide will point them out so you do not lean on one."}
        ],
        bestFor: [
            "River dolphins, caimans and giant otters from a boat",
            "Macaw clay licks in the Peruvian and Ecuadorian Amazon",
            "Night walks for frogs, tarantulas and insects",
            "Multi-day lodge stays with realistic odds of a jaguar"
        ],
        spottingTips: [
            "Choose the dry season (June to October in the west, August to November around Manaus): low water concentrates animals on exposed beaches and lake edges.",
            "Book a lodge with an oxbow lake and a clay lick within reach; Tambopata and Yasuní lodges have both, most Manaus lodges have neither.",
            "Carry a head torch with a red filter for night walks and boat trips; it finds caimans, potoos and frogs without blinding them.",
            "Spend the midday heat at a canopy tower rather than resting; toucans, macaws and monkeys use the emergent trees when the understorey goes quiet."
        ],
        relatedLocationSlugs: ["brazil", "peru", "ecuador", "colombia"],
        rankingSlugs: ["biggest-animals", "most-dangerous-animals", "animals-with-best-camouflage"],
        challengeSlugs: ["green-anaconda-vs-jaguar", "crocodile-vs-black-caiman"],
        faq: [
            {question: "What wildlife is there in the Amazon rainforest?", answer: "Pink river dolphins, caimans, giant otters and piranhas in the water; sloths, squirrel monkeys, howlers and tamarins in the trees; macaws, toucans, hoatzins and harpy eagles overhead; and an overwhelming number of frogs, butterflies, ants and spiders on the ground. Jaguars, tapirs and anacondas are present but rarely seen."},
            {question: "What animals can be found in the Amazon rainforest?", answer: "On a typical lodge stay you will see river dolphins, black caimans, sloths, squirrel monkeys, hoatzins, blue-and-yellow and scarlet macaws, piranhas, morpho butterflies, poison frogs and leafcutter ants. Giant otters are likely on oxbow lakes, and jaguars are a dry-season river-beach possibility."},
            {question: "Where is the best place to see Amazon animals?", answer: "The western Amazon beats the central basin for visible wildlife. Tambopata and Manu in Peru and Yasuní in Ecuador have clay licks, oxbow lakes and canopy towers. Around Manaus choose the Rio Negro for dolphins and flooded forest, or the Mamirauá reserve for uakaris and arapaima."},
            {question: "Is it dangerous to visit the Amazon rainforest?", answer: "The real risks are mosquitoes, heat and infection, not jaguars. Take malaria and yellow fever advice, wear long sleeves at dusk, never grab a tree trunk without looking for bullet ants, and swim only where your guide says the caimans and stingrays allow."}
        ]
    },
    {
        slug: "pantanal",
        name: "Pantanal",
        regionType: "region",
        hubRegion: "south-america",
        countryCode: "BR",
        parentSlug: "brazil",
        coordinate: {lat: -17.70, lng: -57.00, zoom: 6},
        captureArea: {bbox: {north: -15.50, south: -21.50, east: -54.50, west: -59.50}},
        title: "Animals in the Pantanal: What You Can Spot, Learn, and Collect",
        description: "Pantanal wildlife guide: the best place on earth to see wild jaguars, plus giant otters, hyacinth macaws, caimans, capybaras and jabirus on the Transpantaneira.",
        searchIntents: [
            "animals in the Pantanal",
            "wildlife in the Pantanal",
            "what animals can be found in the Pantanal",
            "what wildlife is there in the Pantanal",
            "Pantanal jaguar safari",
            "animais do Pantanal",
            "Pantanal vs Amazon wildlife"
        ],
        quickAnswer: "The Pantanal is the world's largest tropical wetland and the easiest place anywhere to see a wild jaguar. Boat safaris from Porto Jofre find jaguars on the riverbanks most days in the dry season, while the Transpantaneira road passes thousands of yacare caimans, capybaras, jabiru storks and hyacinth macaws, with giant otters, tapirs, giant anteaters and marsh deer in the mix.",
        introduction: [
            "Open floodplain, not forest, is why the Pantanal works. Animals that hide in the Amazon stand in plain view here on riverbanks and drying lagoons, and the dry season from June to October concentrates them around the remaining water.",
            "There are two Pantanals for visitors. The northern Mato Grosso side has the Transpantaneira dirt road ending at Porto Jofre, the jaguar capital of the world. The southern Mato Grosso do Sul side around Miranda and Aquidauana is ranch country with hyacinth macaws, anteaters and horseback safaris."
        ],
        whyItMatters: [
            "No other place offers jaguar sightings this reliable, and the boat tourism around Porto Jofre has turned a cattle-ranching conflict into a reason for ranchers to tolerate the cats. Logging a Pantanal jaguar is logging that story working.",
            "The wetland also shows wildlife at raw density: caimans by the thousand, capybara herds on every bank, storks and spoonbills in flocks. For a new collector it is the fastest place in South America to build a long list."
        ],
        animalsToSpot: [
            {speciesSlug: "jaguar", whyItFits: "Jaguars hunt caimans and capybaras along the Cuiabá, Piquiri and Três Irmãos rivers near Porto Jofre, and boats find them resting on the banks in daylight.", rarityHint: "Likely on a three-day boat safari in July to October; rare elsewhere."},
            {speciesSlug: "giant-otter", whyItFits: "Family groups of giant otters fish the river channels and holler at boats from the bank dens.", rarityHint: "Regular on the Porto Jofre rivers and the Rio Claro."},
            {speciesSlug: "hyacinth-macaw", whyItFits: "The largest parrot on earth feeds on acuri palm nuts and nests in manduvi trees around the southern ranches and along the Transpantaneira.", rarityHint: "Reliable at Pousada Araras and the ranches near Miranda."},
            {speciesSlug: "yacare-caiman", whyItFits: "Hundreds pile up on the drying pools beside the Transpantaneira bridges, mouths open in the heat.", rarityHint: "Guaranteed; the first animal you see and the last."},
            {speciesSlug: "capybara", whyItFits: "Capybara herds graze every riverbank and lodge lawn, dropping into the water when a jaguar appears.", rarityHint: "Guaranteed everywhere."},
            {speciesSlug: "jabiru", whyItFits: "The huge stork with the red neck ring, symbol of the Pantanal, stands on nests in the tallest trees along the road.", rarityHint: "Common; nests are visible from the Transpantaneira."},
            {speciesSlug: "giant-anteater", whyItFits: "Anteaters cross the open ranchland of the southern Pantanal in daylight and are a highlight of horseback safaris around Aquidauana.", rarityHint: "Likely in the south, especially late afternoon."},
            {speciesSlug: "marsh-deer", whyItFits: "The tall red deer of the floodplain wades the roadside marshes along the Transpantaneira at dawn.", rarityHint: "Regular in the northern Pantanal marshes."},
            {speciesSlug: "lowland-tapir", whyItFits: "Tapirs come to the lodge lawns and salt licks after dark and cross the Transpantaneira on night drives.", rarityHint: "Likely on night drives from Pouso Alegre and similar lodges."},
            {speciesSlug: "toco-toucan", whyItFits: "Toucans fly between the gallery-forest fruit trees and the lodge feeders in pairs and small groups.", rarityHint: "Common at most lodges."},
            {speciesSlug: "yellow-anaconda", whyItFits: "The Pantanal's anaconda hunts caimans and birds in the shallow marshes and basks on the road verges in the cool season.", rarityHint: "Occasional; most often found by guides on the Transpantaneira bridges."},
            {speciesSlug: "ring-tailed-coati", whyItFits: "Coati bands forage the lodge grounds and forest edges with tails held straight up.", rarityHint: "Common around lodges."},
            {speciesSlug: "roseate-spoonbill", whyItFits: "Pink spoonbills sweep the drying lagoons alongside wood storks and herons in the dry season.", rarityHint: "Common on roadside pools."},
            {speciesSlug: "black-howler-monkey", whyItFits: "Black males and golden females howl from the gallery forest at dawn and sit in the trees above the lodges.", rarityHint: "Common; follow the roar at first light."}
        ],
        bestFor: [
            "The world's most reliable wild jaguar sightings",
            "Giant otters, caimans and capybaras from a boat",
            "Hyacinth macaws and jabiru storks along the Transpantaneira",
            "Night drives for tapirs, anteaters and ocelots"
        ],
        spottingTips: [
            "Base at Porto Jofre or on a houseboat for jaguars and spend full days on the water; boat drivers share sightings by radio.",
            "Drive the Transpantaneira slowly and stop at every wooden bridge, the pools below them concentrate caimans, capybaras, kingfishers and the occasional anaconda.",
            "For hyacinth macaws head south to the Miranda and Aquidauana ranches, where they nest around the lodges.",
            "Visit in the dry season (June to October); the wet season floods the road, scatters the animals and brings the mosquitoes."
        ],
        relatedLocationSlugs: ["brazil", "amazon-rainforest", "minas-gerais", "argentina"],
        rankingSlugs: ["animals-with-strongest-bite-force", "best-hunters"],
        challengeSlugs: ["jaguar-vs-crocodile", "jaguar-vs-green-anaconda"],
        faq: [
            {question: "What wildlife is there in the Pantanal?", answer: "Jaguars, giant otters, hyacinth macaws, yacare caimans, capybaras, jabiru storks, giant anteaters, marsh deer, tapirs, toucans, howler monkeys, coatis, anacondas and enormous flocks of herons, spoonbills and storks on the drying lagoons."},
            {question: "What animals can be found in the Pantanal?", answer: "Caimans, capybaras, jabirus, toucans and coatis are guaranteed along the Transpantaneira. Jaguars and giant otters are likely on multi-day boat trips from Porto Jofre. Tapirs and anteaters are regular on night drives and ranch safaris in the south."},
            {question: "When is the best time to see jaguars in the Pantanal?", answer: "July to October, the heart of the dry season, when low rivers expose the beaches where jaguars rest and hunt caimans. Three full days on the water from Porto Jofre gives most visitors multiple sightings."},
            {question: "Is the Pantanal better than the Amazon for seeing animals?", answer: "For seeing them, yes. The Amazon has more species but hides them in a forty-metre canopy; the Pantanal's open wetland puts jaguars, otters, caimans and macaws in plain sight. Go to the Pantanal for mammals and the Amazon for sheer diversity."}
        ]
    },
    {
        slug: "lima",
        name: "Lima",
        regionType: "city",
        hubRegion: "south-america",
        countryCode: "PE",
        parentSlug: "peru",
        coordinate: {lat: -12.0464, lng: -77.0428, zoom: 10},
        captureArea: {bbox: {north: -11.55, south: -12.55, east: -76.60, west: -77.45}},
        title: "Animals in Lima: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Lima: sea lions and Humboldt penguins on the Palomino islands, Inca terns off Miraflores, Pantanos de Villa wetlands and the Parque de las Leyendas zoo.",
        searchIntents: [
            "animals in Lima",
            "wildlife in Lima",
            "what animals can be found in Lima",
            "what wildlife is there in Lima",
            "animales en Lima",
            "Palomino islands sea lions",
            "Pantanos de Villa birds"
        ],
        quickAnswer: "Lima's wildlife lives on its coast. Boat trips from Callao to the Palomino islands reach thousands of South American sea lions, Humboldt penguins, Inca terns and boobies; the Pantanos de Villa wetland in Chorrillos holds herons, black skimmers and night herons inside the city; and the Costa Verde cliffs have pelicans, cormorants, vultures and the odd dolphin offshore.",
        introduction: [
            "The desert coast and the cold Humboldt Current make Lima a seabird city. Even from the Miraflores clifftop malecón you watch Inca terns, pelicans and neotropic cormorants working the surf, and from Callao a two-hour boat ride puts you in the water beside a sea lion colony.",
            "Inland the city is dry and built up, but a few green pockets deliver: the Pantanos de Villa Ramsar wetland in the south, El Olivar park in San Isidro for parrotlets and hummingbirds, and the Parque de las Leyendas zoo on the Maranga ruins, which keeps Peru's Andean and Amazonian animals in one afternoon."
        ],
        whyItMatters: [
            "Most travellers treat Lima as a connection to Cusco or Iquitos. Spending a morning on the Palomino islands or at Pantanos de Villa changes that, and gives a first taste of the Humboldt Current ecosystem that makes Peru's coast one of the most productive seas on earth.",
            "The city is also where Peru's wild and domestic animals meet: AnimalDex users log guinea pigs in the markets alongside cockroaches and jumping spiders in apartments, which is an honest picture of urban Peru."
        ],
        animalsToSpot: [
            {speciesSlug: "humboldt-penguin", whyItFits: "Small groups of Humboldt penguins nest on the guano-white rocks of the Palomino and Cavinzas islands off Callao.", rarityHint: "Likely on a Palomino boat trip, best September to March."},
            {speciesSlug: "inca-tern", whyItFits: "The grey tern with the white moustache nests in the Palomino cliffs and hunts the surf below the Miraflores clifftops.", rarityHint: "Daily along the Costa Verde and on the islands."},
            {speciesSlug: "brown-pelican", whyItFits: "Pelicans sit on the breakwaters at Chorrillos fishing pier and glide past the Larcomar cliffs in long lines.", rarityHint: "Common along the entire city coast."},
            {speciesSlug: "neotropic-cormorant", whyItFits: "Cormorants crowd the rocks at La Herradura and the Palomino islands and fish the surf zone off Barranco.", rarityHint: "Abundant along the coast."},
            {speciesSlug: "blue-footed-booby", whyItFits: "Boobies dive into the sea around the Palomino islands and perch on the guano-covered rocks beside the sea lions.", rarityHint: "Regular on the island boat trips."},
            {speciesSlug: "black-skimmer", whyItFits: "Skimmers rest in flocks on the sandbars of Pantanos de Villa and cut the lagoon surface with their lower bills at dusk.", rarityHint: "Regular at Pantanos de Villa."},
            {speciesSlug: "black-crowned-night-heron", whyItFits: "Night herons roost in the reeds at Pantanos de Villa and hunt the lagoon edges from late afternoon.", rarityHint: "Common at the wetland."},
            {speciesSlug: "great-egret", whyItFits: "Egrets stalk the Pantanos de Villa channels and the Chillón and Lurín river mouths at the city's edges.", rarityHint: "Common in any wet habitat around Lima."},
            {speciesSlug: "pacific-parrotlet", whyItFits: "Tiny green parrotlets chatter in the olive trees of El Olivar and the gardens of Miraflores and San Isidro.", rarityHint: "Common in leafy districts; listen for the high chirps."},
            {speciesSlug: "andean-sparrow", whyItFits: "The rufous-collared sparrow is the default small bird of Lima's parks and plazas, singing from hedges at dawn.", rarityHint: "Abundant across the city."},
            {speciesSlug: "black-vulture", whyItFits: "Vultures ride the sea breeze along the Costa Verde cliffs and roost on the Morro Solar above Chorrillos.", rarityHint: "Daily over the coast."},
            {speciesSlug: "dolphin", whyItFits: "Bottlenose dolphins follow the Palomino boats and are sometimes seen from the Miraflores cliffs on calm mornings.", rarityHint: "Occasional; most likely on the island trips."},
            {speciesSlug: "spectacled-bear", whyItFits: "Peru's only bear is kept at the Parque de las Leyendas zoo in San Miguel, the realistic way to see one before heading to the Andes.", rarityHint: "Guaranteed at the zoo; wild bears are far from Lima."},
            {speciesSlug: "guinea-pig", whyItFits: "Cuy are raised and sold across Lima's markets and are one of the animals users most often log in the city.", rarityHint: "Everywhere in markets; a domestic animal, not a wild one."}
        ],
        bestFor: [
            "Boat trips to the sea lion and penguin colonies off Callao",
            "Clifftop seabird watching from Miraflores and Barranco",
            "Wetland birding at Pantanos de Villa inside the city",
            "A zoo afternoon covering Peru's Andean and Amazonian animals"
        ],
        spottingTips: [
            "Book the Palomino islands boat from Callao for an early slot; the sea is calmer and sea lions, penguins and boobies are all active before noon.",
            "Walk the Miraflores malecón at dawn with binoculars; Inca terns and pelicans fish right below the cliffs.",
            "Pantanos de Villa opens around 08:30 and the skimmers and night herons are best in the last two hours before closing.",
            "Avoid the winter garúa (June to September) for boat trips; visibility drops and the islands are often fogged in."
        ],
        relatedLocationSlugs: ["peru", "amazon-rainforest", "chile"],
        faq: [
            {question: "What wildlife is there in Lima?", answer: "Seabirds and marine mammals dominate: South American sea lions, Humboldt penguins, Inca terns, boobies, pelicans and cormorants on the coast and the Palomino islands, with herons, egrets and black skimmers at the Pantanos de Villa wetland and parrotlets and hummingbirds in the parks."},
            {question: "What animals can be found in Lima?", answer: "Pelicans, Inca terns, cormorants and vultures are visible from the Miraflores clifftops every day. The Palomino islands boat trip adds thousands of sea lions, penguins and boobies, and Pantanos de Villa adds wetland birds. The Parque de las Leyendas zoo covers spectacled bears, jaguars and condors."},
            {question: "Can you swim with sea lions in Lima?", answer: "Yes. Boat operators in Callao run trips to the Palomino islands where you can enter the water beside the colony. Expect cold water, a wetsuit and curious sea lions that approach on their own terms."},
            {question: "Is Pantanos de Villa worth visiting?", answer: "For birdwatchers, definitely. It is a Ramsar wetland inside the city with over 200 recorded species, boardwalks and hides, and it is the easiest place in Lima to see black skimmers, night herons, coots and migratory shorebirds."}
        ]
    },
    {
        slug: "banos-ecuador",
        name: "Baños de Agua Santa",
        regionType: "city",
        hubRegion: "south-america",
        countryCode: "EC",
        parentSlug: "ecuador",
        coordinate: {lat: -1.3964, lng: -78.4247, zoom: 10},
        captureArea: {bbox: {north: -1.05, south: -1.75, east: -77.90, west: -78.75}},
        title: "Animals in Baños, Ecuador: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Baños, Ecuador: hummingbirds and cock-of-the-rock on the waterfall road, spectacled bears and tapirs in Llanganates, and the San Martín rescue zoo.",
        searchIntents: [
            "animals in Baños Ecuador",
            "wildlife in Baños Ecuador",
            "what animals can be found in Baños Ecuador",
            "what wildlife is there in Baños Ecuador",
            "animales en Baños de Agua Santa",
            "Baños Puyo waterfall road birds",
            "Llanganates wildlife"
        ],
        quickAnswer: "Baños sits where the Andes drop into the Amazon, so the wildlife changes with every kilometre of the Pastaza valley. The waterfall road to Puyo has hummingbirds, tanagers and Andean cock-of-the-rock leks near Río Verde; Llanganates National Park above town hides spectacled bears, mountain tapirs and condors; and the San Martín zoo on the gorge edge keeps capuchins, tapirs and hawks, which is where most captures in Tungurahua are logged.",
        introduction: [
            "Baños is famous for hot springs, swings and the Ruta de las Cascadas, but the same gorge that gives it waterfalls makes it one of the fastest elevational transects in Ecuador. In an hour you drop from 1,800 m cloud forest to 950 m Amazon foothills at Puyo, and the birds change completely.",
            "Tungurahua volcano looms over the town and the Llanganates range sits to the north, both cloaked in cloud forest that is almost unvisited. Most travellers meet the wildlife at the Zoológico San Martín above the gorge or along the cycling road, and both are worth doing properly."
        ],
        whyItMatters: [
            "The eastern Andean slope is one of the richest bird regions on the planet, and Baños is its most accessible entry point in Ecuador. A morning on the waterfall road with binoculars can produce twenty species of hummingbird and tanager without a guide.",
            "The San Martín zoo is also a real rehabilitation site for animals confiscated from the pet trade, and the capuchins, tapirs and raptors users log there are mostly rescued Ecuadorian natives rather than imports."
        ],
        animalsToSpot: [
            {speciesSlug: "andean-cock-of-the-rock", whyItFits: "The orange, crested cotinga displays at dawn leks in the cloud forest around Río Verde and Machay on the road to Puyo.", rarityHint: "Likely with a local guide at dawn; occasional from the Pailón del Diablo trail."},
            {speciesSlug: "sword-billed-hummingbird", whyItFits: "The only bird with a bill longer than its body feeds on hanging datura flowers in the higher cloud forest above Baños and in Llanganates.", rarityHint: "Uncommon; check flowering trees around 2,500 m."},
            {speciesSlug: "spectacled-bear", whyItFits: "Bears forage the bromeliad-rich cloud forest of Llanganates National Park north of town, occasionally descending to the maize fields above Baños.", rarityHint: "Rare; fresh claw marks and torn bromeliads are the realistic sighting."},
            {speciesSlug: "mountain-tapir", whyItFits: "The woolly Andean tapir survives in the páramo and cloud forest of Llanganates, one of its last Ecuadorian strongholds.", rarityHint: "Very rare; tracks at high lakes on multi-day treks."},
            {speciesSlug: "andean-condor", whyItFits: "Condors soar along the Tungurahua flanks and the Llanganates ridges on clear mornings.", rarityHint: "Uncommon; scan ridgelines from the Casa del Árbol viewpoint early."},
            {speciesSlug: "emerald-toucanet", whyItFits: "Small green toucanets hop through the fruiting trees along the Ruta de las Cascadas and around Río Verde.", rarityHint: "Regular on the lower waterfall road."},
            {speciesSlug: "paradise-tanager", whyItFits: "As the road drops towards Puyo the forest edge fills with mixed tanager flocks, with this seven-coloured species the showpiece.", rarityHint: "Common below Río Negro, especially mid-morning."},
            {speciesSlug: "olinguito", whyItFits: "The cloud-forest carnivore described only in 2013 lives in the wet Andean forest around Baños and comes to fruit feeders after dark at a few lodges.", rarityHint: "Rare; night watches at lodges above 2,000 m."},
            {speciesSlug: "glass-frog", whyItFits: "Translucent frogs call from leaves over the fast streams that feed the Pastaza, visible by torch after dusk.", rarityHint: "Likely on a guided night walk near Río Verde."},
            {speciesSlug: "blue-morpho", whyItFits: "Morphos float along the Pastaza gorge and the lower waterfall road once the sun warms the valley.", rarityHint: "Common from Río Verde down to Puyo."},
            {speciesSlug: "variable-hawk", whyItFits: "Variable hawks hang over the Pastaza canyon and the pastures above town; one of the raptors kept at the San Martín zoo too.", rarityHint: "Regular overhead on clear days."},
            {speciesSlug: "capuchin-monkey", whyItFits: "The San Martín zoo's rescued capuchins are the most-logged animal in Tungurahua; wild troops live downhill in the foothill forest towards Puyo.", rarityHint: "Guaranteed at the zoo; wild sightings start below Río Negro."},
            {speciesSlug: "lowland-tapir", whyItFits: "The zoo on the gorge edge keeps rescued lowland tapirs, the Amazon species that wild-roams the forest east of Puyo.", rarityHint: "Guaranteed at Zoológico San Martín."},
            {speciesSlug: "opossum", whyItFits: "Common opossums raid fruit trees and bins on the edge of town after dark and are also on show at the zoo.", rarityHint: "Common at night; often seen on the road to the Casa del Árbol."}
        ],
        bestFor: [
            "Cloud-forest birding along the Baños to Puyo waterfall road",
            "Hummingbirds and tanagers without leaving the roadside",
            "A rescue zoo with Ecuadorian natives above the gorge",
            "Multi-day Llanganates treks for bears, tapirs and condors"
        ],
        spottingTips: [
            "Cycle or taxi the Ruta de las Cascadas at first light and stop at Río Verde and Machay; the cock-of-the-rock lek is a dawn event only.",
            "Carry binoculars on the Pailón del Diablo trail; toucanets and tanagers feed in the fruiting trees beside the path.",
            "Ask in Baños for guides to the Llanganates lakes; the park has no infrastructure and bear country needs a local who knows the trails.",
            "Clear mornings are rare on Tungurahua; if you wake to a clear sky go straight up to the Casa del Árbol for condors before cloud closes in by 10:00."
        ],
        relatedLocationSlugs: ["ecuador", "galapagos", "amazon-rainforest"],
        faq: [
            {question: "What wildlife is there in Baños, Ecuador?", answer: "Cloud-forest birds dominate: Andean cock-of-the-rock, sword-billed and dozens of other hummingbirds, toucanets and tanagers along the waterfall road. The Llanganates range holds spectacled bears, mountain tapirs and condors, and the San Martín zoo keeps rescued capuchins, tapirs and raptors."},
            {question: "What animals can be found in Baños, Ecuador?", answer: "Easily: hummingbirds, tanagers, toucanets, morpho butterflies, variable hawks and opossums around town and on the road to Puyo. With a dawn guide, the cock-of-the-rock. With real effort, spectacled bears and tapirs in Llanganates. The zoo guarantees capuchins and tapirs."},
            {question: "Is the Baños zoo worth visiting?", answer: "Zoológico San Martín is a small rescue centre on the edge of the Pastaza gorge, not a modern zoo, but most of its animals are confiscated Ecuadorian natives and it is the one reliable place near Baños to see tapirs, capuchins and Andean raptors up close."},
            {question: "Can you see the Amazon from Baños?", answer: "Baños is the gateway: Puyo, an hour down the waterfall road, is already in Amazon foothill forest, and lodges around Puyo and further east offer monkeys, macaws and river trips. For deep Amazon wildlife continue to the Napo or Yasuní."}
        ]
    },
    {
        slug: "galapagos",
        name: "Galápagos Islands",
        regionType: "island",
        hubRegion: "south-america",
        countryCode: "EC",
        parentSlug: "ecuador",
        coordinate: {lat: -0.75, lng: -90.60, zoom: 7},
        captureArea: {bbox: {north: 1.90, south: -1.60, east: -88.90, west: -92.20}},
        title: "Animals in the Galápagos Islands: What You Can Spot, Learn, and Collect",
        description: "Galápagos wildlife guide: marine iguanas, giant tortoises, blue-footed boobies, sea lions, Darwin's finches, penguins and hammerheads, island by island.",
        searchIntents: [
            "animals in the Galápagos Islands",
            "wildlife in the Galápagos Islands",
            "what animals can be found in the Galápagos Islands",
            "what wildlife is there in the Galápagos Islands",
            "Galapagos animals list",
            "animales de Galápagos",
            "Galapagos wildlife by island"
        ],
        quickAnswer: "The Galápagos deliver wildlife that does not run away. Marine iguanas and sea lions cover the docks of Puerto Ayora and Puerto Baquerizo Moreno; giant tortoises graze the Santa Cruz highlands; blue-footed boobies, frigatebirds and land iguanas nest beside the trails on North Seymour; penguins and flightless cormorants live on Isabela and Fernandina; and the water holds sea turtles, hammerheads and sea lions that swim up to your mask.",
        introduction: [
            "No other destination puts you this close to wild animals. The islands' species evolved without land predators and treat people as scenery, so a sea lion will nap on the bench beside you and a booby will dance a metre from your feet. The national park rule is two metres; the animals ignore it.",
            "What you see depends on which islands you reach. Santa Cruz and San Cristóbal are the inhabited bases with tortoises, iguanas and sea lions on tap. The western islands of Isabela and Fernandina have penguins, flightless cormorants and the densest marine iguana colonies. Española has the waved albatross colony, and Genovesa the great seabird cliffs."
        ],
        whyItMatters: [
            "This is where the idea of evolution took shape, and the finches, tortoises and iguanas that convinced Darwin are still here to be compared island by island. A collector who logs a Santa Cruz tortoise and an Española lava lizard has recorded that argument.",
            "The islands also face real pressure from invasive species, tourism and a warming sea, and the park's strict guiding rules exist for that reason. Visiting well, with a licensed guide and clean boots, is part of the point."
        ],
        animalsToSpot: [
            {speciesSlug: "marine-iguana", whyItFits: "The only sea-going lizard piles up in black heaps on the lava at Puerto Ayora, Punta Espinoza and every rocky landing in the islands.", rarityHint: "Guaranteed on any island; Fernandina has the largest colonies."},
            {speciesSlug: "galapagos-tortoise", whyItFits: "Wild tortoises graze the misty Santa Cruz highlands around El Chato and Rancho Primicias, and the Charles Darwin Station breeds them in Puerto Ayora.", rarityHint: "Guaranteed in the Santa Cruz highlands and at the breeding centres."},
            {speciesSlug: "galapagos-sea-lion", whyItFits: "Sea lions sleep on the benches, boats and beaches of Puerto Baquerizo Moreno and play with snorkellers at every landing.", rarityHint: "Guaranteed; they come to you."},
            {speciesSlug: "blue-footed-booby", whyItFits: "Boobies dance and whistle on the ground beside the trail on North Seymour and Española and dive in squadrons off Punta Pitt.", rarityHint: "Near-certain on the seabird islands."},
            {speciesSlug: "magnificent-frigatebird", whyItFits: "Males inflate scarlet throat pouches in the low trees of North Seymour and Genovesa through the breeding season.", rarityHint: "Guaranteed on North Seymour; common overhead everywhere."},
            {speciesSlug: "galapagos-penguin", whyItFits: "The only penguin north of the equator fishes the cold western waters around Isabela, Fernandina and Bartolomé's Pinnacle Rock.", rarityHint: "Likely at Bartolomé and the western islands; scarce in the east."},
            {speciesSlug: "common-land-iguana", whyItFits: "Yellow land iguanas eat cactus pads on North Seymour, South Plaza and the Isabela lowlands, often sitting in the middle of the path.", rarityHint: "Reliable on South Plaza and North Seymour."},
            {speciesSlug: "galapagos-hawk", whyItFits: "The islands' top predator perches on lava and trail markers on Española, Santa Fé and Fernandina, utterly unbothered by people.", rarityHint: "Likely on the uninhabited islands; absent from Santa Cruz."},
            {speciesSlug: "medium-ground-finch", whyItFits: "The archetypal Darwin's finch hops around the Puerto Ayora cafés and the highland farms, bill size varying from island to island.", rarityHint: "Abundant on Santa Cruz."},
            {speciesSlug: "sally-lightfoot-crab", whyItFits: "Scarlet crabs scuttle over every black lava shore, feeding alongside the marine iguanas.", rarityHint: "Guaranteed on any rocky coast."},
            {speciesSlug: "espanola-lava-lizard", whyItFits: "Española's lava lizards, with the red-throated females, show how each island has evolved its own species.", rarityHint: "Common on the Española trail at Punta Suárez."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Turtles graze algae in the shallow bays of Tortuga Bay, Las Tintoreras and Los Túneles and nest on Santa Cruz beaches from December to May.", rarityHint: "Near-certain on any snorkel."},
            {speciesSlug: "scalloped-hammerhead", whyItFits: "Hammerhead schools gather at Kicker Rock off San Cristóbal and in huge numbers at the remote Darwin and Wolf islands.", rarityHint: "Likely at Kicker Rock on a dive or deep snorkel."},
            {speciesSlug: "red-lipped-batfish", whyItFits: "An endemic oddity with scarlet lips that walks on the sand at 20 m and deeper around the islands.", rarityHint: "Rare; only on deeper dives with a sharp-eyed guide."}
        ],
        bestFor: [
            "Point-blank wildlife photography without a telephoto lens",
            "Snorkelling with sea lions, turtles and penguins",
            "Seabird colonies on North Seymour, Española and Genovesa",
            "Watching evolution island by island with tortoises, finches and lava lizards"
        ],
        spottingTips: [
            "A live-aboard cruise reaches Fernandina, Genovesa and Española, which land-based trips cannot; choose a western itinerary for penguins and cormorants, a southern one for albatrosses.",
            "On a budget, base in Puerto Ayora: Tortuga Bay, the highland tortoise ranches and day trips to North Seymour and Bartolomé cover most of the headline species.",
            "Snorkel at Las Tintoreras (Isabela), Kicker Rock (San Cristóbal) and Los Túneles for turtles, sea lions, sharks and penguins in one trip each.",
            "Visit between December and May for warm water and the booby and albatross courtship season, or June to November for colder, richer seas and more active sea lions."
        ],
        relatedLocationSlugs: ["ecuador", "banos-ecuador", "peru"],
        rankingSlugs: ["most-adaptable-animals", "rarest-animals"],
        challengeSlugs: ["honey-badger-vs-giant-tortoise"],
        faq: [
            {question: "What wildlife is there in the Galápagos Islands?", answer: "Marine iguanas, land iguanas, giant tortoises, lava lizards, Galápagos sea lions and fur seals, blue-footed, Nazca and red-footed boobies, frigatebirds, waved albatrosses, Galápagos penguins, flightless cormorants, Galápagos hawks, Darwin's finches, and underwater green turtles, hammerheads, rays and reef fish."},
            {question: "What animals can be found in the Galápagos Islands?", answer: "On every trip: marine iguanas, sea lions, Sally Lightfoot crabs, finches, frigatebirds and sea turtles. On Santa Cruz: wild giant tortoises. On North Seymour and Española: nesting boobies and land iguanas. On Isabela, Fernandina or Bartolomé: penguins and flightless cormorants."},
            {question: "Do you need a cruise to see Galápagos animals?", answer: "No, but it helps. Land-based trips from Santa Cruz and San Cristóbal reach tortoises, iguanas, sea lions, boobies and turtles. Only cruises reach Fernandina, Genovesa and Española, which hold the flightless cormorants, the big seabird cliffs and the waved albatross colony."},
            {question: "When is the best time to visit the Galápagos for wildlife?", answer: "There is no bad season. December to May is warm and calm with courtship displays, turtle nesting and the albatross arrival in April. June to November brings the cool Humboldt Current, rougher seas, more fish, and the most active sea lions, penguins and whales."}
        ]
    },
    {
        slug: "chile",
        name: "Chile",
        regionType: "country",
        hubRegion: "south-america",
        countryCode: "CL",
        coordinate: {lat: -35.6751, lng: -71.5430, zoom: 3},
        captureArea: {countryCodes: ["CL"]},
        title: "Animals in Chile: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Chile: pumas and guanacos in Torres del Paine, Andean condors, Humboldt penguins at Punta de Choros, Darwin's foxes on Chiloé and blue whales offshore.",
        searchIntents: [
            "animals in Chile",
            "wildlife in Chile",
            "what animals can be found in Chile",
            "what wildlife is there in Chile",
            "animales de Chile",
            "Torres del Paine puma",
            "Chile wildlife travel"
        ],
        quickAnswer: "Chile runs 4,300 km from desert to ice, and its wildlife follows. Flamingos and vicuñas use the Atacama salt lakes, Humboldt penguins and chinchillas live on the central coast and hills, Darwin's foxes and pudús hide in the Chiloé rainforest, blue whales feed off the Gulf of Corcovado, and Torres del Paine is the best place on earth to watch wild pumas hunting guanacos beneath condors.",
        introduction: [
            "Hemmed in by the Andes, the Pacific and the Atacama, Chile evolved an unusually distinct fauna: pudús the size of a spaniel, foxes found on one island, rodents like degus and chinchillas, and the Patagonian puma population that has learnt to ignore photographers in Torres del Paine.",
            "Each zone has an access point. San Pedro de Atacama for the altiplano, La Serena and Punta de Choros for the penguin islands, Puerto Varas and Chiloé for the temperate rainforest and whales, and Puerto Natales for the Paine massif and its cats."
        ],
        whyItMatters: [
            "Torres del Paine's pumas are the standout story: once shot on sight, they are now a tourism asset that the estancias around the park protect, and sightings on a dedicated tracking trip are close to guaranteed. Logging one records a conservation turnaround.",
            "Chile is also an easy, safe country to travel independently, so a collector can string together desert, coast, rainforest and steppe in a fortnight and come home with a list no single ecosystem could provide."
        ],
        animalsToSpot: [
            {speciesSlug: "cougar", whyItFits: "The pumas of Torres del Paine and the Laguna Amarga estancias hunt guanacos in daylight and tolerate trackers at close range.", rarityHint: "Likely on a two or three day puma tracking trip; occasional from the park roads."},
            {speciesSlug: "guanaco", whyItFits: "Herds of wild guanacos graze the Paine steppe and the Atacama slopes, the puma's main prey and the most visible mammal in the south.", rarityHint: "Guaranteed in Torres del Paine."},
            {speciesSlug: "andean-condor", whyItFits: "Condors roost on the cliffs above Laguna Amarga and ride the thermals over the Maipo canyon an hour from Santiago.", rarityHint: "Regular in the Paine massif and the Cajón del Maipo."},
            {speciesSlug: "humboldt-penguin", whyItFits: "Penguins nest on Isla Choros and Isla Damas in the Humboldt Penguin National Reserve north of La Serena and on Chiloé's Puñihuil islets.", rarityHint: "Reliable on boat trips from Punta de Choros."},
            {speciesSlug: "magellanic-penguin", whyItFits: "Big colonies breed on Isla Magdalena in the Strait of Magellan, reached by ferry from Punta Arenas, and share Puñihuil with the Humboldts.", rarityHint: "Guaranteed at Isla Magdalena from October to March."},
            {speciesSlug: "king-penguin", whyItFits: "A small colony at Bahía Inútil on Tierra del Fuego is the only king penguin breeding site on the American mainland.", rarityHint: "Guaranteed at the Parque Pingüino Rey with a reservation."},
            {speciesSlug: "darwins-fox", whyItFits: "One of the rarest canids on earth lives almost only on Chiloé, in the Chiloé National Park and Tantauco reserve.", rarityHint: "Rare; dusk around the Cucao sector of Chiloé National Park is the best bet."},
            {speciesSlug: "southern-pudu", whyItFits: "The world's smallest deer browses the bamboo understorey of the Valdivian rainforest around Puerto Varas, Chiloé and the Huilo Huilo reserve.", rarityHint: "Uncommon and shy; dawn on quiet forest roads."},
            {speciesSlug: "culpeo", whyItFits: "The big Andean fox trots across the Atacama altiplano and the Paine steppe and scavenges around campsites.", rarityHint: "Common in Torres del Paine and around San Pedro."},
            {speciesSlug: "vicuna", whyItFits: "Wild vicuñas graze the bofedal wetlands above 4,000 m around the Tatio geysers and Lauca National Park.", rarityHint: "Common on the altiplano roads out of San Pedro and Putre."},
            {speciesSlug: "long-tailed-chinchilla", whyItFits: "The wild chinchilla survives in the rocky hills of the Reserva Nacional Las Chinchillas near Illapel.", rarityHint: "Rare and nocturnal; the reserve's night hide is the only realistic option."},
            {speciesSlug: "degu", whyItFits: "Degus scurry between burrows on the scrubby hillsides of central Chile, including the parks on the edge of Santiago.", rarityHint: "Common in central Chile matorral; look on morning walks in Río Clarillo."},
            {speciesSlug: "blue-whale", whyItFits: "The largest animal on earth feeds in the Gulf of Corcovado off Chiloé every austral summer.", rarityHint: "Seasonal, January to April; boat trips from Chiloé or Melinka."},
            {speciesSlug: "panda-ant", whyItFits: "A Chilean velvet ant with striking black and white fur, found in the dry coastal scrub of central Chile.", rarityHint: "Uncommon; look on sandy ground in the warm months."}
        ],
        bestFor: [
            "Puma tracking in Torres del Paine",
            "Penguin islands from Punta de Choros to the Strait of Magellan",
            "Altiplano wildlife around San Pedro de Atacama",
            "Temperate rainforest and whales on Chiloé"
        ],
        spottingTips: [
            "For pumas, stay at an estancia on the eastern edge of Torres del Paine and hire a dedicated tracker; most sightings are at dawn around Laguna Amarga and Sarmiento.",
            "Take the Punta de Choros boat early for Humboldt penguins, marine otters and dolphins before the afternoon wind picks up.",
            "In the Atacama, drive the altiplano lakes around sunrise for flamingos and vicuñas, then rest through the harsh midday light.",
            "Chiloé's Darwin's foxes and pudús need patience; walk the Cucao forest trails at dusk and keep quiet."
        ],
        relatedLocationSlugs: ["patagonia", "argentina", "peru"],
        rankingSlugs: ["biggest-animals", "stealthiest-hunters"],
        challengeSlugs: ["cougar-vs-wolf", "orca-vs-blue-whale"],
        faq: [
            {question: "What wildlife is there in Chile?", answer: "Pumas, guanacos, condors and foxes in Patagonia; vicuñas, flamingos and viscachas on the Atacama altiplano; Humboldt and Magellanic penguins on the coast; pudús and Darwin's foxes in the Valdivian rainforest; and blue whales, sea lions and dolphins in the southern fjords."},
            {question: "What animals can be found in Chile?", answer: "The sure things are guanacos, culpeo foxes and condors in Torres del Paine, penguins at Punta de Choros and Isla Magdalena, and vicuñas on the altiplano. Pumas are likely with a tracker, pudús and Darwin's foxes need luck, and blue whales are a summer boat trip off Chiloé."},
            {question: "Where is the best place to see pumas in Chile?", answer: "Torres del Paine National Park and the private estancias on its eastern boundary. Winter and spring (May to November) give the best visibility; dedicated tracking trips of two or three days see pumas on most days."},
            {question: "Are there dangerous animals in Chile?", answer: "Very few. Pumas avoid people, there are no dangerous snakes, and the main hazards are the Chilean recluse spider indoors and the cold and altitude outdoors. Chile is one of the safest countries in the world for wildlife travel."}
        ]
    },
    {
        slug: "argentina",
        name: "Argentina",
        regionType: "country",
        hubRegion: "south-america",
        countryCode: "AR",
        coordinate: {lat: -38.4161, lng: -63.6167, zoom: 3},
        captureArea: {countryCodes: ["AR"]},
        title: "Animals in Argentina: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Argentina: right whales and elephant seals at Península Valdés, capybaras and caimans in Iberá, coatis at Iguazú, condors and reintroduced jaguars.",
        searchIntents: [
            "animals in Argentina",
            "wildlife in Argentina",
            "what animals can be found in Argentina",
            "what wildlife is there in Argentina",
            "animales de Argentina",
            "Peninsula Valdes wildlife",
            "Ibera wetlands animals"
        ],
        quickAnswer: "Argentina packs subtropical wetlands, Pampas, Andes and a cold Atlantic coast into one country. Península Valdés has southern right whales, elephant seals, sea lions and hunting orcas; the Iberá marshes hold capybaras, caimans, marsh deer, howler monkeys and reintroduced jaguars and anteaters; Iguazú's forest is full of coatis and toucans; and the Andes deliver condors, guanacos and vicuñas.",
        introduction: [
            "The classic Argentine wildlife trip has three stops. Península Valdés in Chubut for whales and seals, the Esteros del Iberá in Corrientes for wetland mammals and birds, and the Iguazú falls for Atlantic Forest species. Each is a different biome and each is reachable by a domestic flight from Buenos Aires.",
            "Beyond those, the Pampas themselves are worth watching from the bus window: rheas, horneros, lapwings, caracaras and burrowing owls on every fence line, plus vizcachas and armadillos at dusk. Patagonia and the northwest Andes add guanacos, maras, condors and the strange steppe fauna of the south."
        ],
        whyItMatters: [
            "Iberá is the most ambitious rewilding project in the Americas. Jaguars, giant anteaters, giant otters, pampas deer and macaws have all been returned to the marshes in the last fifteen years, and visitors can watch the results from a boat or a horse.",
            "Valdés, meanwhile, offers marine mammals at a density few places match, and the famous beach-hunting orcas of Punta Norte are a behaviour seen almost nowhere else on earth."
        ],
        animalsToSpot: [
            {speciesSlug: "southern-right-whale", whyItFits: "Right whales calve in the Golfo Nuevo off Puerto Pirámides and are watched from boats and even from the beach at El Doradillo.", rarityHint: "Guaranteed June to December at Península Valdés."},
            {speciesSlug: "southern-elephant-seal", whyItFits: "The only continental elephant seal colony in the world lines the beaches of Valdés at Punta Delgada and Caleta Valdés.", rarityHint: "Reliable; bulls fight on the beaches in September and October."},
            {speciesSlug: "orca", whyItFits: "Punta Norte's orcas strand themselves intentionally to grab sea lion pups off the beach, a hunting technique unique to Valdés.", rarityHint: "Seasonal and tide-dependent, mainly March and April; sightings never guaranteed."},
            {speciesSlug: "magellanic-penguin", whyItFits: "Punta Tombo south of Trelew is the largest Magellanic colony on the continent, with hundreds of thousands of birds in season.", rarityHint: "Guaranteed September to March at Punta Tombo and Estancia San Lorenzo."},
            {speciesSlug: "capybara", whyItFits: "Capybaras graze the lawns of Colonia Carlos Pellegrini and line every channel of the Iberá marshes.", rarityHint: "Guaranteed at Iberá."},
            {speciesSlug: "yacare-caiman", whyItFits: "Caimans float among the water hyacinth of Iberá by the hundred and bask on the causeway edges.", rarityHint: "Guaranteed on any Iberá boat trip."},
            {speciesSlug: "marsh-deer", whyItFits: "Iberá holds the largest marsh deer population in Argentina, visible wading the floating meadows from the boat.", rarityHint: "Likely at Iberá."},
            {speciesSlug: "black-howler-monkey", whyItFits: "Howlers roar from the forest islands of Iberá at dawn and sit in the trees above the Carlos Pellegrini guesthouses.", rarityHint: "Common at Iberá."},
            {speciesSlug: "jaguar", whyItFits: "Jaguars were returned to Iberá's San Alonso island in 2021 after seventy years' absence and the population is growing; Iguazú holds the other wild population.", rarityHint: "Rare; camera traps and tracks at Iberá, very occasional on the Iguazú roads at night."},
            {speciesSlug: "giant-anteater", whyItFits: "Reintroduced anteaters now forage the Iberá grasslands in daylight around the Rincón del Socorro and San Nicolás portals.", rarityHint: "Likely at Iberá with a guide."},
            {speciesSlug: "ring-tailed-coati", whyItFits: "Coatis mob the walkways at Iguazú falls and raid any unattended snack on the Circuito Superior.", rarityHint: "Guaranteed at Iguazú; keep food sealed."},
            {speciesSlug: "toco-toucan", whyItFits: "Toucans fly over the Iguazú gorge and feed in the forest along the Macuco trail.", rarityHint: "Regular at Iguazú, especially early."},
            {speciesSlug: "andean-condor", whyItFits: "Condors nest in the Quebrada del Condorito near Córdoba and soar over the Calchaquí valleys and the Patagonian Andes.", rarityHint: "Reliable at Quebrada del Condorito National Park."},
            {speciesSlug: "burrowing-parrot", whyItFits: "The world's largest parrot colony cuts into the sea cliffs at El Cóndor near Viedma, tens of thousands of nests.", rarityHint: "Guaranteed at El Cóndor from September to January."}
        ],
        bestFor: [
            "Whale watching and elephant seals at Península Valdés",
            "Wetland safaris and rewilded mammals in Iberá",
            "Atlantic Forest wildlife at Iguazú falls",
            "Pampas and Patagonian steppe wildlife from the road"
        ],
        spottingTips: [
            "At Valdés, base in Puerto Pirámides for whale boats and drive the gravel loop to Punta Norte and Caleta Valdés for seals, maras and armadillos.",
            "Stay inside Iberá at Colonia Carlos Pellegrini or one of the Rewilding Argentina portals; capybaras, caimans and howlers are on the doorstep, and anteaters need an early guided drive.",
            "Walk the Iguazú upper circuit at opening before the coatis and crowds arrive; the Macuco trail gives the best forest birds.",
            "For the Punta Norte orcas check the tide tables and plan to wait several days; attacks happen at high tide in March and April."
        ],
        relatedLocationSlugs: ["patagonia", "chile", "uruguay", "brazil"],
        rankingSlugs: ["biggest-animals", "smartest-animals"],
        challengeSlugs: ["orca-vs-great-white-shark", "jaguar-vs-crocodile"],
        faq: [
            {question: "What wildlife is there in Argentina?", answer: "Southern right whales, elephant seals, sea lions, orcas and Magellanic penguins on the Patagonian coast; capybaras, caimans, marsh deer, howler monkeys, anteaters and reintroduced jaguars in the Iberá wetlands; coatis and toucans at Iguazú; condors, guanacos and vicuñas in the Andes; and rheas, armadillos and vizcachas on the Pampas."},
            {question: "What animals can be found in Argentina?", answer: "Easily: capybaras and caimans at Iberá, whales and elephant seals at Valdés, penguins at Punta Tombo, coatis at Iguazú, and rheas, lapwings and horneros on any farmland. With more effort: jaguars, anteaters, orcas and condors."},
            {question: "When is the best time to see whales in Argentina?", answer: "Southern right whales are in the Valdés gulfs from June to December, with August to October the peak for mothers and calves. Penguins are present September to March, and the beach-hunting orcas are most active in March and April."},
            {question: "Is Iberá worth visiting compared to the Pantanal?", answer: "Yes. Iberá is smaller and quieter, with capybaras, caimans, marsh deer and howlers at similar density, plus a rewilding story unmatched anywhere. Jaguars are far harder to see than in the Pantanal, but anteaters are easier."}
        ]
    },
    {
        slug: "patagonia",
        name: "Patagonia",
        regionType: "region",
        hubRegion: "south-america",
        countryCode: "AR",
        parentSlug: "argentina",
        coordinate: {lat: -47.00, lng: -70.00, zoom: 4},
        captureArea: {bbox: {north: -39.00, south: -56.00, east: -62.00, west: -76.50}, bboxCountryCodes: ["AR", "CL"]},
        title: "Animals in Patagonia: What You Can Spot, Learn, and Collect",
        description: "Patagonia wildlife on both sides of the Andes: pumas and guanacos in Torres del Paine, Magellanic and king penguins, condors, whales, elephant seals and maras.",
        searchIntents: [
            "animals in Patagonia",
            "wildlife in Patagonia",
            "what animals can be found in Patagonia",
            "what wildlife is there in Patagonia",
            "Patagonia animals list",
            "fauna de la Patagonia",
            "Patagonia wildlife travel"
        ],
        quickAnswer: "Patagonia is steppe, mountain and cold coast, and its animals are big and visible. Guanacos graze every hillside with pumas hunting them in Torres del Paine, Andean condors ride the ridgelines, Magellanic penguins breed in colonies of hundreds of thousands, king penguins nest on Tierra del Fuego, and the Atlantic shore has right whales, elephant seals, orcas and Commerson's dolphins. The steppe adds maras, armadillos, rheas and foxes.",
        introduction: [
            "Patagonia straddles Argentina and Chile south of the Río Colorado, and the wildlife ignores the border. Torres del Paine and Los Glaciares share condors, guanacos and pumas; the Atlantic coast from Valdés to Tierra del Fuego has the marine mammals and penguins; and the dry steppe between holds the odd rodents and armadillos that evolved on this windswept plateau.",
            "The open country makes spotting easy. Guanacos stand on the skyline, maras bound across the road, rheas keep pace with the car, and in the right season the whales and seals are visible from the beach without a boat."
        ],
        whyItMatters: [
            "The puma recovery in Torres del Paine and the growing penguin and whale populations on the coast are real conservation wins in a region that was heavily hunted a century ago. Visitors who log sightings, especially of pumas and huemul deer, help the parks track them.",
            "Patagonia is also where the Southern Ocean fauna reaches the mainland: king penguins, rockhoppers, albatrosses and elephant seals that most people associate with Antarctica are reachable here by car and ferry."
        ],
        animalsToSpot: [
            {speciesSlug: "guanaco", whyItFits: "Guanacos are everywhere on the Patagonian steppe and crowd the Torres del Paine grasslands in herds of hundreds.", rarityHint: "Guaranteed."},
            {speciesSlug: "cougar", whyItFits: "Torres del Paine's pumas are the most watchable big cats in the Americas, hunting guanacos in daylight on the eastern steppe.", rarityHint: "Likely on dedicated tracking trips around Laguna Amarga; occasional on the park roads."},
            {speciesSlug: "andean-condor", whyItFits: "Condors nest on the cliffs of Paine and El Chaltén and soar over every Patagonian pass on windy days.", rarityHint: "Regular in the mountain parks."},
            {speciesSlug: "magellanic-penguin", whyItFits: "Penguins breed at Punta Tombo, Isla Magdalena, Cabo Vírgenes and Martillo island, in colonies of tens to hundreds of thousands of birds.", rarityHint: "Guaranteed September to March at any colony."},
            {speciesSlug: "king-penguin", whyItFits: "The Bahía Inútil colony on Chilean Tierra del Fuego is the only place on the mainland Americas to see king penguins.", rarityHint: "Guaranteed with a reservation at Parque Pingüino Rey."},
            {speciesSlug: "southern-rockhopper-penguin", whyItFits: "Rockhoppers nest on Isla Pingüino off Puerto Deseado, the only mainland-accessible colony in Argentina.", rarityHint: "Reliable October to March on boat trips from Puerto Deseado."},
            {speciesSlug: "southern-right-whale", whyItFits: "Right whales fill the gulfs of Península Valdés in winter and spring and are watched from the El Doradillo beach.", rarityHint: "Guaranteed June to December at Valdés."},
            {speciesSlug: "southern-elephant-seal", whyItFits: "The Valdés beaches hold the only continental elephant seal breeding colony, with bulls fighting on the shingle each spring.", rarityHint: "Reliable at Punta Delgada and Caleta Valdés."},
            {speciesSlug: "orca", whyItFits: "Valdés orcas beach themselves to seize sea lion pups at Punta Norte, and pods also patrol the Strait of Magellan.", rarityHint: "Seasonal and unpredictable; March and April high tides at Punta Norte."},
            {speciesSlug: "commersons-dolphin", whyItFits: "Black-and-white Commerson's dolphins ride the bow of boats in the Ría Deseado and the Strait of Magellan.", rarityHint: "Likely on Puerto Deseado and Punta Arenas boat trips."},
            {speciesSlug: "patagonian-mara", whyItFits: "Maras graze in pairs on the steppe around Valdés and Puerto Madryn and bound away on long legs when disturbed.", rarityHint: "Common on the Chubut steppe."},
            {speciesSlug: "pichi-armadillo", whyItFits: "The small Patagonian armadillo trundles across the steppe and begs at Valdés picnic sites.", rarityHint: "Common in the warm months on the Valdés peninsula."},
            {speciesSlug: "culpeo", whyItFits: "Culpeo foxes patrol the Torres del Paine campsites and the Los Glaciares trails hoping for scraps.", rarityHint: "Common in both mountain parks."},
            {speciesSlug: "patagonian-hog-nosed-skunk", whyItFits: "The Patagonian skunk forages the steppe at dusk around Valdés and the Santa Cruz estancias.", rarityHint: "Occasional at dusk on steppe roads."}
        ],
        bestFor: [
            "Puma tracking and guanaco herds in Torres del Paine",
            "Penguin colonies including king penguins on Tierra del Fuego",
            "Whales, elephant seals and orcas on the Valdés coast",
            "Steppe road trips with maras, armadillos and rheas"
        ],
        spottingTips: [
            "Travel in the austral spring or summer (October to March) for penguins and seals, or May to November for whales and the best puma visibility.",
            "Drive the gravel roads of Valdés and Ruta 40 slowly at dawn and dusk; maras, armadillos, skunks and foxes cross then.",
            "Take the Beagle Channel boat from Ushuaia for sea lions, cormorants, albatrosses and the Martillo island penguins in one trip.",
            "Carry a windproof layer and binoculars at all times; the wind is constant and most mammals are first seen at distance on open ground."
        ],
        relatedLocationSlugs: ["argentina", "chile"],
        rankingSlugs: ["most-resilient-animals", "fastest-animals"],
        challengeSlugs: ["cougar-vs-wolf"],
        faq: [
            {question: "What wildlife is there in Patagonia?", answer: "Guanacos, pumas, condors, culpeo and grey foxes, huemul deer, maras, armadillos and rheas on land; Magellanic, king and rockhopper penguins, southern right whales, elephant seals, sea lions, orcas, Commerson's dolphins and albatrosses on the coast."},
            {question: "What animals can be found in Patagonia?", answer: "Guanacos, upland geese and foxes are guaranteed almost anywhere. Penguin colonies are guaranteed in season at Punta Tombo, Isla Magdalena and Martillo island, whales and elephant seals at Península Valdés. Pumas are likely in Torres del Paine with a tracker, and condors are regular in the mountain parks."},
            {question: "Can you see penguins in Patagonia year round?", answer: "No. Magellanic penguins arrive at their colonies in September and leave by April. King penguins at Bahía Inútil are present all year, which makes Tierra del Fuego the one place for a winter penguin visit."},
            {question: "Are pumas dangerous to hikers in Patagonia?", answer: "Attacks are almost unknown. Pumas in Torres del Paine are habituated to people at a distance and prey on guanacos. Hike in groups, keep children close, do not run if you see one, and never approach a cat on a kill."}
        ]
    },
    {
        slug: "uruguay",
        name: "Uruguay",
        regionType: "country",
        hubRegion: "south-america",
        countryCode: "UY",
        coordinate: {lat: -32.5228, lng: -55.7658, zoom: 6},
        captureArea: {countryCodes: ["UY"]},
        title: "Animals in Uruguay: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Uruguay: sea lions at Cabo Polonio, capybaras and rheas on the Pampas, black-necked swans on the Rocha lagoons, right whales offshore in spring.",
        searchIntents: [
            "animals in Uruguay",
            "wildlife in Uruguay",
            "what animals can be found in Uruguay",
            "what wildlife is there in Uruguay",
            "animales de Uruguay",
            "Cabo Polonio sea lions",
            "Uruguay wildlife travel"
        ],
        quickAnswer: "Uruguay is quiet grassland and a long Atlantic coast, and its wildlife is easy rather than exotic. Capybaras, rheas, armadillos and vizcachas live on the ranches, the tero lapwing screams from every field, the Rocha lagoons hold black-necked swans, flamingos and spoonbills, Cabo Polonio has one of the largest sea lion colonies in South America, and southern right whales pass the coast from July to November.",
        introduction: [
            "The country is almost entirely Pampas, broken by palm groves, eucalyptus and the string of brackish lagoons behind the Rocha coast. That means open-country birds and grazing mammals that show themselves readily: a drive from Montevideo to Punta del Diablo passes rheas, lapwings, horneros and burrowing owls without trying.",
            "The coast is the highlight. Cabo Polonio, reachable only by 4x4 truck across the dunes, has sea lions and fur seals piled on the rocks under the lighthouse; the Laguna de Rocha and Laguna Garzón are Ramsar wetlands full of swans and shorebirds; and the beaches of Rocha pick up whales, penguins and sea turtles in season."
        ],
        whyItMatters: [
            "Uruguay's wildlife is a lesson in the ordinary done well. The animals are not rare, but they are abundant, approachable and set in a safe, uncrowded country, which makes it a fine place to build confidence as a collector.",
            "The Rocha coast is also serious conservation ground: the Cerro Verde marine protected area protects foraging green turtles, the sea lion colonies at Isla de Lobos and Cabo Polonio are among the continent's largest, and the lagoons are critical stopovers for migratory shorebirds."
        ],
        animalsToSpot: [
            {speciesSlug: "capybara", whyItFits: "Capybaras graze the banks of the Santa Lucía wetlands outside Montevideo and the lagoons and ranch dams of Rocha.", rarityHint: "Common near any water in the interior and east."},
            {speciesSlug: "greater-rhea", whyItFits: "Rheas stride across the ranches of the interior and the grassland around the Rocha lagoons in family groups.", rarityHint: "Common on open ranchland; often visible from Ruta 9."},
            {speciesSlug: "southern-lapwing", whyItFits: "The tero is Uruguay's national bird and the loudest thing in the countryside, nesting on football pitches and pasture everywhere.", rarityHint: "Guaranteed."},
            {speciesSlug: "black-necked-swan", whyItFits: "Swans gather in flocks on Laguna de Rocha, Laguna Garzón and Laguna Negra.", rarityHint: "Reliable on the Rocha lagoons."},
            {speciesSlug: "southern-right-whale", whyItFits: "Right whales swim close to the Rocha and Maldonado beaches on their migration and are watched from the Punta del Este headland and La Paloma.", rarityHint: "Seasonal, July to November, best September and October."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Juvenile green turtles feed in the rocky shallows of the Cerro Verde marine area near La Coronilla, where Karumbé runs a turtle centre.", rarityHint: "Likely at the Karumbé centre; occasional while snorkelling at Cerro Verde."},
            {speciesSlug: "magellanic-penguin", whyItFits: "Young penguins arrive on the Rocha beaches each winter after the long swim north from Patagonia.", rarityHint: "Winter beaches; most are exhausted, so report rather than approach."},
            {speciesSlug: "plains-vizcacha", whyItFits: "Vizcachas emerge at dusk from colonial burrows on the ranches of the interior, sitting up like oversized rabbits.", rarityHint: "Regular at dusk in the north and west."},
            {speciesSlug: "nine-banded-armadillo", whyItFits: "The mulita trots along ranch tracks at dusk and is a frequent road sighting across the country.", rarityHint: "Common at dusk on country roads."},
            {speciesSlug: "crab-eating-fox", whyItFits: "Zorros de monte hunt the ranch edges and palm groves of Rocha and the Santa Teresa park after dark.", rarityHint: "Regular on night drives."},
            {speciesSlug: "argentine-black-and-white-tegu", whyItFits: "Big tegus bask on the dunes and tracks of the Rocha coast and the Santa Teresa park in summer.", rarityHint: "Common in summer, absent in winter."},
            {speciesSlug: "burrowing-owl", whyItFits: "Burrowing owls stand beside their holes on the sandy coastal grassland and ranch pastures.", rarityHint: "Common in open country."},
            {speciesSlug: "rufous-hornero", whyItFits: "Hornero oven nests sit on fence posts and power poles the length of every rural road in Uruguay.", rarityHint: "Guaranteed."},
            {speciesSlug: "roseate-spoonbill", whyItFits: "Spoonbills feed in the shallow Rocha lagoons and the Santa Lucía marshes alongside egrets and ibises.", rarityHint: "Regular at the coastal lagoons."}
        ],
        bestFor: [
            "Sea lion colonies at Cabo Polonio and Isla de Lobos",
            "Lagoon birding along the Rocha coast",
            "Pampas wildlife from capybaras to rheas on an estancia stay",
            "Shore-based whale watching in spring"
        ],
        spottingTips: [
            "Take the first truck into Cabo Polonio and walk to the lighthouse rocks; the sea lions are noisiest and closest in the morning.",
            "Hire a kayak or local boat on Laguna de Rocha for swans, spoonbills and flamingos; the eastern shore is best in late afternoon.",
            "Visit the Karumbé turtle centre at La Coronilla in summer for green turtles and the chance to join a beach survey.",
            "Drive Ruta 9 and Ruta 10 at dusk for armadillos, foxes and vizcachas, and watch for whales from any headland between Punta del Este and La Paloma in September."
        ],
        relatedLocationSlugs: ["argentina", "rio-grande-do-sul", "brazil"],
        faq: [
            {question: "What wildlife is there in Uruguay?", answer: "Capybaras, rheas, armadillos, vizcachas, foxes and tegus on the Pampas; black-necked and coscoroba swans, flamingos and spoonbills on the Rocha lagoons; sea lions and fur seals at Cabo Polonio and Isla de Lobos; and southern right whales, penguins and green turtles along the coast in season."},
            {question: "What animals can be found in Uruguay?", answer: "Southern lapwings and horneros are on every field, rheas and capybaras on most ranches, swans on the eastern lagoons and sea lions at Cabo Polonio year round. Whales are a winter and spring visitor, penguins turn up on winter beaches and green turtles feed at Cerro Verde in summer."},
            {question: "Where can you see sea lions in Uruguay?", answer: "Cabo Polonio in Rocha has a large year-round colony of South American sea lions and fur seals on the rocks below the lighthouse. Isla de Lobos off Punta del Este holds an even bigger colony, visited by boat tours."},
            {question: "When is the best time to see whales in Uruguay?", answer: "Southern right whales pass the Uruguayan coast from July to November, closest to shore in September and October. Punta del Este, La Paloma and Punta del Diablo all have headlands with regular sightings."}
        ]
    },
    {
        slug: "cartagena",
        name: "Cartagena and the Caribbean coast",
        regionType: "region",
        hubRegion: "south-america",
        countryCode: "CO",
        parentSlug: "colombia",
        coordinate: {lat: 10.6, lng: -74.8, zoom: 7},
        captureArea: {bbox: {north: 12.60, south: 9.20, east: -71.00, west: -76.60}},
        title: "Animals in Cartagena and the Caribbean Coast: What You Can Spot, Learn, and Collect",
        description: "Wildlife on Colombia's Caribbean coast: Rosario islands reefs and turtles, sloths and capuchins in Tayrona, mangrove caimans, scarlet ibis and flamingos at La Guajira.",
        searchIntents: [
            "animals in Cartagena",
            "wildlife in Cartagena",
            "what animals can be found in Cartagena",
            "what wildlife is there in Cartagena",
            "animales en Cartagena",
            "Tayrona wildlife",
            "Rosario islands snorkelling animals"
        ],
        quickAnswer: "Cartagena is the base for Colombia's Caribbean wildlife. The Rosario and San Bernardo islands have coral reefs with parrotfish, angelfish, spiny lobsters and sea turtles; the mangroves of the Ciénaga de la Virgen and La Boquilla hold caimans, crocodiles and herons; Tayrona National Park near Santa Marta has sloths, capuchins, howlers and toucans on the beach trails; and the La Guajira lagoons fill with flamingos and scarlet ibis.",
        introduction: [
            "The old city itself is pelicans, frigatebirds and iguanas in the Parque del Centenario, but the coast around it is the real draw. Forty minutes by boat the Rosario islands sit on the edge of a coral shelf, and an hour inland the dry forest and mangroves hold cotton-top tamarins and crocodiles.",
            "East along the coast the Sierra Nevada falls straight into the sea at Tayrona, where rainforest meets beach and sloths hang over the swimming coves. Further east still the desert of La Guajira holds the great flamingo lagoons at Camarones. Together they make the Caribbean coast Colombia's most varied wildlife region outside the Amazon."
        ],
        whyItMatters: [
            "The cotton-top tamarin, one of the rarest primates in the world, lives only in the dry forest of this coast, and projects near Cartagena are the best place to see it. Logging one supports a species down to a few thousand individuals.",
            "The reefs are under pressure from warming water and the invasive lionfish, and the Rosario islands are a case study in a Caribbean reef being managed back to health. Snorkellers who log what they see add to that record."
        ],
        animalsToSpot: [
            {speciesSlug: "three-toed-sloth", whyItFits: "Sloths hang in the trees above the Cabo San Juan and Arrecifes trails in Tayrona and even over the beaches.", rarityHint: "Likely in Tayrona; look up at every cecropia."},
            {speciesSlug: "cotton-top-tamarin", whyItFits: "Colombia's tiny endemic tamarin survives in the dry forest between Cartagena and Montes de María, where the Proyecto Tití reserve protects it.", rarityHint: "Likely only on a guided Proyecto Tití visit near Santa Catalina."},
            {speciesSlug: "capuchin-monkey", whyItFits: "Capuchin troops cross the Tayrona trails and raid the campsites at Cabo San Juan.", rarityHint: "Common in Tayrona."},
            {speciesSlug: "green-iguana", whyItFits: "Iguanas bask in the trees of Cartagena's Parque del Centenario and on the mangrove edges of La Boquilla.", rarityHint: "Guaranteed in the city parks."},
            {speciesSlug: "magnificent-frigatebird", whyItFits: "Frigatebirds hang over the Cartagena bay, the Bocagrande beaches and the Rosario islands all day.", rarityHint: "Daily over the city and coast."},
            {speciesSlug: "common-caiman", whyItFits: "Spectacled caimans float in the mangrove channels of the Ciénaga de la Virgen and the La Boquilla canoe tours.", rarityHint: "Regular on mangrove canoe trips, especially at dusk."},
            {speciesSlug: "american-crocodile", whyItFits: "Big American crocodiles live in the coastal lagoons and mangroves from the Canal del Dique to the Ciénaga Grande.", rarityHint: "Uncommon; most seen from boats in the Ciénaga Grande de Santa Marta."},
            {speciesSlug: "scarlet-ibis", whyItFits: "Scarlet ibis feed on the mudflats of the Ciénaga Grande and the La Guajira lagoons alongside the flamingos.", rarityHint: "Regular in the Ciénaga Grande and at Los Flamencos sanctuary."},
            {speciesSlug: "keel-billed-toucan", whyItFits: "Toucans call from the forest canopy around Minca and the upper Tayrona trails.", rarityHint: "Regular around Minca and the Tayrona hills."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Hawksbills forage the Rosario and San Bernardo reefs and nest on the quieter island beaches.", rarityHint: "Likely on a reef snorkel at Isla Grande or Barú."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Green turtles graze the seagrass beds around the Rosario islands and off Playa Blanca.", rarityHint: "Likely for snorkellers at the Rosarios."},
            {speciesSlug: "blue-parrotfish", whyItFits: "Big blue parrotfish crunch coral on the Rosario reefs and are the most obvious fish on any snorkel.", rarityHint: "Common on the island reefs."},
            {speciesSlug: "lionfish", whyItFits: "The invasive lionfish has colonised every Caribbean Colombian reef and is now hunted by local divers to protect them.", rarityHint: "Common on the Rosario reefs; look under overhangs."},
            {speciesSlug: "common-basilisk", whyItFits: "Jesus Christ lizards sprint across the streams and pools of Tayrona and the Sierra Nevada foothills.", rarityHint: "Common near fresh water in Tayrona."}
        ],
        bestFor: [
            "Reef snorkelling and diving in the Rosario islands",
            "Beach-and-rainforest wildlife at Tayrona National Park",
            "Mangrove canoe trips for caimans and herons from Cartagena",
            "Flamingos and scarlet ibis in La Guajira"
        ],
        spottingTips: [
            "Snorkel the Rosarios from Isla Grande or the Oceanario area early, before the day-trip boats arrive and stir the water.",
            "In Tayrona, walk the Arrecifes to Cabo San Juan trail at opening with binoculars for sloths, capuchins and toucans, then swim.",
            "Book a La Boquilla mangrove canoe at sunset for caimans, night herons and the fishing-village birdlife.",
            "Contact Proyecto Tití in advance for cotton-top tamarin visits; the animals are wild and sightings depend on a guide knowing the troop."
        ],
        relatedLocationSlugs: ["colombia", "amazon-rainforest", "trinidad-and-tobago"],
        rankingSlugs: ["most-invasive-species", "rarest-animals"],
        faq: [
            {question: "What wildlife is there in Cartagena?", answer: "Reef fish, sea turtles and lobsters on the Rosario and San Bernardo islands; caimans, crocodiles, herons and ibises in the mangroves; sloths, capuchins, howler monkeys and toucans in Tayrona; cotton-top tamarins in the dry forest near Cartagena; and flamingos and scarlet ibis in the La Guajira lagoons."},
            {question: "What animals can be found in Cartagena?", answer: "In the city: iguanas, pelicans and frigatebirds. On a Rosario islands day trip: parrotfish, angelfish, turtles and the occasional lobster or lionfish. On a mangrove canoe: caimans and herons. Two hours east in Tayrona: sloths, monkeys and toucans."},
            {question: "Is the snorkelling good in the Rosario islands?", answer: "It is the best reef snorkelling on Colombia's mainland coast. Expect parrotfish, angelfish, sergeant majors, sea turtles and healthy soft coral on the sheltered side of Isla Grande; visibility is best from December to April when the rivers run low."},
            {question: "Can you see flamingos near Cartagena?", answer: "Not in the city. The Los Flamencos sanctuary at Camarones in La Guajira, about five hours east, has the flocks, and the Ciénaga Grande de Santa Marta sometimes holds smaller groups with scarlet ibis."}
        ]
    },
    {
        slug: "trinidad-and-tobago",
        name: "Trinidad and Tobago",
        regionType: "country",
        hubRegion: "south-america",
        countryCode: "TT",
        coordinate: {lat: 10.69, lng: -61.22, zoom: 8},
        captureArea: {countryCodes: ["TT"], bbox: {north: 11.40, south: 9.95, east: -60.40, west: -62.00}},
        title: "Animals in Trinidad and Tobago: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Trinidad and Tobago: scarlet ibis at Caroni swamp, leatherback turtles at Grande Riviere, oilbirds and hummingbirds at Asa Wright, Tobago's reefs.",
        searchIntents: [
            "animals in Trinidad and Tobago",
            "wildlife in Trinidad and Tobago",
            "what animals can be found in Trinidad and Tobago",
            "what wildlife is there in Trinidad and Tobago",
            "Caroni swamp scarlet ibis",
            "Trinidad leatherback turtles",
            "Tobago wildlife"
        ],
        quickAnswer: "Trinidad has South American wildlife on a Caribbean island because it broke off Venezuela only recently. Thousands of scarlet ibis fly into the Caroni swamp each dusk, leatherback turtles nest on Grande Riviere and Matura beaches from March to August, the Asa Wright centre has oilbirds, hummingbirds and the island's forest birds, and wild guppies swim in every stream. Tobago adds reefs, frigatebirds and boobies.",
        introduction: [
            "Trinidad sits a few kilometres off Venezuela and shares its fauna: capuchin and howler monkeys, ocelots, agoutis, armadillos, caimans and over 470 bird species, which is more than any other Caribbean island by a wide margin. The Northern Range is rainforest, the west coast is mangrove swamp and the north coast is turtle beach.",
            "Tobago is smaller, drier and more Caribbean in feel, with reefs at Speyside and Buccoo, the seabird colonies of Little Tobago and a forest reserve that has been protected since 1776. Together the two islands fit a week and deliver two completely different lists."
        ],
        whyItMatters: [
            "Grande Riviere hosts one of the densest leatherback nesting beaches on earth, with hundreds of two-metre turtles coming ashore on peak nights, and community guides have turned a hunting beach into a conservation success. Seeing it is a genuine privilege.",
            "The scarlet ibis roost at Caroni is the national bird's defining spectacle and one of the most reliable wildlife shows in the Americas. Both are easy to reach from Port of Spain and both reward a collector with species that are hard to find anywhere else in the Caribbean."
        ],
        animalsToSpot: [
            {speciesSlug: "scarlet-ibis", whyItFits: "Thousands of scarlet ibis flight into the Caroni swamp mangroves each evening to roost, turning the trees red.", rarityHint: "Guaranteed on the Caroni sunset boat tour."},
            {speciesSlug: "leatherback-sea-turtle", whyItFits: "Leatherbacks haul out to nest on Grande Riviere, Matura and Fishing Pond beaches on the north and east coasts.", rarityHint: "Near-certain on a guided night watch from March to August."},
            {speciesSlug: "oilbird", whyItFits: "The nocturnal fruit-eating oilbird roosts in Dunston Cave at the Asa Wright Nature Centre, the most accessible colony in the world.", rarityHint: "Reliable with the Asa Wright guided cave walk."},
            {speciesSlug: "fancy-guppy", whyItFits: "The aquarium guppy is a Trinidad native, swimming wild in every mountain stream and roadside ditch in the Northern Range.", rarityHint: "Guaranteed in any clear stream; the original wild form."},
            {speciesSlug: "common-caiman", whyItFits: "Spectacled caimans float in the Caroni channels and the Nariva swamp, visible from the boats.", rarityHint: "Regular on Caroni and Nariva tours."},
            {speciesSlug: "capuchin-monkey", whyItFits: "White-fronted capuchins and red howlers move through the Nariva swamp palm forest and the Northern Range canopy.", rarityHint: "Likely at Nariva; occasional at Asa Wright."},
            {speciesSlug: "blue-and-yellow-macaw", whyItFits: "Macaws were reintroduced to the Nariva swamp after being hunted out and now fly over the Bush Bush forest in pairs.", rarityHint: "Regular at Nariva, especially at dawn and dusk."},
            {speciesSlug: "crested-oropendola", whyItFits: "Oropendolas hang pendulous nests from tall trees at Asa Wright and gurgle their liquid calls across the valley.", rarityHint: "Common in the Northern Range."},
            {speciesSlug: "magnificent-frigatebird", whyItFits: "Frigatebirds nest on Little Tobago and St Giles islands and patrol the Speyside and Buccoo coasts.", rarityHint: "Daily around Tobago."},
            {speciesSlug: "ocelot", whyItFits: "Trinidad's only wild cat hunts the Northern Range and Nariva forests and is caught regularly on Asa Wright's camera traps.", rarityHint: "Rare; night drives on the Blanchisseuse road offer a small chance."},
            {speciesSlug: "cane-toad", whyItFits: "The crapaud is native here, calling from ditches and gardens after rain and a frequent capture in the south of Trinidad.", rarityHint: "Very common on wet nights."},
            {speciesSlug: "tropical-house-gecko", whyItFits: "The introduced tropical house gecko has colonised walls and ceilings across both islands and is among the most-logged animals in Siparia.", rarityHint: "Guaranteed under any porch light."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Hawksbills graze the Speyside and Buccoo reefs in Tobago and nest on the smaller Tobago beaches.", rarityHint: "Likely on a Speyside snorkel or dive."}
        ],
        bestFor: [
            "The scarlet ibis sunset roost at Caroni swamp",
            "Leatherback turtle nesting on Grande Riviere beach",
            "Rainforest birding and oilbirds at Asa Wright",
            "Reef snorkelling and seabird colonies on Tobago"
        ],
        spottingTips: [
            "Book the Caroni swamp boat for the last departure of the day; the ibis arrive in the final half hour before dark.",
            "Turtle watching needs a permit and a guide; stay overnight in Grande Riviere in April or May and go out after 20:00 when the first females land.",
            "Spend a full morning on the Asa Wright veranda; the feeders bring hummingbirds, honeycreepers, tanagers and agoutis within arm's reach.",
            "In Tobago take the glass-bottom boat from Speyside to Little Tobago for frigatebirds and red-billed tropicbirds, and snorkel Angel Reef on the way back."
        ],
        relatedLocationSlugs: ["cartagena", "guyana", "french-guiana", "jamaica"],
        rankingSlugs: ["biggest-animals"],
        faq: [
            {question: "What wildlife is there in Trinidad and Tobago?", answer: "Scarlet ibis, oilbirds, macaws, hummingbirds and over 470 bird species, leatherback and hawksbill turtles, capuchin and howler monkeys, ocelots, agoutis, armadillos, caimans, boas and bushmasters, wild guppies, and healthy reefs with parrotfish and angelfish off Tobago."},
            {question: "What animals can be found in Trinidad and Tobago?", answer: "The guaranteed ones are scarlet ibis at Caroni, oilbirds and hummingbirds at Asa Wright, frigatebirds around Tobago and guppies in any stream. Leatherbacks are near-certain in nesting season, caimans and macaws are regular at Nariva, and ocelots are rare night sightings."},
            {question: "When can you see leatherback turtles in Trinidad?", answer: "The nesting season runs from March to August, peaking in April, May and June. Grande Riviere and Matura on the north and east coasts are the main beaches, and all visits must be with a licensed community guide after dark."},
            {question: "Are there dangerous animals in Trinidad and Tobago?", answer: "Trinidad has four venomous snakes, including the bushmaster and fer-de-lance, but bites are rare and Tobago has none. Watch your step on forest trails, shake out boots, and treat the Caroni caimans and any scorpion with ordinary caution."}
        ]
    },
    {
        slug: "french-guiana",
        name: "French Guiana",
        regionType: "region",
        hubRegion: "south-america",
        countryCode: "GF",
        coordinate: {lat: 3.9339, lng: -53.1258, zoom: 6},
        captureArea: {countryCodes: ["GF"]},
        title: "Animals in French Guiana: What You Can Spot, Learn, and Collect",
        description: "Wildlife in French Guiana: leatherback turtles at Awala-Yalimapo, black caimans and hoatzins at Kaw, cock-of-the-rock, sloths, jaguars and the Cayenne zoo.",
        searchIntents: [
            "animals in French Guiana",
            "wildlife in French Guiana",
            "what animals can be found in French Guiana",
            "what wildlife is there in French Guiana",
            "animaux de Guyane",
            "faune de la Guyane française",
            "Kaw marsh caimans"
        ],
        quickAnswer: "French Guiana is 95 percent intact rainforest on the Guiana Shield. Leatherback, green and olive ridley turtles nest on the Awala-Yalimapo beaches, the Kaw marsh has black caimans, hoatzins and scarlet ibis from a boat, the forest around the Nouragues and Trésor reserves holds Guianan cock-of-the-rock, capuchinbirds, sloths, sakis and jaguars, and the Zoo de Guyane outside Cayenne shows the species you will not find on your own.",
        introduction: [
            "This is France's Amazon: a European overseas department with euro prices, good roads along the coast and an interior of unbroken forest reachable only by river. The combination makes it one of the easiest places to see Guiana Shield wildlife, from the turtle beaches in the west to the Kaw wetlands east of Cayenne.",
            "The coast is the gateway. Cayenne has the zoo and the Montagne des Singes trails, Kaw is a two-hour drive and a boat, and Awala-Yalimapo on the Surinamese border is the turtle capital. For the deep forest, carbets (hammock camps) on the Approuague and Maroni rivers put you among monkeys, macaws and jaguars."
        ],
        whyItMatters: [
            "Awala-Yalimapo was once the largest leatherback nesting beach in the world and still hosts thousands of nests a season, alongside greens and olive ridleys. It is one of very few places to see three sea turtle species nesting on one beach.",
            "The Guiana Shield fauna, from the cock-of-the-rock to the goliath birdeater, is unlike the western Amazon, and French Guiana is its most accessible, safest corner. Collectors who log it fill a gap most South American trips leave empty."
        ],
        animalsToSpot: [
            {speciesSlug: "leatherback-sea-turtle", whyItFits: "Leatherbacks nest in their thousands on the Awala-Yalimapo and Rémire-Montjoly beaches from April to July.", rarityHint: "Near-certain on a night beach walk in May and June."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Green turtles share the Awala-Yalimapo nesting beach and come ashore later in the season than the leatherbacks.", rarityHint: "Likely from June to August at Awala-Yalimapo."},
            {speciesSlug: "olive-ridley-sea-turtle", whyItFits: "Olive ridleys nest on the Cayenne peninsula beaches at Rémire-Montjoly, within sight of the city.", rarityHint: "Regular June to August on the Montjoly beaches."},
            {speciesSlug: "black-caiman", whyItFits: "The Kaw marsh is one of the last strongholds of the black caiman, with big adults floating in the channels on night boat trips.", rarityHint: "Likely on a Kaw night excursion."},
            {speciesSlug: "hoatzin", whyItFits: "Hoatzins clamber through the Kaw marsh vegetation in noisy groups, grunting from the floating meadows.", rarityHint: "Guaranteed at Kaw."},
            {speciesSlug: "scarlet-ibis", whyItFits: "Scarlet ibis roost in the mangroves of the Kaw and Mahury estuaries and feed on the mudflats at low tide.", rarityHint: "Regular on the Kaw and Cayenne estuaries."},
            {speciesSlug: "guianan-cock-of-the-rock", whyItFits: "Orange males display at leks on the forested inselbergs of the Nouragues reserve and along the Kaw mountain road.", rarityHint: "Likely with a guide to a known lek; occasional on the Kaw road at dawn."},
            {speciesSlug: "capuchinbird", whyItFits: "The bizarre bald-headed cotinga moos from leks in the tall forest of the Guiana Shield interior.", rarityHint: "Uncommon; forest carbets on the Approuague give the best chance."},
            {speciesSlug: "three-toed-sloth", whyItFits: "Sloths hang in the roadside trees around Cayenne and Kourou and are regularly rescued from the city's power lines.", rarityHint: "Common on the coast; scan cecropia trees."},
            {speciesSlug: "white-faced-saki", whyItFits: "Pale-faced male sakis leap through the mid-canopy of the forest around Saül and the Trésor reserve.", rarityHint: "Uncommon; forest treks in the interior."},
            {speciesSlug: "jaguar", whyItFits: "Jaguars are still widespread in the interior forest and are seen occasionally on river beaches of the Approuague and Maroni.", rarityHint: "Rare; tracks on river sandbanks are the realistic sighting."},
            {speciesSlug: "giant-otter", whyItFits: "Giant otters fish the upper Approuague and Maroni rivers in family groups.", rarityHint: "Uncommon; multi-day river trips to the interior."},
            {speciesSlug: "goliath-birdeater", whyItFits: "The world's heaviest spider lives in burrows on the forest floor across French Guiana and emerges at night.", rarityHint: "Likely on a guided night walk; your guide will know a burrow."},
            {speciesSlug: "cayenne-caecilian", whyItFits: "The legless amphibian named after the capital lives in the mud of streams and swamps along the coast.", rarityHint: "Rare; turned up by digging in wet soil or after heavy rain."}
        ],
        bestFor: [
            "Three sea turtle species nesting on one beach",
            "Night boat trips for black caimans at Kaw",
            "Guiana Shield specialities like cock-of-the-rock and capuchinbird",
            "Hammock camps on the forest rivers"
        ],
        spottingTips: [
            "Visit Awala-Yalimapo in May or June and walk the beach after 21:00 with the Kulalasi association guides; red torches only.",
            "Book a Kaw marsh tour that includes the night return; caimans, potoos and fishing bats appear only after dark.",
            "Drive the Route de Kaw at dawn and stop at the viewpoints; cock-of-the-rock, toucans and macaws cross the road.",
            "The Zoo de Guyane at Macouria is the realistic place for jaguars, tapirs, harpy eagles and sakis before you head into the forest."
        ],
        relatedLocationSlugs: ["guyana", "amazon-rainforest", "trinidad-and-tobago", "brazil"],
        rankingSlugs: ["biggest-animals"],
        challengeSlugs: ["crocodile-vs-black-caiman"],
        faq: [
            {question: "What wildlife is there in French Guiana?", answer: "Leatherback, green and olive ridley turtles on the beaches; black caimans, hoatzins, scarlet ibis and giant otters in the wetlands and rivers; sloths, sakis, howlers, tapirs and jaguars in the forest; Guianan cock-of-the-rock and capuchinbirds at forest leks; and goliath birdeaters, giant centipedes and poison frogs on the forest floor."},
            {question: "What animals can be found in French Guiana?", answer: "Easily: sloths and hoatzins, caimans at Kaw, turtles in nesting season and the Cayenne zoo's collection. With a guide: cock-of-the-rock leks and goliath birdeaters at night. With a river expedition: giant otters, sakis and the chance of a jaguar."},
            {question: "When is turtle nesting season in French Guiana?", answer: "Leatherbacks nest from roughly March to July with a peak in May and June; green turtles from May to August; olive ridleys in June and July. Awala-Yalimapo in the west and the Rémire-Montjoly beaches near Cayenne are the main sites."},
            {question: "Is French Guiana safe for wildlife travel?", answer: "Yes. It is a French department with EU standards, good coastal roads and organised tourism at Kaw and Awala-Yalimapo. The interior needs a guide and a boat, and yellow fever vaccination is compulsory for entry."}
        ]
    },
    {
        slug: "guyana",
        name: "Guyana",
        regionType: "country",
        hubRegion: "south-america",
        countryCode: "GY",
        coordinate: {lat: 4.8604, lng: -58.9302, zoom: 6},
        captureArea: {countryCodes: ["GY"]},
        title: "Animals in Guyana: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Guyana: harpy eagles and giant otters in the Rupununi, giant anteaters, arapaima, black caimans, cock-of-the-rock at Kaieteur and the hoatzin.",
        searchIntents: [
            "animals in Guyana",
            "wildlife in Guyana",
            "what animals can be found in Guyana",
            "what wildlife is there in Guyana",
            "Rupununi wildlife",
            "Kaieteur falls animals",
            "Guyana giant otters"
        ],
        quickAnswer: "Guyana is the giants' country. The Rupununi savannas and rivers hold giant otters, giant anteaters, arapaima, black caimans and harpy eagles, with jaguars on the Iwokrama road; Kaieteur falls has golden rocket frogs living in giant bromeliads, cock-of-the-rock leks and swifts that roost behind the water; and the hoatzin, the national bird, lives in the coastal creeks an hour from Georgetown.",
        introduction: [
            "English-speaking, barely visited and 80 percent forested, Guyana is the easiest Guiana Shield country for an independent traveller. The classic circuit runs from Georgetown by small plane to Kaieteur falls, then to the Iwokrama forest and down into the Rupununi savanna lodges at Karanambu, Caiman House and Surama.",
            "The Rupununi is the heart of it: open savanna with giant anteaters, flooded rivers with giant otters and arapaima, and Amerindian villages that run the lodges and the research. It is the kind of place where the guide stops the boat because a harpy eagle is sitting over the river."
        ],
        whyItMatters: [
            "The Rupununi's community-run lodges prove that wildlife tourism can replace hunting and mining as an income in the Guiana Shield. Karanambu's giant otter rehabilitation and the Caiman House black caiman research are both funded by visitors.",
            "Guyana also holds species at densities lost elsewhere: giant anteaters cross the Rupununi savanna in daylight, arapaima still roll in the ponds, and the Iwokrama road has one of the highest rates of jaguar sightings in the Americas."
        ],
        animalsToSpot: [
            {speciesSlug: "giant-otter", whyItFits: "Giant otters fish the Rupununi and Rewa rivers in family groups and were famously hand-reared at Karanambu Lodge.", rarityHint: "Likely on Rupununi river trips in the dry season."},
            {speciesSlug: "giant-anteater", whyItFits: "Anteaters forage the Rupununi savanna around Karanambu and Wichabai in the early morning, visible from a vehicle or horse.", rarityHint: "Likely on a dawn savanna drive."},
            {speciesSlug: "harpy-eagle", whyItFits: "Harpy nests are known at Surama, Iwokrama and Rewa, and the lodges take visitors to active ones in season.", rarityHint: "Likely when a lodge has an active nest; ask before booking."},
            {speciesSlug: "arapaima", whyItFits: "The giant air-breathing fish rolls at the surface of the Rupununi and Rewa ponds, protected by community catch-and-release rules.", rarityHint: "Regular at Rewa and Karanambu ponds in the dry season."},
            {speciesSlug: "black-caiman", whyItFits: "Caiman House at Yupukari runs a long-term black caiman tagging project and takes guests out to catch and measure them at night.", rarityHint: "Guaranteed on a Caiman House night survey."},
            {speciesSlug: "jaguar", whyItFits: "The Iwokrama road and the Essequibo riverbanks have some of the most regular jaguar sightings in South America.", rarityHint: "Occasional; a slow dawn drive on the Iwokrama road gives perhaps a one-in-five chance."},
            {speciesSlug: "guianan-cock-of-the-rock", whyItFits: "A cock-of-the-rock lek sits a few minutes' walk from the Kaieteur falls airstrip, and males display there most mornings.", rarityHint: "Likely at Kaieteur with the ranger; also at Iwokrama's Turtle Mountain."},
            {speciesSlug: "hoatzin", whyItFits: "Guyana's national bird crowds the mangroves and creeks of the Mahaica river east of Georgetown, an easy half-day trip.", rarityHint: "Guaranteed on a Mahaica boat trip."},
            {speciesSlug: "capybara", whyItFits: "Capybaras graze the Rupununi riverbanks and savanna ponds, especially around Karanambu.", rarityHint: "Common in the Rupununi."},
            {speciesSlug: "jabiru", whyItFits: "Jabiru storks stand over the drying Rupununi ponds in the dry season, feeding on fish trapped as the water drops.", rarityHint: "Regular on the savanna wetlands."},
            {speciesSlug: "burgundy-goliath-birdeater", whyItFits: "The Guyanese form of the goliath birdeater lives in burrows on the forest floor at Iwokrama and comes out at night.", rarityHint: "Likely on guided night walks; guides know the burrows."},
            {speciesSlug: "sun-conure", whyItFits: "Sun parakeets survive in the wild only around Karasabai in the South Rupununi, where the village protects them.", rarityHint: "Likely with the Karasabai community guides."},
            {speciesSlug: "lowland-tapir", whyItFits: "Tapirs come to the river to drink at dusk along the Essequibo and Rewa and are regular on the Iwokrama camera traps.", rarityHint: "Occasional on dusk river trips."},
            {speciesSlug: "red-bellied-piranha", whyItFits: "Piranhas are abundant in the Rupununi rivers and a staple of lodge fishing trips.", rarityHint: "Guaranteed if you fish."}
        ],
        bestFor: [
            "Giant otters, anteaters and arapaima in the Rupununi",
            "Harpy eagle nests and jaguar odds in Iwokrama",
            "Kaieteur falls with cock-of-the-rock and golden frogs",
            "Community-run lodges funding real conservation"
        ],
        spottingTips: [
            "Visit in the dry season (September to April); the Rupununi savanna is driveable, ponds concentrate arapaima, caimans and storks, and the lodges run full programmes.",
            "At Kaieteur ask the ranger for the cock-of-the-rock lek and the golden frog bromeliads; both are within fifteen minutes of the airstrip.",
            "Book Caiman House at Yupukari for a night on the river catching black caimans with the research team.",
            "Drive the Iwokrama road between Kurupukari and Surama at first light with the windows down; jaguars use the road itself."
        ],
        relatedLocationSlugs: ["french-guiana", "trinidad-and-tobago", "amazon-rainforest", "brazil"],
        rankingSlugs: ["biggest-animals", "best-hunters"],
        challengeSlugs: ["crocodile-vs-black-caiman"],
        faq: [
            {question: "What wildlife is there in Guyana?", answer: "Giant otters, giant anteaters, giant armadillos, arapaima, black caimans, harpy eagles, jaguars, tapirs, capybaras, howler and spider monkeys, cock-of-the-rock, hoatzins, sun parakeets, bellbirds and goliath birdeaters, concentrated in the Rupununi savannas and the Iwokrama forest."},
            {question: "What animals can be found in Guyana?", answer: "Hoatzins on the Mahaica river and cock-of-the-rock at Kaieteur are near-certain. The Rupununi lodges deliver capybaras, caimans, jabirus and usually giant otters and anteaters. Harpy eagles depend on an active nest, and jaguars are a realistic possibility on the Iwokrama road."},
            {question: "Is Guyana good for seeing jaguars?", answer: "It is one of the better places. The Iwokrama road and the Essequibo and Rewa rivers produce regular sightings, though nothing like the Pantanal's reliability. Dawn drives and dry-season river trips give the best odds."},
            {question: "What are the golden frogs at Kaieteur falls?", answer: "The Kaieteur golden rocket frog lives its whole life inside the water-filled leaves of giant tank bromeliads that grow only on the falls' plateau. Rangers show visitors the plants on the short trail from the airstrip."}
        ]
    },
    {
        slug: "el-salvador",
        name: "El Salvador",
        regionType: "country",
        hubRegion: "north-america",
        countryCode: "SV",
        coordinate: {lat: 13.7942, lng: -88.8965, zoom: 7},
        captureArea: {countryCodes: ["SV"]},
        title: "Animals in El Salvador: What You Can Spot, Learn, and Collect",
        description: "Wildlife in El Salvador: the torogoz motmot, hawksbill and olive ridley turtles at Jiquilisco Bay, pumas and king vultures in El Imposible, Montecristo quetzals.",
        searchIntents: [
            "animals in El Salvador",
            "wildlife in El Salvador",
            "what animals can be found in El Salvador",
            "what wildlife is there in El Salvador",
            "animales de El Salvador",
            "El Imposible national park animals",
            "Jiquilisco bay turtles"
        ],
        quickAnswer: "El Salvador is small and heavily farmed, but its reserves still hold real Central American wildlife. The turquoise-browed motmot, the national bird, lives in gardens and dry forest nationwide; Jiquilisco Bay is the most important hawksbill turtle nesting site in the eastern Pacific and also has olive ridleys and crocodiles; El Imposible National Park has pumas, ocelots, king vultures and great curassows; and Montecristo's cloud forest holds quetzals and emerald toucanets.",
        introduction: [
            "The most densely populated country on the mainland lost most of its forest long ago, so its wildlife survives in a handful of protected pockets. The good news is that they are small, close together and reachable in a day from San Salvador, and the birds in particular are easy.",
            "El Imposible in the west is the biggest and wildest, a dry-to-humid forest on the Guatemalan border. The Cerro Verde and Santa Ana volcanoes have motmots and hummingbirds on the trails, Jiquilisco Bay in the east is a mangrove labyrinth of turtles and crocodiles, and Montecristo in the north is the only cloud forest with resplendent quetzals."
        ],
        whyItMatters: [
            "Jiquilisco's hawksbills matter globally: the eastern Pacific population was thought almost extinct until nesting was rediscovered here in 2008, and local hatcheries now protect most of the nests. Watching a release there supports that recovery.",
            "The torogoz is also a point of national pride, and the fact that a bird this spectacular lives in city parks and coffee farms shows how much wildlife can survive alongside people when it is valued."
        ],
        animalsToSpot: [
            {speciesSlug: "turquoise-browed-motmot", whyItFits: "The torogoz, El Salvador's national bird, swings its racket tail from branches in dry forest, coffee farms and the trails at Cerro Verde.", rarityHint: "Common; near-guaranteed on the Cerro Verde trails."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Jiquilisco Bay and Punta Amapala are the main hawksbill nesting sites in the entire eastern Pacific, with hatcheries at Isla de Méndez and Barra de Santiago.", rarityHint: "Likely at hatcheries June to September; nesting females need a night guide."},
            {speciesSlug: "olive-ridley-sea-turtle", whyItFits: "Olive ridleys nest on the Pacific beaches from El Cuco to Barra de Santiago, with hatchling releases most evenings in season.", rarityHint: "Reliable at beach hatcheries from August to December."},
            {speciesSlug: "american-crocodile", whyItFits: "Crocodiles live in the mangrove channels of Jiquilisco Bay and the Barra de Santiago estuary and bask on the mud at low tide.", rarityHint: "Regular on mangrove boat tours."},
            {speciesSlug: "cougar", whyItFits: "Pumas survive in El Imposible National Park and are recorded on camera traps along the main trails.", rarityHint: "Rarely seen; tracks on the river trails are the realistic find."},
            {speciesSlug: "ocelot", whyItFits: "Ocelots hunt the forest of El Imposible and the Montecristo slopes after dark.", rarityHint: "Rare; night walks with park guards."},
            {speciesSlug: "king-vulture", whyItFits: "The white king vulture soars over the El Imposible ridges and is the park's signature bird.", rarityHint: "Regular overhead at El Imposible on clear mornings."},
            {speciesSlug: "great-curassow", whyItFits: "Curassows walk the El Imposible forest floor in pairs and flush noisily into the trees.", rarityHint: "Uncommon; dawn on the quieter trails."},
            {speciesSlug: "resplendent-quetzal", whyItFits: "Quetzals breed in the Montecristo cloud forest on the Honduran border, the only place in the country to see them.", rarityHint: "Likely at Montecristo from February to May with a guide."},
            {speciesSlug: "spider-monkey", whyItFits: "A small population of black-handed spider monkeys survives in El Imposible and the Nancuchiname forest, the last wild monkeys in the country.", rarityHint: "Rare; ask the El Imposible guards where the troop has been seen."},
            {speciesSlug: "white-nosed-coati", whyItFits: "Coatis forage the trails of El Imposible and Cerro Verde in bands, tails straight up.", rarityHint: "Common in the parks."},
            {speciesSlug: "black-spiny-tailed-iguana", whyItFits: "Garrobos bask on rocks and walls across the dry Pacific lowlands and the ruins at Tazumal and Joya de Cerén.", rarityHint: "Very common in the lowlands."},
            {speciesSlug: "white-tailed-deer", whyItFits: "The venado is El Salvador's national animal and browses the El Imposible forest edges at dusk.", rarityHint: "Uncommon in the wild; regular at dusk in El Imposible."},
            {speciesSlug: "great-kiskadee", whyItFits: "The cristofué shouts from wires and trees in every town and garden in the country.", rarityHint: "Abundant everywhere."}
        ],
        bestFor: [
            "Seeing the torogoz motmot on an easy volcano walk",
            "Hawksbill and olive ridley turtle releases on the Pacific coast",
            "Mangrove boat trips for crocodiles and herons in Jiquilisco Bay",
            "Dry forest hiking with king vultures and coatis in El Imposible"
        ],
        spottingTips: [
            "Walk the Cerro Verde park trails before 09:00 for motmots, toucanets and hummingbirds while the volcano is still clear.",
            "Arrange El Imposible visits through SalvaNatura and stay at the Hostal El Imposible in San Benito to be on the trails at dawn.",
            "For turtles, base at Isla de Méndez or Barra de Santiago in the second half of the year and ask the hatchery about evening releases.",
            "Montecristo's quetzal zone needs a permit and a 4x4 from Metapán; book ahead and go in the February to May breeding season."
        ],
        relatedLocationSlugs: ["costa-rica", "mexico", "cartagena"],
        rankingSlugs: ["rarest-animals"],
        faq: [
            {question: "What wildlife is there in El Salvador?", answer: "Turquoise-browed motmots, king vultures, great curassows, quetzals and toucanets in the forests; pumas, ocelots, coatis, spider monkeys and white-tailed deer in El Imposible and Montecristo; hawksbill and olive ridley turtles, crocodiles and herons on the Pacific coast and in Jiquilisco Bay; and iguanas and kiskadees everywhere."},
            {question: "What animals can be found in El Salvador?", answer: "Motmots, coatis, iguanas and kiskadees are easy anywhere there is a bit of forest. Turtle hatchlings are reliable on the coast from June to December, crocodiles regular on mangrove boats, quetzals likely at Montecristo in spring, and pumas and ocelots are camera-trap animals you are unlikely to see."},
            {question: "Where can you see sea turtles in El Salvador?", answer: "Jiquilisco Bay (Isla de Méndez, Puerto Parada) and Barra de Santiago have hawksbill hatcheries active from June to September, and the beaches from El Cuco to Los Cóbanos release olive ridley hatchlings from August to December. Many surf hotels at El Tunco and El Zonte also host releases."},
            {question: "Is El Salvador safe for wildlife travel?", answer: "The national parks, volcano trails and coastal towns are well used by visitors and have been calm in recent years. Go with park guards in El Imposible and Montecristo, use local guides at Jiquilisco, and avoid driving rural roads after dark."}
        ]
    }
];

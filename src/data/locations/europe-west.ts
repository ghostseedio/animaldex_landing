import type {LocationPageInput} from "@/data/location-types";

export const europeWestLocationPages: LocationPageInput[] = [
    {
        slug: "france",
        name: "France",
        regionType: "country",
        hubRegion: "europe",
        countryCode: "FR",
        coordinate: {lat: 46.6, lng: 2.4, zoom: 5},
        captureArea: {countryCodes: ["FR"]},
        title: "Animals in France: What You Can Spot, Learn, and Collect",
        description: "What wildlife lives in France, from Alpine ibex and Mercantour wolves to Camargue flamingos, Alsace storks, Breton puffins and the garden birds people log most.",
        searchIntents: [
            "animals in France",
            "wildlife in France",
            "what animals can be found in France",
            "what wildlife is there in France",
            "what animals can you see in France",
            "animaux sauvages en France",
            "France wildlife travel"
        ],
        quickAnswer: "France holds more large wild mammals than most visitors expect: Alpine ibex, chamois and marmots in the Alps and Pyrenees, wolves back in the Mercantour and Vercors, and a small brown bear population in the central Pyrenees. Add greater flamingos in the Camargue, white storks in Alsace, puffins and grey seals off Brittany, and a dense everyday cast of magpies, blackbirds, wall lizards and rhinoceros beetles.",
        introduction: [
            "France is the most-logged European country in AnimalDex, and the captures split neatly between two kinds of trip. Mountain and coast trips produce the headline mammals and seabirds. Everything else, which is most of the data, comes from gardens, villages, campsites and city parks: Eurasian magpies, blackbirds, collared doves, honey bees, stick insects and the big European rhinoceros beetle people find on summer evenings.",
            "This page covers the whole country. Each of the six French regions below has its own page with the specific parks, reserves and coasts worth planning around."
        ],
        whyItMatters: [
            "France rewired its wildlife story in a single generation. Wolves crossed back from Italy in 1992 and now number over a thousand. Bearded vultures were reintroduced to the Alps and the Cevennes. Ibex were reseeded from the Gran Paradiso herd. Knowing that history changes how you read a mountain skyline.",
            "It is also an easy country to collect in. Campsites, village squares and roadside picnic stops are full of animals that are new to visitors from other continents: hoopoes, wall lizards, cicadas, Hermann's tortoises in the Var, and the European pond terrapin basking on a log."
        ],
        animalsToSpot: [
            {speciesSlug: "alpine-ibex", whyItFits: "Reintroduced across the French Alps from Italy's Gran Paradiso herd; the Vanoise, Ecrins and Mercantour all hold big, approachable groups on high rock.", rarityHint: "Reliable above 2,000 m in summer; males sit in the open and let you get close."},
            {speciesSlug: "eurasian-wolf", whyItFits: "Wolves returned naturally through the Mercantour in 1992 and have spread to the Vercors, Jura and even the Massif Central. France now has well over a thousand.", rarityHint: "Tracks and howls are realistic in the southern Alps; a sighting is luck."},
            {speciesSlug: "brown-bear", whyItFits: "Around 80 to 90 bears roam the central Pyrenees, mostly in Ariege and the Haute-Garonne, descended from Slovenian animals released in the 1990s and 2000s.", rarityHint: "Very rare to see; scat and claw-marked trees are the realistic find."},
            {speciesSlug: "greater-flamingo", whyItFits: "The Camargue is the only regular flamingo breeding site in France and one of the biggest in the Mediterranean, with over 10,000 pairs in the salt lagoons between the Etang du Fangassier and Aigues-Mortes.", rarityHint: "Guaranteed year-round in the Camargue lagoons."},
            {speciesSlug: "bearded-vulture", whyItFits: "Back in the Alps through a long reintroduction and still wild in the Pyrenees, where the Ossau valley and Gavarnie are classic places to see the orange-stained adults.", rarityHint: "Scarce; scan ridgelines from Gavarnie or the Bargy in the Haute-Savoie."},
            {speciesSlug: "white-stork", whyItFits: "The emblem of Alsace, nesting on church roofs and chimneys in villages like Hunawihr and Munster after near-extinction in the 1970s.", rarityHint: "Guaranteed in Alsace from March to August."},
            {speciesSlug: "red-deer", whyItFits: "The autumn rut in the Chambord, Rambouillet and Tronçais forests draws crowds; it is France's second most captured large mammal in AnimalDex.", rarityHint: "Easy in late September and October at dawn and dusk."},
            {speciesSlug: "wild-boar", whyItFits: "France has more than a million wild boar and they turn up on vineyard edges, in the Fontainebleau forest and even in Riviera suburbs.", rarityHint: "Common but mostly nocturnal; rooted-up ground is the usual sign."},
            {speciesSlug: "atlantic-puffin", whyItFits: "France's only real puffin colony sits on the Sept-Iles off Perros-Guirec in Brittany, a few hundred pairs beside the country's single gannet colony.", rarityHint: "April to July only, by boat from Perros-Guirec."},
            {speciesSlug: "grey-seal", whyItFits: "The Molene archipelago and the Sept-Iles hold France's grey seals, and the Baie de Somme has a fast-growing colony on the Channel coast.", rarityHint: "Reliable on the Baie de Somme sandbanks at low tide."},
            {speciesSlug: "hermanns-tortoise", whyItFits: "Wild only in the Massif des Maures in the Var and on Corsica; the Village des Tortues at Carnoules shows the species and releases rehabilitated animals.", rarityHint: "Rare and protected in the wild; guaranteed at the Village des Tortues."},
            {speciesSlug: "common-wall-lizard", whyItFits: "Basks on every stone wall, railway bank and churchyard south of the Loire and well into Paris; the lizard people actually photograph in France.", rarityHint: "Very common in sun from March to October."},
            {speciesSlug: "eurasian-magpie", whyItFits: "The most logged wild bird in French captures, loud and unmissable in parks, farmland hedges and suburban gardens in every region.", rarityHint: "Guaranteed anywhere with trees and open ground."},
            {speciesSlug: "european-rhinoceros-beetle", whyItFits: "A thumb-sized beetle that comes to lights and compost heaps on warm June evenings, and a regular surprise in French campsite captures.", rarityHint: "Seasonal; look at outdoor lights from late May to July."}
        ],
        bestFor: [
            "Alpine mammals you can approach on foot: ibex, chamois and marmots in the Vanoise and Mercantour",
            "Wetland birds in the Camargue, from flamingos to bee-eaters and rollers",
            "Seabirds and seals on the Breton and Normandy coasts",
            "Garden and village wildlife that fills a beginner's collection fast"
        ],
        spottingTips: [
            "Mountain ibex and marmots are easiest from mid-June to September; snow closes most high trails before then.",
            "Visit the Camargue outside July and August: mosquitoes are brutal in high summer and the birds are better in spring and autumn.",
            "The red deer rut peaks in the last week of September; Chambord and the Foret de Tronçais run guided dusk listening walks.",
            "Log the small stuff. Wall lizards, hoopoes, cicadas and rhinoceros beetles are exotic to most visitors and count just as much as a wolf."
        ],
        relatedLocationSlugs: ["french-riviera", "occitanie", "brittany", "spain"],
        rankingSlugs: ["most-dangerous-animals"],
        challengeSlugs: ["fox-vs-wolf"],
        faq: [
            {question: "What wildlife is there in France?", answer: "Alpine ibex, chamois, marmots, wolves and a small Pyrenean bear population in the mountains; flamingos, bee-eaters and pond terrapins in the Camargue; puffins, gannets and grey seals off Brittany; and a dense everyday cast of magpies, blackbirds, wall lizards, hoopoes and big beetles."},
            {question: "What animals can be found in France?", answer: "Around 120 wild mammal species, including red deer, wild boar, roe deer, red fox, badger, beaver, lynx and wolf, plus Hermann's tortoise in the Var, ocellated lizards in the south, fire salamanders in the eastern forests and about 570 recorded bird species."},
            {question: "Are there dangerous animals in France?", answer: "Very few. The asp viper and adder bite a handful of people a year and deaths are almost unheard of. Wild boar can charge if cornered, and tick-borne disease is the real risk in forests. Wolves and bears avoid people."},
            {question: "Where is the best place in France to see wild animals?", answer: "The Vanoise and Mercantour national parks for ibex, chamois and marmots, the Camargue for flamingos and wetland birds, the Pyrenees for vultures and bears, and the Sept-Iles off Brittany for puffins and gannets."}
        ]
    },
    {
        slug: "french-riviera",
        name: "French Riviera (Provence-Alpes-Côte d'Azur)",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "FR",
        parentSlug: "france",
        coordinate: {lat: 43.9, lng: 6.2, zoom: 7},
        captureArea: {bbox: {north: 45.13, south: 42.98, east: 7.72, west: 4.23}},
        title: "Animals on the French Riviera and in Provence: What You Can Spot, Learn, and Collect",
        description: "Wildlife of Provence-Alpes-Côte d'Azur: Camargue flamingos and pond terrapins, Mercantour wolves and ibex, Hermann's tortoises in the Maures, and summer cicadas.",
        searchIntents: [
            "animals on the French Riviera",
            "wildlife in Provence",
            "what animals can be found in Provence-Alpes-Côte d'Azur",
            "what wildlife is there on the French Riviera",
            "what animals can you see in the Camargue",
            "animaux en Provence",
            "Côte d'Azur wildlife travel"
        ],
        quickAnswer: "Provence-Alpes-Côte d'Azur runs from the Camargue delta to the 3,000 m peaks of the Mercantour, so one region gives you greater flamingos, European pond terrapins and bee-eaters at sea level, wolves, ibex and bearded vultures in the mountains, and Hermann's tortoises, ocellated lizards and wall geckos in the dry hills between. It is the most-captured French region in AnimalDex.",
        introduction: [
            "Most people arrive for Nice, Marseille or the lavender and discover the wildlife by accident: a wall gecko on the hotel wall at night, cicadas screaming from every pine, yellow-legged gulls stealing chips on the Promenade des Anglais. That everyday layer is what users actually log here, along with jays, crows and marsh frogs from the lower Var and Saint-Laurent-du-Var riverbank.",
            "Plan a little and the region opens up. The Camargue sits two hours west of Nice, the Mercantour National Park ninety minutes north, and the Calanques and Maures massifs in between. Each has animals you will see nowhere else in France."
        ],
        whyItMatters: [
            "The Mercantour is where wolves re-entered France in 1992, and it still holds the densest packs in the country alongside reintroduced ibex and bearded vultures. The Alpha wolf park at Saint-Martin-Vesubie, reopened after the damage of Storm Alex in 2020, lets you see captive packs if the wild ones stay hidden.",
            "The Maures massif is the last mainland French stronghold of the Hermann's tortoise, and the Camargue is the Mediterranean's most important flamingo and wetland bird site. Both are under pressure from fire and development, which makes a careful visit worth more than a selfie."
        ],
        animalsToSpot: [
            {speciesSlug: "greater-flamingo", whyItFits: "Over 10,000 pairs nest in the Camargue salt lagoons, historically on the Etang du Fangassier and lately in the Aigues-Mortes salt pans; the Parc Ornithologique du Pont de Gau at Saintes-Maries puts them metres from the boardwalk.", rarityHint: "Guaranteed year-round at Pont de Gau."},
            {speciesSlug: "eurasian-wolf", whyItFits: "The Mercantour holds France's oldest and densest wolf packs; the Alpha park at Saint-Martin-Vesubie keeps three captive packs in forest enclosures.", rarityHint: "Wild sightings are rare luck; the Alpha park is guaranteed."},
            {speciesSlug: "alpine-ibex", whyItFits: "Reintroduced into the Mercantour and now common around the Vallee des Merveilles and the Col de la Lombarde, where males loaf on the rocks beside the trail.", rarityHint: "Reliable above 2,000 m from June to September."},
            {speciesSlug: "bearded-vulture", whyItFits: "Released in the Mercantour from 1993 and now breeding again; the Haute Tinee and the Col de la Bonette are the places to scan.", rarityHint: "Scarce; patient ridge-watching from the Bonette road pays off."},
            {speciesSlug: "hermanns-tortoise", whyItFits: "The Plaine des Maures and the cork-oak hills around Collobrieres hold mainland France's only wild population; the Village des Tortues at Carnoules shows them close up.", rarityHint: "Rare in the wild, best in spring; guaranteed at Carnoules."},
            {speciesSlug: "european-pond-terrapin", whyItFits: "Basks in lines on logs in the Camargue marshes and in the Var's river pools; it is one of the more unusual reptiles logged by local users.", rarityHint: "Common in the Camargue; approach slowly, they drop in at the first footstep."},
            {speciesSlug: "ocellated-lizard", whyItFits: "Europe's largest lizard lives on the stony Crau plain and the dry garrigue of the Alpilles, often sunning on sheep-fold walls.", rarityHint: "Uncommon and wary; hot spring mornings on the Crau are best."},
            {speciesSlug: "yellow-legged-gull", whyItFits: "The big Mediterranean gull of Marseille's Vieux-Port, the Calanques cliffs and the Nice seafront, bold enough to take food from your hand.", rarityHint: "Guaranteed on any stretch of coast."},
            {speciesSlug: "common-wall-gecko", whyItFits: "The chunky Moorish gecko that hunts insects around outdoor lights on villa walls from Menton to the Camargue; a regular night-time capture in the region.", rarityHint: "Very common on warm nights from April to October."},
            {speciesSlug: "european-bee-eater", whyItFits: "Nests in colonies in sandy banks across the Camargue and the Crau; the rolling call overhead is a summer signature.", rarityHint: "Common May to August in the Camargue."},
            {speciesSlug: "cicada", whyItFits: "The sound of Provence. Thousands sing from pines and plane trees above 25 C, and the shed nymph skins on bark are easy to find.", rarityHint: "Guaranteed on hot days from late June to early September."},
            {speciesSlug: "two-tailed-pasha", whyItFits: "A huge, fast butterfly tied to strawberry trees in the Esterel and Maures maquis; it comes down to ripe figs and rotting fruit in late summer.", rarityHint: "Seasonal; late August and September around strawberry tree scrub."},
            {speciesSlug: "marsh-frog", whyItFits: "The loud green frog of Camargue ditches and the Var's riverside pools, calling in daylight and already logged by local users.", rarityHint: "Common from April; heard long before it is seen."},
            {speciesSlug: "eurasian-jay", whyItFits: "Screeches through the oak and pine woods behind Nice and in the Luberon, and turns up in the region's park captures.", rarityHint: "Common year-round in wooded hills."}
        ],
        bestFor: [
            "Flamingos and wetland birds in the Camargue, at close range from the Pont de Gau boardwalks",
            "Wolves, ibex and vultures in the Mercantour National Park",
            "Reptiles: Hermann's tortoise, ocellated lizard, wall gecko and pond terrapin",
            "Everyday Mediterranean wildlife on a beach-and-city holiday"
        ],
        spottingTips: [
            "Camargue mosquitoes peak in July and August; April to June and September to October give better birds and fewer bites.",
            "For wild ibex drive the Col de la Bonette or walk into the Vallee des Merveilles in July or August, when the snow is gone and the herds sit high.",
            "Hermann's tortoises move most on warm, humid mornings in April and May; never pick one up or move it.",
            "Walk any village wall at night with a torch for wall geckos, and check the base of plane trees at dawn for freshly emerged cicadas."
        ],
        relatedLocationSlugs: ["france", "occitanie", "auvergne-rhone-alpes", "liguria"],
        challengeSlugs: ["fox-vs-wolf"],
        faq: [
            {question: "What wildlife is there on the French Riviera?", answer: "Along the coast itself: yellow-legged gulls, wall geckos, wall lizards, cicadas and alpine swifts on the cliffs. An hour inland the Mercantour has wolves, ibex, chamois, marmots and bearded vultures, and the Var hills have wild Hermann's tortoises."},
            {question: "What animals can be found in Provence-Alpes-Côte d'Azur?", answer: "Greater flamingos, bee-eaters, European pond terrapins and the famous white horses in the Camargue; wolves, ibex and golden eagles in the Mercantour; ocellated lizards on the Crau; and wild boar almost everywhere in between."},
            {question: "When is the best time to see flamingos in the Camargue?", answer: "They are present all year. Spring brings courtship displays and the most other birds, and winter numbers are still high. July and August are hot and mosquito-heavy."},
            {question: "Can you see wolves on the French Riviera?", answer: "Wild wolves live in the Mercantour behind Nice but are very hard to see. The Alpha park at Saint-Martin-Vesubie keeps captive packs in large forest enclosures and is the realistic option for most visitors."}
        ]
    },
    {
        slug: "grand-est",
        name: "Grand Est",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "FR",
        parentSlug: "france",
        coordinate: {lat: 48.7, lng: 5.6, zoom: 7},
        captureArea: {bbox: {north: 50.17, south: 47.42, east: 8.23, west: 3.38}},
        title: "Animals in Grand Est: What You Can Spot, Learn, and Collect",
        description: "Wildlife of Alsace, Lorraine and Champagne: white storks on village roofs, chamois and lynx in the Vosges, grebes and bitterns on the Lorraine ponds, magpies, firebugs.",
        searchIntents: [
            "animals in Grand Est",
            "wildlife in Alsace",
            "what animals can be found in Grand Est",
            "what wildlife is there in the Vosges",
            "what animals can you see in Alsace",
            "animaux dans les Vosges",
            "Grand Est wildlife travel"
        ],
        quickAnswer: "Grand Est is stork country: white storks nest on roofs and poles across Alsace from March to August. The Vosges mountains behind them hold chamois, red deer, peregrines and a few Eurasian lynx, while the Lorraine pond district around the Etang de Lindre is one of France's best inland sites for grebes, bitterns and passing spoonbills.",
        introduction: [
            "Grand Est is the second most captured French region in AnimalDex, and the captures are honest: magpies, great tits, collared doves, firebugs at the base of lime trees, leopard slugs after rain, and a brown rat or two around Nancy and Saverne. That is the wildlife of a region of towns, vineyards and canals.",
            "The headline species need a short drive. Storks are easiest in the Alsace wine villages, the Vosges for mountain mammals, and the Lorraine ponds for waterbirds. The Parc Animalier de Sainte-Croix at Rhodes adds wolves, lynx and bears in large forest enclosures for anyone who wants a guaranteed view."
        ],
        whyItMatters: [
            "Alsace nearly lost its storks. Only nine pairs were left in 1974; after reintroduction at Hunawihr and Munster there are now well over a thousand. Every chimney nest you photograph is part of that recovery.",
            "The Vosges were also the site of France's first lynx reintroduction in 1983. The population has struggled, with only a handful of animals left, so a track in the snow there is a genuinely rare record."
        ],
        animalsToSpot: [
            {speciesSlug: "white-stork", whyItFits: "Nests on church roofs, chimneys and purpose-built poles in Hunawihr, Munster, Eguisheim and Strasbourg's Orangerie park; the Alsace emblem.", rarityHint: "Guaranteed March to August across Alsace."},
            {speciesSlug: "red-deer", whyItFits: "The Vosges and the Argonne forests hold big herds; the autumn rut echoes through the Donon and the Foret de Haguenau.", rarityHint: "Easy in late September at dawn and dusk in the forest clearings."},
            {speciesSlug: "wild-boar", whyItFits: "Abundant in the Vosges, the Ardennes and the Champagne forests, and bold enough to raid vineyards on the Alsace plain.", rarityHint: "Common but nocturnal; churned ground along forest tracks is the sign."},
            {speciesSlug: "chamois", whyItFits: "Introduced to the Vosges in the 1950s and now numbering around a thousand on the high Hohneck and Grand Ballon crests.", rarityHint: "Reliable at dawn on the Hohneck ridge above the treeline."},
            {speciesSlug: "eurasian-lynx", whyItFits: "Reintroduced to the Vosges in 1983; the population crashed and only a few individuals remain, with occasional arrivals from the German Palatinate.", rarityHint: "Extremely rare; the Sainte-Croix park is the realistic view."},
            {speciesSlug: "peregrine-falcon", whyItFits: "Nests on the sandstone cliffs of the northern Vosges and on Strasbourg cathedral, hunting pigeons over the city.", rarityHint: "Uncommon; scan cliff faces near Saverne and Dabo in spring."},
            {speciesSlug: "great-crested-grebe", whyItFits: "Displays in pairs on the Etang de Lindre and the Madine lake, head-shaking and weed-dancing in March and April.", rarityHint: "Common on any large Lorraine pond in spring."},
            {speciesSlug: "eurasian-bittern", whyItFits: "The reedbeds of the Lindre pond district hold one of France's few inland breeding populations; the booming call carries at dawn.", rarityHint: "Rare and secretive; heard far more often than seen."},
            {speciesSlug: "fire-salamander", whyItFits: "Black and yellow, wandering beech-forest tracks in the Vosges on wet nights and after summer thunderstorms.", rarityHint: "Seasonal; walk forest roads after rain in spring and autumn."},
            {speciesSlug: "eurasian-magpie", whyItFits: "The most captured bird in Grand Est, loud in Nancy's parks, along the Rhine canal paths and in every village.", rarityHint: "Guaranteed."},
            {speciesSlug: "great-tit", whyItFits: "Logged in the region's gardens and parks; the two-note song starts in January and the birds come to any feeder.", rarityHint: "Very common year-round."},
            {speciesSlug: "firebug", whyItFits: "Clusters in red-and-black masses at the base of lime trees along town avenues in spring and autumn, a regular Grand Est capture.", rarityHint: "Easy on sunny days in April and September."},
            {speciesSlug: "eurasian-collared-dove", whyItFits: "The pale dove of farmyards and village rooftops across Lorraine and Alsace, logged repeatedly by local users.", rarityHint: "Very common."},
            {speciesSlug: "leopard-slug", whyItFits: "Emerges onto damp walls and garden paths at night across the region, big and spotted enough to be worth a photo.", rarityHint: "Common after rain from spring to autumn."}
        ],
        bestFor: [
            "White storks on village roofs along the Alsace wine route",
            "Chamois and red deer in the high Vosges",
            "Waterbirds on the Lorraine pond district",
            "Guaranteed wolves, lynx and bears at the Sainte-Croix animal park"
        ],
        spottingTips: [
            "Storks arrive in Alsace in late February and the chicks stand up on the nests from June; Hunawihr's reintroduction centre lets you watch them at eye level.",
            "For chamois, walk the Hohneck ridge from the Col de la Schlucht at first light before the hikers arrive.",
            "The Etang de Lindre is drained every autumn for the fish harvest, which pulls in thousands of waders and herons in October.",
            "Check the sunny base of lime trees in town avenues for firebug clusters; they are a quick, easy capture in spring."
        ],
        relatedLocationSlugs: ["france", "germany", "auvergne-rhone-alpes"],
        faq: [
            {question: "What wildlife is there in Grand Est?", answer: "White storks across Alsace, chamois, red deer, wild boar, fire salamanders and a handful of lynx in the Vosges, grebes, bitterns and herons on the Lorraine ponds, and everyday magpies, great tits and firebugs in the towns."},
            {question: "What animals can be found in Alsace?", answer: "White storks are the signature species, nesting in most wine villages. The Rhine floodplain forests add beavers, kingfishers and pond terrapins, and the Vosges above the vineyards hold chamois, red deer and peregrines."},
            {question: "Where can you see storks in Alsace?", answer: "Hunawihr's stork and otter reintroduction centre, the Munster valley, Eguisheim, Ribeauville and the Orangerie park in Strasbourg all have active nests from March to August."},
            {question: "Are there wolves in the Vosges?", answer: "Wolves have been confirmed in the Vosges since 2011, but they remain few, mobile and very hard to see. The Parc Animalier de Sainte-Croix in Lorraine keeps several packs in large forest enclosures."}
        ]
    },
    {
        slug: "occitanie",
        name: "Occitanie",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "FR",
        parentSlug: "france",
        coordinate: {lat: 43.7, lng: 2.2, zoom: 7},
        captureArea: {bbox: {north: 45.05, south: 42.33, east: 4.85, west: -0.33}},
        title: "Animals in Occitanie: What You Can Spot, Learn, and Collect",
        description: "Wildlife of the French Pyrenees, Cévennes and Languedoc: bearded vultures, brown bears, marmots and isard, Jonte gorge vultures, Thau flamingos and garrigue lizards.",
        searchIntents: [
            "animals in Occitanie",
            "wildlife in the French Pyrenees",
            "what animals can be found in Occitanie",
            "what wildlife is there in the Cévennes",
            "what animals can you see in the Pyrenees",
            "animaux en Occitanie",
            "Languedoc wildlife travel"
        ],
        quickAnswer: "Occitanie has France's wildest mountains. The central Pyrenees hold the country's brown bears, bearded vultures, marmots, isard and the odd Pyrenean desman in the streams; the Cévennes and the Gorges de la Jonte are the great vulture-watching site of France; and the Languedoc lagoons from Thau to Narbonne fill with flamingos, rollers and bee-eaters.",
        introduction: [
            "Occitanie stretches from the Spanish border to the Rhone, and the captures reflect that spread: red deer and wolves at the Gramat animal park in the Lot, glossy ibis and bar-headed geese in the Camargue gardoise, snails and crane flies from Toulouse gardens, and mute swans on the Canal du Midi.",
            "The wild highlights sit at the edges. The Pyrenees for big mammals and raptors, the Cévennes and Grands Causses for vultures and mouflon, and the coast for lagoon birds. Pezenas and the Herault garrigue in between are perfect for reptiles and insects on a hot afternoon."
        ],
        whyItMatters: [
            "The Gorges de la Jonte and Tarn are where griffon vultures were brought back to France in 1981, followed by cinereous vultures in 1992 and bearded vultures in 2012. All four European vulture species can now be seen on one Causse Mejean skyline.",
            "The Pyrenean bear population is Europe's most contested rewilding project, with around 90 animals mostly in Ariege. Seeing a bear is unlikely, but walking in a landscape that holds them is the point."
        ],
        animalsToSpot: [
            {speciesSlug: "bearded-vulture", whyItFits: "Never went extinct in the Pyrenees; the Gavarnie cirque, the Cirque de Troumouse and the Neouvielle reserve are the classic places to watch adults drop bones onto rock.", rarityHint: "Scarce but reliable with patience at Gavarnie."},
            {speciesSlug: "brown-bear", whyItFits: "Around 90 bears live in the central Pyrenees, mostly in Ariege and the Haute-Garonne, from Slovenian releases in 1996 and 2006.", rarityHint: "Very rare to see; the Maison de l'Ours at Saint-Lary covers the story."},
            {speciesSlug: "alpine-marmot", whyItFits: "Introduced to the Pyrenees from the Alps in 1948 and now whistling from every boulder field above Cauterets and Gavarnie.", rarityHint: "Guaranteed above 1,800 m from June to September."},
            {speciesSlug: "chamois", whyItFits: "The isard, the Pyrenean chamois, is a smaller, paler close relative of the Alpine species; herds graze the slopes of the Neouvielle and Orlu reserves.", rarityHint: "Reliable at dawn in the Orlu reserve near Ax-les-Thermes."},
            {speciesSlug: "pyrenean-desman", whyItFits: "A mole-like aquatic mammal found only in Pyrenean and Iberian mountain streams, hunting insect larvae at night with a trumpet-shaped snout.", rarityHint: "Extremely rare to see; clean fast streams in Ariege at night."},
            {speciesSlug: "cinereous-vulture", whyItFits: "Reintroduced to the Gorges de la Jonte in 1992; Europe's biggest raptor soars with the griffons over the Causse Mejean.", rarityHint: "Uncommon; the Belvedere des Vautours at Le Truel is the place."},
            {speciesSlug: "mouflon", whyItFits: "The Caroux-Espinouse massif above Lamalou-les-Bains holds around 1,500 mouflon, France's largest herd, on open heath and rocky slopes.", rarityHint: "Reliable from the Caroux viewpoints at dawn and dusk."},
            {speciesSlug: "red-deer", whyItFits: "Big herds rut in the Cévennes and the Aigoual forests each autumn, and the species is among the most captured in Occitanie.", rarityHint: "Easy in late September at forest edges; guaranteed at Gramat."},
            {speciesSlug: "greater-flamingo", whyItFits: "The Thau lagoon, the Narbonne etangs and the Bages-Sigean complex hold hundreds year-round, often visible from the road at Sete.", rarityHint: "Reliable in the Languedoc lagoons at any season."},
            {speciesSlug: "glossy-ibis", whyItFits: "Spreading fast through the Camargue gardoise and the Aigues-Mortes marshes, where it has already been logged by local users.", rarityHint: "Increasingly common in spring and autumn."},
            {speciesSlug: "european-roller", whyItFits: "The electric-blue bird of the Herault and Gard plains, perched on wires beside vineyards from May to August.", rarityHint: "Uncommon; drive the back roads around Aigues-Mortes in June."},
            {speciesSlug: "ocellated-lizard", whyItFits: "Lives in the garrigue and dry-stone walls around Pezenas and the Herault plateaus, the biggest lizard in Europe.", rarityHint: "Uncommon and shy; hot mornings in April and May."},
            {speciesSlug: "ladder-snake", whyItFits: "A harmless southern snake of vineyards and stone walls across Languedoc, named for the ladder pattern on juveniles.", rarityHint: "Occasional on warm evenings; often seen crossing quiet roads."},
            {speciesSlug: "eurasian-wolf", whyItFits: "The Parc Animalier de Gramat in the Lot keeps a European wolf pack in a big forest enclosure, and a few wild wolves now roam the Aubrac and Cévennes.", rarityHint: "Guaranteed at Gramat; wild sightings are exceptional."}
        ],
        bestFor: [
            "Vulture watching in the Gorges de la Jonte and Tarn",
            "High Pyrenees mammals: marmots, isard and the chance of a bearded vulture",
            "Lagoon birds along the Languedoc coast",
            "Reptiles and insects in the Herault garrigue"
        ],
        spottingTips: [
            "The Jonte vultures are most active between 10 am and 2 pm when thermals build; mornings are dead.",
            "Caroux mouflon come down to the heath edges in the last hour of light; the Col de l'Ourtigas is a good start.",
            "In the Pyrenees, stay above the treeline after the lifts close; marmots and isard relax when the crowds leave.",
            "Thau lagoon flamingos are easy from the lay-bys on the lido road between Sete and Marseillan; bring a long lens."
        ],
        relatedLocationSlugs: ["france", "french-riviera", "spain", "auvergne-rhone-alpes"],
        challengeSlugs: ["fox-vs-wolf"],
        faq: [
            {question: "What wildlife is there in Occitanie?", answer: "Brown bears, bearded vultures, marmots, isard and desmans in the Pyrenees; griffon, cinereous and bearded vultures over the Gorges de la Jonte; mouflon on the Caroux; flamingos, rollers and bee-eaters on the Languedoc coast; and ocellated lizards and ladder snakes in the garrigue."},
            {question: "What animals can be found in the French Pyrenees?", answer: "Alpine marmot, isard (Pyrenean chamois), brown bear, bearded vulture, golden eagle, Pyrenean desman, Pyrenean brook newt, red deer, wild boar and, increasingly, wolves on the eastern end."},
            {question: "Are there bears in the Pyrenees?", answer: "Yes, around 90 brown bears, most of them in Ariege and the Haute-Garonne. They avoid people and encounters are extremely rare; hikers almost never see one."},
            {question: "Where is the best place to see vultures in France?", answer: "The Belvedere des Vautours at Le Truel in the Gorges de la Jonte, where griffon, cinereous, bearded and Egyptian vultures can all be seen on a good day in late spring."}
        ]
    },
    {
        slug: "auvergne-rhone-alpes",
        name: "Auvergne-Rhône-Alpes",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "FR",
        parentSlug: "france",
        coordinate: {lat: 45.4, lng: 4.5, zoom: 7},
        captureArea: {bbox: {north: 46.8, south: 44.12, east: 7.19, west: 2.06}},
        title: "Animals in Auvergne-Rhône-Alpes: What You Can Spot, Learn, and Collect",
        description: "Wildlife of the Vanoise, Ardèche and Auvergne: ibex, marmots and bearded vultures, Ardèche eagle owls, red kites over the volcanoes, Drôme bee-eaters and Lyon's zoo.",
        searchIntents: [
            "animals in Auvergne-Rhône-Alpes",
            "wildlife in the French Alps",
            "what animals can be found in Auvergne-Rhône-Alpes",
            "what wildlife is there in the Vanoise",
            "what animals can you see in the Ardèche",
            "animaux dans les Alpes françaises",
            "Rhône-Alpes wildlife travel"
        ],
        quickAnswer: "Auvergne-Rhône-Alpes is where France keeps its Alpine wildlife: the Vanoise National Park was created in 1963 to save the ibex, and now holds thousands alongside marmots, chamois, golden eagles and reintroduced bearded vultures. The Ardèche gorges add eagle owls and ocellated lizards, the Auvergne volcanoes red kites and rutting red deer, and the Drôme provençale bee-eaters, cicadas and wall lizards.",
        introduction: [
            "User captures here are mostly southern: wall lizards and rhinoceros beetles around Nyons, field crickets and stick insects in the Ardèche, rabbits and honey bees in the Drôme. The high Alps generate fewer photos because the animals are far away and the walk is steep, but the sightings are the best in France.",
            "The region is large enough that one trip rarely covers it. Chambéry and the Lac du Bourget make a good base for the Vanoise and the Bauges; Vallon-Pont-d'Arc for the Ardèche; Clermont-Ferrand for the Auvergne volcanoes. Lyon's Parc de la Tête d'Or is a free zoo and lake for a city day."
        ],
        whyItMatters: [
            "The Vanoise ibex are the source of most reintroduced herds across the French Alps, and the park's Bargy and Haute-Savoie neighbours were the first bearded vulture release site in France. The whole region is a working example of mountain rewilding.",
            "The Auvergne is also France's red kite stronghold and a major migration corridor over the Puy-de-Dome; in autumn thousands of kites, buzzards and cranes pass the Col de Prat de Bouc in a day."
        ],
        animalsToSpot: [
            {speciesSlug: "alpine-ibex", whyItFits: "The reason the Vanoise National Park exists; the herds around Pralognan, the Col de l'Iseran and Bonneval-sur-Arc number in the thousands and ignore walkers.", rarityHint: "Guaranteed above 2,000 m in the Vanoise from June to September."},
            {speciesSlug: "alpine-marmot", whyItFits: "Whistles from every boulder slope in the Vanoise, the Ecrins and the Bauges; the Col de l'Iseran and the Pralognan meadows are classic.", rarityHint: "Guaranteed in summer; they hibernate from October to April."},
            {speciesSlug: "chamois", whyItFits: "Common on the cliffs of the Vanoise, the Chartreuse and the Vercors, and introduced into the Cantal volcanoes of the Auvergne too.", rarityHint: "Reliable at dawn on steep grassy ledges."},
            {speciesSlug: "golden-eagle", whyItFits: "More than 20 pairs in the Vanoise alone; look for the huge dark silhouette quartering slopes for marmots in midsummer.", rarityHint: "Regular overhead in the high Alps with a patient scan."},
            {speciesSlug: "bearded-vulture", whyItFits: "First released in France at the Bargy massif in Haute-Savoie in 1987; pairs now breed in the Vanoise and over the Col de la Madeleine.", rarityHint: "Scarce; the Bargy and Haute-Tarentaise cliffs are the best bets."},
            {speciesSlug: "eurasian-eagle-owl", whyItFits: "The Gorges de l'Ardèche limestone cliffs hold several pairs; the deep hoot carries across the river at dusk near the Pont d'Arc.", rarityHint: "Uncommon; listen from the gorge road viewpoints in February and March."},
            {speciesSlug: "red-kite", whyItFits: "The Auvergne is the species' French heartland, with kites drifting over the Puys and the Cantal pastures all summer and in thousands on autumn migration.", rarityHint: "Common in the Auvergne from March to October."},
            {speciesSlug: "red-crested-pochard", whyItFits: "The Lac du Bourget near Chambéry and the Dombes ponds north of Lyon are among the species' best French sites, with the orange-headed drakes obvious in winter.", rarityHint: "Reliable on the Bourget from October to March."},
            {speciesSlug: "european-bee-eater", whyItFits: "Colonies dig into sandy river banks across the Drôme provençale around Nyons and along the lower Ardèche.", rarityHint: "Common May to August in the Drôme and Ardèche."},
            {speciesSlug: "common-wall-lizard", whyItFits: "Logged across the region from Nyons stone walls to Lyon's riverbanks; the default lizard of every sunny wall and dry-stone terrace.", rarityHint: "Very common from March to October."},
            {speciesSlug: "european-rhinoceros-beetle", whyItFits: "A frequent Drôme and Ardèche campsite capture, drawn to lights and woodchip piles on warm June nights.", rarityHint: "Seasonal; check outdoor lights in June and July."},
            {speciesSlug: "european-field-cricket", whyItFits: "Chirps from burrows on dry south-facing slopes in the Ardèche and the Drôme from April, already logged by local users.", rarityHint: "Common in spring; sit still near a burrow entrance."},
            {speciesSlug: "european-rabbit", whyItFits: "Grazes vineyard margins and campsite lawns across the Drôme provençale and the Rhône valley at dawn and dusk.", rarityHint: "Common in the south of the region."},
            {speciesSlug: "giraffe", whyItFits: "Lyon's Parc de la Tête d'Or keeps a free-entry African plain with giraffes, zebras and antelope, a ten-minute walk from the Rhône.", rarityHint: "Guaranteed, and free, in Lyon."}
        ],
        bestFor: [
            "Alpine ibex and marmots at close range in the Vanoise",
            "Golden eagles and bearded vultures over the Haute-Savoie and Tarentaise",
            "Eagle owls, bee-eaters and reptiles in the Ardèche and Drôme",
            "Autumn raptor migration and the red deer rut in the Auvergne"
        ],
        spottingTips: [
            "Ibex and marmots in the Vanoise are best from the Pralognan or Bonneval trailheads in July and August; start early before the heat.",
            "Drive the Gorges de l'Ardèche tourist road at dusk in late winter and listen for eagle owls from the belvederes.",
            "The Col de Prat de Bouc in the Cantal counts migrating kites, buzzards and cranes from mid-September to October.",
            "Check outdoor lights at Drôme and Ardèche campsites on warm June nights for rhinoceros beetles and hawk-moths."
        ],
        relatedLocationSlugs: ["france", "french-riviera", "switzerland", "occitanie"],
        rankingSlugs: ["animals-with-best-eyesight"],
        challengeSlugs: ["eagle-vs-owl"],
        faq: [
            {question: "What wildlife is there in Auvergne-Rhône-Alpes?", answer: "Alpine ibex, chamois, marmots, golden eagles and bearded vultures in the Vanoise and Haute-Savoie; eagle owls, beavers and ocellated lizards in the Ardèche gorges; red kites, red deer and wild boar in the Auvergne; and bee-eaters, cicadas and wall lizards in the Drôme provençale."},
            {question: "What animals can be found in the Vanoise National Park?", answer: "Around 2,000 Alpine ibex, several thousand chamois, marmots everywhere above the treeline, more than 20 pairs of golden eagles, bearded vultures, black grouse, rock ptarmigan and mountain hares."},
            {question: "Can you see wild animals near Lyon?", answer: "The Parc de la Tête d'Or has a free zoo with giraffes and zebras plus wild herons and grebes on the lake. The Dombes ponds 40 minutes north hold thousands of ducks, herons and red-crested pochards."},
            {question: "When should you visit the French Alps for wildlife?", answer: "Late June to mid-September for ibex, marmots and chamois above the treeline. Marmots hibernate from October, and most high trails are snowbound until June."}
        ]
    },
    {
        slug: "normandy",
        name: "Normandy",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "FR",
        parentSlug: "france",
        coordinate: {lat: 49.1, lng: 0.3, zoom: 7},
        captureArea: {bbox: {north: 50.07, south: 48.17, east: 1.8, west: -1.95}},
        title: "Animals in Normandy: What You Can Spot, Learn, and Collect",
        description: "Normandy wildlife: harbour seals in the Bay of Mont-Saint-Michel, Cotentin storks, Seine estuary spoonbills, fulmars at Étretat, Sélune salmon and Cerza zoo's rhinos.",
        searchIntents: [
            "animals in Normandy",
            "wildlife in Normandy",
            "what animals can be found in Normandy",
            "what wildlife is there in Normandy",
            "what animals can you see at Mont-Saint-Michel",
            "animaux en Normandie",
            "Normandy wildlife travel"
        ],
        quickAnswer: "Normandy's wildlife is coastal first: harbour seals haul out on the sandbanks of the Bay of Mont-Saint-Michel, grey seals breed on the Chausey islands, bottlenose dolphins work the Normand-Breton gulf, and fulmars, kittiwakes and peregrines nest on the chalk at Étretat. Inland, the Cotentin marshes have white storks and the Seine estuary spoonbills and avocets, and the Cerza zoo near Lisieux adds rhinos and big cats.",
        introduction: [
            "The handful of Normandy captures so far are all small: crane flies, common darters, wasps and hornets from garden and campsite trips. That undersells a region whose coast holds some of the best marine mammal watching in France.",
            "The geography helps. The Bay of Mont-Saint-Michel and the Cotentin are in the west, the Seine estuary and the Alabaster Coast cliffs in the east, and the Normandy forests and the Cerza zoo in between. Two or three bases cover everything."
        ],
        whyItMatters: [
            "The Normand-Breton gulf between the Cotentin and Brittany holds Europe's largest coastal population of bottlenose dolphins, over 400 animals, and the Bay of Mont-Saint-Michel has a growing harbour seal colony on sandbanks visible from the abbey causeway at low tide.",
            "Normandy also led Europe's biggest dam removal. The Vezins and La Roche-qui-Boit dams on the Sélune came down in 2019 and 2022, reopening 90 km of river to Atlantic salmon and sea trout for the first time in a century."
        ],
        animalsToSpot: [
            {speciesSlug: "harbor-seal", whyItFits: "The Bay of Mont-Saint-Michel holds around 60 harbour seals that haul out on sandbanks near the Sée and Sélune mouths at low tide.", rarityHint: "Reliable at low tide from the bay's guided walks; bring binoculars."},
            {speciesSlug: "grey-seal", whyItFits: "The Chausey archipelago off Granville has a small breeding colony, and grey seals mix with the harbour seals hauled out in the Baie des Veys and the Bay of Mont-Saint-Michel.", rarityHint: "Regular on the Chausey boat trips year-round."},
            {speciesSlug: "dolphin", whyItFits: "Bottlenose dolphins live year-round in the Normand-Breton gulf, often close inshore off the Cotentin's west coast and around the Chausey islands.", rarityHint: "Frequent from boats out of Granville and Carteret in summer."},
            {speciesSlug: "white-stork", whyItFits: "The Marais du Cotentin et du Bessin holds one of northern France's few stork populations, with nests on poles around Carentan.", rarityHint: "Reliable in the Cotentin marshes from March to August."},
            {speciesSlug: "eurasian-spoonbill", whyItFits: "Breeds in the Seine estuary reserve near Le Havre and feeds in the Cotentin marshes; one of the region's most elegant waterbirds.", rarityHint: "Regular in spring and summer in the Seine estuary."},
            {speciesSlug: "pied-avocet", whyItFits: "Nests on the Seine estuary lagoons and sweeps its upturned bill through the Baie des Veys mud.", rarityHint: "Common on the estuaries from April to September."},
            {speciesSlug: "northern-fulmar", whyItFits: "Glides stiff-winged along the chalk cliffs of Étretat and Cap Fagnet, one of the species' southern breeding limits.", rarityHint: "Reliable at Étretat from February to August."},
            {speciesSlug: "black-legged-kittiwake", whyItFits: "A noisy colony packs the chalk ledges at Cap Fagnet near Fecamp, screaming its name all spring.", rarityHint: "Guaranteed at Cap Fagnet from April to July."},
            {speciesSlug: "peregrine-falcon", whyItFits: "Nests on the Alabaster Coast cliffs and the Suisse Normande crags, hunting pigeons and waders over the estuaries.", rarityHint: "Uncommon; scan cliff tops at Étretat and the Roche d'Oetre."},
            {speciesSlug: "red-deer", whyItFits: "The Écouves, Lyons and Andaines forests hold strong herds; the Écouves rut is one of the best in western France.", rarityHint: "Easy at dusk in late September and early October."},
            {speciesSlug: "atlantic-salmon", whyItFits: "Running again through the Sélune since the dams came down, and still fished on the Orne, Sée and Sienne; the Normandy rivers are one of the species' last French strongholds.", rarityHint: "Seasonal; watch fish passes in autumn and early winter."},
            {speciesSlug: "white-rhinoceros", whyItFits: "The Cerza zoo at Hermival-les-Vaux near Lisieux keeps white rhinos on a big open plain alongside giraffes, lions and tigers.", rarityHint: "Guaranteed at Cerza."},
            {speciesSlug: "common-darter", whyItFits: "The late-summer dragonfly of Normandy's ponds, canals and marsh ditches, already logged by regional users.", rarityHint: "Common July to October around still water."},
            {speciesSlug: "european-crane-fly", whyItFits: "Emerges in clouds from damp meadows in late summer and drifts into every gîte, which is how it ends up in Normandy captures.", rarityHint: "Very common in August and September."}
        ],
        bestFor: [
            "Harbour seals and dolphins around the Bay of Mont-Saint-Michel and the Chausey islands",
            "Cliff seabirds at Étretat and Cap Fagnet",
            "Estuary birds on the Seine and in the Cotentin marshes",
            "A family zoo day at Cerza near Lisieux"
        ],
        spottingTips: [
            "Seal watching in the Bay of Mont-Saint-Michel needs a licensed guide; the tide comes in fast and the sandbanks are dangerous alone.",
            "Cap Fagnet above Fecamp is a better kittiwake and fulmar viewpoint than the crowded Étretat arches.",
            "The Cotentin storks are easiest from the Maison du Parc at Saint-Come-du-Mont, which also has hides over the marsh.",
            "Chausey boats from Granville run year-round and give grey seals, dolphins and big wader flocks at low water."
        ],
        relatedLocationSlugs: ["france", "brittany", "united-kingdom"],
        faq: [
            {question: "What wildlife is there in Normandy?", answer: "Harbour and grey seals, bottlenose dolphins, fulmars, kittiwakes and peregrines along the coast; white storks, spoonbills and avocets in the marshes and estuaries; red deer, roe deer and wild boar in the forests; and salmon running the western rivers."},
            {question: "What animals can be found in Normandy?", answer: "Beyond the seals and seabirds, Normandy has otters, roe deer in every forest, hares in the Pays de Caux, kingfishers, barn owls on the farms and a well-known white rhino and big cat collection at the Cerza zoo near Lisieux."},
            {question: "Can you see seals at Mont-Saint-Michel?", answer: "Yes. Around 60 harbour seals live in the bay and rest on sandbanks near the river mouths at low tide. Guided bay walks from Genets or the abbey causeway are the safe way to see them."},
            {question: "When is the best time for wildlife in Normandy?", answer: "May and June for cliff seabirds and storks, late September for the red deer rut, and winter for the biggest wader and duck flocks on the estuaries. Seals and dolphins are present all year."}
        ]
    },
    {
        slug: "brittany",
        name: "Brittany",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "FR",
        parentSlug: "france",
        coordinate: {lat: 48.2, lng: -2.9, zoom: 7},
        captureArea: {bbox: {north: 48.9, south: 47.28, east: -1.02, west: -5.15}},
        title: "Animals in Brittany: What You Can Spot, Learn, and Collect",
        description: "Brittany wildlife: Sept-Îles puffins and gannets, grey seals and dolphins in the Iroise sea off Crozon, basking sharks, Gulf of Morbihan spoonbills and harbour crabs.",
        searchIntents: [
            "animals in Brittany",
            "wildlife in Brittany",
            "what animals can be found in Brittany",
            "what wildlife is there in Brittany",
            "what animals can you see in Brittany France",
            "animaux en Bretagne",
            "Brittany wildlife travel"
        ],
        quickAnswer: "Brittany is France's seabird and marine mammal coast. The Sept-Îles off Perros-Guirec hold the country's only puffin and gannet colonies, the Molène archipelago off Crozon has its biggest grey seal colony and a resident pod of bottlenose dolphins, and basking sharks and sunfish cruise the Iroise in summer. The Gulf of Morbihan adds spoonbills, egrets and huge winter wader flocks.",
        introduction: [
            "The few Brittany captures so far are beach-holiday finds: black-headed gulls, cabbage whites, a tortoise in someone's garden. The real list is offshore and along the rocky shore, where any low tide gives shore crabs, periwinkles, hermit crabs and the chance of a spider crab or small lobster under the weed.",
            "Base yourself on the north coast around Perros-Guirec for seabirds, the Crozon peninsula or Brest for seals, dolphins and the Océanopolis aquarium, and the Gulf of Morbihan in the south for waders."
        ],
        whyItMatters: [
            "The Sept-Îles reserve is France's oldest bird reserve, created in 1912 after hunters nearly wiped out the puffins. It now holds around 20,000 pairs of gannets on Île Rouzic, the only gannet colony in France.",
            "The Iroise marine park protects a grey seal colony, a resident group of around 40 bottlenose dolphins off Molène and Sein, and one of Europe's richest kelp forests. Otters are also back along most Breton rivers after near-extinction."
        ],
        animalsToSpot: [
            {speciesSlug: "atlantic-puffin", whyItFits: "A few hundred pairs nest on the Sept-Îles, the only puffin colony in France; boats from Perros-Guirec circle the islands without landing.", rarityHint: "April to mid-July only; numbers are small so look hard."},
            {speciesSlug: "northern-gannet", whyItFits: "Île Rouzic in the Sept-Îles is white with around 20,000 pairs, France's single gannet colony, plunge-diving all around the tour boats.", rarityHint: "Guaranteed on the Sept-Îles boats from March to September."},
            {speciesSlug: "razorbill", whyItFits: "Nests in crevices on the Sept-Îles and Cap Frehel cliffs alongside guillemots; easy to pick out by the blunt white-lined bill.", rarityHint: "Reliable April to July at Cap Frehel and the Sept-Îles."},
            {speciesSlug: "grey-seal", whyItFits: "The Molène archipelago holds France's largest grey seal colony, and the Sept-Îles another; seals bob beside the boats and haul out on the skerries.", rarityHint: "Reliable on boats from Le Conquet and Perros-Guirec year-round."},
            {speciesSlug: "dolphin", whyItFits: "Bottlenose dolphins live year-round around Molène and the Île de Sein, and the Normand-Breton gulf pod ranges along the north coast.", rarityHint: "Frequent on Iroise sea crossings in summer."},
            {speciesSlug: "harbor-porpoise", whyItFits: "Small groups surface briefly off the Raz de Sein and the Crozon headlands, the most common cetacean inshore.", rarityHint: "Regular but brief; scan calm water from Pointe du Raz."},
            {speciesSlug: "basking-shark", whyItFits: "Brittany is France's main basking shark coast; Europe's biggest fish is seen off Ouessant, the Glenan islands and in the Iroise from May to August.", rarityHint: "Occasional; calm, plankton-rich days in June and July."},
            {speciesSlug: "european-otter", whyItFits: "Brittany is one of France's otter strongholds, with animals on the Monts d'Arrée rivers, the Aulne and even the Rance estuary.", rarityHint: "Rare to see; spraints on riverside rocks are the realistic find."},
            {speciesSlug: "eurasian-spoonbill", whyItFits: "Feeds in the Gulf of Morbihan and the Baie de Quiberon marshes, with a breeding colony on the Lac de Grand-Lieu just over the border.", rarityHint: "Regular in the Gulf of Morbihan from spring to autumn."},
            {speciesSlug: "little-egret", whyItFits: "The white heron of every Breton estuary, oyster bed and harbour at low tide, from Morlaix to the Gulf of Morbihan.", rarityHint: "Very common year-round on the coast."},
            {speciesSlug: "black-headed-gull", whyItFits: "The small gull of Breton beaches and harbours, already logged by local users; brown-hooded in summer and white-headed in winter.", rarityHint: "Guaranteed on any beach."},
            {speciesSlug: "spider-crab", whyItFits: "The araignée de mer of Breton fish markets, which moves inshore in spring and can be found under weed on big low tides.", rarityHint: "Seasonal; spring low tides on rocky shores, guaranteed at the market."},
            {speciesSlug: "european-lobster", whyItFits: "Lives in crevices along the rocky Breton coast and is the pride of the Roscoff and Camaret fisheries.", rarityHint: "Occasional under rocks at very low tide; guaranteed at Océanopolis."},
            {speciesSlug: "shore-crab", whyItFits: "The green crab of every Breton rock pool, the first animal most children find on a Brittany beach.", rarityHint: "Guaranteed at low tide."}
        ],
        bestFor: [
            "Puffins, gannets and razorbills on the Sept-Îles boat trip",
            "Grey seals, dolphins and the chance of a basking shark in the Iroise sea",
            "Rock-pooling for crabs, lobsters and shore life on big low tides",
            "Waders, spoonbills and egrets in the Gulf of Morbihan"
        ],
        spottingTips: [
            "Book the Sept-Îles boat from Perros-Guirec for a calm morning in May or June, when puffins are ashore and gannets are feeding chicks.",
            "Check the tide coefficient: anything over 90 exposes rock pools you never normally see, with spider crabs and small lobsters under the weed.",
            "For seals and dolphins take the Le Conquet to Ouessant ferry via Molène and stand at the bow.",
            "Basking sharks show on flat-calm days after a week of sun; scan from Pointe du Raz or Pointe de Pen-Hir for a tall fin moving slowly."
        ],
        relatedLocationSlugs: ["france", "normandy", "wales", "united-kingdom"],
        rankingSlugs: ["biggest-animals"],
        faq: [
            {question: "What wildlife is there in Brittany?", answer: "Puffins, gannets, razorbills and guillemots on the Sept-Îles and Cap Frehel; grey seals, bottlenose dolphins, harbour porpoises and summer basking sharks in the Iroise sea; otters on the rivers; spoonbills, egrets and waders in the Gulf of Morbihan; and crabs, lobsters and shore life on every rocky beach."},
            {question: "What animals can be found in Brittany?", answer: "Marine mammals and seabirds dominate, but inland Brittany also has roe deer, wild boar, red squirrels, Eurasian otters, beavers reintroduced on the Monts d'Arrée, and a strong hen harrier and nightjar population on the heaths."},
            {question: "Where can you see puffins in France?", answer: "Only on the Sept-Îles off Perros-Guirec in northern Brittany, from April to mid-July. Boats circle the islands but landing is banned; the colony is a few hundred pairs, so bring binoculars."},
            {question: "Are there sharks in Brittany?", answer: "Yes, basking sharks visit in summer. They are filter feeders and harmless; small catsharks and smooth-hounds are also common. There has never been a dangerous shark incident on the Breton coast."}
        ]
    },
    {
        slug: "italy",
        name: "Italy",
        regionType: "country",
        hubRegion: "europe",
        countryCode: "IT",
        coordinate: {lat: 42.5, lng: 12.5, zoom: 5},
        captureArea: {countryCodes: ["IT"]},
        title: "Animals in Italy: What You Can Spot, Learn, and Collect",
        description: "Italy's wildlife from the Alps to Sicily: Gran Paradiso ibex, Apennine wolves, Marsican bears, Pelagos fin whales, loggerhead turtles, flamingos, porcupines and gulls.",
        searchIntents: [
            "animals in Italy",
            "wildlife in Italy",
            "what animals can be found in Italy",
            "what wildlife is there in Italy",
            "what animals can you see in Italy",
            "animali selvatici in Italia",
            "Italy wildlife travel"
        ],
        quickAnswer: "Italy has more large carnivores than any other Western European country: around 3,000 Apennine wolves, Marsican brown bears in Abruzzo, Alpine brown bears in Trentino and a growing lynx presence in the Alps. Add Alpine ibex in the Gran Paradiso, crested porcupines across the centre and south, fin and sperm whales in the Pelagos sanctuary, loggerhead turtles nesting in Sicily and Calabria, and flamingos on the Po delta and Sardinian lagoons.",
        introduction: [
            "The Italian captures in AnimalDex are split between the Genoa Aquarium's sharks and sturgeon and everyday wild finds: yellow-legged gulls on Ligurian harbours, great egrets and coypu in the Piedmont rice fields, wall lizards, hornets and a Kuhl's pipistrelle hunting around a streetlight. That is Italy as most people meet it.",
            "This page is the overview. Liguria, the Amalfi Coast and Campania, and Sicily each have their own page with the parks, boat trips and coasts worth planning around."
        ],
        whyItMatters: [
            "Italy never lost its wolves. The Apennine population held on through the 20th century when the rest of Western Europe's were shot out, and it is the source of the wolves now in France and Switzerland. The Gran Paradiso ibex are likewise the ancestors of every Alpine herd.",
            "The country is also a frontline for marine conservation: the Pelagos sanctuary between Liguria, Corsica and Sardinia is the Mediterranean's richest cetacean area, and Italy's southern beaches are seeing record loggerhead nesting."
        ],
        animalsToSpot: [
            {speciesSlug: "alpine-ibex", whyItFits: "The Gran Paradiso herd is the species' only surviving original population, saved as a royal hunting reserve in 1856 and now around 3,000 strong above Cogne and Valsavarenche.", rarityHint: "Guaranteed above 2,200 m in the Gran Paradiso in summer."},
            {speciesSlug: "brown-bear", whyItFits: "The Marsican subspecies clings on in Abruzzo's national park, around 60 animals, and a separate Alpine population of about 100 lives in Trentino.", rarityHint: "Rare; the Abruzzo villages of Villalago and Pescasseroli have the best odds in autumn."},
            {speciesSlug: "wolf", whyItFits: "The Apennine wolf never disappeared and now numbers around 3,000 across the peninsula and the Alps, with packs even on the edge of Rome and Florence.", rarityHint: "Rare to see; the Abruzzo and Casentino forests are the best chance."},
            {speciesSlug: "chamois", whyItFits: "Alpine chamois are common in every Alpine park; the separate Apennine chamois was rescued from near-extinction in Abruzzo and is now on the Gran Sasso and Majella too.", rarityHint: "Reliable on steep slopes in the Alps and Abruzzo at dawn."},
            {speciesSlug: "crested-porcupine", whyItFits: "Europe's only porcupine lives across central and southern Italy, from the Tuscan Maremma to Sicily; quills on a woodland path are a common find.", rarityHint: "Nocturnal and fairly common; quills are easier than the animal."},
            {speciesSlug: "fin-whale", whyItFits: "The Pelagos sanctuary off Liguria and Tuscany holds the Mediterranean's fin whale population; whale-watching boats run from Genoa, Savona and Imperia.", rarityHint: "Frequent on summer trips from the Ligurian coast."},
            {speciesSlug: "loggerhead-sea-turtle", whyItFits: "Nests on beaches in Sicily, Calabria, Puglia and Lampedusa, with record numbers in recent summers; rescue centres on Lampedusa and in Sicily release rehabilitated animals.", rarityHint: "Seasonal; nests June to August, often cordoned off on public beaches."},
            {speciesSlug: "greater-flamingo", whyItFits: "Breeds in Sardinia's Molentargius lagoon inside Cagliari and on the Po delta, and winters at Vendicari in Sicily and the Orbetello lagoon.", rarityHint: "Guaranteed at Molentargius; reliable at Vendicari in winter."},
            {speciesSlug: "yellow-legged-gull", whyItFits: "The most captured wild bird in Italian AnimalDex data, owning every harbour from Genoa to Palermo and nesting on Venetian and Roman rooftops.", rarityHint: "Guaranteed on any coast."},
            {speciesSlug: "great-egret", whyItFits: "Stalks the flooded rice paddies of Piedmont and Lombardy and the Po delta; logged by users in the Vercelli rice country.", rarityHint: "Common in the northern wetlands, especially in winter."},
            {speciesSlug: "common-wall-lizard", whyItFits: "Darts over every ruin, wall and pavement from the Alps to Naples; the lizard that fills Italian captures.", rarityHint: "Very common from March to November."},
            {speciesSlug: "european-hornet", whyItFits: "The big, mostly placid native hornet of Italian woodland and old farm buildings, drawn to fruit and sap in late summer and already in the capture data.", rarityHint: "Common in late summer; much less aggressive than wasps."},
            {speciesSlug: "kuhls-pipistrelle-bat", whyItFits: "The bat flickering around streetlights in Italian towns on warm evenings, including a Liguria capture; it roosts in building crevices.", rarityHint: "Very common at dusk from spring to autumn."},
            {speciesSlug: "rose-ringed-parakeet", whyItFits: "Established in Rome's Villa Borghese and Villa Pamphili parks, in Genoa's Nervi gardens and around Palermo, loud and bright green.", rarityHint: "Reliable in Rome's big parks."}
        ],
        bestFor: [
            "Alpine ibex, chamois and marmots in the Gran Paradiso and Stelvio",
            "Wolves and Marsican bears in the Abruzzo national park",
            "Whales and dolphins in the Pelagos sanctuary off Liguria",
            "Mediterranean coast and city wildlife on an ordinary holiday"
        ],
        spottingTips: [
            "Gran Paradiso ibex are easiest from the Valnontey or Valsavarenche trailheads in July and August; they sit on the trail at dawn.",
            "For Marsican bears, stay in Villalago or Pescasseroli in September and October and watch the valley slopes with a scope at dusk.",
            "Pelagos whale trips run June to September from Genoa and Imperia; fin whales are commonest in July and August.",
            "Walk any ancient site at midday for wall lizards and geckos, and look under streetlights at dusk for Kuhl's pipistrelles."
        ],
        relatedLocationSlugs: ["liguria", "amalfi-coast", "sicily", "switzerland"],
        rankingSlugs: ["biggest-animals"],
        challengeSlugs: ["fox-vs-wolf"],
        faq: [
            {question: "What wildlife is there in Italy?", answer: "Apennine wolves, Marsican and Alpine brown bears, Alpine ibex, chamois, red deer, wild boar and crested porcupines on land; fin whales, sperm whales, striped dolphins and loggerhead turtles at sea; flamingos, bee-eaters, hoopoes and golden eagles among the birds."},
            {question: "What animals can be found in Italy?", answer: "Over 100 mammal species including wolf, bear, lynx, ibex, chamois, porcupine, wildcat and 30 kinds of bat; 10 species of marine mammal in the Pelagos sanctuary; Hermann's tortoises, pond turtles, wall lizards and several harmless snakes; and around 500 recorded birds."},
            {question: "Are there dangerous animals in Italy?", answer: "The asp viper is the only medically significant animal and bites are rare and almost never fatal. Wild boar cause road accidents, wolves and bears avoid people, and the real risks are ticks, jellyfish stings and weever fish on sandy beaches."},
            {question: "Where is the best place to see wildlife in Italy?", answer: "The Gran Paradiso for ibex and marmots, Abruzzo for wolves and bears, the Pelagos sanctuary off Liguria for whales, Vendicari in Sicily for flamingos and turtles, and the Po delta for waterbirds."}
        ]
    },
    {
        slug: "liguria",
        name: "Liguria",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "IT",
        parentSlug: "italy",
        coordinate: {lat: 44.3, lng: 8.6, zoom: 8},
        captureArea: {bbox: {north: 44.68, south: 43.75, east: 10.05, west: 7.49}},
        title: "Animals in Liguria: What You Can Spot, Learn, and Collect",
        description: "Liguria wildlife: fin whales, sperm whales and dolphins in the Pelagos sanctuary, Genoa Aquarium sharks, Cinque Terre lizards and boar, Portofino octopus, Alpine wolves.",
        searchIntents: [
            "animals in Liguria",
            "wildlife in Liguria",
            "what animals can be found in Liguria",
            "what wildlife is there in the Cinque Terre",
            "what animals can you see in Genoa",
            "animali in Liguria",
            "Genoa whale watching"
        ],
        quickAnswer: "Liguria is Italy's whale coast. The Pelagos sanctuary starts a few miles off Genoa, and summer boat trips from Genoa, Savona and Imperia routinely find fin whales, sperm whales and striped dolphins. On land the Cinque Terre terraces are full of wall lizards, wild boar and peregrines, the Portofino marine reserve has octopus and seabream in clear water, and the Ligurian Alps behind Imperia hold wolves and chamois.",
        introduction: [
            "Most Liguria captures come from inside the Genoa Aquarium: sturgeon, zebra sharks, leopard sharks, amberjacks and reef fish. Outside it users have logged yellow-legged gulls on the harbour, wall lizards and a Kuhl's pipistrelle in the lanes, and darters over hill ponds, which is a fair picture of a coastal city with mountains straight behind it.",
            "Genoa itself is the base for the whale boats and the aquarium. The Cinque Terre and Portofino are day trips east, and the Alpi Liguri park is an hour inland from Imperia on the French border."
        ],
        whyItMatters: [
            "The Pelagos sanctuary is the Mediterranean's only international marine protected area, created by Italy, France and Monaco in 1999 for its cetaceans. Fin whales feed here in summer on krill brought up by the Ligurian current.",
            "The Ligurian Alps are also the corridor wolves used to walk from Italy into France in the early 1990s, and the Alpi Marittime and Alpi Liguri parks still hold packs alongside chamois and reintroduced ibex."
        ],
        animalsToSpot: [
            {speciesSlug: "fin-whale", whyItFits: "The second-largest animal on earth feeds in the Pelagos sanctuary off Genoa each summer; whale-watching boats from the Porto Antico find them most trips.", rarityHint: "Frequent June to September from Genoa and Imperia."},
            {speciesSlug: "sperm-whale", whyItFits: "Hunts squid along the deep canyon off Imperia and Sanremo; its blow and raised tail are a regular sight on western Ligurian trips.", rarityHint: "Regular but not guaranteed; the Imperia boats do best."},
            {speciesSlug: "dolphin", whyItFits: "Striped dolphins ride the bow of every Pelagos boat in big, fast pods, and bottlenose dolphins work the coast off Portofino.", rarityHint: "Near-guaranteed on summer trips."},
            {speciesSlug: "wolf", whyItFits: "Packs live in the Alpi Liguri park and the hills behind Genoa, the corridor wolves used to recolonise France in 1992.", rarityHint: "Rare to see; tracks in the Alpi Liguri snow in winter."},
            {speciesSlug: "chamois", whyItFits: "Grazes the limestone ridges of the Alpi Liguri and Alpi Marittime above the Nervia and Argentina valleys.", rarityHint: "Reliable at dawn around Monte Saccarello."},
            {speciesSlug: "wild-boar", whyItFits: "A plague on the Cinque Terre vineyard terraces and bold enough to walk into Genoa's suburbs; the most-encountered large mammal in Liguria.", rarityHint: "Common; often seen at dusk along the Cinque Terre trails."},
            {speciesSlug: "peregrine-falcon", whyItFits: "Nests on the Cinque Terre and Portofino sea cliffs, stooping on pigeons over the villages.", rarityHint: "Regular above the Via dell'Amore cliffs and Punta Chiappa."},
            {speciesSlug: "yellow-legged-gull", whyItFits: "The big gull of Genoa's Porto Antico and every Riviera harbour, logged repeatedly by local users.", rarityHint: "Guaranteed on the coast."},
            {speciesSlug: "common-wall-lizard", whyItFits: "Basks on every dry-stone terrace wall in the Cinque Terre and the sunny lanes of Genoa; already in the Liguria captures.", rarityHint: "Very common from March to November."},
            {speciesSlug: "kuhls-pipistrelle-bat", whyItFits: "Hunts insects around Genoa's streetlights and the Cinque Terre village squares at dusk, and has been logged by a local user.", rarityHint: "Very common at dusk from spring to autumn."},
            {speciesSlug: "common-octopus", whyItFits: "The Portofino marine reserve and the Cinque Terre coves are clear enough to find octopus in rock holes while snorkelling.", rarityHint: "Regular when snorkelling calm rocky coves."},
            {speciesSlug: "white-seabream", whyItFits: "Shoals in the shallows of the Portofino reserve and around the Cinque Terre harbours, the silver fish you see from every jetty.", rarityHint: "Common in clear water year-round."},
            {speciesSlug: "european-sturgeon", whyItFits: "The Genoa Aquarium keeps big sturgeon in its river tanks, logged as European sturgeon more than any other animal in Liguria's AnimalDex data; the wild species is extinct in Italian rivers.", rarityHint: "Guaranteed at the Genoa Aquarium."},
            {speciesSlug: "common-darter", whyItFits: "Patrols hill ponds and reservoirs in the Ligurian Apennines through late summer; a logged local capture.", rarityHint: "Common July to October near still water."}
        ],
        bestFor: [
            "Whale watching for fin whales, sperm whales and dolphins in the Pelagos sanctuary",
            "The Genoa Aquarium, Europe's second-largest, for sharks, dolphins and sturgeon",
            "Snorkelling the Portofino marine reserve",
            "Reptiles, boar and peregrines along the Cinque Terre trails"
        ],
        spottingTips: [
            "Whale trips run from Genoa's Porto Antico on summer weekends and from Imperia and Sanremo more often; July and August give the most fin whales.",
            "Walk the Cinque Terre trails in the first two hours after dawn for wild boar and lizards before the crowds arrive.",
            "Snorkel the Portofino reserve from San Fruttuoso bay in the morning when the water is clearest.",
            "The Alpi Liguri park's Monte Saccarello road gives chamois and raptors with little effort in June."
        ],
        relatedLocationSlugs: ["italy", "french-riviera", "amalfi-coast"],
        rankingSlugs: ["biggest-animals"],
        challengeSlugs: ["orca-vs-blue-whale"],
        faq: [
            {question: "What wildlife is there in Liguria?", answer: "Fin whales, sperm whales and striped dolphins in the Pelagos sanctuary; wolves, chamois and wild boar in the Ligurian Alps and Apennines; peregrines, wall lizards and geckos on the Cinque Terre cliffs; and octopus, seabream and groupers in the Portofino reserve."},
            {question: "What animals can be found in the Cinque Terre?", answer: "Wild boar on the terraces, wall lizards on every wall, peregrines and kestrels on the cliffs, yellow-legged gulls in the harbours, and octopus, seabream and damselfish in the coves. Dolphins pass offshore most summer days."},
            {question: "Can you see whales from Genoa?", answer: "Yes. Whale-watching boats leave the Porto Antico and reach the Pelagos sanctuary within an hour. Fin whales, sperm whales and striped dolphins are the regular sightings from June to September."},
            {question: "Is the Genoa Aquarium worth visiting?", answer: "It is Italy's largest aquarium with dolphins, sharks, manatees, penguins, seals and big sturgeon tanks, and it is where most Liguria captures in AnimalDex come from. Allow three hours."}
        ]
    },
    {
        slug: "amalfi-coast",
        name: "Amalfi Coast and Campania",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "IT",
        parentSlug: "italy",
        coordinate: {lat: 40.75, lng: 14.6, zoom: 8},
        captureArea: {bbox: {north: 41.5, south: 39.98, east: 15.81, west: 13.76}},
        title: "Animals on the Amalfi Coast and in Campania: What You Can Spot, Learn, and Collect",
        description: "Wildlife of the Amalfi Coast, Vesuvius and Cilento: Monti Lattari peregrines, Vesuvius foxes, Cilento wolves, otters and porcupines, Naples bay dolphins and turtles.",
        searchIntents: [
            "animals on the Amalfi Coast",
            "wildlife in Campania",
            "what animals can be found in Campania",
            "what wildlife is there on the Amalfi Coast",
            "what animals can you see on Capri",
            "animali in Campania",
            "Amalfi Coast wildlife travel"
        ],
        quickAnswer: "The Amalfi Coast is cliff country, so its wildlife is cliff wildlife: peregrines, alpine swifts and ravens over the Monti Lattari, wall lizards and geckos on every terrace, cicadas in the lemon groves. Vesuvius adds foxes, rabbits, hoopoes and dormice on the lava slopes, the Cilento national park to the south has wolves, otters and porcupines, and the Bay of Naples and Punta Campanella reserve hold dolphins and passing loggerhead turtles.",
        introduction: [
            "Campania's captures in AnimalDex are still thin, which is odd for one of Italy's most visited regions. Anyone walking the Path of the Gods or climbing Vesuvius can fix that quickly: wall lizards, geckos and swifts are everywhere, and peregrines nest within sight of the Positano road.",
            "The Amalfi Coast and Sorrento peninsula are the obvious base, with Capri a ferry ride away. Vesuvius is a half-day from Naples, and the Cilento coast and mountains two hours south give the big mammals."
        ],
        whyItMatters: [
            "The Cilento, Vallo di Diano e Alburni national park is Italy's second largest and one of the few places in southern Italy where wolves, otters, golden eagles and wildcats share one landscape. Its otter population is the healthiest in the country.",
            "Vesuvius shows how fast life returns after an eruption: the 1944 lava fields now carry holm oak, broom, foxes, hares and over 100 bird species inside a national park on the edge of a city of three million."
        ],
        animalsToSpot: [
            {speciesSlug: "peregrine-falcon", whyItFits: "Nests on the Monti Lattari cliffs above Positano and Amalfi and on Capri's Faraglioni, stooping on pigeons and swifts over the coast road.", rarityHint: "Regular; scan the cliffs from the Path of the Gods."},
            {speciesSlug: "alpine-swift", whyItFits: "Big, white-bellied swifts scream around the Amalfi and Capri cliffs from March to October, nesting in crevices above the sea.", rarityHint: "Common in summer along the whole coast."},
            {speciesSlug: "common-wall-lizard", whyItFits: "Basks on every lemon-terrace wall and ancient stone from Ravello to Pompeii; the default reptile of Campania.", rarityHint: "Very common from March to November."},
            {speciesSlug: "mediterranean-house-gecko", whyItFits: "Hunts moths around hotel lights in Sorrento, Positano and Naples after dark, a nightly capture for anyone who looks up.", rarityHint: "Very common on warm nights."},
            {speciesSlug: "hoopoe", whyItFits: "Probes the Vesuvius lava-field scrub and the olive groves of the Sorrento peninsula, crest raised when it lands.", rarityHint: "Uncommon but regular from April to September."},
            {speciesSlug: "red-fox", whyItFits: "Common on the Vesuvius slopes, where foxes patrol the crater path car parks at dusk, and across the Cilento hills.", rarityHint: "Reliable at dusk around the Vesuvius visitor area."},
            {speciesSlug: "wild-boar", whyItFits: "Abundant in the Cilento and Monti Lattari chestnut woods, and now raiding gardens in Naples' hill suburbs.", rarityHint: "Common but mostly nocturnal; rooted ground is the sign."},
            {speciesSlug: "wolf", whyItFits: "Several packs live in the Cilento and Alburni mountains, and wolves have recently been filmed on Vesuvius itself.", rarityHint: "Rare to see; winter tracking in the Alburni is the best chance."},
            {speciesSlug: "european-otter", whyItFits: "The Cilento rivers Calore, Bussento and Mingardo hold Italy's healthiest otter population, with the species visible on evening river walks.", rarityHint: "Uncommon; dawn or dusk on the Calore gorges near Felitto."},
            {speciesSlug: "crested-porcupine", whyItFits: "Lives in the Cilento and Monti Lattari scrub and leaves black-and-white quills on woodland paths across Campania.", rarityHint: "Nocturnal and fairly common; quills are easy to find."},
            {speciesSlug: "loggerhead-sea-turtle", whyItFits: "Passes through the Bay of Naples and the Punta Campanella reserve, with occasional nests on Cilento beaches like Ascea and Palinuro; Naples has a turtle rescue centre at Portici.", rarityHint: "Occasional at sea in summer; seasonal nests on Cilento beaches."},
            {speciesSlug: "dolphin", whyItFits: "Bottlenose dolphins work the Punta Campanella marine reserve between Sorrento and Capri and are often seen from the Capri ferries.", rarityHint: "Regular from ferries and boat tours in summer."},
            {speciesSlug: "yellow-legged-gull", whyItFits: "The loud gull of every Amalfi harbour, Capri's Marina Grande and the Naples waterfront.", rarityHint: "Guaranteed."},
            {speciesSlug: "hazel-dormouse", whyItFits: "Lives in the hazel and chestnut woods of the Monti Lattari and Vesuvius, where its nibbled nuts are easier to find than the animal.", rarityHint: "Rare to see; look for neatly holed hazelnuts on the ground in autumn."}
        ],
        bestFor: [
            "Cliff birds: peregrines, alpine swifts and ravens above the Amalfi coast road",
            "Easy reptiles and insects on the lemon terraces and ancient sites",
            "Wolves, otters and porcupines in the Cilento national park",
            "Dolphins and turtles from the Capri and Sorrento boats"
        ],
        spottingTips: [
            "Walk the Path of the Gods from Bomerano at first light; peregrines and swifts are active and the lizards are just coming out.",
            "On Vesuvius stay near the crater car park at dusk after the crowds leave for foxes and hoopoes.",
            "In the Cilento, the Calore river gorges at Felitto are the easiest otter site; sit quietly at dusk.",
            "Take the slower ferry to Capri and stand on the upper deck for dolphins off Punta Campanella."
        ],
        relatedLocationSlugs: ["italy", "sicily", "liguria"],
        challengeSlugs: ["eagle-vs-falcon"],
        faq: [
            {question: "What wildlife is there on the Amalfi Coast?", answer: "Peregrine falcons, alpine swifts and ravens on the cliffs, wall lizards and geckos on every wall, cicadas in the lemon groves, yellow-legged gulls in the harbours, and bottlenose dolphins offshore. Wild boar and porcupines roam the Monti Lattari woods above."},
            {question: "What animals can be found in Campania?", answer: "Wolves, otters, wildcats, porcupines and golden eagles in the Cilento national park; foxes, hares, dormice and hoopoes on Vesuvius; loggerhead turtles and dolphins in the Bay of Naples; and a rich cliff birdlife along the Amalfi and Sorrento coasts."},
            {question: "Are there dangerous animals on the Amalfi Coast?", answer: "No. The only venomous snake, the asp viper, is rare on the coast and bites are almost never serious. Jellyfish are the main nuisance in late summer; check the beach flags."},
            {question: "Can you see wildlife on Capri?", answer: "Yes: peregrines and alpine swifts on the cliffs, yellow-legged gulls everywhere, and the famous blue lizard on the Faraglioni rocks, a colour form found nowhere else. Dolphins are often seen from the island boats."}
        ]
    },
    {
        slug: "sicily",
        name: "Sicily",
        regionType: "island",
        hubRegion: "europe",
        countryCode: "IT",
        parentSlug: "italy",
        coordinate: {lat: 37.6, lng: 14.0, zoom: 7},
        captureArea: {bbox: {north: 38.82, south: 35.49, east: 15.65, west: 11.9}},
        title: "Animals in Sicily: What You Can Spot, Learn, and Collect",
        description: "Sicily wildlife: flamingos and loggerhead nests at Vendicari, porcupines and martens on Etna, eagles over the Zingaro cliffs, Aeolian sperm whales and Messina swordfish.",
        searchIntents: [
            "animals in Sicily",
            "wildlife in Sicily",
            "what animals can be found in Sicily",
            "what wildlife is there in Sicily",
            "what animals can you see on Mount Etna",
            "animali in Sicilia",
            "Sicily wildlife travel"
        ],
        quickAnswer: "Sicily's wildlife lives on its edges and its volcano. The Vendicari reserve near Noto fills with greater flamingos, spoonbills and stilts and has loggerhead turtles nesting on its beaches; Etna's lava woods hide porcupines, pine martens and golden eagles; the Zingaro reserve has peregrines and Bonelli's eagles over the cliffs; and the Aeolian islands and the Strait of Messina give sperm whales, dolphins and leaping swordfish.",
        introduction: [
            "Sicily is big enough to be a country and its handful of AnimalDex captures so far, a red-veined darter and some farm ducks, barely scratch it. The island sits on the main bird migration route between Africa and Europe, which means spring and autumn deliver birds you will not see on the mainland.",
            "Catania is the base for Etna and Vendicari, Palermo for the Zingaro reserve and the Madonie mountains, and Milazzo for the Aeolian boats. The whole island is also full of easy wall geckos, hoopoes, bee-eaters and Hermann's tortoises."
        ],
        whyItMatters: [
            "Vendicari and the beaches of south-east Sicily have become one of Italy's most important loggerhead nesting coasts, with volunteers guarding nests on busy public beaches each summer. The flamingo flocks that winter there are the biggest in Sicily.",
            "Etna is a textbook of recolonisation, with porcupines, martens and raptors living on lava flows barely a century old, and the Zingaro reserve was Sicily's first protected area after locals blocked a coast road through it in 1980."
        ],
        animalsToSpot: [
            {speciesSlug: "greater-flamingo", whyItFits: "Hundreds winter on the Vendicari pantani south of Noto and on the Trapani salt pans, pink against the salt and the ruined tuna factory.", rarityHint: "Reliable at Vendicari from September to March."},
            {speciesSlug: "loggerhead-sea-turtle", whyItFits: "Nests on Vendicari's Calamosche and Eloro beaches and along the south-east coast, with record nest counts in recent years; the Lampedusa rescue centre releases rehabilitated turtles.", rarityHint: "Seasonal; cordoned nests June to August, hatchlings in late summer."},
            {speciesSlug: "black-winged-stilt", whyItFits: "Wades the Vendicari lagoons and the Trapani salt pans on absurd pink legs, nesting on the pan banks in spring.", rarityHint: "Common April to September in the salt pans."},
            {speciesSlug: "crested-porcupine", whyItFits: "Common across Sicily's hills and the Etna lava woods; quills are a regular find along the Nebrodi and Madonie trails.", rarityHint: "Nocturnal; quills are easy, the animal is luck on a night drive."},
            {speciesSlug: "pine-marten", whyItFits: "The Etna and Nebrodi forests hold Sicily's martens, which raid the pistachio and chestnut groves on the volcano's lower slopes.", rarityHint: "Rare to see; dusk on the Etna forest roads above Zafferana."},
            {speciesSlug: "golden-eagle", whyItFits: "A few pairs breed on Etna's cliffs and in the Nebrodi and Madonie mountains, soaring over the lava fields in summer.", rarityHint: "Scarce; scan the Valle del Bove rim on clear mornings."},
            {speciesSlug: "peregrine-falcon", whyItFits: "Nests on the Zingaro reserve cliffs, the Scala dei Turchi and the Aeolian island crags, hunting over the sea.", rarityHint: "Regular along the Zingaro coastal path."},
            {speciesSlug: "hoopoe", whyItFits: "Probes the Zingaro reserve's dry grassland and the Val di Noto almond groves, calling its soft three-note name in spring.", rarityHint: "Common from March to September."},
            {speciesSlug: "hermanns-tortoise", whyItFits: "Wild tortoises still graze the scrub of the Zingaro, the Madonie foothills and the south-east pantani edges.", rarityHint: "Uncommon; warm spring mornings on the Zingaro paths."},
            {speciesSlug: "common-wall-gecko", whyItFits: "The chunky Moorish gecko on every Sicilian wall and hotel light after dark, from Palermo to Syracuse.", rarityHint: "Guaranteed on warm nights."},
            {speciesSlug: "european-bee-eater", whyItFits: "Colonies dig into the sandy banks of the Simeto and Platani rivers, and migrating flocks pour over the island in April and September.", rarityHint: "Common April to September."},
            {speciesSlug: "swordfish", whyItFits: "The Strait of Messina is the swordfish's famous Mediterranean spawning ground, still hunted from the traditional feluca boats with a lookout tower.", rarityHint: "Seasonal; seen leaping from Messina boats in June and July."},
            {speciesSlug: "sperm-whale", whyItFits: "The deep water off the Aeolian islands is a sperm whale hotspot; boats from Milazzo and Lipari run dedicated trips in summer.", rarityHint: "Regular but not guaranteed on Aeolian whale trips."},
            {speciesSlug: "red-veined-darter", whyItFits: "A southern dragonfly of warm, shallow pools and salt-pan edges, already logged by a Sicilian user and common across the island.", rarityHint: "Common May to October around still water."}
        ],
        bestFor: [
            "Flamingos, stilts and nesting turtles at Vendicari",
            "Porcupines, martens and eagles on Etna and in the Nebrodi",
            "Cliff birds and tortoises along the Zingaro coastal path",
            "Sperm whales and dolphins from the Aeolian islands"
        ],
        spottingTips: [
            "Vendicari's hides face east; visit in the morning for flamingos and waders with the light behind you.",
            "Drive Etna's forest roads above Zafferana or Nicolosi at dusk for porcupines, martens and foxes crossing the lava.",
            "Spring migration peaks in late April, when bee-eaters, honey buzzards and harriers cross the Strait of Messina in thousands.",
            "Never approach a cordoned turtle nest, and keep lights off on south-east beaches in August when hatchlings emerge."
        ],
        relatedLocationSlugs: ["italy", "amalfi-coast", "liguria"],
        rankingSlugs: ["fastest-animals"],
        faq: [
            {question: "What wildlife is there in Sicily?", answer: "Greater flamingos, spoonbills and black-winged stilts at Vendicari and Trapani; loggerhead turtles nesting on the south-east beaches; porcupines, pine martens, wildcats and golden eagles on Etna and in the Nebrodi; peregrines and tortoises in the Zingaro; sperm whales and dolphins off the Aeolians."},
            {question: "What animals can be found on Mount Etna?", answer: "Red foxes, crested porcupines, pine martens, wildcats, rabbits, hares and over 100 bird species including golden eagles, peregrines and rock partridges, all living on lava flows that are sometimes under a century old."},
            {question: "Are there snakes in Sicily?", answer: "Yes, but only the asp viper is venomous and it is rare and shy. Western whip snakes, leopard snakes and ladder-like four-lined snakes are harmless and far more often seen."},
            {question: "When is the best time for wildlife in Sicily?", answer: "April and May for migration, tortoises and bee-eaters; June to August for turtle nests and whale trips; October to March for the flamingo flocks at Vendicari."}
        ]
    },
    {
        slug: "portugal",
        name: "Portugal",
        regionType: "country",
        hubRegion: "europe",
        countryCode: "PT",
        coordinate: {lat: 39.6, lng: -8.0, zoom: 6},
        captureArea: {countryCodes: ["PT"]},
        title: "Animals in Portugal: What You Can Spot, Learn, and Collect",
        description: "Portugal's wildlife from Gerês to the Algarve: Iberian wolves and lynx, Tagus flamingos, cliff-nesting storks, azure-winged magpies, mongooses and Sado dolphins.",
        searchIntents: [
            "animals in Portugal",
            "wildlife in Portugal",
            "what animals can be found in Portugal",
            "what wildlife is there in Portugal",
            "what animals can you see in Portugal",
            "animais selvagens em Portugal",
            "Portugal wildlife travel"
        ],
        quickAnswer: "Portugal packs Iberia's specialities into a small country: Iberian wolves in Peneda-Gerês and Montesinho, reintroduced Iberian lynx in the Guadiana valley, cinereous vultures over the Tejo Internacional, azure-winged magpies and bee-eaters across the Alentejo, Egyptian mongooses and genets in the cork-oak montado, chameleons in the Algarve, white storks nesting on sea cliffs at Cabo Sardão, and flamingos and resident dolphins in the Tagus and Sado estuaries.",
        introduction: [
            "Portugal's AnimalDex captures lean on raptors: buzzards, little owls, eagle owls and peregrines from a bird-of-prey centre near Aveiro, with yellow-legged gulls and greylag geese from the Porto coast. The wild list is far longer, and most of it is within two hours of Lisbon or Porto.",
            "Use the Porto and Northern Portugal page for the Douro and Gerês, and the Lisbon page for the Tagus estuary, Sintra and the Sado dolphins. This page covers the country and the Alentejo and Algarve in between."
        ],
        whyItMatters: [
            "The Iberian lynx was the world's most endangered cat in 2002 with under 100 animals. Portugal began releases in the Guadiana valley near Mertola in 2015 and now has around 300, part of an Iberian total above 2,000. It is the fastest cat recovery on record.",
            "Portugal's white storks are the only ones in the world that nest on sea cliffs, at Cabo Sardão on the Alentejo coast, and the Sado estuary holds one of Europe's last resident estuary dolphin pods."
        ],
        animalsToSpot: [
            {speciesSlug: "iberian-lynx", whyItFits: "Reintroduced into the Guadiana valley around Mertola from 2015; around 300 now live in Portugal and the Vale do Guadiana park runs guided trips.", rarityHint: "Rare; dawn drives on the Mertola back roads give a real chance."},
            {speciesSlug: "wolf", whyItFits: "Around 300 Iberian wolves survive north of the Douro in Peneda-Gerês, Montesinho and the Alvão hills; the Iberian Wolf Recovery Centre at Mafra keeps rescued animals.", rarityHint: "Very rare to see wild; guaranteed at the Mafra centre on a guided visit."},
            {speciesSlug: "greater-flamingo", whyItFits: "Thousands winter in the Tagus and Sado estuaries, the Ria Formosa and the Ria de Aveiro, and the first breeding attempts have been recorded in the Algarve salt pans.", rarityHint: "Reliable year-round in the Tagus estuary and Ria Formosa."},
            {speciesSlug: "azure-winged-magpie", whyItFits: "The Iberian magpie travels in chattering flocks through the Alentejo cork-oak montado and Algarve pine woods, found nowhere else in Europe.", rarityHint: "Common in the Alentejo and inland Algarve."},
            {speciesSlug: "white-stork", whyItFits: "Nests on pylons, churches and, uniquely, on sea stacks at Cabo Sardão on the Alentejo coast; many Portuguese storks no longer migrate.", rarityHint: "Guaranteed across the south; cliff nests at Cabo Sardão in spring."},
            {speciesSlug: "cinereous-vulture", whyItFits: "Breeds again in the Tejo Internacional park on the Spanish border and in the Serra de Sao Mamede, Europe's largest raptor.", rarityHint: "Scarce; boat trips on the Tagus along the Spanish border give the best views."},
            {speciesSlug: "egyptian-mongoose", whyItFits: "Europe's only wild mongoose trots across Alentejo and Algarve roads in family lines, tail held high.", rarityHint: "Fairly common in the south; mid-morning on quiet montado roads."},
            {speciesSlug: "chameleon", whyItFits: "The Mediterranean chameleon lives in the Algarve's coastal pines and dunes between Faro and Vila Real de Santo Antonio, one of very few wild chameleon populations in Europe.", rarityHint: "Uncommon and well hidden; Ria Formosa dune scrub in autumn."},
            {speciesSlug: "dolphin", whyItFits: "A resident pod of around 30 bottlenose dolphins lives in the Sado estuary at Setubal, and common dolphins are seen on boats from Lisbon, Sesimbra and the Algarve.", rarityHint: "Near-guaranteed on Sado trips from Setubal."},
            {speciesSlug: "common-buzzard", whyItFits: "The most captured raptor in Portugal's AnimalDex data, circling over every stretch of farmland and roadside pole from Minho to the Algarve.", rarityHint: "Very common year-round."},
            {speciesSlug: "little-owl", whyItFits: "Perches on stone walls, ruins and olive trees across the Alentejo in daylight; a repeat capture by Portuguese users.", rarityHint: "Common and easy to see by day in the south."},
            {speciesSlug: "ocean-sunfish", whyItFits: "The Lisbon Oceanário's central tank is one of the few places in the world to see a live sunfish, and wild ones drift off the Algarve and Sesimbra in summer.", rarityHint: "Guaranteed at the Oceanário; occasional from Algarve boats."},
            {speciesSlug: "yellow-legged-gull", whyItFits: "The default big gull of every Portuguese harbour and beach, from Porto's Ribeira to Lagos, and a logged capture in the north.", rarityHint: "Guaranteed."},
            {speciesSlug: "bocages-wall-lizard", whyItFits: "A lizard found only in north-west Iberia, basking on granite walls in the Minho and Gerês and in Porto's parks.", rarityHint: "Common north of the Douro from March to October."}
        ],
        bestFor: [
            "Iberian lynx and wolf country in the Guadiana valley and Peneda-Gerês",
            "Estuary birds: flamingos, spoonbills and avocets on the Tagus, Sado and Ria Formosa",
            "Alentejo specialities like azure-winged magpies, mongooses and cliff storks",
            "Resident dolphins in the Sado estuary"
        ],
        spottingTips: [
            "Lynx sightings around Mertola come to people who drive the dirt roads slowly at first light in autumn and winter.",
            "The Tagus estuary reserve south of Alcochete is best on a rising tide, when birds are pushed toward the salt-pan banks.",
            "Mongooses cross Alentejo roads in family lines mid-morning; slow down on quiet montado tracks.",
            "For storks on sea cliffs, walk the Rota Vicentina from Cabo Sardão lighthouse in April or May."
        ],
        relatedLocationSlugs: ["porto", "lisbon", "spain"],
        rankingSlugs: ["rarest-animals"],
        challengeSlugs: ["fox-vs-wolf"],
        faq: [
            {question: "What wildlife is there in Portugal?", answer: "Iberian wolves and lynx, wild boar, red and roe deer, Egyptian mongooses, genets and wildcats on land; flamingos, spoonbills, storks, bee-eaters and azure-winged magpies among the birds; dolphins, sunfish and loggerhead turtles at sea; and chameleons, ocellated lizards and ladder snakes in the south."},
            {question: "What animals can be found in Portugal?", answer: "Around 100 mammal species, 300 regularly recorded birds, and a rich reptile and amphibian list including the Iberian ribbed newt, marbled newt and Bocage's wall lizard found only in north-west Iberia. The Lisbon Oceanário adds sharks, otters, penguins and a sunfish."},
            {question: "Are there wolves in Portugal?", answer: "Yes, around 300 Iberian wolves live north of the Douro in Peneda-Gerês, Montesinho and the Alvão and Marão hills. They are shy and rarely seen; the Iberian Wolf Recovery Centre near Mafra offers guided visits to rescued animals."},
            {question: "Where can you see dolphins in Portugal?", answer: "The Sado estuary at Setubal has a resident bottlenose pod seen on most boat trips. Common dolphins are frequent from Lisbon, Sesimbra, Peniche and the Algarve, and the Azores are the place for whales."}
        ]
    },
    {
        slug: "porto",
        name: "Porto and Northern Portugal",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "PT",
        parentSlug: "portugal",
        coordinate: {lat: 41.5, lng: -8.0, zoom: 8},
        captureArea: {bbox: {north: 42.16, south: 40.5, east: -6.19, west: -8.9}},
        title: "Animals in Porto and Northern Portugal: What You Can Spot, Learn, and Collect",
        description: "Wildlife of Porto, the Douro and Peneda-Gerês: Iberian wolves and garrano ponies, Douro golden eagles, otters and salamanders, Aveiro flamingos and Porto's harbour gulls.",
        searchIntents: [
            "animals in Porto",
            "wildlife in Northern Portugal",
            "what animals can be found in Porto",
            "what wildlife is there in Peneda-Gerês",
            "what animals can you see in the Douro valley",
            "animais no Norte de Portugal",
            "Porto wildlife travel"
        ],
        quickAnswer: "Northern Portugal is the country's wild corner. Peneda-Gerês national park holds Iberian wolves, roe deer, semi-wild garrano ponies, otters and golden eagles; the Douro Internacional gorges have eagles and vultures on the cliffs; and the Ria de Aveiro south of Porto fills with flamingos and spoonbills. In Porto itself yellow-legged gulls own the Ribeira, grey wagtails work the Douro quays and Bocage's wall lizards bask in the Crystal Palace gardens.",
        introduction: [
            "Porto-region captures so far are a mix of a bird-of-prey centre near Aveiro, with buzzards, owls and a peregrine, and wild coast finds like yellow-legged gulls and greylag geese. The granite hills an hour inland are where the real wildlife is.",
            "Porto is the natural base. Peneda-Gerês is 90 minutes north, the Douro wine valley two hours east, and the Ria de Aveiro an hour south. Most of it works as day trips."
        ],
        whyItMatters: [
            "Peneda-Gerês is Portugal's only national park and its wolf stronghold, with the Iberian wolf sharing the granite plateaux with the garrano, an ancient pony breed that runs semi-wild and is the wolves' main prey.",
            "The Minho and Gerês are also the heartland of species found nowhere else: Bocage's wall lizard, the gold-striped salamander and the Iberian frog all have their core range in these wet granite hills."
        ],
        animalsToSpot: [
            {speciesSlug: "wolf", whyItFits: "Peneda-Gerês and the Alvão and Montesinho hills hold most of Portugal's 300 Iberian wolves; the park's visitor centres cover the species.", rarityHint: "Very rare to see; scat and tracks on the plateau tracks are realistic."},
            {speciesSlug: "domestic-horse", whyItFits: "The garrano, a small ancient pony breed, roams semi-wild across the Gerês plateaux and the Serra d'Arga, grazing between granite boulders.", rarityHint: "Guaranteed on the Gerês high roads around Pitoes das Junias."},
            {speciesSlug: "roe-deer", whyItFits: "Recovering fast across the Gerês and Montesinho oak woods, often seen at dawn on the park's meadow edges.", rarityHint: "Regular at dawn and dusk in Peneda-Gerês."},
            {speciesSlug: "golden-eagle", whyItFits: "Breeds on the cliffs of the Douro Internacional gorges around Miranda do Douro, soaring with griffon and Egyptian vultures.", rarityHint: "Regular from the Douro Internacional viewpoints and boat trips."},
            {speciesSlug: "european-otter", whyItFits: "Northern Portugal's clean granite rivers, the Lima, Cavado and Tamega, hold a dense otter population; they even fish the Douro in Porto at night.", rarityHint: "Uncommon; dawn on quiet Gerês river pools."},
            {speciesSlug: "red-squirrel", whyItFits: "Recolonised northern Portugal from Spain in the 1990s after a century's absence; now common in the Gerês pines and Porto's larger parks.", rarityHint: "Common in pine woods north of the Douro."},
            {speciesSlug: "bocages-wall-lizard", whyItFits: "The north-west Iberian endemic, green-backed males basking on granite walls across the Minho and in Porto's Crystal Palace gardens.", rarityHint: "Common from March to October on sunny walls."},
            {speciesSlug: "fire-salamander", whyItFits: "The wet oak and chestnut woods of Gerês and the Serra do Marão are ideal; the salamanders walk the trails on rainy autumn nights.", rarityHint: "Seasonal; wet nights from October to March."},
            {speciesSlug: "greater-flamingo", whyItFits: "A growing flock uses the Ria de Aveiro salt pans and the Sao Jacinto reserve south of Porto, now present most of the year.", rarityHint: "Reliable at the Aveiro salt pans in autumn and winter."},
            {speciesSlug: "eurasian-spoonbill", whyItFits: "Feeds alongside the flamingos in the Ria de Aveiro and the Minho estuary, sweeping the shallows in small flocks.", rarityHint: "Regular in the Ria de Aveiro outside midsummer."},
            {speciesSlug: "yellow-legged-gull", whyItFits: "The gull of Porto's Ribeira quays and the Foz beaches, logged by local users and bold enough to take a pastel de nata from your hand.", rarityHint: "Guaranteed."},
            {speciesSlug: "common-buzzard", whyItFits: "The most captured raptor in northern Portugal, circling over the Minho farmland and Douro vineyards on every warm day.", rarityHint: "Very common year-round."},
            {speciesSlug: "little-owl", whyItFits: "Sits on Douro valley stone walls and vineyard posts in daylight, a repeat capture by northern users.", rarityHint: "Common in the Douro and Tras-os-Montes."},
            {speciesSlug: "dolphin", whyItFits: "Common dolphins feed off the Porto and Matosinhos coast and are seen from the Foz breakwater and on boats from Porto's Douro mouth.", rarityHint: "Occasional from shore, regular on offshore boat trips."}
        ],
        bestFor: [
            "Wolves, garrano ponies and roe deer in Peneda-Gerês national park",
            "Eagles and vultures on the Douro Internacional cliffs",
            "Flamingos and spoonbills in the Ria de Aveiro",
            "Easy urban wildlife along the Douro in Porto"
        ],
        spottingTips: [
            "Drive the Gerês plateau road to Pitoes das Junias at dawn for garranos, roe deer and the faint chance of a wolf.",
            "The Douro Internacional boat from Miranda do Douro runs beneath the eagle and vulture cliffs; morning light is best.",
            "Walk the Aveiro salt pans from the Marinha da Troncalhada at low tide for flamingos and waders close in.",
            "In Porto, the Crystal Palace gardens give Bocage's wall lizards, peacocks and red squirrels within the city."
        ],
        relatedLocationSlugs: ["portugal", "lisbon", "spain"],
        challengeSlugs: ["fox-vs-wolf"],
        faq: [
            {question: "What wildlife is there in Porto and Northern Portugal?", answer: "Iberian wolves, roe deer, wild boar, otters, red squirrels and semi-wild garrano ponies in Peneda-Gerês; golden eagles, griffon and Egyptian vultures on the Douro gorges; flamingos and spoonbills in the Ria de Aveiro; and gulls, wagtails and Bocage's wall lizards in Porto itself."},
            {question: "What animals can be found in Peneda-Gerês?", answer: "Iberian wolf, roe deer, wild boar, otter, European wildcat, garrano ponies, golden eagle, Bocage's wall lizard, fire salamander and the gold-striped salamander found only in north-west Iberia."},
            {question: "Can you see dolphins from Porto?", answer: "Common dolphins feed off Matosinhos and Foz and are occasionally seen from the breakwater. Boat trips from the Douro mouth and from Aveiro find them regularly in summer."},
            {question: "When is the best time to visit Northern Portugal for wildlife?", answer: "May and June for Gerês flowers, lizards and raptors; autumn for the wolf rut and fire salamanders; and winter for the Aveiro flamingo flocks."}
        ]
    },
    {
        slug: "lisbon",
        name: "Lisbon",
        regionType: "city",
        hubRegion: "europe",
        countryCode: "PT",
        parentSlug: "portugal",
        coordinate: {lat: 38.72, lng: -9.14, zoom: 10},
        captureArea: {bbox: {north: 39.05, south: 38.4, east: -8.75, west: -9.55}},
        title: "Animals in Lisbon: What You Can Spot, Learn, and Collect",
        description: "Lisbon wildlife: Tagus estuary flamingos and avocets, the Oceanário's sunfish, Sado dolphins, Cabo da Roca peregrines, Sintra foxes, castle peacocks and wall geckos.",
        searchIntents: [
            "animals in Lisbon",
            "wildlife in Lisbon",
            "what animals can be found in Lisbon",
            "what wildlife is there in Lisbon",
            "what animals can you see near Lisbon",
            "animais em Lisboa",
            "Lisbon wildlife day trips"
        ],
        quickAnswer: "Lisbon sits on one of Europe's great estuaries, so flamingos, avocets, spoonbills and black-winged stilts feed on the Tagus reserve twenty minutes from the airport. The Oceanário holds a live sunfish, the Sado estuary at Setúbal has resident bottlenose dolphins, Sintra-Cascais has peregrines, foxes and mongooses, and the city itself gives peacocks at the castle, parakeets in the gardens and geckos on every warm wall.",
        introduction: [
            "The Lisbon captures in AnimalDex so far are aquarium fish, which says more about where visitors point their phones than about the city. Lisbon has more accessible wild birds than almost any European capital, because the Tagus estuary nature reserve begins just across the Vasco da Gama bridge.",
            "Everything on this page is a day trip or less: the estuary at Alcochete, the Oceanário at Parque das Nações, the Sado dolphins from Setúbal, the Sintra-Cascais park and Cabo da Roca, and the parks and castle inside the city."
        ],
        whyItMatters: [
            "The Tagus estuary is Portugal's most important wetland and one of the ten most important in Europe for wintering waterbirds, with up to 120,000 birds and a flamingo flock that no longer leaves.",
            "The Sado dolphins are one of very few resident estuary bottlenose populations in Europe, and the pod has been studied since the 1980s. Seeing them is a genuine privilege, not an aquarium show."
        ],
        animalsToSpot: [
            {speciesSlug: "greater-flamingo", whyItFits: "Several thousand use the Tagus estuary salt pans at Alcochete and Samouco year-round, visible from the EVOA visitor centre hides.", rarityHint: "Guaranteed on the estuary; EVOA runs guided visits."},
            {speciesSlug: "pied-avocet", whyItFits: "Thousands winter on the Tagus mudflats and nest on the Samouco salt pans, sweeping the shallows beside the flamingos.", rarityHint: "Common on the estuary from autumn to spring."},
            {speciesSlug: "black-winged-stilt", whyItFits: "Breeds on the Alcochete and Samouco salt pans, shrieking at anyone who walks the banks in May.", rarityHint: "Common April to September."},
            {speciesSlug: "eurasian-spoonbill", whyItFits: "Feeds on the Tagus and Sado estuaries and nests in the cork oaks of the Sado; often seen from the Alcochete waterfront.", rarityHint: "Regular year-round on both estuaries."},
            {speciesSlug: "dolphin", whyItFits: "The Sado estuary's resident bottlenose pod of around 30 lives off Setúbal and Troia, forty minutes from Lisbon; boats run daily.", rarityHint: "Near-guaranteed on Sado trips from Setúbal."},
            {speciesSlug: "ocean-sunfish", whyItFits: "The Oceanário's huge central tank is one of very few places on earth to watch a live Mola mola alongside sharks, rays and tuna.", rarityHint: "Guaranteed at the Oceanário."},
            {speciesSlug: "rose-ringed-parakeet", whyItFits: "A noisy green flock lives in the Jardim da Estrela, Monsanto park and the Gulbenkian gardens, descended from escaped pets.", rarityHint: "Reliable in the Jardim da Estrela."},
            {speciesSlug: "indian-peafowl", whyItFits: "Free-ranging peacocks strut the ramparts of the Castelo de Sao Jorge and the Jardim da Estrela, screaming at tourists.", rarityHint: "Guaranteed at the castle."},
            {speciesSlug: "peregrine-falcon", whyItFits: "Nests on the Cabo da Roca and Cabo Espichel cliffs and hunts pigeons from Lisbon's bridge towers and church spires.", rarityHint: "Regular at Cabo da Roca; occasional over the city."},
            {speciesSlug: "red-fox", whyItFits: "Common in the Sintra hills and Monsanto forest park on the city's edge, where foxes raid picnic areas at dusk.", rarityHint: "Regular at dusk in Monsanto and Sintra."},
            {speciesSlug: "egyptian-mongoose", whyItFits: "Trots across the Sintra-Cascais park trails and the Arrábida scrub south of the Tagus in daylight family lines.", rarityHint: "Fairly common in Arrábida; mid-morning on quiet roads."},
            {speciesSlug: "common-wall-gecko", whyItFits: "The Moorish gecko hunts around streetlights and on the warm limestone walls of Alfama and Belem after dark.", rarityHint: "Guaranteed on warm nights."},
            {speciesSlug: "yellow-legged-gull", whyItFits: "Owns the Cais do Sodre waterfront, the Belem riverside and every miradouro railing in Lisbon.", rarityHint: "Guaranteed."},
            {speciesSlug: "common-swift", whyItFits: "Screams in packs around the Alfama rooftops and the Se cathedral every evening from April to August.", rarityHint: "Guaranteed in summer at dusk."}
        ],
        bestFor: [
            "Flamingos, avocets and stilts on the Tagus estuary reserve",
            "Resident dolphins in the Sado estuary",
            "The Oceanário's sunfish, sea otters and sharks",
            "Easy city wildlife: castle peacocks, parakeets, swifts and geckos"
        ],
        spottingTips: [
            "Book the EVOA visitor centre at Alcochete for the estuary; a rising tide pushes flamingos and waders to the hides.",
            "Sado dolphin boats from Setúbal are most reliable in the morning when the estuary is calm.",
            "The Oceanário is quietest at opening time; the sunfish tank is on the lower level.",
            "Walk the Cabo da Roca cliff path at midday for peregrines and alpine swifts, and Monsanto at dusk for foxes."
        ],
        relatedLocationSlugs: ["portugal", "porto", "spain"],
        rankingSlugs: ["smartest-animals"],
        challengeSlugs: ["dolphin-vs-octopus-intelligence"],
        faq: [
            {question: "What wildlife is there in Lisbon?", answer: "Flamingos, avocets, spoonbills and stilts on the Tagus estuary; bottlenose dolphins in the Sado estuary near Setúbal; peregrines, foxes and mongooses in the Sintra-Cascais park; and peacocks, parakeets, swifts, geckos and gulls inside the city."},
            {question: "What animals can be found near Lisbon?", answer: "Within an hour: Iberian wolves at the Mafra recovery centre, wild boar and genets in Sintra, Egyptian mongooses and ocellated lizards in Arrábida, dolphins in the Sado, and up to 120,000 wintering waterbirds on the Tagus estuary."},
            {question: "Can you see dolphins from Lisbon?", answer: "Yes. The Sado estuary at Setúbal, 40 minutes away, has a resident bottlenose pod seen on almost every boat trip. Common dolphins are also found on boats from Lisbon's Doca de Santo Amaro, with lower odds."},
            {question: "Is the Lisbon Oceanário worth it?", answer: "Yes, especially for the ocean sunfish, which almost no aquarium can keep, plus sea otters, penguins, sharks and rays in a single enormous tank. Allow two hours and go at opening."}
        ]
    },
    {
        slug: "netherlands",
        name: "Netherlands",
        regionType: "country",
        hubRegion: "europe",
        countryCode: "NL",
        coordinate: {lat: 52.2, lng: 5.3, zoom: 7},
        captureArea: {countryCodes: ["NL"]},
        title: "Animals in the Netherlands: What You Can Spot, Learn, and Collect",
        description: "Dutch wildlife: Oostvaardersplassen red deer and spoonbills, Wadden Sea seals, Veluwe boar, barnacle geese by the hundred thousand, storks, urban foxes and parakeets.",
        searchIntents: [
            "animals in the Netherlands",
            "wildlife in Holland",
            "what animals can be found in the Netherlands",
            "what wildlife is there in the Netherlands",
            "what animals can you see in the Netherlands",
            "dieren in Nederland",
            "Netherlands wildlife travel"
        ],
        quickAnswer: "The Netherlands is a bird country first: the Wadden Sea and the Delta hold millions of waders and geese, the Oostvaardersplassen reedbeds have spoonbills, bearded reedlings and bitterns, and storks are back on village poles. Mammals are easier than people expect too, with grey and harbour seals on the Wadden sandbanks, red deer and wild boar on the Veluwe, and foxes and fallow deer in the dunes behind the beaches.",
        introduction: [
            "The Dutch captures in AnimalDex are canal-side: mute swans, Canada geese, magpies, carrion crows and cellar spiders from Zuid-Holland and Noord-Brabant. That is accurate for a country where most people live in cities, and the point of this page is to show how close the wild bits are.",
            "Nothing in the Netherlands is more than two hours away. The Oostvaardersplassen is 40 minutes from Amsterdam, the Veluwe an hour, Texel and the Wadden coast two, and the dunes with their foxes and deer start at the edge of The Hague and Haarlem."
        ],
        whyItMatters: [
            "The Oostvaardersplassen is Europe's most famous rewilding experiment: 56 square kilometres of reclaimed seabed where red deer, Konik horses and Heck cattle were left to shape the land and sea eagles arrived to breed. It is also the first place in the Netherlands where white-tailed eagles nested in modern times.",
            "The Wadden Sea is a World Heritage site and the single most important wetland for migratory birds in Europe. Around 10 million birds pass through each year, and the seal colonies have recovered from a few hundred animals to over 10,000."
        ],
        animalsToSpot: [
            {speciesSlug: "red-deer", whyItFits: "The Oostvaardersplassen herd ran to several thousand before the 2018 cull, and a managed herd of around 500 still grazes the open grassland in full view; the Veluwe adds a wilder forest population.", rarityHint: "Guaranteed at the Oostvaardersplassen from the Praambult viewpoint."},
            {speciesSlug: "grey-seal", whyItFits: "Hauls out on Wadden Sea sandbanks off Texel and Terschelling and breeds in the Voordelta; the Ecomare centre on Texel rehabilitates pups.", rarityHint: "Reliable on seal-watching boats from Texel and Lauwersoog."},
            {speciesSlug: "harbor-seal", whyItFits: "The commoner Wadden seal, with over 7,000 on the sandbanks at low tide; the Pieterburen seal centre releases rescued animals.", rarityHint: "Guaranteed on Wadden boat trips at low water."},
            {speciesSlug: "eurasian-spoonbill", whyItFits: "The Netherlands holds Europe's biggest north-western population, breeding on Texel, Schiermonnikoog and the Oostvaardersplassen.", rarityHint: "Common April to September on Texel and the Oostvaardersplassen."},
            {speciesSlug: "bearded-reedling", whyItFits: "The Oostvaardersplassen and Lauwersmeer reedbeds hold hundreds of these tiny pinging birds, the Dutch stronghold of the species.", rarityHint: "Regular; listen for the ping along reedbed boardwalks on calm days."},
            {speciesSlug: "barnacle-goose", whyItFits: "Most of the world's Russian barnacle geese winter in Friesland and on the Wadden islands, and a resident population now breeds in the Delta.", rarityHint: "Guaranteed in Friesland from October to April."},
            {speciesSlug: "eurasian-oystercatcher", whyItFits: "The loud black-and-white wader of every Wadden mudflat, Delta dyke and even Amsterdam flat roof, where it nests on gravel.", rarityHint: "Very common on all coasts."},
            {speciesSlug: "wild-boar", whyItFits: "The Veluwe holds several thousand boar, seen at the Hoge Veluwe park's feeding sites and along the Kroondomein roads at dusk.", rarityHint: "Reliable at dusk on the Veluwe in autumn."},
            {speciesSlug: "red-fox", whyItFits: "The Amsterdamse Waterleidingduinen dunes have foxes so used to walkers they trot past at arm's length, alongside a huge fallow deer herd.", rarityHint: "Near-guaranteed in the Waterleidingduinen."},
            {speciesSlug: "rose-ringed-parakeet", whyItFits: "Thousands roost in Amsterdam's Vondelpark and The Hague's city centre, among the biggest parakeet populations in Europe.", rarityHint: "Guaranteed at dusk in the Vondelpark."},
            {speciesSlug: "great-crested-grebe", whyItFits: "Displays on Amsterdam's canals and every Dutch lake in March, head-shaking and presenting weed.", rarityHint: "Very common on all still water."},
            {speciesSlug: "mute-swan", whyItFits: "The most captured animal in Dutch AnimalDex data, nesting on canal banks in Rotterdam and Leiden within reach of passers-by.", rarityHint: "Guaranteed on any canal."},
            {speciesSlug: "harbor-porpoise", whyItFits: "The North Sea's commonest cetacean, seen from the Texel and Scheveningen beaches on calm days and from the Wadden ferries.", rarityHint: "Regular but brief; calm mornings from the Texel dunes."},
            {speciesSlug: "white-stork", whyItFits: "Back from near-extinction with over 1,000 pairs, nesting on poles at Het Liesveld, in the Groene Hart villages and on Zeeland churches.", rarityHint: "Reliable April to August in the polder villages."}
        ],
        bestFor: [
            "Big-herd red deer and reedbed birds at the Oostvaardersplassen",
            "Seal-watching boats and wader flocks on the Wadden Sea",
            "Boar and deer on the Veluwe, foxes in the coastal dunes",
            "City birds: grebes, swans, storks and parakeets"
        ],
        spottingTips: [
            "Cycle the Oostvaardersplassen's outer dyke to the Praambult viewpoint at dusk for the deer herds and hunting marsh harriers.",
            "Wadden seal boats from Texel's Oudeschild or Lauwersoog run at low tide; book around the tide table, not the clock.",
            "In the Amsterdamse Waterleidingduinen walk in quietly after 4 pm for foxes and the fallow deer rut in October.",
            "Winter is goose season: Friesland's polders hold hundreds of thousands of barnacle and white-fronted geese from November to March."
        ],
        relatedLocationSlugs: ["belgium", "germany", "united-kingdom"],
        rankingSlugs: ["most-adaptable-animals"],
        faq: [
            {question: "What wildlife is there in the Netherlands?", answer: "Red deer, wild boar, roe deer, foxes and fallow deer on land; grey and harbour seals and harbour porpoises on the coast; spoonbills, bearded reedlings, bitterns, storks, oystercatchers and millions of wintering geese and waders among the birds."},
            {question: "What animals can be found in the Netherlands?", answer: "Around 70 wild mammals including beaver, otter, badger, pine marten and a returning wolf population on the Veluwe, plus some 500 recorded bird species, European tree frogs in Limburg and the natterjack toads of the dunes."},
            {question: "Are there wolves in the Netherlands?", answer: "Yes. Wolves returned in 2015 and several packs now breed on the Veluwe and in Drenthe. They are rarely seen and avoid people."},
            {question: "Where is the best place to see seals in the Netherlands?", answer: "Boat trips from Texel, Lauwersoog and Harlingen reach the Wadden Sea sandbanks where thousands of harbour and grey seals haul out at low tide. The Ecomare centre on Texel and Pieterburen in Groningen show rescued animals."}
        ]
    },
    {
        slug: "belgium",
        name: "Belgium",
        regionType: "country",
        hubRegion: "europe",
        countryCode: "BE",
        coordinate: {lat: 50.6, lng: 4.6, zoom: 7},
        captureArea: {countryCodes: ["BE"]},
        title: "Animals in Belgium: What You Can Spot, Learn, and Collect",
        description: "Belgian wildlife: Zwin storks and avocets, Hoge Kempen nightjars, Ardennes boar, deer and wildcats, Brussels foxes and peregrines, Pairi Daiza pandas, Antwerp okapis.",
        searchIntents: [
            "animals in Belgium",
            "wildlife in Belgium",
            "what animals can be found in Belgium",
            "what wildlife is there in Belgium",
            "what animals can you see in the Ardennes",
            "dieren in België",
            "animaux en Belgique"
        ],
        quickAnswer: "Belgium splits in two. Flanders has the Zwin nature park with its storks, avocets and spoonbills and the Hoge Kempen heath with nightjars and roe deer; the Ardennes in Wallonia have wild boar, red deer, wildcats, dippers and a few returning lynx. Brussels itself has urban foxes, parakeets and peregrines on the cathedral, and Belgian zoos are world-class: giant pandas at Pairi Daiza, okapis at Antwerp and bonobos at Planckendael.",
        introduction: [
            "Belgian captures in AnimalDex come from Flemish gardens: magpies, wood pigeons, cabbage whites, red slugs, earthworms and darter dragonflies over a garden pond. Honest suburban wildlife, and more than most people think they can find in Belgium.",
            "The wild end is the Ardennes, two hours from Brussels, and the coast at Knokke for the Zwin. The zoos sit in between and are among the best in Europe for species you will not see wild anywhere nearby."
        ],
        whyItMatters: [
            "Belgium has the densest road network in Europe, yet wild boar numbers have exploded in the Ardennes, wildcats have spread north from the Ardennes into Flemish Brabant, and a lynx was confirmed in the Semois valley in 2020 for the first time in over a century.",
            "The Zwin is where white storks were reintroduced to Belgium in the 1950s, and its stork nests, avocets and spoonbills now sit beside a brand-new visitor centre on the Dutch border."
        ],
        animalsToSpot: [
            {speciesSlug: "giant-panda", whyItFits: "Pairi Daiza in Brugelette has raised three panda cubs since the pair Hao Hao and Xing Hui arrived in 2014, the only pandas in Belgium.", rarityHint: "Guaranteed at Pairi Daiza; mornings when they eat bamboo."},
            {speciesSlug: "okapi", whyItFits: "Antwerp Zoo has kept okapis since 1919 and runs the world studbook for the species, a legacy of Belgium's Congo history.", rarityHint: "Guaranteed at Antwerp Zoo."},
            {speciesSlug: "bonobo", whyItFits: "Planckendael near Mechelen holds one of the world's largest zoo bonobo groups in a big forested enclosure.", rarityHint: "Guaranteed at Planckendael."},
            {speciesSlug: "white-stork", whyItFits: "Nests on poles around the Zwin nature park at Knokke, where Belgian storks were reintroduced in the 1950s.", rarityHint: "Reliable March to August at the Zwin."},
            {speciesSlug: "pied-avocet", whyItFits: "Breeds on the Zwin's tidal lagoons and on the Uitkerkse Polder flats near Blankenberge.", rarityHint: "Common April to September on the Flemish coast."},
            {speciesSlug: "european-nightjar", whyItFits: "The Hoge Kempen national park heaths hold Belgium's biggest nightjar population, churring from the pines on June nights.", rarityHint: "Seasonal; dusk walks at the Mechelse Heide in June and July."},
            {speciesSlug: "wild-boar", whyItFits: "The Ardennes forests are overrun, with boar crossing roads around Saint-Hubert and La Roche-en-Ardenne at dusk.", rarityHint: "Common; drive forest roads slowly at dusk in autumn."},
            {speciesSlug: "red-deer", whyItFits: "The Saint-Hubert and Hertogenwald forests hold big herds whose autumn rut draws listening walks organised by the Walloon forest service.", rarityHint: "Easy in late September at the Ardennes rut sites."},
            {speciesSlug: "european-wildcat", whyItFits: "The Ardennes hold one of Western Europe's strongest wildcat populations, now spreading north toward Brussels.", rarityHint: "Rare to see; forest edges at dawn in the Semois valley."},
            {speciesSlug: "red-fox", whyItFits: "Brussels has one of Europe's densest urban fox populations, trotting through the Bois de la Cambre and Ixelles streets at night.", rarityHint: "Near-guaranteed at night in Brussels' green suburbs."},
            {speciesSlug: "rose-ringed-parakeet", whyItFits: "Over 10,000 parakeets roost in Brussels, descended from birds released at the Meli Park zoo in 1974; the Cinquantenaire park is full of them.", rarityHint: "Guaranteed in Brussels parks."},
            {speciesSlug: "peregrine-falcon", whyItFits: "Nests on the towers of Brussels' Saint Michael and Saint Gudula cathedral, with a public webcam and spring viewing stand.", rarityHint: "Reliable at the cathedral from March to June."},
            {speciesSlug: "eurasian-magpie", whyItFits: "The most captured bird in Belgium's AnimalDex data, loud in every Flemish garden and Brussels park.", rarityHint: "Guaranteed."},
            {speciesSlug: "ruddy-darter", whyItFits: "A small red dragonfly of garden ponds and ditches, already logged by Flemish users alongside the common darter.", rarityHint: "Common July to September near still water."}
        ],
        bestFor: [
            "World-class zoos: pandas at Pairi Daiza, okapis at Antwerp, bonobos at Planckendael",
            "Storks, avocets and spoonbills at the Zwin",
            "Boar, red deer and wildcats in the Ardennes",
            "Urban wildlife: Brussels foxes, parakeets and cathedral peregrines"
        ],
        spottingTips: [
            "Pairi Daiza's pandas are most active in the first two hours after opening; weekdays outside school holidays avoid the crowds.",
            "The Zwin visitor centre has hides over the lagoon; a rising tide brings avocets and spoonbills close.",
            "Ardennes rut walks are organised at Saint-Hubert in late September; book ahead and dress warmly.",
            "Watch the Brussels cathedral peregrines from the Falcons for Everyone stand on the square in April and May."
        ],
        relatedLocationSlugs: ["netherlands", "france", "germany"],
        rankingSlugs: ["rarest-animals"],
        faq: [
            {question: "What wildlife is there in Belgium?", answer: "Wild boar, red and roe deer, wildcats, badgers, beavers and a few lynx in the Ardennes; storks, avocets and spoonbills at the Zwin; nightjars on the Kempen heaths; and urban foxes, parakeets and peregrines in Brussels."},
            {question: "What animals can be found in Belgium?", answer: "Around 70 wild mammal species, including recently returned beavers, otters and wolves in the Hautes Fagnes; 400 recorded birds; and world-famous zoo animals like Pairi Daiza's giant pandas, Antwerp's okapis and Planckendael's bonobos."},
            {question: "Are there wolves in Belgium?", answer: "Yes. A pack has bred in the Hautes Fagnes since 2020 and a second in Limburg's Kempen. They are very rarely seen."},
            {question: "Which Belgian zoo is best?", answer: "Pairi Daiza near Mons for pandas and sheer scale, Antwerp for okapis and its historic city-centre setting, and Planckendael near Mechelen for bonobos and a family day out."}
        ]
    },
    {
        slug: "ireland",
        name: "Ireland",
        regionType: "country",
        hubRegion: "europe",
        countryCode: "IE",
        coordinate: {lat: 53.3, lng: -8.0, zoom: 6},
        captureArea: {countryCodes: ["IE"]},
        title: "Animals in Ireland: What You Can Spot, Learn, and Collect",
        description: "Irish wildlife: Skellig puffins and gannets, Killarney's native red deer, basking sharks and humpbacks off Kerry and Cork, Shannon dolphins, otters and pine martens.",
        searchIntents: [
            "animals in Ireland",
            "wildlife in Ireland",
            "what animals can be found in Ireland",
            "what wildlife is there in Ireland",
            "what animals can you see in Ireland",
            "Irish wildlife",
            "Ireland wildlife travel"
        ],
        quickAnswer: "Ireland has no snakes, no moles and only one newt, but it has some of the best marine wildlife in Europe: basking sharks off Achill and Kerry, humpback and fin whales off West Cork, a resident bottlenose pod in the Shannon estuary, and puffins and 35,000 pairs of gannets on the Skelligs. On land Killarney holds the last native red deer, otters and Irish hares are everywhere, and pine martens are recovering fast.",
        introduction: [
            "Ireland is thin in AnimalDex so far, which is a gap worth filling. The country's wild list is short on species but long on quality, and most of it is coastal and accessible from the Wild Atlantic Way.",
            "Kerry and West Cork give the seabirds and whales, the Shannon estuary the dolphins, Killarney the red deer, Donegal and Mayo the basking sharks and eagles, and Dublin a zoo with elephants, gorillas and orangutans in Phoenix Park."
        ],
        whyItMatters: [
            "Ireland's island isolation gave it a strange fauna: no snakes, only one newt, an endemic hare subspecies and a stoat subspecies, and red deer that have been in Killarney since the last ice age. Everything here is a slightly different version of Britain's.",
            "The waters off Ireland's south-west have become one of Europe's best whale coasts in the last 20 years, with humpbacks now seen every year off West Cork and Kerry alongside fin and minke whales."
        ],
        animalsToSpot: [
            {speciesSlug: "atlantic-puffin", whyItFits: "Around 8,000 puffins nest on Skellig Michael beside the monastic steps, with more on the Saltees and Great Blasket, and on Rathlin across the border in Northern Ireland.", rarityHint: "Guaranteed on Skellig Michael landings from May to early August."},
            {speciesSlug: "northern-gannet", whyItFits: "Little Skellig is white with around 35,000 pairs, one of the world's largest gannet colonies; the boats circle beneath the cliffs.", rarityHint: "Guaranteed on Skellig boat trips from Portmagee."},
            {speciesSlug: "manx-shearwater", whyItFits: "Thousands breed in burrows on the Skelligs, the Blaskets and Puffin Island, streaming past the boats in rafts at dusk.", rarityHint: "Common at sea off Kerry from April to September."},
            {speciesSlug: "red-deer", whyItFits: "Killarney National Park holds Ireland's only native red deer, around 1,000 animals that have been there since the ice retreated; the rut echoes across Torc and Mangerton in October.", rarityHint: "Reliable at dawn on the Knockreer and Muckross meadows."},
            {speciesSlug: "sika-deer", whyItFits: "Introduced to Killarney in 1865 and now common in the park's oak woods and across Wicklow, where they hybridise with red deer.", rarityHint: "Common in Killarney and the Wicklow Mountains."},
            {speciesSlug: "basking-shark", whyItFits: "Ireland is a global hotspot; sharks gather off Achill, Malin Head and the Blaskets from April to July, sometimes dozens at once.", rarityHint: "Seasonal; calm sunny days in May and June off Achill and Kerry."},
            {speciesSlug: "dolphin", whyItFits: "The Shannon estuary holds Ireland's resident bottlenose pod of over 100, seen on boats from Carrigaholt and Kilrush, and common dolphins work the whole west coast.", rarityHint: "Near-guaranteed on Shannon trips from May to September."},
            {speciesSlug: "humpback-whale", whyItFits: "Humpbacks now return to West Cork and Kerry every year, feeding on sprat off Baltimore, Union Hall and the Blaskets.", rarityHint: "Regular on West Cork whale trips from late summer to winter."},
            {speciesSlug: "grey-seal", whyItFits: "Breeds on the Blaskets, the Inishkeas and the Saltees, with Ireland's biggest colony on Great Blasket's white strand.", rarityHint: "Reliable from Blasket and Saltee boats."},
            {speciesSlug: "european-otter", whyItFits: "Ireland has one of Europe's densest otter populations, fishing rivers, lakes and sea coasts from Connemara to Dublin's Grand Canal.", rarityHint: "Uncommon to see; dawn on quiet Connemara shores."},
            {speciesSlug: "mountain-hare", whyItFits: "The Irish hare is an endemic subspecies that stays brown all year and grazes lowland fields and airport grass, not just mountains.", rarityHint: "Common at dawn on open farmland."},
            {speciesSlug: "pine-marten", whyItFits: "Recovering across the midlands and west and credited with pushing back grey squirrels; Clare, Galway and Wicklow are strongholds.", rarityHint: "Rare to see; dusk on quiet woodland roads in the west."},
            {speciesSlug: "asian-elephant", whyItFits: "Dublin Zoo in Phoenix Park has one of Europe's most successful elephant breeding herds in its Kaziranga Forest Trail.", rarityHint: "Guaranteed at Dublin Zoo."},
            {speciesSlug: "european-robin", whyItFits: "Ireland's garden robins are famously confiding and follow walkers along every hedge and woodland path, singing through the winter.", rarityHint: "Guaranteed."}
        ],
        bestFor: [
            "Skellig boat trips for puffins, gannets and shearwaters",
            "Whales, dolphins and basking sharks along the Wild Atlantic Way",
            "Native red deer and the autumn rut in Killarney",
            "Dublin Zoo and the deer herd in Phoenix Park"
        ],
        spottingTips: [
            "Skellig Michael landing boats sell out months ahead and depend on sea state; eco-tour boats that circle without landing are easier to book.",
            "Basking sharks show on flat-calm days after sunshine; scan from Keem Bay on Achill or Slea Head in Kerry in May and June.",
            "The Killarney rut peaks in the first two weeks of October; the Knockreer meadows at dawn are the easiest viewing.",
            "West Cork whale trips from Baltimore and Union Hall are best from August to November, when humpbacks follow the sprat inshore."
        ],
        relatedLocationSlugs: ["united-kingdom", "scotland", "wales", "iceland"],
        rankingSlugs: ["biggest-animals"],
        challengeSlugs: ["dolphin-vs-shark-intelligence"],
        faq: [
            {question: "What wildlife is there in Ireland?", answer: "Red and sika deer, otters, badgers, foxes, Irish hares, pine martens and red squirrels on land; grey and harbour seals, bottlenose dolphins, humpback, fin and minke whales and basking sharks at sea; and puffins, gannets, shearwaters and storm petrels on the Atlantic islands."},
            {question: "What animals can be found in Ireland?", answer: "Only 26 land mammals, including the endemic Irish hare and Irish stoat, around 450 recorded birds, and a very short herp list: the common frog, smooth newt, natterjack toad and viviparous lizard. There are no snakes, moles or weasels."},
            {question: "Why are there no snakes in Ireland?", answer: "Ireland was cut off from Britain by rising seas around 8,500 years ago, before snakes could recolonise northward after the ice age. Saint Patrick had nothing to do with it."},
            {question: "Where can you see puffins in Ireland?", answer: "Skellig Michael off Kerry is the classic site from May to early August, with the Saltee Islands off Wexford and Great Blasket also holding colonies, and Rathlin Island just across the border in Northern Ireland."}
        ]
    },
    {
        slug: "switzerland",
        name: "Switzerland",
        regionType: "country",
        hubRegion: "europe",
        countryCode: "CH",
        coordinate: {lat: 46.8, lng: 8.2, zoom: 7},
        captureArea: {countryCodes: ["CH"]},
        title: "Animals in Switzerland: What You Can Spot, Learn, and Collect",
        description: "Swiss wildlife: ibex, chamois and marmots in the Swiss National Park, Engadin eagles and bearded vultures, Jura lynx, wolves, red kites, Zurich foxes, Basel's rhinos.",
        searchIntents: [
            "animals in Switzerland",
            "wildlife in Switzerland",
            "what animals can be found in Switzerland",
            "what wildlife is there in the Swiss Alps",
            "what animals can you see in Switzerland",
            "Tiere in der Schweiz",
            "Switzerland wildlife travel"
        ],
        quickAnswer: "Switzerland's wildlife is Alpine and surprisingly easy: Alpine ibex, chamois and marmots sit beside the trails in the Swiss National Park and above Zermatt, golden eagles and bearded vultures patrol the Engadin skies, and red deer gather in herds of hundreds in the Val Trupchun. Lynx live in the Jura, wolves have formed packs in Graubünden and Valais, red kites drift over every Plateau village, and the lakes hold grebes and winter ducks.",
        introduction: [
            "There are no Swiss captures in AnimalDex yet, which makes it an open field. The country's wildlife is in plain sight: marmots whistle from the slopes beside every summer gondola station, ibex graze the Niederhorn ridge above Lake Thun, and foxes walk through Zurich's residential streets at night.",
            "Zernez in the Engadin is the base for the Swiss National Park. Zurich, Bern and Basel give the lakes, kites and Basel Zoo. The Jura along the French border is lynx country, and the Valais has the biggest wolf packs."
        ],
        whyItMatters: [
            "The Swiss National Park, founded in 1914, is the oldest in the Alps and the strictest: no dogs, no leaving the trail, no picking anything. A century of protection means the red deer, chamois and ibex here are the most relaxed in Europe.",
            "Switzerland also led the Alpine lynx and bearded vulture reintroductions and has become the test case for living with wolves, with over 30 packs by 2024 and a heated national debate about culling."
        ],
        animalsToSpot: [
            {speciesSlug: "alpine-ibex", whyItFits: "Extinct in Switzerland by 1800 and smuggled back from Italy in 1906; now 17,000 strong, with easy herds on the Niederhorn above Lake Thun, in the Val Trupchun and above Pontresina.", rarityHint: "Guaranteed on the Niederhorn ridge from June to September."},
            {speciesSlug: "chamois", whyItFits: "Common on steep ground across the Alps and the Jura; the Swiss National Park and the Creux du Van cliffs in Neuchâtel are classic.", rarityHint: "Reliable at dawn on cliffs and high meadows."},
            {speciesSlug: "alpine-marmot", whyItFits: "Whistles from every high meadow from Zermatt to the Engadin; the Murmeltier trail at Saas-Fee has marmots that take carrots from your hand.", rarityHint: "Guaranteed in summer above 1,800 m."},
            {speciesSlug: "red-deer", whyItFits: "The Val Trupchun in the Swiss National Park holds the densest red deer concentration in the Alps, with herds of several hundred visible in September.", rarityHint: "Guaranteed in the Val Trupchun in late summer and the rut."},
            {speciesSlug: "golden-eagle", whyItFits: "Around 350 pairs across Switzerland; the Swiss National Park, the Val Trupchun and the Aletsch region give regular views of birds hunting marmots.", rarityHint: "Regular in the Engadin with a patient scan."},
            {speciesSlug: "bearded-vulture", whyItFits: "Reintroduced in the Engadin from 1991 and now breeding in the Swiss National Park and across Graubünden and Valais, with over 20 pairs.", rarityHint: "Scarce but regular over the Val Trupchun and Ofenpass."},
            {speciesSlug: "eurasian-lynx", whyItFits: "The Jura and the Simmental hold around 300 lynx, reintroduced in the 1970s and Western Europe's best-established population.", rarityHint: "Very rare to see; tracks in Jura snow are the realistic record."},
            {speciesSlug: "gray-wolf", whyItFits: "Wolves re-entered from Italy in 1995 and now form over 30 packs in Graubünden, Valais and Ticino, with the Calanda pack the first to breed in 2012.", rarityHint: "Rare to see; howls in the Valais side valleys at dusk."},
            {speciesSlug: "spotted-nutcracker", whyItFits: "The loud, spotted crow of the Engadin and Arosa pine forests, burying arolla pine seeds and following hikers for crumbs.", rarityHint: "Common in high pine forest."},
            {speciesSlug: "red-kite", whyItFits: "Switzerland holds one of the world's densest red kite populations; they circle over every Plateau town from Bern to Winterthur year-round.", rarityHint: "Guaranteed over farmland on the Swiss Plateau."},
            {speciesSlug: "great-crested-grebe", whyItFits: "Displays on Lake Zurich, Lake Geneva and Lake Constance in spring, and winters in thousands alongside red-crested pochards and tufted ducks.", rarityHint: "Very common on all big lakes."},
            {speciesSlug: "red-fox", whyItFits: "Zurich has one of Europe's best-studied urban fox populations, with animals trotting through Kreis 6 gardens and sleeping on garage roofs.", rarityHint: "Near-guaranteed at night in Zurich's suburbs."},
            {speciesSlug: "indian-rhinoceros", whyItFits: "Basel Zoo has bred more Indian rhinos than any zoo on earth, over 30 calves since 1956, and runs the species' international breeding programme.", rarityHint: "Guaranteed at Basel Zoo."},
            {speciesSlug: "alpine-salamander", whyItFits: "A glossy black salamander that gives birth to live young and walks Alpine trails above 1,000 m on wet mornings in the Bernese Oberland and Glarus.", rarityHint: "Seasonal; rainy summer mornings on high trails."}
        ],
        bestFor: [
            "Ibex, chamois, marmots and red deer in the Swiss National Park",
            "Golden eagles and bearded vultures over the Engadin",
            "Red kites, grebes and lake birds on the Swiss Plateau",
            "Basel Zoo's rhinos and a century of Alpine conservation history"
        ],
        spottingTips: [
            "Take the first Niederhorn gondola from Beatenberg in summer; ibex graze the ridge path within metres before the crowds arrive.",
            "The Val Trupchun from S-chanf is the Swiss National Park's deer valley; mid-September rut mornings are spectacular.",
            "Marmots are most active in the cool early morning and late afternoon; midday heat sends them underground.",
            "Alpine salamanders only surface in rain or heavy dew; a wet July morning on the Grosse Scheidegg trail is ideal."
        ],
        relatedLocationSlugs: ["austria", "auvergne-rhone-alpes", "italy", "germany"],
        rankingSlugs: ["most-agile-animals"],
        challengeSlugs: ["fox-vs-wolf", "eagle-vs-falcon"],
        faq: [
            {question: "What wildlife is there in Switzerland?", answer: "Alpine ibex, chamois, marmots, red and roe deer, lynx, wolves, foxes and beavers; golden eagles, bearded vultures, red kites, nutcrackers, ptarmigan and black grouse; alpine and fire salamanders; and huge winter duck and grebe flocks on the lakes."},
            {question: "What animals can be found in the Swiss Alps?", answer: "Ibex, chamois, marmot, red deer, mountain hare, ermine, golden eagle, bearded vulture, rock ptarmigan, alpine chough, nutcracker, wallcreeper and alpine salamander, most of them visible from marked trails in summer."},
            {question: "Are there bears in Switzerland?", answer: "Only wandering males from the Trentino population in Italy, one or two a year in Graubünden. There is no resident Swiss bear population; the Bern Bear Park keeps captive brown bears in the city."},
            {question: "When is the best time to see ibex and marmots in Switzerland?", answer: "Mid-June to September. Marmots hibernate from October to April and ibex move to inaccessible cliffs in winter. Early morning is best in both cases."}
        ]
    },
    {
        slug: "austria",
        name: "Austria",
        regionType: "country",
        hubRegion: "europe",
        countryCode: "AT",
        coordinate: {lat: 47.6, lng: 14.1, zoom: 6},
        captureArea: {countryCodes: ["AT"]},
        title: "Animals in Austria: What You Can Spot, Learn, and Collect",
        description: "Austrian wildlife: Hohe Tauern bearded vultures, ibex and marmots, Tirol chamois and red deer, Lake Neusiedl egrets and bee-eaters, Rust's storks and Schönbrunn's pandas.",
        searchIntents: [
            "animals in Austria",
            "wildlife in Austria",
            "what animals can be found in Austria",
            "what wildlife is there in the Austrian Alps",
            "what animals can you see in Tirol",
            "Tiere in Österreich",
            "Austria wildlife travel"
        ],
        quickAnswer: "Austria runs from the 3,798 m Grossglockner to the steppe lake of Neusiedl, so it covers two wildlife worlds. The Hohe Tauern and Tirol give ibex, chamois, marmots, golden eagles and the bearded vultures first released there in 1986; Lake Neusiedl in the east fills with great egrets, spoonbills, bee-eaters and the storks of Rust; and Vienna has the world's oldest zoo at Schönbrunn with giant pandas and the Danube floodplain's pond turtles on its doorstep.",
        introduction: [
            "Austrian captures in AnimalDex are still rare, mostly a few Tirol holiday finds. The country deserves more: marmots sit beside the Grossglockner High Alpine Road car parks, and the Hohe Tauern is the best place in the Alps to watch bearded vultures without a long hike.",
            "Innsbruck and the Zillertal are the Tirol base, Heiligenblut or Kaprun for the Hohe Tauern, Rust or Illmitz for Lake Neusiedl, and Vienna for Schönbrunn and the Donau-Auen national park."
        ],
        whyItMatters: [
            "The Rauris valley in the Hohe Tauern was where bearded vultures were first released back into the Alps in 1986, after the species was shot to extinction a century earlier. Over 300 now fly across the Alpine arc, and the Krumltal is still called the Valley of the Vultures.",
            "Lake Neusiedl is Central Europe's only steppe lake, with Europe's second-largest reed belt and a bird list of over 340 species on the Hungarian border. Rust's church roofs are famous for their storks."
        ],
        animalsToSpot: [
            {speciesSlug: "bearded-vulture", whyItFits: "First released in the Rauris valley in 1986; the Krumltal, the Grossglockner road and the Kaiser-Franz-Josefs-Höhe now give regular views of adults and griffons together.", rarityHint: "Regular in the Hohe Tauern in summer, especially the Krumltal."},
            {speciesSlug: "alpine-ibex", whyItFits: "Reintroduced across the Hohe Tauern and Tirol; herds graze near the Grossglockner's Gamsgrube and in the Pitztal and Kaunertal.", rarityHint: "Reliable above 2,200 m in summer around the Glockner."},
            {speciesSlug: "alpine-marmot", whyItFits: "The Grossglockner High Alpine Road car parks have marmots that pose on the walls, and every Tirol high meadow whistles with them.", rarityHint: "Guaranteed at the Kaiser-Franz-Josefs-Höhe from June to September."},
            {speciesSlug: "chamois", whyItFits: "Common on steep Tirol and Hohe Tauern slopes, with the Karwendel above Innsbruck and the Gamsgrube at the Glockner named for them.", rarityHint: "Reliable at dawn on rocky high ground."},
            {speciesSlug: "golden-eagle", whyItFits: "Around 350 pairs across Austria; the Hohe Tauern and the Kalkalpen give regular soaring views, and the Krumltal has a pair nesting within scope range.", rarityHint: "Regular in the high Alps with patience."},
            {speciesSlug: "red-deer", whyItFits: "Austria's forests hold huge numbers; winter feeding stations in Tirol and the Hohe Tauern let visitors watch herds from hides.", rarityHint: "Guaranteed at winter feeding sites; easy in the September rut."},
            {speciesSlug: "great-egret", whyItFits: "Lake Neusiedl's reed belt holds over 700 pairs, Central Europe's biggest colony, hunting the Seewinkel pools in white dozens.", rarityHint: "Guaranteed around Lake Neusiedl year-round."},
            {speciesSlug: "eurasian-spoonbill", whyItFits: "Breeds in the Neusiedl reeds and feeds on the Seewinkel soda pans at Illmitz and Apetlon.", rarityHint: "Common April to September in the Seewinkel."},
            {speciesSlug: "european-bee-eater", whyItFits: "Colonies dig into the sandy banks and gravel pits of the Seewinkel and the Weinviertel, the northern edge of the species' range.", rarityHint: "Common May to August around Lake Neusiedl."},
            {speciesSlug: "white-stork", whyItFits: "Rust on Lake Neusiedl is Austria's stork town, with nests on most roofs along the main street from March to August.", rarityHint: "Guaranteed in Rust in spring and summer."},
            {speciesSlug: "european-pond-terrapin", whyItFits: "The Donau-Auen national park east of Vienna holds Austria's only native pond turtle population, basking on floodplain logs.", rarityHint: "Uncommon; warm mornings on the Donau-Auen backwaters."},
            {speciesSlug: "giant-panda", whyItFits: "Schönbrunn Zoo in Vienna, the world's oldest zoo, has kept and bred giant pandas since 2003 and received a new pair in 2025.", rarityHint: "Guaranteed at Schönbrunn."},
            {speciesSlug: "eurasian-lynx", whyItFits: "The Kalkalpen national park in Upper Austria holds a small reintroduced lynx population alongside the Bohemian Forest animals.", rarityHint: "Very rare to see; camera-trap country."},
            {speciesSlug: "alpine-salamander", whyItFits: "Walks the wet high trails of the Hohe Tauern, the Karwendel and the Dachstein on rainy mornings, glossy black and slow.", rarityHint: "Seasonal; wet mornings above 1,000 m from June to September."}
        ],
        bestFor: [
            "Bearded vultures, ibex and marmots along the Grossglockner High Alpine Road",
            "Egrets, spoonbills and bee-eaters at Lake Neusiedl",
            "Red deer at winter feeding hides in Tirol",
            "Schönbrunn Zoo and the Donau-Auen floodplain in Vienna"
        ],
        spottingTips: [
            "Drive the Grossglockner road early; the Kaiser-Franz-Josefs-Höhe marmots are out from 7 am and vultures ride the first thermals around 10.",
            "The Krumltal from Rauris-Kolm Saigurn is the vulture valley; a scope from the valley floor finds eagles and bearded vultures on the cliffs.",
            "Lake Neusiedl's Seewinkel is best from the Illmitz and Apetlon pans in April and May, with the Hungarian border tower giving the widest view.",
            "Tirol's winter red deer feeding hides at Kaunertal and Zillergrund run guided sessions from December to March."
        ],
        relatedLocationSlugs: ["switzerland", "germany", "italy"],
        rankingSlugs: ["animals-with-best-eyesight"],
        challengeSlugs: ["eagle-vs-falcon"],
        faq: [
            {question: "What wildlife is there in Austria?", answer: "Alpine ibex, chamois, marmots, red deer, lynx and a few wandering bears and wolves in the mountains; golden eagles, bearded and griffon vultures, ptarmigan and nutcrackers; and at Lake Neusiedl great egrets, spoonbills, bee-eaters, storks and over 340 recorded bird species."},
            {question: "What animals can be found in the Austrian Alps?", answer: "Ibex, chamois, red and roe deer, marmots, mountain hares, ermine, golden eagles, bearded vultures, alpine choughs, nutcrackers, wallcreepers, rock ptarmigan, alpine salamanders and alpine newts."},
            {question: "Where can you see marmots in Austria?", answer: "The Grossglockner High Alpine Road, especially the Kaiser-Franz-Josefs-Höhe, has marmots within metres of the car parks from June to September. Any Tirol high meadow above 1,800 m has them too."},
            {question: "Is Schönbrunn Zoo worth visiting?", answer: "Yes. It is the oldest zoo in the world, dating from 1752, with giant pandas, polar bears, orangutans, Siberian tigers and a rainforest house, all inside the Schönbrunn palace grounds."}
        ]
    },
    {
        slug: "scotland",
        name: "Scotland",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "GB",
        parentSlug: "united-kingdom",
        coordinate: {lat: 56.8, lng: -4.2, zoom: 6},
        captureArea: {
            bbox: {north: 60.9, south: 54.6, east: -0.7, west: -8.7},
            // Carve out Northumberland and Cumbria, which the Solway-to-Berwick box would otherwise claim.
            excludeBboxes: [{north: 55.0, south: 54.6, east: -0.7, west: -3.0}, {north: 54.85, south: 54.6, east: -3.0, west: -3.7}]
        },
        title: "Animals in Scotland: What You Can Spot, Learn, and Collect",
        description: "Scottish wildlife: red deer stags, Mull golden eagles, Cairngorms squirrels and wildcats, Moray Firth dolphins, Shetland puffins and bonxies, Bass Rock gannets, seals.",
        searchIntents: [
            "animals in Scotland",
            "wildlife in Scotland",
            "what animals can be found in Scotland",
            "what wildlife is there in Scotland",
            "what animals can you see in the Scottish Highlands",
            "Scottish wildlife",
            "Scotland wildlife travel"
        ],
        quickAnswer: "Scotland holds most of Britain's wild big-ticket species: 400,000 red deer, around 500 pairs of golden eagles, ospreys at Loch Garten, red squirrels, pine martens and the last Scottish wildcats in the Cairngorms, ptarmigan and snow buntings on the high plateau, and the world's largest gannet colony on Bass Rock. The coast adds bottlenose dolphins at Chanonry Point, puffins and great skuas in Shetland, basking sharks off the Hebrides and 40 percent of the world's grey seals.",
        introduction: [
            "The UK's AnimalDex captures so far come mostly from England, so this page is an invitation. Red deer graze the roadside at Glen Etive and on Rum, Highland cows block single-track roads, and dolphins breach beside the Chanonry Point car park on a rising tide.",
            "Aviemore is the Cairngorms base for squirrels, martens, ospreys and ptarmigan. Mull and Skye give eagles and otters, Inverness the Moray Firth dolphins, Shetland the seabirds and orcas, and Oban the boats to Coll and the basking sharks."
        ],
        whyItMatters: [
            "The Cairngorms is where Britain is trying to save its wildcat, with the first captive-bred releases in 2023, and where beavers, ospreys and sea eagles have all been brought back. It is the UK's largest national park and its best place to see a near-complete native fauna.",
            "Scotland's seas matter globally: Bass Rock held around 75,000 pairs of gannets before the 2022 bird flu outbreak and is recovering, Scotland has around 60 percent of the world's great skuas, and the Moray Firth bottlenose dolphins are the most northerly resident population in the world and among the largest-bodied."
        ],
        animalsToSpot: [
            {speciesSlug: "red-deer", whyItFits: "Scotland has around 400,000, grazing the roadsides in Glen Etive, Glen Coe and on Rum and Jura, with the October rut roaring across every glen.", rarityHint: "Guaranteed in the Highlands; roadside in Glen Etive at dusk."},
            {speciesSlug: "golden-eagle", whyItFits: "Around 500 pairs, most in the west Highlands and islands; Mull, Skye, Harris and the Cairngorms give the most reliable views of birds riding ridges.", rarityHint: "Regular on Mull and Harris with a scope and patience."},
            {speciesSlug: "osprey", whyItFits: "Returned to breed at Loch Garten in 1954 after extinction; the RSPB centre there and Loch of the Lowes in Perthshire have nest cameras and hides.", rarityHint: "Guaranteed at Loch Garten from April to August."},
            {speciesSlug: "atlantic-puffin", whyItFits: "Sumburgh Head and Hermaness in Shetland, the Isle of May and St Kilda hold hundreds of thousands; Sumburgh puffins sit a metre from the cliff path.", rarityHint: "Guaranteed at Sumburgh Head and the Isle of May from May to July."},
            {speciesSlug: "northern-gannet", whyItFits: "Bass Rock in the Firth of Forth is the world's largest gannet colony, around 75,000 pairs before bird flu struck in 2022; boats from North Berwick circle the white rock.", rarityHint: "Guaranteed from North Berwick boats April to September."},
            {speciesSlug: "great-skua", whyItFits: "The bonxie breeds on Shetland's Hermaness and Noss in the world's biggest concentration, and dive-bombs anyone who walks near a nest.", rarityHint: "Guaranteed on Hermaness and Noss from May to August."},
            {speciesSlug: "dolphin", whyItFits: "The Moray Firth bottlenose pod of around 200 hunts salmon at Chanonry Point on the rising tide, often within 20 m of the shingle.", rarityHint: "Reliable at Chanonry Point an hour after low tide in summer."},
            {speciesSlug: "basking-shark", whyItFits: "The Sea of the Hebrides between Coll, Tiree and Hyskeir is one of the world's basking shark hotspots, with dedicated boats from Oban and Tobermory.", rarityHint: "Seasonal; July and August on calm days."},
            {speciesSlug: "grey-seal", whyItFits: "Scotland holds around 40 percent of the world's grey seals, breeding on Orkney, the Monach Isles and the Isle of May each autumn.", rarityHint: "Guaranteed on any island boat trip; pups ashore October to December."},
            {speciesSlug: "european-otter", whyItFits: "Shetland and Mull have Europe's most watchable otters, fishing the kelp in daylight; Shetland alone holds over 1,000.", rarityHint: "Reliable on Shetland and Mull shores at low tide."},
            {speciesSlug: "red-squirrel", whyItFits: "The Cairngorms pinewoods around Aviemore and Boat of Garten hold the UK's stronghold, with squirrels on every feeder at the Loch Garten centre.", rarityHint: "Guaranteed in Cairngorms pinewoods."},
            {speciesSlug: "pine-marten", whyItFits: "Recovering across the Highlands and visiting garden feeders in Speyside and Ardnamurchan after dark; hides at Rothiemurchus and on Mull run evening watches.", rarityHint: "Reliable from paid hides; occasional on quiet forest roads at dusk."},
            {speciesSlug: "european-wildcat", whyItFits: "The Scottish wildcat is Britain's last native cat; captive-bred animals were released in the Cairngorms from 2023 and the Highland Wildlife Park shows the breeding programme.", rarityHint: "Extremely rare wild; guaranteed at the Highland Wildlife Park."},
            {speciesSlug: "mountain-hare", whyItFits: "Turns white each winter on the Cairngorm and Monadhliath plateaux, Britain's only native hare, bolting from the heather at your feet.", rarityHint: "Common on the Cairngorm plateau; white from December to March."}
        ],
        bestFor: [
            "Red deer, red squirrels, ospreys and wildcat conservation in the Cairngorms",
            "Golden and sea eagles, otters on Mull and Skye",
            "Dolphins at Chanonry Point and basking sharks off the Hebrides",
            "Seabird cities: Bass Rock gannets, Shetland puffins and bonxies"
        ],
        spottingTips: [
            "Chanonry Point dolphins show on the rising tide; arrive an hour after low water and stand on the shingle point.",
            "The Cairngorm funicular top station is the easiest ptarmigan and snow bunting site; walk a little beyond the fence line.",
            "Mull's Loch na Keal shore road gives golden and white-tailed eagles and otters without leaving the car.",
            "Shetland's Hermaness bonxies defend nests aggressively in June; raise a walking pole above your head and keep moving."
        ],
        relatedLocationSlugs: ["united-kingdom", "england", "wales", "ireland"],
        rankingSlugs: ["animals-with-best-eyesight"],
        challengeSlugs: ["eagle-vs-falcon", "deer-vs-wolf"],
        faq: [
            {question: "What wildlife is there in Scotland?", answer: "Red and roe deer, red squirrels, pine martens, wildcats, mountain hares, otters and beavers on land; golden and white-tailed eagles, ospreys, capercaillie, ptarmigan and black grouse among the birds; and grey and harbour seals, bottlenose dolphins, minke whales, orcas and basking sharks at sea."},
            {question: "What animals can be found in the Scottish Highlands?", answer: "Red deer in huge numbers, golden eagles, ospreys, red squirrels, pine martens, wildcats, mountain hares, ptarmigan, snow buntings, crested tits, Scottish crossbills, otters and the Highland cattle that block every single-track road."},
            {question: "Where is the best place to see puffins in Scotland?", answer: "Sumburgh Head in Shetland puts puffins at arm's length from May to July. The Isle of May off Fife, Hermaness in Unst, Fowlsheugh near Stonehaven and St Kilda are the other big colonies."},
            {question: "Can you see whales and dolphins in Scotland?", answer: "Yes. Bottlenose dolphins are reliable at Chanonry Point on the Moray Firth, minke whales are regular off Mull and the Hebrides in summer, orcas patrol Shetland and Orkney, and humpbacks are increasingly seen off the east coast."}
        ]
    },
    {
        slug: "wales",
        name: "Wales",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "GB",
        parentSlug: "united-kingdom",
        coordinate: {lat: 52.3, lng: -3.8, zoom: 7},
        captureArea: {
            bbox: {north: 53.45, south: 51.35, east: -2.65, west: -5.55},
            // Merseyside, the Wirral and Chester sit inside the rectangle; Deeside is the price of carving them out.
            excludeBboxes: [{north: 53.45, south: 53.1, east: -2.65, west: -3.1}]
        },
        title: "Animals in Wales: What You Can Spot, Learn, and Collect",
        description: "Welsh wildlife: Skomer puffins and Manx shearwaters, Grassholm gannets, Ramsey grey seals, Cardigan Bay dolphins, Gigrin Farm red kites, Snowdonia goats and ospreys.",
        searchIntents: [
            "animals in Wales",
            "wildlife in Wales",
            "what animals can be found in Wales",
            "what wildlife is there in Wales",
            "what animals can you see in Pembrokeshire",
            "Welsh wildlife",
            "Wales wildlife travel"
        ],
        quickAnswer: "Wales packs a lot of coast into a small country, and the Pembrokeshire islands are its glory: Skomer's puffins and its 350,000 pairs of Manx shearwaters, Grassholm's 36,000 pairs of gannets, Ramsey's grey seal pups, and bottlenose dolphins and porpoises in Cardigan Bay and Ramsey Sound. Inland, red kites that were down to a few pairs in the 1930s now fill the sky at Gigrin Farm, ospreys nest on the Dyfi and Glaslyn, and Snowdonia has feral goats, ravens and peregrines.",
        introduction: [
            "Wales is under-recorded in AnimalDex and over-delivers in person. The Skomer boat from Martin's Haven puts you among puffins that walk across the path, and the Gigrin Farm kite feed at 2 pm brings hundreds of red kites to within a few metres of the hides.",
            "St Davids or Tenby are the Pembrokeshire base for islands and seals, New Quay for the Cardigan Bay dolphins, Rhayader for the kites, and Betws-y-Coed or Llanberis for Snowdonia's goats, ravens and ospreys."
        ],
        whyItMatters: [
            "The red kite is Wales's conservation success story: fewer than ten pairs survived in the mid-Wales valleys in the 1930s, and the UK population is now over 10,000 pairs, all descended in part from those Welsh birds.",
            "Skomer and Skokholm hold roughly half the world's Manx shearwaters, and Britain's first pine marten reintroduction took place in Wales, with animals released in the Cambrian Mountains from 2015."
        ],
        animalsToSpot: [
            {speciesSlug: "atlantic-puffin", whyItFits: "Around 40,000 puffins nest on Skomer, standing on the path at the Wick and flying in with sand eels past your knees.", rarityHint: "Guaranteed on Skomer from late April to mid-July."},
            {speciesSlug: "manx-shearwater", whyItFits: "Skomer and Skokholm hold about 350,000 pairs, half the world total, returning to their burrows in screaming thousands after dark.", rarityHint: "Common at sea off Pembrokeshire by day; overnight stays on Skomer for the evening return."},
            {speciesSlug: "northern-gannet", whyItFits: "Grassholm, 11 km off Pembrokeshire, is white with 36,000 pairs, the third-largest gannet colony in the world; boats from St Justinians circle it.", rarityHint: "Guaranteed on Grassholm boat trips from June to September."},
            {speciesSlug: "grey-seal", whyItFits: "Ramsey Island and the Pembrokeshire coves produce several hundred pups each autumn, visible from the coast path at Martin's Haven and Strumble Head.", rarityHint: "Guaranteed on Ramsey boats; pups ashore September to November."},
            {speciesSlug: "dolphin", whyItFits: "Cardigan Bay holds the UK's largest resident bottlenose population; New Quay's harbour wall is one of the best land-based dolphin sites in Europe.", rarityHint: "Reliable from New Quay harbour and boats, April to October."},
            {speciesSlug: "harbor-porpoise", whyItFits: "Strumble Head and Ramsey Sound have strong tide races where porpoises feed in dozens; the Strumble lookout is a classic sea-watching spot.", rarityHint: "Regular at Strumble Head on a running tide."},
            {speciesSlug: "red-kite", whyItFits: "Gigrin Farm at Rhayader has fed kites daily since 1993 and draws up to 600 birds at 2 pm; the whole of mid-Wales now has kites overhead.", rarityHint: "Guaranteed at Gigrin Farm; common across mid-Wales."},
            {speciesSlug: "osprey", whyItFits: "Breeds on the Dyfi near Machynlleth and at Glaslyn near Porthmadog, with visitor centres, hides and nest cameras.", rarityHint: "Guaranteed at the Dyfi Osprey Project from April to August."},
            {speciesSlug: "peregrine-falcon", whyItFits: "Nests on the Snowdonia crags, the Pembrokeshire cliffs and Cardiff City Hall's clock tower, hunting pigeons over the city centre.", rarityHint: "Regular on Pembrokeshire cliffs and in Snowdonia."},
            {speciesSlug: "common-raven", whyItFits: "Snowdonia has one of Britain's densest raven populations; they tumble and croak over every summit and beg at the Snowdon cafe.", rarityHint: "Guaranteed on any Snowdonia summit."},
            {speciesSlug: "domestic-goat", whyItFits: "Feral goats roam the Snowdonia crags around Tryfan and the Rhinogydd, and the Great Orme's Kashmir goats famously wandered into Llandudno during lockdown.", rarityHint: "Reliable on the Great Orme and around Tryfan."},
            {speciesSlug: "pine-marten", whyItFits: "Reintroduced to the Cambrian Mountains from 2015 after near-extinction in Wales; the Dyfi forest and Rheidol valley are strongholds.", rarityHint: "Rare to see; camera-trapped more often than watched."},
            {speciesSlug: "european-otter", whyItFits: "Wales kept its otters when England lost them, and they fish the Teifi, Wye and Dyfi and the Cardigan Bay shores by day.", rarityHint: "Uncommon; the Teifi marshes and Cardigan Bay estuaries at dawn."},
            {speciesSlug: "red-squirrel", whyItFits: "Anglesey's grey squirrels were removed and reds reintroduced, so the island's woods now hold Wales's biggest red squirrel population.", rarityHint: "Reliable in Anglesey's Newborough and Pentraeth woods."}
        ],
        bestFor: [
            "Puffins, shearwaters and gannets on the Pembrokeshire islands",
            "Grey seal pups and dolphins along the Pembrokeshire and Cardigan coasts",
            "The Gigrin Farm red kite feed and the Dyfi ospreys",
            "Mountain wildlife and feral goats in Snowdonia"
        ],
        spottingTips: [
            "Skomer boats from Martin's Haven are first come first served and sell out by 8 am in puffin season; arrive early or book the overnight stay.",
            "Gigrin Farm feeds kites at 2 pm GMT or 3 pm BST every day; the photographic hides are worth the extra fee.",
            "New Quay harbour wall gives dolphins without a boat; a rising tide in the evening is best.",
            "Seal pups are on Pembrokeshire beaches from September to November; watch from the coast path and never go down to them."
        ],
        relatedLocationSlugs: ["united-kingdom", "england", "scotland", "ireland"],
        rankingSlugs: ["animals-with-best-teamwork"],
        challengeSlugs: ["hawk-vs-eagle"],
        faq: [
            {question: "What wildlife is there in Wales?", answer: "Puffins, Manx shearwaters, gannets, choughs and peregrines on the coast; grey seals, bottlenose dolphins and harbour porpoises at sea; red kites, ospreys, ravens and dippers inland; and otters, pine martens, polecats, red squirrels and feral goats among the mammals."},
            {question: "What animals can be found in Pembrokeshire?", answer: "Skomer's puffins and shearwaters, Grassholm's gannets, Ramsey's grey seals, porpoises in Ramsey Sound, choughs and peregrines on the cliffs, and dolphins and the occasional sunfish and basking shark offshore in summer."},
            {question: "Where can you see puffins in Wales?", answer: "Skomer Island, reached by boat from Martin's Haven near Marloes, from late April to mid-July. Skokholm and South Stack on Anglesey hold smaller numbers."},
            {question: "Where is the best place to see red kites in Wales?", answer: "Gigrin Farm near Rhayader, where several hundred kites come to a daily afternoon feed. Bwlch Nant yr Arian near Aberystwyth runs a similar feed with a lakeside viewing area."}
        ]
    },
    {
        slug: "england",
        name: "England",
        regionType: "region",
        hubRegion: "europe",
        countryCode: "GB",
        parentSlug: "united-kingdom",
        coordinate: {lat: 52.6, lng: -1.5, zoom: 6},
        captureArea: {
            bbox: {north: 55.82, south: 49.85, east: 1.8, west: -6.45},
            // Wales and southern Scotland have their own pages; these boxes hand them back (Shropshire's Welsh-border towns go with Wales).
            excludeBboxes: [
                {north: 53.1, south: 51.35, east: -2.65, west: -5.55},
                {north: 53.45, south: 53.1, east: -3.1, west: -5.55},
                {north: 55.82, south: 55.0, east: -3.0, west: -6.45},
                {north: 55.82, south: 55.4, east: -2.2, west: -3.0}
            ]
        },
        title: "Animals in England: What You Can Spot, Learn, and Collect",
        description: "English wildlife: Richmond Park red deer, New Forest ponies, Norfolk Broads bitterns and water deer, Farne Islands puffins and seals, Thanet fulmars, robins and foxes.",
        searchIntents: [
            "animals in England",
            "wildlife in England",
            "what animals can be found in England",
            "what wildlife is there in England",
            "what animals can you see in England",
            "English wildlife",
            "England wildlife travel"
        ],
        quickAnswer: "England's wildlife hides in plain sight. Red and fallow deer graze within sight of London skyscrapers in Richmond Park, New Forest ponies and donkeys walk through villages, the Norfolk Broads hold booming bitterns and most of the world's wild Chinese water deer, and the Farne Islands put puffins, arctic terns and grey seals at arm's length. Every garden has robins and blackbirds, every town has foxes, and the Kent coast around Thanet adds seals, fulmars and parakeets.",
        introduction: [
            "England supplies nearly all of the UK's AnimalDex captures, and they are honest: robins, blackbirds, carrion crows, red admirals, bumblebees, a dipper on a northern river, a scarlet tiger moth, a great green bush-cricket on the south coast and the usual spiders and woodlice. That is the texture of English wildlife, and the headline species sit on top of it.",
            "London and the South East give Richmond's deer, the Thanet coast and the New Forest. East Anglia has the Broads and the north Norfolk seal beaches. The North East has the Farne Islands and the North West the Lakes, and Cornwall adds basking sharks, choughs and dolphins at the far end."
        ],
        whyItMatters: [
            "England is one of the most nature-depleted countries in the world, which makes its recoveries sharper: red kites back over the Chilterns from a Welsh handful, otters in every county again, beavers legally wild on the River Otter in Devon, white storks nesting at Knepp for the first time in 600 years.",
            "It is also the best country on earth for easy, close urban wildlife. Richmond Park's 600 deer, London's foxes, Thanet's seals and parakeets and the hedgehogs and badgers of suburban gardens are all within an hour of ten million people."
        ],
        animalsToSpot: [
            {speciesSlug: "red-deer", whyItFits: "Richmond Park's 300 red deer rut within sight of the City skyline each October, and Exmoor holds England's largest wild herd.", rarityHint: "Guaranteed in Richmond Park; keep 50 m back during the rut."},
            {speciesSlug: "fallow-deer", whyItFits: "The New Forest, Richmond Park, Knole and Petworth hold big herds; the New Forest's Bolderwood sanctuary has a viewing platform over the summer feeding.", rarityHint: "Guaranteed at Bolderwood and in Richmond Park."},
            {speciesSlug: "domestic-horse", whyItFits: "Around 5,000 free-roaming New Forest ponies graze the heaths and walk through Brockenhurst and Lyndhurst; Dartmoor and Exmoor have their own breeds.", rarityHint: "Guaranteed throughout the New Forest."},
            {speciesSlug: "water-deer", whyItFits: "Chinese water deer escaped from Woburn and Whipsnade a century ago; the Norfolk Broads at Hickling and Strumpshaw now hold a large share of the world's wild population.", rarityHint: "Reliable at dawn on the Hickling Broad marshes."},
            {speciesSlug: "eurasian-bittern", whyItFits: "Booms from the reedbeds of the Norfolk Broads, Minsmere and the Avalon Marshes in Somerset, back from a low of 11 males in 1997 to over 200.", rarityHint: "Uncommon; dawn in April and May at Hickling or Minsmere."},
            {speciesSlug: "atlantic-puffin", whyItFits: "The Farne Islands off Northumberland hold around 40,000 pairs, with boats from Seahouses landing on Inner Farne and Staple Island from April to July.", rarityHint: "Guaranteed on Farne landings from May to mid-July."},
            {speciesSlug: "arctic-tern", whyItFits: "Inner Farne's terns nest beside the boardwalk and strike visitors' heads in defence; the island warden advises a hat.", rarityHint: "Guaranteed on Inner Farne in June and July; wear a hat."},
            {speciesSlug: "grey-seal", whyItFits: "The Farnes and Blakeney Point in Norfolk hold huge colonies, with over 4,000 pups born at Blakeney each winter; Pegwell Bay in Thanet has a Kent haul-out.", rarityHint: "Guaranteed at Blakeney and the Farnes; pups ashore November to January."},
            {speciesSlug: "red-fox", whyItFits: "London has around 10,000 urban foxes, and they walk through Cliftonville streets and Richmond gardens at dusk as if they owned them.", rarityHint: "Near-guaranteed at night in any English suburb."},
            {speciesSlug: "european-badger", whyItFits: "England's largest land carnivore, with setts in most woods and even London parks; badger-watching hides run in Devon, Dorset and the Peak District.", rarityHint: "Regular from paid hides at dusk; occasional on quiet lanes."},
            {speciesSlug: "european-hedgehog", whyItFits: "Still common in suburban gardens despite a steep decline, snuffling across lawns on summer nights and the nation's favourite animal.", rarityHint: "Regular in gardens at night from April to October."},
            {speciesSlug: "red-kite", whyItFits: "Reintroduced to the Chilterns in 1989 and now circling over the M40, Reading and Oxford in hundreds; one of the fastest raptor recoveries anywhere.", rarityHint: "Guaranteed over the Chilterns and Thames valley."},
            {speciesSlug: "european-robin", whyItFits: "England's national bird and its most captured animal in AnimalDex, singing from every garden fence in every month of the year.", rarityHint: "Guaranteed."},
            {speciesSlug: "stag-beetle", whyItFits: "Britain's largest beetle flies clumsily around south London, Essex and Hampshire gardens on warm June evenings; Richmond Park is a stronghold.", rarityHint: "Seasonal; warm still evenings in June in the south-east."}
        ],
        bestFor: [
            "Deer at close range in Richmond Park and the New Forest",
            "Reedbed birds and water deer on the Norfolk Broads",
            "Puffins, terns and seals on the Farne Islands",
            "Garden and urban wildlife: robins, foxes, badgers, hedgehogs and stag beetles"
        ],
        spottingTips: [
            "Richmond Park's rut peaks in October; arrive at the Pen Ponds at dawn and give the stags space.",
            "Farne boats from Seahouses land on Inner Farne from April to July; book the National Trust landing and bring a hat for the terns.",
            "Hickling Broad's Stubb Mill raptor roost at dusk in winter gives marsh harriers, cranes and water deer in one view.",
            "On the Thanet coast, Pegwell Bay's seals haul out at low tide and fulmars nest on the chalk at Botany Bay; parakeets roost in Margate's parks."
        ],
        relatedLocationSlugs: ["united-kingdom", "london-zoo", "scotland", "wales"],
        rankingSlugs: ["most-adaptable-animals"],
        challengeSlugs: ["fox-vs-wolf"],
        faq: [
            {question: "What wildlife is there in England?", answer: "Red, fallow, roe and muntjac deer, foxes, badgers, hedgehogs, otters and grey squirrels on land; puffins, terns, gannets and grey seals on the coast; bitterns, marsh harriers and cranes in the wetlands; and red kites, buzzards and peregrines over the towns."},
            {question: "What animals can be found in England?", answer: "Around 60 land mammals including six deer species, 300 regularly recorded birds, three snakes (only the adder is venomous), the common frog, common toad and three newts, and insects from stag beetles to swallowtails in the Broads."},
            {question: "Are there dangerous animals in England?", answer: "Essentially none. The adder is the only venomous snake and bites are rare and almost never fatal. Red deer stags in the rut and cattle with calves are the real things to keep a distance from."},
            {question: "Where is the best place to see wildlife near London?", answer: "Richmond Park for red and fallow deer, Rainham Marshes for wetland birds, the WWT London Wetland Centre at Barnes, and any suburban garden at night for foxes, hedgehogs and badgers."}
        ]
    }
];

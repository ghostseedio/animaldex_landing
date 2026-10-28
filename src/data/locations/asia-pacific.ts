import type {LocationPageInput} from "@/data/location-types";

export const asiaPacificLocationPages: LocationPageInput[] = [
    {
        slug: "malaysia",
        name: "Malaysia",
        regionType: "country",
        hubRegion: "asia",
        countryCode: "MY",
        coordinate: {lat: 4.1, lng: 108.3, zoom: 5},
        captureArea: {countryCodes: ["MY"]},
        title: "Animals in Malaysia: What You Can Spot, Learn, and Collect",
        description: "Malaysia wildlife guide: Malayan tigers and tapirs in Taman Negara, orangutans and proboscis monkeys in Sabah, hornbills at Belum, plus everyday macaques and monitors.",
        searchIntents: [
            "animals in Malaysia",
            "wildlife in Malaysia",
            "what animals can be found in Malaysia",
            "what wildlife is there in Malaysia",
            "what animals can you see in Malaysia",
            "haiwan di Malaysia",
            "Malaysia wildlife travel"
        ],
        quickAnswer: "Malaysia splits into two very different wildlife countries. The Peninsula has Malayan tigers, tapirs, elephants and ten hornbill species in Taman Negara and Belum-Temengor, while Sabah and Sarawak on Borneo hold orangutans, proboscis monkeys and pygmy elephants along the Kinabatangan. Everywhere in between, long-tailed macaques, water monitors, dragonflies and crickets are the animals people actually photograph day to day.",
        introduction: [
            "Malaysia is one of the few countries where a two-week trip can include a 130-million-year-old rainforest, a river full of wild primates and a coral reef with nesting turtles, all on domestic flights. The Peninsula and Malaysian Borneo share a language and a currency but almost nothing in their megafauna, which is why this page points you to the right half for each animal.",
            "AnimalDex users in Malaysia log more wild captures than in any other Southeast Asian country, and most of them come from ordinary places: paddies in Terengganu, kampung gardens in Kelantan, a monsoon drain in Selangor. Crickets, skimmer dragonflies, orb-weavers and porcupines fill the real list long before anyone meets a tiger."
        ],
        whyItMatters: [
            "The Peninsula's forests are some of the oldest on Earth and still connected enough for tigers and tapirs to move through them, though the Malayan tiger is down to an estimated 150 animals. Seeing one is close to impossible; supporting the parks that protect them is not.",
            "Borneo's lowland forest has been cut back to river corridors and reserves, and those corridors are exactly where visitors go. A boat on the Kinabatangan at dusk is a genuine wildlife safari, and every logged sighting of an orangutan or elephant there adds to the case for keeping the corridor intact."
        ],
        animalsToSpot: [
            {speciesSlug: "malayan-tiger", whyItFits: "Malaysia's national animal and the Peninsula's own subspecies, holding on in Taman Negara, Belum-Temengor and the Kenyir forests with a wild population estimated at around 150.", rarityHint: "Wild sightings are a once-a-decade event even for rangers; Zoo Negara in Kuala Lumpur is the realistic option."},
            {speciesSlug: "malayan-tapir", whyItFits: "The black-and-white tapir walks Taman Negara's salt licks at night and turns up on the roads around Kenyir and Kuala Gandah far more often than its size suggests.", rarityHint: "Uncommon but realistic at the Tahan and Kumbang hides on a multi-night stay."},
            {speciesSlug: "asian-elephant", whyItFits: "Peninsular herds move through Belum-Temengor, Kenyir and the Gua Musang forests, and the Kuala Gandah conservation centre in Pahang handles translocated animals.", rarityHint: "Regular along the Gerik-Jeli highway at dawn; guaranteed at Kuala Gandah."},
            {speciesSlug: "bornean-orangutan", whyItFits: "Sabah's Sepilok centre releases rehabilitated orangutans into the surrounding reserve, and wild ones feed in fig trees along the lower Kinabatangan.", rarityHint: "Near-certain at Sepilok feeding times; wild sightings on roughly half of Kinabatangan cruises."},
            {speciesSlug: "proboscis-monkey", whyItFits: "Found only on Borneo, and the Kinabatangan and Labuk Bay in Sabah are the two easiest places on the whole island to watch big-nosed males lead troops to riverside roost trees.", rarityHint: "Reliable on any evening river cruise from Sukau or Bilit."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "Sarawak's state bird and a constant presence over Taman Negara, Belum and Kenyir, where the whoosh of its wings carries across the water before the bird appears.", rarityHint: "Common in the big Peninsular parks; listen for the barking call at dawn."},
            {speciesSlug: "sun-bear", whyItFits: "The world's smallest bear is rescued and rehabilitated at the Bornean Sun Bear Conservation Centre beside Sepilok, with wild bears leaving claw marks on trees across Danum and Taman Negara.", rarityHint: "Guaranteed at the Sepilok centre; wild claw marks are easier to find than the bear."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Nests on Redang and Perhentian in Terengganu and on Selingan in Sabah's Turtle Islands, where rangers release hatchlings most nights of the season.", rarityHint: "Nightly on Selingan from May to September; snorkelers see adults off Redang year-round."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "The monkey of every Malaysian car park, temple stair and beach, from Batu Caves to the Perhentian jetty, and the most-logged mammal in the country.", rarityHint: "Guaranteed; hold onto bags and food."},
            {speciesSlug: "dusky-leaf-monkey", whyItFits: "The spectacled langur lives in roadside and hill forest on Penang, Langkawi and the Kuala Lumpur fringe, far gentler than the macaques it shares trees with.", rarityHint: "Regular at Penang Hill, Bukit Nanas and Fraser's Hill; look up early in the morning."},
            {speciesSlug: "water-monitor", whyItFits: "Two-metre monitors patrol monsoon drains, mangrove edges and lake margins in every state, and users log them from Perak to Sabah.", rarityHint: "Very common near any water with a bank to bask on."},
            {speciesSlug: "malayan-porcupine", whyItFits: "One of the most frequently logged wild mammals in Malaysia, caught by users on kampung edges in Kelantan where it raids tapioca and fruit at night.", rarityHint: "Nocturnal and common; quills on a trail are a sure sign."},
            {speciesSlug: "sambar-deer", whyItFits: "Malaysia's largest deer stands at salt licks in Taman Negara and wanders the forest-edge farmland of Kelantan, where users have photographed it in the open.", rarityHint: "Regular at the Kumbang hide; shy elsewhere."},
            {speciesSlug: "slender-skimmer", whyItFits: "The pale green dragonfly over every flooded paddy and drain, and the most-captured insect in the Malaysian database after the house fly.", rarityHint: "Abundant wherever water stands in the sun."}
        ],
        bestFor: [
            "Travelers who want rainforest megafauna and reef life in the same trip",
            "Families: hides, boardwalks and feeding-time centres make big animals accessible",
            "Birders chasing hornbills, pittas and broadbills in Taman Negara and Belum",
            "Collectors who like a long insect list: paddies and kampung gardens are full"
        ],
        spottingTips: [
            "Pick one half of the country per trip. Tigers, tapirs and ten hornbill species are Peninsular; orangutans, proboscis monkeys and pygmy elephants are Bornean.",
            "Book a night in a Taman Negara hide (Kumbang or Tahan) rather than a day trip; tapir, sambar and porcupine all come to the salt licks after dark.",
            "On the Kinabatangan, take the dawn and dusk cruises and skip the midday one; primates and hornbills move to the riverside only in the cool hours.",
            "Turn over the paddy edges. Skimmers, rice grasshoppers, crickets and orb-weavers make up most of what Malaysian users capture, and they are everywhere between October and February."
        ],
        relatedLocationSlugs: ["terengganu", "sabah", "kuala-lumpur", "borneo"],
        rankingSlugs: ["rarest-animals", "biggest-animals"],
        challengeSlugs: ["tiger-vs-leopard", "python-vs-cobra"],
        faq: [
            {question: "What wildlife is there in Malaysia?", answer: "Malayan tigers, tapirs, Asian elephants, sun bears, gibbons and ten hornbill species on the Peninsula; orangutans, proboscis monkeys, pygmy elephants and clouded leopards in Sabah and Sarawak; sea turtles and reef sharks off Terengganu and Sipadan. Macaques, water monitors, porcupines and a huge insect fauna fill out every day in between."},
            {question: "What animals can be found in Malaysia?", answer: "Roughly 300 mammal species, 700 birds and 250 reptiles. The ones visitors actually see most are long-tailed macaques, water monitors, dusky leaf monkeys, hornbills, flying foxes and dragonflies, with orangutans and proboscis monkeys reliable on the Kinabatangan and elephants regular around Kenyir and Belum."},
            {question: "Where is the best place to see wildlife in Malaysia?", answer: "The Kinabatangan River in Sabah for primates and elephants from a boat, Taman Negara for Peninsular forest animals at the hides, and Sepilok for orangutans and sun bears up close. Add Redang or the Perhentians for turtles if you have beach days."},
            {question: "Is it safe to see wild animals in Malaysia?", answer: "Yes with ordinary care. Macaques bite when fed, so keep food packed away; saltwater crocodiles live in Sabah's rivers, so never swim in the Kinabatangan; and dengue is the real risk, so use repellent at dawn and dusk."}
        ]
    },
    {
        slug: "terengganu",
        name: "Terengganu",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "MY",
        parentSlug: "malaysia",
        coordinate: {lat: 5.0, lng: 102.9, zoom: 8},
        captureArea: {bbox: {north: 6.0, south: 3.9, east: 103.7, west: 102.3}},
        title: "Animals in Terengganu: What You Can Spot, Learn, and Collect",
        description: "What lives in Terengganu: elephants and hornbills at Kenyir Lake, green turtles on Redang and Perhentian, reef sharks, Setiu wetland monitors and paddy-field insects.",
        searchIntents: [
            "animals in Terengganu",
            "wildlife in Terengganu",
            "what animals can be found in Terengganu",
            "what wildlife is there in Terengganu",
            "haiwan di Terengganu",
            "Kenyir lake animals",
            "Redang turtles"
        ],
        quickAnswer: "Terengganu has Asian elephants, Malayan tapirs and rhinoceros hornbills around Kenyir Lake, green turtles nesting on Redang and the Perhentians with blacktip reef sharks in the shallows, and water monitors and waterbirds in the Setiu wetlands. Inland, the paddies and kampung orchards produce more logged insects than anywhere else in Malaysia: skimmer dragonflies, rice grasshoppers, crickets, lantern bugs and forest scorpions.",
        introduction: [
            "Terengganu is the single biggest capture cluster in the whole AnimalDex database, and almost none of it is tourist wildlife. It is crickets on kitchen floors, skimmers over the paddies around Kuala Berang and Marang, orb-weavers strung between coconut palms and the occasional porcupine or rat snake crossing a kampung road at night.",
            "The state also has a proper wild side. Kenyir, Malaysia's largest lake, backs onto Taman Negara and hosts elephants, tapirs and hornbills along its drowned shoreline, while the east-coast islands are the Peninsula's best turtle beaches and easiest reef snorkelling."
        ],
        whyItMatters: [
            "Terengganu's beaches once held the largest leatherback nesting population in Asia. Rantau Abang lost it by the 1990s, and the green turtles that still nest on Redang's Chagar Hutang and at the Ma'Daerah sanctuary near Kerteh are the state's second chance.",
            "Kenyir sits at the edge of the Peninsula's central forest spine. Elephants pushed out by plantations end up on its fringes, and the Kenyir Elephant Conservation Village exists because of that conflict. Logging what you see there adds to a record of how the lake's wildlife is holding up."
        ],
        animalsToSpot: [
            {speciesSlug: "asian-elephant", whyItFits: "Wild herds use the forest around Kenyir Lake and the Kuala Berang road, and the Kenyir Elephant Conservation Village keeps translocated animals that visitors can watch bathe.", rarityHint: "Dung and footprints on lake-shore trails are common; a wild herd is a lucky boat trip."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "Pairs commute across Kenyir's bays between fig trees on the islands, and the sound of their wings is one of the lake's signature noises at dawn.", rarityHint: "Regular from a boat on the quieter arms of the lake."},
            {speciesSlug: "malayan-tapir", whyItFits: "The Terengganu side of Taman Negara and the Kenyir fringes are tapir country, and animals occasionally wander onto the Kuala Berang road after dark.", rarityHint: "Rare but real; night drives on the lake access roads are the best bet."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Chagar Hutang on Redang is a dedicated sanctuary beach with hundreds of nests a season, and the Perhentians have resident adults grazing seagrass off Turtle Beach.", rarityHint: "Almost guaranteed snorkelling off Perhentian Kecil; nesting is May to September."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Juvenile blacktips cruise the knee-deep shallows at Shark Point on Perhentian Besar and off Redang's Pasir Panjang.", rarityHint: "Reliable in calm water at high tide; harmless and skittish."},
            {speciesSlug: "clownfish", whyItFits: "Anemone clusters on Redang's house reefs and around the Perhentian jetties hold clownfish a metre below snorkelers.", rarityHint: "Guaranteed on any guided snorkel."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops raid beach bungalows on the Perhentians and patrol the Kenyir jetties, and they are among the most-logged mammals in the state.", rarityHint: "Guaranteed on the islands; keep your door shut."},
            {speciesSlug: "water-monitor", whyItFits: "Big monitors work the Setiu wetlands, the Kenyir shoreline and every drain in Kuala Terengganu, and users photograph them regularly.", rarityHint: "Very common near water."},
            {speciesSlug: "slender-skimmer", whyItFits: "The most-captured dragonfly in Terengganu, hawking over flooded paddies around Kuala Berang, Marang and Besut through the planting season.", rarityHint: "Abundant over any standing water in sun."},
            {speciesSlug: "rice-grasshopper", whyItFits: "Users log this paddy grasshopper from field edges across the state, where it clings to rice stems and flushes in short hops as you walk the bunds.", rarityHint: "Abundant October to February."},
            {speciesSlug: "field-cricket", whyItFits: "The top-logged animal in Terengganu by a wide margin, calling from kampung yards and kitchen floors after dark.", rarityHint: "Heard every night; found with a torch."},
            {speciesSlug: "lantern-bug", whyItFits: "The long-snouted lanternfly sits on longan and rambutan trunks in Terengganu orchards and has been photographed by users in kampung gardens.", rarityHint: "Uncommon; check fruit-tree trunks at eye level."},
            {speciesSlug: "malaysian-forest-scorpion", whyItFits: "The big black forest scorpion lives in leaf litter and under logs in the state's hill forest and has turned up in users' captures near Kenyir.", rarityHint: "Nocturnal; glows under UV torchlight."},
            {speciesSlug: "common-rat-snake", whyItFits: "A fast, harmless snake of paddies and kampung edges that users have logged crossing roads in rural Terengganu.", rarityHint: "Occasional by day; most often seen on warm tarmac."}
        ],
        bestFor: [
            "Snorkelers who want turtles and reef sharks without a dive certificate",
            "Boat-based wildlife at Kenyir for elephants, hornbills and monitors",
            "Insect and paddy-field collectors building a long list fast",
            "Turtle conservation volunteering at Chagar Hutang or Ma'Daerah"
        ],
        spottingTips: [
            "Snorkel the Perhentians at high tide in the morning for sharks and turtles; afternoon chop stirs the sand and hides everything.",
            "At Kenyir, hire a boat for dawn rather than a houseboat party; hornbills and elephants use the shoreline before the water-sports noise starts.",
            "Walk paddy bunds around Kuala Berang or Marang an hour after sunrise when skimmers, grasshoppers and crickets are active but not yet skittish.",
            "Carry a UV torch on any night walk: forest scorpions fluoresce blue-green and are far easier to find that way."
        ],
        relatedLocationSlugs: ["malaysia", "kelantan", "kuala-lumpur"],
        rankingSlugs: ["most-resilient-animals"],
        faq: [
            {question: "What wildlife is there in Terengganu?", answer: "Elephants, tapirs, hornbills and macaques around Kenyir Lake; green turtles, blacktip reef sharks and clownfish on Redang and the Perhentians; water monitors and waterbirds in the Setiu wetlands; and a dense insect fauna of dragonflies, grasshoppers, crickets and scorpions in the paddies and kampungs."},
            {question: "What animals can be found in Terengganu?", answer: "Asian elephant, Malayan tapir, rhinoceros hornbill, long-tailed macaque, water monitor, green sea turtle, hawksbill turtle, blacktip reef shark, reef fish, rat snakes, forest scorpions and a long list of paddy insects. Terengganu is the most-logged region in the AnimalDex database."},
            {question: "When is turtle season in Terengganu?", answer: "Green turtles nest from roughly April to September, peaking June to August. Chagar Hutang on Redang is a protected sanctuary with controlled night viewing, and Ma'Daerah near Kerteh runs a hatchery on the mainland."},
            {question: "Can you see wild elephants at Kenyir?", answer: "Sometimes. Herds use the lake shore and the Kuala Berang access road, and signs are common, but a sighting needs a dawn boat trip and luck. The Kenyir Elephant Conservation Village guarantees elephants, though these are managed animals."}
        ]
    },
    {
        slug: "kelantan",
        name: "Kelantan",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "MY",
        parentSlug: "malaysia",
        coordinate: {lat: 5.4, lng: 102.0, zoom: 8},
        captureArea: {bbox: {north: 6.3, south: 4.5, east: 102.4, west: 101.3}},
        title: "Animals in Kelantan: What You Can Spot, Learn, and Collect",
        description: "Kelantan wildlife: gibbons and hornbills at Gunung Stong, elephants and tigers in the Kuala Koh forests, porcupines, sambar and civets on the Tanah Merah kampung edge.",
        searchIntents: [
            "animals in Kelantan",
            "wildlife in Kelantan",
            "what animals can be found in Kelantan",
            "what wildlife is there in Kelantan",
            "haiwan di Kelantan",
            "Gunung Stong wildlife"
        ],
        quickAnswer: "Kelantan's interior holds some of the Peninsula's wildest forest: Asian elephants and Malayan tigers in the Kuala Koh and Gunung Basor areas, lar gibbons and great hornbills calling over Gunung Stong, great argus and sambar deer at salt licks. The settled north around Tanah Merah and Pasir Mas is where AnimalDex users actually log animals, and it is porcupines, sambar, civets, squirrels and macaques on the kampung edge after dark.",
        introduction: [
            "Kelantan is Malaysia's least touristed mainland state, and that shows in its wildlife. Most of the south is forest: the Taman Negara entrance at Kuala Koh, the Gunung Stong state park with its 300-metre Jelawang waterfall, and a long stretch of unroaded hills along the Thai border where tigers still breed.",
            "The north is paddy, rubber and kampung, and that is where the captures come from. Users around Tanah Merah have logged Malayan porcupines, sambar deer, palm civets and plantain squirrels, which says something about how close the forest still sits to the villages."
        ],
        whyItMatters: [
            "Kelantan's forests are part of the central corridor that keeps the Malayan tiger population connected. Logging and durian plantations are eating into them, and the elephants that crash into orchards around Gua Musang and Jeli are the visible symptom.",
            "There are no big-name lodges here, so sightings depend on local guides, village homestays and your own patience. That makes every logged capture more valuable: Kelantan is badly under-recorded for a state with this much forest."
        ],
        animalsToSpot: [
            {speciesSlug: "asian-elephant", whyItFits: "Herds move between the Stong range, the Jeli hills and the Gua Musang forests, and roadside dung on the Jeli-Gerik highway is a weekly sight.", rarityHint: "Signs are common; a sighting usually means a dawn or dusk drive along the highway edge."},
            {speciesSlug: "malayan-tiger", whyItFits: "The Kuala Koh sector of Taman Negara and the forests around Gunung Basor are among the last breeding areas for the subspecies in Malaysia.", rarityHint: "Camera traps only, realistically; pugmarks on river sand are the most anyone sees."},
            {speciesSlug: "lar-gibbon", whyItFits: "White-handed gibbons sing from the slopes above Jelawang waterfall at Gunung Stong, usually in the first hour after sunrise.", rarityHint: "Heard on most mornings at Stong; seen with effort and binoculars."},
            {speciesSlug: "great-hornbill", whyItFits: "The largest Peninsular hornbill crosses the valleys at Kuala Koh and Stong with a wingbeat you can hear from the trail.", rarityHint: "Uncommon; fig trees in fruit are the place to wait."},
            {speciesSlug: "great-argus", whyItFits: "Males clear dance courts on ridges in the Kuala Koh forest and call a loud two-note 'kow-wow' that carries for a kilometre.", rarityHint: "Heard far more than seen; a guide who knows a dancing ground changes the odds."},
            {speciesSlug: "malayan-porcupine", whyItFits: "The most-logged wild mammal in Kelantan, photographed by users on kampung edges around Tanah Merah where it digs up tapioca and fallen fruit.", rarityHint: "Nocturnal and common; drive slowly on rural roads after 9 pm."},
            {speciesSlug: "sambar-deer", whyItFits: "Users have logged sambar in open ground near Tanah Merah, and the Kuala Koh salt licks pull them in at night.", rarityHint: "Regular at salt licks; occasional on forest-edge farmland."},
            {speciesSlug: "asian-palm-civet", whyItFits: "Lives in kampung fruit trees and roof spaces across the north and was captured by a user in the Tanah Merah countryside.", rarityHint: "Nocturnal and common; check fruiting trees with a torch."},
            {speciesSlug: "plantain-squirrel", whyItFits: "The default squirrel of Kelantan gardens, rubber smallholdings and roadside trees, logged by users in the north.", rarityHint: "Very common and active all day."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops at Gunung Stong's waterfall base camp and along the Kelantan River have learned to work the picnic crowds.", rarityHint: "Guaranteed at Stong; common elsewhere."},
            {speciesSlug: "water-buffalo", whyItFits: "Domestic buffalo still work and wallow in the paddies of Pasir Mas and Tumpat, often with cattle egrets on their backs; a farm animal, not a wild one.", rarityHint: "Common in the northern paddies, especially in the planting months."},
            {speciesSlug: "white-throated-kingfisher", whyItFits: "A big blue-and-chestnut kingfisher that hunts frogs and crickets from wires over the Kelantan paddies rather than fish.", rarityHint: "Very common; loud, laughing call."},
            {speciesSlug: "cattle-egret", whyItFits: "Follows buffalo and tractors through the Tumpat and Pasir Mas paddies in flocks of dozens.", rarityHint: "Abundant in farmland."},
            {speciesSlug: "asian-common-toad", whyItFits: "Gathers under kampung lights after rain and was logged by users in the north, where it is the standard night-time amphibian.", rarityHint: "Very common after dark in the wet season."}
        ],
        bestFor: [
            "Travelers who want untouristed Peninsular forest with gibbons and hornbills",
            "Kampung homestays where porcupines, civets and squirrels come to you",
            "Hikers combining Gunung Stong's waterfall with dawn wildlife",
            "Collectors adding paddy and farmland birds in the northern plains"
        ],
        spottingTips: [
            "Camp at the Baha camp above Jelawang waterfall at Gunung Stong; gibbons call across the valley at first light and you are already in the forest.",
            "Enter Taman Negara at Kuala Koh rather than Kuala Tahan if you want quiet; the salt licks there get far less traffic and sambar and argus are correspondingly bolder.",
            "Drive rural roads around Tanah Merah and Machang slowly after dark; porcupines, civets and the occasional sambar cross between forest patches and orchards.",
            "The Tumpat paddies near the Thai border are the best open-country birding in the state, with buffalo, egrets, kingfishers and raptors through the wet season."
        ],
        relatedLocationSlugs: ["malaysia", "terengganu", "kuala-lumpur"],
        rankingSlugs: ["rarest-animals"],
        faq: [
            {question: "What wildlife is there in Kelantan?", answer: "Asian elephants, Malayan tigers, lar gibbons, great hornbills and great argus in the southern forests around Kuala Koh and Gunung Stong, and porcupines, sambar deer, civets, squirrels and macaques on the kampung edges of the north. The paddies around Tumpat and Pasir Mas add buffalo, egrets and kingfishers."},
            {question: "What animals can be found in Kelantan?", answer: "Elephant, tiger, tapir, gibbon, sambar, barking deer, Malayan porcupine, palm civet, plantain squirrel, long-tailed macaque, hornbills, argus and kingfishers, plus toads, geckos and a large paddy insect fauna. Users have logged porcupine and sambar more than any other wild mammal here."},
            {question: "Is Gunung Stong good for wildlife?", answer: "Yes, if you go early and stay a night. The waterfall trail is busy by mid-morning, but the forest above the falls has gibbons, hornbills, squirrels and macaques, and the campsite is the best place in the state to hear a dawn chorus."},
            {question: "Are there tigers in Kelantan?", answer: "Yes, Kelantan's southern forests are one of the Malayan tiger's last strongholds, but with fewer than 150 left in the wild you will not see one. Pugmarks along rivers near Kuala Koh are the realistic encounter."}
        ]
    },
    {
        slug: "sabah",
        name: "Sabah",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "MY",
        parentSlug: "borneo",
        coordinate: {lat: 5.4, lng: 117.0, zoom: 7},
        captureArea: {bbox: {north: 7.5, south: 4.0, east: 119.4, west: 115.1}},
        title: "Animals in Sabah: What You Can Spot, Learn, and Collect",
        description: "Sabah wildlife guide: orangutans at Sepilok, proboscis monkeys and pygmy elephants on the Kinabatangan, clouded leopards at Danum Valley and turtles at Sipadan.",
        searchIntents: [
            "animals in Sabah",
            "wildlife in Sabah",
            "what animals can be found in Sabah",
            "what wildlife is there in Sabah",
            "haiwan di Sabah",
            "Kinabatangan wildlife",
            "Sabah wildlife travel"
        ],
        quickAnswer: "Sabah is the easiest place on Borneo to see the island's big five: orangutans at Sepilok and along the Kinabatangan, proboscis monkeys on every river cruise, Bornean pygmy elephants when the herds reach the water, saltwater crocodiles on the mudbanks and eight hornbill species overhead. Danum Valley adds clouded leopards, bearded pigs and bristleheads, and Sipadan has green turtles on every dive.",
        introduction: [
            "Sabah packs Borneo's wildlife into a corridor a few hours' drive from Sandakan. Sepilok's orangutan and sun bear centres sit at one end, the Kinabatangan's oxbow lakes and riverside lodges in the middle, and the Danum Valley and Tabin reserves beyond, where the forest is still tall enough for clouded leopards.",
            "This is a boat-and-lodge destination rather than a hiking one. The river does the work: primates come down to roost at dusk, elephants come to drink, crocodiles haul out on the mud, and the lodges run the dawn and night cruises that make the sightings routine."
        ],
        whyItMatters: [
            "The Kinabatangan is a wildlife corridor by default, a strip of forest between oil-palm estates that holds animals because they have nowhere else to go. That concentration is why sightings are so good and why the corridor's survival is a live question.",
            "Sabah is also where Borneo's rarest cats and the last Bornean elephants, estimated at around 1,500, can be watched by ordinary travellers. Logging a pygmy elephant or a flat-headed cat here is a real contribution to how little is known about both."
        ],
        animalsToSpot: [
            {speciesSlug: "bornean-orangutan", whyItFits: "Sepilok rehabilitates orphans and releases them into the Kabili-Sepilok reserve, and wild orangutans build night nests in the trees above the lower Kinabatangan.", rarityHint: "Guaranteed at Sepilok's 10 am and 3 pm feedings; wild nests on most river trips, animals on about half."},
            {speciesSlug: "proboscis-monkey", whyItFits: "Troops gather in riverside trees every evening between Sukau and Bilit, and the Labuk Bay sanctuary near Sandakan has habituated groups at feeding platforms.", rarityHint: "Reliable on any dusk cruise; near-certain at Labuk Bay."},
            {speciesSlug: "bornean-pygmy-elephant", whyItFits: "Herds of 20 to 50 move along the Kinabatangan and through Tabin, feeding on riverside grass where boats can watch them for an hour at a time.", rarityHint: "Seasonal and mobile; ask the lodge where the herd was yesterday."},
            {speciesSlug: "sun-bear", whyItFits: "The Bornean Sun Bear Conservation Centre next to Sepilok rehabilitates rescued bears in forested enclosures viewed from a canopy walkway.", rarityHint: "Guaranteed at the centre; wild bears at Danum are rare but leave fresh claw marks."},
            {speciesSlug: "sunda-clouded-leopard", whyItFits: "Danum Valley and the Deramakot forest reserve are the most reliable places in the world to see Borneo's big cat on night drives.", rarityHint: "Rare; a five-night Deramakot trip gives a realistic chance."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "Pairs commute over the Kinabatangan and perch above the Danum canopy walkway, the loudest of the eight hornbills in the state.", rarityHint: "Common on the river and at Danum."},
            {speciesSlug: "helmeted-hornbill", whyItFits: "The critically endangered 'ivory' hornbill still laughs its maniacal call over Danum Valley and the Maliau Basin.", rarityHint: "Rare and heard more than seen; Danum is the best chance."},
            {speciesSlug: "bornean-bearded-pig", whyItFits: "Wanders the lodge grounds at Danum and Tabin and roots along the Kinabatangan banks, bristled and unbothered by people.", rarityHint: "Regular at Danum lodges and on Tabin's roads."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "Big crocodiles haul out on Kinabatangan mudbanks and drift past the boats at eye level; the river has one of Borneo's densest populations.", rarityHint: "Seen on most cruises; never swim or wade."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Sipadan's reef has turtles on every dive and snorkel, and Selingan in the Turtle Islands Park lets visitors watch nesting and hatchling releases most nights.", rarityHint: "Guaranteed at Sipadan; nightly on Selingan in season."},
            {speciesSlug: "flat-headed-cat", whyItFits: "A small fishing cat of swamp forest that night-cruise boats on the Kinabatangan and Menanggul tributary pick up by eyeshine on the bank.", rarityHint: "Rare; the Kinabatangan is the single best place on Earth to try."},
            {speciesSlug: "bornean-slow-loris", whyItFits: "Night walks at Danum and Sepilok's Rainforest Discovery Centre find lorises by the orange eyeshine in mid-canopy vines.", rarityHint: "Uncommon but regular with a good guide and torch."},
            {speciesSlug: "bornean-bristlehead", whyItFits: "Borneo's strangest endemic bird, a red-headed crow-like oddity in its own family, roams the canopy at Danum and the Sepilok discovery centre's towers.", rarityHint: "Uncommon; the RDC canopy towers at dawn are the easiest shot."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "The common riverside monkey of the Kinabatangan, moving in big troops along the banks and raiding lodge kitchens.", rarityHint: "Guaranteed on every cruise."}
        ],
        bestFor: [
            "First-time Borneo visitors who want orangutans, proboscis monkeys and elephants in one week",
            "Divers and snorkelers heading to Sipadan and Mabul for turtles and reef life",
            "Night-safari fans chasing clouded leopards and small cats at Deramakot and Danum",
            "Families: Sepilok, Labuk Bay and the river lodges work for all ages"
        ],
        spottingTips: [
            "Stay two nights on the Kinabatangan and take every cruise offered: dawn, dusk and the night boat. Primates come at dusk, elephants and crocodiles at any hour, cats only at night.",
            "At Sepilok, arrive before the 10 am feeding and walk the boardwalk to the outdoor nursery afterwards; the youngsters are more active there than at the platform.",
            "Book Deramakot or Danum's night drives for cats, and sit on the side of the vehicle facing the forest edge rather than the road.",
            "Climb the Rainforest Discovery Centre canopy towers at Sepilok at 6 am for hornbills, bristleheads and flying squirrels before the heat sets in."
        ],
        relatedLocationSlugs: ["borneo", "malaysia", "indonesia"],
        rankingSlugs: ["rarest-animals", "smartest-animals"],
        challengeSlugs: ["gorilla-vs-orangutan", "dolphin-vs-orangutan-intelligence"],
        faq: [
            {question: "What wildlife is there in Sabah?", answer: "Bornean orangutans, proboscis monkeys, pygmy elephants, sun bears, clouded leopards, bearded pigs, saltwater crocodiles, eight hornbill species and slow lorises on land, with green turtles, reef sharks and barracuda at Sipadan. The Kinabatangan River and Sepilok are the two places most visitors see them."},
            {question: "What animals can be found in Sabah?", answer: "Around 200 mammals including orangutan, pygmy elephant, proboscis monkey, red leaf monkey, gibbon, clouded leopard, flat-headed cat and bearded pig; roughly 500 birds including rhinoceros, helmeted and wrinkled hornbills and the Bornean bristlehead; crocodiles, monitors and sea turtles. Macaques and crocodiles are the everyday sightings."},
            {question: "Where is the best place to see orangutans in Sabah?", answer: "Sepilok for guaranteed close views of rehabilitated animals at feeding times, and the Kinabatangan or Danum Valley for wild ones. Danum has the highest wild density; the Kinabatangan is cheaper and easier."},
            {question: "When is the best time to visit Sabah for wildlife?", answer: "March to October is drier and better for river travel and diving. Elephants on the Kinabatangan are seen in every month but move unpredictably, so ask lodges for recent sightings before choosing between Sukau and Bilit."}
        ]
    },
    {
        slug: "kuala-lumpur",
        name: "Kuala Lumpur",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "MY",
        parentSlug: "malaysia",
        coordinate: {lat: 3.139, lng: 101.6869, zoom: 11},
        captureArea: {bbox: {north: 3.32, south: 2.95, east: 101.82, west: 101.52}},
        title: "Animals in Kuala Lumpur: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Kuala Lumpur: macaques at Batu Caves, dusky leaf monkeys under the KL Tower, colugos at FRIM, monitors in the Lake Gardens and Zoo Negara's tigers.",
        searchIntents: [
            "animals in Kuala Lumpur",
            "wildlife in Kuala Lumpur",
            "what animals can be found in Kuala Lumpur",
            "what wildlife is there in Kuala Lumpur",
            "haiwan di Kuala Lumpur",
            "KL wildlife spots",
            "Batu Caves monkeys"
        ],
        quickAnswer: "Kuala Lumpur keeps a surprising amount of forest inside the city. Long-tailed macaques own the Batu Caves steps, dusky leaf monkeys and colugos live in the KL Forest Eco Park under the KL Tower, water monitors cruise the Perdana Botanical Garden lake, and oriental pied hornbills and palm civets work the leafy suburbs. For big animals, Zoo Negara has Malayan tigers and tapirs and KL Bird Park flies rhinoceros hornbills in a walk-through aviary.",
        introduction: [
            "Most capitals push wildlife to the edges. Kuala Lumpur grew around hills that were never cleared, so a ten-hectare patch of lowland rainforest survives at Bukit Nanas right under the KL Tower, and the Forest Research Institute at Kepong holds 500 hectares of regrown jungle with a canopy walkway twenty minutes from the Petronas Towers.",
            "The result is a city where you can photograph a langur troop before breakfast, a monitor lizard at lunch and a civet on a rooftop after dinner, then spend a day at the zoo and bird park for the species the city cannot hold."
        ],
        whyItMatters: [
            "KL's forest fragments are living arguments for keeping urban green space wild. Bukit Nanas has had dusky leaf monkeys since the city was founded, and losing them would be a quiet, permanent change to what Kuala Lumpur is.",
            "The city is also the gateway to Peninsular Malaysia's parks. Zoo Negara and KL Bird Park are where many visitors first see a Malayan tiger or a rhinoceros hornbill, and a well-logged urban list makes the trip into Taman Negara or Kenyir much richer."
        ],
        animalsToSpot: [
            {speciesSlug: "long-tailed-macaque", whyItFits: "The 272 steps at Batu Caves are the most famous macaque gauntlet in Asia, and troops also hold Bukit Nanas, Bukit Gasing and Templer Park.", rarityHint: "Guaranteed at Batu Caves; keep food, phones and sunglasses zipped away."},
            {speciesSlug: "dusky-leaf-monkey", whyItFits: "A wild troop of spectacled langurs lives in the KL Forest Eco Park under the KL Tower, and others range through Bukit Gasing and the Kiara hills.", rarityHint: "Regular in the early morning on the Eco Park's canopy walk."},
            {speciesSlug: "sunda-colugo", whyItFits: "Colugos cling to trunks at FRIM in Kepong and in Bukit Nanas by day, looking like a patch of lichen until they glide at dusk.", rarityHint: "Uncommon; scan tree trunks at head height along FRIM's trails."},
            {speciesSlug: "water-monitor", whyItFits: "Big monitors swim the lake at the Perdana Botanical Garden and bask along the Klang and Gombak rivers right through the city centre.", rarityHint: "Very common; look along any concrete river bank at midday."},
            {speciesSlug: "oriental-pied-hornbill", whyItFits: "Wild pairs have moved back into the green suburbs, feeding in fig trees at FRIM, Bukit Kiara and around Taman Tun Dr Ismail.", rarityHint: "Uncommon but increasing; listen for the cackling call at dawn."},
            {speciesSlug: "plantain-squirrel", whyItFits: "The everyday squirrel of KL's parks and gardens, chasing along the fences at KLCC Park and the Lake Gardens.", rarityHint: "Abundant and active all day."},
            {speciesSlug: "asian-palm-civet", whyItFits: "Civets run the roof lines of Bangsar, Ampang and other leafy suburbs at night and leave seed-filled droppings on car bonnets.", rarityHint: "Nocturnal and common; listen for scrabbling on tiles after 10 pm."},
            {speciesSlug: "common-myna", whyItFits: "Struts across every pavement café and hawker centre in the city, and is one of the most-logged birds in Malaysian cities.", rarityHint: "Guaranteed anywhere people eat."},
            {speciesSlug: "house-crow", whyItFits: "Huge roosts of house crows gather in the Klang Valley at dusk, a KL signature sound over Chow Kit and the Lake Gardens.", rarityHint: "Abundant; dusk flights over the city centre are spectacular."},
            {speciesSlug: "yellow-vented-bulbul", whyItFits: "The cheerful bubbling song from every garden hedge and roadside tree in KL, and a reliable first bird for a new collector.", rarityHint: "Very common."},
            {speciesSlug: "common-house-gecko", whyItFits: "The chirping gecko on every hotel ceiling and lamp post in the city, hunting the insects the lights pull in.", rarityHint: "Guaranteed after dark."},
            {speciesSlug: "malayan-tiger", whyItFits: "Zoo Negara in Ulu Klang keeps Malayan tigers in a large enclosure, the only realistic place to see the national animal.", rarityHint: "Guaranteed at the zoo; most active at the early feeding."},
            {speciesSlug: "malayan-tapir", whyItFits: "Zoo Negara's tapirs are part of a national breeding programme, and their enclosure sits near the entrance for an easy early visit.", rarityHint: "Guaranteed at the zoo; often asleep by midday."},
            {speciesSlug: "rhinoceros-hornbill", whyItFits: "KL Bird Park in the Lake Gardens flies rhinoceros and great hornbills in its walk-in aviary, close enough to hear the wingbeats.", rarityHint: "Guaranteed at the Bird Park; the hornbill feeding is the highlight."}
        ],
        bestFor: [
            "City-break wildlife with real forest a short Grab ride from the hotel",
            "Families: Zoo Negara, KL Bird Park and the Batu Caves monkeys in two days",
            "Birders using FRIM and Bukit Kiara as warm-ups for Fraser's Hill",
            "Night-time urban collectors: civets, geckos, toads and flying foxes"
        ],
        spottingTips: [
            "Walk the KL Forest Eco Park canopy walk at opening time, before the tour groups; the langur troop feeds low in the canopy for the first hour.",
            "At Batu Caves, climb early and keep everything in a closed bag; macaques here are experts at snatching phones and water bottles.",
            "FRIM in Kepong is best on a weekday morning: colugos on trunks, hornbills in the figs and monitors in the streams, with far fewer joggers.",
            "Check the Perdana Botanical Garden lake edge around noon for basking monitors and the trees above for the evening crow roost build-up."
        ],
        relatedLocationSlugs: ["malaysia", "penang", "singapore", "terengganu"],
        rankingSlugs: ["most-adaptable-animals"],
        challengeSlugs: ["tiger-vs-lion"],
        faq: [
            {question: "What wildlife is there in Kuala Lumpur?", answer: "Long-tailed macaques, dusky leaf monkeys, colugos, plantain squirrels, palm civets and water monitors live wild inside the city at Batu Caves, Bukit Nanas, FRIM and the Lake Gardens, with hornbills returning to the suburbs. Zoo Negara and KL Bird Park cover tigers, tapirs, elephants and hornbills."},
            {question: "What animals can be found in Kuala Lumpur?", answer: "Macaques, langurs, colugos, squirrels, civets, flying foxes, monitors, geckos, toads, hornbills, mynas, crows, bulbuls and kingfishers in the wild, plus the Malayan tiger, tapir, orangutan and elephant at Zoo Negara."},
            {question: "Is Batu Caves safe with the monkeys?", answer: "Yes if you treat them as wild animals. Do not carry visible food or drink, keep phones in a closed bag on the steps, and never try to touch or feed them. Bites are rare and almost always follow someone offering food."},
            {question: "Where can I see hornbills in Kuala Lumpur?", answer: "KL Bird Park in the Lake Gardens for guaranteed close views in its free-flight aviary. Wild oriental pied hornbills are seen at FRIM, Bukit Kiara and in the leafy suburbs of Taman Tun Dr Ismail, mostly at dawn."}
        ]
    },
    {
        slug: "penang",
        name: "Penang",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "MY",
        parentSlug: "malaysia",
        coordinate: {lat: 5.4164, lng: 100.3327, zoom: 10},
        captureArea: {bbox: {north: 5.62, south: 5.15, east: 100.56, west: 100.14}},
        title: "Animals in Penang: What You Can Spot, Learn, and Collect",
        description: "Penang wildlife: dusky leaf monkeys and giant squirrels on Penang Hill, otters at Gurney Drive, sea eagles and turtles in the national park, Entopia's butterflies.",
        searchIntents: [
            "animals in Penang",
            "wildlife in Penang",
            "what animals can be found in Penang",
            "what wildlife is there in Penang",
            "haiwan di Pulau Pinang",
            "Penang National Park animals",
            "Penang wildlife travel"
        ],
        quickAnswer: "Penang island has dusky leaf monkeys and black giant squirrels on Penang Hill and in the Botanic Gardens, smooth-coated otters fishing off Gurney Drive and in the national park's mangroves, white-bellied sea eagles over Teluk Bahang and green turtles nesting at Pantai Kerachut. The mainland mudflats at Teluk Air Tawar add mudskippers and migratory shorebirds, and Entopia at Teluk Bahang is the place for butterflies up close.",
        introduction: [
            "Penang is best known for food and heritage shophouses, but the northwest corner of the island is a national park, the central spine is forested hill and the mainland shore is mudflat and mangrove. Wildlife here is a half-day add-on to a city trip rather than an expedition, which is exactly what makes it worth planning.",
            "The island's star is the dusky leaf monkey, a grey langur with white eye-rings that lives in the trees above Penang Hill's funicular station and the Botanic Gardens' edges. Otters, giant squirrels, hornbills and sea eagles round out a list that feels far too good for an island of 700,000 people."
        ],
        whyItMatters: [
            "Penang's wildlife survives in a tight ring of protected hill and coast around a dense city. The Habitat on Penang Hill and the national park's turtle centre both depend on visitor numbers, and what people log there feeds straight back into the case for keeping the hill forest unbuilt.",
            "The mainland mudflats at Teluk Air Tawar are an East Asian-Australasian Flyway stopover under constant reclamation pressure. Shorebird counts there matter well beyond Malaysia."
        ],
        animalsToSpot: [
            {speciesSlug: "dusky-leaf-monkey", whyItFits: "Troops feed in the canopy around the Penang Hill upper station, The Habitat's canopy walk and the Botanic Gardens, often with orange-furred infants in the early year.", rarityHint: "Regular in the morning on Penang Hill; patient scanning of the treetops pays off."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Macaques patrol the Botanic Gardens entrance and Monkey Beach in the national park, where they have learned to open bags and coolers.", rarityHint: "Guaranteed; feeding them is illegal and fined."},
            {speciesSlug: "smooth-coated-otter", whyItFits: "A family of otters fishes the seawall at Gurney Drive and the Pulau Tikus shore at dawn, and others hunt the national park's mangroves at Teluk Bahang.", rarityHint: "Regular at Gurney Drive just after first light, especially on a rising tide."},
            {speciesSlug: "black-giant-squirrel", whyItFits: "The big dark squirrel with a long bushy tail crashes through the canopy on Penang Hill and along the Moongate trail.", rarityHint: "Uncommon; listen for falling fruit and heavy branch movement."},
            {speciesSlug: "sunda-colugo", whyItFits: "Colugos spend the day flattened against trunks on Penang Hill and in the Botanic Gardens, and glide between trees at dusk.", rarityHint: "Uncommon; The Habitat's guides know the regular roost trunks."},
            {speciesSlug: "white-bellied-sea-eagle", whyItFits: "Pairs patrol the rocky coast of Penang National Park between Teluk Bahang and Muka Head, taking fish off the surface.", rarityHint: "Regular from the coastal trail and the Muka Head lighthouse."},
            {speciesSlug: "oriental-pied-hornbill", whyItFits: "Hornbills have spread across the island from the national park into Balik Pulau's orchards and the hill forest.", rarityHint: "Uncommon; fruiting figs in the national park are the best bet."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Pantai Kerachut in the national park has a turtle conservation centre where green turtles nest and hatchlings are reared for release.", rarityHint: "Nesting is seasonal (roughly April to August); hatchlings at the centre are near-certain."},
            {speciesSlug: "water-monitor", whyItFits: "Monitors cruise the mangrove channels at Teluk Bahang, the Air Itam dam shore and the drains of George Town's outskirts.", rarityHint: "Common near any water."},
            {speciesSlug: "mudskipper", whyItFits: "Thousands skip across the Teluk Air Tawar mudflats and the national park's mangrove creeks at low tide, sparring and flagging their fins.", rarityHint: "Abundant at low tide."},
            {speciesSlug: "yellow-vented-bulbul", whyItFits: "The most-logged bird in Penang's captures, singing from garden hedges in George Town and every kampung on the island.", rarityHint: "Very common."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The sparrow of Penang's coffee shops and hawker centres, logged by users in the city, hopping under tables for crumbs.", rarityHint: "Guaranteed in any open-air eatery."},
            {speciesSlug: "common-rose", whyItFits: "A red-bodied swallowtail that flies in Entopia's garden dome at Teluk Bahang and wild through the island's hill gardens where its birthwort host grows.", rarityHint: "Guaranteed at Entopia; regular wild on Penang Hill."},
            {speciesSlug: "great-mormon", whyItFits: "A huge black swallowtail of Penang's citrus gardens and the Entopia dome, where several female forms fly together.", rarityHint: "Common in gardens and guaranteed at Entopia."}
        ],
        bestFor: [
            "City-break travelers adding a morning of langurs and otters to the food tour",
            "Families: Entopia, The Habitat canopy walk and Monkey Beach by boat",
            "Birders working the Teluk Air Tawar mudflats in the northern winter",
            "Coastal hikers on the national park's Muka Head and Kerachut trails"
        ],
        spottingTips: [
            "Ride the first funicular up Penang Hill and walk the Habitat's canopy walk before 10 am; langurs, giant squirrels and colugos are all more visible in the cool.",
            "Check the Gurney Drive seawall at sunrise for the otter family, especially on a rising tide when fish push in toward the rocks.",
            "Take the Teluk Bahang to Pantai Kerachut trail rather than the boat: sea eagles, monitors and hornbills along the way, turtles at the end.",
            "Visit Teluk Air Tawar on the mainland two hours before low tide between October and March for mudskippers, shorebirds and herons."
        ],
        relatedLocationSlugs: ["malaysia", "kuala-lumpur", "thailand"],
        rankingSlugs: ["most-agile-animals"],
        faq: [
            {question: "What wildlife is there in Penang?", answer: "Dusky leaf monkeys, long-tailed macaques, black giant squirrels, colugos and civets in the hill forest; smooth-coated otters at Gurney Drive and the national park; white-bellied sea eagles, hornbills and green turtles on the northwest coast; and mudskippers, crabs and shorebirds on the mainland mudflats."},
            {question: "What animals can be found in Penang?", answer: "Langurs, macaques, otters, giant squirrels, colugos, flying foxes, monitors, sea eagles, brahminy kites, hornbills, kingfishers, bulbuls, sea turtles, mudskippers and a rich butterfly fauna. Entopia at Teluk Bahang and the Habitat on Penang Hill are the two managed sites worth adding."},
            {question: "Where can I see monkeys in Penang?", answer: "Dusky leaf monkeys on Penang Hill around the upper station and The Habitat, and in the Botanic Gardens' forest edge. Long-tailed macaques are everywhere in the Botanic Gardens and at Monkey Beach in Penang National Park."},
            {question: "Is Penang National Park worth it for wildlife?", answer: "Yes, for a half day. The coastal trail to Pantai Kerachut has sea eagles, monitors, macaques and hornbills, the beach has a turtle centre, and the Teluk Bahang mangrove boardwalk adds mudskippers and otters."}
        ]
    },
    {
        slug: "philippines",
        name: "Philippines",
        regionType: "country",
        hubRegion: "asia",
        countryCode: "PH",
        coordinate: {lat: 12.8797, lng: 121.774, zoom: 5},
        captureArea: {countryCodes: ["PH"]},
        title: "Animals in the Philippines: What You Can Spot, Learn, and Collect",
        description: "Philippines wildlife guide: Philippine eagles in Mindanao, tarsiers on Bohol, whale sharks at Donsol, tamaraw on Mindoro, plus the geckos and sparrows users log daily.",
        searchIntents: [
            "animals in the Philippines",
            "wildlife in the Philippines",
            "what animals can be found in the Philippines",
            "what wildlife is there in the Philippines",
            "what animals can you see in the Philippines",
            "mga hayop sa Pilipinas",
            "Philippines wildlife travel"
        ],
        quickAnswer: "The Philippines is an endemic-species hotspot: the Philippine eagle and tarsier, the tamaraw buffalo of Mindoro, the Philippine crocodile and the Visayan warty pig are found nowhere else. Offshore, whale sharks at Donsol and Oslob, thresher sharks at Malapascua and dugongs off Palawan make it one of Asia's best marine wildlife destinations. Day to day, AnimalDex users log house geckos, tree sparrows, ants and the paddy and garden insects of Calabarzon.",
        introduction: [
            "Seven thousand islands cut off from mainland Asia for millions of years produced a fauna that is mostly found nowhere else. Over half the country's mammals and a third of its birds are endemic, and the headline species, the eagle, the tarsier, the tamaraw and the cloud rats, look like nothing else alive.",
            "The flip side is that most of that fauna lives in shrinking forest and takes effort to see. The everyday Philippines, as logged by AnimalDex users in Calabarzon, Metro Manila and the Visayas, is house geckos on kitchen walls, tree sparrows on power lines, apple snails in the paddies and a long list of moths, beetles and jumping spiders."
        ],
        whyItMatters: [
            "The Philippines has lost more than 90 percent of its original forest, and the Philippine eagle, with fewer than 400 pairs, is the symbol of what remains. Every forest reserve visit and every logged sighting of an endemic is a small vote for the parks that still hold them.",
            "The country is also where marine wildlife tourism is being worked out in public. Donsol's whale shark model, built on strict no-touch rules, is the one conservationists point to; Oslob's hand-feeding is the one they argue about. Knowing the difference matters before you book."
        ],
        animalsToSpot: [
            {speciesSlug: "philippine-eagle", whyItFits: "The national bird and one of the largest eagles on Earth, with wild pairs in Mindanao's Mount Apo and Kitanglad forests and northern Luzon's Sierra Madre, plus a breeding centre near Davao.", rarityHint: "Guaranteed at the Philippine Eagle Center; wild sightings need a Kitanglad or Apo trek and a guide."},
            {speciesSlug: "philippine-tarsier", whyItFits: "The saucer-eyed nocturnal primate of Bohol, Leyte, Samar and Mindanao, best seen at the Corella sanctuary where wild tarsiers roost in the protected forest.", rarityHint: "Near-certain at the Corella sanctuary; keep quiet and keep your distance."},
            {speciesSlug: "tamaraw", whyItFits: "A dwarf buffalo found only on Mindoro, with a few hundred animals left on the grassy slopes of Mounts Iglit-Baco.", rarityHint: "Very rare; the annual count treks into Iglit-Baco are the only realistic route."},
            {speciesSlug: "philippine-crocodile", whyItFits: "The world's rarest crocodile survives in San Mariano on Luzon and in Mindanao's Ligawasan marsh, with conservation breeding at Puerto Princesa and Manila's wildlife centre.", rarityHint: "Rare in the wild; guaranteed at the Palawan Wildlife Rescue and Conservation Center."},
            {speciesSlug: "visayan-warty-pig", whyItFits: "A tufted wild pig of Negros and Panay, down to a few forest fragments and bred at the Talarak Foundation and Bacolod's biodiversity centre.", rarityHint: "Rare in the wild; reliable at the Negros breeding centres."},
            {speciesSlug: "whale-shark", whyItFits: "Donsol in Sorsogon runs regulated snorkel encounters with wild whale sharks from November to June, and Oslob on Cebu has a controversial year-round feeding operation.", rarityHint: "Seasonal and good at Donsol; guaranteed but ethically debated at Oslob."},
            {speciesSlug: "thresher-shark", whyItFits: "Malapascua off Cebu is the only place in the world where divers reliably see thresher sharks (the pelagic species, a smaller cousin of the common thresher), rising to the Monad Shoal cleaning stations at dawn.", rarityHint: "Near-daily for divers at Monad Shoal before 7 am."},
            {speciesSlug: "dugong", whyItFits: "Sea cows graze seagrass off Busuanga and Dimakya in northern Palawan and around Mindoro, among the last Philippine populations.", rarityHint: "Rare; dedicated dugong snorkels from Busuanga have a fair hit rate."},
            {speciesSlug: "reticulated-python", whyItFits: "The country's biggest snake lives in forest and farmland across the archipelago and turns up in Luzon rice fields and barangay chicken coops.", rarityHint: "Occasional; most often met after heavy rain."},
            {speciesSlug: "water-monitor", whyItFits: "Monitor lizards (bayawak) patrol riverbanks, mangroves and the Puerto Princesa underground river boardwalk across the islands.", rarityHint: "Common near water and bold around picnic areas."},
            {speciesSlug: "large-flying-fox", whyItFits: "Giant fruit bats roost in colonies at Subic Bay on Luzon, in Bohol's Bilar forest and at Mambukal on Negros, and stream out at dusk over the coconut groves.", rarityHint: "Spectacular at dusk near known roosts."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The 'maya' of every Filipino street and the most-logged wild bird in the Philippines, from Manila power lines to Visayan paddies.", rarityHint: "Guaranteed anywhere."},
            {speciesSlug: "common-house-gecko", whyItFits: "The butiki on every Philippine wall and ceiling, and the single most-logged animal in the country's captures.", rarityHint: "Guaranteed after dark."},
            {speciesSlug: "tokay-gecko", whyItFits: "The tuko, a 30-centimetre spotted gecko whose barking call carries from barangay roofs across the islands after dark.", rarityHint: "Heard nightly in rural areas; seen with a torch."}
        ],
        bestFor: [
            "Divers and snorkelers chasing whale sharks, threshers, turtles and dugongs",
            "Endemic hunters: tarsiers, eagles, cloud rats and hornbills found nowhere else",
            "Birders working Mindanao and northern Luzon forest for 200-plus endemics",
            "Collectors who like a dense everyday list: geckos, sparrows, ants, moths and spiders"
        ],
        spottingTips: [
            "Choose Donsol over Oslob for whale sharks if the ethics matter to you; sightings are seasonal (best February to May) but the animals are wild and unfed.",
            "Visit the Corella tarsier sanctuary on Bohol rather than roadside 'tarsier shows'; the animals there are wild, roost at natural height and are not handled.",
            "The Philippine Eagle Center outside Davao is the guaranteed eagle; add a dawn hike at Mount Kitanglad with a local guide if you want a wild one.",
            "Turn on the porch light in any provincial barangay for the real Philippine list: tokays, house geckos, hawkmoths, rhinoceros beetles and jumping spiders."
        ],
        relatedLocationSlugs: ["luzon", "visayas", "mindanao", "palawan"],
        rankingSlugs: ["rarest-animals", "animals-with-best-eyesight"],
        challengeSlugs: ["eagle-vs-falcon", "python-vs-cobra"],
        faq: [
            {question: "What wildlife is there in the Philippines?", answer: "Endemic Philippine eagles, tarsiers, tamaraw, Philippine crocodiles, cloud rats, warty pigs and hornbills on land; whale sharks, thresher sharks, dugongs, sea turtles and some of the world's richest coral reefs offshore. Everyday animals are house geckos, tokays, tree sparrows, monitors, pythons, fruit bats and a huge insect fauna."},
            {question: "What animals can be found in the Philippines?", answer: "Over 200 mammal species (more than half endemic), 600 birds, 250 reptiles and a marine fauna that includes whale sharks, threshers, dugongs and five sea turtle species. The animals users actually log most are house geckos, tree sparrows, ants, cockroaches, beetles and jumping spiders."},
            {question: "Where is the best place to see wildlife in the Philippines?", answer: "Bohol for tarsiers and fireflies, Davao and Mount Kitanglad for the Philippine eagle, Palawan for crocodiles, monitors, dugongs and reefs, Donsol or Malapascua for sharks. Mindanao and northern Luzon have the deepest endemic birding."},
            {question: "Is whale shark swimming in the Philippines ethical?", answer: "It depends where. Donsol follows no-feed, no-touch rules with wild animals on their own migration. Oslob feeds sharks daily to keep them in one bay, which conservationists argue changes their behaviour and health. Donsol is the better choice if you have a season to match."}
        ]
    },
    {
        slug: "luzon",
        name: "Luzon",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "PH",
        parentSlug: "philippines",
        coordinate: {lat: 16.0, lng: 121.2, zoom: 6},
        captureArea: {bbox: {north: 18.8, south: 12.4, east: 124.4, west: 119.6}},
        title: "Animals in Luzon: What You Can Spot, Learn, and Collect",
        description: "Luzon wildlife: cloud rats and eagles in the Sierra Madre, Philippine crocodiles at San Mariano, Subic's flying foxes, Candaba's waterbirds and Makiling's forest.",
        searchIntents: [
            "animals in Luzon",
            "wildlife in Luzon",
            "what animals can be found in Luzon",
            "what wildlife is there in Luzon",
            "mga hayop sa Luzon",
            "Mount Makiling wildlife",
            "Subic Bay bats"
        ],
        quickAnswer: "Luzon is the Philippines' biggest island and its most under-visited wild one. The Sierra Madre and Cordillera hold the giant cloud rat, Philippine eagles and the last wild Philippine crocodiles at San Mariano; Subic Bay has one of Asia's biggest flying fox roosts; the Candaba marsh fills with ducks, egrets and ibises each northern winter; and Mount Makiling above Los Baños is the easiest forest day trip from Manila. The paddies and gardens of Calabarzon are where users log most: apple snails, mantises, weevils, moths and jumping spiders.",
        introduction: [
            "Luzon's wildlife is split between the long mountain ranges that run its length and the flooded plains between them. The Sierra Madre is the country's largest remaining forest and the stronghold for most of the island's endemics; the Central Luzon plain and the Candaba marsh are where the waterbirds go.",
            "Calabarzon, the ring of provinces south of Manila, is the single busiest capture region in the Philippines on AnimalDex. Mount Makiling, Laguna de Bay's shore, Tagaytay's ridge and thousands of hectares of paddy and coconut produce a steady stream of insects, snails, geckos and garden birds."
        ],
        whyItMatters: [
            "Luzon's Sierra Madre is the last big forest within reach of 40 million people in the island's cities, and the San Mariano crocodile programme in Isabela shows that communities can bring a species back from a few dozen animals. Both need visitors who care.",
            "The Candaba wetlands are a key stop on the East Asian flyway and have shrunk under rice and fishpond conversion. Counts and photographs from the dry-season months are the record that keeps the case for them alive."
        ],
        animalsToSpot: [
            {speciesSlug: "northern-luzon-giant-cloud-rat", whyItFits: "A two-kilogram tree-dwelling rodent found only in northern Luzon's mossy forest, from the Cordillera to the Sierra Madre, feeding in the canopy at night.", rarityHint: "Rare; night walks at Mount Pulag's forest edge or Sierra Madre lodges give a slim chance."},
            {speciesSlug: "philippine-eagle", whyItFits: "A small Luzon population nests in the northern Sierra Madre around Isabela and Cagayan, rediscovered breeding in the 2010s.", rarityHint: "Very rare on Luzon; Mindanao is the realistic island for a sighting."},
            {speciesSlug: "philippine-crocodile", whyItFits: "The Mabuwaya Foundation's community sanctuaries in San Mariano, Isabela protect the largest wild population, in creeks and ponds between rice fields.", rarityHint: "Rare but visitable with Mabuwaya guides; dry-season early mornings are best."},
            {speciesSlug: "large-flying-fox", whyItFits: "Subic Bay's forest held one of the largest flying fox roosts in Asia, and bats still stream out over the bay at dusk toward the fruit groves.", rarityHint: "Spectacular at dusk from the Subic roost viewpoint."},
            {speciesSlug: "philippine-sailfin-lizard", whyItFits: "A metre-long crested lizard that basks on branches over Luzon's forest rivers and drops into the water when alarmed, found around Makiling and the Sierra Madre streams.", rarityHint: "Uncommon; quiet river walks in forest are the way to see one."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Macaque troops forage along Mount Makiling's forest trails and the Subic Bay roadside, where they have learned to beg from cars.", rarityHint: "Regular at Subic and Makiling."},
            {speciesSlug: "glossy-ibis", whyItFits: "Flocks probe the Candaba marsh each northern winter alongside egrets and ducks, one of the wetland's signature birds.", rarityHint: "Regular at Candaba from November to March."},
            {speciesSlug: "black-winged-stilt", whyItFits: "Wades the shallow fishponds and flooded paddies of Candaba and Pampanga on improbable pink legs through the winter.", rarityHint: "Common at Candaba in the dry season."},
            {speciesSlug: "lesser-whistling-duck", whyItFits: "Hundreds whistle over the Candaba ponds at dawn, the commonest resident duck of Luzon's wetlands.", rarityHint: "Reliable at Candaba year-round."},
            {speciesSlug: "cattle-egret", whyItFits: "Follows carabao and tractors across the Central Luzon rice bowl in flocks, logged by users across the plain.", rarityHint: "Abundant in farmland."},
            {speciesSlug: "apple-snail", whyItFits: "The golden apple snail is the paddy pest of Luzon, logged by users in Calabarzon fields with its pink egg clusters on rice stems.", rarityHint: "Abundant in any flooded paddy."},
            {speciesSlug: "praying-mantis", whyItFits: "Mantises hunt on garden shrubs and paddy bunds across Calabarzon and were among the first insects users logged on the island.", rarityHint: "Common in gardens, especially in the wet season."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The maya on every Luzon wire and roof, the most-logged bird across Calabarzon, Central Luzon and Metro Manila.", rarityHint: "Guaranteed."},
            {speciesSlug: "pantropical-jumping-spider", whyItFits: "Hunts on sunny walls and fences in Calabarzon towns, one of several jumping spiders users have photographed in the region.", rarityHint: "Very common on warm walls by day."}
        ],
        bestFor: [
            "Birders working Candaba in the dry season and the Sierra Madre for endemics",
            "Day-trippers from Manila doing Mount Makiling's forest trail",
            "Conservation travellers visiting the San Mariano crocodile sanctuaries",
            "Collectors building a paddy and garden insect list in Calabarzon"
        ],
        spottingTips: [
            "Visit Candaba from December to February, arriving at the marsh before 6 am; by mid-morning the ducks and ibises sit far out and the heat shimmers.",
            "Walk Mount Makiling's trail from the UPLB side on a weekday morning for sailfin lizards on the stream, macaques and forest birds before the hikers arrive.",
            "At Subic, position yourself at the bat roost viewpoint 30 minutes before sunset; the flying foxes leave in waves.",
            "Paddy bunds in Laguna and Batangas after rain are the best place on the island for mantises, grasshoppers, apple snails and the spiders that hunt them."
        ],
        relatedLocationSlugs: ["philippines", "metro-manila", "visayas", "palawan"],
        rankingSlugs: ["rarest-animals"],
        faq: [
            {question: "What wildlife is there in Luzon?", answer: "Northern Luzon giant cloud rats, Philippine eagles and crocodiles, sailfin lizards, flying foxes and macaques in the forests and rivers; whistling ducks, ibises, stilts and egrets at Candaba; and a dense everyday fauna of geckos, tree sparrows, apple snails, mantises and jumping spiders in the paddies and gardens of Calabarzon."},
            {question: "What animals can be found in Luzon?", answer: "Cloud rats, Philippine eagles, Philippine crocodiles, warty pigs, deer, civets, macaques, fruit bats, pythons, monitors, sailfin lizards, tokays and house geckos, plus wetland birds at Candaba and forest endemics in the Sierra Madre and Cordillera."},
            {question: "Where can I see wildlife near Manila?", answer: "Mount Makiling in Los Baños for forest animals an hour south, the Candaba marsh two hours north for waterbirds in winter, and Subic Bay for flying foxes and macaques. The Las Piñas-Parañaque wetland inside Metro Manila has shorebirds and egrets."},
            {question: "Can you see Philippine crocodiles in the wild on Luzon?", answer: "Yes, in the San Mariano sanctuaries in Isabela run with the Mabuwaya Foundation, which arranges guided visits. The population is small, so a sighting takes an early start and patience."}
        ]
    },
    {
        slug: "metro-manila",
        name: "Metro Manila",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "PH",
        parentSlug: "luzon",
        coordinate: {lat: 14.5995, lng: 120.9842, zoom: 11},
        captureArea: {bbox: {north: 14.82, south: 14.33, east: 121.17, west: 120.88}},
        title: "Animals in Metro Manila: What You Can Spot, Learn, and Collect",
        description: "Wildlife in Metro Manila: stilts and herons at the Las Piñas-Parañaque wetland, monitors and macaques at La Mesa, fantails and geckos in the parks, rescued crocodiles.",
        searchIntents: [
            "animals in Metro Manila",
            "wildlife in Manila",
            "what animals can be found in Metro Manila",
            "what wildlife is there in Manila",
            "mga hayop sa Maynila",
            "Manila birdwatching",
            "La Mesa Ecopark animals"
        ],
        quickAnswer: "Metro Manila has more wildlife than its traffic suggests. The Las Piñas-Parañaque Wetland Park on Manila Bay holds stilts, egrets, night herons and thousands of migrant shorebirds; the La Mesa watershed in Quezon City has monitor lizards, macaques and forest birds; and pied fantails, sunbirds, bulbuls and tree sparrows live in every park. The Ninoy Aquino Parks and Wildlife Center keeps rescued Philippine crocodiles and pythons, and Manila Zoo is the old-school option.",
        introduction: [
            "Manila's wild corners are small and specific. A mangrove and mudflat strip squeezed between the Coastal Road and Manila Bay turned out to be one of the most important shorebird sites in the Philippines, and the 2,700-hectare La Mesa watershed, kept forested to protect the city's water, doubles as its biggest green space.",
            "The everyday fauna is what AnimalDex users in Manila actually log: tree sparrows on every wire, house geckos on the walls, and in the parks a pied fantail scolding from a hedge or an olive-backed sunbird at the hibiscus."
        ],
        whyItMatters: [
            "The Las Piñas-Parañaque wetland survived a reclamation plan because birders and residents counted what lived there. It is now a Ramsar site, and continued counts, including casual logs, are part of what keeps the bulldozers off.",
            "For 13 million people, these fragments are the only wild nature within an hour. A kid who photographs a monitor lizard at La Mesa has a reason to care about the Sierra Madre forest where the water comes from."
        ],
        animalsToSpot: [
            {speciesSlug: "black-winged-stilt", whyItFits: "Wades the lagoon at the Las Piñas-Parañaque Wetland Park in flocks of hundreds through the northern winter.", rarityHint: "Reliable at LPPWP from October to April."},
            {speciesSlug: "black-crowned-night-heron", whyItFits: "Roosts in the LPPWP mangroves by day and flies out over Manila Bay at dusk, one of the wetland's most dependable birds.", rarityHint: "Common year-round at the wetland park."},
            {speciesSlug: "little-egret", whyItFits: "Works the LPPWP mudflats and the fishponds of the bay edge with quick, darting steps.", rarityHint: "Very common on the bay shore."},
            {speciesSlug: "great-egret", whyItFits: "The tall white heron standing in the wetland park's shallows and the Pasig-Marikina riverside, hunting alone.", rarityHint: "Common in the wetlands."},
            {speciesSlug: "water-monitor", whyItFits: "Monitors cruise the La Mesa reservoir shore and the streams of the watershed forest, and occasionally turn up in Marikina's riverside parks.", rarityHint: "Regular at La Mesa; look along the water's edge at midday."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "A wild troop persists in the La Mesa watershed forest in Quezon City, the last monkeys inside the metro boundary.", rarityHint: "Uncommon and restricted to the watershed; the Ecopark edge is the best chance."},
            {speciesSlug: "pied-fantail", whyItFits: "The 'maria capra' fans its tail and scolds from hedges in Rizal Park, UP Diliman and every subdivision garden.", rarityHint: "Very common in parks and gardens."},
            {speciesSlug: "olive-backed-sunbird", whyItFits: "Hovers at hibiscus and bottlebrush flowers in Manila's parks and balconies, the city's hummingbird stand-in.", rarityHint: "Common wherever there are flowers."},
            {speciesSlug: "yellow-vented-bulbul", whyItFits: "Sings its bubbling phrase from fruit trees in UP Diliman, Arroceros Forest Park and residential streets across the metro.", rarityHint: "Very common."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The maya is the most-logged animal in Metro Manila's captures, hopping under carinderia tables and nesting in every roof gap.", rarityHint: "Guaranteed."},
            {speciesSlug: "common-house-gecko", whyItFits: "The butiki on the wall of every Manila apartment and sari-sari store, snapping at insects around the lights.", rarityHint: "Guaranteed after dark."},
            {speciesSlug: "mudskipper", whyItFits: "Hops across the mud at the LPPWP mangrove boardwalk and along the Parañaque fishpond dikes at low tide.", rarityHint: "Common at low tide in the wetland park."},
            {speciesSlug: "philippine-crocodile", whyItFits: "The Wildlife Rescue Center at the Ninoy Aquino Parks and Wildlife Center in Quezon City holds rescued Philippine crocodiles, the only place to see the species in the capital.", rarityHint: "Guaranteed at the wildlife centre; a rescue facility, not a zoo."},
            {speciesSlug: "reticulated-python", whyItFits: "Confiscated and surrendered pythons are housed at the Ninoy Aquino wildlife centre, and wild ones still turn up in the La Mesa watershed and Marikina riverbanks after floods.", rarityHint: "Guaranteed at the rescue centre; rare in the wild inside the metro."}
        ],
        bestFor: [
            "Birders with a spare morning: LPPWP is 20 minutes from the airport",
            "Families: La Mesa Ecopark, the wildlife centre and Manila Zoo in a weekend",
            "Urban collectors logging park birds, geckos and insects between meetings",
            "Shorebird counters in the October to April migration"
        ],
        spottingTips: [
            "Go to the Las Piñas-Parañaque Wetland Park at low tide in the early morning between October and April; the mudflats fill with shorebirds and the mangrove roost empties of night herons.",
            "La Mesa Ecopark opens early; walk the forest edge trails on a weekday for monitors, fantails and the chance of the macaque troop before the picnic crowds.",
            "UP Diliman's campus and Arroceros Forest Park are the best inner-city birding; dawn on a Sunday gives you bulbuls, sunbirds, fantails and kingfishers without traffic noise.",
            "Treat the Ninoy Aquino Parks and Wildlife Center as a rescue facility: it is the place to see Philippine crocodiles and confiscated pythons, with a lagoon that pulls in wild herons."
        ],
        relatedLocationSlugs: ["luzon", "philippines", "jakarta", "singapore"],
        rankingSlugs: ["most-adaptable-animals"],
        faq: [
            {question: "What wildlife is there in Manila?", answer: "Stilts, egrets, night herons and migrant shorebirds at the Las Piñas-Parañaque wetland; monitor lizards, macaques and forest birds in the La Mesa watershed; pied fantails, sunbirds, bulbuls, tree sparrows and house geckos in every park and street. The Ninoy Aquino wildlife centre has rescued Philippine crocodiles and pythons."},
            {question: "What animals can be found in Metro Manila?", answer: "Around 100 bird species including stilts, egrets, herons, kingfishers, fantails and sunbirds, plus water monitors, pythons, geckos, toads, fruit bats and a wild macaque troop at La Mesa. Users log tree sparrows and house geckos more than anything else."},
            {question: "Is there a good place for birdwatching in Manila?", answer: "Yes. The Las Piñas-Parañaque Wetland Park on the Coastal Road is a Ramsar site with over 80 species recorded, best at low tide in the winter months. La Mesa Ecopark and the UP Diliman campus are the inland alternatives."},
            {question: "Is Manila Zoo worth visiting?", answer: "It reopened in 2022 after a rebuild and is a modest city zoo. For native wildlife the Ninoy Aquino Parks and Wildlife Center in Quezon City, a rescue facility with Philippine crocodiles, eagles and pythons, is the more interesting half day."}
        ]
    },
    {
        slug: "visayas",
        name: "Visayas",
        regionType: "region",
        hubRegion: "asia",
        countryCode: "PH",
        parentSlug: "philippines",
        coordinate: {lat: 11.0, lng: 123.6, zoom: 7},
        captureArea: {bbox: {north: 12.8, south: 9.0, east: 126.0, west: 121.7}},
        title: "Animals in the Visayas: What You Can Spot, Learn, and Collect",
        description: "Visayas wildlife: tarsiers and fireflies on Bohol, thresher sharks at Malapascua, whale sharks at Oslob, warty pigs on Negros, dolphins and turtles off Apo Island.",
        searchIntents: [
            "animals in the Visayas",
            "wildlife in the Visayas",
            "what animals can be found in the Visayas",
            "what wildlife is there in the Visayas",
            "Bohol tarsier sanctuary",
            "Cebu wildlife",
            "Negros animals"
        ],
        quickAnswer: "The central Philippine islands are the country's marine wildlife core and home to its most famous small primate. Bohol has wild tarsiers at the Corella sanctuary and fireflies on the Abatan and Loboc rivers; Cebu has thresher sharks at Malapascua and the debated whale shark feeding at Oslob; the Tañon Strait between Cebu and Negros is dolphin water; Apo Island off Negros is the easiest turtle snorkel in the country; and Negros and Panay hold the last Visayan warty pigs.",
        introduction: [
            "The Visayas are a cluster of mid-sized islands separated by narrow, deep straits, and that geography shapes the wildlife. The straits funnel dolphins, whales and sharks close to shore, and the islands each kept their own endemics: Bohol its tarsiers, Negros and Panay their warty pigs and spotted deer, Cebu a handful of birds found nowhere else.",
            "Forest is scarce here, so the land animals are concentrated in sanctuaries and a few mountain blocks, while the sea does most of the work. A week moving between Bohol, Cebu and Negros can include tarsiers, threshers, turtles, dolphins and fireflies without a single long hike."
        ],
        whyItMatters: [
            "The Visayas lost almost all of their lowland forest, and the Visayan warty pig and spotted deer survive mainly because of breeding centres in Negros. The Corella tarsier sanctuary on Bohol is the model for how a tiny endemic can be protected and shown at the same time.",
            "Marine tourism here is a live experiment. Malapascua's thresher dives and Apo Island's turtle rules work; Oslob's whale shark feeding is the case conservationists use to argue what not to do. Choosing well matters more here than almost anywhere in Asia."
        ],
        animalsToSpot: [
            {speciesSlug: "philippine-tarsier", whyItFits: "The Philippine Tarsier Foundation's sanctuary at Corella on Bohol protects wild tarsiers that roost in the forest and can be watched from a few metres without handling.", rarityHint: "Near-certain at Corella; avoid the roadside 'tarsier' stops along the Loboc river."},
            {speciesSlug: "thresher-shark", whyItFits: "Monad Shoal off Malapascua, Cebu is the only place on Earth where divers reliably see thresher sharks, here the pelagic species, which rise to the cleaning stations at first light.", rarityHint: "Near-daily for divers at Monad Shoal before 7 am; certification required."},
            {speciesSlug: "whale-shark", whyItFits: "Oslob in southern Cebu feeds whale sharks daily to keep them in the bay, which guarantees a sighting and draws steady criticism from marine biologists.", rarityHint: "Guaranteed at Oslob; consider Donsol on Luzon for an unfed, seasonal alternative."},
            {speciesSlug: "visayan-warty-pig", whyItFits: "A tufted wild pig endemic to Negros and Panay, bred at the Talarak Foundation and the Negros Forests and Ecological Foundation's centre in Bacolod with a few wild groups left in the mountains.", rarityHint: "Rare in the wild; reliable at the Bacolod breeding centres."},
            {speciesSlug: "spinner-dolphin", whyItFits: "Pods of spinners leap in the Tañon Strait off Bais in Negros Oriental, where morning dolphin-watching boats run in the calm season.", rarityHint: "Regular from Bais between March and October."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Apo Island off Negros has a resident population grazing seagrass in the marine sanctuary, visible from the surface in a metre of water.", rarityHint: "Near-guaranteed snorkelling at Apo Island's village beach."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Hawksbills feed on the sponge-rich reef walls of Apo Island, Moalboal and Balicasag off Bohol.", rarityHint: "Regular for divers; occasional for snorkelers."},
            {speciesSlug: "sea-krait", whyItFits: "Banded sea kraits hunt the reefs of Apo Island and Gato Island near Malapascua, which is famous for them, and come ashore to rest on the rocks.", rarityHint: "Common at Gato Island; docile unless handled."},
            {speciesSlug: "giant-clam", whyItFits: "Metre-long giant clams sit in the shallow marine sanctuaries at Tulapos on Siquijor and Nalusuan off Olango, within easy snorkel reach.", rarityHint: "Reliable at the managed clam sanctuaries."},
            {speciesSlug: "clownfish", whyItFits: "Anemones on Balicasag, Pescador Island and Apo Island reefs hold clownfish within easy snorkel depth.", rarityHint: "Guaranteed on any reef snorkel."},
            {speciesSlug: "firefly", whyItFits: "Mangrove trees along Bohol's Abatan and Loboc rivers light up with synchronised fireflies on paddle-boat tours after dark.", rarityHint: "Reliable on moonless nights, best in the dry season."},
            {speciesSlug: "large-flying-fox", whyItFits: "Flying fox colonies roost in Bohol's Bilar and Rajah Sikatuna forests and stream out at dusk over the Chocolate Hills road.", rarityHint: "Regular at dusk near Bilar."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops live in Rajah Sikatuna Protected Landscape on Bohol and around the Loboc river's forest edge.", rarityHint: "Regular at Rajah Sikatuna's trails."},
            {speciesSlug: "little-egret", whyItFits: "Olango Island off Cebu is a Ramsar wetland where egrets, herons and thousands of migrant shorebirds feed on the tidal flats.", rarityHint: "Common at Olango, best October to March."}
        ],
        bestFor: [
            "Divers and snorkelers: threshers, turtles, sea kraits and reef life island to island",
            "Primate fans making the pilgrimage to Bohol's wild tarsiers",
            "Families: fireflies, Chocolate Hills and Apo Island turtles are easy wins",
            "Shorebird watchers at Olango Island in the northern winter"
        ],
        spottingTips: [
            "Book the Corella sanctuary on Bohol and go early; the roadside tarsier stops on the Loboc tourist loop handle animals and should be skipped.",
            "Thresher dives at Monad Shoal leave Malapascua at 5 am; go on your first morning so you have a second chance if the sharks do not show.",
            "Snorkel Apo Island from the village beach at mid-morning when the turtles graze the seagrass in a metre of water; no boat needed.",
            "Take the Abatan river firefly tour on a moonless night in the dry season and ask for a paddle boat rather than a motor boat."
        ],
        relatedLocationSlugs: ["philippines", "mindanao", "luzon", "palawan"],
        rankingSlugs: ["animals-with-best-eyesight"],
        challengeSlugs: ["dolphin-vs-shark-intelligence"],
        faq: [
            {question: "What wildlife is there in the Visayas?", answer: "Philippine tarsiers and fireflies on Bohol, thresher sharks at Malapascua, whale sharks at Oslob, spinner dolphins in the Tañon Strait, green and hawksbill turtles at Apo Island, sea kraits at Gato Island, Visayan warty pigs on Negros and migrant shorebirds at Olango. Flying foxes and macaques live in Bohol's forest."},
            {question: "What animals can be found in the Visayas?", answer: "Tarsiers, warty pigs, spotted deer, hornbills and flying foxes on land; thresher and whale sharks, dolphins, turtles, sea kraits, giant clams and rich reef fish in the straits and sanctuaries. Everyday species are tree sparrows, house geckos, egrets and the garden insects users log."},
            {question: "Where is the best place to see tarsiers?", answer: "The Philippine Tarsier Sanctuary at Corella, Bohol, run by the Philippine Tarsier Foundation. The animals are wild, roost in natural forest and are watched from a distance. Avoid roadside enclosures along the Loboc river where tarsiers are handled."},
            {question: "Should I swim with whale sharks at Oslob?", answer: "Oslob guarantees a sighting because the sharks are fed daily, which is exactly why marine biologists criticise it. If you can time a trip for February to May, Donsol on Luzon offers wild, unfed whale sharks under no-touch rules."}
        ]
    },
    {
        slug: "mindanao",
        name: "Mindanao",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "PH",
        parentSlug: "philippines",
        coordinate: {lat: 7.8, lng: 125.0, zoom: 6},
        captureArea: {bbox: {north: 10.1, south: 5.4, east: 126.8, west: 121.8}, excludeBboxes: [{north: 10.1, south: 9.0, east: 124.6, west: 121.8}]},
        title: "Animals in Mindanao: What You Can Spot, Learn, and Collect",
        description: "Mindanao wildlife: Philippine eagles at Davao's eagle centre and on Mount Apo, crocodiles in the Agusan marsh, Samal's bat cave, tarsiers and Siargao's turtles.",
        searchIntents: [
            "animals in Mindanao",
            "wildlife in Mindanao",
            "what animals can be found in Mindanao",
            "what wildlife is there in Mindanao",
            "Philippine Eagle Center Davao",
            "Mount Apo wildlife",
            "Agusan marsh crocodiles"
        ],
        quickAnswer: "Mindanao is the Philippine eagle's island. The Philippine Eagle Center outside Davao guarantees a close look, and wild pairs nest on Mount Apo, Mount Kitanglad and in the Mount Hamiguitan range. The Agusan marsh holds the country's biggest saltwater crocodiles, Samal Island has a famous fruit-bat cave, tarsiers live in the eastern forests and Siargao's mangroves and reefs add turtles, monitors and sea kraits.",
        introduction: [
            "Mindanao holds the largest remaining forest in the Philippines and most of its endemic birds, which is why it is the country's top birding island despite a reputation that keeps many visitors away. Davao, the island's safe and well-connected hub, puts the eagle centre, Mount Apo and Samal Island within a day of each other.",
            "The Agusan marsh in the northeast is a different world: a 19,000-hectare floodplain of lakes and floating villages where the Manobo people share the water with crocodiles, and where Lolong, the largest crocodile ever measured in captivity, was caught in 2011."
        ],
        whyItMatters: [
            "With fewer than 400 pairs, the Philippine eagle depends on Mindanao's mountain forests, and the Philippine Eagle Foundation's breeding and release work at Davao is the species' lifeline. Visiting funds it directly.",
            "Mindanao's forests are being cleared for plantations faster than almost anywhere in the country. Birders and trekkers who log what they find on Kitanglad and Hamiguitan are building the record that supports keeping those mountains protected."
        ],
        animalsToSpot: [
            {speciesSlug: "philippine-eagle", whyItFits: "The Philippine Eagle Center at Malagos, Davao keeps and breeds the national bird in forest enclosures, and wild pairs nest on Mount Apo, Mount Kitanglad and Hamiguitan.", rarityHint: "Guaranteed at the Davao centre; wild birds need a guided dawn trek at Kitanglad or Apo."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "The Agusan marsh holds the Philippines' largest wild saltwater crocodiles, watched from Manobo boats among the floating houses of Bunawan and Loreto.", rarityHint: "Regular on marsh boat trips in the dry season; Lolong's home water."},
            {speciesSlug: "philippine-tarsier", whyItFits: "Tarsiers live in the lowland and foothill forest of eastern Mindanao, from Surigao to Davao Oriental, far less visited than Bohol's.", rarityHint: "Rare and hard to find without a local guide; Bohol is easier."},
            {speciesSlug: "large-flying-fox", whyItFits: "Flying foxes roost in Mindanao's lowland forest patches and the mangroves of Davao Gulf and stream out over the coconut groves at dusk; Samal's famous Monfort cave is a different, smaller fruit bat, the Geoffroy's rousette, in a colony of close to two million.", rarityHint: "Regular at dusk along Davao Gulf; the Monfort rousettes are guaranteed but are not this species."},
            {speciesSlug: "dugong", whyItFits: "Small numbers of dugongs still graze seagrass in Davao Gulf and Pujada Bay near Mati, among the last in the southern Philippines.", rarityHint: "Rare; Pujada Bay boat trips have an outside chance."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Macaque troops forage along Mount Apo's lower trails, in the Eden Nature Park forest above Davao and across Siargao's coconut groves.", rarityHint: "Regular on forest-edge trails."},
            {speciesSlug: "asian-palm-civet", whyItFits: "Civets raid coffee and fruit farms on the slopes of Mount Apo and Mount Matutum, and their droppings are the source of local civet coffee.", rarityHint: "Nocturnal and common on upland farms."},
            {speciesSlug: "reticulated-python", whyItFits: "Big pythons live in the Agusan marsh, Mindanao's river forests and the coconut plantations, and are a regular barangay encounter after floods.", rarityHint: "Occasional; most common in the wet season."},
            {speciesSlug: "water-monitor", whyItFits: "Monitors patrol Siargao's mangroves, the Agusan marsh edges and riverbanks across the island.", rarityHint: "Common near water."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Turtles graze the seagrass off Siargao's Daku and Naked islands and nest on quiet beaches of Davao Oriental.", rarityHint: "Regular snorkelling around Siargao's island-hopping stops."},
            {speciesSlug: "sea-krait", whyItFits: "Banded sea kraits hunt the reef flats around Siargao and Samal and rest on exposed rocks at low tide.", rarityHint: "Occasional on reef snorkels; harmless unless grabbed."},
            {speciesSlug: "blue-naped-parrot", whyItFits: "Small flocks of this green, blue-capped parrot fly over Mindanao's lowland forest edges and coconut groves, especially in the east and on Siargao.", rarityHint: "Uncommon; listen for the loud screeching flight call at dawn."},
            {speciesSlug: "red-junglefowl", whyItFits: "Wild chickens crow from forest edges and abandoned clearings on Mount Apo's foothills and across rural Mindanao.", rarityHint: "Heard constantly; seen crossing trails at dawn."},
            {speciesSlug: "tokay-gecko", whyItFits: "The tuko barks from the roofs of Davao's suburbs and every rural homestay on the island after dark.", rarityHint: "Heard nightly; found with a torch on walls and trees."}
        ],
        bestFor: [
            "Birders: Mindanao has more endemic birds than any other Philippine island",
            "Travellers who want a guaranteed Philippine eagle at the Davao centre",
            "Boat-based wildlife in the Agusan marsh with Manobo guides",
            "Surfers on Siargao adding turtles, monitors and mangrove birds between sessions"
        ],
        spottingTips: [
            "Visit the Philippine Eagle Center at opening time, when the birds are active and the Malagos forest around it is full of wild birds too.",
            "Mount Kitanglad in Bukidnon is the most reliable mountain for a wild eagle; book a guide through the local birding community and climb to the Del Monte lodge area before dawn.",
            "Arrange Agusan marsh boats from Bunawan in the dry season (March to May); water levels drop and crocodiles bask on exposed banks.",
            "Samal's Monfort bat sanctuary is a short ferry from Davao; go late afternoon to see the roost and stay for the dusk emergence."
        ],
        relatedLocationSlugs: ["philippines", "visayas", "palawan", "indonesia"],
        rankingSlugs: ["animals-with-best-eyesight", "biggest-animals"],
        challengeSlugs: ["eagle-vs-owl", "crocodile-vs-shark"],
        faq: [
            {question: "What wildlife is there in Mindanao?", answer: "Philippine eagles at Davao's eagle centre and wild on Mounts Apo, Kitanglad and Hamiguitan; saltwater crocodiles in the Agusan marsh; tarsiers, flying foxes, civets, macaques, pythons and monitors in the forests; dugongs in Davao Gulf; and turtles, sea kraits and reef fish around Siargao and Samal."},
            {question: "What animals can be found in Mindanao?", answer: "Philippine eagle, Philippine tarsier, Philippine deer, warty pig, flying foxes, civets, macaques, saltwater crocodile, reticulated python, monitors, tokay geckos, hornbills, parrots and over 100 endemic bird species, plus sea turtles, dugongs and reef life offshore."},
            {question: "Is it safe to travel in Mindanao for wildlife?", answer: "Davao, Bukidnon, Siargao, Samal and Davao Oriental are regularly visited and considered safe for tourists. Check current advice for the Agusan marsh and the Bangsamoro region before going, and use local guides everywhere."},
            {question: "Where can I see a Philippine eagle?", answer: "The Philippine Eagle Center in Malagos, Davao City, about 45 minutes from downtown, has eagles in forest enclosures and runs the breeding programme. For a wild bird, Mount Kitanglad in Bukidnon with a local guide is the best bet."}
        ]
    },
    {
        slug: "palawan",
        name: "Palawan",
        regionType: "island",
        hubRegion: "asia",
        countryCode: "PH",
        parentSlug: "philippines",
        coordinate: {lat: 9.8349, lng: 118.7384, zoom: 7},
        captureArea: {bbox: {north: 12.5, south: 7.7, east: 120.6, west: 116.9}},
        title: "Animals in Palawan: What You Can Spot, Learn, and Collect",
        description: "Palawan wildlife: monitors at the Puerto Princesa underground river, bearcats and hill mynas, dugongs off Busuanga, El Nido's swiftlets and Tubbataha's sharks and mantas.",
        searchIntents: [
            "animals in Palawan",
            "wildlife in Palawan",
            "what animals can be found in Palawan",
            "what wildlife is there in Palawan",
            "Puerto Princesa underground river animals",
            "El Nido wildlife",
            "Tubbataha reef animals"
        ],
        quickAnswer: "Palawan's fauna is closer to Borneo's than to the rest of the Philippines, which is why it has bearcats, hill mynas and pangolins that no other Philippine island does. Monitor lizards and macaques greet boats at the Puerto Princesa underground river, dugongs graze off Busuanga, edible-nest swiftlets nest in the limestone that gave El Nido its name, and Tubbataha Reef has sharks, mantas and turtles on every dive. The Iwahig river near Puerto Princesa has fireflies every night.",
        introduction: [
            "Palawan is a long limestone spine between the Sulu and South China seas, and its animals arrived from Borneo when sea levels were lower. The result is a mix found nowhere else in the country: Palawan bearcats, Palawan hornbills, hill mynas and a pangolin species of its own, alongside the usual Philippine monitors, macaques and geckos.",
            "For most visitors the island is beaches and boat trips, and the wildlife fits in around them. The underground river boat passes monitors on the beach, El Nido's island hopping passes swiftlet caves and turtles, and Coron's reefs and seagrass hold dugongs."
        ],
        whyItMatters: [
            "Palawan is the Philippines' 'last frontier' and its most heavily marketed, with El Nido and Coron under real pressure from boats and resorts. Tubbataha, two days offshore and strictly managed, is the benchmark for what the island's reefs could be.",
            "The Palawan pangolin is critically endangered from trafficking, and the Palawan Wildlife Rescue and Conservation Center in Puerto Princesa holds confiscated animals and breeds Philippine crocodiles. Logging the island's endemics builds a public record that trafficking thrives on erasing."
        ],
        animalsToSpot: [
            {speciesSlug: "water-monitor", whyItFits: "Big monitors bask on the beach at Sabang where the underground river boats land, and patrol the mangroves of Honda Bay and Bacuit.", rarityHint: "Near-guaranteed at the underground river landing."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "A troop works the Sabang beach and the underground river boardwalk, snatching food from bags, and others range the forest around El Nido.", rarityHint: "Guaranteed at Sabang; secure everything."},
            {speciesSlug: "binturong", whyItFits: "The Palawan bearcat lives in the island's remaining forest and is the mascot of the Puerto Princesa area, with rescued animals at the wildlife centre and wild ones in the Cleopatra's Needle forest.", rarityHint: "Rare in the wild and nocturnal; reliable at the rescue centre."},
            {speciesSlug: "common-hill-myna", whyItFits: "Palawan's hill myna, a glossy black talker with yellow wattles, is the only wild population in the Philippines, whistling from tall trees in the north and on Busuanga.", rarityHint: "Uncommon; forest edges around El Nido and Taytay at dawn."},
            {speciesSlug: "blue-naped-parrot", whyItFits: "Palawan is the species' stronghold, with flocks over Puerto Princesa's outskirts and the Bacuit forest in the early morning.", rarityHint: "Regular at dawn; loud flight calls give them away."},
            {speciesSlug: "edible-nest-swiftlet", whyItFits: "El Nido is named after the nests these swiftlets glue to its limestone cliffs, and they pour out of the Bacuit cave mouths every dawn.", rarityHint: "Guaranteed around El Nido's cliffs; nests are harvested under permit."},
            {speciesSlug: "dugong", whyItFits: "Dugongs graze the seagrass beds off Busuanga's Dimakya Island and around Calauit, one of the last reliable Philippine populations.", rarityHint: "Dedicated dugong snorkel trips from Busuanga succeed on perhaps half of mornings."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Turtles feed on seagrass at El Nido's Shimizu and Helicopter islands and nest on quiet beaches across the Calamianes.", rarityHint: "Regular on El Nido island-hopping snorkels."},
            {speciesSlug: "hawksbill-sea-turtle", whyItFits: "Hawksbills feed on the sponge-covered walls of Tubbataha and the El Nido drop-offs, and nest at Tubbataha's bird islet.", rarityHint: "Common on Tubbataha dives; occasional at El Nido."},
            {speciesSlug: "reef-manta-ray", whyItFits: "Mantas sweep the walls and cleaning stations of Tubbataha Reef during the March to June dive season.", rarityHint: "Regular on Tubbataha liveaboards."},
            {speciesSlug: "blacktip-reef-shark", whyItFits: "Blacktips patrol the shallows of Tubbataha's lagoons and the reef flats of El Nido's outer islands.", rarityHint: "Common at Tubbataha; occasional for El Nido snorkelers."},
            {speciesSlug: "saltwater-crocodile", whyItFits: "Wild saltwater crocodiles persist in southern Palawan's rivers and mangroves around Balabac and Rizal, and the Puerto Princesa rescue centre keeps large ones.", rarityHint: "Rare in the wild; guaranteed at the Palawan Wildlife Rescue and Conservation Center."},
            {speciesSlug: "firefly", whyItFits: "The Iwahig river outside Puerto Princesa runs paddle-boat firefly tours past mangroves that flicker every night of the year.", rarityHint: "Reliable nightly; best on moonless nights."},
            {speciesSlug: "mudskipper", whyItFits: "Skips across the mud of the Iwahig and Sabang mangroves and Honda Bay's fringes at low tide.", rarityHint: "Abundant at low tide."}
        ],
        bestFor: [
            "Divers heading to Tubbataha for sharks, mantas and turtles",
            "Island-hoppers at El Nido and Coron adding turtles, swiftlets and dugongs",
            "Families: the underground river, Iwahig fireflies and the rescue centre in two days",
            "Birders after Palawan endemics: hornbill, peacock-pheasant, hill myna and parrots"
        ],
        spottingTips: [
            "Take the first underground river boat from Sabang; monitors and macaques are on the beach before the crowds, and the cave's bats and swiftlets are still returning.",
            "For dugongs, book a dedicated early-morning trip from Busuanga rather than hoping on a general island-hop; calm water and low sun are essential for spotting them.",
            "Tubbataha is liveaboard-only from mid-March to mid-June; book months ahead and expect sharks, mantas and turtles on most dives.",
            "Combine the Iwahig firefly tour with a dusk walk along the river's mangrove edge for mudskippers, herons and the last monitors of the day."
        ],
        relatedLocationSlugs: ["philippines", "borneo", "visayas", "luzon"],
        rankingSlugs: ["rarest-animals", "biggest-animals"],
        challengeSlugs: ["crocodile-vs-shark"],
        faq: [
            {question: "What wildlife is there in Palawan?", answer: "Monitor lizards, macaques, bearcats, hill mynas, blue-naped parrots and Palawan hornbills on land; dugongs off Busuanga; green and hawksbill turtles, mantas, reef sharks and rich coral at El Nido and Tubbataha; swiftlets in El Nido's cliffs; fireflies on the Iwahig river; and saltwater crocodiles in the south."},
            {question: "What animals can be found in Palawan?", answer: "Palawan bearcat, Palawan pangolin, Palawan hornbill, Palawan peacock-pheasant, hill myna, blue-naped parrot, long-tailed macaque, water monitor, saltwater and Philippine crocodiles, dugong, sea turtles, manta rays, sharks and hundreds of reef fish species. Geckos, fruit bats and fireflies are everyday sightings."},
            {question: "What animals are at the Puerto Princesa underground river?", answer: "Water monitors and long-tailed macaques on Sabang beach and the boardwalk, swiftlets and several bat species inside the cave, and herons, kingfishers and mudskippers in the mangroves. Boats run from early morning; the first ones see the most."},
            {question: "Can you see dugongs in Palawan?", answer: "Yes, off Busuanga in the Calamianes, where operators run early-morning dugong snorkels around Dimakya Island and Calauit. Success is roughly even odds on any given morning, better in calm weather from November to May."}
        ]
    },
    {
        slug: "vietnam",
        name: "Vietnam",
        regionType: "country",
        hubRegion: "asia",
        countryCode: "VN",
        coordinate: {lat: 15.5, lng: 107.5, zoom: 5},
        captureArea: {countryCodes: ["VN"]},
        title: "Animals in Vietnam: What You Can Spot, Learn, and Collect",
        description: "Vietnam wildlife guide: red-shanked doucs at Son Tra, langurs and lorises at Cuc Phuong, gaur and crocodiles in Cat Tien, sarus cranes at Tram Chim, geckos everywhere.",
        searchIntents: [
            "animals in Vietnam",
            "wildlife in Vietnam",
            "what animals can be found in Vietnam",
            "what wildlife is there in Vietnam",
            "what animals can you see in Vietnam",
            "động vật ở Việt Nam",
            "Vietnam wildlife travel"
        ],
        quickAnswer: "Vietnam's wildlife is primate-rich and hard-won. Red-shanked doucs live on the Son Tra peninsula beside Da Nang, Cat Ba and Francois' langurs cling to limestone karst in the north, pygmy slow lorises and rescued doucs can be seen at Cuc Phuong's primate centre, and Cat Tien National Park has gaur, Siamese crocodiles and gibbons. The Mekong delta's Tram Chim holds sarus cranes and storks. Everywhere, house geckos, sun skinks, mynas, dragonflies and hornets are what users actually log.",
        introduction: [
            "Vietnam stretches 1,600 kilometres from the limestone karst of the Chinese border to the Mekong delta, and its wildlife changes with it. The north has langurs on cliffs and turtles in the rescue centres; the central highlands around Da Lat have pine-forest birds and the country's last big mammals; the south has Cat Tien's lowland forest and the delta's crane marshes.",
            "Decades of hunting emptied much of the forest, so the big animals are concentrated in a few parks and rescue centres, while the common fauna is thriving. AnimalDex users in Hanoi, Da Lat, Ninh Binh and Ca Mau log hornets, chafer beetles, pig-tailed macaques, pond turtles, fantails and freshwater crabs."
        ],
        whyItMatters: [
            "Vietnam is where the saola was discovered in 1992 and where it may already be extinct; it has not been photographed since 2013. The country's remaining forest in the Annamites is one of the most important and least protected in Asia.",
            "The rescue centres at Cuc Phuong, the Endangered Primate Rescue Center and the Turtle Conservation Centre, are where confiscated animals from the wildlife trade end up, and they are open to visitors. Seeing a Cat Ba langur or a box turtle there is a direct look at what the trade takes."
        ],
        animalsToSpot: [
            {speciesSlug: "red-shanked-douc", whyItFits: "The 'costumed ape' with red stockings and a white beard lives wild on the Son Tra peninsula ten minutes from Da Nang, the most accessible douc population anywhere.", rarityHint: "Regular along Son Tra's roads at dawn and late afternoon; near-certain at Cuc Phuong's primate centre."},
            {speciesSlug: "francois-langur", whyItFits: "Black langurs with white sideburns live on limestone karst in the north, with groups at Ba Be and in the Lam Binh karst of Tuyen Quang.", rarityHint: "Uncommon in the wild; seen at the Cuc Phuong primate centre."},
            {speciesSlug: "pygmy-slow-loris", whyItFits: "A tiny nocturnal primate of Vietnam's forests, rescued from the pet trade in numbers and rehabilitated at Cuc Phuong, with wild animals found on night walks in Cat Tien.", rarityHint: "Reliable at Cuc Phuong's centre; occasional on Cat Tien night drives."},
            {speciesSlug: "saola", whyItFits: "The Annamite 'Asian unicorn' was discovered in Vu Quang in 1992 and survives, if at all, in the central border forests of Vietnam and Laos.", rarityHint: "Not seen alive since 2013; listed because this is its home, not because you will find one."},
            {speciesSlug: "asian-elephant", whyItFits: "Vietnam's last wild herds live in Yok Don National Park in Dak Lak, where ethical walking tours replaced riding in the 2010s.", rarityHint: "Rare in the wild; the Yok Don retired-elephant tours are the realistic encounter."},
            {speciesSlug: "gaur", whyItFits: "Herds of the world's largest wild cattle graze the grasslands of Cat Tien National Park and are a regular sight from the night-drive trucks.", rarityHint: "Regular on Cat Tien's evening drives."},
            {speciesSlug: "siamese-crocodile", whyItFits: "Cat Tien's Bau Sau (Crocodile Lake) has a reintroduced population of this critically endangered crocodile, reached by a five-kilometre forest walk.", rarityHint: "Reliable at Bau Sau in the dry season; eyes shine at night from the ranger station."},
            {speciesSlug: "northern-pig-tailed-macaque", whyItFits: "Stocky forest macaques logged by a user in Ninh Binh, where they live in the karst forest of Cuc Phuong and Van Long.", rarityHint: "Regular in Cuc Phuong's forest."},
            {speciesSlug: "sarus-crane", whyItFits: "The world's tallest flying bird winters at Tram Chim National Park in the Mekong delta, the last Vietnamese stronghold for the species.", rarityHint: "Uncommon and declining; Tram Chim from January to April is the only chance."},
            {speciesSlug: "annam-pond-turtle", whyItFits: "A turtle endemic to central Vietnam's coastal lowlands, extinct in the wild for years and bred at Cuc Phuong's Turtle Conservation Centre, where a user logged one.", rarityHint: "Only at the Turtle Conservation Centre; none left in the wild."},
            {speciesSlug: "chinese-water-dragon", whyItFits: "Green dragons bask on branches over forest streams in the north and centre and drop into the water when disturbed; a pet-trade species that is wild here.", rarityHint: "Regular along forest streams in Cuc Phuong and Ba Vi."},
            {speciesSlug: "common-sun-skink", whyItFits: "The bronze skink basking on every path edge and garden wall in Vietnam, logged by users across the country.", rarityHint: "Very common by day."},
            {speciesSlug: "asian-hornet", whyItFits: "Big hornets patrol orchards and gardens from Hanoi to the highlands, logged by users in the capital; the species that colonised Europe.", rarityHint: "Common in late summer and autumn."},
            {speciesSlug: "pied-fantail", whyItFits: "Fans its tail and chatters from mangrove and garden hedges across the Mekong delta, logged by a user in Ca Mau at the country's southern tip.", rarityHint: "Very common in the south, near water."}
        ],
        bestFor: [
            "Primate watchers: doucs, langurs, gibbons and lorises in one country",
            "Travelers combining Da Nang or Hoi An with Son Tra's wild doucs",
            "Night-drive fans at Cat Tien for gaur, civets, lorises and crocodiles",
            "Collectors who like an easy everyday list: skinks, geckos, mynas, hornets and dragonflies"
        ],
        spottingTips: [
            "Drive or cycle Son Tra's coastal road from Da Nang at 6 am; doucs feed in the trees above the road and are gone by mid-morning.",
            "At Cat Tien, book the night drive and the Bau Sau crocodile walk on different days; both need early starts and the walk is 10 kilometres round trip.",
            "Cuc Phuong's primate and turtle centres have set visiting hours and a guide; go in the afternoon and combine with a forest walk for pig-tailed macaques and water dragons.",
            "Tram Chim's cranes arrive after the floods recede; February and March are best, and a dawn boat gives storks, darters and whistling ducks regardless."
        ],
        relatedLocationSlugs: ["hanoi", "da-lat", "laos", "cambodia"],
        rankingSlugs: ["rarest-animals"],
        challengeSlugs: ["python-vs-cobra"],
        faq: [
            {question: "What wildlife is there in Vietnam?", answer: "Red-shanked doucs, Cat Ba and Francois' langurs, gibbons and pygmy slow lorises in the forests; gaur, Siamese crocodiles and wild elephants in Cat Tien and Yok Don; sarus cranes and storks in the Mekong delta; and a common fauna of house geckos, sun skinks, water dragons, mynas, fantails, hornets and dragonflies everywhere."},
            {question: "What animals can be found in Vietnam?", answer: "Around 300 mammals including 25 primate species, 900 birds and 300 reptiles. The headline species are the doucs and langurs, saola, Indochinese tiger (likely gone), Asian elephant and gaur; the everyday ones are macaques, civets, geckos, skinks, pond turtles and insects."},
            {question: "Where is the best place to see wildlife in Vietnam?", answer: "Cat Tien National Park near Ho Chi Minh City for mammals on night drives, Son Tra near Da Nang for wild doucs, Cuc Phuong near Ninh Binh for the primate and turtle rescue centres, and Tram Chim in the delta for cranes and waterbirds."},
            {question: "Are there still tigers in Vietnam?", answer: "Almost certainly not in the wild. The Indochinese tiger has not been confirmed in Vietnam for over a decade, and the few at rescue centres came from trafficking seizures. Cat Tien's gaur and crocodiles are the big-animal highlights today."}
        ]
    },
    {
        slug: "da-lat",
        name: "Da Lat",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "VN",
        parentSlug: "vietnam",
        coordinate: {lat: 11.9404, lng: 108.4583, zoom: 10},
        captureArea: {bbox: {north: 12.4, south: 11.65, east: 108.85, west: 108.15}},
        title: "Animals in Da Lat: What You Can Spot, Learn, and Collect",
        description: "Da Lat wildlife: silver pheasants and montane birds at Bidoup Nui Ba, lorises, muntjac and sambar in the highland forest, and the moths and dragonflies of the plateau.",
        searchIntents: [
            "animals in Da Lat",
            "wildlife in Da Lat",
            "what animals can be found in Da Lat",
            "what wildlife is there in Da Lat",
            "động vật ở Đà Lạt",
            "Bidoup Nui Ba national park animals",
            "Lam Dong wildlife"
        ],
        quickAnswer: "Da Lat sits at 1,500 metres on the Lam Dong plateau, and its wildlife is montane: silver pheasants, laughingthrushes and sunbirds in the Bidoup Nui Ba forest, sambar and muntjac on the park's trails, pygmy slow lorises and yellow-throated martens in the evergreen patches, with pine forest full of dragonflies, hawkmoths, chafers and freshwater crabs in the streams. AnimalDex users on the plateau log mostly insects: grass moths, wandering gliders, honey bees and skipper butterflies.",
        introduction: [
            "Da Lat is Vietnam's cool-climate hill station, built by the French among pine forest and lakes, and its surroundings are the country's best montane birding. Bidoup Nui Ba National Park, 50 kilometres northeast, protects about 65,000 hectares of evergreen and pine forest on the plateau's highest ground.",
            "The city itself is gardens, greenhouses and lakes, and that is what the local capture record shows: moths at night lights, wandering glider dragonflies over Xuan Huong Lake, honey bees in the flower farms and freshwater crabs in the streams that run off the plateau."
        ],
        whyItMatters: [
            "The Da Lat plateau is an endemic bird area with species found nowhere else, including the collared laughingthrush and Vietnamese greenfinch, and Bidoup Nui Ba is the park that holds them. It also holds one of the largest known populations of the yellow-cheeked gibbon.",
            "Flower and vegetable farming is eating the plateau's forest edge fast. Birders and hikers who log what still lives in the pine belt around the city keep a record that the greenhouses are erasing."
        ],
        animalsToSpot: [
            {speciesSlug: "silver-pheasant", whyItFits: "Males with long white tails cross the forest trails of Bidoup Nui Ba and Ta Nung valley at dawn, the plateau's most striking ground bird.", rarityHint: "Uncommon; early mornings on quiet trails in Bidoup."},
            {speciesSlug: "pygmy-slow-loris", whyItFits: "Lives in the evergreen forest of Bidoup Nui Ba and Chu Yang Sin, found on night walks by its orange eyeshine in the mid-storey.", rarityHint: "Rare; a park ranger night walk gives a fair chance."},
            {speciesSlug: "sambar-deer", whyItFits: "Sambar browse Bidoup's forest edges and clearings and leave tracks on the muddy trails around the park headquarters.", rarityHint: "Occasional at dawn and dusk; tracks are common."},
            {speciesSlug: "indian-muntjac", whyItFits: "The barking deer's hoarse alarm call echoes through Bidoup's evergreen forest, and animals cross the trails in the first hour of light.", rarityHint: "Heard regularly; seen with patience."},
            {speciesSlug: "yellow-throated-marten", whyItFits: "A big, bold marten that hunts in pairs through Bidoup's canopy and along the park roads in daylight.", rarityHint: "Uncommon but conspicuous when present; watch the road edges."},
            {speciesSlug: "wild-boar", whyItFits: "Rootles through Bidoup's forest floor and the pine-forest edges around Tuyen Lam Lake, leaving churned ground along the trails.", rarityHint: "Common but shy; signs everywhere, animals at dusk."},
            {speciesSlug: "crested-serpent-eagle", whyItFits: "Circles over the pine and evergreen forest around Da Lat with a piercing whistle, the plateau's commonest large raptor.", rarityHint: "Regular overhead on sunny mornings."},
            {speciesSlug: "common-kingfisher", whyItFits: "Hunts the streams below Datanla and Prenn waterfalls and the edges of Tuyen Lam Lake.", rarityHint: "Regular along clear streams."},
            {speciesSlug: "wandering-glider", whyItFits: "The world's most widespread dragonfly swarms over Xuan Huong Lake and the flower farms, and was logged by a user on the plateau.", rarityHint: "Abundant in the wet season."},
            {speciesSlug: "freshwater-crab", whyItFits: "Highland stream crabs live under stones in the brooks running off the plateau and were logged by a user near Da Lat.", rarityHint: "Common under rocks in clear, cool streams."},
            {speciesSlug: "asian-honey-bee", whyItFits: "Works the plateau's flower farms, coffee blossom and wild rhododendrons; bees are among the insects users log most around Da Lat.", rarityHint: "Very common wherever flowers are open."},
            {speciesSlug: "common-myna", whyItFits: "Patrols Da Lat's market square and lakeside lawns, logged by users in the city centre.", rarityHint: "Common in town."},
            {speciesSlug: "great-mormon", whyItFits: "A big black swallowtail that drifts through Da Lat's gardens and the citrus and flower farms on the plateau.", rarityHint: "Common in gardens on warm days."},
            {speciesSlug: "common-house-gecko", whyItFits: "Hunts around the lights of Da Lat's guesthouses even at this altitude, logged by users in the city.", rarityHint: "Common on warm nights; slower in the cool season."}
        ],
        bestFor: [
            "Birders chasing the Da Lat plateau's endemics in Bidoup Nui Ba and Ta Nung",
            "Hikers combining Lang Biang or Bidoup treks with dawn wildlife",
            "Cool-climate insect collectors: moths at night lights, dragonflies over the lakes",
            "Travelers who want a quieter, cooler counterpoint to coastal Vietnam"
        ],
        spottingTips: [
            "Hire a birding guide for Bidoup Nui Ba and Ta Nung valley; the endemics are skulking laughingthrushes and the guides know the fruiting trees and song posts.",
            "Walk the forest road from Bidoup's headquarters at first light for silver pheasants, muntjac and martens before the motorbikes start.",
            "Leave a porch light on at any guesthouse on the plateau edge; the moth and beetle variety at 1,500 metres is a different list from the lowlands.",
            "Turn over stones in the clear streams below the waterfalls for freshwater crabs, and check the lake edges at midday for wandering gliders."
        ],
        relatedLocationSlugs: ["vietnam", "hanoi", "cambodia"],
        rankingSlugs: ["animals-with-best-camouflage"],
        faq: [
            {question: "What wildlife is there in Da Lat?", answer: "Montane birds including silver pheasants, laughingthrushes, sunbirds and the plateau's endemic greenfinch and laughingthrush; sambar, muntjac, wild boar, martens and pygmy slow lorises in the Bidoup Nui Ba forest; and a rich insect fauna of dragonflies, moths, bees and butterflies around the city's lakes and gardens."},
            {question: "What animals can be found in Da Lat?", answer: "Yellow-cheeked gibbons, black-shanked doucs, lorises, sambar, muntjac, boar, martens, civets, serpent eagles, pheasants and over 200 bird species in Bidoup Nui Ba, plus geckos, skinks, freshwater crabs and insects in and around the city. Users on the plateau log mostly insects."},
            {question: "Is Bidoup Nui Ba worth visiting from Da Lat?", answer: "Yes, especially for birders. It is 50 kilometres from the city, has marked trails from the headquarters and holds most of the plateau's endemic birds plus gibbons and deer. Hire a guide and start at dawn."},
            {question: "What is the best season for wildlife in Da Lat?", answer: "The dry season from December to April has clear mornings and the best birding; it is cool at dawn, often under 12 degrees. Insects peak in the wet months from May to October."}
        ]
    },
    {
        slug: "hanoi",
        name: "Hanoi",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "VN",
        parentSlug: "vietnam",
        coordinate: {lat: 21.0285, lng: 105.8542, zoom: 10},
        captureArea: {bbox: {north: 21.45, south: 20.7, east: 106.15, west: 105.3}},
        title: "Animals in Hanoi: What You Can Spot, Learn, and Collect",
        description: "Hanoi wildlife: softshell turtles and sliders in Hoan Kiem Lake, herons on the Red River, Ba Vi's water dragons, Cuc Phuong's primate centre and Hanoi Zoo's elephants.",
        searchIntents: [
            "animals in Hanoi",
            "wildlife in Hanoi",
            "what animals can be found in Hanoi",
            "what wildlife is there in Hanoi",
            "động vật ở Hà Nội",
            "Hanoi Zoo animals",
            "Hoan Kiem turtle"
        ],
        quickAnswer: "Hanoi is a city of lakes, and the lakes are where its wildlife is: softshell turtles and released red-eared sliders in Hoan Kiem and West Lake, pond herons and night herons on the Red River sandbars, kingfishers along the dikes. Ba Vi National Park an hour west has forest birds and water dragons, and Cuc Phuong, two hours south, has the primate and turtle rescue centres. Hanoi Zoo at Thu Le keeps Asian elephants. Users in the city log hornets, chafer beetles, ants and cockroaches.",
        introduction: [
            "Hanoi's relationship with animals is written into its centre: Hoan Kiem Lake, the heart of the old quarter, was home until 2016 to a giant softshell turtle the city treated as sacred, and the Turtle Tower on its island commemorates the legend of a sword returned to a golden turtle. The lake still has turtles, mostly released sliders and softshells.",
            "Beyond the lakes, the Red River's sandbars and dikes are the city's birding, Ba Vi's forested mountain is the day trip, and the real wild Vietnam of langurs and lorises starts at Cuc Phuong. The everyday list is urban: hornets in the autumn, chafer beetles at lights, ants, geckos and the night-time cockroach."
        ],
        whyItMatters: [
            "Hoan Kiem's turtle, Cu Rua, was one of the last four Rafetus swinhoei on Earth, and its death in 2016 made the species' plight a national story. The search for survivors in Dong Mo lake outside Hanoi continues, and the capital is where Vietnam's turtle conservation is argued about.",
            "Hanoi is also the gateway to the rescue centres at Cuc Phuong that hold animals seized from the wildlife trade. A city visitor who takes the day trip sees the trade's cost directly."
        ],
        animalsToSpot: [
            {speciesSlug: "chinese-softshell-turtle", whyItFits: "Softshells released from markets and temple ceremonies live in Hoan Kiem, West Lake and the city's smaller lakes, surfacing for air with a periscope snout.", rarityHint: "Regular on warm mornings in Hoan Kiem; look for the snout at the surface."},
            {speciesSlug: "red-eared-slider", whyItFits: "The invasive American slider has been released into Hoan Kiem and almost every Hanoi lake in numbers, basking on the stone edges.", rarityHint: "Very common; a conservation problem, not a native."},
            {speciesSlug: "chinese-pond-heron", whyItFits: "Hunts the Red River sandbars, the paddies on the city edge and the lotus ponds of West Lake, turning maroon and white in breeding plumage.", rarityHint: "Common year-round near water."},
            {speciesSlug: "black-crowned-night-heron", whyItFits: "Roosts in the big trees around West Lake and Thu Le park and flies out at dusk over the city to feed on the river.", rarityHint: "Regular at dusk around the lakes."},
            {speciesSlug: "little-egret", whyItFits: "Works the Red River's shallows and the flooded paddies of the Hanoi outskirts in every month.", rarityHint: "Very common on the river edge."},
            {speciesSlug: "common-kingfisher", whyItFits: "Perches on the lotus stems and dike edges around West Lake and along the Red River's side channels.", rarityHint: "Regular with an early start."},
            {speciesSlug: "sooty-headed-bulbul", whyItFits: "The scrubby, crested bulbul of Hanoi's parks, riverside gardens and the Ba Vi foothills.", rarityHint: "Common in parks and gardens."},
            {speciesSlug: "oriental-magpie-robin", whyItFits: "Sings from rooftops and park trees across the old quarter before the traffic starts, Hanoi's best-known city songbird.", rarityHint: "Common at dawn."},
            {speciesSlug: "eurasian-tree-sparrow", whyItFits: "The sparrow of every Hanoi pavement café and bia hoi, nesting in roof tiles across the old quarter.", rarityHint: "Guaranteed."},
            {speciesSlug: "asian-hornet", whyItFits: "The most-logged wild animal by Hanoi users, hunting other insects around fruit stalls and gardens through late summer and autumn.", rarityHint: "Common August to November."},
            {speciesSlug: "green-chafer-beetle", whyItFits: "Metallic green beetles crowd street and balcony lights in Hanoi's warm months and were logged by a user in the city.", rarityHint: "Common at lights from May to September."},
            {speciesSlug: "common-house-gecko", whyItFits: "Patrols the walls of Hanoi's guesthouses and shophouses on warm nights; slower and scarcer in the cool winter.", rarityHint: "Common April to November."},
            {speciesSlug: "chinese-water-dragon", whyItFits: "Lives along the forest streams of Ba Vi National Park an hour west of the city, basking on branches over the water.", rarityHint: "Regular at Ba Vi in warm months."},
            {speciesSlug: "asian-elephant", whyItFits: "Hanoi Zoo in Thu Le park keeps Asian elephants, the subject of a long campaign over their chaining that led to welfare changes in 2023.", rarityHint: "Guaranteed at the zoo; the enclosure is near the main gate."}
        ],
        bestFor: [
            "City-break birding on the Red River dikes and West Lake",
            "Day-trippers to Ba Vi's forest and the Cuc Phuong rescue centres",
            "Turtle-curious visitors who want the Hoan Kiem story and the lake's real reptiles",
            "Urban insect collectors in the warm months: hornets, chafers, cicadas and moths"
        ],
        spottingTips: [
            "Circle Hoan Kiem Lake at 6 am with the tai chi crowd; softshells and sliders surface and bask before the sun gets high.",
            "Walk or cycle the Red River dike north of Long Bien bridge for pond herons, egrets, kingfishers and whatever the sandbars hold that week.",
            "Make Cuc Phuong a full day: the Endangered Primate Rescue Center and Turtle Conservation Centre have set tour times and the forest trails add macaques and water dragons.",
            "In autumn, watch the fruit stalls of the old quarter for hornets; they hunt the flies around the produce and are easy to photograph from a respectful metre."
        ],
        relatedLocationSlugs: ["vietnam", "da-lat", "china", "laos"],
        rankingSlugs: ["most-invasive-species"],
        faq: [
            {question: "What wildlife is there in Hanoi?", answer: "Softshell turtles and released sliders in the lakes, pond herons, night herons, egrets and kingfishers on the Red River and West Lake, magpie-robins, bulbuls and tree sparrows in the parks, and hornets, chafer beetles and geckos in the warm months. Ba Vi adds forest birds and water dragons an hour away."},
            {question: "What animals can be found in Hanoi?", answer: "Around 100 bird species in the city and river, turtles (native softshells and invasive sliders), geckos, toads, bats and a large urban insect fauna; Hanoi Zoo has elephants, tigers, bears and primates; and Cuc Phuong's rescue centres two hours south hold langurs, doucs, lorises and dozens of turtle species."},
            {question: "Is there still a turtle in Hoan Kiem Lake?", answer: "Not the famous one. Cu Rua, the giant softshell that lived in the lake for decades, died in January 2016. The lake now holds released red-eared sliders and Chinese softshell turtles, which you can see surfacing on warm mornings."},
            {question: "Is Hanoi Zoo worth visiting?", answer: "It is an old city zoo in Thu Le park with elephants, big cats and primates, and welfare standards have been criticised. For a better animal day from Hanoi, the Cuc Phuong rescue centres or Ba Vi National Park are the stronger options."}
        ]
    },
    {
        slug: "laos",
        name: "Laos",
        regionType: "country",
        hubRegion: "asia",
        countryCode: "LA",
        coordinate: {lat: 18.5, lng: 103.5, zoom: 6},
        captureArea: {countryCodes: ["LA"]},
        title: "Animals in Laos: What You Can Spot, Learn, and Collect",
        description: "Laos wildlife guide: elephants at Sayaboury, Irrawaddy dolphins at Si Phan Don, rescued bears at Kuang Si, gibbons in Bokeo, doucs in the Annamites, Mekong giant fish.",
        searchIntents: [
            "animals in Laos",
            "wildlife in Laos",
            "what animals can be found in Laos",
            "what wildlife is there in Laos",
            "what animals can you see in Laos",
            "Laos wildlife travel",
            "Mekong dolphins Laos"
        ],
        quickAnswer: "Laos is the most forested country in mainland Southeast Asia and one of the hardest to see wildlife in, because decades of hunting emptied much of it. The reliable encounters are managed ones: Asian elephants at the Elephant Conservation Center in Sayaboury, rescued sun bears and moon bears at the Free the Bears sanctuary beside Kuang Si waterfall, the last Irrawaddy dolphins in the Mekong pool at Si Phan Don in Champasak, and gibbons from the Gibbon Experience treehouses in Bokeo. The Mekong itself holds giant catfish, stingrays and the swamp eels users log in the south.",
        introduction: [
            "Laos has more forest cover than any of its neighbours and the Annamite range along the Vietnam border is one of the richest and least known wildlife areas in Asia, home to saola, red-shanked doucs and the large-antlered muntjac. The problem is that snaring has made most of it silent, and the country's parks have little infrastructure.",
            "That makes Laos a destination for managed and community wildlife rather than safaris. The Elephant Conservation Center, Free the Bears, the Gibbon Experience and the dolphin boats at Don Khon are all built around animals that exist because someone protects them, and they are where visitors see wildlife. The capture record from Champasak is the Mekong's everyday fauna: swamp eels, ants and flies."
        ],
        whyItMatters: [
            "The Mekong's Irrawaddy dolphins are down to a handful in the Laos-Cambodia border pool, and the Don Sahong dam sits a few kilometres upstream. The boat trips from Don Khon may be the last years anyone sees them from the Laos side.",
            "Laos has a few hundred wild elephants left, and the Elephant Conservation Center in Sayaboury is the country's only breeding and release programme. The bear sanctuaries hold animals rescued from bile farms. Visiting these places is what funds them."
        ],
        animalsToSpot: [
            {speciesSlug: "asian-elephant", whyItFits: "The Elephant Conservation Center on Nam Tien lake in Sayaboury rehabilitates and breeds logging elephants for release into Nam Pouy, with wild herds still in the Nam Pouy and Nakai-Nam Theun forests.", rarityHint: "Guaranteed at the ECC with a multi-day stay; wild herds are rarely seen."},
            {speciesSlug: "dolphin", whyItFits: "The last Irrawaddy dolphins in Laos live in the deep Mekong pool below Don Khon in Si Phan Don, where small boats take visitors out at dawn.", rarityHint: "A handful of animals remain; sightings are regular from Don Khon in the dry season but numbers fall every year."},
            {speciesSlug: "asiatic-black-bear", whyItFits: "The Free the Bears sanctuary at Tat Kuang Si waterfall outside Luang Prabang houses dozens of moon bears rescued from the bile trade in forested enclosures.", rarityHint: "Guaranteed at Kuang Si; entry is included with the waterfall ticket."},
            {speciesSlug: "sun-bear", whyItFits: "Sun bears rescued from poachers share the Kuang Si sanctuary and the Free the Bears centre at Luang Prabang, and wild bears persist in the Nam Et-Phou Louey forest.", rarityHint: "Guaranteed at the sanctuaries; wild sightings are exceptional."},
            {speciesSlug: "lar-gibbon", whyItFits: "White-handed gibbons hold on in the far northwest near the Thai border, and the Gibbon Experience treehouses in Nam Kan protect black crested gibbons that sing at dawn.", rarityHint: "Gibbons are heard most mornings at Nam Kan; seeing any species takes luck."},
            {speciesSlug: "red-shanked-douc", whyItFits: "Doucs live in the Annamite forests of central Laos, including Phou Hin Boun and the Nakai-Nam Theun watershed, more numerous here than in Vietnam.", rarityHint: "Rare without a specialist guide; Nakai-Nam Theun community treks are the best route."},
            {speciesSlug: "pygmy-slow-loris", whyItFits: "A nocturnal primate of the Lao forests, often seen in confiscation at the Luang Prabang wildlife centre and occasionally on night walks in Nam Et-Phou Louey.", rarityHint: "Rare in the wild; the Nam Nern night safari offers a slim chance."},
            {speciesSlug: "sambar-deer", whyItFits: "Sambar are the main animal seen on the Nam Nern night safari boats in Nam Et-Phou Louey, eyes glowing on the riverbank.", rarityHint: "Regular on the Nam Nern boats."},
            {speciesSlug: "indian-muntjac", whyItFits: "Barking deer are heard across the Lao hills and seen on the Nam Nern river at night and along Phou Khao Khouay's trails.", rarityHint: "Heard often; seen occasionally."},
            {speciesSlug: "giant-freshwater-stingray", whyItFits: "The Mekong around Pakse and Si Phan Don holds some of the largest freshwater fish on Earth, and stingrays over two metres are landed by fishermen.", rarityHint: "Seen mainly at fish markets and landing sites, not in the water."},
            {speciesSlug: "asian-swamp-eel", whyItFits: "Lives in the paddies and ponds of Champasak and was logged by a user there; a staple of every Lao wet market.", rarityHint: "Common in paddies and markets across the south."},
            {speciesSlug: "water-monitor", whyItFits: "Monitors patrol the Mekong's banks and islands at Si Phan Don and the Vang Vieng river edges.", rarityHint: "Common near water."},
            {speciesSlug: "tokay-gecko", whyItFits: "The barking tokay lives in every guesthouse roof from Luang Prabang to Pakse and calls through the night.", rarityHint: "Heard nightly; seen with a torch."},
            {speciesSlug: "red-junglefowl", whyItFits: "Wild chickens crow from the forest edges of Phou Khao Khouay and the Bolaven plateau and cross the roads at dawn.", rarityHint: "Common on quiet rural roads early in the day."}
        ],
        bestFor: [
            "Ethical elephant encounters with a multi-day stay at the Sayaboury centre",
            "Travelers combining Luang Prabang's temples with Kuang Si's bears",
            "Adventure travellers sleeping in the Bokeo gibbon treehouses",
            "Mekong river trips at Si Phan Don for dolphins, monitors and giant fish"
        ],
        spottingTips: [
            "Book the Elephant Conservation Center for at least two nights; the day trips see the elephants bathing, the longer stays see the herd behaviour and the release forest.",
            "At Si Phan Don, take the dolphin boat from Don Khon at 7 am in the dry season when the water is low and the pool is calm.",
            "Visit the Kuang Si bear sanctuary before the waterfall crowds arrive at mid-morning; the bears are fed and active early.",
            "The Nam Nern night safari in Nam Et-Phou Louey is the only true wildlife safari in Laos: a boat drift at night with a spotlight for sambar, civets, owls and occasionally cats."
        ],
        relatedLocationSlugs: ["vietnam", "cambodia", "thailand", "chiang-mai"],
        rankingSlugs: ["rarest-animals"],
        challengeSlugs: ["elephant-vs-rhino"],
        faq: [
            {question: "What wildlife is there in Laos?", answer: "Asian elephants, sun and moon bears, gibbons, doucs, lorises, sambar, muntjac and civets in the forests, with tigers no longer confirmed; Irrawaddy dolphins and giant fish in the Mekong; and monitors, tokays, junglefowl and swamp eels in every village. Most reliable sightings are at the Sayaboury elephant centre, the Kuang Si bear sanctuary, the Nam Kan gibbon treehouses and the Don Khon dolphin pool."},
            {question: "What animals can be found in Laos?", answer: "Around 200 mammals including elephant, gaur, banteng, saola, doucs, gibbons and bears, 700 birds, and the Mekong's giant catfish, stingrays and dolphins. Everyday animals are tokay geckos, monitors, swamp eels, junglefowl, ants and flies, which is what Champasak users log."},
            {question: "Can you still see dolphins in Laos?", answer: "Yes, barely. A handful of Irrawaddy dolphins survive in the Mekong pool between Don Khon and the Cambodian border, and dry-season boat trips from Don Khon see them regularly. The population is critically low and the Don Sahong dam threatens it."},
            {question: "Are elephant rides in Laos ethical?", answer: "No. Choose observation-based programmes: the Elephant Conservation Center in Sayaboury and MandaLao near Luang Prabang are walking and watching only, and the ECC is the country's only breeding and release project."}
        ]
    },
    {
        slug: "cambodia",
        name: "Cambodia",
        regionType: "country",
        hubRegion: "asia",
        countryCode: "KH",
        coordinate: {lat: 12.5657, lng: 104.991, zoom: 6},
        captureArea: {countryCodes: ["KH"]},
        title: "Animals in Cambodia: What You Can Spot, Learn, and Collect",
        description: "Cambodia wildlife guide: giant ibis in the northern plains, Tonle Sap's stork colonies at Prek Toal, Irrawaddy dolphins at Kratie, Angkor macaques, Mondulkiri elephants.",
        searchIntents: [
            "animals in Cambodia",
            "wildlife in Cambodia",
            "what animals can be found in Cambodia",
            "what wildlife is there in Cambodia",
            "what animals can you see in Cambodia",
            "Tonle Sap birds",
            "Cambodia wildlife travel"
        ],
        quickAnswer: "Cambodia is Southeast Asia's great waterbird country and its last refuge for several huge, odd birds: the giant ibis, the greater adjutant and the sarus crane all hang on in the northern plains and the Tonle Sap floodplain. Prek Toal on the lake has Asia's largest stork and pelican colonies, Kratie has the Mekong's Irrawaddy dolphins, Angkor's temples have macaques in the ruins, Mondulkiri has elephant sanctuaries and the Cardamom mountains hold Siamese crocodiles and fishing cats.",
        introduction: [
            "The Tonle Sap is the engine of Cambodian wildlife. The lake swells five times each monsoon and shrinks back, and that pulse feeds the fish, the birds and the people. Prek Toal, a flooded forest on its northwest shore, holds the biggest breeding colonies of storks, pelicans and ibises left in Southeast Asia.",
            "North of the lake, the dry deciduous forests of Preah Vihear and the Kulen Promtep sanctuary are where the giant ibis survives, found by the village guides of Tmatboey. Add the Mekong's dolphins at Kratie, the macaques and bats of Angkor and the Cardamoms' rediscovered fishing cats, and Cambodia is a far better wildlife destination than most visitors realise."
        ],
        whyItMatters: [
            "The giant ibis is Cambodia's national bird and has perhaps 200 individuals left, nearly all here. The Tmatboey ecotourism model, where village guides are paid when visitors see the bird, is one of the clearest success stories in Asian conservation.",
            "Cambodia's Irrawaddy dolphins number fewer than 100 in the Mekong, and Phnom Tamao outside Phnom Penh holds thousands of animals seized from the wildlife trade. Seeing both shows what the country is fighting for and against."
        ],
        animalsToSpot: [
            {speciesSlug: "giant-ibis", whyItFits: "Cambodia's national bird, with most of the world's remaining 200 birds in the dry forests of Kulen Promtep, found with Tmatboey's village guides at forest pools before dawn.", rarityHint: "Reliable at Tmatboey with guides between December and April; the only other birds are a handful in southern Laos."},
            {speciesSlug: "greater-adjutant", whyItFits: "The huge bald-headed stork breeds at Prek Toal on the Tonle Sap, one of only a handful of breeding populations left in the world.", rarityHint: "Regular at Prek Toal from December to March."},
            {speciesSlug: "painted-stork", whyItFits: "Thousands nest in the flooded forest at Prek Toal, pink-and-white against the drowned trees, the colony's most numerous large bird.", rarityHint: "Abundant at Prek Toal in the dry season."},
            {speciesSlug: "lesser-adjutant-stork", whyItFits: "Breeds at Prek Toal alongside the greater adjutant and feeds across the Tonle Sap's receding floodplain.", rarityHint: "Common on the lake in the dry season."},
            {speciesSlug: "sarus-crane", whyItFits: "Southeast Asia's largest crane population winters at Ang Trapeang Thmor reservoir near Siem Reap and in the Mekong delta's Boeung Prek Lapouv.", rarityHint: "Reliable at Ang Trapeang Thmor from January to April."},
            {speciesSlug: "dolphin", whyItFits: "Irrawaddy dolphins live in the deep Mekong pools at Kampi near Kratie, where boats go out morning and evening, with fewer than 100 left in the river.", rarityHint: "Regular at Kampi; sightings are of rolling backs and blows, not leaps."},
            {speciesSlug: "asian-elephant", whyItFits: "Mondulkiri's Elephant Valley Project and Mondulkiri Project let retired working elephants roam forest while visitors walk with them, and wild herds persist in Keo Seima and the Cardamoms.", rarityHint: "Guaranteed at the Mondulkiri sanctuaries; wild sightings are rare."},
            {speciesSlug: "banteng", whyItFits: "Cambodia's eastern plains hold the world's largest remaining banteng population, grazing the dry forest of Srepok and Phnom Prich wildlife sanctuaries.", rarityHint: "Regular on dawn drives at Srepok's safari camp in the dry season."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "Troops roam the Angkor Thom causeway and Bayon ruins, picking through offerings and tourists' bags.", rarityHint: "Guaranteed at Angkor."},
            {speciesSlug: "northern-pig-tailed-macaque", whyItFits: "Stockier macaques forage in the forest around Ta Prohm and Angkor's less-visited temples, alongside the long-tails.", rarityHint: "Regular in Angkor's forest at the quieter temples."},
            {speciesSlug: "siamese-crocodile", whyItFits: "The Cardamom mountains hold the largest wild population of this critically endangered crocodile, and Fauna & Flora's breeding programme releases young into the Areng valley.", rarityHint: "Rare in the wild; Phnom Tamao's rescue centre has them for certain."},
            {speciesSlug: "fishing-cat", whyItFits: "Rediscovered in the Peam Krasop mangroves near Koh Kong in 2015, where camera traps now record a small population hunting the tidal creeks.", rarityHint: "Very rare; mangrove night boat trips from Koh Kong give a slim chance."},
            {speciesSlug: "sun-bear", whyItFits: "The Free the Bears sanctuary at Phnom Tamao Wildlife Rescue Centre outside Phnom Penh holds the world's largest group of rescued sun bears.", rarityHint: "Guaranteed at Phnom Tamao."},
            {speciesSlug: "tokay-gecko", whyItFits: "The tokay barks from Angkor's temple walls and every guesthouse roof in Siem Reap after dark.", rarityHint: "Heard nightly; found with a torch."}
        ],
        bestFor: [
            "Birders: giant ibis, adjutants, cranes and the Prek Toal colonies in one trip",
            "Angkor visitors adding macaques, bats and the Tonle Sap's birds to the temples",
            "Ethical elephant walking at the Mondulkiri sanctuaries",
            "Mekong travelers seeing Irrawaddy dolphins at Kratie"
        ],
        spottingTips: [
            "Book Tmatboey through the Sam Veasna Conservation Tours office in Siem Reap; the village guides stake out the ibis roost pools and you leave before 5 am.",
            "Prek Toal is a half-day boat trip from Siem Reap in the dry season (December to March); go with a Sam Veasna or Osmose guide who can enter the core colony area.",
            "At Kratie, take the Kampi dolphin boat in the last two hours of light when the river is calm and the dolphins surface close to the boats.",
            "Visit Angkor's quieter temples (Ta Nei, Preah Khan) at dawn for pig-tailed macaques, hornbills and the fruit bats leaving the big trees."
        ],
        relatedLocationSlugs: ["vietnam", "laos", "thailand", "bangkok"],
        rankingSlugs: ["rarest-animals", "biggest-animals"],
        challengeSlugs: ["elephant-vs-rhino"],
        faq: [
            {question: "What wildlife is there in Cambodia?", answer: "Giant ibis, greater and lesser adjutants, painted storks, pelicans and sarus cranes in the northern plains and on the Tonle Sap; Irrawaddy dolphins at Kratie; elephants and banteng in the eastern plains; Siamese crocodiles and fishing cats in the Cardamoms and coastal mangroves; and macaques, bats and tokays at Angkor."},
            {question: "What animals can be found in Cambodia?", answer: "Around 130 mammals including elephant, banteng, gaur, leopard, dhole, sun bear, gibbons and silvered langurs, over 500 birds including some of the world's rarest waterbirds, and reptiles from Siamese crocodiles to pythons. Everyday species are macaques, geckos, mynas, egrets and paddy insects."},
            {question: "Where is the best birdwatching in Cambodia?", answer: "Prek Toal on the Tonle Sap for the stork and pelican colonies, Tmatboey for giant and white-shouldered ibis, and Ang Trapeang Thmor for sarus cranes, all within a few hours of Siem Reap and best from December to March."},
            {question: "Can you see dolphins in Cambodia?", answer: "Yes, at Kampi near Kratie on the Mekong, where small boats visit the deep pool the Irrawaddy dolphins use. Fewer than 100 remain in the river, so the trip is a privilege; morning and late afternoon are best."}
        ]
    },
    {
        slug: "chiang-mai",
        name: "Chiang Mai",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "TH",
        parentSlug: "thailand",
        coordinate: {lat: 18.7883, lng: 98.9853, zoom: 10},
        captureArea: {bbox: {north: 19.25, south: 18.3, east: 99.35, west: 98.3}},
        title: "Animals in Chiang Mai: What You Can Spot, Learn, and Collect",
        description: "Chiang Mai wildlife: Doi Inthanon's pheasants and montane birds, ethical elephant sanctuaries in Mae Taeng, Doi Suthep's forest, the Night Safari and city geckos.",
        searchIntents: [
            "animals in Chiang Mai",
            "wildlife in Chiang Mai",
            "what animals can be found in Chiang Mai",
            "what wildlife is there in Chiang Mai",
            "สัตว์ในเชียงใหม่",
            "Doi Inthanon birds",
            "Chiang Mai elephant sanctuary"
        ],
        quickAnswer: "Chiang Mai is northern Thailand's wildlife base. Doi Inthanon, Thailand's highest mountain, has montane birds found nowhere else in the country, silver pheasants and serpent eagles on its slopes; the Mae Taeng and Mae Wang valleys hold the ethical elephant sanctuaries; Doi Suthep's forest rises straight from the city with squirrels, macaques and barbets; and the Night Safari and Chiang Mai Zoo cover the big cats. In town, users log house geckos, mynas, sun skinks, snails and the Finlayson's squirrels in the temple trees.",
        introduction: [
            "Chiang Mai sits in a valley ringed by forested mountains, and the wildlife starts at the city's edge. Doi Suthep-Pui National Park begins behind the university, Doi Inthanon is a 90-minute drive, and the Mae Taeng valley north of town has become the centre of Thailand's shift from elephant riding to elephant watching.",
            "The city itself is leafy and the AnimalDex capture record shows it: house geckos on guesthouse walls, mynas and tree sparrows in the old-city squares, sun skinks on temple steps and Finlayson's squirrels, pale and bold, in the trees along the moat."
        ],
        whyItMatters: [
            "Chiang Mai is where Thailand's elephant tourism changed. Elephant Nature Park and the sanctuaries that followed it proved that observation pays as well as riding, and the choices visitors make here still shape the industry.",
            "Doi Inthanon's summit bog and cloud forest are a Himalayan outpost at the edge of the tropics, and climate change is pushing its birds uphill with nowhere left to go. The mountain is one of Thailand's most-watched birding sites for that reason."
        ],
        animalsToSpot: [
            {speciesSlug: "asian-elephant", whyItFits: "Elephant Nature Park and a cluster of observation-only sanctuaries in the Mae Taeng and Mae Wang valleys care for rescued logging and trekking elephants; a user logged one here.", rarityHint: "Guaranteed at the sanctuaries; wild elephants live in Doi Inthanon's far forests but are rarely seen."},
            {speciesSlug: "silver-pheasant", whyItFits: "Silver pheasants cross the roadside and the summit trails on Doi Inthanon, especially at the Kew Mae Pan trailhead at dawn.", rarityHint: "Regular at dawn on Inthanon's upper roads."},
            {speciesSlug: "common-green-magpie", whyItFits: "A brilliant green, red-billed magpie of Doi Inthanon's evergreen forest and Doi Suthep's upper slopes, loud and skulking.", rarityHint: "Uncommon; the Inthanon campsite area and Doi Pui are the spots."},
            {speciesSlug: "crested-serpent-eagle", whyItFits: "Soars over Doi Suthep and the Mae Sa valley calling a loud whistle, the commonest big raptor around the city.", rarityHint: "Regular overhead on clear mornings."},
            {speciesSlug: "finlaysons-squirrel", whyItFits: "The pale, variable squirrel of Chiang Mai's temple groves and parks, logged by a user in the city, often almost white in the north.", rarityHint: "Common in the old city's trees and at Doi Suthep temple."},
            {speciesSlug: "red-junglefowl", whyItFits: "Wild chickens crow from the forest edge on Doi Suthep and Doi Inthanon's lower slopes and cross the park roads at dawn.", rarityHint: "Regular on quiet park roads early."},
            {speciesSlug: "chinese-pond-heron", whyItFits: "Stands in the paddies of the Chiang Mai valley and along the Ping River through the northern winter, turning maroon by spring.", rarityHint: "Common October to April near water."},
            {speciesSlug: "common-kingfisher", whyItFits: "Hunts the streams at Huay Tung Tao lake and the Mae Sa and Mae Klang waterfalls.", rarityHint: "Regular along clear water."},
            {speciesSlug: "common-myna", whyItFits: "Among the most-logged birds by Chiang Mai users, strutting across the old city's squares and night-market tables.", rarityHint: "Guaranteed."},
            {speciesSlug: "common-sun-skink", whyItFits: "Basks on temple steps and garden walls across the city and was logged by a user in the centre.", rarityHint: "Very common by day."},
            {speciesSlug: "common-house-gecko", whyItFits: "The most-logged animal in Chiang Mai's captures, on every guesthouse wall and lamp after dark.", rarityHint: "Guaranteed."},
            {speciesSlug: "tokay-gecko", whyItFits: "The big spotted tokay calls from old wooden houses and temple eaves across Chiang Mai through the night.", rarityHint: "Heard nightly; seen with a torch."},
            {speciesSlug: "giant-asian-mantis", whyItFits: "Big green mantises hunt on garden shrubs in the city's suburbs and around the lights at Huay Tung Tao.", rarityHint: "Common in the wet season."},
            {speciesSlug: "tiger", whyItFits: "Chiang Mai Night Safari and Chiang Mai Zoo keep tigers among their big cats, viewed from trams after dark at the Night Safari; captive animals, not wild.", rarityHint: "Guaranteed at the Night Safari; skip the roadside 'tiger kingdom' photo operations."}
        ],
        bestFor: [
            "Travelers who want an ethical elephant day in the Mae Taeng valley",
            "Birders doing Doi Inthanon and Doi Suthep for Thailand's montane specialities",
            "Families: Chiang Mai Zoo, Night Safari and Huay Tung Tao lake",
            "Collectors logging geckos, skinks, squirrels and mantises in the old city"
        ],
        spottingTips: [
            "Choose an elephant sanctuary that forbids riding and bathing with elephants; Elephant Nature Park and the observation-only projects around Mae Taeng are the benchmark.",
            "Drive to the Kew Mae Pan trailhead on Doi Inthanon before sunrise; pheasants on the road, laughingthrushes on the boardwalk and the summit bog's birds all in the first two hours.",
            "Walk the forest road above Wat Phra That Doi Suthep at 7 am for green magpies, barbets, squirrels and serpent eagles.",
            "The old city's temple trees hold Finlayson's squirrels and sunbirds in the early morning before the tuk-tuk traffic builds."
        ],
        relatedLocationSlugs: ["thailand", "bangkok", "laos"],
        rankingSlugs: ["smartest-animals"],
        challengeSlugs: ["tiger-vs-lion"],
        faq: [
            {question: "What wildlife is there in Chiang Mai?", answer: "Rescued elephants at the Mae Taeng and Mae Wang sanctuaries; montane birds including silver pheasants, green magpies and laughingthrushes on Doi Inthanon and Doi Suthep; squirrels, macaques, junglefowl and serpent eagles in the park forests; and geckos, skinks, mynas and mantises across the city."},
            {question: "What animals can be found in Chiang Mai?", answer: "Elephants (in sanctuaries), gibbons and macaques, Finlayson's squirrels, barking deer, civets, over 380 bird species on Doi Inthanon alone, tokay and house geckos, sun skinks and a large insect fauna. Tigers and other big cats are at the Night Safari and Chiang Mai Zoo."},
            {question: "Which elephant sanctuary in Chiang Mai is ethical?", answer: "Look for no riding, no bathing and no shows. Elephant Nature Park in Mae Taeng set the standard, and several observation-only projects in Mae Wang and Mae Taeng follow it. Avoid any camp that offers rides or painting."},
            {question: "Is Doi Inthanon good for wildlife?", answer: "Yes, mainly for birds. Thailand's highest mountain has species found nowhere else in the country, from pheasants to summit-bog laughingthrushes, plus waterfalls with kingfishers and forktails. Arrive at dawn and hire a local bird guide for the best results."}
        ]
    },
    {
        slug: "bangkok",
        name: "Bangkok",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "TH",
        parentSlug: "thailand",
        coordinate: {lat: 13.7563, lng: 100.5018, zoom: 10},
        captureArea: {bbox: {north: 14.05, south: 13.45, east: 100.95, west: 100.25}},
        title: "Animals in Bangkok: What You Can Spot, Learn, and Collect",
        description: "Bangkok wildlife: giant water monitors in Lumphini Park, Bang Krachao's kingfishers and otters, mudskippers at Bang Khun Thian, Samut Prakan's crocodile farm.",
        searchIntents: [
            "animals in Bangkok",
            "wildlife in Bangkok",
            "what animals can be found in Bangkok",
            "what wildlife is there in Bangkok",
            "สัตว์ในกรุงเทพ",
            "Lumphini Park monitor lizards",
            "Bang Krachao wildlife"
        ],
        quickAnswer: "Bangkok's most famous wild animals are the two-metre water monitors that cruise the lakes of Lumphini Park in the business district. Beyond them, Bang Krachao, the forested river bend across from the city, has kingfishers, orioles and fruit bats; the Bang Khun Thian mangroves on the Gulf have mudskippers, crabs and otters; Samut Prakan has the world's largest crocodile farm; and Safari World covers the zoo list. Mynas, tree sparrows, pied fantails, house geckos and tokays live in every soi.",
        introduction: [
            "Bangkok was built on a river delta and never entirely stopped being one. Canals, temple ponds and the big parks hold monitors, softshell turtles and herons, and the undeveloped river bend of Bang Krachao, a 20-minute ferry from the city, still feels like the orchard country the whole city once was.",
            "The city's southern edge meets the Gulf of Thailand at Bang Khun Thian, where a mangrove fringe and boardwalk hold mudskippers, fiddler crabs and the occasional otter. The AnimalDex capture record from Bangkok and Samut Prakan is urban: geckos, doves, termites after rain and the pet birds of the Chatuchak market."
        ],
        whyItMatters: [
            "Lumphini's monitors are a global example of a big predator thriving in a city centre, and a 2016 plan to clear them out ended with a few dozen relocated and the rest left alone after public affection won out. They are the easiest big reptile encounter in Asia.",
            "Bang Krachao is under constant development pressure, and the mangroves at Bang Khun Thian are retreating with coastal erosion. Logging what lives there is part of the argument for keeping both."
        ],
        animalsToSpot: [
            {speciesSlug: "water-monitor", whyItFits: "Lumphini Park's lakes hold hundreds of monitors up to two metres long, swimming past joggers and basking on the lawns; Benjakitti Park next door has them too.", rarityHint: "Guaranteed at Lumphini on any sunny day."},
            {speciesSlug: "smooth-coated-otter", whyItFits: "Otters fish the canals of Bang Krachao and the mangrove creeks at Bang Khun Thian, surfacing at dawn before the boat traffic.", rarityHint: "Uncommon; early mornings at Bang Krachao's Sri Nakhon Khuean Khan park give a chance."},
            {speciesSlug: "mudskipper", whyItFits: "Thousands skip across the mud below the Bang Khun Thian mangrove boardwalk at low tide, flagging fins at each other.", rarityHint: "Abundant at low tide."},
            {speciesSlug: "fiddler-crab", whyItFits: "Male fiddlers wave oversized claws on the Bang Khun Thian and Bang Pu mudflats as the tide drops.", rarityHint: "Abundant on exposed mud."},
            {speciesSlug: "black-naped-oriole", whyItFits: "Fluting yellow orioles move through the fruit trees of Bang Krachao and the big trees of Lumphini and Rot Fai parks.", rarityHint: "Common in the leafier parks."},
            {speciesSlug: "white-throated-kingfisher", whyItFits: "Perches on wires over Bang Krachao's canals and the Bang Khun Thian shrimp ponds, laughing loudly.", rarityHint: "Common near water across the city's edges."},
            {speciesSlug: "pied-fantail", whyItFits: "The fantail scolds and dances in every Bangkok garden hedge and temple compound, one of the city's most visible birds.", rarityHint: "Very common."},
            {speciesSlug: "black-crowned-night-heron", whyItFits: "Roosts in the trees around the Dusit Zoo site and Lumphini and flies out at dusk over the canals.", rarityHint: "Regular at dusk near park lakes."},
            {speciesSlug: "fruit-bat", whyItFits: "Thousands of Lyle's flying foxes roost in the temple trees at Wat Pho Bang Khla in Chachoengsao, an hour east, and fruit bats forage over Bang Krachao's orchards at night.", rarityHint: "Guaranteed at the Bang Khla temple roost by day."},
            {speciesSlug: "javan-myna", whyItFits: "The white-vented, dark myna that shares Bangkok's pavements with the common myna, logged by users across the city.", rarityHint: "Very common."},
            {speciesSlug: "spotted-dove", whyItFits: "Coos from wires and temple roofs across Bangkok and Samut Prakan, logged by users in the southern suburbs.", rarityHint: "Guaranteed."},
            {speciesSlug: "chinese-softshell-turtle", whyItFits: "Softshells released as merit live in temple ponds and Lumphini's lakes, surfacing beside the monitors.", rarityHint: "Regular in temple ponds and park lakes."},
            {speciesSlug: "tokay-gecko", whyItFits: "The tokay's bark carries from old shophouses and temple eaves across the city after dark.", rarityHint: "Heard nightly in older neighbourhoods."},
            {speciesSlug: "siamese-crocodile", whyItFits: "The Samut Prakan Crocodile Farm south of the city holds tens of thousands of crocodiles, mostly Siamese and saltwater hybrids, and is where the species was first farmed; a commercial farm, not a wild site.", rarityHint: "Guaranteed at the farm; wild Siamese crocodiles are confined to a few remote parks."}
        ],
        bestFor: [
            "Travelers who want a wild big reptile in the middle of a megacity",
            "Cyclists exploring Bang Krachao's orchards and canals for birds and otters",
            "Families: Safari World, the crocodile farm and Lumphini's monitors",
            "Mangrove and mudflat collectors at Bang Khun Thian and Bang Pu"
        ],
        spottingTips: [
            "Walk Lumphini's lake loop between 9 and 11 am when the monitors haul out to bask on the grass; they are shy of direct approach but tolerate a few metres.",
            "Take the ferry from Khlong Toei to Bang Krachao early on a weekday and cycle to Sri Nakhon Khuean Khan park; orioles, kingfishers and the chance of otters before the weekend crowds.",
            "Check tide tables for Bang Khun Thian and arrive two hours before low water for mudskippers, fiddler crabs and shorebirds.",
            "Bang Pu recreation area in Samut Prakan is Bangkok's best winter birding, with gulls, terns and waders from November to March."
        ],
        relatedLocationSlugs: ["thailand", "chiang-mai", "cambodia", "singapore"],
        rankingSlugs: ["most-adaptable-animals", "biggest-animals"],
        challengeSlugs: ["crocodile-vs-alligator"],
        faq: [
            {question: "What wildlife is there in Bangkok?", answer: "Giant water monitors in Lumphini and Benjakitti parks, softshell turtles in temple ponds, otters and orioles at Bang Krachao, mudskippers, crabs and shorebirds in the Bang Khun Thian and Bang Pu mangroves, flying foxes at Bang Khla, and mynas, fantails, doves, geckos and tokays throughout the city."},
            {question: "What animals can be found in Bangkok?", answer: "Water monitors, softshell turtles, smooth-coated otters, flying foxes, kingfishers, orioles, herons, fantails, mynas, doves, house and tokay geckos, mudskippers and fiddler crabs in the wild; Safari World and the Samut Prakan crocodile farm add tigers, giraffes and thousands of crocodiles."},
            {question: "Are the monitor lizards in Lumphini Park dangerous?", answer: "No. They are shy scavengers that eat fish, turtles, birds and carrion and move away from people. Give them space, keep dogs leashed and never feed them; bites are almost unheard of."},
            {question: "Is Bang Krachao worth visiting for wildlife?", answer: "Yes. The 'green lung' across the river has orchards, canals and a public park with a bird hide, and a morning cycle produces kingfishers, orioles, herons, monitors and sometimes otters. It is a 20-minute trip from the Khlong Toei pier."}
        ]
    },
    {
        slug: "south-korea",
        name: "South Korea",
        regionType: "country",
        hubRegion: "asia",
        countryCode: "KR",
        coordinate: {lat: 36.5, lng: 127.8, zoom: 6},
        captureArea: {countryCodes: ["KR"]},
        title: "Animals in South Korea: What You Can Spot, Learn, and Collect",
        description: "South Korea wildlife guide: red-crowned cranes and vultures at Cheorwon, water deer and raccoon dogs in the hills, Jeju's roe deer, Jirisan's bears, Seoul's tigers.",
        searchIntents: [
            "animals in South Korea",
            "wildlife in South Korea",
            "what animals can be found in South Korea",
            "what wildlife is there in South Korea",
            "what animals can you see in Korea",
            "한국의 동물",
            "Korea wildlife travel"
        ],
        quickAnswer: "South Korea's wildlife is winter wildlife. Red-crowned and white-naped cranes feed in the Cheorwon rice stubble inside the civilian control zone, cinereous vultures drift down from Mongolia to Paju and Goseong, and whooper swans and mandarin ducks fill the rivers. Water deer bark in every hillside, raccoon dogs cross the suburbs at night, Jeju has roe deer on Hallasan, and Jirisan's reintroduced Asiatic black bears number over 80. Seoul Grand Park keeps Siberian tigers and Amur leopards.",
        introduction: [
            "Korea's mountains cover 70 percent of the country and were stripped of large animals by the mid-20th century, but the forest grew back and the small and medium mammals came with it. Water deer, a tusked, dog-sized deer found only here and in China, are now so common they are a traffic hazard, and raccoon dogs live inside Seoul's parks.",
            "The DMZ borderlands are the other story. Seventy years without farming turned the strip into an accidental reserve, and the civilian control zone beside it at Cheorwon is where the cranes winter. Add Suncheon Bay's reedbeds for hooded cranes and the islands for migrating songbirds, and Korea rewards a cold-season trip."
        ],
        whyItMatters: [
            "The Jirisan bear reintroduction, begun in 2004 with animals from Russia and North Korea, has passed 80 wild bears and is one of Asia's most successful large-carnivore recoveries. It also raises the question of what happens as bears spread into farmland.",
            "Cheorwon hosts a significant share of the world's red-crowned cranes each winter in fields that could be developed the moment the border opens. Counts and photographs from the civilian control zone are the record conservationists use."
        ],
        animalsToSpot: [
            {speciesSlug: "red-crowned-crane", whyItFits: "Hundreds of the world's rarest cranes winter in the rice stubble of the Cheorwon plain inside the civilian control zone, viewed from guided buses and hides.", rarityHint: "Reliable at Cheorwon from November to February with a permit tour."},
            {speciesSlug: "cinereous-vulture", whyItFits: "Europe's largest vulture arrives from Mongolia each winter to feeding stations at Paju and Goseong, hundreds at a time.", rarityHint: "Regular at the winter feeding sites from December to February."},
            {speciesSlug: "whooper-swan", whyItFits: "Flocks winter on the Nakdong estuary, Junam reservoir and the Cheonsu Bay reclaimed fields, trumpeting across the water.", rarityHint: "Common at the big wetlands in winter."},
            {speciesSlug: "mandarin-duck", whyItFits: "Korea's natural monument duck breeds in tree holes along mountain streams and winters on rivers in Seoul, including the Cheonggyecheon and Jungnangcheon.", rarityHint: "Regular on Seoul's streams in winter; look for the drakes' orange sails."},
            {speciesSlug: "water-deer", whyItFits: "The tusked, antlerless deer barks from reedbeds and hillsides across the country and is the mammal Koreans see most, often as roadkill.", rarityHint: "Very common; dawn and dusk on any rural road or riverside path."},
            {speciesSlug: "raccoon-dog", whyItFits: "Raccoon dogs live in Seoul's larger parks and hills, from Namsan to the Han River banks, and trot across suburban roads after dark.", rarityHint: "Regular at night in the city's green spaces."},
            {speciesSlug: "leopard-cat", whyItFits: "Korea's only surviving wild cat lives in every mainland national park and the DMZ borderlands, hunting rodents on paddy edges and forest margins after dark.", rarityHint: "Rarely seen; camera traps and roadside sightings at night are the usual record."},
            {speciesSlug: "asiatic-black-bear", whyItFits: "The reintroduced Jirisan population now exceeds 80 bears roaming the national park's ridges, with occasional sightings on the trails.", rarityHint: "Rare to see; claw-marked trees and park warnings are common on Jirisan."},
            {speciesSlug: "yellow-throated-marten", whyItFits: "Big, bold martens hunt in groups through Jirisan, Odaesan and Seoraksan forests and sometimes along the trails in daylight.", rarityHint: "Uncommon but conspicuous; mountain trails at dawn."},
            {speciesSlug: "wild-boar", whyItFits: "Boar have expanded into Seoul's hills and suburbs, and signs in Bukhansan warn hikers about them.", rarityHint: "Common in the hills; dusk encounters on the Bukhansan trails happen."},
            {speciesSlug: "eurasian-magpie", whyItFits: "Korea's national bird and the loudest presence in every city park and village, nesting in the plane trees along Seoul's boulevards.", rarityHint: "Guaranteed."},
            {speciesSlug: "korean-rat-snake", whyItFits: "A big, harmless snake of rice paddies, stone walls and temple grounds across the peninsula, active from April to October.", rarityHint: "Occasional; warm mornings on paddy dikes and temple walls."},
            {speciesSlug: "oriental-fire-bellied-toad", whyItFits: "Green-backed, red-bellied toads breed in mountain pools and paddy ditches across the country each spring.", rarityHint: "Common April to June in still water."},
            {speciesSlug: "tiger", whyItFits: "Seoul Grand Park zoo in Gwacheon keeps Siberian tigers, the national symbol that vanished from the wild peninsula a century ago; captive animals only.", rarityHint: "Guaranteed at Seoul Grand Park; none in the wild."}
        ],
        bestFor: [
            "Winter birders: cranes, vultures, swans and ducks at Cheorwon, Paju and Suncheon",
            "Hikers logging water deer, boar and martens in the national parks",
            "Jeju travelers adding roe deer and seabirds to the volcano and beaches",
            "City visitors seeing mandarin ducks and raccoon dogs inside Seoul"
        ],
        spottingTips: [
            "Cheorwon crane tours need a permit and run from the Cheorwon tourist office; book for a December or January morning when the cranes feed close to the road.",
            "Walk the Cheonggyecheon and Jungnangcheon streams in Seoul on a cold morning for mandarin ducks, egrets and night herons among the commuters.",
            "Jeju's eastern oreum hills and the Hallasan Yeongsil trail are the best roe deer ground; go at first light before the tour buses.",
            "In the national parks, carry bells or talk on remote Jirisan trails; the bears are shy but the park asks hikers to make noise."
        ],
        relatedLocationSlugs: ["japan", "china", "russia"],
        rankingSlugs: ["most-resilient-animals"],
        challengeSlugs: ["bear-vs-tiger", "tiger-vs-leopard"],
        faq: [
            {question: "What wildlife is there in South Korea?", answer: "Red-crowned, white-naped and hooded cranes, cinereous vultures, whooper swans and mandarin ducks in winter; water deer, roe deer, raccoon dogs, wild boar, martens and reintroduced Asiatic black bears in the mountains; magpies everywhere; and rat snakes and fire-bellied toads in the paddies. Siberian tigers and Amur leopards are at Seoul Grand Park."},
            {question: "What animals can be found in South Korea?", answer: "Around 80 mammals including water deer, roe deer, boar, raccoon dog, Asiatic black bear, yellow-throated marten and leopard cat; over 500 bird species, many of them migrants; and amphibians and reptiles from fire-bellied toads to Korean rat snakes. Tigers and leopards are extinct in the wild here."},
            {question: "When is the best time for wildlife in Korea?", answer: "Winter, from November to February, for the cranes, vultures and waterfowl that make Korea special. Spring (April to May) is best for migrating songbirds on the west-coast islands and for frogs and snakes emerging in the paddies."},
            {question: "Can you see wild animals in Seoul?", answer: "Yes. Raccoon dogs and wild boar live in the city's hills and parks, mandarin ducks and herons winter on the restored streams, water deer graze the Han River reedbeds, and magpies are everywhere. Seoul Grand Park covers the big species."}
        ]
    },
    {
        slug: "nepal",
        name: "Nepal",
        regionType: "country",
        hubRegion: "asia",
        countryCode: "NP",
        coordinate: {lat: 28.3949, lng: 84.124, zoom: 6},
        captureArea: {countryCodes: ["NP"]},
        title: "Animals in Nepal: What You Can Spot, Learn, and Collect",
        description: "Nepal wildlife guide: one-horned rhinos and tigers in Chitwan and Bardia, gharials on the Rapti, red pandas and snow leopards in the Himalaya, monal and blue sheep.",
        searchIntents: [
            "animals in Nepal",
            "wildlife in Nepal",
            "what animals can be found in Nepal",
            "what wildlife is there in Nepal",
            "what animals can you see in Nepal",
            "नेपालका जनावर",
            "Nepal wildlife safari"
        ],
        quickAnswer: "Nepal runs from 60 metres above sea level to 8,849, and its wildlife covers the whole range. The Terai lowlands have Chitwan and Bardia, where greater one-horned rhinos are near-certain, Bengal tigers are realistic over a few days, and gharials bask on the riverbanks. The middle hills hold red pandas and Himalayan monal, and the high trekking routes have blue sheep, tahr, lammergeiers and the snow leopards that hunt them.",
        introduction: [
            "Nepal is the easiest country in the world to see a wild rhino. Chitwan National Park holds around 700 greater one-horned rhinos in grassland a few hours from Kathmandu, and a jeep or canoe trip will almost always find one. Bardia, further west and much quieter, has become the better bet for tigers.",
            "Above the Terai the animals change with altitude. Langurs and macaques give way to red pandas in the rhododendron forest, then to tahr and blue sheep on the cliffs above the treeline, with lammergeiers and griffons overhead. Trekkers who look up from the trail build a surprisingly long list."
        ],
        whyItMatters: [
            "Nepal has had several years of zero rhino poaching and has nearly tripled its tiger population since 2009, from 121 to around 355. Community forest management and army-protected parks did it, and tourism revenue is a large part of why the system holds.",
            "The Himalayan species face a different threat. Red panda habitat is fragmenting and snow leopards lose prey to livestock, and the trekking economy that brings people to their mountains is also the best argument for keeping them wild."
        ],
        animalsToSpot: [
            {speciesSlug: "indian-rhinoceros", whyItFits: "Chitwan holds roughly 700 greater one-horned rhinos in its riverine grassland, grazing within sight of jeep tracks and canoe routes, with a growing population in Bardia.", rarityHint: "Near-certain in Chitwan on a full-day safari; the Sauraha river edge sees them most evenings."},
            {speciesSlug: "bengal-tiger", whyItFits: "Bardia National Park has become one of Asia's most reliable tiger parks, with tigers walking the Karnali's dry riverbeds in the hot season; Chitwan has more tigers but denser cover.", rarityHint: "Realistic over three days in Bardia from March to May; a bonus in Chitwan."},
            {speciesSlug: "gharial", whyItFits: "The long-snouted fish-eating crocodile basks on the sandbanks of the Rapti and Narayani in Chitwan and the Karnali in Bardia, with a breeding centre at Kasara.", rarityHint: "Regular on winter-morning canoe trips in Chitwan; guaranteed at the Kasara centre."},
            {speciesSlug: "mugger-crocodile", whyItFits: "Muggers share the Rapti's banks with gharials and lie in the oxbow lakes of Chitwan and Bardia.", rarityHint: "Common on riverbank safaris."},
            {speciesSlug: "asian-elephant", whyItFits: "Wild herds move between Bardia and India's Katarniaghat and through Chitwan's eastern forest, separate from the trained elephants at the park lodges.", rarityHint: "Occasional in the wild in Bardia; trained elephants are everywhere in Sauraha."},
            {speciesSlug: "sloth-bear", whyItFits: "Shaggy bears dig termite mounds in Chitwan's sal forest and are seen on jeep drives more often than visitors expect.", rarityHint: "Uncommon; dawn drives in Chitwan's western sector give a fair chance."},
            {speciesSlug: "chital", whyItFits: "Spotted deer herds number in the hundreds in Chitwan's grasslands and are the tiger's main prey; their alarm calls announce predators.", rarityHint: "Abundant in both lowland parks."},
            {speciesSlug: "indian-peafowl", whyItFits: "Peacocks display in Chitwan's forest clearings and roost in the sal trees, calling at dawn and dusk.", rarityHint: "Very common in the Terai parks."},
            {speciesSlug: "red-panda", whyItFits: "Red pandas live in the bamboo understory of eastern Nepal's rhododendron forest, with community-run tracking in the Ilam and Panchthar hills and sightings in Langtang.", rarityHint: "Rare; the Ilam red panda treks with local trackers have a good hit rate."},
            {speciesSlug: "snow-leopard", whyItFits: "Snow leopards hunt blue sheep in the Annapurna, Manang, Dolpo and Everest regions, and sightings around Manang and Shey Phoksundo have become more regular.", rarityHint: "Very rare; dedicated winter trips to Manang or Dolpo with spotters give the only real chance."},
            {speciesSlug: "himalayan-monal", whyItFits: "Nepal's national bird, an iridescent pheasant, forages on the slopes above Ghorepani, in Langtang and around Everest's Tengboche in the early morning.", rarityHint: "Regular on the Annapurna and Everest trails between 3,000 and 4,000 metres."},
            {speciesSlug: "himalayan-tahr", whyItFits: "Shaggy mountain goats stand on cliffs above the Everest trail at Namche and in the Langtang valley, often close to the path.", rarityHint: "Regular on the Everest trek between Namche and Tengboche."},
            {speciesSlug: "bharal", whyItFits: "Blue sheep graze the slopes above Manang, Dolpo and Everest's upper valleys, the snow leopard's main prey and easy to watch through binoculars.", rarityHint: "Common above 3,500 metres in Annapurna, Dolpo and Everest."},
            {speciesSlug: "lammergeier", whyItFits: "The bone-dropping vulture patrols every high valley in Nepal on a three-metre wingspan, from Annapurna to the Khumbu.", rarityHint: "Regular overhead on any high trek."}
        ],
        bestFor: [
            "First-time safari-goers who want a near-certain wild rhino",
            "Tiger seekers prepared to spend three days in Bardia",
            "Trekkers logging monal, tahr, blue sheep and vultures along the way",
            "Red panda and snow leopard specialists on dedicated tracking trips"
        ],
        spottingTips: [
            "In Chitwan, stay on the park's western edge (Meghauli or the Kasara side) rather than Sauraha if you want fewer jeeps; rhinos are everywhere but tigers and sloth bears favour the quiet.",
            "Bardia's hot season (March to May) is tiger time: animals come to the Karnali's channels in the heat and the grass is burned short.",
            "Take the Rapti canoe trip at first light in winter for gharials, muggers and kingfishers lined up on the sandbanks.",
            "On the Everest trek, scan the cliffs between Namche and Tengboche for tahr and the rhododendron slopes at dawn for monal; both are routine for trekkers who stop and look."
        ],
        relatedLocationSlugs: ["india", "china", "pakistan"],
        rankingSlugs: ["rarest-animals", "animals-with-strongest-armor"],
        challengeSlugs: ["elephant-vs-rhino", "tiger-vs-white-rhinoceros"],
        faq: [
            {question: "What wildlife is there in Nepal?", answer: "Greater one-horned rhinos, Bengal tigers, leopards, sloth bears, elephants, gharials and muggers, chital, sambar and peafowl in the Terai parks of Chitwan and Bardia; red pandas, Himalayan monal and langurs in the middle hills; and snow leopards, blue sheep, tahr, musk deer and lammergeiers on the high trekking routes."},
            {question: "What animals can be found in Nepal?", answer: "Over 200 mammals and 900 bird species, from rhinos and tigers at 100 metres to snow leopards and bharal at 5,000. Everyday sightings are rhesus macaques, langurs, chital, peafowl, egrets and kites in the lowlands, and yaks, choughs, tahr and vultures on treks."},
            {question: "Chitwan or Bardia for a safari?", answer: "Chitwan for guaranteed rhinos, easy access from Kathmandu and the most lodges; Bardia for tigers, far fewer vehicles and a wilder feel. If you have time, Bardia in the hot season is the better wildlife experience."},
            {question: "Can you see snow leopards in Nepal?", answer: "Rarely, and only on dedicated trips. Winter expeditions to Manang in the Annapurna region or to Dolpo and Shey Phoksundo use local spotters and have improved odds, but a week with no sighting is normal. Blue sheep, their prey, are easy."}
        ]
    },
    {
        slug: "hong-kong",
        name: "Hong Kong",
        regionType: "city",
        hubRegion: "asia",
        countryCode: "HK",
        coordinate: {lat: 22.3193, lng: 114.1694, zoom: 10},
        captureArea: {countryCodes: ["HK"]},
        title: "Animals in Hong Kong: What You Can Spot, Learn, and Collect",
        description: "Hong Kong wildlife: wild boar and barking deer in the country parks, Mai Po's avocets and cormorants, pink dolphins off Lantau, pythons, macaques and horseshoe crabs.",
        searchIntents: [
            "animals in Hong Kong",
            "wildlife in Hong Kong",
            "what animals can be found in Hong Kong",
            "what wildlife is there in Hong Kong",
            "香港野生動物",
            "Mai Po birds",
            "Hong Kong pink dolphins"
        ],
        quickAnswer: "Three-quarters of Hong Kong is country park, and it shows. Wild boar wander into housing estates, barking deer and porcupines live on the hills above Kowloon, macaques own the Kam Shan reservoirs, and Burmese pythons turn up in village gardens. Mai Po's wetlands hold tens of thousands of wintering birds including avocets, cormorants and black-faced spoonbills, Chinese white dolphins survive in the waters off Lantau, and the Deep Bay mudflats have horseshoe crabs and mudskippers.",
        introduction: [
            "Hong Kong packs 7.5 million people onto a fraction of its land and leaves the rest to hills, reservoirs and coast. The result is a city where a hiker on the Wilson Trail can meet a barking deer in the morning and a boar in the car park at dusk, and where a two-metre python in a Sai Kung garden makes the news twice a year.",
            "Mai Po, the Ramsar wetland on the Shenzhen border, is one of East Asia's great bird sites, and the Deep Bay shore next to it still has horseshoe crabs. Kadoorie Farm and Botanic Garden in the Tai Po hills rehabilitates confiscated and injured animals and is the place to see species the city cannot show you wild."
        ],
        whyItMatters: [
            "Mai Po and Deep Bay host several hundred black-faced spoonbills each winter, once a quarter of the world total, and sits beside one of the fastest-growing cities on Earth. Counts there have mattered for 40 years, and the wetland is the reason the spoonbill came back from 300 birds.",
            "The Chinese white dolphins of the Pearl River estuary have fallen from around 150 in Hong Kong waters to a few dozen under airport expansion and the bridge to Macau. Every sighting logged off Lantau is part of the record."
        ],
        animalsToSpot: [
            {speciesSlug: "wild-boar", whyItFits: "Boar have spread from the country parks into Aberdeen, Pok Fu Lam and the Mid-Levels, and are Hong Kong's most-discussed wild animal.", rarityHint: "Common at dusk on the fringes of Aberdeen Country Park and Tai Tam."},
            {speciesSlug: "indian-muntjac", whyItFits: "Barking deer call from the hills of Tai Mo Shan, Shing Mun and the Sai Kung peninsula, and cross the trails at dawn.", rarityHint: "Heard regularly; seen with luck on early morning hikes."},
            {speciesSlug: "long-tailed-macaque", whyItFits: "The Kam Shan and Shing Mun reservoir macaques are a mixed population of rhesus and long-tailed monkeys and hybrids, numbering about 1,800 and bold with hikers.", rarityHint: "Guaranteed at Kam Shan ('Monkey Hill'); do not feed them."},
            {speciesSlug: "dolphin", whyItFits: "Chinese white dolphins, pink as adults, live in the estuary waters off northwest Lantau and are watched from boats out of Tung Chung and Tai O.", rarityHint: "Regular on dolphin-watch trips but the population is down to a few dozen."},
            {speciesSlug: "otter", whyItFits: "Eurasian otters survive in the fishponds and channels of Mai Po and the Deep Bay wetlands, detected mostly by camera trap and spraint.", rarityHint: "Very rare to see; dawn at the Mai Po gei wai is the only realistic try."},
            {speciesSlug: "pied-avocet", whyItFits: "Thousands of avocets winter on the Deep Bay mudflats off the Mai Po boardwalk hides, sweeping the shallows at high tide.", rarityHint: "Reliable from Mai Po's floating hides November to March."},
            {speciesSlug: "great-cormorant", whyItFits: "Up to 10,000 cormorants roost in the Mai Po mangroves in winter and fly out over the fishponds at dawn in long lines.", rarityHint: "Abundant in winter at Mai Po and Nam Sang Wai."},
            {speciesSlug: "chinese-pond-heron", whyItFits: "Stands along every nullah, fishpond and reservoir edge in the territory, maroon-headed in summer.", rarityHint: "Very common year-round."},
            {speciesSlug: "blue-spotted-mudskipper", whyItFits: "Mudskippers flag and skip across the Mai Po mudflats and the Tai O and Lai Chi Wo mangroves at low tide.", rarityHint: "Abundant at low tide on any mangrove shore."},
            {speciesSlug: "mangrove-horseshoe-crab", whyItFits: "Juvenile mangrove and tri-spine horseshoe crabs still crawl the mudflats at Ha Pak Nai and Shui Hau on Lantau, among the last nurseries in southern China.", rarityHint: "Uncommon; low spring tides at Ha Pak Nai with a local guide."},
            {speciesSlug: "burmese-python", whyItFits: "Hong Kong's biggest snake lives in the country parks and turns up in Sai Kung and Lantau villages; Kadoorie Farm rehabilitates the ones that are caught.", rarityHint: "Occasional in the wild, guaranteed at Kadoorie Farm."},
            {speciesSlug: "chinese-cobra", whyItFits: "The territory's commonest venomous snake, found on hillside paths and village edges in the warm months.", rarityHint: "Occasional; give it space and it leaves."},
            {speciesSlug: "lantern-bug", whyItFits: "The long-snouted lanternfly clusters on longan and lychee trunks in the New Territories every summer, a Hong Kong insect icon.", rarityHint: "Common June to September on fruit trees in Tai Po and Fanling villages."},
            {speciesSlug: "atlas-moth", whyItFits: "The giant moth emerges in Hong Kong's country parks and appears at Kadoorie Farm's lights and village lamps in early summer.", rarityHint: "Seasonal; May and June around forest-edge lights."}
        ],
        bestFor: [
            "Birders at Mai Po in the northern winter for spoonbills, avocets and waders",
            "Hikers logging boar, barking deer and macaques on the country park trails",
            "Boat trips for the Pearl River's pink dolphins from Tai O",
            "Families: Kadoorie Farm, Monkey Hill and the Tai O mangroves"
        ],
        spottingTips: [
            "Mai Po needs a permit; book through WWF Hong Kong and time your visit for a high tide between November and March so the waders push into the boardwalk hides.",
            "Hike the Kam Shan or Shing Mun reservoir paths early; macaques are guaranteed, and keep plastic bags out of sight because they associate them with food.",
            "Check Ha Pak Nai at a low spring tide in summer for horseshoe crabs and mudskippers, and stay for the sunset over Deep Bay.",
            "Kadoorie Farm in Tai Po shows the species the city cannot: rescued pythons, leopard cats, birds of prey and pangolins, plus wild lanternflies and atlas moths on its grounds in summer."
        ],
        relatedLocationSlugs: ["china", "singapore", "japan"],
        rankingSlugs: ["most-adaptable-animals", "most-invasive-species"],
        challengeSlugs: ["python-vs-cobra"],
        faq: [
            {question: "What wildlife is there in Hong Kong?", answer: "Wild boar, barking deer, porcupines, macaques, civets, leopard cats and pangolins in the country parks; Burmese pythons and Chinese cobras on the hills; tens of thousands of wintering birds including black-faced spoonbills, avocets and cormorants at Mai Po; Chinese white dolphins off Lantau; and horseshoe crabs, mudskippers and fiddler crabs on the Deep Bay and Lantau mudflats."},
            {question: "What animals can be found in Hong Kong?", answer: "Around 55 mammal species, over 550 birds, 80-plus reptiles including 50 snakes, and a huge insect fauna with 240 butterflies and 120 dragonflies. The ones residents meet most are boar, macaques, pond herons, geckos, lanternflies and the occasional python."},
            {question: "Are wild boar in Hong Kong dangerous?", answer: "Rarely. Boar bites and charges happen a few times a year, nearly always involving feeding or cornering an animal. Keep your distance, never feed them and keep dogs leashed, and they trot off."},
            {question: "Can you still see pink dolphins in Hong Kong?", answer: "Yes, on boat trips from Tai O or Tung Chung to the waters off northwest Lantau, where Chinese white dolphins are seen on most trips. The population has fallen sharply, so choose an operator that follows the code of conduct and keeps its distance."}
        ]
    },
    {
        slug: "new-zealand",
        name: "New Zealand",
        regionType: "country",
        hubRegion: "oceania",
        countryCode: "NZ",
        coordinate: {lat: -41.0, lng: 173.0, zoom: 4},
        captureArea: {countryCodes: ["NZ"]},
        title: "Animals in New Zealand: What You Can Spot, Learn, and Collect",
        description: "New Zealand wildlife guide: kiwi on Stewart Island, kea in the Alps, tuatara and takahe in sanctuaries, fur seals, sperm whales and dusky dolphins at Kaikoura.",
        searchIntents: [
            "animals in New Zealand",
            "wildlife in New Zealand",
            "what animals can be found in New Zealand",
            "what wildlife is there in New Zealand",
            "what animals can you see in New Zealand",
            "New Zealand native animals",
            "New Zealand wildlife travel"
        ],
        quickAnswer: "New Zealand has no native land mammals except bats, so its wildlife is birds, reptiles and the sea. Kiwi are realistic on Stewart Island and in sanctuaries, kea mob car parks in Arthur's Pass and Fiordland, tuatara and takahe live on predator-free islands and in fenced reserves like Zealandia, and tui and bellbirds sing in every native forest. The coast is where the mammals are: fur seals on every rocky shore, sperm whales and dusky dolphins off Kaikoura, and albatrosses at Taiaroa Head.",
        introduction: [
            "New Zealand split from the other continents before mammals arrived, and birds took their place. The result is a fauna of flightless parrots, ground-nesting kiwi, a reptile that outlived the dinosaurs and giant insects, most of it now confined to islands and fenced sanctuaries because of the rats, stoats and possums that people brought.",
            "That makes the country's wildlife unusually accessible for how rare it is. Zealandia in Wellington has tuatara and takahe a short bus ride from parliament; Kaikoura's whale boats run daily; fur seals haul out beside state highways; and the introduced animals, deer, possums, rabbits and stoats, are everywhere and part of the story."
        ],
        whyItMatters: [
            "New Zealand's Predator Free 2050 goal is the most ambitious conservation project anywhere, and sanctuaries like Zealandia and the predator-free islands are its proof of concept. Kakapo went from 51 birds in 1995 to around 250, entirely through hands-on management.",
            "The country's seabird fauna is the richest on Earth, with a third of all albatross and penguin species breeding here. Kaikoura and Stewart Island are where visitors meet it, and the fisheries and climate pressures on it are real."
        ],
        animalsToSpot: [
            {speciesSlug: "kiwi", whyItFits: "North Island brown kiwi call from Northland's forests and even the edges of Russell and Whangarei after dark, with Trounson Kauri Park and the Rotorua kiwi hatchery the easiest encounters; Stewart Island's famous beach kiwi are the southern tokoeka, a separate species.", rarityHint: "Heard most nights in Northland reserves; near-certain in the kiwi houses at Rotorua, Zealandia and Orokonui."},
            {speciesSlug: "kea", whyItFits: "The world's only alpine parrot works the car parks at Arthur's Pass, the Homer Tunnel in Fiordland and the Fox and Franz Josef glacier trails, pulling rubber off cars.", rarityHint: "Reliable at the Homer Tunnel and Arthur's Pass village; do not feed them."},
            {speciesSlug: "kakapo", whyItFits: "The flightless night parrot survives only on predator-free islands like Whenua Hou and Anchor Island, with every bird named and tracked.", rarityHint: "Not viewable in the wild; occasional display birds appear at sanctuaries such as Orokonui or Zealandia."},
            {speciesSlug: "takahe", whyItFits: "The flightless blue rail, thought extinct until 1948, lives wild in Fiordland's Murchison Mountains and can be watched at Zealandia, Tiritiri Matangi and Orokonui.", rarityHint: "Near-certain at the fenced sanctuaries; wild birds are remote."},
            {speciesSlug: "tuatara", whyItFits: "The last living rhynchocephalian basks at burrow mouths in Zealandia's valley and on Stephens and Tiritiri Matangi islands.", rarityHint: "Regular at Zealandia on warm afternoons; guaranteed in the tuatara enclosures at Orokonui and Auckland Zoo."},
            {speciesSlug: "tui", whyItFits: "The white-tufted honeyeater with the clicking, bell-like song is in every native forest and most city gardens, especially at flowering flax and kowhai.", rarityHint: "Very common nationwide."},
            {speciesSlug: "new-zealand-bellbird", whyItFits: "Korimako's pure chiming notes fill the beech forests of the South Island and the sanctuary islands, often alongside tui.", rarityHint: "Common in native forest, especially the South Island and offshore islands."},
            {speciesSlug: "rifleman", whyItFits: "New Zealand's smallest bird, a tail-less six-gram wren, works the beech trunks at Arthur's Pass and in Fiordland and the Catlins.", rarityHint: "Regular in South Island beech forest; listen for the high 'zit' call."},
            {speciesSlug: "wrybill", whyItFits: "The only bird with a sideways-bent bill breeds on Canterbury's braided riverbeds and winters in flocks of thousands at the Miranda shorebird centre near Auckland.", rarityHint: "Reliable at Miranda from January to July; scarce on the breeding rivers."},
            {speciesSlug: "new-zealand-fur-seal", whyItFits: "Fur seals haul out on rocks at Kaikoura's Ohau Point, Cape Palliser, the Catlins and Wellington's south coast, with pups in autumn.", rarityHint: "Guaranteed at Kaikoura and Cape Palliser year-round."},
            {speciesSlug: "sperm-whale", whyItFits: "Kaikoura's deep canyon brings resident male sperm whales within a few kilometres of shore, and whale-watch boats run several trips daily.", rarityHint: "Seen on roughly 95 percent of Kaikoura trips."},
            {speciesSlug: "dusky-dolphin", whyItFits: "Acrobatic dusky dolphins in pods of hundreds surround the boats off Kaikoura, and swim-with trips run in summer.", rarityHint: "Near-certain off Kaikoura year-round."},
            {speciesSlug: "wandering-albatross", whyItFits: "Pelagic trips from Kaikoura and Stewart Island bring wandering and other great albatrosses to the boat, and Taiaroa Head near Dunedin is the only mainland royal albatross colony on Earth.", rarityHint: "Regular on Kaikoura albatross trips; the Taiaroa colony is viewable from a hide."},
            {speciesSlug: "common-brush-tailed-possum", whyItFits: "Introduced from Australia and now 30 million strong, possums are the country's main forest pest and the mammal visitors see most, usually on the road at night.", rarityHint: "Very common at night; a pest, not a native."}
        ],
        bestFor: [
            "Birders chasing a fauna unlike anywhere else: kiwi, kea, takahe, kakapo and albatrosses",
            "Whale and dolphin watchers at Kaikoura, where the trips run daily",
            "Families: Zealandia, Orokonui and the fur seal colonies are easy, guaranteed stops",
            "Road-trippers logging seals, kea and native birds between the scenery"
        ],
        spottingTips: [
            "Book a Stewart Island kiwi night walk and a second night as backup; the birds feed on the beaches after dark and weather cancels trips.",
            "Visit Zealandia in Wellington on a sunny afternoon for tuatara at their burrows, then stay for the twilight tour when kiwi and glow-worms appear.",
            "At Kaikoura, take the first whale trip of the day for the calmest sea, and add the albatross boat if you can; the fur seals at Ohau Point are free on the roadside.",
            "Kea are curious and destructive: keep car windows up and nothing loose on roof racks at the Homer Tunnel and Arthur's Pass, and never feed them."
        ],
        relatedLocationSlugs: ["australia", "japan"],
        rankingSlugs: ["smartest-animals", "rarest-animals", "most-invasive-species"],
        challengeSlugs: ["orca-vs-blue-whale"],
        faq: [
            {question: "What wildlife is there in New Zealand?", answer: "Native birds found nowhere else: kiwi, kea, kakapo, takahe, tui, bellbirds, wrybills and a third of the world's albatross and penguin species; the tuatara and native geckos and skinks; and a marine fauna of fur seals, sperm whales, dusky and Hector's dolphins and orca. Introduced deer, possums, rabbits and stoats are everywhere."},
            {question: "What animals can be found in New Zealand?", answer: "No native land mammals other than two bats, so the list is birds (around 200 native species), reptiles (tuatara, 100-plus endemic geckos and skinks), giant weta and other insects, and marine mammals including nine whale and dolphin species seen from shore or boats. Possums, red deer, rabbits and stoats are the common introduced animals."},
            {question: "Where can you see kiwi in the wild?", answer: "Stewart Island (Rakiura), on guided night walks to Mason Bay or the Rakiura beaches, is the only place wild kiwi are regularly seen. Elsewhere, Zealandia's twilight tours and sanctuaries like Kapiti Island and Orokonui offer near-certain encounters with managed birds."},
            {question: "Is Kaikoura good for whale watching?", answer: "It is one of the best places in the world. Resident sperm whales feed in the canyon close to shore year-round, success rates are above 90 percent, and the same trips see dusky dolphins, fur seals and albatrosses. Humpbacks and orca pass through in winter and summer."}
        ]
    }
];

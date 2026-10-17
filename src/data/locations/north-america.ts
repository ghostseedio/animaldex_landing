import type {LocationPageInput} from "@/data/location-types";

export const northAmericaLocationPages: LocationPageInput[] = [
    {
        slug: "colorado",
        name: "Colorado",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 39.0, lng: -105.5, zoom: 6},
        captureArea: {bbox: {north: 41.1, south: 36.9, east: -101.9, west: -109.2}},
        title: "Animals in Colorado: What You Can Spot, Learn, and Collect",
        description: "Colorado wildlife guide: elk and bighorn sheep in Rocky Mountain National Park, moose at Grand Lake, prairie dog towns on the Front Range, and the Denver Zoo cluster.",
        searchIntents: [
            "animals in Colorado",
            "wildlife in Colorado",
            "what animals can be found in Colorado",
            "what wildlife is there in Colorado",
            "what animals can you see in Rocky Mountain National Park",
            "Colorado wildlife travel"
        ],
        quickAnswer: "Colorado's headline animals are elk, bighorn sheep, moose and mule deer, all realistic in Rocky Mountain National Park and the Grand Lake side of Trail Ridge Road. Prairie dog towns ring Denver and Boulder, pikas squeak from alpine boulder fields, and black bears work the foothill towns in autumn.",
        introduction: [
            "Colorado stacks four life zones on top of each other, from shortgrass prairie at 1,000 metres to tundra above 3,600, and each zone has its own animals. A day that starts with prairie dogs beside Denver International Airport can end with elk bugling in Moraine Park.",
            "Most sightings here come to people who drive slowly at the right hour. Trail Ridge Road, the Kawuneeche Valley and Mount Blue Sky (the old Mount Evans road) are the three stretches where the big mammals cross tarmac in daylight."
        ],
        whyItMatters: [
            "The elk rut in late September is one of the most reliable large-mammal spectacles in the United States, and it happens a 90-minute drive from a major airport. Estes Park fills with bulls herding harems across golf courses and car parks.",
            "Colorado is also where AnimalDex users most often log a zoo day in the mountains: Denver Zoo's recent captures run from Asian elephants and gorillas to Andean condors and bighorn sheep, so a rainy day still fills the collection."
        ],
        animalsToSpot: [
            {speciesSlug: "elk", whyItFits: "Rocky Mountain National Park holds roughly 600 to 800 elk in summer, and in late September the bulls bugle across Moraine Park and Horseshoe Park at dawn and dusk.", rarityHint: "Near-guaranteed in the park September to October; common in Estes Park itself."},
            {speciesSlug: "bighorn-sheep", whyItFits: "The state animal comes down to lick minerals at Sheep Lakes in Horseshoe Park in early summer, and rams loaf on the roadside cliffs of Big Thompson Canyon and Georgetown.", rarityHint: "Reliable at Sheep Lakes late May to mid-August, late morning; Georgetown viewing area in winter."},
            {speciesSlug: "moose", whyItFits: "Reintroduced in 1978 and now thriving in the willow flats of the Kawuneeche Valley on the Grand Lake side of the park.", rarityHint: "Likely at dawn or dusk along the Colorado River Trail and Highway 34 near Grand Lake."},
            {speciesSlug: "prairie-dog", whyItFits: "Black-tailed prairie dog towns survive on open ground around Denver, Boulder and Fort Collins, and whole colonies stand up to bark at a passing dog.", rarityHint: "Common on the Front Range; Rocky Mountain Arsenal National Wildlife Refuge has the easiest colonies."},
            {speciesSlug: "american-pika", whyItFits: "A palm-sized rabbit relative that hoards hay in talus above treeline and gives itself away with a sharp whistle from Trail Ridge Road pullouts.", rarityHint: "Common above 3,300 metres in summer; Rock Cut and the Alpine Visitor Center are the easy spots."},
            {speciesSlug: "mule-deer", whyItFits: "Big-eared deer that browse suburban Boulder gardens and the sagebrush around Estes Park with equal confidence.", rarityHint: "Very common statewide, especially at dusk in foothill towns."},
            {speciesSlug: "american-black-bear", whyItFits: "Colorado has an estimated 17,000 to 20,000 black bears, many of them cinnamon-coloured, and autumn brings them into Aspen, Durango and Boulder for fruit trees and bins.", rarityHint: "Possible in the foothills August to October; sightings in Rocky Mountain National Park are uncommon."},
            {speciesSlug: "mountain-goat", whyItFits: "Introduced in the 1940s and now part of the summit scenery on Mount Blue Sky and Quandary Peak, where they stand on the road and pose for cameras.", rarityHint: "Reliable on the Mount Blue Sky road in summer when it is open."},
            {speciesSlug: "pronghorn", whyItFits: "North America's fastest land animal grazes the eastern plains and the high parks around Walden and South Park in open view of the highway.", rarityHint: "Common on the plains east of Denver and along US 285 through South Park."},
            {speciesSlug: "golden-eagle", whyItFits: "Hunts the prairie-dog towns and cliff country of the Front Range and nests on sandstone ledges in the Pawnee National Grassland.", rarityHint: "Regular but never numerous; scan fence posts and thermals on the plains."},
            {speciesSlug: "clarks-nutcracker", whyItFits: "The grey, black and white corvid that works picnic tables at treeline and caches limber pine seeds across the high country.", rarityHint: "Common at Trail Ridge Road pullouts and high passes in summer."},
            {speciesSlug: "coyote", whyItFits: "Patrols Denver's greenways and the open prairie alike, often trotting through suburbs in full daylight.", rarityHint: "Common statewide; dawn in the Boulder open space is near-certain."},
            {speciesSlug: "desert-cottontail", whyItFits: "The default rabbit of the lower Front Range and the western canyons, frozen under a sagebrush until you get too close.", rarityHint: "Abundant on the plains and in the Grand Junction area."},
            {speciesSlug: "western-lowland-gorilla", whyItFits: "A Denver Zoo resident: the Great Apes house is one of the Colorado captures AnimalDex users log most, alongside orangutans and mandrills.", rarityHint: "Guaranteed at Denver Zoo on any open day."}
        ],
        bestFor: [
            "The late-September elk rut in Rocky Mountain National Park",
            "Alpine specialists like pika, marmot and mountain goat without a long hike",
            "Prairie dog towns and raptors within an hour of Denver",
            "Mixing a Denver Zoo day with real mountain wildlife"
        ],
        spottingTips: [
            "Drive Trail Ridge Road at opening time and stop at every pullout above treeline; pikas and nutcrackers are at the Rock Cut, bighorn at Sheep Lakes on the way down.",
            "For moose, go to the west side of the park: the Kawuneeche Valley along Highway 34 north of Grand Lake is far better than the Estes Park side.",
            "Elk in rut are dangerous. Stay in or beside your car in Moraine Park at dusk and use a telephoto; rangers close the meadows for a reason.",
            "Carry layers and watch the sky. Afternoon lightning above treeline is a real hazard from June to August, so do the alpine stops before noon."
        ],
        relatedLocationSlugs: ["united-states", "north-dakota", "texas"],
        rankingSlugs: ["fastest-animals"],
        challengeSlugs: ["moose-vs-elk", "elk-vs-wolf"],
        faq: [
            {question: "What wildlife is there in Colorado?", answer: "Elk, moose, mule deer, bighorn sheep, mountain goats, black bears, pronghorn, prairie dogs, pikas and marmots, plus golden eagles and Clark's nutcrackers in the high country. Mountain lions and bobcats are present but rarely seen."},
            {question: "What animals can be found in Colorado's Rocky Mountain National Park?", answer: "Elk and mule deer are near-certain, bighorn sheep are reliable at Sheep Lakes in early summer, moose live on the Grand Lake side, and pikas, marmots and ptarmigan are above treeline along Trail Ridge Road. Black bears are present but seldom seen."},
            {question: "When is the best time to see animals in Colorado?", answer: "Mid-September to mid-October for the elk rut and bear activity, June to August for alpine species while Trail Ridge Road is open, and winter for bighorn sheep at the Georgetown viewing area."}
        ]
    },
    {
        slug: "north-carolina",
        name: "North Carolina",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 35.5, lng: -79.4, zoom: 7},
        captureArea: {bbox: {north: 36.7, south: 33.7, east: -75.3, west: -84.5}},
        title: "Animals in North Carolina: What You Can Spot, Learn, and Collect",
        description: "North Carolina wildlife from the Outer Banks to the Smokies: red wolves at Alligator River, black bears, brown pelicans, green anoles and the fireflies and spiders of Charlotte's nature preserves.",
        searchIntents: [
            "animals in North Carolina",
            "wildlife in North Carolina",
            "what animals can be found in North Carolina",
            "what wildlife is there in North Carolina",
            "what animals can you see in the Outer Banks",
            "North Carolina wildlife travel"
        ],
        quickAnswer: "North Carolina runs from Atlantic barrier islands to the Great Smoky Mountains, so its animals range from brown pelicans and loggerhead turtles to black bears and elk. The coastal plain around Alligator River holds the world's only wild red wolves plus the densest black bears in the east, while the Charlotte preserves give easy green anoles, rat snakes, fireflies and a long list of insects.",
        introduction: [
            "The Albemarle-Pamlico peninsula is the wild heart of the state. Alligator River and Pocosin Lakes national wildlife refuges hold red wolves, bears the size of small cars, and alligators at the northern edge of their range.",
            "Inland, Charlotte's Mecklenburg County preserves are where AnimalDex users log most of their North Carolina captures: Reedy Creek Nature Preserve, the West Branch Nature Preserve and the greenways around Concord deliver anoles, phoebes, mockingbirds, wheel bugs and summer fireflies without a long drive."
        ],
        whyItMatters: [
            "Red wolves were declared extinct in the wild in 1980 and reintroduced here in 1987. Fewer than 30 roam the Alligator River peninsula, which makes any sighting a genuine conservation moment.",
            "The state is also an easy place to build a wide collection: suburban Piedmont woodland gives reptiles and insects, the Blue Ridge adds salamanders and elk, and the coast adds pelicans, dolphins and nesting sea turtles within a single long weekend."
        ],
        animalsToSpot: [
            {speciesSlug: "red-wolf", whyItFits: "The only wild population on earth lives in Alligator River National Wildlife Refuge near Manteo, where the refuge runs guided howling evenings in summer.", rarityHint: "Rare; a dusk drive along Milltail Road gives a slim chance, the howling programmes are more reliable."},
            {speciesSlug: "american-black-bear", whyItFits: "The coastal pocosins of Alligator River and Pocosin Lakes grow some of the largest black bears in North America, and they feed openly in the refuge farm fields.", rarityHint: "Very likely at dusk on the Alligator River wildlife drive May to October."},
            {speciesSlug: "white-tailed-deer", whyItFits: "Abundant everywhere from Outer Banks dunes to Charlotte golf courses, and the easiest large mammal in the state.", rarityHint: "Guaranteed at dawn or dusk in any Piedmont greenway."},
            {speciesSlug: "american-alligator", whyItFits: "North Carolina marks the northern limit of alligators, with reliable animals in the canals of Alligator River refuge and the Cape Fear lowlands near Wilmington.", rarityHint: "Likely on warm days from April to October along the refuge canals."},
            {speciesSlug: "brown-pelican", whyItFits: "Glides in lines along the Outer Banks surf and nests on dredge islands in Pamlico Sound; Oregon Inlet and the Hatteras ferry give close views.", rarityHint: "Common along the entire coast, most numerous in summer."},
            {speciesSlug: "green-anole", whyItFits: "The little colour-changing lizard of porch rails, fences and Charlotte garden shrubs, turning brown in the shade and bright green in the sun.", rarityHint: "Common in the Piedmont and coastal plain from April to October."},
            {speciesSlug: "eastern-rat-snake", whyItFits: "A long black snake that climbs trees and barn beams after rodents and birds' eggs across the Piedmont, including the Charlotte preserves.", rarityHint: "Regular in summer; harmless and worth photographing from a respectful distance."},
            {speciesSlug: "eastern-gray-squirrel", whyItFits: "The state mammal, and the most-logged North Carolina animal in AnimalDex, from Reedy Creek to university campuses in Raleigh.", rarityHint: "Guaranteed in any park with oaks."},
            {speciesSlug: "northern-mockingbird", whyItFits: "Sings from Charlotte rooftops and fence posts, stringing together stolen phrases from cardinals, car alarms and phoebes.", rarityHint: "Abundant in towns and farmland year-round."},
            {speciesSlug: "eastern-phoebe", whyItFits: "A tail-pumping flycatcher that nests under bridges and porch eaves at Reedy Creek and other Mecklenburg preserves.", rarityHint: "Common near water and buildings from March to October."},
            {speciesSlug: "common-eastern-firefly", whyItFits: "Lights up Piedmont lawns and woodland edges in June, and a different species, the synchronous firefly, draws a ticket-lottery crowd to Grandfather Mountain each June.", rarityHint: "Near-guaranteed on warm June evenings away from streetlights."},
            {speciesSlug: "io-moth", whyItFits: "A yellow moth with huge eyespots that turns up at Charlotte porch lights; its spiny green caterpillar stings, so look but do not touch.", rarityHint: "Uncommon; check lights in May and June."},
            {speciesSlug: "wheel-bug", whyItFits: "A large assassin bug with a cogwheel crest, stalking caterpillars on Piedmont shrubs; one of the more surprising captures logged around Charlotte.", rarityHint: "Uncommon in late summer; its bite is painful, so photograph it on the plant."},
            {speciesSlug: "bald-faced-hornet", whyItFits: "Builds grey paper footballs in Piedmont trees and visits garden flowers; a frequent North Carolina capture in late summer.", rarityHint: "Common from July to October; give the nest space."}
        ],
        bestFor: [
            "Red wolf and black bear evenings at Alligator River",
            "Outer Banks seabirds, pelicans and summer sea turtles",
            "Easy suburban reptiles and insects in Charlotte's nature preserves",
            "Synchronous fireflies at Grandfather Mountain and salamanders in the Smokies"
        ],
        spottingTips: [
            "Drive the Alligator River refuge roads (Milltail and Buffalo City) in the last hour before sunset from May to October for bears, and book the summer red wolf howling evening in advance.",
            "At Reedy Creek and West Branch, walk the creek edges on a hot afternoon for anoles and rat snakes, then come back at dusk in June for fireflies.",
            "On the Outer Banks, Pea Island refuge's north pond and the Oregon Inlet catwalk give the closest pelicans, terns and wading birds.",
            "Summer insects are the easiest way to fill a North Carolina collection: leave a porch light on and photograph what arrives, but do not handle io moth caterpillars or wheel bugs."
        ],
        relatedLocationSlugs: ["united-states", "georgia-usa", "florida"],
        rankingSlugs: ["rarest-animals"],
        challengeSlugs: ["deer-vs-coyote"],
        faq: [
            {question: "What wildlife is there in North Carolina?", answer: "Black bears, white-tailed deer, the reintroduced red wolf, elk in the Cataloochee valley of the Smokies, alligators in the coastal plain, brown pelicans and loggerhead turtles on the Outer Banks, and a huge list of reptiles, salamanders and insects in the Piedmont."},
            {question: "What animals can be found in North Carolina's Charlotte area?", answer: "Reedy Creek, West Branch and the Mecklenburg greenways give white-tailed deer, gray squirrels, green anoles, eastern rat snakes, phoebes, mockingbirds, and summer fireflies, wheel bugs and hornets. Coyotes and barred owls are present but need dusk."},
            {question: "Can you see red wolves in North Carolina?", answer: "Yes, but only in and around Alligator River National Wildlife Refuge near Manteo, and only with luck. Fewer than 30 wild red wolves survive; summer howling programmes run by the refuge are the most dependable way to experience them."},
            {question: "Are there alligators in North Carolina?", answer: "Yes. The state is the northern edge of the species' range. Alligator River refuge, Lake Waccamaw and the Wilmington area have resident animals, active mainly from April to October."}
        ]
    },
    {
        slug: "iowa",
        name: "Iowa",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 42.0, lng: -93.5, zoom: 7},
        captureArea: {bbox: {north: 43.6, south: 40.3, east: -90.0, west: -96.8}},
        title: "Animals in Iowa: What You Can Spot, Learn, and Collect",
        description: "Iowa wildlife guide: wintering bald eagles on the Mississippi, bison and elk at Neal Smith refuge, pelican migrations, and the fireflies, mantises and monarchs of Kalona farm country.",
        searchIntents: [
            "animals in Iowa",
            "wildlife in Iowa",
            "what animals can be found in Iowa",
            "what wildlife is there in Iowa",
            "what animals can you see in Iowa",
            "Iowa wildlife travel"
        ],
        quickAnswer: "Iowa is farm country, and its wildlife is farmland wildlife done well: white-tailed deer, wild turkeys, groundhogs and kestrels in every county, bald eagles by the hundred on the Mississippi in winter, and a restored prairie at Neal Smith National Wildlife Refuge where bison and elk graze again. Summer evenings in the Kalona and Riverside area are thick with fireflies, mantises and monarchs.",
        introduction: [
            "Less than 0.1 percent of Iowa's original tallgrass prairie survives, which is why the 5,600-acre Neal Smith refuge outside Des Moines matters so much. Its bison and elk herds roam a landscape that looked this way before the plough.",
            "The rest of the state's wildlife lives in the margins: river bluffs, shelterbelts, farm ponds and the gravel roads around Amish communities like Kalona and Riverside in Washington County, where AnimalDex users have logged everything from American kestrels to cuckoo wasps."
        ],
        whyItMatters: [
            "Iowa's Mississippi River shore is one of the best places in the lower 48 to see bald eagles in winter. Below the locks and dams at Keokuk, Davenport and Dubuque, open water concentrates hundreds of birds in January.",
            "The state also proves that an insect-heavy collection is a good collection. Iowa captures are dominated by fireflies, mantises, mayflies and moths, which is exactly what a summer here looks like."
        ],
        animalsToSpot: [
            {speciesSlug: "bald-eagle", whyItFits: "Winter concentrations below the Mississippi locks and dams at Keokuk, Le Claire and Dubuque can top several hundred birds, with nests along every major river in summer.", rarityHint: "Near-guaranteed December to February on the Mississippi; common year-round on the Des Moines and Iowa rivers."},
            {speciesSlug: "american-bison", whyItFits: "Neal Smith National Wildlife Refuge near Prairie City runs a free auto tour through an enclosure where a bison herd grazes restored tallgrass prairie.", rarityHint: "Reliable on the refuge auto tour, best in the morning."},
            {speciesSlug: "elk", whyItFits: "Share the Neal Smith prairie enclosure with the bison, and are usually easier to pick out against the tall grass in autumn.", rarityHint: "Likely on the auto tour; bulls are most visible in September."},
            {speciesSlug: "white-tailed-deer", whyItFits: "Iowa grows some of the biggest whitetails in the country on a corn and soybean diet, and they stand in every field edge at dusk.", rarityHint: "Guaranteed statewide at dawn and dusk."},
            {speciesSlug: "american-white-pelican", whyItFits: "Thousands stage on Saylorville Lake, Red Rock and the Mississippi pools during spring and autumn migration, wheeling in white spirals over the water.", rarityHint: "Common in April and again September to October at the big reservoirs."},
            {speciesSlug: "wild-turkey", whyItFits: "Restored from near-extirpation to over 100,000 birds, now strutting along timbered creek bottoms and Amish farm lanes across southeast Iowa.", rarityHint: "Common; flocks cross gravel roads in early morning."},
            {speciesSlug: "groundhog", whyItFits: "Sits bolt upright on roadside banks and under farm outbuildings across the state, one of the recent Iowa captures in AnimalDex.", rarityHint: "Common from March to October, especially along highway embankments."},
            {speciesSlug: "eastern-gray-squirrel", whyItFits: "The town squirrel of Iowa City, Des Moines and Cedar Rapids parks, with fox squirrels taking over in the open farm groves.", rarityHint: "Guaranteed in any mature-tree neighbourhood."},
            {speciesSlug: "american-kestrel", whyItFits: "Hovers over roadside ditches and perches on power lines along every county road; logged by AnimalDex users in Washington County farm country.", rarityHint: "Common year-round; scan wires on the drive between towns."},
            {speciesSlug: "monarch-butterfly", whyItFits: "Iowa sits in the core of the monarch's summer breeding range, and milkweed strips along Kalona roadsides fill with caterpillars by July.", rarityHint: "Common June to September; peak southbound migration in mid-September."},
            {speciesSlug: "common-eastern-firefly", whyItFits: "Rises out of hayfields and farm lawns at dusk in June and July, the single most Iowan summer sight there is.", rarityHint: "Near-guaranteed on humid June evenings away from town lights."},
            {speciesSlug: "chinese-mantis", whyItFits: "An introduced mantis now common in Iowa gardens and prairie plantings, logged alongside native mantises in the Kalona area in late summer.", rarityHint: "Regular August to October on goldenrod and garden shrubs."},
            {speciesSlug: "red-spotted-purple", whyItFits: "A blue-black butterfly that basks on gravel roads and woodland edges in eastern Iowa, often sipping at damp ground.", rarityHint: "Fairly common June to September near timber."},
            {speciesSlug: "giant-burrowing-mayfly", whyItFits: "Hatches off the Mississippi in such numbers in June and July that swarms show up on weather radar and pile under bridge lights in Davenport and Burlington.", rarityHint: "Seasonal and spectacular; check riverfront lights on warm summer nights."}
        ],
        bestFor: [
            "Winter bald eagle watching along the Mississippi",
            "Restored prairie with bison and elk at Neal Smith refuge",
            "Summer insect collecting in farm country around Kalona",
            "Spring and autumn pelican and waterfowl migration at the reservoirs"
        ],
        spottingTips: [
            "For eagles, go in January to the Lock and Dam 19 overlook in Keokuk or the Lock and Dam 14 area at Le Claire; mid-morning when birds are fishing is best, and Bald Eagle Appreciation Days add scopes and guides.",
            "Drive the Neal Smith auto tour slowly and early; bison stand close to the road in cool weather and the visitor centre has a live herd map.",
            "In Kalona and Riverside, pull onto a quiet gravel road at dusk in June and switch the lights off for fireflies; respect Amish farms and keep to the road.",
            "Milkweed is the monarch magnet. Check roadside stands in July for caterpillars and the Loess Hills ridges in mid-September for migrating adults."
        ],
        relatedLocationSlugs: ["united-states", "illinois", "north-dakota"],
        faq: [
            {question: "What wildlife is there in Iowa?", answer: "White-tailed deer, wild turkeys, groundhogs, raccoons, coyotes and foxes in farm country, bald eagles and pelicans on the Mississippi and the reservoirs, bison and elk in the restored prairie at Neal Smith refuge, and an exceptional summer insect season of fireflies, mantises, mayflies and monarchs."},
            {question: "What animals can be found in Iowa in winter?", answer: "Bald eagles are the winter highlight, concentrating by the hundreds below Mississippi River dams at Keokuk, Le Claire and Dubuque in January. Deer, turkeys and squirrels stay visible, and snowy owls occasionally reach northern Iowa fields."},
            {question: "Are there bison in Iowa?", answer: "Yes, in managed herds. Neal Smith National Wildlife Refuge near Prairie City has a free auto tour through a bison and elk enclosure, and Broken Kettle Grasslands in the Loess Hills also runs a conservation herd."}
        ]
    },
    {
        slug: "california",
        name: "California",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 37.2, lng: -119.5, zoom: 6},
        captureArea: {bbox: {north: 42.1, south: 32.4, east: -114.0, west: -124.6}},
        title: "Animals in California: What You Can Spot, Learn, and Collect",
        description: "California wildlife guide: sea otters in Monterey, elephant seals at Ano Nuevo, condors at Pinnacles, Yosemite black bears, grey whales offshore and the scrub-jays and quail of Riverside County.",
        searchIntents: [
            "animals in California",
            "wildlife in California",
            "what animals can be found in California",
            "what wildlife is there in California",
            "what animals can you see in Yosemite",
            "California wildlife travel"
        ],
        quickAnswer: "California's coast delivers sea otters at Monterey and Moss Landing, elephant seals at Ano Nuevo and Piedras Blancas, sea lions on Pier 39 and grey whales migrating past Point Reyes. Inland, Yosemite's black bears and mule deer are reliable, condors soar at Pinnacles and Big Sur, and the scrub around Perris and Riverside County fills with quail, scrub-jays and ravens.",
        introduction: [
            "No other US state packs this many habitats into one road trip. A single week can cover kelp forest, redwoods, granite high country, Mojave desert and the sage scrub of inland Southern California, and the animals change with every climb and descent.",
            "The marine mammals are the easy wins. Monterey Bay's submarine canyon brings humpbacks and otters within sight of the shore, and the pinniped beaches of the central coast run on a calendar you can plan around."
        ],
        whyItMatters: [
            "The California condor went down to 22 birds in 1987. More than 300 now fly free, and the Pinnacles and Big Sur flocks are the most accessible wild condors anywhere. Seeing one is seeing a recovery in progress.",
            "Southern sea otters, northern elephant seals and grey whales were all hunted to a few hundred animals and all recovered along this coast. California is where a wildlife collection comes with a conservation story on nearly every page."
        ],
        animalsToSpot: [
            {speciesSlug: "sea-otter", whyItFits: "Rafts of southern sea otters float in Elkhorn Slough at Moss Landing and along Cannery Row in Monterey, cracking crabs on their chests within metres of kayaks.", rarityHint: "Near-guaranteed at Moss Landing harbour and the Monterey breakwater."},
            {speciesSlug: "northern-elephant-seal", whyItFits: "Ano Nuevo State Park runs guided walks to the breeding beach from December to March, and the Piedras Blancas boardwalk near San Simeon has seals on the sand year-round.", rarityHint: "Guaranteed at Piedras Blancas; Ano Nuevo walks need advance booking in winter."},
            {speciesSlug: "california-condor", whyItFits: "The High Peaks of Pinnacles National Park and the Big Sur coast near Julia Pfeiffer Burns are the two places wild condors soar overhead on a regular basis.", rarityHint: "Realistic at Pinnacles on a warm, breezy afternoon; look for wing tags on a three-metre bird."},
            {speciesSlug: "california-sea-lion", whyItFits: "Pier 39 in San Francisco has held a barking colony since 1990, and La Jolla Cove in San Diego lets you watch them from the rocks.", rarityHint: "Guaranteed at Pier 39 and La Jolla; the Pier 39 numbers peak in winter."},
            {speciesSlug: "gray-whale", whyItFits: "The entire eastern Pacific population passes Point Reyes, Point Vicente and the Monterey headlands on its migration between Alaska and Baja.", rarityHint: "Reliable from shore December to January southbound and March to April northbound, with calves."},
            {speciesSlug: "humpback-whale", whyItFits: "Feeds over the Monterey submarine canyon so close to shore that lunge-feeding whales are sometimes visible from Moss Landing beach.", rarityHint: "Common on Monterey Bay boat trips May to November."},
            {speciesSlug: "american-black-bear", whyItFits: "Yosemite's bears are the most famous in the state, raiding unsecured cars in the Valley and feeding in the meadows of Tuolumne and Wawona.", rarityHint: "Possible in Yosemite Valley at dusk; use the bear lockers so they stay wild."},
            {speciesSlug: "mule-deer", whyItFits: "Graze the Yosemite Valley meadows under El Capitan and wander Cook's Meadow at sunset without concern for photographers.", rarityHint: "Near-guaranteed in Yosemite Valley and along the Tioga Road."},
            {speciesSlug: "california-quail", whyItFits: "The state bird, running in coveys through the chaparral and sage scrub of Lake Perris State Recreation Area and the San Jacinto Wildlife Area.", rarityHint: "Common in inland scrub, especially early morning on dirt roads."},
            {speciesSlug: "california-scrub-jay", whyItFits: "A loud, bold blue jay of oak woodland and suburban Riverside County gardens that buries acorns in lawns and steals from picnic tables.", rarityHint: "Abundant across lowland California."},
            {speciesSlug: "acorn-woodpecker", whyItFits: "Lives in clown-faced clans around granary oaks in the Sierra foothills and Coast Range, each tree drilled with thousands of acorn holes.", rarityHint: "Common in oak country; listen for the laughing 'waka-waka' call."},
            {speciesSlug: "banana-slug", whyItFits: "A bright yellow slug the length of a hand that grazes the redwood forest floor at Muir Woods, Big Basin and Humboldt after rain.", rarityHint: "Common in the coast redwoods on damp mornings, scarce in dry summers."},
            {speciesSlug: "monarch-butterfly", whyItFits: "Western monarchs overwinter in eucalyptus groves at Pacific Grove, Pismo Beach and Natural Bridges in Santa Cruz, hanging in clusters that look like dead leaves until the sun hits them.", rarityHint: "Reliable at the overwintering groves from November to February; numbers vary year to year."},
            {speciesSlug: "leopard-shark", whyItFits: "Hundreds of harmless, spotted sharks gather in the warm shallows of La Jolla Shores every summer, swimming around waders in knee-deep water.", rarityHint: "Near-guaranteed at La Jolla Shores from June to October."}
        ],
        bestFor: [
            "Marine mammals from shore: otters, elephant seals, sea lions and whales",
            "Condors and Yosemite's bears and deer in the mountains",
            "Overwintering monarch groves on the central coast",
            "Scrub birds and reptiles in Riverside County within an hour of Los Angeles"
        ],
        spottingTips: [
            "Kayak Elkhorn Slough from Moss Landing on a calm morning for otters and harbour seals; stay well back from the rafts, which is the law and also keeps them hauled out.",
            "Book the Ano Nuevo guided walk months ahead for the December to March breeding season, or use the free Piedras Blancas boardwalk any day of the year.",
            "At Pinnacles, climb the High Peaks trail from Bear Gulch by early afternoon and wait at the top; condors ride the thermals once the ridges heat up.",
            "In Yosemite, never leave food or scented items in a car, even for ten minutes. Bears that learn to break into cars are eventually destroyed."
        ],
        relatedLocationSlugs: ["united-states", "hawaii", "mexico", "british-columbia"],
        rankingSlugs: ["rarest-animals", "biggest-animals"],
        faq: [
            {question: "What wildlife is there in California?", answer: "Sea otters, elephant seals, sea lions, grey and humpback whales along the coast; black bears, mule deer and mountain lions in the Sierra; California condors at Pinnacles and Big Sur; and quail, scrub-jays, coyotes and lizards in the chaparral of inland Southern California."},
            {question: "What animals can be found in California's Monterey Bay?", answer: "Southern sea otters, harbour seals and sea lions are near-guaranteed from shore, humpback whales feed in the bay from spring to autumn, grey whales pass in winter and spring, and boat trips regularly add dolphins, orcas and ocean sunfish."},
            {question: "Where can you see California condors?", answer: "Pinnacles National Park's High Peaks and the Big Sur coast around Julia Pfeiffer Burns State Park are the best free-flying sites; Bitter Creek and Hopper Mountain refuges in the south are closed to visitors but birds range over Highway 166."},
            {question: "Is the wildlife around Perris and Riverside County worth a stop?", answer: "Yes for scrub species. Lake Perris State Recreation Area and the San Jacinto Wildlife Area give California quail, scrub-jays, ravens, roadrunners, coyotes and side-blotched lizards, with wintering raptors and waterfowl at San Jacinto."}
        ]
    },
    {
        slug: "texas",
        name: "Texas",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 31.3, lng: -99.3, zoom: 5},
        captureArea: {bbox: {north: 36.6, south: 25.7, east: -93.4, west: -106.8}},
        title: "Animals in Texas: What You Can Spot, Learn, and Collect",
        description: "Texas wildlife guide: whooping cranes at Aransas, Kemp's ridley turtles on Padre Island, Big Bend bears and javelinas, Katy Prairie geese and the anoles and mockingbirds of Houston backyards.",
        searchIntents: [
            "animals in Texas",
            "wildlife in Texas",
            "what animals can be found in Texas",
            "what wildlife is there in Texas",
            "what animals can you see in Big Bend",
            "Texas wildlife travel"
        ],
        quickAnswer: "Texas holds the only wild wintering flock of whooping cranes at Aransas, the main US nesting beach of Kemp's ridley sea turtles on Padre Island, black bears and javelinas in Big Bend, and alligators in the coastal marshes. Closer to home, mockingbirds, green anoles, fox squirrels, armadillos and great-tailed grackles fill Houston, Austin and Katy neighbourhoods.",
        introduction: [
            "Texas is big enough to be four states' worth of wildlife. The Gulf coast is wetland and barrier island, the Hill Country is limestone and live oak, the Panhandle is shortgrass plains, and Big Bend is Chihuahuan Desert dropping into the Rio Grande.",
            "The Katy Prairie west of Houston is a good example of how much survives next to a city: winter brings tens of thousands of snow geese and sandhill cranes to the rice fields, and the suburbs beside them give anoles, egrets and bullfrogs year-round."
        ],
        whyItMatters: [
            "Whooping cranes fell to 15 birds in 1941. The flock that winters at Aransas National Wildlife Refuge now numbers over 500, and watching a family forage for blue crabs in the salt marsh from the observation tower is one of North America's great recoveries.",
            "Texas also has the single most famous urban bat colony on the continent. Up to 1.5 million Mexican free-tailed bats pour out from under Austin's Congress Avenue Bridge on summer evenings, a reminder that wildlife spectacle does not require wilderness."
        ],
        animalsToSpot: [
            {speciesSlug: "whooping-crane", whyItFits: "The last self-sustaining wild flock winters in the salt marshes of Aransas National Wildlife Refuge near Rockport from November to March, visible from the tower and from boat tours out of Fulton.", rarityHint: "Reliable December to February on an Aransas boat tour; the observation tower works on calm days."},
            {speciesSlug: "kemps-ridley-sea-turtle", whyItFits: "Padre Island National Seashore is the main US nesting beach for the world's rarest sea turtle, and the park releases hatchlings at public dawn events in summer.", rarityHint: "Public hatchling releases run June to August; nesting females are rare daytime finds in April to July."},
            {speciesSlug: "american-alligator", whyItFits: "Brazos Bend State Park southwest of Houston has hundreds basking on the trail edges, and Anahuac refuge on the upper coast is alligator country from one end to the other.", rarityHint: "Near-guaranteed at Brazos Bend on any warm day."},
            {speciesSlug: "nine-banded-armadillo", whyItFits: "The state small mammal snuffles through Hill Country leaf litter and suburban lawns at dusk, and is the commonest roadside casualty on Texas highways.", rarityHint: "Common at dusk and after dark across the eastern two-thirds of the state."},
            {speciesSlug: "greater-roadrunner", whyItFits: "Sprints across ranch roads and campground edges in the Hill Country and Big Bend, pausing to raise its crest and stare.", rarityHint: "Common in dry country west of Austin; near-certain around Big Bend's Rio Grande Village."},
            {speciesSlug: "texas-horned-lizard", whyItFits: "The 'horny toad' of Texas childhoods has declined badly in the east but still basks on red dirt in the Panhandle, Rolling Plains and South Texas brush country.", rarityHint: "Uncommon; look on sandy roads and ant trails in the west on warm mornings."},
            {speciesSlug: "collared-peccary", whyItFits: "Javelina bands trot through the Chisos Basin campground and Rio Grande Village in Big Bend, and raid gardens in Hill Country towns.", rarityHint: "Likely in Big Bend at dawn and dusk; keep food locked away."},
            {speciesSlug: "american-black-bear", whyItFits: "Returned to the Chisos Mountains of Big Bend from Mexico in the late 1980s, and now a small population forages in the Basin and along the Lost Mine Trail.", rarityHint: "Uncommon; best odds in the Chisos Basin in late summer and autumn."},
            {speciesSlug: "western-diamondback-rattlesnake", whyItFits: "The big rattlesnake of the Hill Country and West Texas, crossing roads on warm nights and coiled under ledges by day.", rarityHint: "Regular from spring to autumn in dry country; watch your step and never reach into rock crevices."},
            {speciesSlug: "snow-goose", whyItFits: "Tens of thousands winter on the Katy Prairie rice fields and the coastal refuges, rising in white blizzards when a harrier passes.", rarityHint: "Common November to February on the Katy Prairie and at Anahuac and Brazoria refuges."},
            {speciesSlug: "northern-mockingbird", whyItFits: "The state bird sings all night under streetlights in Austin and Houston and dive-bombs cats across every suburb.", rarityHint: "Abundant statewide, year-round."},
            {speciesSlug: "green-anole", whyItFits: "Flashes a pink throat fan on Houston fences and Katy garden shrubs, one of the most frequently logged Texas animals in AnimalDex.", rarityHint: "Very common in the eastern half of the state from spring to autumn."},
            {speciesSlug: "fox-squirrel", whyItFits: "The big rusty squirrel of Texas pecan groves, city parks and oak-lined neighbourhoods from Dallas to San Antonio.", rarityHint: "Guaranteed in any park with mature pecans or oaks."},
            {speciesSlug: "great-tailed-grackle", whyItFits: "Thousands roost in supermarket car park trees in Austin and Houston at dusk, filling the air with whistles, clicks and squeaks.", rarityHint: "Abundant in every Texas city, most dramatic at winter roosts."}
        ],
        bestFor: [
            "Whooping cranes and coastal marsh birds at Aransas in winter",
            "Big Bend desert wildlife: javelinas, roadrunners, bears and rattlesnakes",
            "Padre Island sea turtle releases and Gulf beach birds",
            "Backyard reptiles, squirrels and the Austin bat emergence"
        ],
        spottingTips: [
            "For whooping cranes, book a boat out of Fulton or Rockport between December and February; the refuge tower works but the birds are often distant.",
            "Watch the Padre Island National Seashore release calendar in June and July and arrive before dawn at Malaquite Beach for hatchling releases.",
            "In Big Bend, walk the Rio Grande Village nature trail at first light for javelinas and roadrunners, and keep every scrap of food in the vehicle or bear box.",
            "Austin's bats emerge from Congress Avenue Bridge roughly 20 minutes after sunset from March to October; the Statesman Bat Observation Center lawn on the south bank is free."
        ],
        relatedLocationSlugs: ["united-states", "mexico", "nuevo-leon", "colorado"],
        rankingSlugs: ["most-dangerous-animals"],
        challengeSlugs: ["crocodile-vs-alligator"],
        faq: [
            {question: "What wildlife is there in Texas?", answer: "Alligators, whooping cranes and sea turtles on the Gulf coast; black bears, javelinas, roadrunners, rattlesnakes and mule deer in Big Bend; white-tailed deer, armadillos, bobcats and coyotes almost everywhere; and city wildlife like mockingbirds, anoles, fox squirrels, grackles and Austin's huge bat colony."},
            {question: "What animals can be found in Texas around Houston and Katy?", answer: "Green anoles, fox squirrels, egrets, bullfrogs, mockingbirds and grackles in the suburbs, alligators at Brazos Bend State Park, and tens of thousands of snow geese and sandhill cranes on the Katy Prairie rice fields in winter."},
            {question: "Are there bears in Texas?", answer: "Yes, a small black bear population in Big Bend National Park's Chisos Mountains and the surrounding Trans-Pecos, recolonised from Mexico since the 1980s. They are uncommon and most often seen in late summer and autumn."},
            {question: "When should you visit Texas for wildlife?", answer: "Winter (December to February) for whooping cranes, geese and sandhill cranes on the coast and Katy Prairie; spring and autumn for Big Bend before the extreme heat; summer for Padre Island turtle releases and the Austin bats."}
        ]
    },
    {
        slug: "florida",
        name: "Florida",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 28.1, lng: -81.6, zoom: 6},
        captureArea: {bbox: {north: 31.1, south: 24.3, east: -79.7, west: -87.8}},
        title: "Animals in Florida: What You Can Spot, Learn, and Collect",
        description: "Florida wildlife guide: Everglades alligators and crocodiles, manatees at Crystal River and Blue Spring, roseate spoonbills, Kissimmee eagles, nesting sea turtles and the anoles on every fence.",
        searchIntents: [
            "animals in Florida",
            "wildlife in Florida",
            "what animals can be found in Florida",
            "what wildlife is there in Florida",
            "what animals can you see in the Everglades",
            "Florida wildlife travel"
        ],
        quickAnswer: "Florida is the easiest place in the United States to see big reptiles and big wading birds: alligators line the Anhinga Trail and Shark Valley in the Everglades, American crocodiles haul out at Flamingo, and roseate spoonbills, wood storks and anhingas feed in the same ditches. Add manatees in the winter springs, loggerhead turtles nesting on the Atlantic beaches, and anoles and lubber grasshoppers in every garden.",
        introduction: [
            "Everglades National Park is the only place on earth where alligators and crocodiles live side by side, and its boardwalks put both within a few metres of the camera. Shark Valley's 15-mile loop and the Anhinga Trail at Royal Palm are the two classic starting points.",
            "Beyond the Everglades, the state's springs, barrier islands and suburban retention ponds all hold wildlife. The Kissimmee chain of lakes south of Orlando has one of the densest bald eagle populations in the lower 48, and theme-park visitors can see them from the hotel car park."
        ],
        whyItMatters: [
            "Florida's manatees were down to an estimated 1,000 animals in the 1990s and now number over 7,000. Winter congregations at Crystal River, Blue Spring and Manatee Lagoon in West Palm Beach are the best manatee viewing in the world.",
            "The state is also the frontline of invasive species in North America. Burmese pythons, Argentine tegus, iguanas and brown anoles are reshaping the ecosystem, and logging them is part of understanding the place."
        ],
        animalsToSpot: [
            {speciesSlug: "american-alligator", whyItFits: "Hundreds bask along the Shark Valley tram road and the Anhinga Trail in Everglades National Park, and nearly every golf course water hazard in the state has one.", rarityHint: "Guaranteed in the Everglades from December to April, when low water concentrates them."},
            {speciesSlug: "manatee", whyItFits: "Hundreds crowd the warm springs at Crystal River's Three Sisters Springs and Blue Spring State Park near Orange City on cold winter mornings.", rarityHint: "Near-guaranteed on cold days from November to March at Blue Spring and Crystal River."},
            {speciesSlug: "american-crocodile", whyItFits: "The marina basin at Flamingo in Everglades National Park and the cooling canals of Turkey Point are the best places in the US to see this shy, pale crocodile.", rarityHint: "Likely at Flamingo marina in winter; check the boat ramp and canal banks."},
            {speciesSlug: "roseate-spoonbill", whyItFits: "Sweeps its flat bill through the shallows at Ding Darling refuge on Sanibel, Merritt Island and the Everglades' Eco Pond, pink against grey mud.", rarityHint: "Common on the Gulf coast refuges and in the Everglades in winter and spring."},
            {speciesSlug: "wood-stork", whyItFits: "Big bald-headed storks feed in roadside ditches along the Tamiami Trail and nest at Corkscrew Swamp Sanctuary near Naples.", rarityHint: "Common in south and central Florida wetlands, especially late winter."},
            {speciesSlug: "anhinga", whyItFits: "The namesake of the Everglades' most famous trail, spearing fish underwater and then drying its wings on the boardwalk rail.", rarityHint: "Guaranteed on the Anhinga Trail and common at any freshwater pond statewide."},
            {speciesSlug: "burmese-python", whyItFits: "An invasive giant now breeding across the Everglades; the state runs an annual removal challenge and rangers display captured snakes at Shark Valley.", rarityHint: "Rarely seen in the wild despite tens of thousands present; most likely crossing roads at night in summer."},
            {speciesSlug: "florida-scrub-jay", whyItFits: "The only bird species found exclusively in Florida, living in family groups in the oak scrub of Merritt Island, Oscar Scherer State Park and the Lake Wales Ridge.", rarityHint: "Reliable at Oscar Scherer and the Merritt Island scrub trail; fearless and often lands on hats."},
            {speciesSlug: "gopher-tortoise", whyItFits: "Digs long burrows in sandy pine flatwoods that shelter 350 other species, and crosses trails at Jonathan Dickinson, Archbold and Kissimmee Prairie Preserve.", rarityHint: "Common in scrub and sandhill habitats on warm mornings."},
            {speciesSlug: "loggerhead-sea-turtle", whyItFits: "Florida's Atlantic beaches from Melbourne to Juno host the largest loggerhead nesting population in the Western Hemisphere, with guided night walks at Archie Carr refuge and Juno Beach.", rarityHint: "Nesting May to August; join a permitted turtle walk in June or July."},
            {speciesSlug: "brown-pelican", whyItFits: "Loafs on every fishing pier from Jacksonville to Key West and plunge-dives beside snorkellers in the Keys.", rarityHint: "Guaranteed on any coast."},
            {speciesSlug: "brown-anole", whyItFits: "The Cuban invader now outnumbers the native green anole on every Florida wall, path and fence, and shows up constantly in AnimalDex Florida captures.", rarityHint: "Guaranteed anywhere there is a sunny wall."},
            {speciesSlug: "green-anole", whyItFits: "The native anole has retreated into the shrubs and tree canopy to avoid the brown anole, so look higher than eye level in gardens and hammocks.", rarityHint: "Common but easier to miss than the brown anole; check palm fronds and tall shrubs."},
            {speciesSlug: "eastern-lubber-grasshopper", whyItFits: "A huge, slow, yellow and black grasshopper that marches across Everglades trails and Kissimmee lawns in summer, too toxic for most birds to eat.", rarityHint: "Common from April to September; nymphs swarm in black clusters in spring."}
        ],
        bestFor: [
            "Alligators and crocodiles together in Everglades National Park",
            "Winter manatee gatherings at the springs",
            "Wading birds at close range from boardwalks",
            "Sea turtle nesting walks on the Atlantic coast"
        ],
        spottingTips: [
            "Visit the Everglades in the dry season (December to April); low water packs alligators, wading birds and fish into the remaining pools along the Anhinga Trail and Shark Valley.",
            "For manatees, pick the coldest morning you can and be at Blue Spring State Park when the gate opens; the boardwalk gives views the boats cannot.",
            "Along the Kissimmee lakes, scan cypress snags and tall pines near Lake Tohopekaliga and Lake Kissimmee State Park for bald eagle nests from October to May.",
            "Turtle walks are permit-only. Book with Archie Carr refuge, Loggerhead Marinelife Center at Juno Beach or Sebastian Inlet State Park, and never use white lights on a nesting beach."
        ],
        relatedLocationSlugs: ["united-states", "georgia-usa", "alabama", "jamaica"],
        rankingSlugs: ["largest-introduced-and-invasive-animals", "most-invasive-species"],
        challengeSlugs: ["crocodile-vs-alligator"],
        faq: [
            {question: "What wildlife is there in Florida?", answer: "Alligators, American crocodiles, manatees, dolphins, sea turtles, Florida panthers, black bears, bobcats, armadillos, and a spectacular list of wading birds including roseate spoonbills, wood storks and anhingas, alongside invasive Burmese pythons, iguanas and brown anoles."},
            {question: "What animals can be found in Florida's Everglades?", answer: "Alligators by the hundred, American crocodiles at Flamingo, manatees in the marina basins, anhingas, herons, egrets, spoonbills and wood storks on the trails, plus gar and turtles in the sloughs. Pythons and panthers are present but seldom seen."},
            {question: "Where can you see manatees in Florida?", answer: "Blue Spring State Park near Orange City, Three Sisters Springs at Crystal River, Manatee Lagoon in West Palm Beach and the TECO power plant viewing centre in Apollo Beach, all on cold winter days from November to March."},
            {question: "Is Florida wildlife safe with kids?", answer: "Yes with ordinary care. Keep children and dogs well back from any water edge in alligator country, never feed wildlife, and use boardwalks like the Anhinga Trail, Shark Valley tram and Blue Spring where the animals come to you."}
        ]
    },
    {
        slug: "michigan",
        name: "Michigan",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 44.3, lng: -85.4, zoom: 6},
        captureArea: {bbox: {north: 48.4, south: 41.6, east: -82.0, west: -90.6}},
        title: "Animals in Michigan: What You Can Spot, Learn, and Collect",
        description: "Michigan wildlife guide: Isle Royale moose and wolves, Baker Sanctuary's autumn sandhill cranes near Battle Creek, loons and piping plovers on the Great Lakes, and the Detroit Zoo aviary.",
        searchIntents: [
            "animals in Michigan",
            "wildlife in Michigan",
            "what animals can be found in Michigan",
            "what wildlife is there in Michigan",
            "what animals can you see in the Upper Peninsula",
            "Michigan wildlife travel"
        ],
        quickAnswer: "Michigan's wildlife splits by peninsula. The Upper Peninsula and Isle Royale have moose, wolves and black bears; the Lower Peninsula has white-tailed deer everywhere, sandhill cranes staging by the thousand at the Baker Sanctuary near Battle Creek each October, loons on northern lakes and piping plovers at Sleeping Bear Dunes. Detroit Zoo adds a free-flight aviary and butterfly house for rainy days.",
        introduction: [
            "Isle Royale in Lake Superior is the longest-running predator-prey study on earth, with wolves and moose watched continuously since 1958. Visitors who make the ferry crossing see moose almost daily and hear wolves more often than they see them.",
            "Downstate, the Bernard W. Baker Sanctuary at Bellevue, near Battle Creek, was the first sanctuary in the US created for sandhill cranes. On October evenings thousands drop into Big Marsh Lake in a sound you can hear a mile away."
        ],
        whyItMatters: [
            "The Great Lakes piping plover was down to about a dozen pairs in the 1980s. Sleeping Bear Dunes now hosts the core of a population above 80 pairs, and the fenced nests along the beaches are a visible success.",
            "Michigan captures in AnimalDex skew toward painted turtles, robins, gray squirrels and the Detroit Zoo's scarlet ibises and butterflies, which reflects what the state really delivers: everyday wildlife at a very high standard plus a world-class zoo."
        ],
        animalsToSpot: [
            {speciesSlug: "moose", whyItFits: "Isle Royale National Park holds around a thousand moose on an island without roads, and they wade the inland lakes beside the Rock Harbor and Windigo trails.", rarityHint: "Near-guaranteed on a multi-day Isle Royale trip; a small mainland herd lives in the western Upper Peninsula."},
            {speciesSlug: "gray-wolf", whyItFits: "Isle Royale's wolves were restocked from the mainland in 2018 to 2019 and now number around 30, and the Upper Peninsula has over 600 more.", rarityHint: "Rarely seen; tracks and howls on Isle Royale are realistic, sightings are a bonus."},
            {speciesSlug: "american-black-bear", whyItFits: "Common across the Upper Peninsula and the northern Lower Peninsula, where blueberry patches and campground bins draw them in late summer.", rarityHint: "Possible at dusk in the UP from May to October; keep a clean camp."},
            {speciesSlug: "sandhill-crane", whyItFits: "The Baker Sanctuary near Battle Creek and the nearby Phyllis Haehnle Sanctuary at Jackson stage several thousand cranes each October before they leave for Florida.", rarityHint: "Reliable at the sanctuaries from late September to mid-November; pairs breed across southern Michigan marshes."},
            {speciesSlug: "common-loon", whyItFits: "Calls across northern Lower Peninsula lakes like Higgins and Hubbard and the Seney refuge pools in the UP from April to October.", rarityHint: "Common on clear northern lakes; the Seney wildlife drive is the easy option."},
            {speciesSlug: "bald-eagle", whyItFits: "Over 800 nesting pairs statewide, fishing the Au Sable, the Manistee and the Lake Michigan shore, with winter birds below the Croton and Hardy dams.", rarityHint: "Common year-round along big rivers and Great Lakes shores."},
            {speciesSlug: "piping-plover", whyItFits: "Sleeping Bear Dunes is the stronghold of the endangered Great Lakes population, with roped-off nests on the Platte River beach each summer.", rarityHint: "Reliable at Sleeping Bear from May to July if you respect the closures."},
            {speciesSlug: "white-tailed-deer", whyItFits: "Michigan has close to two million deer, and they graze suburban lawns in Ann Arbor as readily as UP clearcuts.", rarityHint: "Guaranteed anywhere at dusk."},
            {speciesSlug: "painted-turtle", whyItFits: "The state reptile lines up on logs in every farm pond and park lake from Detroit's Belle Isle northward, and tops the Michigan reptile captures in AnimalDex.", rarityHint: "Common on sunny days from April to October."},
            {speciesSlug: "american-robin", whyItFits: "The state bird, hopping across lawns from Grand Rapids to Marquette and among the most-logged Michigan species.", rarityHint: "Guaranteed from March to November; some winter in fruiting trees."},
            {speciesSlug: "eastern-gray-squirrel", whyItFits: "Downstate parks and campuses are full of them, and Michigan is also home to the black colour phase that dominates in places like Lansing and Ann Arbor.", rarityHint: "Guaranteed in any southern Michigan park."},
            {speciesSlug: "ring-billed-gull", whyItFits: "The default gull of Great Lakes beaches, Detroit riverfront car parks and every fast-food lot, nesting in huge colonies on harbour breakwaters.", rarityHint: "Abundant year-round."},
            {speciesSlug: "scarlet-ibis", whyItFits: "A Detroit Zoo resident: the Matilda Wilson Free-Flight Aviary lets visitors walk among scarlet ibises, and it is one of the Michigan zoo captures AnimalDex users log most.", rarityHint: "Guaranteed at Detroit Zoo's aviary."},
            {speciesSlug: "postman-butterfly", whyItFits: "One of the tropical butterflies flying free in the Detroit Zoo's Butterfly Garden, alongside longwings and malachites, all logged by visitors.", rarityHint: "Guaranteed inside the Butterfly Garden on any zoo day."}
        ],
        bestFor: [
            "Isle Royale moose and the sound of wolves",
            "October sandhill crane roosts near Battle Creek",
            "Loons, eagles and plovers around the Great Lakes shore",
            "Detroit Zoo's walk-through aviary and butterfly house"
        ],
        spottingTips: [
            "For Isle Royale, take the Ranger III from Houghton or the Isle Royale Queen from Copper Harbor and stay at least two nights; moose feed in Washington Creek at Windigo and in Tobin Harbor at dawn.",
            "Arrive at the Baker Sanctuary's Kiwanis Youth Area overlook an hour before sunset in October, dress for cold, and listen before you look: the cranes announce themselves.",
            "The Seney National Wildlife Refuge Marshland Wildlife Drive in the UP gives loons, trumpeter swans, eagles and sometimes bear and otter from the car.",
            "Stay outside the plover fencing at Sleeping Bear and keep dogs leashed; the birds nest on the open sand and abandon disturbed nests."
        ],
        relatedLocationSlugs: ["united-states", "illinois", "ontario"],
        challengeSlugs: ["moose-vs-wolf"],
        faq: [
            {question: "What wildlife is there in Michigan?", answer: "Moose, gray wolves and black bears in the Upper Peninsula and on Isle Royale; white-tailed deer, coyotes, foxes and turkeys statewide; loons, bald eagles, sandhill cranes and piping plovers around the lakes; and painted turtles, robins and squirrels in every town."},
            {question: "What animals can be found in Michigan's Isle Royale?", answer: "Moose are the main draw and are seen almost daily; the island also has wolves, red foxes, beavers, river otters, snowshoe hares, loons and bald eagles. There are no bears or deer on Isle Royale."},
            {question: "Where can you see sandhill cranes in Michigan?", answer: "The Bernard W. Baker Sanctuary at Bellevue near Battle Creek and the Phyllis Haehnle Memorial Sanctuary near Jackson both host thousands of cranes at dusk from late September to mid-November, with a CraneFest at Baker in October."}
        ]
    },
    {
        slug: "alabama",
        name: "Alabama",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 32.8, lng: -86.8, zoom: 7},
        captureArea: {bbox: {north: 35.1, south: 30.0, east: -84.8, west: -88.6}},
        title: "Animals in Alabama: What You Can Spot, Learn, and Collect",
        description: "Alabama wildlife guide: alligators and gar in the Mobile-Tensaw Delta, Dauphin Island spring migration, gopher tortoises and indigo snakes in the pine woods, and the squirrels and hornets of Prattville backyards.",
        searchIntents: [
            "animals in Alabama",
            "wildlife in Alabama",
            "what animals can be found in Alabama",
            "what wildlife is there in Alabama",
            "what animals can you see in the Mobile-Tensaw Delta",
            "Alabama wildlife travel"
        ],
        quickAnswer: "Alabama's richest wildlife sits in the Mobile-Tensaw Delta, a 250,000-acre swamp with alligators, alligator gar, black bears and ospreys, and on Dauphin Island, where exhausted spring migrants drop into the first trees after crossing the Gulf. Statewide you get white-tailed deer, turkeys, armadillos and fox squirrels, with gopher tortoises and reintroduced indigo snakes in the southern pine woods.",
        introduction: [
            "Alabama is quietly one of the most biodiverse states in the country, with more freshwater fish, turtle and mussel species than anywhere else in North America. Most of that lives in the rivers that converge on Mobile Bay.",
            "The Prattville and Autauga County area north of Montgomery is typical of the state's everyday wildlife: fox squirrels in the pecans, Muscovy ducks on the mill pond, wolf spiders and hornets in the garden, and deer on the edge of every field. AnimalDex users there have even logged a vinegaroon."
        ],
        whyItMatters: [
            "Dauphin Island is a Globally Important Bird Area for one reason: it is the first land that trans-Gulf migrants reach in April. After a north wind, the Shell Mounds and Audubon Sanctuary fill with warblers, buntings, orioles and hummingbirds in a single morning.",
            "The eastern indigo snake, North America's longest native snake, had vanished from Alabama by the 1950s. Releases in Conecuh National Forest since 2010 have brought it back, and wild-hatched young were confirmed in 2020."
        ],
        animalsToSpot: [
            {speciesSlug: "american-alligator", whyItFits: "The Mobile-Tensaw Delta is Alabama's alligator heartland; the Five Rivers Delta Resource Center boat tours and the causeway pullouts along US 90 and 98 give easy views.", rarityHint: "Near-guaranteed in the Delta from April to October."},
            {speciesSlug: "gopher-tortoise", whyItFits: "The keystone species of the longleaf pine sandhills digs its burrows in Conecuh National Forest and Geneva State Forest in the south, sheltering hundreds of other animals.", rarityHint: "Common in southern pine sandhills on warm mornings; look for the half-moon burrow mouths."},
            {speciesSlug: "eastern-indigo-snake", whyItFits: "Reintroduced to Conecuh National Forest from 2010, where it shelters in gopher tortoise burrows and now breeds in the wild again.", rarityHint: "Rare; a spring day in Conecuh gives a slim chance, and the snake is protected and harmless."},
            {speciesSlug: "alligator-gar", whyItFits: "Fish over two metres long roll at the surface of the Mobile Delta's backwaters, and the state record came from the Alabama River.", rarityHint: "Uncommon to see; watch calm Delta sloughs in summer for surfacing fish."},
            {speciesSlug: "brown-pelican", whyItFits: "Lines the Dauphin Island fishing pier and the Gulf State Park pier at Gulf Shores, diving beside the anglers.", rarityHint: "Guaranteed on the Gulf coast."},
            {speciesSlug: "ruby-throated-hummingbird", whyItFits: "Arrives on Dauphin Island in April straight from Yucatan, and Fort Morgan runs public hummingbird banding in autumn as the birds fatten before the return crossing.", rarityHint: "Common from April to October; the Fort Morgan banding days are a highlight."},
            {speciesSlug: "white-tailed-deer", whyItFits: "Alabama has one of the densest deer populations in the country, standing in Autauga County soybean fields and Black Belt pastures at dusk.", rarityHint: "Guaranteed statewide at dawn and dusk."},
            {speciesSlug: "wild-turkey", whyItFits: "The state game bird gobbles across the Black Belt and the Talladega National Forest each spring, and crosses county roads in flocks of a dozen or more.", rarityHint: "Common; most visible in March and April."},
            {speciesSlug: "nine-banded-armadillo", whyItFits: "Has spread north through the whole state since the 1990s and roots through Prattville lawns and roadside ditches after dark.", rarityHint: "Common at night; look for freshly dug cone-shaped holes in the grass."},
            {speciesSlug: "fox-squirrel", whyItFits: "The big, variably coloured squirrel of Alabama pecan orchards and pine woods, logged by AnimalDex users in Autauga County and across the state.", rarityHint: "Common in open pine and pecan country."},
            {speciesSlug: "cairina-moschata", whyItFits: "Feral Muscovy ducks loaf around Prattville's Creek Walk and most small-town ponds in central Alabama, warty faces and all.", rarityHint: "Guaranteed on town ponds; a tier-E capture that still counts."},
            {speciesSlug: "giant-burrowing-mayfly", whyItFits: "Hatches off the Tennessee River and Wheeler Lake in summer, carpeting bridge lights in Decatur and Guntersville overnight.", rarityHint: "Seasonal; check riverfront lights on warm nights from June to August."},
            {speciesSlug: "bald-faced-hornet", whyItFits: "Builds grey paper nests in central Alabama trees and visits flowers and dropped fruit in late summer gardens.", rarityHint: "Common from July to October; keep clear of the nest."},
            {speciesSlug: "vinegaroon", whyItFits: "A whip scorpion that sprays acetic acid when alarmed. Its normal range is Texas, the Southwest and Florida, so the single Alabama capture logged by an AnimalDex user is a notable record rather than something to plan around.", rarityHint: "Exceptional in Alabama; if you find one under a board or log on a humid night, photograph it and note the location."}
        ],
        bestFor: [
            "Alligators, gar and ospreys in the Mobile-Tensaw Delta",
            "Spring songbird fallouts on Dauphin Island",
            "Gopher tortoises and indigo snakes in the longleaf pine woods",
            "Everyday backyard wildlife in the Prattville and Montgomery area"
        ],
        spottingTips: [
            "Book a Delta boat tour from the Five Rivers Delta Resource Center in Spanish Fort, or paddle the Bartram Canoe Trail; alligators, ospreys and gar are closest from the water.",
            "On Dauphin Island, check the wind: a north or northwest wind in April grounds migrants in the Shell Mound Park and Audubon Bird Sanctuary trees by late morning.",
            "Walk Conecuh National Forest's Open Pond or Blue Lake trails in spring on a warm morning for gopher tortoises; stay on the trail and leave burrows undisturbed.",
            "In towns like Prattville, leave a porch light on in summer and check pecan trees at dawn; squirrels, hornets, wolf spiders and moths make up most Alabama captures."
        ],
        relatedLocationSlugs: ["united-states", "florida", "georgia-usa"],
        faq: [
            {question: "What wildlife is there in Alabama?", answer: "Alligators, alligator gar, black bears and ospreys in the Mobile-Tensaw Delta; white-tailed deer, turkeys, armadillos, coyotes and fox squirrels statewide; gopher tortoises and eastern indigo snakes in the southern pine woods; and spectacular spring songbird migration on Dauphin Island."},
            {question: "What animals can be found in Alabama's Mobile-Tensaw Delta?", answer: "Alligators by the dozen, alligator gar, river otters, a small black bear population, ospreys, bald eagles, swallow-tailed kites in summer, and a huge diversity of turtles and fish. Boat tours leave from Spanish Fort."},
            {question: "Are there alligators in Alabama?", answer: "Yes, mainly in the southern third of the state: the Mobile-Tensaw Delta, Eufaula National Wildlife Refuge and the Gulf coast bayous. They are most active from April to October."},
            {question: "When is the best time for birds on Dauphin Island?", answer: "The first three weeks of April, especially the morning after a cold front with north winds, when trans-Gulf migrants land exhausted in the first trees they reach."}
        ]
    },
    {
        slug: "connecticut",
        name: "Connecticut",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 41.6, lng: -72.7, zoom: 8},
        captureArea: {bbox: {north: 42.1, south: 40.9, east: -71.7, west: -73.8}},
        title: "Animals in Connecticut: What You Can Spot, Learn, and Collect",
        description: "Connecticut wildlife guide: ospreys and harbour seals on Long Island Sound, black bears in Litchfield County, suburban deer and turkeys, plus Beardsley Zoo's red wolves and Mystic Aquarium's belugas.",
        searchIntents: [
            "animals in Connecticut",
            "wildlife in Connecticut",
            "what animals can be found in Connecticut",
            "what wildlife is there in Connecticut",
            "what animals can you see on Long Island Sound",
            "Connecticut wildlife travel"
        ],
        quickAnswer: "Connecticut is suburban wildlife at its most generous: white-tailed deer, wild turkeys, gray squirrels, chipmunks, robins and Canada geese on nearly every lawn, black bears spreading through Litchfield and Hartford counties, and ospreys on platforms along the whole Long Island Sound shore. Winter brings harbour seals to the rocks off Stonington and Westport, and Beardsley Zoo and Mystic Aquarium cover the rainy days.",
        introduction: [
            "Connecticut is the third smallest state but one of the most wooded in the east, and the forest has come back so thoroughly that bears, bobcats and fishers now live within sight of Hartford's suburbs.",
            "The coast is the other half of the story. Long Island Sound's salt marshes at Hammonasset, Milford Point and Barn Island hold ospreys, egrets, horseshoe crabs and piping plovers, and the state's robin, squirrel and goose captures in AnimalDex come from the towns in between."
        ],
        whyItMatters: [
            "Connecticut's osprey population went from a handful of pairs in the DDT years to over 500 active nests, many on platforms residents can watch from the road. It is one of the clearest conservation wins a visitor can see in an afternoon.",
            "The state also shows how fast large mammals return. Black bears were absent for a century; sightings are now reported in nearly every town, and a careful visitor in the northwest hills has a real chance."
        ],
        animalsToSpot: [
            {speciesSlug: "osprey", whyItFits: "Nests on platforms at Hammonasset Beach State Park, Milford Point and along the Connecticut River estuary, carrying menhaden back to screaming chicks from April to September.", rarityHint: "Near-guaranteed along the shore from April to September."},
            {speciesSlug: "harbor-seal", whyItFits: "Hauls out on the rocks off Stonington, the Norwalk Islands and Westport's Sherwood Island from late autumn to spring, and Maritime Aquarium runs seal-spotting cruises from Norwalk.", rarityHint: "Likely from December to April at low tide; a scope helps from shore."},
            {speciesSlug: "american-black-bear", whyItFits: "Litchfield County and the towns north of Hartford host a growing population that raids bird feeders and crosses roads in daylight.", rarityHint: "Possible in the northwest hills from April to November; most reports are in suburban yards."},
            {speciesSlug: "white-tailed-deer", whyItFits: "Fairfield County has some of the densest suburban deer anywhere, browsing hostas and crossing the Merritt Parkway at dusk.", rarityHint: "Guaranteed at dawn and dusk statewide."},
            {speciesSlug: "wild-turkey", whyItFits: "Reintroduced in the 1970s and now strutting across lawns, golf courses and the UConn campus in flocks that stop traffic.", rarityHint: "Common year-round; spring toms display in open fields."},
            {speciesSlug: "eastern-gray-squirrel", whyItFits: "The most-logged Connecticut animal in AnimalDex, from New Haven's green to every backyard oak.", rarityHint: "Guaranteed anywhere with trees."},
            {speciesSlug: "eastern-chipmunk", whyItFits: "Darts along stone walls and porch steps with cheeks full of acorns, and chips alarm calls from under every woodpile.", rarityHint: "Common from March to October."},
            {speciesSlug: "american-robin", whyItFits: "The state bird, logged repeatedly by Connecticut users hopping across lawns in every town from Greenwich to Putnam.", rarityHint: "Guaranteed from March to November; flocks winter in fruiting trees."},
            {speciesSlug: "canada-goose", whyItFits: "Resident flocks graze every school field and corporate lawn, and migrants stack up on the Connecticut River in autumn.", rarityHint: "Guaranteed year-round."},
            {speciesSlug: "horseshoe-crab", whyItFits: "Crawls up onto Milford Point and Hammonasset sand on May and June high tides to spawn, a 450-million-year-old ritual beside the picnic tables.", rarityHint: "Reliable on new and full moon high tides in late May and June."},
            {speciesSlug: "piping-plover", whyItFits: "A few dozen pairs nest behind string fences at Milford Point, Sandy Point in West Haven and Griswold Point at the river mouth.", rarityHint: "Reliable at the fenced beaches from May to July; stay outside the ropes."},
            {speciesSlug: "mourning-cloak", whyItFits: "A dark butterfly with cream wing edges that flies on the first warm days of March, often before the snow is gone, and a recent Connecticut capture.", rarityHint: "Uncommon; look along sunny woodland edges in early spring and again in autumn."},
            {speciesSlug: "beluga-whale", whyItFits: "Mystic Aquarium keeps belugas in its outdoor Arctic Coast habitat, one of only a few places in the US to see the species above and below water.", rarityHint: "Guaranteed at Mystic Aquarium on any open day."},
            {speciesSlug: "red-wolf", whyItFits: "Connecticut's Beardsley Zoo in Bridgeport breeds red wolves as part of the recovery programme that supplies North Carolina's wild population.", rarityHint: "Guaranteed at Beardsley Zoo; the wolves are shy, so check the exhibit early."}
        ],
        bestFor: [
            "Osprey nests and salt marsh birds along Long Island Sound",
            "Winter harbour seal watching",
            "Dense suburban wildlife: deer, turkeys, squirrels and chipmunks",
            "Mystic Aquarium belugas and Beardsley Zoo's red wolves"
        ],
        spottingTips: [
            "Walk the Hammonasset Beach State Park boardwalk and Meigs Point in summer for ospreys, egrets and terns; the nature centre has a nest camera.",
            "For seals, go at low tide between December and April to Stonington Point or take the Maritime Aquarium's seal cruise out of Norwalk.",
            "Check Milford Point at the Housatonic mouth on a late-May new or full moon high tide for spawning horseshoe crabs and nesting plovers.",
            "In the northwest hills, bears raid bird feeders at dawn; take feeders in from April to November and watch the yard edge instead."
        ],
        relatedLocationSlugs: ["united-states", "new-york"],
        faq: [
            {question: "What wildlife is there in Connecticut?", answer: "White-tailed deer, black bears, bobcats, coyotes, foxes, fishers, wild turkeys, squirrels and chipmunks inland, and ospreys, egrets, piping plovers, horseshoe crabs and winter harbour seals along Long Island Sound."},
            {question: "What animals can be found in Connecticut's Long Island Sound?", answer: "Ospreys, great and snowy egrets, terns, piping plovers and horseshoe crabs in summer, harbour seals and sea ducks in winter, and the occasional dolphin or whale in the deeper eastern Sound."},
            {question: "Are there bears in Connecticut?", answer: "Yes. Black bears returned in the 1980s and are now reported in almost every town, with the densest population in Litchfield and Hartford counties. They are most active from April to November."}
        ]
    },
    {
        slug: "new-york",
        name: "New York",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 42.9, lng: -75.5, zoom: 6},
        captureArea: {bbox: {north: 45.1, south: 40.4, east: -71.7, west: -79.9}},
        title: "Animals in New York: What You Can Spot, Learn, and Collect",
        description: "New York State wildlife guide: Adirondack moose, loons and bears, Central Park's red-tailed hawks, humpback whales off Long Island, Montauk seals, and the Bronx Zoo's gorillas.",
        searchIntents: [
            "animals in New York",
            "wildlife in New York",
            "what animals can be found in New York",
            "what wildlife is there in New York",
            "what animals can you see in the Adirondacks",
            "New York wildlife travel"
        ],
        quickAnswer: "New York State runs from six-million-acre Adirondack wilderness to the densest city in the country, and both ends have wildlife. The Adirondacks give moose, black bears, loons and beavers; New York City gives red-tailed hawks over Central Park, peregrines on the bridges, raccoons in every park and humpback whales feeding within sight of the Rockaways. Long Island adds nesting plovers and winter seals at Montauk.",
        introduction: [
            "The Adirondack Park is larger than Yellowstone, Yosemite and Glacier combined, and its boreal lakes and bogs hold the state's moose, loons, martens and spruce grouse. The High Peaks get the hikers; the wildlife is thicker in the quieter northwest lakes.",
            "Downstate, the comeback story is marine. Cleaner water brought menhaden back to New York Harbor, and the whales followed. Humpbacks now feed off Rockaway Beach and Montauk each summer, and seals winter on the rocks under the Montauk lighthouse."
        ],
        whyItMatters: [
            "Central Park's red-tailed hawks, made famous by Pale Male from 1991 onward, turned a generation of New Yorkers into birders. The park records more than 200 bird species a year and sits on the Atlantic flyway, so May mornings at the Ramble can rival any wild site.",
            "The Bronx Zoo is the largest metropolitan zoo in the country and the home of the Wildlife Conservation Society, so a visit funds field programmes from Congo to the Adirondacks. Its gorillas, tigers and snow leopards are a legitimate part of a New York wildlife collection."
        ],
        animalsToSpot: [
            {speciesSlug: "american-black-bear", whyItFits: "The Adirondacks and Catskills hold several thousand bears, and the High Peaks require bear canisters because the Marcy Dam animals learned to open everything else.", rarityHint: "Likely in the High Peaks backcountry from June to September; common in Catskill campgrounds."},
            {speciesSlug: "moose", whyItFits: "Around 700 moose live in the Adirondacks, feeding in the wetlands around Tupper Lake, Newcomb and the Moose River Plains.", rarityHint: "Uncommon; dawn drives on Route 28N or 30 in September give the best odds."},
            {speciesSlug: "common-loon", whyItFits: "Yodels across almost every Adirondack lake from ice-out to October, with chicks riding their parents' backs in July.", rarityHint: "Common on quiet lakes; paddle at dawn for the closest views."},
            {speciesSlug: "bald-eagle", whyItFits: "Recovered from a single pair in the 1970s to over 400 nests, with winter concentrations along the Hudson at Croton Point and the Delaware River around Narrowsburg.", rarityHint: "Common year-round along the Hudson; January to February is peak on the upper Delaware."},
            {speciesSlug: "red-tailed-hawk", whyItFits: "Central Park's hawks nest on Fifth Avenue buildings and hunt rats and pigeons in the Ramble, continuing a lineage that began with Pale Male.", rarityHint: "Near-guaranteed in Central Park; look up when the pigeons flush."},
            {speciesSlug: "peregrine-falcon", whyItFits: "New York City has the densest urban peregrine population on earth, nesting on the Verrazzano, Throgs Neck and 55 Water Street.", rarityHint: "Regular over Lower Manhattan and the bridges; Riverside Church and the Brooklyn Bridge are good scanning points."},
            {speciesSlug: "harbor-seal", whyItFits: "Hauls out on the rocks below Montauk Point lighthouse and in Jamaica Bay from November to April, with guided seal walks from Montauk's Camp Hero.", rarityHint: "Reliable at Montauk Point at low tide in winter."},
            {speciesSlug: "humpback-whale", whyItFits: "Feeds on menhaden off Rockaway Beach, Long Beach and Montauk from May to November, close enough that surfers have shared waves with them.", rarityHint: "Likely on a summer whale-watch out of Riis Landing or Montauk; occasionally visible from the Rockaway boardwalk."},
            {speciesSlug: "white-tailed-deer", whyItFits: "Abundant from the Adirondack foothills to the Staten Island greenbelt, where an urban herd browses suburban gardens.", rarityHint: "Guaranteed upstate; common on Staten Island and eastern Long Island."},
            {speciesSlug: "eastern-gray-squirrel", whyItFits: "Central Park alone holds a few thousand, counted in the 2018 Squirrel Census, and they beg at every bench.", rarityHint: "Guaranteed in any city park."},
            {speciesSlug: "north-american-raccoon", whyItFits: "Raids bins in Central Park, Prospect Park and the Bronx after dark and dens in brownstone attics across the boroughs.", rarityHint: "Common at dusk in the big parks; do not approach."},
            {speciesSlug: "eastern-red-backed-salamander", whyItFits: "Lives under logs and flat stones in every damp hardwood forest from the Hudson Highlands to the Adirondacks, and was logged in New York by an AnimalDex user recently.", rarityHint: "Common; turn over a log on a damp day and replace it gently."},
            {speciesSlug: "piping-plover", whyItFits: "Nests behind string fences on Long Island's barrier beaches at Jones Beach, Nickerson and Breezy Point within the city limits.", rarityHint: "Reliable at the fenced beaches from May to July."},
            {speciesSlug: "western-lowland-gorilla", whyItFits: "The Bronx Zoo's Congo Gorilla Forest houses one of the largest gorilla troops in North America behind a glass wall where the animals come to the visitors.", rarityHint: "Guaranteed at the Bronx Zoo on any open day."}
        ],
        bestFor: [
            "Adirondack moose, loons and black bears",
            "Urban raptors and spring migration in Central Park",
            "Summer whale watching and winter seals off Long Island",
            "The Bronx Zoo's Congo Gorilla Forest"
        ],
        spottingTips: [
            "For moose, drive Route 30 between Tupper Lake and Long Lake or the Moose River Plains road at dawn in September; stop at every wetland and scan the willow edges.",
            "Central Park's Ramble and the north woods are best from 7 to 10 am in the first three weeks of May; the Loeb Boathouse birders' log tells you what is around.",
            "Whale trips out of Riis Landing in Queens run from late spring to autumn; the Montauk boats add fin whales and dolphins in late summer.",
            "At Montauk Point in winter, walk the beach below the lighthouse at low tide for seals, and bring a scope; the animals haul out on the offshore rocks."
        ],
        relatedLocationSlugs: ["united-states", "connecticut", "ontario"],
        rankingSlugs: ["fastest-animals"],
        challengeSlugs: ["peregrine-falcon-vs-red-tailed-hawk"],
        faq: [
            {question: "What wildlife is there in New York?", answer: "Moose, black bears, loons, beavers, martens and bald eagles in the Adirondacks; white-tailed deer, coyotes, foxes and turkeys statewide; red-tailed hawks, peregrines, raccoons and squirrels in New York City; and humpback whales, seals and piping plovers along the Long Island shore."},
            {question: "What animals can be found in New York City?", answer: "Red-tailed hawks in Central Park, peregrine falcons on the bridges, raccoons, gray squirrels and opossums in every park, more than 200 bird species on migration, white-tailed deer on Staten Island, coyotes in the Bronx, and humpback whales and seals offshore from Queens and Brooklyn."},
            {question: "Are there moose in New York?", answer: "Yes, roughly 700 in the Adirondacks, concentrated in the northwest lakes and wetlands around Tupper Lake, Newcomb and the Moose River Plains. They are uncommon and most often seen at dawn in September."},
            {question: "Can you see whales from New York City?", answer: "Yes. Humpback whales feed off Rockaway Beach and Coney Island from May to November, and whale-watching boats leave from Riis Landing in Queens. Sightings from the Rockaway boardwalk happen most summers."}
        ]
    },
    {
        slug: "georgia-usa",
        name: "Georgia",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 32.7, lng: -83.4, zoom: 7},
        captureArea: {bbox: {north: 35.1, south: 30.3, east: -80.7, west: -85.7}},
        title: "Animals in Georgia (USA): What You Can Spot, Learn, and Collect",
        description: "Georgia wildlife guide: Okefenokee alligators and sandhill cranes, Cumberland Island's loggerhead turtles and wild horses, gopher tortoises, Atlanta's backyard birds and the Georgia Aquarium's whale sharks.",
        searchIntents: [
            "animals in Georgia USA",
            "wildlife in Georgia USA",
            "what animals can be found in Georgia",
            "what wildlife is there in Georgia",
            "what animals can you see in the Okefenokee Swamp",
            "Georgia wildlife travel"
        ],
        quickAnswer: "Georgia's wildlife peaks in the south: the Okefenokee Swamp has thousands of alligators, resident sandhill cranes and wood storks, and Cumberland Island's beaches host nesting loggerhead turtles beside feral horses and armadillos. Statewide, white-tailed deer, cardinals, anoles and tiger swallowtails fill Atlanta's suburbs, and the Georgia Aquarium is the only place outside Asia to see whale sharks.",
        introduction: [
            "The Okefenokee is the largest blackwater swamp in North America, 400,000 acres of cypress, prairie and peat where the water is the colour of tea and alligators float in it like logs. The Suwannee Canal, Stephen C. Foster State Park and the Okefenokee Swamp Park at Waycross all put you on the water.",
            "On the coast, the barrier islands do the rest: Cumberland Island's 18 miles of empty beach, Jekyll Island's sea turtle centre and the Altamaha delta's wood stork colonies make Georgia's hundred miles of shoreline punch far above its length."
        ],
        whyItMatters: [
            "Georgia's loggerhead nesting has climbed from a few hundred nests a year in the early 2000s to records above 4,000, thanks to decades of nest protection on Cumberland, Jekyll, Sapelo and Blackbeard islands.",
            "The Georgia Aquarium in Atlanta is the largest in the Western Hemisphere and the only aquarium in the Americas with whale sharks and manta rays, which makes an Atlanta stopover a genuine marine-life day."
        ],
        animalsToSpot: [
            {speciesSlug: "american-alligator", whyItFits: "The Okefenokee holds an estimated 12,000 alligators, and the Suwannee Canal boat tours and the Chesser Island boardwalk put them beside the trail.", rarityHint: "Guaranteed in the Okefenokee from March to October."},
            {speciesSlug: "gopher-tortoise", whyItFits: "Georgia's state reptile digs its burrows in the sandhills of the Okefenokee rim, Fort Stewart and the Fall Line sandhills near Augusta.", rarityHint: "Common in longleaf pine sandhills on warm mornings."},
            {speciesSlug: "eastern-indigo-snake", whyItFits: "Southern Georgia's sandhills are the species' last natural stronghold outside Florida, where it winters in gopher tortoise burrows.", rarityHint: "Rare; the Orianne Society's Alapaha River preserve and Fort Stewart are the best known sites."},
            {speciesSlug: "loggerhead-sea-turtle", whyItFits: "Nests on Cumberland, Jekyll, Sapelo and the other barrier islands from May to August, and the Georgia Sea Turtle Center on Jekyll rehabilitates injured adults.", rarityHint: "Nesting May to August; guided night walks on Jekyll in June and July."},
            {speciesSlug: "wood-stork", whyItFits: "Nests in colonies at Harris Neck National Wildlife Refuge and feeds in the Okefenokee prairies, bald head and all.", rarityHint: "Reliable at Harris Neck from March to July."},
            {speciesSlug: "sandhill-crane", whyItFits: "A non-migratory Florida sandhill population breeds in the Okefenokee's open prairies, and northern migrants join them in winter.", rarityHint: "Common on Chesser Prairie from the boardwalk tower, year-round."},
            {speciesSlug: "manatee", whyItFits: "Summers in Cumberland Sound, the Brunswick River and the Savannah River, and the Kings Bay submarine base has a resident group.", rarityHint: "Uncommon; check marinas around St. Marys and Brunswick from May to September."},
            {speciesSlug: "brown-pelican", whyItFits: "Lines the Tybee Island pier and the Jekyll fishing pier, and nests on the sandbars of the Altamaha delta.", rarityHint: "Guaranteed along the coast."},
            {speciesSlug: "white-tailed-deer", whyItFits: "Cumberland Island's deer graze among the wild horses on the dune meadows, and the state's million-plus herd browses every Atlanta suburb at dusk.", rarityHint: "Guaranteed at dawn and dusk statewide."},
            {speciesSlug: "nine-banded-armadillo", whyItFits: "Roots along Cumberland Island's live-oak trails in broad daylight and has spread north to the Atlanta suburbs.", rarityHint: "Common on Cumberland and across south Georgia; often seen by day on the island."},
            {speciesSlug: "green-anole", whyItFits: "Flashes a pink dewlap from Atlanta porch rails and Savannah garden walls, and is one of the most-logged southeastern reptiles in AnimalDex.", rarityHint: "Common from April to October anywhere with shrubs."},
            {speciesSlug: "northern-cardinal", whyItFits: "The red bird of every Georgia feeder and hedgerow, singing from Piedmont Park to the Okefenokee visitor centre.", rarityHint: "Guaranteed year-round."},
            {speciesSlug: "eastern-tiger-swallowtail", whyItFits: "The state butterfly, drifting over Atlanta gardens and swamp edges from March to October and puddling on wet sand along the Okefenokee canals.", rarityHint: "Common in warm months."},
            {speciesSlug: "whale-shark", whyItFits: "The Georgia Aquarium in Atlanta keeps whale sharks in its 6.3-million-gallon Ocean Voyager tank, the only place in the Americas to see one.", rarityHint: "Guaranteed at the Georgia Aquarium on any open day."}
        ],
        bestFor: [
            "Okefenokee alligators, cranes and storks by boat",
            "Cumberland Island's turtles, horses and armadillos",
            "Backyard wildlife and spring migration around Atlanta",
            "Whale sharks and mantas at the Georgia Aquarium"
        ],
        spottingTips: [
            "Enter the Okefenokee at the east entrance near Folkston for the Chesser Island boardwalk and canal boat tours, or at Stephen C. Foster State Park on the west side for the darkest sky and the most alligators.",
            "Cumberland Island needs a ferry reservation from St. Marys weeks ahead; walk the Dungeness trail at dawn for horses, deer, armadillos and turkeys together.",
            "Join a permitted turtle walk through the Georgia Sea Turtle Center on Jekyll Island in June or July; red lights only on the beach.",
            "In Atlanta, the Chattahoochee River National Recreation Area trails give deer, herons, anoles and swallowtails within the city, and Piedmont Park's spring migration is underrated."
        ],
        relatedLocationSlugs: ["united-states", "florida", "alabama", "north-carolina"],
        rankingSlugs: ["biggest-animals"],
        challengeSlugs: ["crocodile-vs-alligator"],
        faq: [
            {question: "What wildlife is there in Georgia (USA)?", answer: "Alligators, sandhill cranes, wood storks and black bears in the Okefenokee; loggerhead turtles, manatees, dolphins and feral horses on the barrier islands; gopher tortoises and indigo snakes in the sandhills; and deer, cardinals, anoles and swallowtails in every suburb."},
            {question: "What animals can be found in Georgia's Okefenokee Swamp?", answer: "Around 12,000 alligators, resident sandhill cranes, wood storks, herons, egrets, barred owls, black bears, river otters and a long list of turtles, snakes and frogs. The boardwalks and canal boat tours give the easiest views."},
            {question: "Are there wild horses on Cumberland Island?", answer: "Yes, a feral herd of roughly 150 horses roams freely on Cumberland Island National Seashore. They are unmanaged and should be given at least 50 feet of space."},
            {question: "Is the Georgia Aquarium worth it for wildlife?", answer: "Yes. It is the only aquarium in the Western Hemisphere with whale sharks and holds manta rays, beluga whales and sea lions, so it fills an Atlanta day with species no wild Georgia site can."}
        ]
    },
    {
        slug: "illinois",
        name: "Illinois",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 40.0, lng: -89.2, zoom: 6},
        captureArea: {bbox: {north: 42.6, south: 36.9, east: -87.0, west: -91.6}},
        title: "Animals in Illinois: What You Can Spot, Learn, and Collect",
        description: "Illinois wildlife guide: Chicago lakefront migration at Montrose Point, urban coyotes and peregrines, Mississippi River eagles and pelicans, Shawnee's snake migration, and Brookfield Zoo.",
        searchIntents: [
            "animals in Illinois",
            "wildlife in Illinois",
            "what animals can be found in Illinois",
            "what wildlife is there in Illinois",
            "what animals can you see in Chicago",
            "Illinois wildlife travel"
        ],
        quickAnswer: "Illinois wildlife is strongest at its edges: spring migration on the Chicago lakefront at Montrose Point, coyotes and peregrines living in the city itself, bald eagles and white pelicans on the Mississippi and Illinois rivers, and the snakes and box turtles of the Shawnee National Forest in the far south. White-tailed deer, cardinals, raccoons and monarchs fill the farm country in between.",
        introduction: [
            "Chicago sits on the Lake Michigan shore where migrating birds pile up against the water, and the Magic Hedge at Montrose Point can hold 20 warbler species on a May morning within sight of the skyline. The city also hosts roughly 4,000 coyotes, tracked since 2000 by the Urban Coyote Research Project.",
            "Downstate, the big rivers carry the wildlife. Starved Rock and the Illinois River pools fill with eagles in January and white pelicans in spring and autumn, and the Shawnee's LaRue-Pine Hills closes its Snake Road twice a year for one of the great reptile migrations in the country."
        ],
        whyItMatters: [
            "Less than 0.01 percent of the Prairie State's original prairie survives, so the wildlife that thrives in Illinois is the adaptable kind. Coyotes, deer, raccoons and Canada geese have made the suburbs their own, and DuPage County's Willowbrook Wildlife Center treats thousands of them a year.",
            "Brookfield Zoo Chicago in the western suburbs has polar bears, gorillas and Mexican wolves, and its captures sit alongside the state's wild stink bugs and mealworm beetles in AnimalDex, which is an honest picture of how most people here meet animals."
        ],
        animalsToSpot: [
            {speciesSlug: "white-tailed-deer", whyItFits: "The state animal, abundant in the Cook County forest preserves and standing in cornfield edges across all 102 counties at dusk.", rarityHint: "Guaranteed at dawn and dusk; the Morton Arboretum and Busse Woods are near-certain."},
            {speciesSlug: "coyote", whyItFits: "Chicago's coyotes den in cemeteries, golf courses and rail corridors, and one famously walked into a downtown Quiznos; the Urban Coyote Research Project has collared over 1,000.", rarityHint: "Common; dawn in any large forest preserve or cemetery gives a fair chance."},
            {speciesSlug: "bald-eagle", whyItFits: "Hundreds winter below the Mississippi dams at Alton, Rock Island and Fulton and along the Illinois River at Starved Rock, where Bald Eagle Watch Weekend draws crowds in January.", rarityHint: "Near-guaranteed in January at Starved Rock and the Mississippi locks."},
            {speciesSlug: "american-white-pelican", whyItFits: "Thousands stage on the Illinois River at Chautauqua and Emiquon refuges and on the Mississippi backwaters in spring and autumn.", rarityHint: "Common in April and September to October at the river refuges."},
            {speciesSlug: "peregrine-falcon", whyItFits: "Nests on Chicago skyscrapers, the Wacker Drive ledges and Evanston's library, part of a Midwest recovery managed from the Field Museum.", rarityHint: "Regular over downtown Chicago; look up from the Riverwalk."},
            {speciesSlug: "ring-billed-gull", whyItFits: "Owns the Chicago lakefront, Navy Pier and every suburban parking lot, nesting in thousands on harbour breakwaters.", rarityHint: "Abundant year-round."},
            {speciesSlug: "northern-cardinal", whyItFits: "The state bird, singing from Lincoln Park hedges and farm windbreaks from February onward.", rarityHint: "Guaranteed year-round."},
            {speciesSlug: "eastern-gray-squirrel", whyItFits: "Chicago parks are full of them, alongside the fox squirrels that take over in the open suburbs and the black-phase grays of the North Shore.", rarityHint: "Guaranteed in any city park."},
            {speciesSlug: "north-american-raccoon", whyItFits: "Chicago alleys and DuPage County backyards at night; Willowbrook Wildlife Center admits hundreds of orphaned raccoons every spring.", rarityHint: "Common after dark; check alleys and forest preserve bins."},
            {speciesSlug: "monarch-butterfly", whyItFits: "The state insect breeds on roadside milkweed across the prairie counties and streams south along the lakefront in September.", rarityHint: "Common June to September; the September lakefront flight at Montrose is the highlight."},
            {speciesSlug: "eastern-box-turtle", whyItFits: "Crosses the forest roads of the Shawnee National Forest and the sand prairies of Mason County after summer rain.", rarityHint: "Uncommon; drive Shawnee back roads slowly after a warm rain in May or June."},
            {speciesSlug: "common-snapping-turtle", whyItFits: "Lurks in every farm pond, forest-preserve slough and Chicago River backwater, and hauls out to lay eggs on gravel paths in June.", rarityHint: "Common; most visible as nesting females in early June."},
            {speciesSlug: "shield-stink-bug", whyItFits: "The brown marmorated and native stink bugs that gather on Illinois screen doors each autumn, logged by users here and a fair sample of what the state's insect season looks like.", rarityHint: "Guaranteed on warm September and October afternoons on sunny walls."},
            {speciesSlug: "polar-bear", whyItFits: "Brookfield Zoo Chicago's Great Bear Wilderness houses polar bears, grizzlies and bison on a 7.5-acre site in the western suburbs.", rarityHint: "Guaranteed at Brookfield Zoo on any open day."}
        ],
        bestFor: [
            "Spring warbler migration on the Chicago lakefront",
            "Winter bald eagles at Starved Rock and the Mississippi dams",
            "Urban coyotes, peregrines and raccoons in the city",
            "Shawnee National Forest reptiles and the Snake Road migration"
        ],
        spottingTips: [
            "Be at Montrose Point's Magic Hedge by 7 am on a May morning after southerly winds; the Chicago Ornithological Society posts daily counts.",
            "Starved Rock's Bald Eagle Watch Weekend is the last weekend of January; the Illinois Waterway Visitor Center across the river has scopes and the eagles sit on the dam ice.",
            "Snake Road in the LaRue-Pine Hills closes to cars from mid-March to mid-May and September to October; walk it on a warm, humid afternoon for cottonmouths, rat snakes and box turtles.",
            "For coyotes, scan cemetery lawns and golf courses at first light in winter when the grass is short and the animals are bolder."
        ],
        relatedLocationSlugs: ["united-states", "iowa", "michigan"],
        rankingSlugs: ["most-adaptable-animals"],
        challengeSlugs: ["deer-vs-coyote"],
        faq: [
            {question: "What wildlife is there in Illinois?", answer: "White-tailed deer, coyotes, raccoons, foxes, beavers and river otters; bald eagles, white pelicans, sandhill cranes and huge songbird migrations along the lakefront and rivers; and a strong reptile list in the Shawnee National Forest including box turtles, cottonmouths and rat snakes."},
            {question: "What animals can be found in Illinois around Chicago?", answer: "Coyotes, raccoons, deer, gray and fox squirrels, Canada geese and ring-billed gulls are everyday sights; peregrine falcons nest downtown; and the lakefront at Montrose Point hosts one of the best spring warbler migrations in the Midwest. Brookfield and Lincoln Park zoos cover the rest."},
            {question: "Where can you see bald eagles in Illinois?", answer: "Starved Rock State Park and the Illinois Waterway Visitor Center near Utica, the Mississippi locks at Alton, Rock Island and Fulton, and Pere Marquette State Park, all peaking in January and February."},
            {question: "Is the Snake Road in Shawnee National Forest worth visiting?", answer: "Yes if you like reptiles. Forest Road 345 at LaRue-Pine Hills closes to vehicles each spring and autumn so snakes can cross between the bluffs and the swamp, and a warm afternoon can produce a dozen species including cottonmouths, which you watch from a distance."}
        ]
    },
    {
        slug: "north-dakota",
        name: "North Dakota",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 47.5, lng: -100.5, zoom: 6},
        captureArea: {bbox: {north: 49.1, south: 45.8, east: -96.4, west: -104.2}},
        title: "Animals in North Dakota: What You Can Spot, Learn, and Collect",
        description: "North Dakota wildlife guide: Theodore Roosevelt National Park bison, prairie dogs and wild horses, Chase Lake's pelican colony, sandhill cranes and snow geese on migration, and meadowlarks in Morton County.",
        searchIntents: [
            "animals in North Dakota",
            "wildlife in North Dakota",
            "what animals can be found in North Dakota",
            "what wildlife is there in North Dakota",
            "what animals can you see in Theodore Roosevelt National Park",
            "North Dakota wildlife travel"
        ],
        quickAnswer: "North Dakota's wildlife is Great Plains wildlife: bison, prairie dog towns, pronghorn, elk, mule deer and feral horses in Theodore Roosevelt National Park's badlands, and birds in staggering numbers in the prairie pothole country, from the continent's largest white pelican colony at Chase Lake to spring snow goose and sandhill crane flights that darken the sky. Meadowlarks, kestrels and ospreys fill the Missouri River country around Morton County.",
        introduction: [
            "Theodore Roosevelt National Park is the best free-roaming bison viewing east of Yellowstone, with a 36-mile scenic loop in the South Unit that passes two prairie dog towns, a bison herd, wild horses and a reliable pronghorn band before lunch.",
            "The rest of the state is the prairie pothole region, the duck factory of North America. Thousands of glacial wetlands around Jamestown, Devils Lake and Kenmare produce more ducks than anywhere else on the continent and stage cranes, geese and pelicans on migration."
        ],
        whyItMatters: [
            "Chase Lake National Wildlife Refuge near Medina holds the largest American white pelican nesting colony in North America, often above 30,000 birds. The refuge island is closed but the birds feed on wetlands for miles around.",
            "North Dakota is also one of the last places where sweeping shortgrass prairie still works as an ecosystem, and the badlands' prairie dog towns feed everything from burrowing owls to golden eagles. Its AnimalDex captures so far are meadowlarks, ospreys, flickers and harvestmen from the Missouri River country around Mandan."
        ],
        animalsToSpot: [
            {speciesSlug: "american-bison", whyItFits: "Theodore Roosevelt National Park's South Unit near Medora runs 300 to 700 bison on the scenic loop, and the North Unit herd grazes against the Little Missouri badlands.", rarityHint: "Near-guaranteed on the South Unit loop; stay 25 metres away, they outrun horses."},
            {speciesSlug: "prairie-dog", whyItFits: "Black-tailed prairie dog towns sprawl beside the park road at Peaceful Valley and the Buck Hill turnoff, barking and flagging tails at every car.", rarityHint: "Guaranteed on the South Unit loop from spring to autumn."},
            {speciesSlug: "pronghorn", whyItFits: "Bands graze the open flats of the South Unit and the ranchland along I-94 and US 85, outpacing any vehicle on the gravel.", rarityHint: "Common in the west of the state; near-certain in the park."},
            {speciesSlug: "elk", whyItFits: "A reintroduced herd of several hundred lives in the South Unit's juniper draws and bugles at dusk in late September.", rarityHint: "Uncommon by day; dawn and dusk in September on the Buck Hill road give the best odds."},
            {speciesSlug: "mule-deer", whyItFits: "Browse the badland coulees and stand on the Painted Canyon rim at sunset, ears like radar dishes.", rarityHint: "Common throughout the park and the western ranchland."},
            {speciesSlug: "american-white-pelican", whyItFits: "Chase Lake National Wildlife Refuge near Medina hosts the largest nesting colony on the continent, and the birds feed on potholes across central North Dakota all summer.", rarityHint: "Common May to September around Chase Lake, Devils Lake and the Missouri River."},
            {speciesSlug: "sandhill-crane", whyItFits: "Hundreds of thousands pass through the prairie potholes in April and again in October, roosting on shallow lakes around Kenmare and Jamestown.", rarityHint: "Reliable in migration; mid-April and early October are peak."},
            {speciesSlug: "snow-goose", whyItFits: "Spring flights through the Devils Lake basin and the Souris River refuges around Kenmare can exceed a million birds, rising off the fields in white sheets.", rarityHint: "Reliable in late March and April; October brings a second wave."},
            {speciesSlug: "golden-eagle", whyItFits: "Nests on badland buttes in Theodore Roosevelt National Park and hunts the prairie dog towns from the rim.", rarityHint: "Regular in the badlands; scan the buttes and thermals mid-morning."},
            {speciesSlug: "western-meadowlark", whyItFits: "The state bird, singing from every fence post along the Missouri River bluffs in Morton County and already logged there by AnimalDex users.", rarityHint: "Abundant from April to September on any rural road."},
            {speciesSlug: "burrowing-owl", whyItFits: "Stands on prairie dog mounds in the park and the Little Missouri grasslands, bobbing when you stop the car.", rarityHint: "Uncommon; check the edges of prairie dog towns in June and July."},
            {speciesSlug: "osprey", whyItFits: "Nests on platforms along the Missouri River near Mandan and Bismarck, and was one of the first North Dakota captures logged in AnimalDex.", rarityHint: "Regular along the Missouri from April to September."},
            {speciesSlug: "northern-flicker", whyItFits: "The ant-eating woodpecker of cottonwood river bottoms and shelterbelts, flashing a white rump as it flushes from the ground.", rarityHint: "Common in riparian woodland and towns from spring to autumn."},
            {speciesSlug: "coyote", whyItFits: "Yips across the badlands at dusk and trots the prairie in daylight; the park's coyotes hunt the prairie dog towns openly.", rarityHint: "Common; dawn on the South Unit loop is near-certain."}
        ],
        bestFor: [
            "Free-roaming bison and prairie dog towns in the badlands",
            "The largest white pelican colony on the continent",
            "Spring and autumn crane and goose migrations",
            "Grassland birds and raptors along the Missouri River"
        ],
        spottingTips: [
            "Drive the South Unit scenic loop at sunrise from the Medora entrance; bison are on the road, prairie dogs are at Peaceful Valley, and horses are often near the Buck Hill turnoff.",
            "Chase Lake's colony island is closed, but the refuge roads and the surrounding potholes near Medina give pelicans feeding and flying overhead all summer.",
            "For cranes and geese, time a visit for mid-April or early October and base yourself at Devils Lake or Kenmare; the fields fill at dawn and the lakes at dusk.",
            "The badlands are rattlesnake country from May to September; stay on trails around prairie dog towns and watch where you put your hands."
        ],
        relatedLocationSlugs: ["united-states", "iowa", "colorado", "alberta"],
        rankingSlugs: ["fastest-animals"],
        faq: [
            {question: "What wildlife is there in North Dakota?", answer: "Bison, pronghorn, elk, mule and white-tailed deer, prairie dogs, coyotes and feral horses in Theodore Roosevelt National Park; white pelicans, sandhill cranes, snow geese, ducks and grassland birds across the prairie potholes; and golden eagles, burrowing owls and rattlesnakes in the badlands."},
            {question: "What animals can be found in North Dakota's Theodore Roosevelt National Park?", answer: "Bison, prairie dogs, pronghorn, elk, mule deer, feral horses, coyotes, golden eagles and burrowing owls are all realistic on the South Unit scenic loop near Medora. Bighorn sheep live in the North Unit and prairie rattlesnakes are common in summer."},
            {question: "When is the best time for wildlife in North Dakota?", answer: "Mid-April to May for the goose and crane migration and newborn bison, June to August for pelicans and prairie dog activity, and late September for the elk rut and the autumn crane flights. Winter is harsh but bison and coyotes stay visible."}
        ]
    },
    {
        slug: "nova-scotia",
        name: "Nova Scotia",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "CA",
        parentSlug: "canada",
        coordinate: {lat: 45.0, lng: -63.0, zoom: 7},
        captureArea: {bbox: {north: 47.2, south: 43.2, east: -59.5, west: -66.6}},
        title: "Animals in Nova Scotia: What You Can Spot, Learn, and Collect",
        description: "Nova Scotia wildlife guide: Bay of Fundy humpbacks, Sable Island grey seals, Cape Breton moose and eagles, Halifax harbour seals, puffins on the Bird Islands, and Shubenacadie Wildlife Park.",
        searchIntents: [
            "animals in Nova Scotia",
            "wildlife in Nova Scotia",
            "what animals can be found in Nova Scotia",
            "what wildlife is there in Nova Scotia",
            "what animals can you see in Cape Breton",
            "Nova Scotia wildlife travel"
        ],
        quickAnswer: "Nova Scotia's best wildlife is on and beside the sea: humpback, fin and minke whales in the Bay of Fundy and off Cape Breton, grey seals breeding by the hundred thousand on Sable Island, harbour seals in Halifax Harbour and puffins on the Bird Islands. On land, Cape Breton Highlands has moose and the densest bald eagles in eastern Canada, while red squirrels, chipmunks, juncos and foxes fill every woodlot.",
        introduction: [
            "The Bay of Fundy's 16-metre tides stir up the richest feeding ground in the northwest Atlantic, and the whales that follow the herring arrive off Brier Island and Digby Neck each June. A zodiac from Westport can put you alongside a humpback before the fog lifts.",
            "Inland, the province is spruce woods, lakes and small farms, and its everyday animals are exactly what AnimalDex users here log: red squirrels, eastern chipmunks, red foxes, juncos and nuthatches, with cunners, periwinkles and shore crabs in the tide pools below."
        ],
        whyItMatters: [
            "Sable Island, 300 kilometres offshore, holds the largest grey seal breeding colony on earth with over 300,000 animals, alongside its famous wild horses. It is a national park reserve reachable only by chartered flight, but the same seals haul out around the province's coast all winter.",
            "Shubenacadie Wildlife Park near Halifax is the province's own zoo of native species, where cougars, lynx, moose and swift foxes give visitors the animals they are unlikely to meet in the woods, and its captures already appear in the Nova Scotia record."
        ],
        animalsToSpot: [
            {speciesSlug: "humpback-whale", whyItFits: "Feeds in the Bay of Fundy off Brier Island and Long Island from June to October, and off Cape Breton's Pleasant Bay in late summer.", rarityHint: "Near-guaranteed on a Brier Island zodiac trip July to September."},
            {speciesSlug: "grey-seal", whyItFits: "Sable Island's colony is the world's largest, and in winter the same seals pack the rocks and beaches of Hay Island, the Eastern Shore and the Bay of Fundy's Brier Island.", rarityHint: "Common along the coast; winter haul-outs at Brier Island and Taylor Head are reliable."},
            {speciesSlug: "harbor-seal", whyItFits: "Rests on ledges in Halifax Harbour near McNabs Island and Point Pleasant Park, and already logged in Nova Scotia by AnimalDex users.", rarityHint: "Likely at low tide from a Halifax harbour tour or the McNabs Island ferry."},
            {speciesSlug: "atlantic-puffin", whyItFits: "Nests on the Bird Islands off Cape Breton's Big Bras d'Or, where boat tours circle the cliffs from May to August.", rarityHint: "Reliable on Bird Islands tours June to July; seen from land only on rare occasions."},
            {speciesSlug: "bald-eagle", whyItFits: "Cape Breton has the densest nesting eagles in northeastern North America, perched over the Bras d'Or Lake and the Margaree River, and winter feedings at Sheffield Mills in the Annapolis Valley draw dozens.", rarityHint: "Common year-round around the Bras d'Or; Sheffield Mills Eagle Watch runs in January and February."},
            {speciesSlug: "moose", whyItFits: "Cape Breton Highlands National Park's plateau holds a dense population introduced from Alberta in the 1940s, browsing beside the Skyline Trail and the Cabot Trail at dusk.", rarityHint: "Likely at dusk on the Skyline Trail or French Mountain in summer; the mainland population is small and endangered."},
            {speciesSlug: "canada-lynx", whyItFits: "A few hundred survive on the Cape Breton Highlands plateau, and Shubenacadie Wildlife Park keeps lynx for the many who never meet one in the wild.", rarityHint: "Rare in the wild, tracks in snow are realistic; guaranteed at Shubenacadie."},
            {speciesSlug: "american-lobster", whyItFits: "The province's economic backbone, hauled onto wharves from Yarmouth to Cape Breton and visible in tide pools and under docks for snorkellers.", rarityHint: "Guaranteed at any working wharf in season; small ones in rocky shallows at low tide."},
            {speciesSlug: "cunner", whyItFits: "A chunky wrasse that hangs around wharf pilings and rock pools all around the province, and the most-logged Nova Scotia fish in AnimalDex.", rarityHint: "Common under any wharf in summer; peer down from the dock."},
            {speciesSlug: "american-red-squirrel", whyItFits: "Scolds from spruce branches in every Nova Scotia woodlot and campground, and tops the province's mammal captures in AnimalDex.", rarityHint: "Guaranteed anywhere with conifers."},
            {speciesSlug: "eastern-chipmunk", whyItFits: "Stripes through the stone walls and campgrounds of the Annapolis Valley and the South Shore, cheeks packed with beech nuts.", rarityHint: "Common from April to October."},
            {speciesSlug: "red-fox", whyItFits: "Trots along Halifax streets, the Cabot Trail roadsides and beaches at dawn, and is logged across the province.", rarityHint: "Common; dawn on a quiet beach or golf course is near-certain."},
            {speciesSlug: "dark-eyed-junco", whyItFits: "The slate-grey sparrow that flicks white tail feathers from every woodland edge and winter feeder in the province.", rarityHint: "Abundant year-round."},
            {speciesSlug: "fisher", whyItFits: "A big tree-climbing weasel relative reintroduced to the mainland, now spreading through the Cobequid Hills and the South Shore woods.", rarityHint: "Rare and mostly nocturnal; winter tracks are the realistic find."}
        ],
        bestFor: [
            "Bay of Fundy whale watching from Brier Island",
            "Grey and harbour seals on winter haul-outs",
            "Cape Breton moose, eagles and puffins",
            "Native wildlife at Shubenacadie Wildlife Park"
        ],
        spottingTips: [
            "Drive to Westport on Brier Island and book a zodiac from mid-July to September; the 20-knot run to the whales is wet and cold, so bring full waterproofs.",
            "Walk the Cape Breton Highlands Skyline Trail in the last two hours of daylight for moose; stay on the boardwalk and give any animal 30 metres.",
            "The Bird Islands puffin boats leave Big Bras d'Or from May to August; mornings are calmer and the light is better.",
            "At low tide on any rocky shore, turn over small stones for shore crabs and periwinkles and watch wharf pilings for cunners; replace everything as you found it."
        ],
        relatedLocationSlugs: ["canada", "quebec", "ontario"],
        rankingSlugs: ["biggest-animals"],
        faq: [
            {question: "What wildlife is there in Nova Scotia?", answer: "Humpback, fin and minke whales, grey and harbour seals, puffins and gannets on the coast; moose, black bears, lynx, bobcats and bald eagles in Cape Breton; and red squirrels, chipmunks, red foxes, porcupines and juncos throughout the province's woods and farmland."},
            {question: "What animals can be found in Nova Scotia's Bay of Fundy?", answer: "Humpback, fin and minke whales from June to October, with occasional endangered North Atlantic right whales in late summer, plus harbour porpoises, grey seals, puffins, shearwaters and huge flocks of migrating shorebirds on the mudflats in August."},
            {question: "When is the best time to visit Nova Scotia for wildlife?", answer: "July to September for whales and puffins, June to October for Cape Breton moose, and January to February for the Sheffield Mills eagle gatherings and winter seal haul-outs."},
            {question: "Is Shubenacadie Wildlife Park worth visiting?", answer: "Yes, especially with children. It is a provincial park of mostly native species, including moose, cougar, lynx, black bear, Arctic wolf and a swift fox breeding programme, 40 minutes from Halifax."}
        ]
    },
    {
        slug: "alberta",
        name: "Alberta",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "CA",
        parentSlug: "canada",
        coordinate: {lat: 54.5, lng: -115.0, zoom: 5},
        captureArea: {bbox: {north: 60.1, south: 48.9, east: -109.9, west: -120.1}},
        title: "Animals in Alberta: What You Can Spot, Learn, and Collect",
        description: "Alberta wildlife guide: Banff and Jasper elk, grizzlies and bighorn sheep, Elk Island bison, Icefields Parkway mountain goats, great gray owls and the deer and hawks of Wetaskiwin farmland.",
        searchIntents: [
            "animals in Alberta",
            "wildlife in Alberta",
            "what animals can be found in Alberta",
            "what wildlife is there in Alberta",
            "what animals can you see in Banff and Jasper",
            "Alberta wildlife travel"
        ],
        quickAnswer: "Alberta's Rocky Mountain parks are the most reliable large-mammal viewing in Canada: elk in the Banff and Jasper townsites, bighorn sheep on the roadsides, mountain goats at the Icefields Parkway goat lick, grizzly and black bears on the Bow Valley Parkway in spring, and marmots and pikas above treeline. Elk Island National Park near Edmonton guarantees bison, and the farmland around Wetaskiwin gives deer, hawks and great gray owls.",
        introduction: [
            "Banff and Jasper together cover more than 17,000 square kilometres of protected mountains with a highway running through the middle, so the animals are used to cars. Elk calve in Jasper's townsite, bighorns lick salt off the Highway 1A asphalt, and bears graze the dandelions on the road verges in May.",
            "The parkland and prairie to the east are quieter but just as alive. Elk Island National Park protects plains and wood bison 35 minutes from Edmonton, and the aspen farmland around Wetaskiwin and Camrose is where AnimalDex users have logged honey bees, horse flies and harvestmen alongside deer and hawks."
        ],
        whyItMatters: [
            "Elk Island's plains bison, descended from the Pablo-Allard herd bought from Montana in 1907, have seeded conservation herds across Canada and beyond, so seeing its animals is seeing the species' recovery at its root.",
            "Alberta also has the world's densest known concentration of migrating golden eagles. Several thousand pass the Mount Lorette count site in Kananaskis each March and October, a spectacle most visitors never hear about."
        ],
        animalsToSpot: [
            {speciesSlug: "grizzly-bear", whyItFits: "Grazes dandelions and horsetail on the Bow Valley Parkway and the Icefields Parkway in May and June, and digs for roots on avalanche slopes in Kananaskis.", rarityHint: "Realistic in Banff and Jasper from May to June and again in September; a telephoto and a closed car window are mandatory."},
            {speciesSlug: "elk", whyItFits: "Jasper's townsite herd calves on the school fields in June and bugles across the Athabasca flats in September; Banff's herd grazes the golf course.", rarityHint: "Guaranteed in Jasper and Banff townsites; keep 30 metres away, cows with calves charge."},
            {speciesSlug: "american-bison", whyItFits: "Elk Island National Park near Edmonton keeps plains bison north of Highway 16 and wood bison south of it, often on the Bison Loop Road.", rarityHint: "Near-guaranteed on the Bison Loop at Elk Island, especially early morning."},
            {speciesSlug: "bighorn-sheep", whyItFits: "Licks road salt on Highway 1A near Lake Minnewanka, the Jasper east gate and the Highway 16 roadside at Disaster Point.", rarityHint: "Near-guaranteed at Lake Minnewanka and Disaster Point year-round."},
            {speciesSlug: "mountain-goat", whyItFits: "Comes down to the mineral lick above the Athabasca River at the Goats and Glaciers viewpoint on the Icefields Parkway south of Jasper.", rarityHint: "Likely at the goat lick in June and July; otherwise on cliffs above the parkway."},
            {speciesSlug: "moose", whyItFits: "Browses the willow flats around Maligne Lake, Moose Lake and the Vermilion Lakes at dawn, and wanders Elk Island's wetlands.", rarityHint: "Uncommon; dawn at Maligne Lake road or Moose Lake gives the best odds."},
            {speciesSlug: "american-black-bear", whyItFits: "More common than grizzlies and often cinnamon or blond in Alberta, feeding on roadside buffaloberry along the Icefields Parkway in August.", rarityHint: "Likely in Jasper from May to September; the Maligne Lake road is reliable."},
            {speciesSlug: "hoary-marmot", whyItFits: "Whistles from boulders at Sunshine Meadows, the Whistlers summit above Jasper and the Parker Ridge trail, which is how the Whistlers got their name.", rarityHint: "Common above treeline from June to September."},
            {speciesSlug: "american-pika", whyItFits: "Scurries through talus beside the Parker Ridge and Wilcox Pass trails with mouthfuls of wildflowers for its winter hay pile.", rarityHint: "Common in alpine boulder fields; sit still and wait for the squeak."},
            {speciesSlug: "clarks-nutcracker", whyItFits: "Raids picnic tables at Lake Louise and Peyto Lake and caches whitebark pine seeds across the subalpine.", rarityHint: "Common at every high-elevation viewpoint."},
            {speciesSlug: "golden-eagle", whyItFits: "Thousands migrate along the Front Ranges each spring and autumn, counted from the Mount Lorette site in Kananaskis since 1992.", rarityHint: "Reliable at Mount Lorette in late March and October; scan the ridgelines mid-morning."},
            {speciesSlug: "great-gray-owl", whyItFits: "Alberta's provincial bird hunts the aspen parkland and farm edges around Wetaskiwin, Camrose and Edmonton, perching low on fence posts at dusk.", rarityHint: "Uncommon; winter dusk drives on parkland back roads give the best chance."},
            {speciesSlug: "mule-deer", whyItFits: "Stands in the Wetaskiwin stubble fields and Banff's residential streets with equal composure, and bounds away stiff-legged.", rarityHint: "Common across the province."},
            {speciesSlug: "horse-fly", whyItFits: "Big biting flies of Alberta's summer farmland and lakeshores, logged here by AnimalDex users around Wetaskiwin and impossible to ignore in July.", rarityHint: "Common near livestock and lakes in July and August."}
        ],
        bestFor: [
            "Roadside bears, elk and bighorn sheep in Banff and Jasper",
            "Guaranteed bison at Elk Island near Edmonton",
            "Alpine marmots, pikas and mountain goats",
            "Golden eagle migration and parkland owls"
        ],
        spottingTips: [
            "Drive the Bow Valley Parkway (Highway 1A) and the Icefields Parkway at dawn in late May or June for bears; stay in the vehicle, and never stop in a way that blocks traffic or crowds the animal.",
            "At Elk Island, take the Bison Loop Road off Highway 16 first thing in the morning, then walk the Living Waters boardwalk for beavers and waterfowl.",
            "For mountain goats, park at the Goats and Glaciers viewpoint on the Icefields Parkway in June or July and look down to the grey mineral lick on the riverbank.",
            "Carry bear spray on every trail in the mountain parks and know how to use it; it is sold in Banff and Jasper and can be rented."
        ],
        relatedLocationSlugs: ["canada", "british-columbia", "north-dakota"],
        rankingSlugs: ["strongest-animals"],
        challengeSlugs: ["grizzly-bear-vs-wolverine", "moose-vs-elk"],
        faq: [
            {question: "What wildlife is there in Alberta?", answer: "Grizzly and black bears, elk, moose, bighorn sheep, mountain goats, wolves, cougars, marmots and pikas in the Rockies; plains and wood bison at Elk Island; mule and white-tailed deer, coyotes, great gray owls and hawks in the parkland and prairie; and pronghorn and rattlesnakes in the dry southeast."},
            {question: "What animals can be found in Alberta's Banff and Jasper national parks?", answer: "Elk and bighorn sheep are near-guaranteed, black and grizzly bears are realistic on the parkways in late spring, mountain goats come to the Icefields Parkway lick in summer, and marmots, pikas and nutcrackers are common above treeline. Wolves, cougars and wolverines are present but rarely seen."},
            {question: "Where can you see bison in Alberta?", answer: "Elk Island National Park, 35 minutes east of Edmonton, is the most reliable place, with plains bison on the Bison Loop Road and wood bison in the southern section. Banff's Panther Valley also has a reintroduced wild herd reachable only on foot."},
            {question: "Is it safe to see bears in Alberta?", answer: "Yes from a vehicle, which is how most sightings happen. On trails, hike in groups, make noise, carry bear spray and keep 100 metres from any bear. Bear jams on the parkways are policed and you should stay inside the car."}
        ]
    },
    {
        slug: "ontario",
        name: "Ontario",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "CA",
        parentSlug: "canada",
        coordinate: {lat: 50.0, lng: -85.0, zoom: 4},
        captureArea: {bbox: {north: 57.0, south: 41.6, east: -74.2, west: -95.3}},
        title: "Animals in Ontario: What You Can Spot, Learn, and Collect",
        description: "Ontario wildlife guide: Algonquin moose and wolf howls, Toronto raccoons and the Toronto Zoo, Point Pelee's monarch and warbler migrations, loons on cottage lakes and polar bears on Hudson Bay.",
        searchIntents: [
            "animals in Ontario",
            "wildlife in Ontario",
            "what animals can be found in Ontario",
            "what wildlife is there in Ontario",
            "what animals can you see in Algonquin Park",
            "Ontario wildlife travel"
        ],
        quickAnswer: "Ontario is Algonquin Park moose in roadside bogs, wolf howls on August nights, loons on every cottage lake and beavers in every creek, with white-tailed deer, raccoons, chipmunks, robins and Canada geese filling the cities. Point Pelee in the far south funnels warblers in May and monarchs in September, and the far north has polar bears on Hudson Bay at Polar Bear Provincial Park.",
        introduction: [
            "Algonquin Provincial Park is three hours from Toronto and has the most dependable moose viewing in eastern Canada. In May and June the animals stand in the roadside ditches along Highway 60 licking winter salt, and the park's public wolf howls in August draw thousands of people to hear a pack answer a ranger.",
            "At the other end of the province, Toronto is often called the raccoon capital of the world, with Canada geese on every lawn, and a zoo that breeds black-footed ferrets and polar bears. The Donkey Sanctuary of Canada near Guelph rounds out an unusually animal-friendly corner of the country."
        ],
        whyItMatters: [
            "Point Pelee National Park is the southernmost tip of mainland Canada and the best-known migration trap in the country. The Festival of Birds in May regularly tops 100 species in a day, and in September monarchs cluster on the tip's trees before crossing Lake Erie.",
            "Ontario also holds a population of polar bears that live on land for months at a time, at Polar Bear Provincial Park on Hudson Bay. Few visitors reach it, but it makes Ontario one of the only places where a wildlife list can include both polar bears and hummingbirds."
        ],
        animalsToSpot: [
            {speciesSlug: "moose", whyItFits: "Algonquin's Highway 60 corridor is famous for moose in the roadside bogs in May and June, and the park's canoe routes add bulls feeding in beaver ponds all summer.", rarityHint: "Near-guaranteed at dawn along Highway 60 in late May; common by canoe all summer."},
            {speciesSlug: "wolf", whyItFits: "Algonquin's eastern wolves answer rangers at the public wolf howls on August Thursdays, one of the most popular wildlife events in Canada.", rarityHint: "Heard far more than seen; the August howls succeed most years."},
            {speciesSlug: "american-black-bear", whyItFits: "Common across the Canadian Shield from Algonquin to Thunder Bay, where they feed on blueberries along logging roads in August.", rarityHint: "Possible in Algonquin campgrounds; likely on northern roads in berry season."},
            {speciesSlug: "common-loon", whyItFits: "The provincial bird, calling across Algonquin and Muskoka lakes from ice-out to October and printed on the one-dollar coin for a reason.", rarityHint: "Guaranteed on any clear northern lake."},
            {speciesSlug: "north-american-beaver", whyItFits: "Dams every Algonquin creek and slaps its tail at paddlers; the Beaver Pond Trail off Highway 60 passes active lodges.", rarityHint: "Likely at dusk on the Beaver Pond Trail and from any canoe route."},
            {speciesSlug: "polar-bear", whyItFits: "Lives wild along Ontario's Hudson Bay coast in Polar Bear Provincial Park, and the Toronto Zoo's Tundra Trek is where most Ontarians meet one.", rarityHint: "Guaranteed at the Toronto Zoo; wild bears require a chartered flight to the far north."},
            {speciesSlug: "white-tailed-deer", whyItFits: "Grazes Ottawa's Greenbelt, the Toronto ravines and farm edges from Windsor to Sudbury at dusk.", rarityHint: "Guaranteed at dawn and dusk across southern Ontario."},
            {speciesSlug: "north-american-raccoon", whyItFits: "Toronto's raccoons defeat every green bin the city designs and den in garages across the GTA, at some of the highest urban densities ever recorded.", rarityHint: "Guaranteed in Toronto after dark."},
            {speciesSlug: "canada-goose", whyItFits: "Patrols every Toronto waterfront lawn and Ottawa canal bank, and is one of the most-logged Ontario animals in AnimalDex.", rarityHint: "Guaranteed year-round in the cities."},
            {speciesSlug: "american-robin", whyItFits: "The spring arrival every Ontarian waits for, hopping across lawns in Guelph, Kingston and Toronto and logged repeatedly here.", rarityHint: "Guaranteed from March to November."},
            {speciesSlug: "monarch-butterfly", whyItFits: "Clusters by the thousand on the trees at Point Pelee's tip in mid-September, waiting for a north wind to cross Lake Erie.", rarityHint: "Reliable at Point Pelee in the first three weeks of September on cool mornings."},
            {speciesSlug: "ruby-throated-hummingbird", whyItFits: "Arrives at Point Pelee and Rondeau in early May and buzzes cottage feeders all summer from Muskoka to Thunder Bay.", rarityHint: "Common from May to September at any sugar-water feeder."},
            {speciesSlug: "snowy-owl", whyItFits: "Winters on the open fields of Amherst Island near Kingston and the Toronto waterfront in good years, sitting on fence posts and hay bales.", rarityHint: "Regular from December to March on Amherst Island; irruption years bring dozens."},
            {speciesSlug: "eastern-chipmunk", whyItFits: "Begs at every Algonquin picnic site and stuffs its cheeks on cottage decks across Muskoka.", rarityHint: "Guaranteed from April to October in any park."}
        ],
        bestFor: [
            "Roadside moose and wolf howls in Algonquin",
            "Loons, beavers and chipmunks on cottage lakes",
            "Spring warbler and autumn monarch migration at Point Pelee",
            "Toronto's raccoons, geese and the Toronto Zoo"
        ],
        spottingTips: [
            "Drive Algonquin's Highway 60 between the West Gate and Lake of Two Rivers at first light in late May; moose stand in the ditches and you should pull fully off the road to watch.",
            "The public wolf howls run on Thursday nights in August when a pack is near the highway; check the Visitor Centre board that afternoon and bring warm layers.",
            "At Point Pelee, take the first tram to the tip in the second week of May for warblers, or in mid-September on a cool, calm morning for monarchs on the cedars.",
            "For snowy owls, take the Amherst Island ferry from Millhaven on a clear winter day and drive the concession roads slowly, scanning fence posts and hay bales."
        ],
        relatedLocationSlugs: ["canada", "quebec", "michigan", "new-york"],
        challengeSlugs: ["moose-vs-wolf"],
        faq: [
            {question: "What wildlife is there in Ontario?", answer: "Moose, black bears, wolves, beavers, loons and otters on the Canadian Shield; white-tailed deer, raccoons, coyotes, foxes, chipmunks and squirrels in the south; polar bears, caribou and snow geese on the Hudson Bay coast; and world-class bird and monarch migration at Point Pelee."},
            {question: "What animals can be found in Ontario's Algonquin Park?", answer: "Moose are the headline and are near-guaranteed in late spring; beavers, loons, otters, chipmunks and red squirrels are everywhere; black bears and eastern wolves are present, with wolves heard at the August public howls far more often than seen."},
            {question: "Are there polar bears in Ontario?", answer: "Yes. Ontario's Hudson Bay and James Bay coast has a wild polar bear population protected in Polar Bear Provincial Park, reachable only by air. The Toronto Zoo and Cochrane's Polar Bear Habitat are where most visitors see them."},
            {question: "When is the best time to see moose in Ontario?", answer: "Late April to June along Algonquin's Highway 60, when moose come to the roadside ditches for salt. Early morning is best, and canoe trips give sightings all summer."}
        ]
    },
    {
        slug: "british-columbia",
        name: "British Columbia",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "CA",
        parentSlug: "canada",
        coordinate: {lat: 54.0, lng: -125.0, zoom: 5},
        captureArea: {bbox: {north: 60.1, south: 48.1, east: -113.9, west: -139.2}},
        title: "Animals in British Columbia: What You Can Spot, Learn, and Collect",
        description: "British Columbia wildlife guide: orcas and humpbacks in the Salish Sea and Johnstone Strait, grizzlies and spirit bears of the Great Bear Rainforest, Brackendale eagles, Adams River salmon and Vancouver Aquarium otters.",
        searchIntents: [
            "animals in British Columbia",
            "wildlife in British Columbia",
            "what animals can be found in British Columbia",
            "what wildlife is there in British Columbia",
            "what animals can you see in Vancouver",
            "British Columbia wildlife travel"
        ],
        quickAnswer: "British Columbia is the best place in North America for orcas, with resident and Bigg's pods in the Salish Sea off Victoria and Johnstone Strait off Telegraph Cove, plus humpbacks, grey whales and sea otters along Vancouver Island's west coast. Inland, grizzlies fish the salmon rivers of the Great Bear Rainforest, where one in ten black bears is a white spirit bear, and the Adams River sockeye run and Brackendale's winter eagle count round out the calendar.",
        introduction: [
            "The province's coast is 25,000 kilometres of fjords and islands where the food chain is visible: herring and salmon draw humpbacks, orcas, sea lions and eagles into the same channels, and a single day out of Telegraph Cove in August can produce all of them.",
            "The Great Bear Rainforest is the largest intact temperate rainforest on earth and the only home of the Kermode or spirit bear, a white-coated black bear. Guided trips from Klemtu and Bella Bella in September put you on salmon streams as the bears fish."
        ],
        whyItMatters: [
            "Johnstone Strait's Robson Bight is the only ecological reserve on earth created for orcas, where the northern residents rub on pebble beaches. Watching from a kayak or boat here is as close as the species gets to a sure thing anywhere.",
            "Brackendale, near Squamish, set the world record for a single-day bald eagle count at 3,769 in 1994, and every winter thousands still gather on the Squamish River to feed on spawned-out salmon within an hour of Vancouver."
        ],
        animalsToSpot: [
            {speciesSlug: "orca", whyItFits: "Northern resident pods hunt salmon in Johnstone Strait each summer, and Bigg's orcas take seals and porpoises in the Salish Sea off Victoria year-round.", rarityHint: "Near-guaranteed on a Telegraph Cove trip from July to September; very likely from Victoria most of the year."},
            {speciesSlug: "humpback-whale", whyItFits: "Returned in force since the 2000s and now feed throughout the Salish Sea and off Tofino, with bubble-net lunges seen off northern Vancouver Island.", rarityHint: "Likely on any whale trip from May to October."},
            {speciesSlug: "grizzly-bear", whyItFits: "Fishes the Atnarko River at Tweedsmuir, the Orford River near Campbell River and the Khutzeymateen inlet north of Prince Rupert, Canada's first grizzly sanctuary.", rarityHint: "Reliable on guided September trips from Campbell River and Bella Coola."},
            {speciesSlug: "american-black-bear", whyItFits: "The Great Bear Rainforest's spirit bears are white-coated black bears, and ordinary black bears flip rocks for crabs on the shores around Tofino at low tide.", rarityHint: "Common on Vancouver Island; spirit bears need a guided September trip to Gribbell or Princess Royal island."},
            {speciesSlug: "bald-eagle", whyItFits: "Brackendale on the Squamish River gathers thousands each winter, and eagles sit on every harbour piling from Vancouver to Prince Rupert.", rarityHint: "Guaranteed year-round on the coast; December to January is peak at Brackendale."},
            {speciesSlug: "sockeye-salmon", whyItFits: "The Adams River near Chase turns red with millions of spawning sockeye in dominant years, celebrated by the Salute to the Sockeye every fourth October.", rarityHint: "Spectacular in dominant years (2026, 2030); smaller runs every October."},
            {speciesSlug: "sea-otter", whyItFits: "Reintroduced from Alaska in the 1970s and now rafting in the kelp off Kyuquot and Tofino's outer islands, with the Vancouver Aquarium's rescued otters for everyone else.", rarityHint: "Likely on Kyuquot and Tofino boat trips; guaranteed at the Vancouver Aquarium."},
            {speciesSlug: "harbor-seal", whyItFits: "Hauls out on the log booms of False Creek, the rocks at Stanley Park and every marina float in the province.", rarityHint: "Guaranteed along any stretch of coast."},
            {speciesSlug: "giant-pacific-octopus", whyItFits: "The world's largest octopus dens in the rocky walls of Howe Sound and Saanich Inlet, a staple of Vancouver Island cold-water diving.", rarityHint: "Regular on dives at Whytecliff Park and Ogden Point; aquarium displays in Vancouver and Sidney."},
            {speciesSlug: "gray-whale", whyItFits: "Migrates past Tofino and Ucluelet in March, celebrated by the Pacific Rim Whale Festival, with a few dozen summering in Clayoquot Sound.", rarityHint: "Reliable from Tofino in March and April; summer residents likely on half-day trips."},
            {speciesSlug: "cougar", whyItFits: "Vancouver Island has the densest cougar population in North America, slipping through the rainforest around Port Alberni, Strathcona and even Victoria's suburbs.", rarityHint: "Rare to see; tracks on logging roads are the realistic find."},
            {speciesSlug: "mountain-goat", whyItFits: "Stands on the cliffs above the Sea to Sky Highway near Squamish and in the alpine of Mount Robson and the Kootenays.", rarityHint: "Regular with a scope from the Sea to Sky viewpoints; common in Mount Robson's alpine."},
            {speciesSlug: "wolf", whyItFits: "Coastal wolves swim between islands and eat salmon and barnacles on the Great Bear coast and Vancouver Island's Pacific Rim beaches.", rarityHint: "Rare; dawn on a remote west coast beach gives tracks and occasional sightings."},
            {speciesSlug: "banana-slug", whyItFits: "Grazes the trails of Stanley Park, Cathedral Grove and every coastal rainforest at a stately pace after rain.", rarityHint: "Common on damp days in coastal forest; scarce in dry August weeks."}
        ],
        bestFor: [
            "Orcas and humpbacks from Victoria and Telegraph Cove",
            "Grizzly and spirit bear salmon-stream viewing",
            "Winter eagle gatherings at Brackendale",
            "Salmon runs and cold-water marine life"
        ],
        spottingTips: [
            "For orcas, base at Telegraph Cove or Port McNeill in August and take a full-day boat or guided kayak trip toward Robson Bight; Victoria trips work from April to October for Bigg's orcas.",
            "Grizzly trips from Campbell River to the Orford River and Bute Inlet run in September and October when the salmon are in; book months ahead.",
            "At Brackendale, walk the dyke along Government Road in December or January and scan the cottonwoods across the Squamish River; the Eagle Run viewing shelter has volunteers with scopes.",
            "Check the Adams River run forecast before planning around it: the dominant-year runs in Roderick Haig-Brown Provincial Park are vastly larger than the off years."
        ],
        relatedLocationSlugs: ["canada", "alberta", "california", "hawaii"],
        rankingSlugs: ["smartest-animals", "biggest-animals"],
        challengeSlugs: ["orca-vs-great-white-shark", "cougar-vs-wolf"],
        faq: [
            {question: "What wildlife is there in British Columbia?", answer: "Orcas, humpback and grey whales, sea otters, sea lions and seals on the coast; grizzly, black and spirit bears, wolves, cougars, moose, elk and mountain goats inland; and vast runs of sockeye, chinook and coho salmon that draw thousands of bald eagles each winter."},
            {question: "What animals can be found in British Columbia around Vancouver?", answer: "Harbour seals in False Creek, bald eagles and great blue herons in Stanley Park, black bears and coyotes in the North Shore suburbs, humpbacks and orcas on half-day boat trips, and thousands of eagles at Brackendale near Squamish in winter."},
            {question: "Where can you see spirit bears in British Columbia?", answer: "Only in the Great Bear Rainforest, mainly on Gribbell and Princess Royal islands near Klemtu, on guided trips in September and early October run with the Kitasoo Xai'xais Nation. There are an estimated 100 to 400 spirit bears in total."},
            {question: "When is the best time for whale watching in British Columbia?", answer: "July to September for northern resident orcas in Johnstone Strait, May to October for humpbacks, March for the grey whale migration at Tofino, and most of the year for Bigg's orcas from Victoria."}
        ]
    },
    {
        slug: "quebec",
        name: "Quebec",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "CA",
        parentSlug: "canada",
        coordinate: {lat: 52.0, lng: -72.0, zoom: 4},
        captureArea: {bbox: {north: 62.7, south: 44.9, east: -57.0, west: -79.9}},
        title: "Animals in Quebec: What You Can Spot, Learn, and Collect",
        description: "Quebec wildlife guide: Tadoussac belugas and blue whales, Bonaventure Island's gannets, Cap Tourmente snow geese, Forillon moose and seals, Parc Omega's wolves and bison, and winter snowy owls.",
        searchIntents: [
            "animals in Quebec",
            "wildlife in Quebec",
            "what animals can be found in Quebec",
            "what wildlife is there in Quebec",
            "animaux du Québec",
            "what animals can you see in Tadoussac",
            "Quebec wildlife travel"
        ],
        quickAnswer: "Quebec's St. Lawrence estuary is one of the great whale-watching rivers of the world: belugas live year-round off Tadoussac and the Saguenay fjord, and humpbacks, fin, minke and even blue whales feed there from June to October. Add 100,000 northern gannets on Bonaventure Island, hundreds of thousands of snow geese at Cap Tourmente in October, moose and seals in Forillon National Park, and snowy owls on the winter fields around Montreal.",
        introduction: [
            "Where the Saguenay fjord meets the St. Lawrence at Tadoussac, cold upwelling water feeds krill and capelin, and the whales follow. The Saguenay-St. Lawrence Marine Park is the only place in the world to see belugas this far south, and the shore at Cap de Bon-Désir lets you watch minkes from the rocks without a boat.",
            "The Gaspé Peninsula continues the show: Bonaventure Island off Percé holds the most accessible gannet colony on earth, and Forillon National Park's cliffs have grey and harbour seals, moose, black bears and porcupines within a day's walk."
        ],
        whyItMatters: [
            "The St. Lawrence belugas are an isolated, endangered population of under 1,000, and Tadoussac is the only place where ordinary visitors can see belugas from a kayak or a shoreline. Strict approach rules exist precisely because the population is fragile.",
            "Parc Omega near Montebello, between Montreal and Ottawa, lets a car drive through a 2,200-acre park of wolves, bison, elk, moose and bears, which makes it the most reliable way in eastern Canada to see every large mammal of the boreal forest in a single afternoon."
        ],
        animalsToSpot: [
            {speciesSlug: "beluga-whale", whyItFits: "The endangered St. Lawrence population lives year-round around the Saguenay fjord mouth, surfacing in white pods off Baie-Sainte-Catherine and Pointe-Noire.", rarityHint: "Likely from shore at Pointe-Noire or on a Tadoussac boat trip from June to October; boats must keep 400 metres."},
            {speciesSlug: "humpback-whale", whyItFits: "Feeds off Tadoussac and Les Escoumins from June to October, breaching and tail-slapping within sight of the zodiacs.", rarityHint: "Near-guaranteed on a Tadoussac whale trip in July and August."},
            {speciesSlug: "fin-whale", whyItFits: "The second-largest animal on earth surfaces in the deep channel off Les Bergeronnes and Les Escoumins all summer.", rarityHint: "Likely on a longer boat trip from July to September."},
            {speciesSlug: "common-minke-whale", whyItFits: "Hunts capelin so close to the rocks at Cap de Bon-Désir that the Parks Canada interpretation site lets you watch from the shore.", rarityHint: "Near-guaranteed from the Cap de Bon-Désir rocks in July and August."},
            {speciesSlug: "northern-gannet", whyItFits: "Bonaventure Island off Percé holds over 100,000 gannets on cliffs you can walk to within arm's reach, the largest accessible colony anywhere.", rarityHint: "Guaranteed on Bonaventure Island from May to September; boats from Percé."},
            {speciesSlug: "snow-goose", whyItFits: "Cap Tourmente National Wildlife Area east of Quebec City stages hundreds of thousands of greater snow geese on the tidal marsh each October and again in April.", rarityHint: "Guaranteed in the first three weeks of October at Cap Tourmente."},
            {speciesSlug: "snowy-owl", whyItFits: "Quebec's provincial bird winters on the open farmland of the Montérégie and the Montreal airport fields, sitting on snow-covered fence posts.", rarityHint: "Regular from December to March south of Montreal; irruption years bring dozens."},
            {speciesSlug: "moose", whyItFits: "Forillon National Park and Jacques-Cartier National Park have dense populations, with moose on the Forillon roadsides at dawn and in the Jacques-Cartier valley in autumn.", rarityHint: "Likely at dawn in Forillon from June to October."},
            {speciesSlug: "american-black-bear", whyItFits: "Feeds on the roadside clover of Forillon and the Laurentians in June, and in the blueberry barrens of the Saguenay-Lac-Saint-Jean in August.", rarityHint: "Possible in Forillon and the Laurentides reserve at dusk; common at Parc Omega."},
            {speciesSlug: "grey-seal", whyItFits: "Hauls out below Forillon's Cap Bon-Ami cliffs and on the Iles de la Madeleine, where the grey seal colony is one of the largest in the gulf.", rarityHint: "Common at Forillon from June to October; the Cap Bon-Ami lookout is reliable."},
            {speciesSlug: "atlantic-puffin", whyItFits: "Nests on the islands of the Mingan Archipelago on the north shore, reachable by boat from Longue-Pointe-de-Mingan and Havre-Saint-Pierre.", rarityHint: "Reliable on Mingan boat trips from June to August."},
            {speciesSlug: "north-american-beaver", whyItFits: "Canada's national animal dams the streams of every Quebec provincial park, from Mont-Tremblant to La Mauricie, and slaps its tail at canoeists at dusk.", rarityHint: "Common at dusk in La Mauricie and Mont-Tremblant."},
            {speciesSlug: "wolf", whyItFits: "Parc Omega's grey and Arctic wolf packs are seen from the car and the raised walkways, and wild wolves howl in the Laurentides and Papineau-Labelle reserves.", rarityHint: "Guaranteed at Parc Omega; wild wolves are rarely seen."},
            {speciesSlug: "american-bison", whyItFits: "Parc Omega's bison herd grazes beside the drive-through road near Montebello, with elk, wild boar and deer coming to the car for carrots.", rarityHint: "Guaranteed at Parc Omega on any day."}
        ],
        bestFor: [
            "Belugas and baleen whales at Tadoussac",
            "Gannets on Bonaventure Island and puffins at Mingan",
            "October snow geese at Cap Tourmente",
            "Parc Omega's drive-through boreal mammals"
        ],
        spottingTips: [
            "Stay in Tadoussac or Les Bergeronnes and take a zodiac in the morning when the water is calmer; then visit Cap de Bon-Désir and Pointe-Noire in the afternoon for free shore-based minkes and belugas.",
            "For Bonaventure Island, take the first boat from Percé, walk the Chemin du Roy trail to the colony, and plan at least two hours with the gannets.",
            "Cap Tourmente's geese peak around the second week of October; arrive at dawn when flocks lift off the marsh, and bring a scope for the thousands feeding on the bulrushes.",
            "Parc Omega sells bags of carrots at the gate; keep windows half-closed for the wild boar and never feed the bears or wolves, which are in separate enclosures."
        ],
        relatedLocationSlugs: ["canada", "ontario", "nova-scotia"],
        rankingSlugs: ["biggest-animals"],
        faq: [
            {question: "What wildlife is there in Quebec?", answer: "Belugas, humpbacks, fin, minke and blue whales in the St. Lawrence; gannets, puffins, seals and seabirds on the Gaspé and north shore; moose, black bears, beavers, lynx and wolves in the boreal forest; snow geese and snowy owls in migration and winter; and caribou and polar bears in the far north."},
            {question: "What animals can be found in Quebec's Tadoussac area?", answer: "Belugas year-round, minke whales from the rocks at Cap de Bon-Désir, humpbacks and fin whales on boat trips from June to October, occasional blue whales in late summer, plus harbour and grey seals, harbour porpoises and seabirds."},
            {question: "Can you see belugas in Quebec from shore?", answer: "Yes. The Pointe-Noire interpretation centre at Baie-Sainte-Catherine, the Tadoussac dunes and the Saguenay fjord lookouts regularly give shore sightings, especially on calm mornings from June to October."},
            {question: "Is Parc Omega worth visiting?", answer: "Yes if you want certainty. The drive-through route near Montebello passes bison, elk, moose, wild boar, deer and separate wolf and bear areas in about two hours, with walking trails and a wolf observatory. It sits halfway between Montreal and Ottawa."}
        ]
    },
    {
        slug: "nuevo-leon",
        name: "Nuevo León",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "MX",
        parentSlug: "mexico",
        coordinate: {lat: 25.6, lng: -99.9, zoom: 7},
        captureArea: {bbox: {north: 27.9, south: 23.1, east: -98.3, west: -101.3}},
        title: "Animals in Nuevo León: What You Can Spot, Learn, and Collect",
        description: "Nuevo León wildlife guide: Chipinque's black bears above Monterrey, Cumbres de Monterrey pumas and golden eagles, green jays and roadrunners, Texas tortoises, grackles, cicadas and jumping spiders.",
        searchIntents: [
            "animals in Nuevo León",
            "wildlife in Nuevo León",
            "what animals can be found in Nuevo León",
            "what wildlife is there in Nuevo León",
            "animales en Nuevo León",
            "fauna de Monterrey",
            "Nuevo León wildlife travel"
        ],
        quickAnswer: "Nuevo León is black bear country at the edge of a city of five million: bears walk through Chipinque Ecological Park and the San Pedro suburbs above Monterrey most summers. The Sierra Madre Oriental in Cumbres de Monterrey National Park adds pumas, white-tailed deer, javelinas, ringtails and golden eagles, and the dry brushland holds roadrunners, green jays, Texas tortoises, Great Plains toads and the grackles, cicadas and jumping spiders that users here log most.",
        introduction: [
            "Monterrey sits in a bowl of limestone mountains, and Cumbres de Monterrey National Park wraps around it with 177,000 hectares of pine-oak forest, canyons and desert scrub. Chipinque, the park's most visited corner, starts at the end of a San Pedro Garza García bus route and has bears on its trail cameras every week.",
            "East and north of the city the land flattens into Tamaulipan thornscrub, the same mesquite and prickly pear country that runs into south Texas. That brush gives Nuevo León its roadrunners, green jays, tortoises and the great-tailed grackles that roost in every Monterrey plaza."
        ],
        whyItMatters: [
            "Nuevo León's black bears are the most urban in Mexico. After decades of recovery they turn up in swimming pools, garages and on Chipinque's picnic tables, and the state runs a relocation programme that has made 'oso en Chipinque' a regular news item.",
            "The AnimalDex captures from here so far are brushland staples: a Texas tortoise, a Great Plains toad, a bold jumper spider, a green-winged cicada, mourning doves and grackles. It is a true picture of what a visitor meets on a warm evening in the Monterrey hills."
        ],
        animalsToSpot: [
            {speciesSlug: "american-black-bear", whyItFits: "Chipinque Ecological Park and the Sierra Madre above San Pedro Garza García have the most-watched urban bears in Mexico, raiding bins and crossing the park roads in summer.", rarityHint: "Realistic at Chipinque from May to October, especially at dawn; keep food locked away and never approach."},
            {speciesSlug: "white-tailed-deer", whyItFits: "The Texan subspecies browses the oak slopes of Cumbres de Monterrey and the ranchland around Santiago and Allende.", rarityHint: "Common at dawn and dusk in the park and on ranch roads."},
            {speciesSlug: "collared-peccary", whyItFits: "Javelina bands root through the thornscrub of the Sierra de Picachos and the canyons around Matacanes and Potrero Chico.", rarityHint: "Likely at dawn on backcountry roads in the brush country."},
            {speciesSlug: "ringtail", whyItFits: "A cat-sized relative of the raccoon with a banded tail, hunting the limestone cliffs of Huasteca canyon and Potrero Chico at night.", rarityHint: "Uncommon; climbers camping at Potrero Chico see them raiding food after dark."},
            {speciesSlug: "cougar", whyItFits: "Pumas range through the whole Sierra Madre Oriental and Cumbres de Monterrey, occasionally photographed on Chipinque's trail cameras.", rarityHint: "Rare to see; tracks in canyon sand are the realistic find."},
            {speciesSlug: "golden-eagle", whyItFits: "Mexico's national bird nests on the cliffs of the Sierra Madre and hunts the open brush east of the mountains.", rarityHint: "Regular over the Cumbres de Monterrey canyons; scan ridgelines mid-morning."},
            {speciesSlug: "green-jay", whyItFits: "A green, blue and yellow jay of the northeastern Mexican brushland, loud in the mesquite around Linares and in Monterrey's larger parks.", rarityHint: "Common in thornscrub and wooded parks; near-certain at Parque Fundidora and La Estanzuela."},
            {speciesSlug: "greater-roadrunner", whyItFits: "Sprints along dirt roads through the thornscrub north of Monterrey and around Mina and Garcia.", rarityHint: "Common in the open brush country; look along ranch tracks in the morning."},
            {speciesSlug: "great-tailed-grackle", whyItFits: "Thousands roost in the trees of Monterrey's Macroplaza and every mall parking lot at dusk, and they top the Nuevo León captures in AnimalDex.", rarityHint: "Guaranteed in any Monterrey plaza, loudest at sunset."},
            {speciesSlug: "mourning-dove", whyItFits: "Coos from power lines across the brushland and Monterrey suburbs, logged here alongside white-winged doves that are even more numerous.", rarityHint: "Abundant year-round."},
            {speciesSlug: "texas-tortoise", whyItFits: "A small, high-domed tortoise of the Tamaulipan thornscrub that crosses dirt roads after summer rain, and already logged in Nuevo León in AnimalDex.", rarityHint: "Uncommon; drive brush-country roads slowly after rain from May to September."},
            {speciesSlug: "great-plains-toad", whyItFits: "Emerges in explosive numbers on the first heavy summer rain to breed in roadside pools around Monterrey's outskirts.", rarityHint: "Seasonal; near-certain on the first warm rainy night of summer, invisible the rest of the year."},
            {speciesSlug: "bold-jumper", whyItFits: "A fuzzy black jumping spider with iridescent green fangs, patrolling garden walls and fences in the Monterrey suburbs.", rarityHint: "Common on sunny walls from spring to autumn."},
            {speciesSlug: "green-winged-cicada", whyItFits: "Fills the oaks of Chipinque and the mesquite of the lowlands with a shimmering buzz through the summer heat.", rarityHint: "Heard everywhere in summer; find them on tree trunks by tracing the sound."}
        ],
        bestFor: [
            "Urban black bears at Chipinque above Monterrey",
            "Canyon and cliff wildlife in Cumbres de Monterrey",
            "Thornscrub birds: green jays, roadrunners and doves",
            "Summer insects, toads and reptiles after rain"
        ],
        spottingTips: [
            "Enter Chipinque Ecological Park at opening and walk the upper roads toward the Meseta before the crowds; bears are most often reported at dawn near the picnic areas and bins.",
            "For canyon wildlife, do the Huasteca canyon or Potrero Chico road at first light; ringtails, deer and golden eagles use the cliffs before the heat builds.",
            "The first big thunderstorm of summer, usually in June, triggers toad breeding; drive the outskirts slowly that night and you will hear the choruses from the car.",
            "Monterrey's grackle roosts are loudest in the Macroplaza and Fundidora at sunset; they are easy captures and the surrounding trees hold green jays and doves."
        ],
        relatedLocationSlugs: ["mexico", "texas", "jalisco"],
        challengeSlugs: ["deer-vs-coyote"],
        faq: [
            {question: "What wildlife is there in Nuevo León?", answer: "Black bears, pumas, white-tailed deer, javelinas, ringtails, coyotes and bobcats in the Sierra Madre Oriental; golden eagles, green jays, roadrunners and doves in the brushland; and Texas tortoises, Great Plains toads, rattlesnakes, cicadas and jumping spiders after summer rain."},
            {question: "What animals can be found in Nuevo León around Monterrey?", answer: "Black bears at Chipinque Ecological Park and in the San Pedro foothills, white-tailed deer and golden eagles in Cumbres de Monterrey National Park, great-tailed grackles and green jays in the city parks, and ringtails and javelinas in the canyons at Huasteca and Potrero Chico."},
            {question: "Are there bears in Monterrey?", answer: "Yes. American black bears live in the Sierra Madre directly above the city and regularly enter Chipinque Ecological Park and the San Pedro Garza García suburbs, especially from May to October. Keep your distance and report sightings to park staff."},
            {question: "Is Cumbres de Monterrey National Park good for wildlife?", answer: "Yes, especially at dawn. The park's canyons and pine-oak slopes hold bears, deer, javelinas, ringtails, golden eagles and hundreds of bird species, and Chipinque, La Estanzuela and Huasteca are the accessible gateways from the city."}
        ]
    },
    {
        slug: "yucatan-peninsula",
        name: "Yucatán Peninsula",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "MX",
        parentSlug: "mexico",
        coordinate: {lat: 19.8, lng: -89.0, zoom: 6},
        captureArea: {bbox: {north: 21.8, south: 17.7, east: -86.5, west: -92.6}},
        title: "Animals in the Yucatán Peninsula: What You Can Spot, Learn, and Collect",
        description: "Yucatán Peninsula wildlife guide: whale sharks at Holbox, Celestún flamingos, spider monkeys at Punta Laguna, Sian Ka'an crocodiles and manatees, Calakmul jaguars, coatis and motmots at the ruins.",
        searchIntents: [
            "animals in the Yucatán Peninsula",
            "wildlife in the Yucatán",
            "what animals can be found in the Yucatán Peninsula",
            "what wildlife is there in the Yucatán Peninsula",
            "animales en Yucatán",
            "what animals can you see in Tulum and Cancún",
            "Yucatán wildlife travel"
        ],
        quickAnswer: "The Yucatán Peninsula packs whale sharks off Isla Holbox from June to September, spider monkeys at Punta Laguna, coatis and spiny-tailed iguanas on the ruins at Tulum and Cobá, crocodiles and manatees in Sian Ka'an, and pink flamingos at Celestún and Río Lagartos. The deep forest of Calakmul holds jaguars, toucans and agoutis, and every cenote has motmots calling from the rim.",
        introduction: [
            "Three Mexican states, Yucatán, Quintana Roo and Campeche, share a limestone shelf with no rivers, so the water runs underground and surfaces in cenotes. That geology shapes the wildlife: motmots nest in the sinkhole walls, bats pour out of the caves at dusk, and the coast's lagoons concentrate crocodiles, manatees and flamingos.",
            "Offshore, the plankton bloom off Isla Holbox and Isla Contoy draws the largest known whale shark aggregation on earth each summer, with hundreds of animals feeding at the surface alongside manta rays."
        ],
        whyItMatters: [
            "Calakmul Biosphere Reserve and the neighbouring forests of Campeche and Quintana Roo hold Mexico's largest jaguar population, and the Maya Train's wildlife crossings have made the peninsula's jaguars a national conservation debate.",
            "The peninsula is also where many visitors meet their first wild primate, tropical bird or crocodile. The AnimalDex captures from Quintana Roo so far, iguanas, grackles, egrets and doves, show how much of that wildlife starts in a hotel garden."
        ],
        animalsToSpot: [
            {speciesSlug: "whale-shark", whyItFits: "Hundreds gather to feed on plankton off Isla Holbox, Isla Contoy and Isla Mujeres from June to mid-September, the largest aggregation known anywhere.", rarityHint: "Near-guaranteed on licensed snorkel trips in July and August; the season is strictly June to September."},
            {speciesSlug: "jaguar", whyItFits: "Calakmul Biosphere Reserve in Campeche and the Sian Ka'an forests hold Mexico's biggest jaguar population, with camera traps on nearly every trail.", rarityHint: "Rare; dawn drives on the 60-kilometre Calakmul access road give a slim chance, tracks are common."},
            {speciesSlug: "spider-monkey", whyItFits: "Punta Laguna near Cobá is a community reserve where troops of Geoffroy's spider monkeys swing through the canopy over the lagoon, and Calakmul's ruins have them overhead.", rarityHint: "Near-guaranteed at Punta Laguna with a local guide, best in the early morning."},
            {speciesSlug: "white-nosed-coati", whyItFits: "Troops of coatis patrol the ruins of Tulum, Cobá and Chichén Itzá, raiding bins and begging in the car parks.", rarityHint: "Common at the major archaeological sites, especially mid-morning."},
            {speciesSlug: "american-crocodile", whyItFits: "Basks on the banks of the Río Lagartos and Celestún estuaries, Sian Ka'an's Muyil lagoon and the Nichupté lagoon behind Cancún's hotel zone.", rarityHint: "Likely on any Río Lagartos or Sian Ka'an boat tour; the Cancún lagoon has warning signs for a reason."},
            {speciesSlug: "keel-billed-toucan", whyItFits: "Croaks like a frog from the tall forest around the Calakmul ruins and the Bacalar lagoon in southern Quintana Roo.", rarityHint: "Regular at Calakmul and Bacalar; rare in the drier northern peninsula."},
            {speciesSlug: "turquoise-browed-motmot", whyItFits: "The Yucatán's toh bird, with racket-tipped tail feathers, nests in cenote walls and perches on the ruins at Uxmal and Dzibilchaltún.", rarityHint: "Common at cenotes and ruins across the peninsula; listen for the soft hoot."},
            {speciesSlug: "black-spiny-tailed-iguana", whyItFits: "Sprawls on every stone wall of the Tulum ruins and most hotel pool decks on the Riviera Maya, and is logged in Quintana Roo in AnimalDex.", rarityHint: "Guaranteed at Tulum and on the coast; midday is best."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Grazes the seagrass in Akumal Bay within metres of snorkellers and nests on the beaches of Xcacel and Tulum from May to October.", rarityHint: "Near-guaranteed at Akumal under the managed snorkel rules; nesting walks in summer."},
            {speciesSlug: "manatee", whyItFits: "Antillean manatees graze the Chetumal Bay sanctuary and Sian Ka'an's lagoons, where the community of Punta Allen runs boat tours.", rarityHint: "Uncommon; Chetumal Bay tours from Calderitas offer the best odds."},
            {speciesSlug: "spotted-eagle-ray", whyItFits: "Glides along the walls and sand flats of Cozumel's reefs and the shallow bay at Akumal, often in small groups in winter.", rarityHint: "Likely on Cozumel dives from December to March; occasional from the surface at Akumal."},
            {speciesSlug: "magnificent-frigatebird", whyItFits: "Hangs over the Holbox ferry, Isla Contoy and every fishing harbour, and the males inflate scarlet throats at the Contoy colony.", rarityHint: "Guaranteed along the entire coast."},
            {speciesSlug: "central-american-agouti", whyItFits: "A rabbit-sized rodent that trots across the Calakmul and Cobá trails at dawn and dusk, dropping seeds as it goes.", rarityHint: "Common at Calakmul and Cobá in the early morning."},
            {speciesSlug: "great-tailed-grackle", whyItFits: "The loud black bird of every plaza in Mérida, Valladolid and Playa del Carmen, and one of the first Quintana Roo captures in AnimalDex.", rarityHint: "Guaranteed in any town."}
        ],
        bestFor: [
            "Whale sharks and mantas off Holbox and Isla Mujeres",
            "Spider monkeys, coatis and motmots at the ruins and cenotes",
            "Crocodiles, flamingos and manatees in the coastal lagoons",
            "Deep-forest wildlife at Calakmul"
        ],
        spottingTips: [
            "Book whale shark trips with a licensed operator in Holbox, Cancún or Isla Mujeres between mid-June and early September; snorkel only, no touching, and the boats rotate to limit pressure.",
            "Go to Punta Laguna at opening (around 8 am) with a community guide; the spider monkeys feed in the canopy over the first kilometre of trail before the heat.",
            "Celestún and Río Lagartos flamingo and crocodile tours run from the village boat cooperatives; Celestún is best from November to March and Río Lagartos from April to October.",
            "For Calakmul, stay in Xpujil or the Conhuas cabins and drive the access road at first light; agoutis, toucans and turkeys are common and this is the only realistic jaguar window."
        ],
        relatedLocationSlugs: ["mexico", "jalisco", "nuevo-leon", "costa-rica"],
        rankingSlugs: ["biggest-animals"],
        challengeSlugs: ["jaguar-vs-crocodile"],
        faq: [
            {question: "What wildlife is there in the Yucatán Peninsula?", answer: "Jaguars, pumas, spider and howler monkeys, coatis, agoutis and tapirs in the forest; toucans, motmots, flamingos and ocellated turkeys among the birds; crocodiles, iguanas and sea turtles on the coast; and whale sharks, manta rays, eagle rays and manatees in the sea and lagoons."},
            {question: "What animals can be found in the Yucatán Peninsula's Tulum and Cancún area?", answer: "Spiny-tailed iguanas and coatis at the Tulum ruins, green sea turtles at Akumal, crocodiles in Cancún's Nichupté lagoon, motmots and bats at the cenotes, frigatebirds and pelicans on the beach, and spider monkeys an hour inland at Punta Laguna."},
            {question: "When can you swim with whale sharks in the Yucatán?", answer: "From mid-June to mid-September, peaking in July and August, off Isla Holbox, Isla Contoy and Isla Mujeres. Trips are strictly regulated: snorkel only, two swimmers and a guide at a time, no touching."},
            {question: "Can you see flamingos in the Yucatán?", answer: "Yes. The American flamingo breeds at Río Lagartos on the north coast and winters in large numbers at Celestún on the west coast, with boat tours from both villages."}
        ]
    },
    {
        slug: "jalisco",
        name: "Jalisco",
        regionType: "region",
        hubRegion: "north-america",
        countryCode: "MX",
        parentSlug: "mexico",
        coordinate: {lat: 20.6, lng: -103.7, zoom: 7},
        captureArea: {bbox: {north: 22.9, south: 18.8, east: -101.4, west: -105.8}},
        title: "Animals in Jalisco: What You Can Spot, Learn, and Collect",
        description: "Jalisco wildlife guide: humpback whales in Banderas Bay, olive ridley turtle releases in Puerto Vallarta, Marietas boobies, Lake Chapala's pelicans, beaded lizards in the Sierra Madre and the Guadalajara Zoo.",
        searchIntents: [
            "animals in Jalisco",
            "wildlife in Jalisco",
            "what animals can be found in Jalisco",
            "what wildlife is there in Jalisco",
            "animales en Jalisco",
            "what animals can you see in Puerto Vallarta",
            "Jalisco wildlife travel"
        ],
        quickAnswer: "Jalisco's wildlife centres on Banderas Bay, where humpback whales breed from December to March, olive ridley turtles nest on the Puerto Vallarta beaches in summer, crocodiles live in the El Salado estuary, and blue-footed boobies nest on the Islas Marietas. Inland, Lake Chapala's Petatán draws thousands of American white pelicans each winter, the Sierra Madre holds beaded lizards and coatis, and the Guadalajara Zoo covers the rest.",
        introduction: [
            "Banderas Bay is one of the largest bays on the Pacific coast of the Americas and a humpback whale nursery. Mothers with calves rest in its sheltered water each winter, and boats from Puerto Vallarta and Nuevo Vallarta find them within minutes of the marina.",
            "Inland Jalisco is highland Mexico: agave fields around Tequila, pine-oak Sierra Madre, and Lake Chapala, the country's largest lake. The fishing village of Petatán on the lake's south shore has a winter pelican spectacle that most tourists have never heard of."
        ],
        whyItMatters: [
            "Puerto Vallarta's hotel beaches are working turtle nesting grounds. Olive ridleys lay from July to December and the town's turtle camps release thousands of hatchlings at public evening events, which makes the species one of the most accessible sea turtles in the Americas.",
            "The Mexican beaded lizard, one of the few venomous lizards on earth, has its core range in the dry forest of Jalisco, and the Chamela-Cuixmala reserve on the Costalegre is one of the best-studied tropical dry forests anywhere."
        ],
        animalsToSpot: [
            {speciesSlug: "humpback-whale", whyItFits: "Breeds and calves in Banderas Bay from December to March, breaching off Puerto Vallarta's Malecón and resting with calves in the shallows near Punta Mita.", rarityHint: "Near-guaranteed on a bay trip from mid-December to mid-March."},
            {speciesSlug: "olive-ridley-sea-turtle", whyItFits: "Nests on the Puerto Vallarta hotel beaches and Boca de Tomates from July to December, with hatchling releases at Nuevo Vallarta and the Marriott turtle camp.", rarityHint: "Reliable at public hatchling releases from August to December; nesting females at night in September."},
            {speciesSlug: "blue-footed-booby", whyItFits: "Nests on the Islas Marietas off Punta Mita, where boat tours circle the cliffs and the famous hidden beach.", rarityHint: "Guaranteed on a Marietas tour from December to June."},
            {speciesSlug: "american-white-pelican", whyItFits: "Thousands winter at Petatán on Lake Chapala's south shore, where fishermen feed them fish scraps on the beach every morning.", rarityHint: "Guaranteed at Petatán from November to March."},
            {speciesSlug: "american-crocodile", whyItFits: "Lives in the El Salado mangrove estuary beside Puerto Vallarta's marina and in the Boca de Tomates river mouth by the airport.", rarityHint: "Likely on the El Salado estuary tour; the Boca de Tomates crocodile viewing platform is free."},
            {speciesSlug: "brown-pelican", whyItFits: "Sits on every panga in the Los Muertos pier area and plunge-dives beside swimmers across Banderas Bay.", rarityHint: "Guaranteed on the coast."},
            {speciesSlug: "magnificent-frigatebird", whyItFits: "Hangs over the Puerto Vallarta Malecón and the Marietas boats, stealing fish from boobies and pelicans.", rarityHint: "Guaranteed along the coast."},
            {speciesSlug: "mexican-beaded-lizard", whyItFits: "A heavy, venomous black and yellow lizard of the Jalisco dry forest, studied at the Chamela-Cuixmala biosphere reserve on the Costalegre.", rarityHint: "Rare; the rainy season (July to September) at Chamela gives the only realistic chance."},
            {speciesSlug: "green-iguana", whyItFits: "Lounges in the trees along Puerto Vallarta's Río Cuale and on hotel grounds, with a famous colony on the Isla Cuale island.", rarityHint: "Common in Puerto Vallarta; the Río Cuale bridges are near-certain."},
            {speciesSlug: "white-nosed-coati", whyItFits: "Troops cross the roads of the Sierra Madre above Puerto Vallarta, around El Tuito and in the Vallarta Botanical Garden grounds.", rarityHint: "Regular at the Botanical Garden and on mountain roads in the morning."},
            {speciesSlug: "great-kiskadee", whyItFits: "Shouts its name from every Guadalajara park and Chapala lakeshore tree, yellow belly and black mask unmistakable.", rarityHint: "Abundant across the state."},
            {speciesSlug: "crested-caracara", whyItFits: "Patrols the agave fields and ranchland around Tequila and Lake Chapala, walking the ground after insects and carrion.", rarityHint: "Common in open farmland; check fence posts and roadkill."},
            {speciesSlug: "mexican-paper-wasp", whyItFits: "Builds open comb nests under eaves and ruin walls across the Jalisco highlands, and is one of the Mexican captures logged in AnimalDex.", rarityHint: "Common in towns and gardens."},
            {speciesSlug: "giraffe", whyItFits: "The Guadalajara Zoo, Mexico's largest, runs a Masai safari drive with giraffes, zebras and rhinos on the edge of the Barranca de Huentitán.", rarityHint: "Guaranteed at the Guadalajara Zoo on any open day."}
        ],
        bestFor: [
            "Winter humpback whales in Banderas Bay",
            "Summer and autumn turtle releases in Puerto Vallarta",
            "Boobies and reef life at the Islas Marietas",
            "Lake Chapala pelicans and the Guadalajara Zoo"
        ],
        spottingTips: [
            "Book a small-boat whale trip from Marina Vallarta or La Cruz de Huanacaxtle between mid-December and mid-March; mornings are calmer and the calves are closest to Punta Mita.",
            "Check the turtle camp schedules at Nuevo Vallarta and the Marriott in Puerto Vallarta from August to December; releases happen at sunset and are free or by donation.",
            "At Petatán on Lake Chapala, arrive by 9 am when the fish-processing scraps go out and the pelicans crowd the shore; the village is an hour from Guadalajara via Jocotepec.",
            "The Boca de Tomates crocodile platform beside the Puerto Vallarta airport is free and reliable; stay on the platform, the animals are large and wild."
        ],
        relatedLocationSlugs: ["mexico", "yucatan-peninsula", "nuevo-leon"],
        rankingSlugs: ["biggest-animals"],
        faq: [
            {question: "What wildlife is there in Jalisco?", answer: "Humpback whales, dolphins, olive ridley turtles, crocodiles, boobies, frigatebirds and pelicans on the Banderas Bay coast; coatis, jaguarundis, white-tailed deer, beaded lizards and iguanas in the Sierra Madre and dry forest; and huge winter pelican flocks and kiskadees around Lake Chapala."},
            {question: "What animals can be found in Jalisco's Puerto Vallarta area?", answer: "Humpback whales from December to March, olive ridley turtles nesting from July to December, crocodiles at El Salado estuary and Boca de Tomates, green iguanas along the Río Cuale, coatis at the Botanical Garden, and blue-footed boobies on the Islas Marietas."},
            {question: "When is whale season in Puerto Vallarta?", answer: "Humpback whales are in Banderas Bay from early December to late March, with the official season running 8 December to 23 March. Mothers and calves are most visible from January to February."},
            {question: "Is Lake Chapala good for birds?", answer: "Yes, especially in winter. Petatán hosts thousands of American white pelicans from November to March, and the shoreline towns of Ajijic and Chapala add egrets, kiskadees, grebes and caracaras year-round."}
        ]
    },
    {
        slug: "hawaii",
        name: "Hawaii",
        regionType: "island",
        hubRegion: "north-america",
        countryCode: "US",
        parentSlug: "united-states",
        coordinate: {lat: 20.8, lng: -156.3, zoom: 7},
        captureArea: {bbox: {north: 22.5, south: 18.7, east: -154.5, west: -160.5}},
        title: "Animals in Hawaii: What You Can Spot, Learn, and Collect",
        description: "Hawaii wildlife guide: humpback whales off Maui, green sea turtles at Laniakea and Punaluʻu, Kona manta night dives, nene geese at Haleakalā, Kauai albatrosses, spinner dolphins and the islands' feral chickens, deer and chameleons.",
        searchIntents: [
            "animals in Hawaii",
            "wildlife in Hawaii",
            "what animals can be found in Hawaii",
            "what wildlife is there in Hawaii",
            "what animals can you see in Maui",
            "Hawaii wildlife travel"
        ],
        quickAnswer: "Hawaii's wildlife is mostly in the water: humpback whales fill the Maui channel from December to April, green sea turtles haul out on Oʻahu's Laniakea and the Big Island's Punaluʻu black sand, spinner dolphins rest in Kona's bays and reef mantas feed under the lights off Kona every night. On land the native nene goose grazes Haleakalā and Kīlauea, Laysan albatrosses nest on Kauai's north shore, and introduced chital deer, Jackson's chameleons, mynas and feral chickens are everywhere.",
        introduction: [
            "The Hawaiian Islands are the most isolated archipelago on earth, so the native land animals are birds, one bat and a monk seal, and most of what you meet on a hike was introduced. The honest Hawaii collection has both: a nene on a volcano and a chameleon in a Maui garden.",
            "The sea is where the islands are richest. Hawaiʻi Humpback Whale National Marine Sanctuary covers the shallow channel between Maui, Molokaʻi and Lānaʻi, and the Kona coast's calm leeward water gives the most dependable dolphin and manta encounters in the US."
        ],
        whyItMatters: [
            "The nene, Hawaii's state bird, dropped to about 30 birds in the 1950s. Captive breeding and release brought it back to over 3,000, and watching one graze a Haleakalā car park is watching one of the earliest bird rescues succeed.",
            "Hawaii is also the extinction capital of the United States, and the native forest birds, the honeycreepers, are retreating uphill ahead of mosquito-borne malaria. Seeing a scarlet ʻiʻiwi at Hosmer Grove or Hakalau is a privilege that may not last."
        ],
        animalsToSpot: [
            {speciesSlug: "humpback-whale", whyItFits: "Up to 10,000 North Pacific humpbacks winter in the shallow channel between Maui, Lānaʻi and Molokaʻi, breaching within sight of the Lahaina and Kīhei shorelines.", rarityHint: "Guaranteed from Maui boats and shoreline lookouts from January to March; season runs December to April."},
            {speciesSlug: "green-sea-turtle", whyItFits: "Honu haul out to bask on Laniakea Beach on Oʻahu's North Shore and the black sand at Punaluʻu on the Big Island, and graze algae off Maui's Maluaka Beach.", rarityHint: "Near-guaranteed at Laniakea and Punaluʻu; stay 3 metres back, it is the law."},
            {speciesSlug: "nene", whyItFits: "The world's rarest goose grazes the lawns of Haleakalā's summit road on Maui and the Kīlauea area of Hawaiʻi Volcanoes National Park, often beside the road signs that warn drivers about it.", rarityHint: "Reliable at Haleakalā's Hosmer Grove and park headquarters, and around Kīlauea."},
            {speciesSlug: "spinner-dolphin", whyItFits: "Pods rest by day in Kona's Kealakekua and Hōnaunau bays and off Lānaʻi's Hulopoʻe Beach after hunting offshore at night.", rarityHint: "Likely on Kona morning boat trips; swimming with them is now prohibited to let them rest."},
            {speciesSlug: "reef-manta-ray", whyItFits: "The Kona manta night dive and snorkel at Garden Eel Cove and Keauhou Bay draws mantas with wingspans over three metres to feed on plankton under dive lights.", rarityHint: "Very likely on the Kona night trips year-round; operators report mantas on over 90 percent of nights."},
            {speciesSlug: "yellow-tang", whyItFits: "Schools of bright yellow surgeonfish flash across every Kona and Maui reef and were the iconic fish of Hawaii's aquarium trade before collection was halted.", rarityHint: "Guaranteed on any reef snorkel; Kahaluʻu and Two Step are easy."},
            {speciesSlug: "tiger-shark", whyItFits: "Hawaii's apex reef predator, tagged extensively around Maui and Oʻahu and seen on cage-free shark dives off Haleʻiwa.", rarityHint: "Uncommon for snorkellers; realistic on Oʻahu North Shore shark boats."},
            {speciesSlug: "laysan-albatross", whyItFits: "Nests on Kauai's north shore at Kīlauea Point refuge and Princeville lawns, and on Oʻahu's Kaʻena Point, gliding past the cliffs on three-metre wings.", rarityHint: "Reliable from November to July at Kīlauea Point and Kaʻena Point."},
            {speciesSlug: "white-tailed-tropicbird", whyItFits: "Soars over the Kīlauea caldera in Hawaiʻi Volcanoes National Park and the cliffs of Kauai's Waimea Canyon, trailing long white tail streamers.", rarityHint: "Common over Kīlauea and Waimea Canyon lookouts."},
            {speciesSlug: "great-frigatebird", whyItFits: "The ʻiwa hangs over Kīlauea Point and the Mokulua islets off Oʻahu's Kailua, robbing boobies of their catch.", rarityHint: "Common at Kīlauea Point refuge and along windward coasts."},
            {speciesSlug: "chital", whyItFits: "Axis deer introduced in 1868 now number tens of thousands on Maui, Molokaʻi and Lānaʻi, grazing the Upcountry pastures and Lānaʻi's dry slopes at dusk.", rarityHint: "Common on Maui's Upcountry roads and across Lānaʻi at dawn and dusk."},
            {speciesSlug: "jacksons-chameleon", whyItFits: "Escaped from the pet trade in the 1970s and now creeps through hedges and gardens on Oʻahu, Maui and the Big Island, three horns and all.", rarityHint: "Uncommon; check hibiscus hedges in Kāneʻohe, Haʻikū and Kona slowly."},
            {speciesSlug: "red-junglefowl", whyItFits: "Kauai's famous feral chickens descend from Polynesian junglefowl and later farm escapes, and they crow in every car park from Lihue to Hanalei.", rarityHint: "Guaranteed on Kauai; common on the other islands."},
            {speciesSlug: "zebra-dove", whyItFits: "The small barred dove that walks between the tables at every beach café in Waikīkī and Lahaina, introduced in 1922 and now the islands' commonest bird.", rarityHint: "Guaranteed anywhere people eat outdoors."}
        ],
        bestFor: [
            "Winter humpback whales off Maui",
            "Green sea turtles from the beach",
            "Kona manta night snorkels and spinner dolphins",
            "Native nene, albatrosses and seabirds on the volcanoes and cliffs"
        ],
        spottingTips: [
            "For whales, take a morning boat from Lahaina or Māʻalaea in February, or sit at the McGregor Point lookout on Maui's Honoapiʻilani Highway with binoculars at first light.",
            "At Laniakea and Punaluʻu, stay behind the volunteers' rope and never touch or shade a basking turtle; fines are steep and the turtles leave if crowded.",
            "Book the Kona manta night trip for a calm night early in your stay so you can rebook if the swell cancels it; the Garden Eel Cove site near the airport is the most consistent.",
            "Walk Hosmer Grove at Haleakalā at dawn for nene and the surviving honeycreepers, and Kīlauea Point on Kauai mid-morning for albatrosses, tropicbirds and frigatebirds together."
        ],
        relatedLocationSlugs: ["united-states", "california", "british-columbia"],
        rankingSlugs: ["biggest-animals", "rarest-animals"],
        faq: [
            {question: "What wildlife is there in Hawaii?", answer: "Humpback whales, spinner dolphins, green sea turtles, Hawaiian monk seals, manta rays and reef fish in the sea; nene geese, albatrosses, tropicbirds, frigatebirds and endangered honeycreepers among the native birds; and introduced axis deer, mongooses, feral pigs, chickens, chameleons, mynas and doves on land."},
            {question: "What animals can be found in Hawaii on Maui?", answer: "Humpback whales from December to April, green turtles at Maluaka and Hoʻokipa, spinner dolphins off Lānaʻi, nene and honeycreepers at Haleakalā's Hosmer Grove, axis deer in the Upcountry pastures, and reef fish and the occasional monk seal at Molokini and Honolua Bay."},
            {question: "When is whale season in Hawaii?", answer: "Humpback whales are present from December to April, peaking from mid-January to mid-March, with the Maui-Lānaʻi-Molokaʻi channel the densest area and Oʻahu, Kauai and the Big Island all getting regular sightings."},
            {question: "Can you touch sea turtles in Hawaii?", answer: "No. Green sea turtles are protected under state and federal law and you must stay at least 10 feet (3 metres) away on land and in the water. Volunteers at Laniakea mark the distance with a rope."}
        ]
    }
];

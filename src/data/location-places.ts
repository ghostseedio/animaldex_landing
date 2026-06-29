export type WildlifePlaceType =
    | "zoo"
    | "aquarium"
    | "safari_park"
    | "wildlife_park"
    | "animal_sanctuary"
    | "wildlife_reserve"
    | "national_park"
    | "nature_reserve"
    | "wetland"
    | "forest"
    | "conservation_area"
    | "birding_site";

export type WildlifePlace = {
    name: string;
    slug?: string;
    type: WildlifePlaceType;
    locationName: string;
    region: string;
    country?: string;
    shortDescription: string;
    bestFor: string[];
    animalsToSpot: string[];
    relatedSpeciesSlugs: string[];
    officialWebsiteUrl?: string;
    image?: string;
    imageAlt?: string;
    coordinates?: {lat: number; lng: number};
    isCurated: boolean;
};

export type LocationPlaceCollections = {
    zoosAndParks?: WildlifePlace[];
    wildlifeReserves?: WildlifePlace[];
};

const place = (entry: WildlifePlace): WildlifePlace => entry;

const locationPlaceCollections: Record<string, LocationPlaceCollections> = {
    bali: {
        zoosAndParks: [
            place({name: "Bali Bird Park", type: "wildlife_park", locationName: "Gianyar", region: "Bali", country: "Indonesia", shortDescription: "A bird-focused wildlife park that gives visitors a practical way to study plumage, calls, and identification details across many avian groups.", bestFor: ["Bird identification", "Families", "Photography practice"], animalsToSpot: ["Bali myna", "Hornbills", "Parrots"], relatedSpeciesSlugs: ["bali-myna", "rhinoceros-hornbill"], isCurated: true}),
            place({name: "Bali Safari & Marine Park", type: "safari_park", locationName: "Gianyar", region: "Bali", country: "Indonesia", shortDescription: "A large animal park suited to broad species discovery and comparison. Use on-site interpretation to confirm the animals present during your visit.", bestFor: ["Broad animal discovery", "Families", "Full-day visits"], animalsToSpot: ["Lions", "Giraffes", "Zebras"], relatedSpeciesSlugs: ["lion", "giraffe", "plains-zebra"], isCurated: true})
        ],
        wildlifeReserves: [
            place({name: "West Bali National Park", type: "national_park", locationName: "Northwest Bali", region: "Bali", country: "Indonesia", shortDescription: "A protected landscape of forest, savanna, mangrove, and coastal habitat. Wildlife encounters depend on season, access, and patient observation.", bestFor: ["Birding", "Forest walks", "Coastal habitat"], animalsToSpot: ["Bali myna", "Kingfishers", "Macaques"], relatedSpeciesSlugs: ["bali-myna", "common-kingfisher"], isCurated: true}),
            place({name: "Nusa Penida Marine Protected Area", type: "conservation_area", locationName: "Nusa Penida", region: "Bali", country: "Indonesia", shortDescription: "A marine conservation area around the Nusa Penida islands, relevant for reef ecology and responsible observation of coastal and pelagic wildlife.", bestFor: ["Marine wildlife", "Snorkelling", "Reef ecology"], animalsToSpot: ["Green sea turtles", "Manta rays", "Reef fish"], relatedSpeciesSlugs: ["green-sea-turtle", "manta-ray", "clownfish"], isCurated: true})
        ]
    },
    "london-zoo": {
        zoosAndParks: [
            place({name: "London Zoo", type: "zoo", locationName: "London", region: "Greater London", country: "United Kingdom", shortDescription: "A central London conservation zoo where signs, habitat interpretation, and keeper-led information can support careful species identification.", bestFor: ["City visits", "Families", "Species learning"], animalsToSpot: ["Lions", "Gorillas", "Red pandas"], relatedSpeciesSlugs: ["lion", "western-lowland-gorilla", "red-panda"], isCurated: true}),
            place({name: "Whipsnade Zoo", type: "zoo", locationName: "Dunstable", region: "Near London", country: "United Kingdom", shortDescription: "A spacious zoo outside central London that works well for a longer animal-focused day and habitat-led observation.", bestFor: ["Full-day visits", "Large mammals", "Families"], animalsToSpot: ["Giraffes", "Rhinos", "Red pandas"], relatedSpeciesSlugs: ["giraffe", "white-rhinoceros", "red-panda"], isCurated: true})
        ],
        wildlifeReserves: [
            place({name: "Richmond Park", type: "nature_reserve", locationName: "Richmond", region: "Greater London", country: "United Kingdom", shortDescription: "A large urban park and protected landscape known for open grassland, veteran trees, and free-ranging deer. Visitors should keep a safe distance.", bestFor: ["Urban wildlife", "Deer observation", "Walking"], animalsToSpot: ["Red deer", "Waterfowl", "Woodland birds"], relatedSpeciesSlugs: ["red-deer", "european-robin"], isCurated: true}),
            place({name: "WWT London Wetland Centre", type: "wetland", locationName: "Barnes", region: "Greater London", country: "United Kingdom", shortDescription: "An accessible wetland reserve with hides and paths that support slower observation of waterbirds and seasonal wildlife.", bestFor: ["Birding", "Wetland wildlife", "Accessible observation"], animalsToSpot: ["Kingfishers", "Ducks", "Herons"], relatedSpeciesSlugs: ["common-kingfisher", "mandarin-duck", "great-blue-heron"], isCurated: true})
        ]
    },
    singapore: {
        zoosAndParks: [
            place({name: "Singapore Zoo", type: "zoo", locationName: "Mandai", region: "Singapore", country: "Singapore", shortDescription: "A major zoological park with interpretive displays that can support broad animal discovery and species comparison.", bestFor: ["Families", "Broad species discovery", "Full-day visits"], animalsToSpot: ["Orangutans", "Red pandas", "Large reptiles"], relatedSpeciesSlugs: ["orangutan", "red-panda", "king-cobra"], isCurated: true}),
            place({name: "River Wonders", type: "aquarium", locationName: "Mandai", region: "Singapore", country: "Singapore", shortDescription: "A river-themed wildlife park focused on freshwater habitats and the animals connected to major river systems.", bestFor: ["Freshwater ecology", "Aquatic animals", "Families"], animalsToSpot: ["Giant pandas", "Freshwater fish", "River reptiles"], relatedSpeciesSlugs: ["giant-panda", "king-cobra"], isCurated: true}),
            place({name: "Bird Paradise", type: "wildlife_park", locationName: "Mandai", region: "Singapore", country: "Singapore", shortDescription: "A bird-focused park designed around varied habitats, useful for comparing shape, colour, feeding behaviour, and calls.", bestFor: ["Bird identification", "Photography practice", "Families"], animalsToSpot: ["Parrots", "Cranes", "Waterbirds"], relatedSpeciesSlugs: ["red-crowned-crane", "mandarin-duck"], isCurated: true})
        ],
        wildlifeReserves: [
            place({name: "Sungei Buloh Wetland Reserve", type: "wetland", locationName: "Kranji", region: "Singapore", country: "Singapore", shortDescription: "A mangrove and wetland reserve where boardwalks and hides support responsible observation of birds, reptiles, and intertidal wildlife.", bestFor: ["Migratory birds", "Mangroves", "Boardwalk wildlife"], animalsToSpot: ["Kingfishers", "Monitor lizards", "Migratory shorebirds"], relatedSpeciesSlugs: ["common-kingfisher", "crocodile"], isCurated: true}),
            place({name: "Bukit Timah Nature Reserve", type: "forest", locationName: "Bukit Timah", region: "Singapore", country: "Singapore", shortDescription: "A compact protected rainforest landscape where quiet walking can reveal forest birds, insects, reptiles, and small mammals.", bestFor: ["Rainforest walks", "Urban nature", "Invertebrates"], animalsToSpot: ["Macaques", "Forest birds", "Reptiles"], relatedSpeciesSlugs: ["king-cobra", "cicada"], isCurated: true}),
            place({name: "Central Catchment Nature Reserve", type: "nature_reserve", locationName: "Central Singapore", region: "Singapore", country: "Singapore", shortDescription: "Singapore's largest connected nature reserve, with forest and reservoir-edge habitat best explored quietly on marked routes.", bestFor: ["Forest wildlife", "Longer walks", "Birding"], animalsToSpot: ["Macaques", "Kingfishers", "Forest reptiles"], relatedSpeciesSlugs: ["common-kingfisher", "reticulated-python"], isCurated: true})
        ]
    },
    indonesia: {
        zoosAndParks: [
            place({name: "Ragunan Zoo", type: "zoo", locationName: "Jakarta", region: "Java", country: "Indonesia", shortDescription: "A large city zoo with broad animal representation. On-site signs should be used to verify species and current exhibits.", bestFor: ["City visits", "Families", "Broad species discovery"], animalsToSpot: ["Orangutans", "Komodo dragons", "Large cats"], relatedSpeciesSlugs: ["orangutan", "komodo-dragon", "lion"], isCurated: true}),
            place({name: "Taman Safari Indonesia Bogor", type: "safari_park", locationName: "Bogor", region: "West Java", country: "Indonesia", shortDescription: "A drive-through and walking animal park that supports a broad day of species discovery near Jakarta and Bogor.", bestFor: ["Safari-style visits", "Families", "Large mammals"], animalsToSpot: ["Giraffes", "Zebras", "Lions"], relatedSpeciesSlugs: ["giraffe", "plains-zebra", "lion"], isCurated: true})
        ],
        wildlifeReserves: [
            place({name: "Komodo National Park", type: "national_park", locationName: "Lesser Sunda Islands", region: "East Nusa Tenggara", country: "Indonesia", shortDescription: "A protected island and marine landscape associated with Komodo dragons, dry savanna, reefs, and coastal wildlife.", bestFor: ["Komodo dragons", "Island landscapes", "Marine wildlife"], animalsToSpot: ["Komodo dragons", "Manta rays", "Sea turtles"], relatedSpeciesSlugs: ["komodo-dragon", "manta-ray", "green-sea-turtle"], isCurated: true}),
            place({name: "Ujung Kulon National Park", type: "national_park", locationName: "Banten", region: "Java", country: "Indonesia", shortDescription: "A remote protected landscape of rainforest, coast, and marine habitat. Wildlife observation requires realistic expectations and local guidance.", bestFor: ["Rainforest", "Coastal habitat", "Conservation learning"], animalsToSpot: ["Forest primates", "Hornbills", "Coastal wildlife"], relatedSpeciesSlugs: ["rhinoceros-hornbill", "green-sea-turtle"], isCurated: true})
        ]
    },
    australia: {
        zoosAndParks: [
            place({name: "Taronga Zoo Sydney", type: "zoo", locationName: "Sydney", region: "New South Wales", country: "Australia", shortDescription: "A harbour-side conservation zoo that supports broad species learning and close attention to identification details.", bestFor: ["City visits", "Families", "Australian wildlife"], animalsToSpot: ["Koalas", "Red kangaroos", "Giraffes"], relatedSpeciesSlugs: ["koala", "red-kangaroo", "giraffe"], isCurated: true}),
            place({name: "Australia Zoo", type: "zoo", locationName: "Beerwah", region: "Queensland", country: "Australia", shortDescription: "A large wildlife park with a strong focus on Australian animals and conservation interpretation.", bestFor: ["Australian wildlife", "Reptiles", "Families"], animalsToSpot: ["Koalas", "Kangaroos", "Crocodiles"], relatedSpeciesSlugs: ["koala", "red-kangaroo", "crocodile"], isCurated: true})
        ],
        wildlifeReserves: [
            place({name: "Kakadu National Park", type: "national_park", locationName: "Kakadu", region: "Northern Territory", country: "Australia", shortDescription: "A vast protected cultural landscape with wetlands, escarpments, woodland, and strong seasonal changes in wildlife activity.", bestFor: ["Wetlands", "Birding", "Reptiles"], animalsToSpot: ["Saltwater crocodiles", "Waterbirds", "Wallabies"], relatedSpeciesSlugs: ["crocodile", "red-kangaroo"], isCurated: true}),
            place({name: "Daintree National Park", type: "national_park", locationName: "Daintree", region: "Queensland", country: "Australia", shortDescription: "A tropical rainforest landscape where guided, low-impact observation can reveal birds, reptiles, insects, and unusual mammals.", bestFor: ["Rainforest", "Birding", "Guided wildlife walks"], animalsToSpot: ["Cassowaries", "Tree kangaroos", "Forest reptiles"], relatedSpeciesSlugs: ["southern-cassowary", "frilled-lizard"], isCurated: true})
        ]
    },
    kenya: {
        zoosAndParks: [
            place({name: "Nairobi Safari Walk", type: "wildlife_park", locationName: "Nairobi", region: "Nairobi County", country: "Kenya", shortDescription: "A raised-boardwalk wildlife experience that introduces Kenyan habitats and species in an accessible setting.", bestFor: ["Short visits", "Kenyan wildlife", "Conservation learning"], animalsToSpot: ["Rhinos", "Large cats", "Antelope"], relatedSpeciesSlugs: ["white-rhinoceros", "lion", "gerenuk"], isCurated: true}),
            place({name: "Giraffe Centre", type: "animal_sanctuary", locationName: "Nairobi", region: "Nairobi County", country: "Kenya", shortDescription: "A conservation education centre focused on giraffes. Follow staff guidance and treat any animal interaction as optional and welfare-led.", bestFor: ["Giraffe learning", "Families", "Conservation education"], animalsToSpot: ["Giraffes"], relatedSpeciesSlugs: ["giraffe", "gerenuk"], isCurated: true})
        ],
        wildlifeReserves: [
            place({name: "Maasai Mara National Reserve", type: "wildlife_reserve", locationName: "Maasai Mara", region: "Narok County", country: "Kenya", shortDescription: "A savanna reserve associated with large herbivores and predators. Sightings vary with season, location, and guide decisions.", bestFor: ["Savanna wildlife", "Guided drives", "Large mammals"], animalsToSpot: ["Lions", "Zebras", "Giraffes"], relatedSpeciesSlugs: ["lion", "plains-zebra", "giraffe"], isCurated: true}),
            place({name: "Amboseli National Park", type: "national_park", locationName: "Amboseli", region: "Kajiado County", country: "Kenya", shortDescription: "An open savanna and wetland park known for expansive views and opportunities to observe large mammals from a respectful distance.", bestFor: ["Elephants", "Landscape photography", "Birding"], animalsToSpot: ["Elephants", "Zebras", "Giraffes"], relatedSpeciesSlugs: ["elephant", "plains-zebra", "giraffe"], isCurated: true})
        ]
    },
    "south-africa": {
        zoosAndParks: [
            place({name: "National Zoological Garden", type: "zoo", locationName: "Pretoria", region: "Gauteng", country: "South Africa", shortDescription: "A long-established zoological garden suited to broad animal discovery and careful use of interpretive signage.", bestFor: ["Families", "City visits", "Broad species discovery"], animalsToSpot: ["Lions", "Giraffes", "Rhinos"], relatedSpeciesSlugs: ["lion", "giraffe", "white-rhinoceros"], isCurated: true}),
            place({name: "Johannesburg Zoo", type: "zoo", locationName: "Johannesburg", region: "Gauteng", country: "South Africa", shortDescription: "An urban zoo where visitors can compare a wide range of animal groups and practise identification without making assumptions about current exhibits.", bestFor: ["City visits", "Families", "Species comparison"], animalsToSpot: ["Lions", "Zebras", "Giraffes"], relatedSpeciesSlugs: ["lion", "plains-zebra", "giraffe"], isCurated: true})
        ],
        wildlifeReserves: [
            place({name: "Kruger National Park", type: "national_park", locationName: "Northeastern South Africa", region: "Limpopo and Mpumalanga", country: "South Africa", shortDescription: "A large protected savanna system where patient drives can reveal mammals, birds, reptiles, and complex predator-prey relationships.", bestFor: ["Savanna wildlife", "Self-drive routes", "Birding"], animalsToSpot: ["Lions", "Elephants", "Rhinos"], relatedSpeciesSlugs: ["lion", "elephant", "white-rhinoceros"], isCurated: true}),
            place({name: "iSimangaliso Wetland Park", type: "wetland", locationName: "KwaZulu-Natal", region: "KwaZulu-Natal", country: "South Africa", shortDescription: "A protected mosaic of lakes, wetlands, coast, forest, and marine habitat supporting varied wildlife observation.", bestFor: ["Wetlands", "Coastal wildlife", "Birding"], animalsToSpot: ["Hippos", "Crocodiles", "Sea turtles"], relatedSpeciesSlugs: ["hippopotamus", "crocodile", "green-sea-turtle"], isCurated: true})
        ]
    },
    japan: {
        zoosAndParks: [
            place({name: "Ueno Zoo", type: "zoo", locationName: "Tokyo", region: "Kanto", country: "Japan", shortDescription: "A central Tokyo zoo that can anchor a compact animal-focused city day, with signage used to confirm species and current displays.", bestFor: ["City visits", "Families", "Species learning"], animalsToSpot: ["Giant pandas", "Red pandas", "Cranes"], relatedSpeciesSlugs: ["giant-panda", "red-panda", "red-crowned-crane"], isCurated: true}),
            place({name: "Tama Zoological Park", type: "zoo", locationName: "Hino", region: "Tokyo", country: "Japan", shortDescription: "A larger zoological park in western Tokyo suited to a slower day of habitat-led animal observation.", bestFor: ["Full-day visits", "Families", "Animal behaviour"], animalsToSpot: ["Red pandas", "Large mammals", "Birds"], relatedSpeciesSlugs: ["red-panda", "red-crowned-crane"], isCurated: true})
        ],
        wildlifeReserves: [
            place({name: "Kushiro-shitsugen National Park", type: "wetland", locationName: "Kushiro", region: "Hokkaido", country: "Japan", shortDescription: "A broad wetland landscape where observation points and seasonal timing shape opportunities to see cranes and other marsh wildlife.", bestFor: ["Cranes", "Wetlands", "Winter wildlife"], animalsToSpot: ["Red-crowned cranes", "Waterbirds", "Deer"], relatedSpeciesSlugs: ["red-crowned-crane", "sika-deer"], isCurated: true}),
            place({name: "Shiretoko National Park", type: "national_park", locationName: "Shiretoko Peninsula", region: "Hokkaido", country: "Japan", shortDescription: "A remote peninsula of forest, coast, and mountain habitat where wildlife viewing should be planned around local safety guidance.", bestFor: ["Coastal wildlife", "Forest habitat", "Guided observation"], animalsToSpot: ["Deer", "Sea eagles", "Marine mammals"], relatedSpeciesSlugs: ["sika-deer", "golden-eagle", "orca"], isCurated: true})
        ]
    }
};

export function getLocationPlaceCollections(locationSlug: string): LocationPlaceCollections {
    return locationPlaceCollections[locationSlug] || {};
}

export function getPlaceGuideLocationName(locationSlug: string, fallbackName: string) {
    if (locationSlug === "london-zoo") return "London";
    if (locationSlug === "singapore-zoo") return "Singapore";
    return fallbackName;
}

export function isPlaceCollectionIndexable(places?: WildlifePlace[]) {
    const curated = (places || []).filter((entry) => entry.isCurated);
    if (curated.length >= 2) return true;
    if (curated.length !== 1) return false;

    const [entry] = curated;
    return entry.shortDescription.trim().length >= 80 && entry.relatedSpeciesSlugs.length >= 2;
}

export function getUniquePlaceSpeciesSlugs(places: WildlifePlace[]) {
    return Array.from(new Set(places.flatMap((entry) => entry.relatedSpeciesSlugs)));
}

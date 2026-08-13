/**
 * Real coordinates for location guide maps.
 *
 * Geocoded from OpenStreetMap (Nominatim) and spot-checked by hand. Unlike the
 * stylised outlines in `location-maps.ts`, everything here is survey-real, so
 * pins land where the place actually is.
 */

export type LocationCoordinate = {
    lat: number;
    lng: number;
    /** Leaflet zoom that frames the location sensibly. */
    zoom: number;
    /** What the geocoder resolved to, kept for auditing. */
    resolved: string;
};

export const locationCoordinates: Record<string, LocationCoordinate> = {
    "afghanistan": {lat: 33.76801, lng: 66.23851, zoom: 4, resolved: "افغانستان"},
    "african-safari": {lat: -2.3713, lng: 34.6984, zoom: 4, resolved: "Serengeti / East African savanna (representative)"},
    "australia": {lat: -24.77611, lng: 134.755, zoom: 2, resolved: "Australia"},
    "bali": {lat: -8.22713, lng: 115.19192, zoom: 7, resolved: "Bali, Indonesia"},
    "borneo": {lat: 1.42978, lng: 113.70905, zoom: 4, resolved: "Borneo / Kalimantan, Malaysia"},
    "brazil": {lat: -10.33333, lng: -53.2, zoom: 2, resolved: "Brasil"},
    "canada": {lat: 61.06669, lng: -107.99171, zoom: 2, resolved: "Canada"},
    "china": {lat: 34.54123, lng: 108.92371, zoom: 2, resolved: "中国"},
    "colombia": {lat: 4.09992, lng: -72.90881, zoom: 3, resolved: "Colombia"},
    "costa-rica": {lat: 10.27356, lng: -84.07391, zoom: 5, resolved: "Costa Rica"},
    "dubai": {lat: 25.07428, lng: 55.18856, zoom: 7, resolved: "دبي, الإمارات العربية المتحدة"},
    "ecuador": {lat: -1.33977, lng: -79.3667, zoom: 3, resolved: "Ecuador"},
    "germany": {lat: 51.16382, lng: 10.44783, zoom: 4, resolved: "Deutschland"},
    "iceland": {lat: 64.98418, lng: -18.1059, zoom: 4, resolved: "Ísland"},
    "india": {lat: 22.35111, lng: 78.66774, zoom: 3, resolved: "India"},
    "indonesia": {lat: -2.48338, lng: 117.89029, zoom: 2, resolved: "Indonesia"},
    "israel": {lat: 30.81242, lng: 34.85948, zoom: 6, resolved: "ישראל"},
    "jakarta": {lat: -6.1754, lng: 106.82717, zoom: 7, resolved: "Daerah Khusus Ibukota Jakarta, Indonesia"},
    "jamaica": {lat: 18.18505, lng: -77.39477, zoom: 6, resolved: "Jamaica"},
    "japan": {lat: 36.57484, lng: 139.23942, zoom: 3, resolved: "日本"},
    "kenya": {lat: 1.44197, lng: 38.4314, zoom: 4, resolved: "Kenya"},
    "komodo-national-park": {lat: -8.60699, lng: 119.57294, zoom: 9, resolved: "Taman Nasional Komodo, Manggarai Barat, Nusa Tenggara Timur, Indonesia"},
    "london-zoo": {lat: 51.53481, lng: -0.15481, zoom: 13, resolved: "London Zoo, Prince Albert Road, Marylebone, City of Westminster, Great"},
    "madagascar": {lat: -18.92496, lng: 46.44164, zoom: 4, resolved: "Madagasikara / Madagascar"},
    "mexico": {lat: 23.65851, lng: -102.00771, zoom: 2, resolved: "México"},
    "norway": {lat: 61.15294, lng: 8.78767, zoom: 2, resolved: "Norge"},
    "pakistan": {lat: 30.33084, lng: 71.2475, zoom: 3, resolved: "پاکستان"},
    "peru": {lat: -6.86997, lng: -75.04585, zoom: 3, resolved: "Perú"},
    "russia": {lat: 64.68631, lng: 97.74531, zoom: 2, resolved: "Россия"},
    "singapore": {lat: 1.35711, lng: 103.8195, zoom: 7, resolved: "Singapore"},
    "singapore-zoo": {lat: 1.40371, lng: 103.79404, zoom: 13, resolved: "Singapore Zoo, 80, Mandai Lake Road, Central Water Catchment, Mandai N"},
    "south-africa": {lat: -28.81662, lng: 24.99164, zoom: 3, resolved: "South Africa"},
    "spain": {lat: 39.32607, lng: -4.83798, zoom: 3, resolved: "España"},
    "sri-lanka": {lat: 7.55549, lng: 80.71378, zoom: 5, resolved: "Sri Lanka"},
    "tanzania": {lat: -6.52471, lng: 35.78784, zoom: 4, resolved: "Tanzania"},
    "thailand": {lat: 14.89719, lng: 100.83273, zoom: 4, resolved: "ประเทศไทย"},
    "ujung-kulon": {lat: -6.7514, lng: 105.3178, zoom: 9, resolved: "Taman Nasional Ujung Kulon, Pandeglang, Banten"},
    "united-kingdom": {lat: 54.70235, lng: -3.27658, zoom: 3, resolved: "United Kingdom"},
    "united-states": {lat: 39.78373, lng: -100.44588, zoom: 2, resolved: "United States"},
    "west-java": {lat: -6.88919, lng: 107.64047, zoom: 5, resolved: "Jawa Barat, Indonesia"},
};

/** Geocoded positions for curated wildlife places, keyed by location then place name. */
export const locationPlaceCoordinates: Record<string, Record<string, {lat: number; lng: number}>> = {
    "australia": {
        "Australia Zoo": {lat: -26.83392, lng: 152.96507},
        "Daintree National Park": {lat: -16.28753, lng: 145.20467},
        "Kakadu National Park": {lat: -13.05148, lng: 132.53625},
        "Taronga Zoo Sydney": {lat: -33.84383, lng: 151.24137},
    },
    "bali": {
        "Bali Bird Park": {lat: -8.60019, lng: 115.25099},
        "Bali Reptile Park": {lat: -8.59961, lng: 115.25174},
        "Bali Safari & Marine Park": {lat: -8.5805, lng: 115.34389},
        "Bali Zoo": {lat: -8.59059, lng: 115.26592},
        "Menjangan Island": {lat: -8.09605, lng: 114.51692},
        "Nusa Penida Marine Protected Area": {lat: -8.75202, lng: 115.45184},
        "Sacred Monkey Forest Sanctuary": {lat: -8.51873, lng: 115.25832},
        "West Bali National Park": {lat: -8.16699, lng: 114.46259},
    },
    "indonesia": {
        "Komodo National Park": {lat: -8.60699, lng: 119.57294},
        "Ragunan Zoo": {lat: -6.31141, lng: 106.82169},
        "Taman Safari Indonesia Bogor": {lat: -6.72017, lng: 106.95195},
        "Ujung Kulon National Park": {lat: -6.75145, lng: 105.3178},
    },
    "japan": {
        "Shiretoko National Park": {lat: 44.17577, lng: 145.2215},
        "Tama Zoological Park": {lat: 35.65075, lng: 139.4009},
        "Ueno Zoo": {lat: 35.71534, lng: 139.7689},
    },
    "kenya": {
        "Amboseli National Park": {lat: -2.64114, lng: 37.23623},
        "Giraffe Centre": {lat: -1.37656, lng: 36.74459},
        "Nairobi Safari Walk": {lat: -1.33657, lng: 36.77754},
    },
    "singapore": {
        "Bird Paradise": {lat: 1.40546, lng: 103.78099},
        "Bukit Timah Nature Reserve": {lat: 1.35408, lng: 103.77944},
        "Central Catchment Nature Reserve": {lat: 1.3766, lng: 103.80516},
        "River Wonders": {lat: 1.40202, lng: 103.7916},
        "Singapore Zoo": {lat: 1.40371, lng: 103.79404},
        "Sungei Buloh Wetland Reserve": {lat: 1.44494, lng: 103.72429},
    },
};

export function getLocationCoordinate(slug: string): LocationCoordinate | null {
    return locationCoordinates[slug] ?? null;
}

export function getPlaceCoordinate(locationSlug: string, placeName: string) {
    return locationPlaceCoordinates[locationSlug]?.[placeName] ?? null;
}

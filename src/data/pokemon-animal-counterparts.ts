export const POKEMON_ANIMAL_CANONICAL_BASE_PATH = "/pokemon-animals";

export type PokemonAnimalConfidence = "strong" | "medium" | "broad" | "none";

export type PokemonAnimalRow = {
    id: number;
    slug: string;
    name: string;
    generation: number;
    evolutionChainId: number;
    genus: string;
};

export type PokemonAnimalCounterpart = {
    animal: string;
    confidence: PokemonAnimalConfidence;
    note: string;
};

export type PokemonAnimalEntry = PokemonAnimalRow & PokemonAnimalCounterpart & {
    generationSlug: string;
    generationLabel: string;
};

export type PokemonAnimalGeneration = {
    id: number;
    slug: string;
    label: string;
    region: string;
};

export const pokemonAnimalGenerations: PokemonAnimalGeneration[] = [
    {id: 1, slug: "generation-i", label: "Generation I", region: "Kanto"},
    {id: 2, slug: "generation-ii", label: "Generation II", region: "Johto"},
    {id: 3, slug: "generation-iii", label: "Generation III", region: "Hoenn"},
    {id: 4, slug: "generation-iv", label: "Generation IV", region: "Sinnoh"},
    {id: 5, slug: "generation-v", label: "Generation V", region: "Unova"},
    {id: 6, slug: "generation-vi", label: "Generation VI", region: "Kalos"},
    {id: 7, slug: "generation-vii", label: "Generation VII", region: "Alola"},
    {id: 8, slug: "generation-viii", label: "Generation VIII", region: "Galar and Hisui"},
    {id: 9, slug: "generation-ix", label: "Generation IX", region: "Paldea and Kitakami"}
];

const pokemonAnimalRows: PokemonAnimalRow[] = [
    {
        "id": 1,
        "slug": "bulbasaur",
        "name": "Bulbasaur",
        "generation": 1,
        "evolutionChainId": 1,
        "genus": "Seed Pokemon"
    },
    {
        "id": 2,
        "slug": "ivysaur",
        "name": "Ivysaur",
        "generation": 1,
        "evolutionChainId": 1,
        "genus": "Seed Pokemon"
    },
    {
        "id": 3,
        "slug": "venusaur",
        "name": "Venusaur",
        "generation": 1,
        "evolutionChainId": 1,
        "genus": "Seed Pokemon"
    },
    {
        "id": 4,
        "slug": "charmander",
        "name": "Charmander",
        "generation": 1,
        "evolutionChainId": 2,
        "genus": "Lizard Pokemon"
    },
    {
        "id": 5,
        "slug": "charmeleon",
        "name": "Charmeleon",
        "generation": 1,
        "evolutionChainId": 2,
        "genus": "Flame Pokemon"
    },
    {
        "id": 6,
        "slug": "charizard",
        "name": "Charizard",
        "generation": 1,
        "evolutionChainId": 2,
        "genus": "Flame Pokemon"
    },
    {
        "id": 7,
        "slug": "squirtle",
        "name": "Squirtle",
        "generation": 1,
        "evolutionChainId": 3,
        "genus": "Tiny Turtle Pokemon"
    },
    {
        "id": 8,
        "slug": "wartortle",
        "name": "Wartortle",
        "generation": 1,
        "evolutionChainId": 3,
        "genus": "Turtle Pokemon"
    },
    {
        "id": 9,
        "slug": "blastoise",
        "name": "Blastoise",
        "generation": 1,
        "evolutionChainId": 3,
        "genus": "Shellfish Pokemon"
    },
    {
        "id": 10,
        "slug": "caterpie",
        "name": "Caterpie",
        "generation": 1,
        "evolutionChainId": 4,
        "genus": "Worm Pokemon"
    },
    {
        "id": 11,
        "slug": "metapod",
        "name": "Metapod",
        "generation": 1,
        "evolutionChainId": 4,
        "genus": "Cocoon Pokemon"
    },
    {
        "id": 12,
        "slug": "butterfree",
        "name": "Butterfree",
        "generation": 1,
        "evolutionChainId": 4,
        "genus": "Butterfly Pokemon"
    },
    {
        "id": 13,
        "slug": "weedle",
        "name": "Weedle",
        "generation": 1,
        "evolutionChainId": 5,
        "genus": "Hairy Bug Pokemon"
    },
    {
        "id": 14,
        "slug": "kakuna",
        "name": "Kakuna",
        "generation": 1,
        "evolutionChainId": 5,
        "genus": "Cocoon Pokemon"
    },
    {
        "id": 15,
        "slug": "beedrill",
        "name": "Beedrill",
        "generation": 1,
        "evolutionChainId": 5,
        "genus": "Poison Bee Pokemon"
    },
    {
        "id": 16,
        "slug": "pidgey",
        "name": "Pidgey",
        "generation": 1,
        "evolutionChainId": 6,
        "genus": "Tiny Bird Pokemon"
    },
    {
        "id": 17,
        "slug": "pidgeotto",
        "name": "Pidgeotto",
        "generation": 1,
        "evolutionChainId": 6,
        "genus": "Bird Pokemon"
    },
    {
        "id": 18,
        "slug": "pidgeot",
        "name": "Pidgeot",
        "generation": 1,
        "evolutionChainId": 6,
        "genus": "Bird Pokemon"
    },
    {
        "id": 19,
        "slug": "rattata",
        "name": "Rattata",
        "generation": 1,
        "evolutionChainId": 7,
        "genus": "Mouse Pokemon"
    },
    {
        "id": 20,
        "slug": "raticate",
        "name": "Raticate",
        "generation": 1,
        "evolutionChainId": 7,
        "genus": "Mouse Pokemon"
    },
    {
        "id": 21,
        "slug": "spearow",
        "name": "Spearow",
        "generation": 1,
        "evolutionChainId": 8,
        "genus": "Tiny Bird Pokemon"
    },
    {
        "id": 22,
        "slug": "fearow",
        "name": "Fearow",
        "generation": 1,
        "evolutionChainId": 8,
        "genus": "Beak Pokemon"
    },
    {
        "id": 23,
        "slug": "ekans",
        "name": "Ekans",
        "generation": 1,
        "evolutionChainId": 9,
        "genus": "Snake Pokemon"
    },
    {
        "id": 24,
        "slug": "arbok",
        "name": "Arbok",
        "generation": 1,
        "evolutionChainId": 9,
        "genus": "Cobra Pokemon"
    },
    {
        "id": 25,
        "slug": "pikachu",
        "name": "Pikachu",
        "generation": 1,
        "evolutionChainId": 10,
        "genus": "Mouse Pokemon"
    },
    {
        "id": 26,
        "slug": "raichu",
        "name": "Raichu",
        "generation": 1,
        "evolutionChainId": 10,
        "genus": "Mouse Pokemon"
    },
    {
        "id": 27,
        "slug": "sandshrew",
        "name": "Sandshrew",
        "generation": 1,
        "evolutionChainId": 11,
        "genus": "Mouse Pokemon"
    },
    {
        "id": 28,
        "slug": "sandslash",
        "name": "Sandslash",
        "generation": 1,
        "evolutionChainId": 11,
        "genus": "Mouse Pokemon"
    },
    {
        "id": 29,
        "slug": "nidoran-f",
        "name": "Nidoran♀",
        "generation": 1,
        "evolutionChainId": 12,
        "genus": "Poison Pin Pokemon"
    },
    {
        "id": 30,
        "slug": "nidorina",
        "name": "Nidorina",
        "generation": 1,
        "evolutionChainId": 12,
        "genus": "Poison Pin Pokemon"
    },
    {
        "id": 31,
        "slug": "nidoqueen",
        "name": "Nidoqueen",
        "generation": 1,
        "evolutionChainId": 12,
        "genus": "Drill Pokemon"
    },
    {
        "id": 32,
        "slug": "nidoran-m",
        "name": "Nidoran♂",
        "generation": 1,
        "evolutionChainId": 13,
        "genus": "Poison Pin Pokemon"
    },
    {
        "id": 33,
        "slug": "nidorino",
        "name": "Nidorino",
        "generation": 1,
        "evolutionChainId": 13,
        "genus": "Poison Pin Pokemon"
    },
    {
        "id": 34,
        "slug": "nidoking",
        "name": "Nidoking",
        "generation": 1,
        "evolutionChainId": 13,
        "genus": "Drill Pokemon"
    },
    {
        "id": 35,
        "slug": "clefairy",
        "name": "Clefairy",
        "generation": 1,
        "evolutionChainId": 14,
        "genus": "Fairy Pokemon"
    },
    {
        "id": 36,
        "slug": "clefable",
        "name": "Clefable",
        "generation": 1,
        "evolutionChainId": 14,
        "genus": "Fairy Pokemon"
    },
    {
        "id": 37,
        "slug": "vulpix",
        "name": "Vulpix",
        "generation": 1,
        "evolutionChainId": 15,
        "genus": "Fox Pokemon"
    },
    {
        "id": 38,
        "slug": "ninetales",
        "name": "Ninetales",
        "generation": 1,
        "evolutionChainId": 15,
        "genus": "Fox Pokemon"
    },
    {
        "id": 39,
        "slug": "jigglypuff",
        "name": "Jigglypuff",
        "generation": 1,
        "evolutionChainId": 16,
        "genus": "Balloon Pokemon"
    },
    {
        "id": 40,
        "slug": "wigglytuff",
        "name": "Wigglytuff",
        "generation": 1,
        "evolutionChainId": 16,
        "genus": "Balloon Pokemon"
    },
    {
        "id": 41,
        "slug": "zubat",
        "name": "Zubat",
        "generation": 1,
        "evolutionChainId": 17,
        "genus": "Bat Pokemon"
    },
    {
        "id": 42,
        "slug": "golbat",
        "name": "Golbat",
        "generation": 1,
        "evolutionChainId": 17,
        "genus": "Bat Pokemon"
    },
    {
        "id": 43,
        "slug": "oddish",
        "name": "Oddish",
        "generation": 1,
        "evolutionChainId": 18,
        "genus": "Weed Pokemon"
    },
    {
        "id": 44,
        "slug": "gloom",
        "name": "Gloom",
        "generation": 1,
        "evolutionChainId": 18,
        "genus": "Weed Pokemon"
    },
    {
        "id": 45,
        "slug": "vileplume",
        "name": "Vileplume",
        "generation": 1,
        "evolutionChainId": 18,
        "genus": "Flower Pokemon"
    },
    {
        "id": 46,
        "slug": "paras",
        "name": "Paras",
        "generation": 1,
        "evolutionChainId": 19,
        "genus": "Mushroom Pokemon"
    },
    {
        "id": 47,
        "slug": "parasect",
        "name": "Parasect",
        "generation": 1,
        "evolutionChainId": 19,
        "genus": "Mushroom Pokemon"
    },
    {
        "id": 48,
        "slug": "venonat",
        "name": "Venonat",
        "generation": 1,
        "evolutionChainId": 20,
        "genus": "Insect Pokemon"
    },
    {
        "id": 49,
        "slug": "venomoth",
        "name": "Venomoth",
        "generation": 1,
        "evolutionChainId": 20,
        "genus": "Poison Moth Pokemon"
    },
    {
        "id": 50,
        "slug": "diglett",
        "name": "Diglett",
        "generation": 1,
        "evolutionChainId": 21,
        "genus": "Mole Pokemon"
    },
    {
        "id": 51,
        "slug": "dugtrio",
        "name": "Dugtrio",
        "generation": 1,
        "evolutionChainId": 21,
        "genus": "Mole Pokemon"
    },
    {
        "id": 52,
        "slug": "meowth",
        "name": "Meowth",
        "generation": 1,
        "evolutionChainId": 22,
        "genus": "Scratch Cat Pokemon"
    },
    {
        "id": 53,
        "slug": "persian",
        "name": "Persian",
        "generation": 1,
        "evolutionChainId": 22,
        "genus": "Classy Cat Pokemon"
    },
    {
        "id": 54,
        "slug": "psyduck",
        "name": "Psyduck",
        "generation": 1,
        "evolutionChainId": 23,
        "genus": "Duck Pokemon"
    },
    {
        "id": 55,
        "slug": "golduck",
        "name": "Golduck",
        "generation": 1,
        "evolutionChainId": 23,
        "genus": "Duck Pokemon"
    },
    {
        "id": 56,
        "slug": "mankey",
        "name": "Mankey",
        "generation": 1,
        "evolutionChainId": 24,
        "genus": "Pig Monkey Pokemon"
    },
    {
        "id": 57,
        "slug": "primeape",
        "name": "Primeape",
        "generation": 1,
        "evolutionChainId": 24,
        "genus": "Pig Monkey Pokemon"
    },
    {
        "id": 58,
        "slug": "growlithe",
        "name": "Growlithe",
        "generation": 1,
        "evolutionChainId": 25,
        "genus": "Puppy Pokemon"
    },
    {
        "id": 59,
        "slug": "arcanine",
        "name": "Arcanine",
        "generation": 1,
        "evolutionChainId": 25,
        "genus": "Legendary Pokemon"
    },
    {
        "id": 60,
        "slug": "poliwag",
        "name": "Poliwag",
        "generation": 1,
        "evolutionChainId": 26,
        "genus": "Tadpole Pokemon"
    },
    {
        "id": 61,
        "slug": "poliwhirl",
        "name": "Poliwhirl",
        "generation": 1,
        "evolutionChainId": 26,
        "genus": "Tadpole Pokemon"
    },
    {
        "id": 62,
        "slug": "poliwrath",
        "name": "Poliwrath",
        "generation": 1,
        "evolutionChainId": 26,
        "genus": "Tadpole Pokemon"
    },
    {
        "id": 63,
        "slug": "abra",
        "name": "Abra",
        "generation": 1,
        "evolutionChainId": 27,
        "genus": "Psi Pokemon"
    },
    {
        "id": 64,
        "slug": "kadabra",
        "name": "Kadabra",
        "generation": 1,
        "evolutionChainId": 27,
        "genus": "Psi Pokemon"
    },
    {
        "id": 65,
        "slug": "alakazam",
        "name": "Alakazam",
        "generation": 1,
        "evolutionChainId": 27,
        "genus": "Psi Pokemon"
    },
    {
        "id": 66,
        "slug": "machop",
        "name": "Machop",
        "generation": 1,
        "evolutionChainId": 28,
        "genus": "Superpower Pokemon"
    },
    {
        "id": 67,
        "slug": "machoke",
        "name": "Machoke",
        "generation": 1,
        "evolutionChainId": 28,
        "genus": "Superpower Pokemon"
    },
    {
        "id": 68,
        "slug": "machamp",
        "name": "Machamp",
        "generation": 1,
        "evolutionChainId": 28,
        "genus": "Superpower Pokemon"
    },
    {
        "id": 69,
        "slug": "bellsprout",
        "name": "Bellsprout",
        "generation": 1,
        "evolutionChainId": 29,
        "genus": "Flower Pokemon"
    },
    {
        "id": 70,
        "slug": "weepinbell",
        "name": "Weepinbell",
        "generation": 1,
        "evolutionChainId": 29,
        "genus": "Flycatcher Pokemon"
    },
    {
        "id": 71,
        "slug": "victreebel",
        "name": "Victreebel",
        "generation": 1,
        "evolutionChainId": 29,
        "genus": "Flycatcher Pokemon"
    },
    {
        "id": 72,
        "slug": "tentacool",
        "name": "Tentacool",
        "generation": 1,
        "evolutionChainId": 30,
        "genus": "Jellyfish Pokemon"
    },
    {
        "id": 73,
        "slug": "tentacruel",
        "name": "Tentacruel",
        "generation": 1,
        "evolutionChainId": 30,
        "genus": "Jellyfish Pokemon"
    },
    {
        "id": 74,
        "slug": "geodude",
        "name": "Geodude",
        "generation": 1,
        "evolutionChainId": 31,
        "genus": "Rock Pokemon"
    },
    {
        "id": 75,
        "slug": "graveler",
        "name": "Graveler",
        "generation": 1,
        "evolutionChainId": 31,
        "genus": "Rock Pokemon"
    },
    {
        "id": 76,
        "slug": "golem",
        "name": "Golem",
        "generation": 1,
        "evolutionChainId": 31,
        "genus": "Megaton Pokemon"
    },
    {
        "id": 77,
        "slug": "ponyta",
        "name": "Ponyta",
        "generation": 1,
        "evolutionChainId": 32,
        "genus": "Fire Horse Pokemon"
    },
    {
        "id": 78,
        "slug": "rapidash",
        "name": "Rapidash",
        "generation": 1,
        "evolutionChainId": 32,
        "genus": "Fire Horse Pokemon"
    },
    {
        "id": 79,
        "slug": "slowpoke",
        "name": "Slowpoke",
        "generation": 1,
        "evolutionChainId": 33,
        "genus": "Dopey Pokemon"
    },
    {
        "id": 80,
        "slug": "slowbro",
        "name": "Slowbro",
        "generation": 1,
        "evolutionChainId": 33,
        "genus": "Hermit Crab Pokemon"
    },
    {
        "id": 81,
        "slug": "magnemite",
        "name": "Magnemite",
        "generation": 1,
        "evolutionChainId": 34,
        "genus": "Magnet Pokemon"
    },
    {
        "id": 82,
        "slug": "magneton",
        "name": "Magneton",
        "generation": 1,
        "evolutionChainId": 34,
        "genus": "Magnet Pokemon"
    },
    {
        "id": 83,
        "slug": "farfetchd",
        "name": "Farfetch’d",
        "generation": 1,
        "evolutionChainId": 35,
        "genus": "Wild Duck Pokemon"
    },
    {
        "id": 84,
        "slug": "doduo",
        "name": "Doduo",
        "generation": 1,
        "evolutionChainId": 36,
        "genus": "Twin Bird Pokemon"
    },
    {
        "id": 85,
        "slug": "dodrio",
        "name": "Dodrio",
        "generation": 1,
        "evolutionChainId": 36,
        "genus": "Triple Bird Pokemon"
    },
    {
        "id": 86,
        "slug": "seel",
        "name": "Seel",
        "generation": 1,
        "evolutionChainId": 37,
        "genus": "Sea Lion Pokemon"
    },
    {
        "id": 87,
        "slug": "dewgong",
        "name": "Dewgong",
        "generation": 1,
        "evolutionChainId": 37,
        "genus": "Sea Lion Pokemon"
    },
    {
        "id": 88,
        "slug": "grimer",
        "name": "Grimer",
        "generation": 1,
        "evolutionChainId": 38,
        "genus": "Sludge Pokemon"
    },
    {
        "id": 89,
        "slug": "muk",
        "name": "Muk",
        "generation": 1,
        "evolutionChainId": 38,
        "genus": "Sludge Pokemon"
    },
    {
        "id": 90,
        "slug": "shellder",
        "name": "Shellder",
        "generation": 1,
        "evolutionChainId": 39,
        "genus": "Bivalve Pokemon"
    },
    {
        "id": 91,
        "slug": "cloyster",
        "name": "Cloyster",
        "generation": 1,
        "evolutionChainId": 39,
        "genus": "Bivalve Pokemon"
    },
    {
        "id": 92,
        "slug": "gastly",
        "name": "Gastly",
        "generation": 1,
        "evolutionChainId": 40,
        "genus": "Gas Pokemon"
    },
    {
        "id": 93,
        "slug": "haunter",
        "name": "Haunter",
        "generation": 1,
        "evolutionChainId": 40,
        "genus": "Gas Pokemon"
    },
    {
        "id": 94,
        "slug": "gengar",
        "name": "Gengar",
        "generation": 1,
        "evolutionChainId": 40,
        "genus": "Shadow Pokemon"
    },
    {
        "id": 95,
        "slug": "onix",
        "name": "Onix",
        "generation": 1,
        "evolutionChainId": 41,
        "genus": "Rock Snake Pokemon"
    },
    {
        "id": 96,
        "slug": "drowzee",
        "name": "Drowzee",
        "generation": 1,
        "evolutionChainId": 42,
        "genus": "Hypnosis Pokemon"
    },
    {
        "id": 97,
        "slug": "hypno",
        "name": "Hypno",
        "generation": 1,
        "evolutionChainId": 42,
        "genus": "Hypnosis Pokemon"
    },
    {
        "id": 98,
        "slug": "krabby",
        "name": "Krabby",
        "generation": 1,
        "evolutionChainId": 43,
        "genus": "River Crab Pokemon"
    },
    {
        "id": 99,
        "slug": "kingler",
        "name": "Kingler",
        "generation": 1,
        "evolutionChainId": 43,
        "genus": "Pincer Pokemon"
    },
    {
        "id": 100,
        "slug": "voltorb",
        "name": "Voltorb",
        "generation": 1,
        "evolutionChainId": 44,
        "genus": "Ball Pokemon"
    },
    {
        "id": 101,
        "slug": "electrode",
        "name": "Electrode",
        "generation": 1,
        "evolutionChainId": 44,
        "genus": "Ball Pokemon"
    },
    {
        "id": 102,
        "slug": "exeggcute",
        "name": "Exeggcute",
        "generation": 1,
        "evolutionChainId": 45,
        "genus": "Egg Pokemon"
    },
    {
        "id": 103,
        "slug": "exeggutor",
        "name": "Exeggutor",
        "generation": 1,
        "evolutionChainId": 45,
        "genus": "Coconut Pokemon"
    },
    {
        "id": 104,
        "slug": "cubone",
        "name": "Cubone",
        "generation": 1,
        "evolutionChainId": 46,
        "genus": "Lonely Pokemon"
    },
    {
        "id": 105,
        "slug": "marowak",
        "name": "Marowak",
        "generation": 1,
        "evolutionChainId": 46,
        "genus": "Bone Keeper Pokemon"
    },
    {
        "id": 106,
        "slug": "hitmonlee",
        "name": "Hitmonlee",
        "generation": 1,
        "evolutionChainId": 47,
        "genus": "Kicking Pokemon"
    },
    {
        "id": 107,
        "slug": "hitmonchan",
        "name": "Hitmonchan",
        "generation": 1,
        "evolutionChainId": 47,
        "genus": "Punching Pokemon"
    },
    {
        "id": 108,
        "slug": "lickitung",
        "name": "Lickitung",
        "generation": 1,
        "evolutionChainId": 48,
        "genus": "Licking Pokemon"
    },
    {
        "id": 109,
        "slug": "koffing",
        "name": "Koffing",
        "generation": 1,
        "evolutionChainId": 49,
        "genus": "Poison Gas Pokemon"
    },
    {
        "id": 110,
        "slug": "weezing",
        "name": "Weezing",
        "generation": 1,
        "evolutionChainId": 49,
        "genus": "Poison Gas Pokemon"
    },
    {
        "id": 111,
        "slug": "rhyhorn",
        "name": "Rhyhorn",
        "generation": 1,
        "evolutionChainId": 50,
        "genus": "Spikes Pokemon"
    },
    {
        "id": 112,
        "slug": "rhydon",
        "name": "Rhydon",
        "generation": 1,
        "evolutionChainId": 50,
        "genus": "Drill Pokemon"
    },
    {
        "id": 113,
        "slug": "chansey",
        "name": "Chansey",
        "generation": 1,
        "evolutionChainId": 51,
        "genus": "Egg Pokemon"
    },
    {
        "id": 114,
        "slug": "tangela",
        "name": "Tangela",
        "generation": 1,
        "evolutionChainId": 52,
        "genus": "Vine Pokemon"
    },
    {
        "id": 115,
        "slug": "kangaskhan",
        "name": "Kangaskhan",
        "generation": 1,
        "evolutionChainId": 53,
        "genus": "Parent Pokemon"
    },
    {
        "id": 116,
        "slug": "horsea",
        "name": "Horsea",
        "generation": 1,
        "evolutionChainId": 54,
        "genus": "Dragon Pokemon"
    },
    {
        "id": 117,
        "slug": "seadra",
        "name": "Seadra",
        "generation": 1,
        "evolutionChainId": 54,
        "genus": "Dragon Pokemon"
    },
    {
        "id": 118,
        "slug": "goldeen",
        "name": "Goldeen",
        "generation": 1,
        "evolutionChainId": 55,
        "genus": "Goldfish Pokemon"
    },
    {
        "id": 119,
        "slug": "seaking",
        "name": "Seaking",
        "generation": 1,
        "evolutionChainId": 55,
        "genus": "Goldfish Pokemon"
    },
    {
        "id": 120,
        "slug": "staryu",
        "name": "Staryu",
        "generation": 1,
        "evolutionChainId": 56,
        "genus": "Star Shape Pokemon"
    },
    {
        "id": 121,
        "slug": "starmie",
        "name": "Starmie",
        "generation": 1,
        "evolutionChainId": 56,
        "genus": "Mysterious Pokemon"
    },
    {
        "id": 122,
        "slug": "mr-mime",
        "name": "Mr. Mime",
        "generation": 1,
        "evolutionChainId": 57,
        "genus": "Barrier Pokemon"
    },
    {
        "id": 123,
        "slug": "scyther",
        "name": "Scyther",
        "generation": 1,
        "evolutionChainId": 58,
        "genus": "Mantis Pokemon"
    },
    {
        "id": 124,
        "slug": "jynx",
        "name": "Jynx",
        "generation": 1,
        "evolutionChainId": 59,
        "genus": "Human Shape Pokemon"
    },
    {
        "id": 125,
        "slug": "electabuzz",
        "name": "Electabuzz",
        "generation": 1,
        "evolutionChainId": 60,
        "genus": "Electric Pokemon"
    },
    {
        "id": 126,
        "slug": "magmar",
        "name": "Magmar",
        "generation": 1,
        "evolutionChainId": 61,
        "genus": "Spitfire Pokemon"
    },
    {
        "id": 127,
        "slug": "pinsir",
        "name": "Pinsir",
        "generation": 1,
        "evolutionChainId": 62,
        "genus": "Stag Beetle Pokemon"
    },
    {
        "id": 128,
        "slug": "tauros",
        "name": "Tauros",
        "generation": 1,
        "evolutionChainId": 63,
        "genus": "Wild Bull Pokemon"
    },
    {
        "id": 129,
        "slug": "magikarp",
        "name": "Magikarp",
        "generation": 1,
        "evolutionChainId": 64,
        "genus": "Fish Pokemon"
    },
    {
        "id": 130,
        "slug": "gyarados",
        "name": "Gyarados",
        "generation": 1,
        "evolutionChainId": 64,
        "genus": "Atrocious Pokemon"
    },
    {
        "id": 131,
        "slug": "lapras",
        "name": "Lapras",
        "generation": 1,
        "evolutionChainId": 65,
        "genus": "Transport Pokemon"
    },
    {
        "id": 132,
        "slug": "ditto",
        "name": "Ditto",
        "generation": 1,
        "evolutionChainId": 66,
        "genus": "Transform Pokemon"
    },
    {
        "id": 133,
        "slug": "eevee",
        "name": "Eevee",
        "generation": 1,
        "evolutionChainId": 67,
        "genus": "Evolution Pokemon"
    },
    {
        "id": 134,
        "slug": "vaporeon",
        "name": "Vaporeon",
        "generation": 1,
        "evolutionChainId": 67,
        "genus": "Bubble Jet Pokemon"
    },
    {
        "id": 135,
        "slug": "jolteon",
        "name": "Jolteon",
        "generation": 1,
        "evolutionChainId": 67,
        "genus": "Lightning Pokemon"
    },
    {
        "id": 136,
        "slug": "flareon",
        "name": "Flareon",
        "generation": 1,
        "evolutionChainId": 67,
        "genus": "Flame Pokemon"
    },
    {
        "id": 137,
        "slug": "porygon",
        "name": "Porygon",
        "generation": 1,
        "evolutionChainId": 68,
        "genus": "Virtual Pokemon"
    },
    {
        "id": 138,
        "slug": "omanyte",
        "name": "Omanyte",
        "generation": 1,
        "evolutionChainId": 69,
        "genus": "Spiral Pokemon"
    },
    {
        "id": 139,
        "slug": "omastar",
        "name": "Omastar",
        "generation": 1,
        "evolutionChainId": 69,
        "genus": "Spiral Pokemon"
    },
    {
        "id": 140,
        "slug": "kabuto",
        "name": "Kabuto",
        "generation": 1,
        "evolutionChainId": 70,
        "genus": "Shellfish Pokemon"
    },
    {
        "id": 141,
        "slug": "kabutops",
        "name": "Kabutops",
        "generation": 1,
        "evolutionChainId": 70,
        "genus": "Shellfish Pokemon"
    },
    {
        "id": 142,
        "slug": "aerodactyl",
        "name": "Aerodactyl",
        "generation": 1,
        "evolutionChainId": 71,
        "genus": "Fossil Pokemon"
    },
    {
        "id": 143,
        "slug": "snorlax",
        "name": "Snorlax",
        "generation": 1,
        "evolutionChainId": 72,
        "genus": "Sleeping Pokemon"
    },
    {
        "id": 144,
        "slug": "articuno",
        "name": "Articuno",
        "generation": 1,
        "evolutionChainId": 73,
        "genus": "Freeze Pokemon"
    },
    {
        "id": 145,
        "slug": "zapdos",
        "name": "Zapdos",
        "generation": 1,
        "evolutionChainId": 74,
        "genus": "Electric Pokemon"
    },
    {
        "id": 146,
        "slug": "moltres",
        "name": "Moltres",
        "generation": 1,
        "evolutionChainId": 75,
        "genus": "Flame Pokemon"
    },
    {
        "id": 147,
        "slug": "dratini",
        "name": "Dratini",
        "generation": 1,
        "evolutionChainId": 76,
        "genus": "Dragon Pokemon"
    },
    {
        "id": 148,
        "slug": "dragonair",
        "name": "Dragonair",
        "generation": 1,
        "evolutionChainId": 76,
        "genus": "Dragon Pokemon"
    },
    {
        "id": 149,
        "slug": "dragonite",
        "name": "Dragonite",
        "generation": 1,
        "evolutionChainId": 76,
        "genus": "Dragon Pokemon"
    },
    {
        "id": 150,
        "slug": "mewtwo",
        "name": "Mewtwo",
        "generation": 1,
        "evolutionChainId": 77,
        "genus": "Genetic Pokemon"
    },
    {
        "id": 151,
        "slug": "mew",
        "name": "Mew",
        "generation": 1,
        "evolutionChainId": 78,
        "genus": "New Species Pokemon"
    },
    {
        "id": 152,
        "slug": "chikorita",
        "name": "Chikorita",
        "generation": 2,
        "evolutionChainId": 79,
        "genus": "Leaf Pokemon"
    },
    {
        "id": 153,
        "slug": "bayleef",
        "name": "Bayleef",
        "generation": 2,
        "evolutionChainId": 79,
        "genus": "Leaf Pokemon"
    },
    {
        "id": 154,
        "slug": "meganium",
        "name": "Meganium",
        "generation": 2,
        "evolutionChainId": 79,
        "genus": "Herb Pokemon"
    },
    {
        "id": 155,
        "slug": "cyndaquil",
        "name": "Cyndaquil",
        "generation": 2,
        "evolutionChainId": 80,
        "genus": "Fire Mouse Pokemon"
    },
    {
        "id": 156,
        "slug": "quilava",
        "name": "Quilava",
        "generation": 2,
        "evolutionChainId": 80,
        "genus": "Volcano Pokemon"
    },
    {
        "id": 157,
        "slug": "typhlosion",
        "name": "Typhlosion",
        "generation": 2,
        "evolutionChainId": 80,
        "genus": "Volcano Pokemon"
    },
    {
        "id": 158,
        "slug": "totodile",
        "name": "Totodile",
        "generation": 2,
        "evolutionChainId": 81,
        "genus": "Big Jaw Pokemon"
    },
    {
        "id": 159,
        "slug": "croconaw",
        "name": "Croconaw",
        "generation": 2,
        "evolutionChainId": 81,
        "genus": "Big Jaw Pokemon"
    },
    {
        "id": 160,
        "slug": "feraligatr",
        "name": "Feraligatr",
        "generation": 2,
        "evolutionChainId": 81,
        "genus": "Big Jaw Pokemon"
    },
    {
        "id": 161,
        "slug": "sentret",
        "name": "Sentret",
        "generation": 2,
        "evolutionChainId": 82,
        "genus": "Scout Pokemon"
    },
    {
        "id": 162,
        "slug": "furret",
        "name": "Furret",
        "generation": 2,
        "evolutionChainId": 82,
        "genus": "Long Body Pokemon"
    },
    {
        "id": 163,
        "slug": "hoothoot",
        "name": "Hoothoot",
        "generation": 2,
        "evolutionChainId": 83,
        "genus": "Owl Pokemon"
    },
    {
        "id": 164,
        "slug": "noctowl",
        "name": "Noctowl",
        "generation": 2,
        "evolutionChainId": 83,
        "genus": "Owl Pokemon"
    },
    {
        "id": 165,
        "slug": "ledyba",
        "name": "Ledyba",
        "generation": 2,
        "evolutionChainId": 84,
        "genus": "Five Star Pokemon"
    },
    {
        "id": 166,
        "slug": "ledian",
        "name": "Ledian",
        "generation": 2,
        "evolutionChainId": 84,
        "genus": "Five Star Pokemon"
    },
    {
        "id": 167,
        "slug": "spinarak",
        "name": "Spinarak",
        "generation": 2,
        "evolutionChainId": 85,
        "genus": "String Spit Pokemon"
    },
    {
        "id": 168,
        "slug": "ariados",
        "name": "Ariados",
        "generation": 2,
        "evolutionChainId": 85,
        "genus": "Long Leg Pokemon"
    },
    {
        "id": 169,
        "slug": "crobat",
        "name": "Crobat",
        "generation": 2,
        "evolutionChainId": 17,
        "genus": "Bat Pokemon"
    },
    {
        "id": 170,
        "slug": "chinchou",
        "name": "Chinchou",
        "generation": 2,
        "evolutionChainId": 86,
        "genus": "Angler Pokemon"
    },
    {
        "id": 171,
        "slug": "lanturn",
        "name": "Lanturn",
        "generation": 2,
        "evolutionChainId": 86,
        "genus": "Light Pokemon"
    },
    {
        "id": 172,
        "slug": "pichu",
        "name": "Pichu",
        "generation": 2,
        "evolutionChainId": 10,
        "genus": "Tiny Mouse Pokemon"
    },
    {
        "id": 173,
        "slug": "cleffa",
        "name": "Cleffa",
        "generation": 2,
        "evolutionChainId": 14,
        "genus": "Star Shape Pokemon"
    },
    {
        "id": 174,
        "slug": "igglybuff",
        "name": "Igglybuff",
        "generation": 2,
        "evolutionChainId": 16,
        "genus": "Balloon Pokemon"
    },
    {
        "id": 175,
        "slug": "togepi",
        "name": "Togepi",
        "generation": 2,
        "evolutionChainId": 87,
        "genus": "Spike Ball Pokemon"
    },
    {
        "id": 176,
        "slug": "togetic",
        "name": "Togetic",
        "generation": 2,
        "evolutionChainId": 87,
        "genus": "Happiness Pokemon"
    },
    {
        "id": 177,
        "slug": "natu",
        "name": "Natu",
        "generation": 2,
        "evolutionChainId": 88,
        "genus": "Tiny Bird Pokemon"
    },
    {
        "id": 178,
        "slug": "xatu",
        "name": "Xatu",
        "generation": 2,
        "evolutionChainId": 88,
        "genus": "Mystic Pokemon"
    },
    {
        "id": 179,
        "slug": "mareep",
        "name": "Mareep",
        "generation": 2,
        "evolutionChainId": 89,
        "genus": "Wool Pokemon"
    },
    {
        "id": 180,
        "slug": "flaaffy",
        "name": "Flaaffy",
        "generation": 2,
        "evolutionChainId": 89,
        "genus": "Wool Pokemon"
    },
    {
        "id": 181,
        "slug": "ampharos",
        "name": "Ampharos",
        "generation": 2,
        "evolutionChainId": 89,
        "genus": "Light Pokemon"
    },
    {
        "id": 182,
        "slug": "bellossom",
        "name": "Bellossom",
        "generation": 2,
        "evolutionChainId": 18,
        "genus": "Flower Pokemon"
    },
    {
        "id": 183,
        "slug": "marill",
        "name": "Marill",
        "generation": 2,
        "evolutionChainId": 90,
        "genus": "Aqua Mouse Pokemon"
    },
    {
        "id": 184,
        "slug": "azumarill",
        "name": "Azumarill",
        "generation": 2,
        "evolutionChainId": 90,
        "genus": "Aqua Rabbit Pokemon"
    },
    {
        "id": 185,
        "slug": "sudowoodo",
        "name": "Sudowoodo",
        "generation": 2,
        "evolutionChainId": 91,
        "genus": "Imitation Pokemon"
    },
    {
        "id": 186,
        "slug": "politoed",
        "name": "Politoed",
        "generation": 2,
        "evolutionChainId": 26,
        "genus": "Frog Pokemon"
    },
    {
        "id": 187,
        "slug": "hoppip",
        "name": "Hoppip",
        "generation": 2,
        "evolutionChainId": 92,
        "genus": "Cottonweed Pokemon"
    },
    {
        "id": 188,
        "slug": "skiploom",
        "name": "Skiploom",
        "generation": 2,
        "evolutionChainId": 92,
        "genus": "Cottonweed Pokemon"
    },
    {
        "id": 189,
        "slug": "jumpluff",
        "name": "Jumpluff",
        "generation": 2,
        "evolutionChainId": 92,
        "genus": "Cottonweed Pokemon"
    },
    {
        "id": 190,
        "slug": "aipom",
        "name": "Aipom",
        "generation": 2,
        "evolutionChainId": 93,
        "genus": "Long Tail Pokemon"
    },
    {
        "id": 191,
        "slug": "sunkern",
        "name": "Sunkern",
        "generation": 2,
        "evolutionChainId": 94,
        "genus": "Seed Pokemon"
    },
    {
        "id": 192,
        "slug": "sunflora",
        "name": "Sunflora",
        "generation": 2,
        "evolutionChainId": 94,
        "genus": "Sun Pokemon"
    },
    {
        "id": 193,
        "slug": "yanma",
        "name": "Yanma",
        "generation": 2,
        "evolutionChainId": 95,
        "genus": "Clear Wing Pokemon"
    },
    {
        "id": 194,
        "slug": "wooper",
        "name": "Wooper",
        "generation": 2,
        "evolutionChainId": 96,
        "genus": "Water Fish Pokemon"
    },
    {
        "id": 195,
        "slug": "quagsire",
        "name": "Quagsire",
        "generation": 2,
        "evolutionChainId": 96,
        "genus": "Water Fish Pokemon"
    },
    {
        "id": 196,
        "slug": "espeon",
        "name": "Espeon",
        "generation": 2,
        "evolutionChainId": 67,
        "genus": "Sun Pokemon"
    },
    {
        "id": 197,
        "slug": "umbreon",
        "name": "Umbreon",
        "generation": 2,
        "evolutionChainId": 67,
        "genus": "Moonlight Pokemon"
    },
    {
        "id": 198,
        "slug": "murkrow",
        "name": "Murkrow",
        "generation": 2,
        "evolutionChainId": 97,
        "genus": "Darkness Pokemon"
    },
    {
        "id": 199,
        "slug": "slowking",
        "name": "Slowking",
        "generation": 2,
        "evolutionChainId": 33,
        "genus": "Royal Pokemon"
    },
    {
        "id": 200,
        "slug": "misdreavus",
        "name": "Misdreavus",
        "generation": 2,
        "evolutionChainId": 98,
        "genus": "Screech Pokemon"
    },
    {
        "id": 201,
        "slug": "unown",
        "name": "Unown",
        "generation": 2,
        "evolutionChainId": 99,
        "genus": "Symbol Pokemon"
    },
    {
        "id": 202,
        "slug": "wobbuffet",
        "name": "Wobbuffet",
        "generation": 2,
        "evolutionChainId": 100,
        "genus": "Patient Pokemon"
    },
    {
        "id": 203,
        "slug": "girafarig",
        "name": "Girafarig",
        "generation": 2,
        "evolutionChainId": 101,
        "genus": "Long Neck Pokemon"
    },
    {
        "id": 204,
        "slug": "pineco",
        "name": "Pineco",
        "generation": 2,
        "evolutionChainId": 102,
        "genus": "Bagworm Pokemon"
    },
    {
        "id": 205,
        "slug": "forretress",
        "name": "Forretress",
        "generation": 2,
        "evolutionChainId": 102,
        "genus": "Bagworm Pokemon"
    },
    {
        "id": 206,
        "slug": "dunsparce",
        "name": "Dunsparce",
        "generation": 2,
        "evolutionChainId": 103,
        "genus": "Land Snake Pokemon"
    },
    {
        "id": 207,
        "slug": "gligar",
        "name": "Gligar",
        "generation": 2,
        "evolutionChainId": 104,
        "genus": "Fly Scorpion Pokemon"
    },
    {
        "id": 208,
        "slug": "steelix",
        "name": "Steelix",
        "generation": 2,
        "evolutionChainId": 41,
        "genus": "Iron Snake Pokemon"
    },
    {
        "id": 209,
        "slug": "snubbull",
        "name": "Snubbull",
        "generation": 2,
        "evolutionChainId": 105,
        "genus": "Fairy Pokemon"
    },
    {
        "id": 210,
        "slug": "granbull",
        "name": "Granbull",
        "generation": 2,
        "evolutionChainId": 105,
        "genus": "Fairy Pokemon"
    },
    {
        "id": 211,
        "slug": "qwilfish",
        "name": "Qwilfish",
        "generation": 2,
        "evolutionChainId": 106,
        "genus": "Balloon Pokemon"
    },
    {
        "id": 212,
        "slug": "scizor",
        "name": "Scizor",
        "generation": 2,
        "evolutionChainId": 58,
        "genus": "Pincer Pokemon"
    },
    {
        "id": 213,
        "slug": "shuckle",
        "name": "Shuckle",
        "generation": 2,
        "evolutionChainId": 107,
        "genus": "Mold Pokemon"
    },
    {
        "id": 214,
        "slug": "heracross",
        "name": "Heracross",
        "generation": 2,
        "evolutionChainId": 108,
        "genus": "Single Horn Pokemon"
    },
    {
        "id": 215,
        "slug": "sneasel",
        "name": "Sneasel",
        "generation": 2,
        "evolutionChainId": 109,
        "genus": "Sharp Claw Pokemon"
    },
    {
        "id": 216,
        "slug": "teddiursa",
        "name": "Teddiursa",
        "generation": 2,
        "evolutionChainId": 110,
        "genus": "Little Bear Pokemon"
    },
    {
        "id": 217,
        "slug": "ursaring",
        "name": "Ursaring",
        "generation": 2,
        "evolutionChainId": 110,
        "genus": "Hibernator Pokemon"
    },
    {
        "id": 218,
        "slug": "slugma",
        "name": "Slugma",
        "generation": 2,
        "evolutionChainId": 111,
        "genus": "Lava Pokemon"
    },
    {
        "id": 219,
        "slug": "magcargo",
        "name": "Magcargo",
        "generation": 2,
        "evolutionChainId": 111,
        "genus": "Lava Pokemon"
    },
    {
        "id": 220,
        "slug": "swinub",
        "name": "Swinub",
        "generation": 2,
        "evolutionChainId": 112,
        "genus": "Pig Pokemon"
    },
    {
        "id": 221,
        "slug": "piloswine",
        "name": "Piloswine",
        "generation": 2,
        "evolutionChainId": 112,
        "genus": "Swine Pokemon"
    },
    {
        "id": 222,
        "slug": "corsola",
        "name": "Corsola",
        "generation": 2,
        "evolutionChainId": 113,
        "genus": "Coral Pokemon"
    },
    {
        "id": 223,
        "slug": "remoraid",
        "name": "Remoraid",
        "generation": 2,
        "evolutionChainId": 114,
        "genus": "Jet Pokemon"
    },
    {
        "id": 224,
        "slug": "octillery",
        "name": "Octillery",
        "generation": 2,
        "evolutionChainId": 114,
        "genus": "Jet Pokemon"
    },
    {
        "id": 225,
        "slug": "delibird",
        "name": "Delibird",
        "generation": 2,
        "evolutionChainId": 115,
        "genus": "Delivery Pokemon"
    },
    {
        "id": 226,
        "slug": "mantine",
        "name": "Mantine",
        "generation": 2,
        "evolutionChainId": 116,
        "genus": "Kite Pokemon"
    },
    {
        "id": 227,
        "slug": "skarmory",
        "name": "Skarmory",
        "generation": 2,
        "evolutionChainId": 117,
        "genus": "Armor Bird Pokemon"
    },
    {
        "id": 228,
        "slug": "houndour",
        "name": "Houndour",
        "generation": 2,
        "evolutionChainId": 118,
        "genus": "Dark Pokemon"
    },
    {
        "id": 229,
        "slug": "houndoom",
        "name": "Houndoom",
        "generation": 2,
        "evolutionChainId": 118,
        "genus": "Dark Pokemon"
    },
    {
        "id": 230,
        "slug": "kingdra",
        "name": "Kingdra",
        "generation": 2,
        "evolutionChainId": 54,
        "genus": "Dragon Pokemon"
    },
    {
        "id": 231,
        "slug": "phanpy",
        "name": "Phanpy",
        "generation": 2,
        "evolutionChainId": 119,
        "genus": "Long Nose Pokemon"
    },
    {
        "id": 232,
        "slug": "donphan",
        "name": "Donphan",
        "generation": 2,
        "evolutionChainId": 119,
        "genus": "Armor Pokemon"
    },
    {
        "id": 233,
        "slug": "porygon2",
        "name": "Porygon2",
        "generation": 2,
        "evolutionChainId": 68,
        "genus": "Virtual Pokemon"
    },
    {
        "id": 234,
        "slug": "stantler",
        "name": "Stantler",
        "generation": 2,
        "evolutionChainId": 120,
        "genus": "Big Horn Pokemon"
    },
    {
        "id": 235,
        "slug": "smeargle",
        "name": "Smeargle",
        "generation": 2,
        "evolutionChainId": 121,
        "genus": "Painter Pokemon"
    },
    {
        "id": 236,
        "slug": "tyrogue",
        "name": "Tyrogue",
        "generation": 2,
        "evolutionChainId": 47,
        "genus": "Scuffle Pokemon"
    },
    {
        "id": 237,
        "slug": "hitmontop",
        "name": "Hitmontop",
        "generation": 2,
        "evolutionChainId": 47,
        "genus": "Handstand Pokemon"
    },
    {
        "id": 238,
        "slug": "smoochum",
        "name": "Smoochum",
        "generation": 2,
        "evolutionChainId": 59,
        "genus": "Kiss Pokemon"
    },
    {
        "id": 239,
        "slug": "elekid",
        "name": "Elekid",
        "generation": 2,
        "evolutionChainId": 60,
        "genus": "Electric Pokemon"
    },
    {
        "id": 240,
        "slug": "magby",
        "name": "Magby",
        "generation": 2,
        "evolutionChainId": 61,
        "genus": "Live Coal Pokemon"
    },
    {
        "id": 241,
        "slug": "miltank",
        "name": "Miltank",
        "generation": 2,
        "evolutionChainId": 122,
        "genus": "Milk Cow Pokemon"
    },
    {
        "id": 242,
        "slug": "blissey",
        "name": "Blissey",
        "generation": 2,
        "evolutionChainId": 51,
        "genus": "Happiness Pokemon"
    },
    {
        "id": 243,
        "slug": "raikou",
        "name": "Raikou",
        "generation": 2,
        "evolutionChainId": 123,
        "genus": "Thunder Pokemon"
    },
    {
        "id": 244,
        "slug": "entei",
        "name": "Entei",
        "generation": 2,
        "evolutionChainId": 124,
        "genus": "Volcano Pokemon"
    },
    {
        "id": 245,
        "slug": "suicune",
        "name": "Suicune",
        "generation": 2,
        "evolutionChainId": 125,
        "genus": "Aurora Pokemon"
    },
    {
        "id": 246,
        "slug": "larvitar",
        "name": "Larvitar",
        "generation": 2,
        "evolutionChainId": 126,
        "genus": "Rock Skin Pokemon"
    },
    {
        "id": 247,
        "slug": "pupitar",
        "name": "Pupitar",
        "generation": 2,
        "evolutionChainId": 126,
        "genus": "Hard Shell Pokemon"
    },
    {
        "id": 248,
        "slug": "tyranitar",
        "name": "Tyranitar",
        "generation": 2,
        "evolutionChainId": 126,
        "genus": "Armor Pokemon"
    },
    {
        "id": 249,
        "slug": "lugia",
        "name": "Lugia",
        "generation": 2,
        "evolutionChainId": 127,
        "genus": "Diving Pokemon"
    },
    {
        "id": 250,
        "slug": "ho-oh",
        "name": "Ho-Oh",
        "generation": 2,
        "evolutionChainId": 128,
        "genus": "Rainbow Pokemon"
    },
    {
        "id": 251,
        "slug": "celebi",
        "name": "Celebi",
        "generation": 2,
        "evolutionChainId": 129,
        "genus": "Time Travel Pokemon"
    },
    {
        "id": 252,
        "slug": "treecko",
        "name": "Treecko",
        "generation": 3,
        "evolutionChainId": 130,
        "genus": "Wood Gecko Pokemon"
    },
    {
        "id": 253,
        "slug": "grovyle",
        "name": "Grovyle",
        "generation": 3,
        "evolutionChainId": 130,
        "genus": "Wood Gecko Pokemon"
    },
    {
        "id": 254,
        "slug": "sceptile",
        "name": "Sceptile",
        "generation": 3,
        "evolutionChainId": 130,
        "genus": "Forest Pokemon"
    },
    {
        "id": 255,
        "slug": "torchic",
        "name": "Torchic",
        "generation": 3,
        "evolutionChainId": 131,
        "genus": "Chick Pokemon"
    },
    {
        "id": 256,
        "slug": "combusken",
        "name": "Combusken",
        "generation": 3,
        "evolutionChainId": 131,
        "genus": "Young Fowl Pokemon"
    },
    {
        "id": 257,
        "slug": "blaziken",
        "name": "Blaziken",
        "generation": 3,
        "evolutionChainId": 131,
        "genus": "Blaze Pokemon"
    },
    {
        "id": 258,
        "slug": "mudkip",
        "name": "Mudkip",
        "generation": 3,
        "evolutionChainId": 132,
        "genus": "Mud Fish Pokemon"
    },
    {
        "id": 259,
        "slug": "marshtomp",
        "name": "Marshtomp",
        "generation": 3,
        "evolutionChainId": 132,
        "genus": "Mud Fish Pokemon"
    },
    {
        "id": 260,
        "slug": "swampert",
        "name": "Swampert",
        "generation": 3,
        "evolutionChainId": 132,
        "genus": "Mud Fish Pokemon"
    },
    {
        "id": 261,
        "slug": "poochyena",
        "name": "Poochyena",
        "generation": 3,
        "evolutionChainId": 133,
        "genus": "Bite Pokemon"
    },
    {
        "id": 262,
        "slug": "mightyena",
        "name": "Mightyena",
        "generation": 3,
        "evolutionChainId": 133,
        "genus": "Bite Pokemon"
    },
    {
        "id": 263,
        "slug": "zigzagoon",
        "name": "Zigzagoon",
        "generation": 3,
        "evolutionChainId": 134,
        "genus": "Tiny Raccoon Pokemon"
    },
    {
        "id": 264,
        "slug": "linoone",
        "name": "Linoone",
        "generation": 3,
        "evolutionChainId": 134,
        "genus": "Rushing Pokemon"
    },
    {
        "id": 265,
        "slug": "wurmple",
        "name": "Wurmple",
        "generation": 3,
        "evolutionChainId": 135,
        "genus": "Worm Pokemon"
    },
    {
        "id": 266,
        "slug": "silcoon",
        "name": "Silcoon",
        "generation": 3,
        "evolutionChainId": 135,
        "genus": "Cocoon Pokemon"
    },
    {
        "id": 267,
        "slug": "beautifly",
        "name": "Beautifly",
        "generation": 3,
        "evolutionChainId": 135,
        "genus": "Butterfly Pokemon"
    },
    {
        "id": 268,
        "slug": "cascoon",
        "name": "Cascoon",
        "generation": 3,
        "evolutionChainId": 135,
        "genus": "Cocoon Pokemon"
    },
    {
        "id": 269,
        "slug": "dustox",
        "name": "Dustox",
        "generation": 3,
        "evolutionChainId": 135,
        "genus": "Poison Moth Pokemon"
    },
    {
        "id": 270,
        "slug": "lotad",
        "name": "Lotad",
        "generation": 3,
        "evolutionChainId": 136,
        "genus": "Water Weed Pokemon"
    },
    {
        "id": 271,
        "slug": "lombre",
        "name": "Lombre",
        "generation": 3,
        "evolutionChainId": 136,
        "genus": "Jolly Pokemon"
    },
    {
        "id": 272,
        "slug": "ludicolo",
        "name": "Ludicolo",
        "generation": 3,
        "evolutionChainId": 136,
        "genus": "Carefree Pokemon"
    },
    {
        "id": 273,
        "slug": "seedot",
        "name": "Seedot",
        "generation": 3,
        "evolutionChainId": 137,
        "genus": "Acorn Pokemon"
    },
    {
        "id": 274,
        "slug": "nuzleaf",
        "name": "Nuzleaf",
        "generation": 3,
        "evolutionChainId": 137,
        "genus": "Wily Pokemon"
    },
    {
        "id": 275,
        "slug": "shiftry",
        "name": "Shiftry",
        "generation": 3,
        "evolutionChainId": 137,
        "genus": "Wicked Pokemon"
    },
    {
        "id": 276,
        "slug": "taillow",
        "name": "Taillow",
        "generation": 3,
        "evolutionChainId": 138,
        "genus": "Tiny Swallow Pokemon"
    },
    {
        "id": 277,
        "slug": "swellow",
        "name": "Swellow",
        "generation": 3,
        "evolutionChainId": 138,
        "genus": "Swallow Pokemon"
    },
    {
        "id": 278,
        "slug": "wingull",
        "name": "Wingull",
        "generation": 3,
        "evolutionChainId": 139,
        "genus": "Seagull Pokemon"
    },
    {
        "id": 279,
        "slug": "pelipper",
        "name": "Pelipper",
        "generation": 3,
        "evolutionChainId": 139,
        "genus": "Water Bird Pokemon"
    },
    {
        "id": 280,
        "slug": "ralts",
        "name": "Ralts",
        "generation": 3,
        "evolutionChainId": 140,
        "genus": "Feeling Pokemon"
    },
    {
        "id": 281,
        "slug": "kirlia",
        "name": "Kirlia",
        "generation": 3,
        "evolutionChainId": 140,
        "genus": "Emotion Pokemon"
    },
    {
        "id": 282,
        "slug": "gardevoir",
        "name": "Gardevoir",
        "generation": 3,
        "evolutionChainId": 140,
        "genus": "Embrace Pokemon"
    },
    {
        "id": 283,
        "slug": "surskit",
        "name": "Surskit",
        "generation": 3,
        "evolutionChainId": 141,
        "genus": "Pond Skater Pokemon"
    },
    {
        "id": 284,
        "slug": "masquerain",
        "name": "Masquerain",
        "generation": 3,
        "evolutionChainId": 141,
        "genus": "Eyeball Pokemon"
    },
    {
        "id": 285,
        "slug": "shroomish",
        "name": "Shroomish",
        "generation": 3,
        "evolutionChainId": 142,
        "genus": "Mushroom Pokemon"
    },
    {
        "id": 286,
        "slug": "breloom",
        "name": "Breloom",
        "generation": 3,
        "evolutionChainId": 142,
        "genus": "Mushroom Pokemon"
    },
    {
        "id": 287,
        "slug": "slakoth",
        "name": "Slakoth",
        "generation": 3,
        "evolutionChainId": 143,
        "genus": "Slacker Pokemon"
    },
    {
        "id": 288,
        "slug": "vigoroth",
        "name": "Vigoroth",
        "generation": 3,
        "evolutionChainId": 143,
        "genus": "Wild Monkey Pokemon"
    },
    {
        "id": 289,
        "slug": "slaking",
        "name": "Slaking",
        "generation": 3,
        "evolutionChainId": 143,
        "genus": "Lazy Pokemon"
    },
    {
        "id": 290,
        "slug": "nincada",
        "name": "Nincada",
        "generation": 3,
        "evolutionChainId": 144,
        "genus": "Trainee Pokemon"
    },
    {
        "id": 291,
        "slug": "ninjask",
        "name": "Ninjask",
        "generation": 3,
        "evolutionChainId": 144,
        "genus": "Ninja Pokemon"
    },
    {
        "id": 292,
        "slug": "shedinja",
        "name": "Shedinja",
        "generation": 3,
        "evolutionChainId": 144,
        "genus": "Shed Pokemon"
    },
    {
        "id": 293,
        "slug": "whismur",
        "name": "Whismur",
        "generation": 3,
        "evolutionChainId": 145,
        "genus": "Whisper Pokemon"
    },
    {
        "id": 294,
        "slug": "loudred",
        "name": "Loudred",
        "generation": 3,
        "evolutionChainId": 145,
        "genus": "Big Voice Pokemon"
    },
    {
        "id": 295,
        "slug": "exploud",
        "name": "Exploud",
        "generation": 3,
        "evolutionChainId": 145,
        "genus": "Loud Noise Pokemon"
    },
    {
        "id": 296,
        "slug": "makuhita",
        "name": "Makuhita",
        "generation": 3,
        "evolutionChainId": 146,
        "genus": "Guts Pokemon"
    },
    {
        "id": 297,
        "slug": "hariyama",
        "name": "Hariyama",
        "generation": 3,
        "evolutionChainId": 146,
        "genus": "Arm Thrust Pokemon"
    },
    {
        "id": 298,
        "slug": "azurill",
        "name": "Azurill",
        "generation": 3,
        "evolutionChainId": 90,
        "genus": "Polka Dot Pokemon"
    },
    {
        "id": 299,
        "slug": "nosepass",
        "name": "Nosepass",
        "generation": 3,
        "evolutionChainId": 147,
        "genus": "Compass Pokemon"
    },
    {
        "id": 300,
        "slug": "skitty",
        "name": "Skitty",
        "generation": 3,
        "evolutionChainId": 148,
        "genus": "Kitten Pokemon"
    },
    {
        "id": 301,
        "slug": "delcatty",
        "name": "Delcatty",
        "generation": 3,
        "evolutionChainId": 148,
        "genus": "Prim Pokemon"
    },
    {
        "id": 302,
        "slug": "sableye",
        "name": "Sableye",
        "generation": 3,
        "evolutionChainId": 149,
        "genus": "Darkness Pokemon"
    },
    {
        "id": 303,
        "slug": "mawile",
        "name": "Mawile",
        "generation": 3,
        "evolutionChainId": 150,
        "genus": "Deceiver Pokemon"
    },
    {
        "id": 304,
        "slug": "aron",
        "name": "Aron",
        "generation": 3,
        "evolutionChainId": 151,
        "genus": "Iron Armor Pokemon"
    },
    {
        "id": 305,
        "slug": "lairon",
        "name": "Lairon",
        "generation": 3,
        "evolutionChainId": 151,
        "genus": "Iron Armor Pokemon"
    },
    {
        "id": 306,
        "slug": "aggron",
        "name": "Aggron",
        "generation": 3,
        "evolutionChainId": 151,
        "genus": "Iron Armor Pokemon"
    },
    {
        "id": 307,
        "slug": "meditite",
        "name": "Meditite",
        "generation": 3,
        "evolutionChainId": 152,
        "genus": "Meditate Pokemon"
    },
    {
        "id": 308,
        "slug": "medicham",
        "name": "Medicham",
        "generation": 3,
        "evolutionChainId": 152,
        "genus": "Meditate Pokemon"
    },
    {
        "id": 309,
        "slug": "electrike",
        "name": "Electrike",
        "generation": 3,
        "evolutionChainId": 153,
        "genus": "Lightning Pokemon"
    },
    {
        "id": 310,
        "slug": "manectric",
        "name": "Manectric",
        "generation": 3,
        "evolutionChainId": 153,
        "genus": "Discharge Pokemon"
    },
    {
        "id": 311,
        "slug": "plusle",
        "name": "Plusle",
        "generation": 3,
        "evolutionChainId": 154,
        "genus": "Cheering Pokemon"
    },
    {
        "id": 312,
        "slug": "minun",
        "name": "Minun",
        "generation": 3,
        "evolutionChainId": 155,
        "genus": "Cheering Pokemon"
    },
    {
        "id": 313,
        "slug": "volbeat",
        "name": "Volbeat",
        "generation": 3,
        "evolutionChainId": 156,
        "genus": "Firefly Pokemon"
    },
    {
        "id": 314,
        "slug": "illumise",
        "name": "Illumise",
        "generation": 3,
        "evolutionChainId": 157,
        "genus": "Firefly Pokemon"
    },
    {
        "id": 315,
        "slug": "roselia",
        "name": "Roselia",
        "generation": 3,
        "evolutionChainId": 158,
        "genus": "Thorn Pokemon"
    },
    {
        "id": 316,
        "slug": "gulpin",
        "name": "Gulpin",
        "generation": 3,
        "evolutionChainId": 159,
        "genus": "Stomach Pokemon"
    },
    {
        "id": 317,
        "slug": "swalot",
        "name": "Swalot",
        "generation": 3,
        "evolutionChainId": 159,
        "genus": "Poison Bag Pokemon"
    },
    {
        "id": 318,
        "slug": "carvanha",
        "name": "Carvanha",
        "generation": 3,
        "evolutionChainId": 160,
        "genus": "Savage Pokemon"
    },
    {
        "id": 319,
        "slug": "sharpedo",
        "name": "Sharpedo",
        "generation": 3,
        "evolutionChainId": 160,
        "genus": "Brutal Pokemon"
    },
    {
        "id": 320,
        "slug": "wailmer",
        "name": "Wailmer",
        "generation": 3,
        "evolutionChainId": 161,
        "genus": "Ball Whale Pokemon"
    },
    {
        "id": 321,
        "slug": "wailord",
        "name": "Wailord",
        "generation": 3,
        "evolutionChainId": 161,
        "genus": "Float Whale Pokemon"
    },
    {
        "id": 322,
        "slug": "numel",
        "name": "Numel",
        "generation": 3,
        "evolutionChainId": 162,
        "genus": "Numb Pokemon"
    },
    {
        "id": 323,
        "slug": "camerupt",
        "name": "Camerupt",
        "generation": 3,
        "evolutionChainId": 162,
        "genus": "Eruption Pokemon"
    },
    {
        "id": 324,
        "slug": "torkoal",
        "name": "Torkoal",
        "generation": 3,
        "evolutionChainId": 163,
        "genus": "Coal Pokemon"
    },
    {
        "id": 325,
        "slug": "spoink",
        "name": "Spoink",
        "generation": 3,
        "evolutionChainId": 164,
        "genus": "Bounce Pokemon"
    },
    {
        "id": 326,
        "slug": "grumpig",
        "name": "Grumpig",
        "generation": 3,
        "evolutionChainId": 164,
        "genus": "Manipulate Pokemon"
    },
    {
        "id": 327,
        "slug": "spinda",
        "name": "Spinda",
        "generation": 3,
        "evolutionChainId": 165,
        "genus": "Spot Panda Pokemon"
    },
    {
        "id": 328,
        "slug": "trapinch",
        "name": "Trapinch",
        "generation": 3,
        "evolutionChainId": 166,
        "genus": "Ant Pit Pokemon"
    },
    {
        "id": 329,
        "slug": "vibrava",
        "name": "Vibrava",
        "generation": 3,
        "evolutionChainId": 166,
        "genus": "Vibration Pokemon"
    },
    {
        "id": 330,
        "slug": "flygon",
        "name": "Flygon",
        "generation": 3,
        "evolutionChainId": 166,
        "genus": "Mystic Pokemon"
    },
    {
        "id": 331,
        "slug": "cacnea",
        "name": "Cacnea",
        "generation": 3,
        "evolutionChainId": 167,
        "genus": "Cactus Pokemon"
    },
    {
        "id": 332,
        "slug": "cacturne",
        "name": "Cacturne",
        "generation": 3,
        "evolutionChainId": 167,
        "genus": "Scarecrow Pokemon"
    },
    {
        "id": 333,
        "slug": "swablu",
        "name": "Swablu",
        "generation": 3,
        "evolutionChainId": 168,
        "genus": "Cotton Bird Pokemon"
    },
    {
        "id": 334,
        "slug": "altaria",
        "name": "Altaria",
        "generation": 3,
        "evolutionChainId": 168,
        "genus": "Humming Pokemon"
    },
    {
        "id": 335,
        "slug": "zangoose",
        "name": "Zangoose",
        "generation": 3,
        "evolutionChainId": 169,
        "genus": "Cat Ferret Pokemon"
    },
    {
        "id": 336,
        "slug": "seviper",
        "name": "Seviper",
        "generation": 3,
        "evolutionChainId": 170,
        "genus": "Fang Snake Pokemon"
    },
    {
        "id": 337,
        "slug": "lunatone",
        "name": "Lunatone",
        "generation": 3,
        "evolutionChainId": 171,
        "genus": "Meteorite Pokemon"
    },
    {
        "id": 338,
        "slug": "solrock",
        "name": "Solrock",
        "generation": 3,
        "evolutionChainId": 172,
        "genus": "Meteorite Pokemon"
    },
    {
        "id": 339,
        "slug": "barboach",
        "name": "Barboach",
        "generation": 3,
        "evolutionChainId": 173,
        "genus": "Whiskers Pokemon"
    },
    {
        "id": 340,
        "slug": "whiscash",
        "name": "Whiscash",
        "generation": 3,
        "evolutionChainId": 173,
        "genus": "Whiskers Pokemon"
    },
    {
        "id": 341,
        "slug": "corphish",
        "name": "Corphish",
        "generation": 3,
        "evolutionChainId": 174,
        "genus": "Ruffian Pokemon"
    },
    {
        "id": 342,
        "slug": "crawdaunt",
        "name": "Crawdaunt",
        "generation": 3,
        "evolutionChainId": 174,
        "genus": "Rogue Pokemon"
    },
    {
        "id": 343,
        "slug": "baltoy",
        "name": "Baltoy",
        "generation": 3,
        "evolutionChainId": 175,
        "genus": "Clay Doll Pokemon"
    },
    {
        "id": 344,
        "slug": "claydol",
        "name": "Claydol",
        "generation": 3,
        "evolutionChainId": 175,
        "genus": "Clay Doll Pokemon"
    },
    {
        "id": 345,
        "slug": "lileep",
        "name": "Lileep",
        "generation": 3,
        "evolutionChainId": 176,
        "genus": "Sea Lily Pokemon"
    },
    {
        "id": 346,
        "slug": "cradily",
        "name": "Cradily",
        "generation": 3,
        "evolutionChainId": 176,
        "genus": "Barnacle Pokemon"
    },
    {
        "id": 347,
        "slug": "anorith",
        "name": "Anorith",
        "generation": 3,
        "evolutionChainId": 177,
        "genus": "Old Shrimp Pokemon"
    },
    {
        "id": 348,
        "slug": "armaldo",
        "name": "Armaldo",
        "generation": 3,
        "evolutionChainId": 177,
        "genus": "Plate Pokemon"
    },
    {
        "id": 349,
        "slug": "feebas",
        "name": "Feebas",
        "generation": 3,
        "evolutionChainId": 178,
        "genus": "Fish Pokemon"
    },
    {
        "id": 350,
        "slug": "milotic",
        "name": "Milotic",
        "generation": 3,
        "evolutionChainId": 178,
        "genus": "Tender Pokemon"
    },
    {
        "id": 351,
        "slug": "castform",
        "name": "Castform",
        "generation": 3,
        "evolutionChainId": 179,
        "genus": "Weather Pokemon"
    },
    {
        "id": 352,
        "slug": "kecleon",
        "name": "Kecleon",
        "generation": 3,
        "evolutionChainId": 180,
        "genus": "Color Swap Pokemon"
    },
    {
        "id": 353,
        "slug": "shuppet",
        "name": "Shuppet",
        "generation": 3,
        "evolutionChainId": 181,
        "genus": "Puppet Pokemon"
    },
    {
        "id": 354,
        "slug": "banette",
        "name": "Banette",
        "generation": 3,
        "evolutionChainId": 181,
        "genus": "Marionette Pokemon"
    },
    {
        "id": 355,
        "slug": "duskull",
        "name": "Duskull",
        "generation": 3,
        "evolutionChainId": 182,
        "genus": "Requiem Pokemon"
    },
    {
        "id": 356,
        "slug": "dusclops",
        "name": "Dusclops",
        "generation": 3,
        "evolutionChainId": 182,
        "genus": "Beckon Pokemon"
    },
    {
        "id": 357,
        "slug": "tropius",
        "name": "Tropius",
        "generation": 3,
        "evolutionChainId": 183,
        "genus": "Fruit Pokemon"
    },
    {
        "id": 358,
        "slug": "chimecho",
        "name": "Chimecho",
        "generation": 3,
        "evolutionChainId": 184,
        "genus": "Wind Chime Pokemon"
    },
    {
        "id": 359,
        "slug": "absol",
        "name": "Absol",
        "generation": 3,
        "evolutionChainId": 185,
        "genus": "Disaster Pokemon"
    },
    {
        "id": 360,
        "slug": "wynaut",
        "name": "Wynaut",
        "generation": 3,
        "evolutionChainId": 100,
        "genus": "Bright Pokemon"
    },
    {
        "id": 361,
        "slug": "snorunt",
        "name": "Snorunt",
        "generation": 3,
        "evolutionChainId": 186,
        "genus": "Snow Hat Pokemon"
    },
    {
        "id": 362,
        "slug": "glalie",
        "name": "Glalie",
        "generation": 3,
        "evolutionChainId": 186,
        "genus": "Face Pokemon"
    },
    {
        "id": 363,
        "slug": "spheal",
        "name": "Spheal",
        "generation": 3,
        "evolutionChainId": 187,
        "genus": "Clap Pokemon"
    },
    {
        "id": 364,
        "slug": "sealeo",
        "name": "Sealeo",
        "generation": 3,
        "evolutionChainId": 187,
        "genus": "Ball Roll Pokemon"
    },
    {
        "id": 365,
        "slug": "walrein",
        "name": "Walrein",
        "generation": 3,
        "evolutionChainId": 187,
        "genus": "Ice Break Pokemon"
    },
    {
        "id": 366,
        "slug": "clamperl",
        "name": "Clamperl",
        "generation": 3,
        "evolutionChainId": 188,
        "genus": "Bivalve Pokemon"
    },
    {
        "id": 367,
        "slug": "huntail",
        "name": "Huntail",
        "generation": 3,
        "evolutionChainId": 188,
        "genus": "Deep Sea Pokemon"
    },
    {
        "id": 368,
        "slug": "gorebyss",
        "name": "Gorebyss",
        "generation": 3,
        "evolutionChainId": 188,
        "genus": "South Sea Pokemon"
    },
    {
        "id": 369,
        "slug": "relicanth",
        "name": "Relicanth",
        "generation": 3,
        "evolutionChainId": 189,
        "genus": "Longevity Pokemon"
    },
    {
        "id": 370,
        "slug": "luvdisc",
        "name": "Luvdisc",
        "generation": 3,
        "evolutionChainId": 190,
        "genus": "Rendezvous Pokemon"
    },
    {
        "id": 371,
        "slug": "bagon",
        "name": "Bagon",
        "generation": 3,
        "evolutionChainId": 191,
        "genus": "Rock Head Pokemon"
    },
    {
        "id": 372,
        "slug": "shelgon",
        "name": "Shelgon",
        "generation": 3,
        "evolutionChainId": 191,
        "genus": "Endurance Pokemon"
    },
    {
        "id": 373,
        "slug": "salamence",
        "name": "Salamence",
        "generation": 3,
        "evolutionChainId": 191,
        "genus": "Dragon Pokemon"
    },
    {
        "id": 374,
        "slug": "beldum",
        "name": "Beldum",
        "generation": 3,
        "evolutionChainId": 192,
        "genus": "Iron Ball Pokemon"
    },
    {
        "id": 375,
        "slug": "metang",
        "name": "Metang",
        "generation": 3,
        "evolutionChainId": 192,
        "genus": "Iron Claw Pokemon"
    },
    {
        "id": 376,
        "slug": "metagross",
        "name": "Metagross",
        "generation": 3,
        "evolutionChainId": 192,
        "genus": "Iron Leg Pokemon"
    },
    {
        "id": 377,
        "slug": "regirock",
        "name": "Regirock",
        "generation": 3,
        "evolutionChainId": 193,
        "genus": "Rock Peak Pokemon"
    },
    {
        "id": 378,
        "slug": "regice",
        "name": "Regice",
        "generation": 3,
        "evolutionChainId": 194,
        "genus": "Iceberg Pokemon"
    },
    {
        "id": 379,
        "slug": "registeel",
        "name": "Registeel",
        "generation": 3,
        "evolutionChainId": 195,
        "genus": "Iron Pokemon"
    },
    {
        "id": 380,
        "slug": "latias",
        "name": "Latias",
        "generation": 3,
        "evolutionChainId": 196,
        "genus": "Eon Pokemon"
    },
    {
        "id": 381,
        "slug": "latios",
        "name": "Latios",
        "generation": 3,
        "evolutionChainId": 197,
        "genus": "Eon Pokemon"
    },
    {
        "id": 382,
        "slug": "kyogre",
        "name": "Kyogre",
        "generation": 3,
        "evolutionChainId": 198,
        "genus": "Sea Basin Pokemon"
    },
    {
        "id": 383,
        "slug": "groudon",
        "name": "Groudon",
        "generation": 3,
        "evolutionChainId": 199,
        "genus": "Continent Pokemon"
    },
    {
        "id": 384,
        "slug": "rayquaza",
        "name": "Rayquaza",
        "generation": 3,
        "evolutionChainId": 200,
        "genus": "Sky High Pokemon"
    },
    {
        "id": 385,
        "slug": "jirachi",
        "name": "Jirachi",
        "generation": 3,
        "evolutionChainId": 201,
        "genus": "Wish Pokemon"
    },
    {
        "id": 386,
        "slug": "deoxys",
        "name": "Deoxys",
        "generation": 3,
        "evolutionChainId": 202,
        "genus": "DNA Pokemon"
    },
    {
        "id": 387,
        "slug": "turtwig",
        "name": "Turtwig",
        "generation": 4,
        "evolutionChainId": 203,
        "genus": "Tiny Leaf Pokemon"
    },
    {
        "id": 388,
        "slug": "grotle",
        "name": "Grotle",
        "generation": 4,
        "evolutionChainId": 203,
        "genus": "Grove Pokemon"
    },
    {
        "id": 389,
        "slug": "torterra",
        "name": "Torterra",
        "generation": 4,
        "evolutionChainId": 203,
        "genus": "Continent Pokemon"
    },
    {
        "id": 390,
        "slug": "chimchar",
        "name": "Chimchar",
        "generation": 4,
        "evolutionChainId": 204,
        "genus": "Chimp Pokemon"
    },
    {
        "id": 391,
        "slug": "monferno",
        "name": "Monferno",
        "generation": 4,
        "evolutionChainId": 204,
        "genus": "Playful Pokemon"
    },
    {
        "id": 392,
        "slug": "infernape",
        "name": "Infernape",
        "generation": 4,
        "evolutionChainId": 204,
        "genus": "Flame Pokemon"
    },
    {
        "id": 393,
        "slug": "piplup",
        "name": "Piplup",
        "generation": 4,
        "evolutionChainId": 205,
        "genus": "Penguin Pokemon"
    },
    {
        "id": 394,
        "slug": "prinplup",
        "name": "Prinplup",
        "generation": 4,
        "evolutionChainId": 205,
        "genus": "Penguin Pokemon"
    },
    {
        "id": 395,
        "slug": "empoleon",
        "name": "Empoleon",
        "generation": 4,
        "evolutionChainId": 205,
        "genus": "Emperor Pokemon"
    },
    {
        "id": 396,
        "slug": "starly",
        "name": "Starly",
        "generation": 4,
        "evolutionChainId": 206,
        "genus": "Starling Pokemon"
    },
    {
        "id": 397,
        "slug": "staravia",
        "name": "Staravia",
        "generation": 4,
        "evolutionChainId": 206,
        "genus": "Starling Pokemon"
    },
    {
        "id": 398,
        "slug": "staraptor",
        "name": "Staraptor",
        "generation": 4,
        "evolutionChainId": 206,
        "genus": "Predator Pokemon"
    },
    {
        "id": 399,
        "slug": "bidoof",
        "name": "Bidoof",
        "generation": 4,
        "evolutionChainId": 207,
        "genus": "Plump Mouse Pokemon"
    },
    {
        "id": 400,
        "slug": "bibarel",
        "name": "Bibarel",
        "generation": 4,
        "evolutionChainId": 207,
        "genus": "Beaver Pokemon"
    },
    {
        "id": 401,
        "slug": "kricketot",
        "name": "Kricketot",
        "generation": 4,
        "evolutionChainId": 208,
        "genus": "Cricket Pokemon"
    },
    {
        "id": 402,
        "slug": "kricketune",
        "name": "Kricketune",
        "generation": 4,
        "evolutionChainId": 208,
        "genus": "Cricket Pokemon"
    },
    {
        "id": 403,
        "slug": "shinx",
        "name": "Shinx",
        "generation": 4,
        "evolutionChainId": 209,
        "genus": "Flash Pokemon"
    },
    {
        "id": 404,
        "slug": "luxio",
        "name": "Luxio",
        "generation": 4,
        "evolutionChainId": 209,
        "genus": "Spark Pokemon"
    },
    {
        "id": 405,
        "slug": "luxray",
        "name": "Luxray",
        "generation": 4,
        "evolutionChainId": 209,
        "genus": "Gleam Eyes Pokemon"
    },
    {
        "id": 406,
        "slug": "budew",
        "name": "Budew",
        "generation": 4,
        "evolutionChainId": 158,
        "genus": "Bud Pokemon"
    },
    {
        "id": 407,
        "slug": "roserade",
        "name": "Roserade",
        "generation": 4,
        "evolutionChainId": 158,
        "genus": "Bouquet Pokemon"
    },
    {
        "id": 408,
        "slug": "cranidos",
        "name": "Cranidos",
        "generation": 4,
        "evolutionChainId": 211,
        "genus": "Head Butt Pokemon"
    },
    {
        "id": 409,
        "slug": "rampardos",
        "name": "Rampardos",
        "generation": 4,
        "evolutionChainId": 211,
        "genus": "Head Butt Pokemon"
    },
    {
        "id": 410,
        "slug": "shieldon",
        "name": "Shieldon",
        "generation": 4,
        "evolutionChainId": 212,
        "genus": "Shield Pokemon"
    },
    {
        "id": 411,
        "slug": "bastiodon",
        "name": "Bastiodon",
        "generation": 4,
        "evolutionChainId": 212,
        "genus": "Shield Pokemon"
    },
    {
        "id": 412,
        "slug": "burmy",
        "name": "Burmy",
        "generation": 4,
        "evolutionChainId": 213,
        "genus": "Bagworm Pokemon"
    },
    {
        "id": 413,
        "slug": "wormadam",
        "name": "Wormadam",
        "generation": 4,
        "evolutionChainId": 213,
        "genus": "Bagworm Pokemon"
    },
    {
        "id": 414,
        "slug": "mothim",
        "name": "Mothim",
        "generation": 4,
        "evolutionChainId": 213,
        "genus": "Moth Pokemon"
    },
    {
        "id": 415,
        "slug": "combee",
        "name": "Combee",
        "generation": 4,
        "evolutionChainId": 214,
        "genus": "Tiny Bee Pokemon"
    },
    {
        "id": 416,
        "slug": "vespiquen",
        "name": "Vespiquen",
        "generation": 4,
        "evolutionChainId": 214,
        "genus": "Beehive Pokemon"
    },
    {
        "id": 417,
        "slug": "pachirisu",
        "name": "Pachirisu",
        "generation": 4,
        "evolutionChainId": 215,
        "genus": "EleSquirrel Pokemon"
    },
    {
        "id": 418,
        "slug": "buizel",
        "name": "Buizel",
        "generation": 4,
        "evolutionChainId": 216,
        "genus": "Sea Weasel Pokemon"
    },
    {
        "id": 419,
        "slug": "floatzel",
        "name": "Floatzel",
        "generation": 4,
        "evolutionChainId": 216,
        "genus": "Sea Weasel Pokemon"
    },
    {
        "id": 420,
        "slug": "cherubi",
        "name": "Cherubi",
        "generation": 4,
        "evolutionChainId": 217,
        "genus": "Cherry Pokemon"
    },
    {
        "id": 421,
        "slug": "cherrim",
        "name": "Cherrim",
        "generation": 4,
        "evolutionChainId": 217,
        "genus": "Blossom Pokemon"
    },
    {
        "id": 422,
        "slug": "shellos",
        "name": "Shellos",
        "generation": 4,
        "evolutionChainId": 218,
        "genus": "Sea Slug Pokemon"
    },
    {
        "id": 423,
        "slug": "gastrodon",
        "name": "Gastrodon",
        "generation": 4,
        "evolutionChainId": 218,
        "genus": "Sea Slug Pokemon"
    },
    {
        "id": 424,
        "slug": "ambipom",
        "name": "Ambipom",
        "generation": 4,
        "evolutionChainId": 93,
        "genus": "Long Tail Pokemon"
    },
    {
        "id": 425,
        "slug": "drifloon",
        "name": "Drifloon",
        "generation": 4,
        "evolutionChainId": 219,
        "genus": "Balloon Pokemon"
    },
    {
        "id": 426,
        "slug": "drifblim",
        "name": "Drifblim",
        "generation": 4,
        "evolutionChainId": 219,
        "genus": "Blimp Pokemon"
    },
    {
        "id": 427,
        "slug": "buneary",
        "name": "Buneary",
        "generation": 4,
        "evolutionChainId": 220,
        "genus": "Rabbit Pokemon"
    },
    {
        "id": 428,
        "slug": "lopunny",
        "name": "Lopunny",
        "generation": 4,
        "evolutionChainId": 220,
        "genus": "Rabbit Pokemon"
    },
    {
        "id": 429,
        "slug": "mismagius",
        "name": "Mismagius",
        "generation": 4,
        "evolutionChainId": 98,
        "genus": "Magical Pokemon"
    },
    {
        "id": 430,
        "slug": "honchkrow",
        "name": "Honchkrow",
        "generation": 4,
        "evolutionChainId": 97,
        "genus": "Big Boss Pokemon"
    },
    {
        "id": 431,
        "slug": "glameow",
        "name": "Glameow",
        "generation": 4,
        "evolutionChainId": 221,
        "genus": "Catty Pokemon"
    },
    {
        "id": 432,
        "slug": "purugly",
        "name": "Purugly",
        "generation": 4,
        "evolutionChainId": 221,
        "genus": "Tiger Cat Pokemon"
    },
    {
        "id": 433,
        "slug": "chingling",
        "name": "Chingling",
        "generation": 4,
        "evolutionChainId": 184,
        "genus": "Bell Pokemon"
    },
    {
        "id": 434,
        "slug": "stunky",
        "name": "Stunky",
        "generation": 4,
        "evolutionChainId": 223,
        "genus": "Skunk Pokemon"
    },
    {
        "id": 435,
        "slug": "skuntank",
        "name": "Skuntank",
        "generation": 4,
        "evolutionChainId": 223,
        "genus": "Skunk Pokemon"
    },
    {
        "id": 436,
        "slug": "bronzor",
        "name": "Bronzor",
        "generation": 4,
        "evolutionChainId": 224,
        "genus": "Bronze Pokemon"
    },
    {
        "id": 437,
        "slug": "bronzong",
        "name": "Bronzong",
        "generation": 4,
        "evolutionChainId": 224,
        "genus": "Bronze Bell Pokemon"
    },
    {
        "id": 438,
        "slug": "bonsly",
        "name": "Bonsly",
        "generation": 4,
        "evolutionChainId": 91,
        "genus": "Bonsai Pokemon"
    },
    {
        "id": 439,
        "slug": "mime-jr",
        "name": "Mime Jr.",
        "generation": 4,
        "evolutionChainId": 57,
        "genus": "Mime Pokemon"
    },
    {
        "id": 440,
        "slug": "happiny",
        "name": "Happiny",
        "generation": 4,
        "evolutionChainId": 51,
        "genus": "Playhouse Pokemon"
    },
    {
        "id": 441,
        "slug": "chatot",
        "name": "Chatot",
        "generation": 4,
        "evolutionChainId": 228,
        "genus": "Music Note Pokemon"
    },
    {
        "id": 442,
        "slug": "spiritomb",
        "name": "Spiritomb",
        "generation": 4,
        "evolutionChainId": 229,
        "genus": "Forbidden Pokemon"
    },
    {
        "id": 443,
        "slug": "gible",
        "name": "Gible",
        "generation": 4,
        "evolutionChainId": 230,
        "genus": "Land Shark Pokemon"
    },
    {
        "id": 444,
        "slug": "gabite",
        "name": "Gabite",
        "generation": 4,
        "evolutionChainId": 230,
        "genus": "Cave Pokemon"
    },
    {
        "id": 445,
        "slug": "garchomp",
        "name": "Garchomp",
        "generation": 4,
        "evolutionChainId": 230,
        "genus": "Mach Pokemon"
    },
    {
        "id": 446,
        "slug": "munchlax",
        "name": "Munchlax",
        "generation": 4,
        "evolutionChainId": 72,
        "genus": "Big Eater Pokemon"
    },
    {
        "id": 447,
        "slug": "riolu",
        "name": "Riolu",
        "generation": 4,
        "evolutionChainId": 232,
        "genus": "Emanation Pokemon"
    },
    {
        "id": 448,
        "slug": "lucario",
        "name": "Lucario",
        "generation": 4,
        "evolutionChainId": 232,
        "genus": "Aura Pokemon"
    },
    {
        "id": 449,
        "slug": "hippopotas",
        "name": "Hippopotas",
        "generation": 4,
        "evolutionChainId": 233,
        "genus": "Hippo Pokemon"
    },
    {
        "id": 450,
        "slug": "hippowdon",
        "name": "Hippowdon",
        "generation": 4,
        "evolutionChainId": 233,
        "genus": "Heavyweight Pokemon"
    },
    {
        "id": 451,
        "slug": "skorupi",
        "name": "Skorupi",
        "generation": 4,
        "evolutionChainId": 234,
        "genus": "Scorpion Pokemon"
    },
    {
        "id": 452,
        "slug": "drapion",
        "name": "Drapion",
        "generation": 4,
        "evolutionChainId": 234,
        "genus": "Ogre Scorpion Pokemon"
    },
    {
        "id": 453,
        "slug": "croagunk",
        "name": "Croagunk",
        "generation": 4,
        "evolutionChainId": 235,
        "genus": "Toxic Mouth Pokemon"
    },
    {
        "id": 454,
        "slug": "toxicroak",
        "name": "Toxicroak",
        "generation": 4,
        "evolutionChainId": 235,
        "genus": "Toxic Mouth Pokemon"
    },
    {
        "id": 455,
        "slug": "carnivine",
        "name": "Carnivine",
        "generation": 4,
        "evolutionChainId": 236,
        "genus": "Bug Catcher Pokemon"
    },
    {
        "id": 456,
        "slug": "finneon",
        "name": "Finneon",
        "generation": 4,
        "evolutionChainId": 237,
        "genus": "Wing Fish Pokemon"
    },
    {
        "id": 457,
        "slug": "lumineon",
        "name": "Lumineon",
        "generation": 4,
        "evolutionChainId": 237,
        "genus": "Neon Pokemon"
    },
    {
        "id": 458,
        "slug": "mantyke",
        "name": "Mantyke",
        "generation": 4,
        "evolutionChainId": 116,
        "genus": "Kite Pokemon"
    },
    {
        "id": 459,
        "slug": "snover",
        "name": "Snover",
        "generation": 4,
        "evolutionChainId": 239,
        "genus": "Frost Tree Pokemon"
    },
    {
        "id": 460,
        "slug": "abomasnow",
        "name": "Abomasnow",
        "generation": 4,
        "evolutionChainId": 239,
        "genus": "Frost Tree Pokemon"
    },
    {
        "id": 461,
        "slug": "weavile",
        "name": "Weavile",
        "generation": 4,
        "evolutionChainId": 109,
        "genus": "Sharp Claw Pokemon"
    },
    {
        "id": 462,
        "slug": "magnezone",
        "name": "Magnezone",
        "generation": 4,
        "evolutionChainId": 34,
        "genus": "Magnet Area Pokemon"
    },
    {
        "id": 463,
        "slug": "lickilicky",
        "name": "Lickilicky",
        "generation": 4,
        "evolutionChainId": 48,
        "genus": "Licking Pokemon"
    },
    {
        "id": 464,
        "slug": "rhyperior",
        "name": "Rhyperior",
        "generation": 4,
        "evolutionChainId": 50,
        "genus": "Drill Pokemon"
    },
    {
        "id": 465,
        "slug": "tangrowth",
        "name": "Tangrowth",
        "generation": 4,
        "evolutionChainId": 52,
        "genus": "Vine Pokemon"
    },
    {
        "id": 466,
        "slug": "electivire",
        "name": "Electivire",
        "generation": 4,
        "evolutionChainId": 60,
        "genus": "Thunderbolt Pokemon"
    },
    {
        "id": 467,
        "slug": "magmortar",
        "name": "Magmortar",
        "generation": 4,
        "evolutionChainId": 61,
        "genus": "Blast Pokemon"
    },
    {
        "id": 468,
        "slug": "togekiss",
        "name": "Togekiss",
        "generation": 4,
        "evolutionChainId": 87,
        "genus": "Jubilee Pokemon"
    },
    {
        "id": 469,
        "slug": "yanmega",
        "name": "Yanmega",
        "generation": 4,
        "evolutionChainId": 95,
        "genus": "Ogre Darner Pokemon"
    },
    {
        "id": 470,
        "slug": "leafeon",
        "name": "Leafeon",
        "generation": 4,
        "evolutionChainId": 67,
        "genus": "Verdant Pokemon"
    },
    {
        "id": 471,
        "slug": "glaceon",
        "name": "Glaceon",
        "generation": 4,
        "evolutionChainId": 67,
        "genus": "Fresh Snow Pokemon"
    },
    {
        "id": 472,
        "slug": "gliscor",
        "name": "Gliscor",
        "generation": 4,
        "evolutionChainId": 104,
        "genus": "Fang Scorpion Pokemon"
    },
    {
        "id": 473,
        "slug": "mamoswine",
        "name": "Mamoswine",
        "generation": 4,
        "evolutionChainId": 112,
        "genus": "Twin Tusk Pokemon"
    },
    {
        "id": 474,
        "slug": "porygon-z",
        "name": "Porygon-Z",
        "generation": 4,
        "evolutionChainId": 68,
        "genus": "Virtual Pokemon"
    },
    {
        "id": 475,
        "slug": "gallade",
        "name": "Gallade",
        "generation": 4,
        "evolutionChainId": 140,
        "genus": "Blade Pokemon"
    },
    {
        "id": 476,
        "slug": "probopass",
        "name": "Probopass",
        "generation": 4,
        "evolutionChainId": 147,
        "genus": "Compass Pokemon"
    },
    {
        "id": 477,
        "slug": "dusknoir",
        "name": "Dusknoir",
        "generation": 4,
        "evolutionChainId": 182,
        "genus": "Gripper Pokemon"
    },
    {
        "id": 478,
        "slug": "froslass",
        "name": "Froslass",
        "generation": 4,
        "evolutionChainId": 186,
        "genus": "Snow Land Pokemon"
    },
    {
        "id": 479,
        "slug": "rotom",
        "name": "Rotom",
        "generation": 4,
        "evolutionChainId": 240,
        "genus": "Plasma Pokemon"
    },
    {
        "id": 480,
        "slug": "uxie",
        "name": "Uxie",
        "generation": 4,
        "evolutionChainId": 241,
        "genus": "Knowledge Pokemon"
    },
    {
        "id": 481,
        "slug": "mesprit",
        "name": "Mesprit",
        "generation": 4,
        "evolutionChainId": 242,
        "genus": "Emotion Pokemon"
    },
    {
        "id": 482,
        "slug": "azelf",
        "name": "Azelf",
        "generation": 4,
        "evolutionChainId": 243,
        "genus": "Willpower Pokemon"
    },
    {
        "id": 483,
        "slug": "dialga",
        "name": "Dialga",
        "generation": 4,
        "evolutionChainId": 244,
        "genus": "Temporal Pokemon"
    },
    {
        "id": 484,
        "slug": "palkia",
        "name": "Palkia",
        "generation": 4,
        "evolutionChainId": 245,
        "genus": "Spatial Pokemon"
    },
    {
        "id": 485,
        "slug": "heatran",
        "name": "Heatran",
        "generation": 4,
        "evolutionChainId": 246,
        "genus": "Lava Dome Pokemon"
    },
    {
        "id": 486,
        "slug": "regigigas",
        "name": "Regigigas",
        "generation": 4,
        "evolutionChainId": 247,
        "genus": "Colossal Pokemon"
    },
    {
        "id": 487,
        "slug": "giratina",
        "name": "Giratina",
        "generation": 4,
        "evolutionChainId": 248,
        "genus": "Renegade Pokemon"
    },
    {
        "id": 488,
        "slug": "cresselia",
        "name": "Cresselia",
        "generation": 4,
        "evolutionChainId": 249,
        "genus": "Lunar Pokemon"
    },
    {
        "id": 489,
        "slug": "phione",
        "name": "Phione",
        "generation": 4,
        "evolutionChainId": 250,
        "genus": "Sea Drifter Pokemon"
    },
    {
        "id": 490,
        "slug": "manaphy",
        "name": "Manaphy",
        "generation": 4,
        "evolutionChainId": 250,
        "genus": "Seafaring Pokemon"
    },
    {
        "id": 491,
        "slug": "darkrai",
        "name": "Darkrai",
        "generation": 4,
        "evolutionChainId": 252,
        "genus": "Pitch-Black Pokemon"
    },
    {
        "id": 492,
        "slug": "shaymin",
        "name": "Shaymin",
        "generation": 4,
        "evolutionChainId": 253,
        "genus": "Gratitude Pokemon"
    },
    {
        "id": 493,
        "slug": "arceus",
        "name": "Arceus",
        "generation": 4,
        "evolutionChainId": 254,
        "genus": "Alpha Pokemon"
    },
    {
        "id": 494,
        "slug": "victini",
        "name": "Victini",
        "generation": 5,
        "evolutionChainId": 255,
        "genus": "Victory Pokemon"
    },
    {
        "id": 495,
        "slug": "snivy",
        "name": "Snivy",
        "generation": 5,
        "evolutionChainId": 256,
        "genus": "Grass Snake Pokemon"
    },
    {
        "id": 496,
        "slug": "servine",
        "name": "Servine",
        "generation": 5,
        "evolutionChainId": 256,
        "genus": "Grass Snake Pokemon"
    },
    {
        "id": 497,
        "slug": "serperior",
        "name": "Serperior",
        "generation": 5,
        "evolutionChainId": 256,
        "genus": "Regal Pokemon"
    },
    {
        "id": 498,
        "slug": "tepig",
        "name": "Tepig",
        "generation": 5,
        "evolutionChainId": 257,
        "genus": "Fire Pig Pokemon"
    },
    {
        "id": 499,
        "slug": "pignite",
        "name": "Pignite",
        "generation": 5,
        "evolutionChainId": 257,
        "genus": "Fire Pig Pokemon"
    },
    {
        "id": 500,
        "slug": "emboar",
        "name": "Emboar",
        "generation": 5,
        "evolutionChainId": 257,
        "genus": "Mega Fire Pig Pokemon"
    },
    {
        "id": 501,
        "slug": "oshawott",
        "name": "Oshawott",
        "generation": 5,
        "evolutionChainId": 258,
        "genus": "Sea Otter Pokemon"
    },
    {
        "id": 502,
        "slug": "dewott",
        "name": "Dewott",
        "generation": 5,
        "evolutionChainId": 258,
        "genus": "Discipline Pokemon"
    },
    {
        "id": 503,
        "slug": "samurott",
        "name": "Samurott",
        "generation": 5,
        "evolutionChainId": 258,
        "genus": "Formidable Pokemon"
    },
    {
        "id": 504,
        "slug": "patrat",
        "name": "Patrat",
        "generation": 5,
        "evolutionChainId": 259,
        "genus": "Scout Pokemon"
    },
    {
        "id": 505,
        "slug": "watchog",
        "name": "Watchog",
        "generation": 5,
        "evolutionChainId": 259,
        "genus": "Lookout Pokemon"
    },
    {
        "id": 506,
        "slug": "lillipup",
        "name": "Lillipup",
        "generation": 5,
        "evolutionChainId": 260,
        "genus": "Puppy Pokemon"
    },
    {
        "id": 507,
        "slug": "herdier",
        "name": "Herdier",
        "generation": 5,
        "evolutionChainId": 260,
        "genus": "Loyal Dog Pokemon"
    },
    {
        "id": 508,
        "slug": "stoutland",
        "name": "Stoutland",
        "generation": 5,
        "evolutionChainId": 260,
        "genus": "Big-Hearted Pokemon"
    },
    {
        "id": 509,
        "slug": "purrloin",
        "name": "Purrloin",
        "generation": 5,
        "evolutionChainId": 261,
        "genus": "Devious Pokemon"
    },
    {
        "id": 510,
        "slug": "liepard",
        "name": "Liepard",
        "generation": 5,
        "evolutionChainId": 261,
        "genus": "Cruel Pokemon"
    },
    {
        "id": 511,
        "slug": "pansage",
        "name": "Pansage",
        "generation": 5,
        "evolutionChainId": 262,
        "genus": "Grass Monkey Pokemon"
    },
    {
        "id": 512,
        "slug": "simisage",
        "name": "Simisage",
        "generation": 5,
        "evolutionChainId": 262,
        "genus": "Thorn Monkey Pokemon"
    },
    {
        "id": 513,
        "slug": "pansear",
        "name": "Pansear",
        "generation": 5,
        "evolutionChainId": 263,
        "genus": "High Temp Pokemon"
    },
    {
        "id": 514,
        "slug": "simisear",
        "name": "Simisear",
        "generation": 5,
        "evolutionChainId": 263,
        "genus": "Ember Pokemon"
    },
    {
        "id": 515,
        "slug": "panpour",
        "name": "Panpour",
        "generation": 5,
        "evolutionChainId": 264,
        "genus": "Spray Pokemon"
    },
    {
        "id": 516,
        "slug": "simipour",
        "name": "Simipour",
        "generation": 5,
        "evolutionChainId": 264,
        "genus": "Geyser Pokemon"
    },
    {
        "id": 517,
        "slug": "munna",
        "name": "Munna",
        "generation": 5,
        "evolutionChainId": 265,
        "genus": "Dream Eater Pokemon"
    },
    {
        "id": 518,
        "slug": "musharna",
        "name": "Musharna",
        "generation": 5,
        "evolutionChainId": 265,
        "genus": "Drowsing Pokemon"
    },
    {
        "id": 519,
        "slug": "pidove",
        "name": "Pidove",
        "generation": 5,
        "evolutionChainId": 266,
        "genus": "Tiny Pigeon Pokemon"
    },
    {
        "id": 520,
        "slug": "tranquill",
        "name": "Tranquill",
        "generation": 5,
        "evolutionChainId": 266,
        "genus": "Wild Pigeon Pokemon"
    },
    {
        "id": 521,
        "slug": "unfezant",
        "name": "Unfezant",
        "generation": 5,
        "evolutionChainId": 266,
        "genus": "Proud Pokemon"
    },
    {
        "id": 522,
        "slug": "blitzle",
        "name": "Blitzle",
        "generation": 5,
        "evolutionChainId": 267,
        "genus": "Electrified Pokemon"
    },
    {
        "id": 523,
        "slug": "zebstrika",
        "name": "Zebstrika",
        "generation": 5,
        "evolutionChainId": 267,
        "genus": "Thunderbolt Pokemon"
    },
    {
        "id": 524,
        "slug": "roggenrola",
        "name": "Roggenrola",
        "generation": 5,
        "evolutionChainId": 268,
        "genus": "Mantle Pokemon"
    },
    {
        "id": 525,
        "slug": "boldore",
        "name": "Boldore",
        "generation": 5,
        "evolutionChainId": 268,
        "genus": "Ore Pokemon"
    },
    {
        "id": 526,
        "slug": "gigalith",
        "name": "Gigalith",
        "generation": 5,
        "evolutionChainId": 268,
        "genus": "Compressed Pokemon"
    },
    {
        "id": 527,
        "slug": "woobat",
        "name": "Woobat",
        "generation": 5,
        "evolutionChainId": 269,
        "genus": "Bat Pokemon"
    },
    {
        "id": 528,
        "slug": "swoobat",
        "name": "Swoobat",
        "generation": 5,
        "evolutionChainId": 269,
        "genus": "Courting Pokemon"
    },
    {
        "id": 529,
        "slug": "drilbur",
        "name": "Drilbur",
        "generation": 5,
        "evolutionChainId": 270,
        "genus": "Mole Pokemon"
    },
    {
        "id": 530,
        "slug": "excadrill",
        "name": "Excadrill",
        "generation": 5,
        "evolutionChainId": 270,
        "genus": "Subterrene Pokemon"
    },
    {
        "id": 531,
        "slug": "audino",
        "name": "Audino",
        "generation": 5,
        "evolutionChainId": 271,
        "genus": "Hearing Pokemon"
    },
    {
        "id": 532,
        "slug": "timburr",
        "name": "Timburr",
        "generation": 5,
        "evolutionChainId": 272,
        "genus": "Muscular Pokemon"
    },
    {
        "id": 533,
        "slug": "gurdurr",
        "name": "Gurdurr",
        "generation": 5,
        "evolutionChainId": 272,
        "genus": "Muscular Pokemon"
    },
    {
        "id": 534,
        "slug": "conkeldurr",
        "name": "Conkeldurr",
        "generation": 5,
        "evolutionChainId": 272,
        "genus": "Muscular Pokemon"
    },
    {
        "id": 535,
        "slug": "tympole",
        "name": "Tympole",
        "generation": 5,
        "evolutionChainId": 273,
        "genus": "Tadpole Pokemon"
    },
    {
        "id": 536,
        "slug": "palpitoad",
        "name": "Palpitoad",
        "generation": 5,
        "evolutionChainId": 273,
        "genus": "Vibration Pokemon"
    },
    {
        "id": 537,
        "slug": "seismitoad",
        "name": "Seismitoad",
        "generation": 5,
        "evolutionChainId": 273,
        "genus": "Vibration Pokemon"
    },
    {
        "id": 538,
        "slug": "throh",
        "name": "Throh",
        "generation": 5,
        "evolutionChainId": 274,
        "genus": "Judo Pokemon"
    },
    {
        "id": 539,
        "slug": "sawk",
        "name": "Sawk",
        "generation": 5,
        "evolutionChainId": 275,
        "genus": "Karate Pokemon"
    },
    {
        "id": 540,
        "slug": "sewaddle",
        "name": "Sewaddle",
        "generation": 5,
        "evolutionChainId": 276,
        "genus": "Sewing Pokemon"
    },
    {
        "id": 541,
        "slug": "swadloon",
        "name": "Swadloon",
        "generation": 5,
        "evolutionChainId": 276,
        "genus": "Leaf-Wrapped Pokemon"
    },
    {
        "id": 542,
        "slug": "leavanny",
        "name": "Leavanny",
        "generation": 5,
        "evolutionChainId": 276,
        "genus": "Nurturing Pokemon"
    },
    {
        "id": 543,
        "slug": "venipede",
        "name": "Venipede",
        "generation": 5,
        "evolutionChainId": 277,
        "genus": "Centipede Pokemon"
    },
    {
        "id": 544,
        "slug": "whirlipede",
        "name": "Whirlipede",
        "generation": 5,
        "evolutionChainId": 277,
        "genus": "Curlipede Pokemon"
    },
    {
        "id": 545,
        "slug": "scolipede",
        "name": "Scolipede",
        "generation": 5,
        "evolutionChainId": 277,
        "genus": "Megapede Pokemon"
    },
    {
        "id": 546,
        "slug": "cottonee",
        "name": "Cottonee",
        "generation": 5,
        "evolutionChainId": 278,
        "genus": "Cotton Puff Pokemon"
    },
    {
        "id": 547,
        "slug": "whimsicott",
        "name": "Whimsicott",
        "generation": 5,
        "evolutionChainId": 278,
        "genus": "Windveiled Pokemon"
    },
    {
        "id": 548,
        "slug": "petilil",
        "name": "Petilil",
        "generation": 5,
        "evolutionChainId": 279,
        "genus": "Bulb Pokemon"
    },
    {
        "id": 549,
        "slug": "lilligant",
        "name": "Lilligant",
        "generation": 5,
        "evolutionChainId": 279,
        "genus": "Flowering Pokemon"
    },
    {
        "id": 550,
        "slug": "basculin",
        "name": "Basculin",
        "generation": 5,
        "evolutionChainId": 280,
        "genus": "Hostile Pokemon"
    },
    {
        "id": 551,
        "slug": "sandile",
        "name": "Sandile",
        "generation": 5,
        "evolutionChainId": 281,
        "genus": "Desert Croc Pokemon"
    },
    {
        "id": 552,
        "slug": "krokorok",
        "name": "Krokorok",
        "generation": 5,
        "evolutionChainId": 281,
        "genus": "Desert Croc Pokemon"
    },
    {
        "id": 553,
        "slug": "krookodile",
        "name": "Krookodile",
        "generation": 5,
        "evolutionChainId": 281,
        "genus": "Intimidation Pokemon"
    },
    {
        "id": 554,
        "slug": "darumaka",
        "name": "Darumaka",
        "generation": 5,
        "evolutionChainId": 282,
        "genus": "Zen Charm Pokemon"
    },
    {
        "id": 555,
        "slug": "darmanitan",
        "name": "Darmanitan",
        "generation": 5,
        "evolutionChainId": 282,
        "genus": "Blazing Pokemon"
    },
    {
        "id": 556,
        "slug": "maractus",
        "name": "Maractus",
        "generation": 5,
        "evolutionChainId": 283,
        "genus": "Cactus Pokemon"
    },
    {
        "id": 557,
        "slug": "dwebble",
        "name": "Dwebble",
        "generation": 5,
        "evolutionChainId": 284,
        "genus": "Rock Inn Pokemon"
    },
    {
        "id": 558,
        "slug": "crustle",
        "name": "Crustle",
        "generation": 5,
        "evolutionChainId": 284,
        "genus": "Stone Home Pokemon"
    },
    {
        "id": 559,
        "slug": "scraggy",
        "name": "Scraggy",
        "generation": 5,
        "evolutionChainId": 285,
        "genus": "Shedding Pokemon"
    },
    {
        "id": 560,
        "slug": "scrafty",
        "name": "Scrafty",
        "generation": 5,
        "evolutionChainId": 285,
        "genus": "Hoodlum Pokemon"
    },
    {
        "id": 561,
        "slug": "sigilyph",
        "name": "Sigilyph",
        "generation": 5,
        "evolutionChainId": 286,
        "genus": "Avianoid Pokemon"
    },
    {
        "id": 562,
        "slug": "yamask",
        "name": "Yamask",
        "generation": 5,
        "evolutionChainId": 287,
        "genus": "Spirit Pokemon"
    },
    {
        "id": 563,
        "slug": "cofagrigus",
        "name": "Cofagrigus",
        "generation": 5,
        "evolutionChainId": 287,
        "genus": "Coffin Pokemon"
    },
    {
        "id": 564,
        "slug": "tirtouga",
        "name": "Tirtouga",
        "generation": 5,
        "evolutionChainId": 288,
        "genus": "Prototurtle Pokemon"
    },
    {
        "id": 565,
        "slug": "carracosta",
        "name": "Carracosta",
        "generation": 5,
        "evolutionChainId": 288,
        "genus": "Prototurtle Pokemon"
    },
    {
        "id": 566,
        "slug": "archen",
        "name": "Archen",
        "generation": 5,
        "evolutionChainId": 289,
        "genus": "First Bird Pokemon"
    },
    {
        "id": 567,
        "slug": "archeops",
        "name": "Archeops",
        "generation": 5,
        "evolutionChainId": 289,
        "genus": "First Bird Pokemon"
    },
    {
        "id": 568,
        "slug": "trubbish",
        "name": "Trubbish",
        "generation": 5,
        "evolutionChainId": 290,
        "genus": "Trash Bag Pokemon"
    },
    {
        "id": 569,
        "slug": "garbodor",
        "name": "Garbodor",
        "generation": 5,
        "evolutionChainId": 290,
        "genus": "Trash Heap Pokemon"
    },
    {
        "id": 570,
        "slug": "zorua",
        "name": "Zorua",
        "generation": 5,
        "evolutionChainId": 291,
        "genus": "Tricky Fox Pokemon"
    },
    {
        "id": 571,
        "slug": "zoroark",
        "name": "Zoroark",
        "generation": 5,
        "evolutionChainId": 291,
        "genus": "Illusion Fox Pokemon"
    },
    {
        "id": 572,
        "slug": "minccino",
        "name": "Minccino",
        "generation": 5,
        "evolutionChainId": 292,
        "genus": "Chinchilla Pokemon"
    },
    {
        "id": 573,
        "slug": "cinccino",
        "name": "Cinccino",
        "generation": 5,
        "evolutionChainId": 292,
        "genus": "Scarf Pokemon"
    },
    {
        "id": 574,
        "slug": "gothita",
        "name": "Gothita",
        "generation": 5,
        "evolutionChainId": 293,
        "genus": "Fixation Pokemon"
    },
    {
        "id": 575,
        "slug": "gothorita",
        "name": "Gothorita",
        "generation": 5,
        "evolutionChainId": 293,
        "genus": "Manipulate Pokemon"
    },
    {
        "id": 576,
        "slug": "gothitelle",
        "name": "Gothitelle",
        "generation": 5,
        "evolutionChainId": 293,
        "genus": "Astral Body Pokemon"
    },
    {
        "id": 577,
        "slug": "solosis",
        "name": "Solosis",
        "generation": 5,
        "evolutionChainId": 294,
        "genus": "Cell Pokemon"
    },
    {
        "id": 578,
        "slug": "duosion",
        "name": "Duosion",
        "generation": 5,
        "evolutionChainId": 294,
        "genus": "Mitosis Pokemon"
    },
    {
        "id": 579,
        "slug": "reuniclus",
        "name": "Reuniclus",
        "generation": 5,
        "evolutionChainId": 294,
        "genus": "Multiplying Pokemon"
    },
    {
        "id": 580,
        "slug": "ducklett",
        "name": "Ducklett",
        "generation": 5,
        "evolutionChainId": 295,
        "genus": "Water Bird Pokemon"
    },
    {
        "id": 581,
        "slug": "swanna",
        "name": "Swanna",
        "generation": 5,
        "evolutionChainId": 295,
        "genus": "White Bird Pokemon"
    },
    {
        "id": 582,
        "slug": "vanillite",
        "name": "Vanillite",
        "generation": 5,
        "evolutionChainId": 296,
        "genus": "Fresh Snow Pokemon"
    },
    {
        "id": 583,
        "slug": "vanillish",
        "name": "Vanillish",
        "generation": 5,
        "evolutionChainId": 296,
        "genus": "Icy Snow Pokemon"
    },
    {
        "id": 584,
        "slug": "vanilluxe",
        "name": "Vanilluxe",
        "generation": 5,
        "evolutionChainId": 296,
        "genus": "Snowstorm Pokemon"
    },
    {
        "id": 585,
        "slug": "deerling",
        "name": "Deerling",
        "generation": 5,
        "evolutionChainId": 297,
        "genus": "Season Pokemon"
    },
    {
        "id": 586,
        "slug": "sawsbuck",
        "name": "Sawsbuck",
        "generation": 5,
        "evolutionChainId": 297,
        "genus": "Season Pokemon"
    },
    {
        "id": 587,
        "slug": "emolga",
        "name": "Emolga",
        "generation": 5,
        "evolutionChainId": 298,
        "genus": "Sky Squirrel Pokemon"
    },
    {
        "id": 588,
        "slug": "karrablast",
        "name": "Karrablast",
        "generation": 5,
        "evolutionChainId": 299,
        "genus": "Clamping Pokemon"
    },
    {
        "id": 589,
        "slug": "escavalier",
        "name": "Escavalier",
        "generation": 5,
        "evolutionChainId": 299,
        "genus": "Cavalry Pokemon"
    },
    {
        "id": 590,
        "slug": "foongus",
        "name": "Foongus",
        "generation": 5,
        "evolutionChainId": 300,
        "genus": "Mushroom Pokemon"
    },
    {
        "id": 591,
        "slug": "amoonguss",
        "name": "Amoonguss",
        "generation": 5,
        "evolutionChainId": 300,
        "genus": "Mushroom Pokemon"
    },
    {
        "id": 592,
        "slug": "frillish",
        "name": "Frillish",
        "generation": 5,
        "evolutionChainId": 301,
        "genus": "Floating Pokemon"
    },
    {
        "id": 593,
        "slug": "jellicent",
        "name": "Jellicent",
        "generation": 5,
        "evolutionChainId": 301,
        "genus": "Floating Pokemon"
    },
    {
        "id": 594,
        "slug": "alomomola",
        "name": "Alomomola",
        "generation": 5,
        "evolutionChainId": 302,
        "genus": "Caring Pokemon"
    },
    {
        "id": 595,
        "slug": "joltik",
        "name": "Joltik",
        "generation": 5,
        "evolutionChainId": 303,
        "genus": "Attaching Pokemon"
    },
    {
        "id": 596,
        "slug": "galvantula",
        "name": "Galvantula",
        "generation": 5,
        "evolutionChainId": 303,
        "genus": "EleSpider Pokemon"
    },
    {
        "id": 597,
        "slug": "ferroseed",
        "name": "Ferroseed",
        "generation": 5,
        "evolutionChainId": 304,
        "genus": "Thorn Seed Pokemon"
    },
    {
        "id": 598,
        "slug": "ferrothorn",
        "name": "Ferrothorn",
        "generation": 5,
        "evolutionChainId": 304,
        "genus": "Thorn Pod Pokemon"
    },
    {
        "id": 599,
        "slug": "klink",
        "name": "Klink",
        "generation": 5,
        "evolutionChainId": 305,
        "genus": "Gear Pokemon"
    },
    {
        "id": 600,
        "slug": "klang",
        "name": "Klang",
        "generation": 5,
        "evolutionChainId": 305,
        "genus": "Gear Pokemon"
    },
    {
        "id": 601,
        "slug": "klinklang",
        "name": "Klinklang",
        "generation": 5,
        "evolutionChainId": 305,
        "genus": "Gear Pokemon"
    },
    {
        "id": 602,
        "slug": "tynamo",
        "name": "Tynamo",
        "generation": 5,
        "evolutionChainId": 306,
        "genus": "EleFish Pokemon"
    },
    {
        "id": 603,
        "slug": "eelektrik",
        "name": "Eelektrik",
        "generation": 5,
        "evolutionChainId": 306,
        "genus": "EleFish Pokemon"
    },
    {
        "id": 604,
        "slug": "eelektross",
        "name": "Eelektross",
        "generation": 5,
        "evolutionChainId": 306,
        "genus": "EleFish Pokemon"
    },
    {
        "id": 605,
        "slug": "elgyem",
        "name": "Elgyem",
        "generation": 5,
        "evolutionChainId": 307,
        "genus": "Cerebral Pokemon"
    },
    {
        "id": 606,
        "slug": "beheeyem",
        "name": "Beheeyem",
        "generation": 5,
        "evolutionChainId": 307,
        "genus": "Cerebral Pokemon"
    },
    {
        "id": 607,
        "slug": "litwick",
        "name": "Litwick",
        "generation": 5,
        "evolutionChainId": 308,
        "genus": "Candle Pokemon"
    },
    {
        "id": 608,
        "slug": "lampent",
        "name": "Lampent",
        "generation": 5,
        "evolutionChainId": 308,
        "genus": "Lamp Pokemon"
    },
    {
        "id": 609,
        "slug": "chandelure",
        "name": "Chandelure",
        "generation": 5,
        "evolutionChainId": 308,
        "genus": "Luring Pokemon"
    },
    {
        "id": 610,
        "slug": "axew",
        "name": "Axew",
        "generation": 5,
        "evolutionChainId": 309,
        "genus": "Tusk Pokemon"
    },
    {
        "id": 611,
        "slug": "fraxure",
        "name": "Fraxure",
        "generation": 5,
        "evolutionChainId": 309,
        "genus": "Axe Jaw Pokemon"
    },
    {
        "id": 612,
        "slug": "haxorus",
        "name": "Haxorus",
        "generation": 5,
        "evolutionChainId": 309,
        "genus": "Axe Jaw Pokemon"
    },
    {
        "id": 613,
        "slug": "cubchoo",
        "name": "Cubchoo",
        "generation": 5,
        "evolutionChainId": 310,
        "genus": "Chill Pokemon"
    },
    {
        "id": 614,
        "slug": "beartic",
        "name": "Beartic",
        "generation": 5,
        "evolutionChainId": 310,
        "genus": "Freezing Pokemon"
    },
    {
        "id": 615,
        "slug": "cryogonal",
        "name": "Cryogonal",
        "generation": 5,
        "evolutionChainId": 311,
        "genus": "Crystallizing Pokemon"
    },
    {
        "id": 616,
        "slug": "shelmet",
        "name": "Shelmet",
        "generation": 5,
        "evolutionChainId": 312,
        "genus": "Snail Pokemon"
    },
    {
        "id": 617,
        "slug": "accelgor",
        "name": "Accelgor",
        "generation": 5,
        "evolutionChainId": 312,
        "genus": "Shell Out Pokemon"
    },
    {
        "id": 618,
        "slug": "stunfisk",
        "name": "Stunfisk",
        "generation": 5,
        "evolutionChainId": 313,
        "genus": "Trap Pokemon"
    },
    {
        "id": 619,
        "slug": "mienfoo",
        "name": "Mienfoo",
        "generation": 5,
        "evolutionChainId": 314,
        "genus": "Martial Arts Pokemon"
    },
    {
        "id": 620,
        "slug": "mienshao",
        "name": "Mienshao",
        "generation": 5,
        "evolutionChainId": 314,
        "genus": "Martial Arts Pokemon"
    },
    {
        "id": 621,
        "slug": "druddigon",
        "name": "Druddigon",
        "generation": 5,
        "evolutionChainId": 315,
        "genus": "Cave Pokemon"
    },
    {
        "id": 622,
        "slug": "golett",
        "name": "Golett",
        "generation": 5,
        "evolutionChainId": 316,
        "genus": "Automaton Pokemon"
    },
    {
        "id": 623,
        "slug": "golurk",
        "name": "Golurk",
        "generation": 5,
        "evolutionChainId": 316,
        "genus": "Automaton Pokemon"
    },
    {
        "id": 624,
        "slug": "pawniard",
        "name": "Pawniard",
        "generation": 5,
        "evolutionChainId": 317,
        "genus": "Sharp Blade Pokemon"
    },
    {
        "id": 625,
        "slug": "bisharp",
        "name": "Bisharp",
        "generation": 5,
        "evolutionChainId": 317,
        "genus": "Sword Blade Pokemon"
    },
    {
        "id": 626,
        "slug": "bouffalant",
        "name": "Bouffalant",
        "generation": 5,
        "evolutionChainId": 318,
        "genus": "Bash Buffalo Pokemon"
    },
    {
        "id": 627,
        "slug": "rufflet",
        "name": "Rufflet",
        "generation": 5,
        "evolutionChainId": 319,
        "genus": "Eaglet Pokemon"
    },
    {
        "id": 628,
        "slug": "braviary",
        "name": "Braviary",
        "generation": 5,
        "evolutionChainId": 319,
        "genus": "Valiant Pokemon"
    },
    {
        "id": 629,
        "slug": "vullaby",
        "name": "Vullaby",
        "generation": 5,
        "evolutionChainId": 320,
        "genus": "Diapered Pokemon"
    },
    {
        "id": 630,
        "slug": "mandibuzz",
        "name": "Mandibuzz",
        "generation": 5,
        "evolutionChainId": 320,
        "genus": "Bone Vulture Pokemon"
    },
    {
        "id": 631,
        "slug": "heatmor",
        "name": "Heatmor",
        "generation": 5,
        "evolutionChainId": 321,
        "genus": "Anteater Pokemon"
    },
    {
        "id": 632,
        "slug": "durant",
        "name": "Durant",
        "generation": 5,
        "evolutionChainId": 322,
        "genus": "Iron Ant Pokemon"
    },
    {
        "id": 633,
        "slug": "deino",
        "name": "Deino",
        "generation": 5,
        "evolutionChainId": 323,
        "genus": "Irate Pokemon"
    },
    {
        "id": 634,
        "slug": "zweilous",
        "name": "Zweilous",
        "generation": 5,
        "evolutionChainId": 323,
        "genus": "Hostile Pokemon"
    },
    {
        "id": 635,
        "slug": "hydreigon",
        "name": "Hydreigon",
        "generation": 5,
        "evolutionChainId": 323,
        "genus": "Brutal Pokemon"
    },
    {
        "id": 636,
        "slug": "larvesta",
        "name": "Larvesta",
        "generation": 5,
        "evolutionChainId": 324,
        "genus": "Torch Pokemon"
    },
    {
        "id": 637,
        "slug": "volcarona",
        "name": "Volcarona",
        "generation": 5,
        "evolutionChainId": 324,
        "genus": "Sun Pokemon"
    },
    {
        "id": 638,
        "slug": "cobalion",
        "name": "Cobalion",
        "generation": 5,
        "evolutionChainId": 325,
        "genus": "Iron Will Pokemon"
    },
    {
        "id": 639,
        "slug": "terrakion",
        "name": "Terrakion",
        "generation": 5,
        "evolutionChainId": 326,
        "genus": "Cavern Pokemon"
    },
    {
        "id": 640,
        "slug": "virizion",
        "name": "Virizion",
        "generation": 5,
        "evolutionChainId": 327,
        "genus": "Grassland Pokemon"
    },
    {
        "id": 641,
        "slug": "tornadus",
        "name": "Tornadus",
        "generation": 5,
        "evolutionChainId": 328,
        "genus": "Cyclone Pokemon"
    },
    {
        "id": 642,
        "slug": "thundurus",
        "name": "Thundurus",
        "generation": 5,
        "evolutionChainId": 329,
        "genus": "Bolt Strike Pokemon"
    },
    {
        "id": 643,
        "slug": "reshiram",
        "name": "Reshiram",
        "generation": 5,
        "evolutionChainId": 330,
        "genus": "Vast White Pokemon"
    },
    {
        "id": 644,
        "slug": "zekrom",
        "name": "Zekrom",
        "generation": 5,
        "evolutionChainId": 331,
        "genus": "Deep Black Pokemon"
    },
    {
        "id": 645,
        "slug": "landorus",
        "name": "Landorus",
        "generation": 5,
        "evolutionChainId": 332,
        "genus": "Abundance Pokemon"
    },
    {
        "id": 646,
        "slug": "kyurem",
        "name": "Kyurem",
        "generation": 5,
        "evolutionChainId": 333,
        "genus": "Boundary Pokemon"
    },
    {
        "id": 647,
        "slug": "keldeo",
        "name": "Keldeo",
        "generation": 5,
        "evolutionChainId": 334,
        "genus": "Colt Pokemon"
    },
    {
        "id": 648,
        "slug": "meloetta",
        "name": "Meloetta",
        "generation": 5,
        "evolutionChainId": 335,
        "genus": "Melody Pokemon"
    },
    {
        "id": 649,
        "slug": "genesect",
        "name": "Genesect",
        "generation": 5,
        "evolutionChainId": 336,
        "genus": "Paleozoic Pokemon"
    },
    {
        "id": 650,
        "slug": "chespin",
        "name": "Chespin",
        "generation": 6,
        "evolutionChainId": 337,
        "genus": "Spiny Nut Pokemon"
    },
    {
        "id": 651,
        "slug": "quilladin",
        "name": "Quilladin",
        "generation": 6,
        "evolutionChainId": 337,
        "genus": "Spiny Armor Pokemon"
    },
    {
        "id": 652,
        "slug": "chesnaught",
        "name": "Chesnaught",
        "generation": 6,
        "evolutionChainId": 337,
        "genus": "Spiny Armor Pokemon"
    },
    {
        "id": 653,
        "slug": "fennekin",
        "name": "Fennekin",
        "generation": 6,
        "evolutionChainId": 338,
        "genus": "Fox Pokemon"
    },
    {
        "id": 654,
        "slug": "braixen",
        "name": "Braixen",
        "generation": 6,
        "evolutionChainId": 338,
        "genus": "Fox Pokemon"
    },
    {
        "id": 655,
        "slug": "delphox",
        "name": "Delphox",
        "generation": 6,
        "evolutionChainId": 338,
        "genus": "Fox Pokemon"
    },
    {
        "id": 656,
        "slug": "froakie",
        "name": "Froakie",
        "generation": 6,
        "evolutionChainId": 339,
        "genus": "Bubble Frog Pokemon"
    },
    {
        "id": 657,
        "slug": "frogadier",
        "name": "Frogadier",
        "generation": 6,
        "evolutionChainId": 339,
        "genus": "Bubble Frog Pokemon"
    },
    {
        "id": 658,
        "slug": "greninja",
        "name": "Greninja",
        "generation": 6,
        "evolutionChainId": 339,
        "genus": "Ninja Pokemon"
    },
    {
        "id": 659,
        "slug": "bunnelby",
        "name": "Bunnelby",
        "generation": 6,
        "evolutionChainId": 340,
        "genus": "Digging Pokemon"
    },
    {
        "id": 660,
        "slug": "diggersby",
        "name": "Diggersby",
        "generation": 6,
        "evolutionChainId": 340,
        "genus": "Digging Pokemon"
    },
    {
        "id": 661,
        "slug": "fletchling",
        "name": "Fletchling",
        "generation": 6,
        "evolutionChainId": 341,
        "genus": "Tiny Robin Pokemon"
    },
    {
        "id": 662,
        "slug": "fletchinder",
        "name": "Fletchinder",
        "generation": 6,
        "evolutionChainId": 341,
        "genus": "Ember Pokemon"
    },
    {
        "id": 663,
        "slug": "talonflame",
        "name": "Talonflame",
        "generation": 6,
        "evolutionChainId": 341,
        "genus": "Scorching Pokemon"
    },
    {
        "id": 664,
        "slug": "scatterbug",
        "name": "Scatterbug",
        "generation": 6,
        "evolutionChainId": 342,
        "genus": "Scatterdust Pokemon"
    },
    {
        "id": 665,
        "slug": "spewpa",
        "name": "Spewpa",
        "generation": 6,
        "evolutionChainId": 342,
        "genus": "Scatterdust Pokemon"
    },
    {
        "id": 666,
        "slug": "vivillon",
        "name": "Vivillon",
        "generation": 6,
        "evolutionChainId": 342,
        "genus": "Scale Pokemon"
    },
    {
        "id": 667,
        "slug": "litleo",
        "name": "Litleo",
        "generation": 6,
        "evolutionChainId": 343,
        "genus": "Lion Cub Pokemon"
    },
    {
        "id": 668,
        "slug": "pyroar",
        "name": "Pyroar",
        "generation": 6,
        "evolutionChainId": 343,
        "genus": "Royal Pokemon"
    },
    {
        "id": 669,
        "slug": "flabebe",
        "name": "Flabébé",
        "generation": 6,
        "evolutionChainId": 344,
        "genus": "Single Bloom Pokemon"
    },
    {
        "id": 670,
        "slug": "floette",
        "name": "Floette",
        "generation": 6,
        "evolutionChainId": 344,
        "genus": "Single Bloom Pokemon"
    },
    {
        "id": 671,
        "slug": "florges",
        "name": "Florges",
        "generation": 6,
        "evolutionChainId": 344,
        "genus": "Garden Pokemon"
    },
    {
        "id": 672,
        "slug": "skiddo",
        "name": "Skiddo",
        "generation": 6,
        "evolutionChainId": 345,
        "genus": "Mount Pokemon"
    },
    {
        "id": 673,
        "slug": "gogoat",
        "name": "Gogoat",
        "generation": 6,
        "evolutionChainId": 345,
        "genus": "Mount Pokemon"
    },
    {
        "id": 674,
        "slug": "pancham",
        "name": "Pancham",
        "generation": 6,
        "evolutionChainId": 346,
        "genus": "Playful Pokemon"
    },
    {
        "id": 675,
        "slug": "pangoro",
        "name": "Pangoro",
        "generation": 6,
        "evolutionChainId": 346,
        "genus": "Daunting Pokemon"
    },
    {
        "id": 676,
        "slug": "furfrou",
        "name": "Furfrou",
        "generation": 6,
        "evolutionChainId": 347,
        "genus": "Poodle Pokemon"
    },
    {
        "id": 677,
        "slug": "espurr",
        "name": "Espurr",
        "generation": 6,
        "evolutionChainId": 348,
        "genus": "Restraint Pokemon"
    },
    {
        "id": 678,
        "slug": "meowstic",
        "name": "Meowstic",
        "generation": 6,
        "evolutionChainId": 348,
        "genus": "Constraint Pokemon"
    },
    {
        "id": 679,
        "slug": "honedge",
        "name": "Honedge",
        "generation": 6,
        "evolutionChainId": 349,
        "genus": "Sword Pokemon"
    },
    {
        "id": 680,
        "slug": "doublade",
        "name": "Doublade",
        "generation": 6,
        "evolutionChainId": 349,
        "genus": "Sword Pokemon"
    },
    {
        "id": 681,
        "slug": "aegislash",
        "name": "Aegislash",
        "generation": 6,
        "evolutionChainId": 349,
        "genus": "Royal Sword Pokemon"
    },
    {
        "id": 682,
        "slug": "spritzee",
        "name": "Spritzee",
        "generation": 6,
        "evolutionChainId": 350,
        "genus": "Perfume Pokemon"
    },
    {
        "id": 683,
        "slug": "aromatisse",
        "name": "Aromatisse",
        "generation": 6,
        "evolutionChainId": 350,
        "genus": "Fragrance Pokemon"
    },
    {
        "id": 684,
        "slug": "swirlix",
        "name": "Swirlix",
        "generation": 6,
        "evolutionChainId": 351,
        "genus": "Cotton Candy Pokemon"
    },
    {
        "id": 685,
        "slug": "slurpuff",
        "name": "Slurpuff",
        "generation": 6,
        "evolutionChainId": 351,
        "genus": "Meringue Pokemon"
    },
    {
        "id": 686,
        "slug": "inkay",
        "name": "Inkay",
        "generation": 6,
        "evolutionChainId": 352,
        "genus": "Revolving Pokemon"
    },
    {
        "id": 687,
        "slug": "malamar",
        "name": "Malamar",
        "generation": 6,
        "evolutionChainId": 352,
        "genus": "Overturning Pokemon"
    },
    {
        "id": 688,
        "slug": "binacle",
        "name": "Binacle",
        "generation": 6,
        "evolutionChainId": 353,
        "genus": "Two-Handed Pokemon"
    },
    {
        "id": 689,
        "slug": "barbaracle",
        "name": "Barbaracle",
        "generation": 6,
        "evolutionChainId": 353,
        "genus": "Collective Pokemon"
    },
    {
        "id": 690,
        "slug": "skrelp",
        "name": "Skrelp",
        "generation": 6,
        "evolutionChainId": 354,
        "genus": "Mock Kelp Pokemon"
    },
    {
        "id": 691,
        "slug": "dragalge",
        "name": "Dragalge",
        "generation": 6,
        "evolutionChainId": 354,
        "genus": "Mock Kelp Pokemon"
    },
    {
        "id": 692,
        "slug": "clauncher",
        "name": "Clauncher",
        "generation": 6,
        "evolutionChainId": 355,
        "genus": "Water Gun Pokemon"
    },
    {
        "id": 693,
        "slug": "clawitzer",
        "name": "Clawitzer",
        "generation": 6,
        "evolutionChainId": 355,
        "genus": "Howitzer Pokemon"
    },
    {
        "id": 694,
        "slug": "helioptile",
        "name": "Helioptile",
        "generation": 6,
        "evolutionChainId": 356,
        "genus": "Generator Pokemon"
    },
    {
        "id": 695,
        "slug": "heliolisk",
        "name": "Heliolisk",
        "generation": 6,
        "evolutionChainId": 356,
        "genus": "Generator Pokemon"
    },
    {
        "id": 696,
        "slug": "tyrunt",
        "name": "Tyrunt",
        "generation": 6,
        "evolutionChainId": 357,
        "genus": "Royal Heir Pokemon"
    },
    {
        "id": 697,
        "slug": "tyrantrum",
        "name": "Tyrantrum",
        "generation": 6,
        "evolutionChainId": 357,
        "genus": "Despot Pokemon"
    },
    {
        "id": 698,
        "slug": "amaura",
        "name": "Amaura",
        "generation": 6,
        "evolutionChainId": 358,
        "genus": "Tundra Pokemon"
    },
    {
        "id": 699,
        "slug": "aurorus",
        "name": "Aurorus",
        "generation": 6,
        "evolutionChainId": 358,
        "genus": "Tundra Pokemon"
    },
    {
        "id": 700,
        "slug": "sylveon",
        "name": "Sylveon",
        "generation": 6,
        "evolutionChainId": 67,
        "genus": "Intertwining Pokemon"
    },
    {
        "id": 701,
        "slug": "hawlucha",
        "name": "Hawlucha",
        "generation": 6,
        "evolutionChainId": 359,
        "genus": "Wrestling Pokemon"
    },
    {
        "id": 702,
        "slug": "dedenne",
        "name": "Dedenne",
        "generation": 6,
        "evolutionChainId": 360,
        "genus": "Antenna Pokemon"
    },
    {
        "id": 703,
        "slug": "carbink",
        "name": "Carbink",
        "generation": 6,
        "evolutionChainId": 361,
        "genus": "Jewel Pokemon"
    },
    {
        "id": 704,
        "slug": "goomy",
        "name": "Goomy",
        "generation": 6,
        "evolutionChainId": 362,
        "genus": "Soft Tissue Pokemon"
    },
    {
        "id": 705,
        "slug": "sliggoo",
        "name": "Sliggoo",
        "generation": 6,
        "evolutionChainId": 362,
        "genus": "Soft Tissue Pokemon"
    },
    {
        "id": 706,
        "slug": "goodra",
        "name": "Goodra",
        "generation": 6,
        "evolutionChainId": 362,
        "genus": "Dragon Pokemon"
    },
    {
        "id": 707,
        "slug": "klefki",
        "name": "Klefki",
        "generation": 6,
        "evolutionChainId": 363,
        "genus": "Key Ring Pokemon"
    },
    {
        "id": 708,
        "slug": "phantump",
        "name": "Phantump",
        "generation": 6,
        "evolutionChainId": 364,
        "genus": "Stump Pokemon"
    },
    {
        "id": 709,
        "slug": "trevenant",
        "name": "Trevenant",
        "generation": 6,
        "evolutionChainId": 364,
        "genus": "Elder Tree Pokemon"
    },
    {
        "id": 710,
        "slug": "pumpkaboo",
        "name": "Pumpkaboo",
        "generation": 6,
        "evolutionChainId": 365,
        "genus": "Pumpkin Pokemon"
    },
    {
        "id": 711,
        "slug": "gourgeist",
        "name": "Gourgeist",
        "generation": 6,
        "evolutionChainId": 365,
        "genus": "Pumpkin Pokemon"
    },
    {
        "id": 712,
        "slug": "bergmite",
        "name": "Bergmite",
        "generation": 6,
        "evolutionChainId": 366,
        "genus": "Ice Chunk Pokemon"
    },
    {
        "id": 713,
        "slug": "avalugg",
        "name": "Avalugg",
        "generation": 6,
        "evolutionChainId": 366,
        "genus": "Iceberg Pokemon"
    },
    {
        "id": 714,
        "slug": "noibat",
        "name": "Noibat",
        "generation": 6,
        "evolutionChainId": 367,
        "genus": "Sound Wave Pokemon"
    },
    {
        "id": 715,
        "slug": "noivern",
        "name": "Noivern",
        "generation": 6,
        "evolutionChainId": 367,
        "genus": "Sound Wave Pokemon"
    },
    {
        "id": 716,
        "slug": "xerneas",
        "name": "Xerneas",
        "generation": 6,
        "evolutionChainId": 368,
        "genus": "Life Pokemon"
    },
    {
        "id": 717,
        "slug": "yveltal",
        "name": "Yveltal",
        "generation": 6,
        "evolutionChainId": 369,
        "genus": "Destruction Pokemon"
    },
    {
        "id": 718,
        "slug": "zygarde",
        "name": "Zygarde",
        "generation": 6,
        "evolutionChainId": 370,
        "genus": "Order Pokemon"
    },
    {
        "id": 719,
        "slug": "diancie",
        "name": "Diancie",
        "generation": 6,
        "evolutionChainId": 371,
        "genus": "Jewel Pokemon"
    },
    {
        "id": 720,
        "slug": "hoopa",
        "name": "Hoopa",
        "generation": 6,
        "evolutionChainId": 372,
        "genus": "Mischief Pokemon"
    },
    {
        "id": 721,
        "slug": "volcanion",
        "name": "Volcanion",
        "generation": 6,
        "evolutionChainId": 373,
        "genus": "Steam Pokemon"
    },
    {
        "id": 722,
        "slug": "rowlet",
        "name": "Rowlet",
        "generation": 7,
        "evolutionChainId": 374,
        "genus": "Grass Quill Pokemon"
    },
    {
        "id": 723,
        "slug": "dartrix",
        "name": "Dartrix",
        "generation": 7,
        "evolutionChainId": 374,
        "genus": "Blade Quill Pokemon"
    },
    {
        "id": 724,
        "slug": "decidueye",
        "name": "Decidueye",
        "generation": 7,
        "evolutionChainId": 374,
        "genus": "Arrow Quill Pokemon"
    },
    {
        "id": 725,
        "slug": "litten",
        "name": "Litten",
        "generation": 7,
        "evolutionChainId": 375,
        "genus": "Fire Cat Pokemon"
    },
    {
        "id": 726,
        "slug": "torracat",
        "name": "Torracat",
        "generation": 7,
        "evolutionChainId": 375,
        "genus": "Fire Cat Pokemon"
    },
    {
        "id": 727,
        "slug": "incineroar",
        "name": "Incineroar",
        "generation": 7,
        "evolutionChainId": 375,
        "genus": "Heel Pokemon"
    },
    {
        "id": 728,
        "slug": "popplio",
        "name": "Popplio",
        "generation": 7,
        "evolutionChainId": 376,
        "genus": "Sea Lion Pokemon"
    },
    {
        "id": 729,
        "slug": "brionne",
        "name": "Brionne",
        "generation": 7,
        "evolutionChainId": 376,
        "genus": "Pop Star Pokemon"
    },
    {
        "id": 730,
        "slug": "primarina",
        "name": "Primarina",
        "generation": 7,
        "evolutionChainId": 376,
        "genus": "Soloist Pokemon"
    },
    {
        "id": 731,
        "slug": "pikipek",
        "name": "Pikipek",
        "generation": 7,
        "evolutionChainId": 377,
        "genus": "Woodpecker Pokemon"
    },
    {
        "id": 732,
        "slug": "trumbeak",
        "name": "Trumbeak",
        "generation": 7,
        "evolutionChainId": 377,
        "genus": "Bugle Beak Pokemon"
    },
    {
        "id": 733,
        "slug": "toucannon",
        "name": "Toucannon",
        "generation": 7,
        "evolutionChainId": 377,
        "genus": "Cannon Pokemon"
    },
    {
        "id": 734,
        "slug": "yungoos",
        "name": "Yungoos",
        "generation": 7,
        "evolutionChainId": 378,
        "genus": "Loitering Pokemon"
    },
    {
        "id": 735,
        "slug": "gumshoos",
        "name": "Gumshoos",
        "generation": 7,
        "evolutionChainId": 378,
        "genus": "Stakeout Pokemon"
    },
    {
        "id": 736,
        "slug": "grubbin",
        "name": "Grubbin",
        "generation": 7,
        "evolutionChainId": 379,
        "genus": "Larva Pokemon"
    },
    {
        "id": 737,
        "slug": "charjabug",
        "name": "Charjabug",
        "generation": 7,
        "evolutionChainId": 379,
        "genus": "Battery Pokemon"
    },
    {
        "id": 738,
        "slug": "vikavolt",
        "name": "Vikavolt",
        "generation": 7,
        "evolutionChainId": 379,
        "genus": "Stag Beetle Pokemon"
    },
    {
        "id": 739,
        "slug": "crabrawler",
        "name": "Crabrawler",
        "generation": 7,
        "evolutionChainId": 380,
        "genus": "Boxing Pokemon"
    },
    {
        "id": 740,
        "slug": "crabominable",
        "name": "Crabominable",
        "generation": 7,
        "evolutionChainId": 380,
        "genus": "Woolly Crab Pokemon"
    },
    {
        "id": 741,
        "slug": "oricorio",
        "name": "Oricorio",
        "generation": 7,
        "evolutionChainId": 381,
        "genus": "Dancing Pokemon"
    },
    {
        "id": 742,
        "slug": "cutiefly",
        "name": "Cutiefly",
        "generation": 7,
        "evolutionChainId": 382,
        "genus": "Bee Fly Pokemon"
    },
    {
        "id": 743,
        "slug": "ribombee",
        "name": "Ribombee",
        "generation": 7,
        "evolutionChainId": 382,
        "genus": "Bee Fly Pokemon"
    },
    {
        "id": 744,
        "slug": "rockruff",
        "name": "Rockruff",
        "generation": 7,
        "evolutionChainId": 383,
        "genus": "Puppy Pokemon"
    },
    {
        "id": 745,
        "slug": "lycanroc",
        "name": "Lycanroc",
        "generation": 7,
        "evolutionChainId": 383,
        "genus": "Wolf Pokemon"
    },
    {
        "id": 746,
        "slug": "wishiwashi",
        "name": "Wishiwashi",
        "generation": 7,
        "evolutionChainId": 384,
        "genus": "Small Fry Pokemon"
    },
    {
        "id": 747,
        "slug": "mareanie",
        "name": "Mareanie",
        "generation": 7,
        "evolutionChainId": 385,
        "genus": "Brutal Star Pokemon"
    },
    {
        "id": 748,
        "slug": "toxapex",
        "name": "Toxapex",
        "generation": 7,
        "evolutionChainId": 385,
        "genus": "Brutal Star Pokemon"
    },
    {
        "id": 749,
        "slug": "mudbray",
        "name": "Mudbray",
        "generation": 7,
        "evolutionChainId": 386,
        "genus": "Donkey Pokemon"
    },
    {
        "id": 750,
        "slug": "mudsdale",
        "name": "Mudsdale",
        "generation": 7,
        "evolutionChainId": 386,
        "genus": "Draft Horse Pokemon"
    },
    {
        "id": 751,
        "slug": "dewpider",
        "name": "Dewpider",
        "generation": 7,
        "evolutionChainId": 387,
        "genus": "Water Bubble Pokemon"
    },
    {
        "id": 752,
        "slug": "araquanid",
        "name": "Araquanid",
        "generation": 7,
        "evolutionChainId": 387,
        "genus": "Water Bubble Pokemon"
    },
    {
        "id": 753,
        "slug": "fomantis",
        "name": "Fomantis",
        "generation": 7,
        "evolutionChainId": 388,
        "genus": "Sickle Grass Pokemon"
    },
    {
        "id": 754,
        "slug": "lurantis",
        "name": "Lurantis",
        "generation": 7,
        "evolutionChainId": 388,
        "genus": "Bloom Sickle Pokemon"
    },
    {
        "id": 755,
        "slug": "morelull",
        "name": "Morelull",
        "generation": 7,
        "evolutionChainId": 389,
        "genus": "Illuminating Pokemon"
    },
    {
        "id": 756,
        "slug": "shiinotic",
        "name": "Shiinotic",
        "generation": 7,
        "evolutionChainId": 389,
        "genus": "Illuminating Pokemon"
    },
    {
        "id": 757,
        "slug": "salandit",
        "name": "Salandit",
        "generation": 7,
        "evolutionChainId": 390,
        "genus": "Toxic Lizard Pokemon"
    },
    {
        "id": 758,
        "slug": "salazzle",
        "name": "Salazzle",
        "generation": 7,
        "evolutionChainId": 390,
        "genus": "Toxic Lizard Pokemon"
    },
    {
        "id": 759,
        "slug": "stufful",
        "name": "Stufful",
        "generation": 7,
        "evolutionChainId": 391,
        "genus": "Flailing Pokemon"
    },
    {
        "id": 760,
        "slug": "bewear",
        "name": "Bewear",
        "generation": 7,
        "evolutionChainId": 391,
        "genus": "Strong Arm Pokemon"
    },
    {
        "id": 761,
        "slug": "bounsweet",
        "name": "Bounsweet",
        "generation": 7,
        "evolutionChainId": 392,
        "genus": "Fruit Pokemon"
    },
    {
        "id": 762,
        "slug": "steenee",
        "name": "Steenee",
        "generation": 7,
        "evolutionChainId": 392,
        "genus": "Fruit Pokemon"
    },
    {
        "id": 763,
        "slug": "tsareena",
        "name": "Tsareena",
        "generation": 7,
        "evolutionChainId": 392,
        "genus": "Fruit Pokemon"
    },
    {
        "id": 764,
        "slug": "comfey",
        "name": "Comfey",
        "generation": 7,
        "evolutionChainId": 393,
        "genus": "Posy Picker Pokemon"
    },
    {
        "id": 765,
        "slug": "oranguru",
        "name": "Oranguru",
        "generation": 7,
        "evolutionChainId": 394,
        "genus": "Sage Pokemon"
    },
    {
        "id": 766,
        "slug": "passimian",
        "name": "Passimian",
        "generation": 7,
        "evolutionChainId": 395,
        "genus": "Teamwork Pokemon"
    },
    {
        "id": 767,
        "slug": "wimpod",
        "name": "Wimpod",
        "generation": 7,
        "evolutionChainId": 396,
        "genus": "Turn Tail Pokemon"
    },
    {
        "id": 768,
        "slug": "golisopod",
        "name": "Golisopod",
        "generation": 7,
        "evolutionChainId": 396,
        "genus": "Hard Scale Pokemon"
    },
    {
        "id": 769,
        "slug": "sandygast",
        "name": "Sandygast",
        "generation": 7,
        "evolutionChainId": 397,
        "genus": "Sand Heap Pokemon"
    },
    {
        "id": 770,
        "slug": "palossand",
        "name": "Palossand",
        "generation": 7,
        "evolutionChainId": 397,
        "genus": "Sand Castle Pokemon"
    },
    {
        "id": 771,
        "slug": "pyukumuku",
        "name": "Pyukumuku",
        "generation": 7,
        "evolutionChainId": 398,
        "genus": "Sea Cucumber Pokemon"
    },
    {
        "id": 772,
        "slug": "type-null",
        "name": "Type: Null",
        "generation": 7,
        "evolutionChainId": 399,
        "genus": "Synthetic Pokemon"
    },
    {
        "id": 773,
        "slug": "silvally",
        "name": "Silvally",
        "generation": 7,
        "evolutionChainId": 399,
        "genus": "Synthetic Pokemon"
    },
    {
        "id": 774,
        "slug": "minior",
        "name": "Minior",
        "generation": 7,
        "evolutionChainId": 400,
        "genus": "Meteor Pokemon"
    },
    {
        "id": 775,
        "slug": "komala",
        "name": "Komala",
        "generation": 7,
        "evolutionChainId": 401,
        "genus": "Drowsing Pokemon"
    },
    {
        "id": 776,
        "slug": "turtonator",
        "name": "Turtonator",
        "generation": 7,
        "evolutionChainId": 402,
        "genus": "Blast Turtle Pokemon"
    },
    {
        "id": 777,
        "slug": "togedemaru",
        "name": "Togedemaru",
        "generation": 7,
        "evolutionChainId": 403,
        "genus": "Roly-Poly Pokemon"
    },
    {
        "id": 778,
        "slug": "mimikyu",
        "name": "Mimikyu",
        "generation": 7,
        "evolutionChainId": 404,
        "genus": "Disguise Pokemon"
    },
    {
        "id": 779,
        "slug": "bruxish",
        "name": "Bruxish",
        "generation": 7,
        "evolutionChainId": 405,
        "genus": "Gnash Teeth Pokemon"
    },
    {
        "id": 780,
        "slug": "drampa",
        "name": "Drampa",
        "generation": 7,
        "evolutionChainId": 406,
        "genus": "Placid Pokemon"
    },
    {
        "id": 781,
        "slug": "dhelmise",
        "name": "Dhelmise",
        "generation": 7,
        "evolutionChainId": 407,
        "genus": "Sea Creeper Pokemon"
    },
    {
        "id": 782,
        "slug": "jangmo-o",
        "name": "Jangmo-o",
        "generation": 7,
        "evolutionChainId": 408,
        "genus": "Scaly Pokemon"
    },
    {
        "id": 783,
        "slug": "hakamo-o",
        "name": "Hakamo-o",
        "generation": 7,
        "evolutionChainId": 408,
        "genus": "Scaly Pokemon"
    },
    {
        "id": 784,
        "slug": "kommo-o",
        "name": "Kommo-o",
        "generation": 7,
        "evolutionChainId": 408,
        "genus": "Scaly Pokemon"
    },
    {
        "id": 785,
        "slug": "tapu-koko",
        "name": "Tapu Koko",
        "generation": 7,
        "evolutionChainId": 409,
        "genus": "Land Spirit Pokemon"
    },
    {
        "id": 786,
        "slug": "tapu-lele",
        "name": "Tapu Lele",
        "generation": 7,
        "evolutionChainId": 410,
        "genus": "Land Spirit Pokemon"
    },
    {
        "id": 787,
        "slug": "tapu-bulu",
        "name": "Tapu Bulu",
        "generation": 7,
        "evolutionChainId": 411,
        "genus": "Land Spirit Pokemon"
    },
    {
        "id": 788,
        "slug": "tapu-fini",
        "name": "Tapu Fini",
        "generation": 7,
        "evolutionChainId": 412,
        "genus": "Land Spirit Pokemon"
    },
    {
        "id": 789,
        "slug": "cosmog",
        "name": "Cosmog",
        "generation": 7,
        "evolutionChainId": 413,
        "genus": "Nebula Pokemon"
    },
    {
        "id": 790,
        "slug": "cosmoem",
        "name": "Cosmoem",
        "generation": 7,
        "evolutionChainId": 413,
        "genus": "Protostar Pokemon"
    },
    {
        "id": 791,
        "slug": "solgaleo",
        "name": "Solgaleo",
        "generation": 7,
        "evolutionChainId": 413,
        "genus": "Sunne Pokemon"
    },
    {
        "id": 792,
        "slug": "lunala",
        "name": "Lunala",
        "generation": 7,
        "evolutionChainId": 413,
        "genus": "Moone Pokemon"
    },
    {
        "id": 793,
        "slug": "nihilego",
        "name": "Nihilego",
        "generation": 7,
        "evolutionChainId": 414,
        "genus": "Parasite Pokemon"
    },
    {
        "id": 794,
        "slug": "buzzwole",
        "name": "Buzzwole",
        "generation": 7,
        "evolutionChainId": 415,
        "genus": "Swollen Pokemon"
    },
    {
        "id": 795,
        "slug": "pheromosa",
        "name": "Pheromosa",
        "generation": 7,
        "evolutionChainId": 416,
        "genus": "Lissome Pokemon"
    },
    {
        "id": 796,
        "slug": "xurkitree",
        "name": "Xurkitree",
        "generation": 7,
        "evolutionChainId": 417,
        "genus": "Glowing Pokemon"
    },
    {
        "id": 797,
        "slug": "celesteela",
        "name": "Celesteela",
        "generation": 7,
        "evolutionChainId": 418,
        "genus": "Launch Pokemon"
    },
    {
        "id": 798,
        "slug": "kartana",
        "name": "Kartana",
        "generation": 7,
        "evolutionChainId": 419,
        "genus": "Drawn Sword Pokemon"
    },
    {
        "id": 799,
        "slug": "guzzlord",
        "name": "Guzzlord",
        "generation": 7,
        "evolutionChainId": 420,
        "genus": "Junkivore Pokemon"
    },
    {
        "id": 800,
        "slug": "necrozma",
        "name": "Necrozma",
        "generation": 7,
        "evolutionChainId": 421,
        "genus": "Prism Pokemon"
    },
    {
        "id": 801,
        "slug": "magearna",
        "name": "Magearna",
        "generation": 7,
        "evolutionChainId": 422,
        "genus": "Artificial Pokemon"
    },
    {
        "id": 802,
        "slug": "marshadow",
        "name": "Marshadow",
        "generation": 7,
        "evolutionChainId": 423,
        "genus": "Gloomdweller Pokemon"
    },
    {
        "id": 803,
        "slug": "poipole",
        "name": "Poipole",
        "generation": 7,
        "evolutionChainId": 424,
        "genus": "Poison Pin Pokemon"
    },
    {
        "id": 804,
        "slug": "naganadel",
        "name": "Naganadel",
        "generation": 7,
        "evolutionChainId": 424,
        "genus": "Poison Pin Pokemon"
    },
    {
        "id": 805,
        "slug": "stakataka",
        "name": "Stakataka",
        "generation": 7,
        "evolutionChainId": 425,
        "genus": "Rampart Pokemon"
    },
    {
        "id": 806,
        "slug": "blacephalon",
        "name": "Blacephalon",
        "generation": 7,
        "evolutionChainId": 426,
        "genus": "Fireworks Pokemon"
    },
    {
        "id": 807,
        "slug": "zeraora",
        "name": "Zeraora",
        "generation": 7,
        "evolutionChainId": 427,
        "genus": "Thunderclap Pokemon"
    },
    {
        "id": 808,
        "slug": "meltan",
        "name": "Meltan",
        "generation": 7,
        "evolutionChainId": 428,
        "genus": "Hex Nut Pokemon"
    },
    {
        "id": 809,
        "slug": "melmetal",
        "name": "Melmetal",
        "generation": 7,
        "evolutionChainId": 429,
        "genus": "Hex Nut Pokemon"
    },
    {
        "id": 810,
        "slug": "grookey",
        "name": "Grookey",
        "generation": 8,
        "evolutionChainId": 430,
        "genus": "Chimp Pokemon"
    },
    {
        "id": 811,
        "slug": "thwackey",
        "name": "Thwackey",
        "generation": 8,
        "evolutionChainId": 430,
        "genus": "Beat Pokemon"
    },
    {
        "id": 812,
        "slug": "rillaboom",
        "name": "Rillaboom",
        "generation": 8,
        "evolutionChainId": 430,
        "genus": "Drummer Pokemon"
    },
    {
        "id": 813,
        "slug": "scorbunny",
        "name": "Scorbunny",
        "generation": 8,
        "evolutionChainId": 431,
        "genus": "Rabbit Pokemon"
    },
    {
        "id": 814,
        "slug": "raboot",
        "name": "Raboot",
        "generation": 8,
        "evolutionChainId": 431,
        "genus": "Rabbit Pokemon"
    },
    {
        "id": 815,
        "slug": "cinderace",
        "name": "Cinderace",
        "generation": 8,
        "evolutionChainId": 431,
        "genus": "Striker Pokemon"
    },
    {
        "id": 816,
        "slug": "sobble",
        "name": "Sobble",
        "generation": 8,
        "evolutionChainId": 432,
        "genus": "Water Lizard Pokemon"
    },
    {
        "id": 817,
        "slug": "drizzile",
        "name": "Drizzile",
        "generation": 8,
        "evolutionChainId": 432,
        "genus": "Water Lizard Pokemon"
    },
    {
        "id": 818,
        "slug": "inteleon",
        "name": "Inteleon",
        "generation": 8,
        "evolutionChainId": 432,
        "genus": "Secret Agent Pokemon"
    },
    {
        "id": 819,
        "slug": "skwovet",
        "name": "Skwovet",
        "generation": 8,
        "evolutionChainId": 433,
        "genus": "Cheeky Pokemon"
    },
    {
        "id": 820,
        "slug": "greedent",
        "name": "Greedent",
        "generation": 8,
        "evolutionChainId": 433,
        "genus": "Greedy Pokemon"
    },
    {
        "id": 821,
        "slug": "rookidee",
        "name": "Rookidee",
        "generation": 8,
        "evolutionChainId": 434,
        "genus": "Tiny Bird Pokemon"
    },
    {
        "id": 822,
        "slug": "corvisquire",
        "name": "Corvisquire",
        "generation": 8,
        "evolutionChainId": 434,
        "genus": "Raven Pokemon"
    },
    {
        "id": 823,
        "slug": "corviknight",
        "name": "Corviknight",
        "generation": 8,
        "evolutionChainId": 434,
        "genus": "Raven Pokemon"
    },
    {
        "id": 824,
        "slug": "blipbug",
        "name": "Blipbug",
        "generation": 8,
        "evolutionChainId": 435,
        "genus": "Larva Pokemon"
    },
    {
        "id": 825,
        "slug": "dottler",
        "name": "Dottler",
        "generation": 8,
        "evolutionChainId": 435,
        "genus": "Radome Pokemon"
    },
    {
        "id": 826,
        "slug": "orbeetle",
        "name": "Orbeetle",
        "generation": 8,
        "evolutionChainId": 435,
        "genus": "Seven Spot Pokemon"
    },
    {
        "id": 827,
        "slug": "nickit",
        "name": "Nickit",
        "generation": 8,
        "evolutionChainId": 436,
        "genus": "Fox Pokemon"
    },
    {
        "id": 828,
        "slug": "thievul",
        "name": "Thievul",
        "generation": 8,
        "evolutionChainId": 436,
        "genus": "Fox Pokemon"
    },
    {
        "id": 829,
        "slug": "gossifleur",
        "name": "Gossifleur",
        "generation": 8,
        "evolutionChainId": 437,
        "genus": "Flowering Pokemon"
    },
    {
        "id": 830,
        "slug": "eldegoss",
        "name": "Eldegoss",
        "generation": 8,
        "evolutionChainId": 437,
        "genus": "Cotton Bloom Pokemon"
    },
    {
        "id": 831,
        "slug": "wooloo",
        "name": "Wooloo",
        "generation": 8,
        "evolutionChainId": 438,
        "genus": "Sheep Pokemon"
    },
    {
        "id": 832,
        "slug": "dubwool",
        "name": "Dubwool",
        "generation": 8,
        "evolutionChainId": 438,
        "genus": "Sheep Pokemon"
    },
    {
        "id": 833,
        "slug": "chewtle",
        "name": "Chewtle",
        "generation": 8,
        "evolutionChainId": 439,
        "genus": "Snapping Pokemon"
    },
    {
        "id": 834,
        "slug": "drednaw",
        "name": "Drednaw",
        "generation": 8,
        "evolutionChainId": 439,
        "genus": "Bite Pokemon"
    },
    {
        "id": 835,
        "slug": "yamper",
        "name": "Yamper",
        "generation": 8,
        "evolutionChainId": 440,
        "genus": "Puppy Pokemon"
    },
    {
        "id": 836,
        "slug": "boltund",
        "name": "Boltund",
        "generation": 8,
        "evolutionChainId": 440,
        "genus": "Dog Pokemon"
    },
    {
        "id": 837,
        "slug": "rolycoly",
        "name": "Rolycoly",
        "generation": 8,
        "evolutionChainId": 441,
        "genus": "Coal Pokemon"
    },
    {
        "id": 838,
        "slug": "carkol",
        "name": "Carkol",
        "generation": 8,
        "evolutionChainId": 441,
        "genus": "Coal Pokemon"
    },
    {
        "id": 839,
        "slug": "coalossal",
        "name": "Coalossal",
        "generation": 8,
        "evolutionChainId": 441,
        "genus": "Coal Pokemon"
    },
    {
        "id": 840,
        "slug": "applin",
        "name": "Applin",
        "generation": 8,
        "evolutionChainId": 442,
        "genus": "Apple Core Pokemon"
    },
    {
        "id": 841,
        "slug": "flapple",
        "name": "Flapple",
        "generation": 8,
        "evolutionChainId": 442,
        "genus": "Apple Wing Pokemon"
    },
    {
        "id": 842,
        "slug": "appletun",
        "name": "Appletun",
        "generation": 8,
        "evolutionChainId": 442,
        "genus": "Apple Nectar Pokemon"
    },
    {
        "id": 843,
        "slug": "silicobra",
        "name": "Silicobra",
        "generation": 8,
        "evolutionChainId": 443,
        "genus": "Sand Snake Pokemon"
    },
    {
        "id": 844,
        "slug": "sandaconda",
        "name": "Sandaconda",
        "generation": 8,
        "evolutionChainId": 443,
        "genus": "Sand Snake Pokemon"
    },
    {
        "id": 845,
        "slug": "cramorant",
        "name": "Cramorant",
        "generation": 8,
        "evolutionChainId": 444,
        "genus": "Gulp Pokemon"
    },
    {
        "id": 846,
        "slug": "arrokuda",
        "name": "Arrokuda",
        "generation": 8,
        "evolutionChainId": 445,
        "genus": "Rush Pokemon"
    },
    {
        "id": 847,
        "slug": "barraskewda",
        "name": "Barraskewda",
        "generation": 8,
        "evolutionChainId": 445,
        "genus": "Skewer Pokemon"
    },
    {
        "id": 848,
        "slug": "toxel",
        "name": "Toxel",
        "generation": 8,
        "evolutionChainId": 446,
        "genus": "Baby Pokemon"
    },
    {
        "id": 849,
        "slug": "toxtricity",
        "name": "Toxtricity",
        "generation": 8,
        "evolutionChainId": 446,
        "genus": "Punk Pokemon"
    },
    {
        "id": 850,
        "slug": "sizzlipede",
        "name": "Sizzlipede",
        "generation": 8,
        "evolutionChainId": 447,
        "genus": "Radiator Pokemon"
    },
    {
        "id": 851,
        "slug": "centiskorch",
        "name": "Centiskorch",
        "generation": 8,
        "evolutionChainId": 447,
        "genus": "Radiator Pokemon"
    },
    {
        "id": 852,
        "slug": "clobbopus",
        "name": "Clobbopus",
        "generation": 8,
        "evolutionChainId": 448,
        "genus": "Tantrum Pokemon"
    },
    {
        "id": 853,
        "slug": "grapploct",
        "name": "Grapploct",
        "generation": 8,
        "evolutionChainId": 448,
        "genus": "Jujitsu Pokemon"
    },
    {
        "id": 854,
        "slug": "sinistea",
        "name": "Sinistea",
        "generation": 8,
        "evolutionChainId": 449,
        "genus": "Black Tea Pokemon"
    },
    {
        "id": 855,
        "slug": "polteageist",
        "name": "Polteageist",
        "generation": 8,
        "evolutionChainId": 449,
        "genus": "Black Tea Pokemon"
    },
    {
        "id": 856,
        "slug": "hatenna",
        "name": "Hatenna",
        "generation": 8,
        "evolutionChainId": 450,
        "genus": "Calm Pokemon"
    },
    {
        "id": 857,
        "slug": "hattrem",
        "name": "Hattrem",
        "generation": 8,
        "evolutionChainId": 450,
        "genus": "Serene Pokemon"
    },
    {
        "id": 858,
        "slug": "hatterene",
        "name": "Hatterene",
        "generation": 8,
        "evolutionChainId": 450,
        "genus": "Silent Pokemon"
    },
    {
        "id": 859,
        "slug": "impidimp",
        "name": "Impidimp",
        "generation": 8,
        "evolutionChainId": 451,
        "genus": "Wily Pokemon"
    },
    {
        "id": 860,
        "slug": "morgrem",
        "name": "Morgrem",
        "generation": 8,
        "evolutionChainId": 451,
        "genus": "Devious Pokemon"
    },
    {
        "id": 861,
        "slug": "grimmsnarl",
        "name": "Grimmsnarl",
        "generation": 8,
        "evolutionChainId": 451,
        "genus": "Bulk Up Pokemon"
    },
    {
        "id": 862,
        "slug": "obstagoon",
        "name": "Obstagoon",
        "generation": 8,
        "evolutionChainId": 134,
        "genus": "Blocking Pokemon"
    },
    {
        "id": 863,
        "slug": "perrserker",
        "name": "Perrserker",
        "generation": 8,
        "evolutionChainId": 22,
        "genus": "Viking Pokemon"
    },
    {
        "id": 864,
        "slug": "cursola",
        "name": "Cursola",
        "generation": 8,
        "evolutionChainId": 113,
        "genus": "Coral Pokemon"
    },
    {
        "id": 865,
        "slug": "sirfetchd",
        "name": "Sirfetch’d",
        "generation": 8,
        "evolutionChainId": 35,
        "genus": "Wild Duck Pokemon"
    },
    {
        "id": 866,
        "slug": "mr-rime",
        "name": "Mr. Rime",
        "generation": 8,
        "evolutionChainId": 57,
        "genus": "Comedian Pokemon"
    },
    {
        "id": 867,
        "slug": "runerigus",
        "name": "Runerigus",
        "generation": 8,
        "evolutionChainId": 287,
        "genus": "Grudge Pokemon"
    },
    {
        "id": 868,
        "slug": "milcery",
        "name": "Milcery",
        "generation": 8,
        "evolutionChainId": 452,
        "genus": "Cream Pokemon"
    },
    {
        "id": 869,
        "slug": "alcremie",
        "name": "Alcremie",
        "generation": 8,
        "evolutionChainId": 452,
        "genus": "Cream Pokemon"
    },
    {
        "id": 870,
        "slug": "falinks",
        "name": "Falinks",
        "generation": 8,
        "evolutionChainId": 453,
        "genus": "Formation Pokemon"
    },
    {
        "id": 871,
        "slug": "pincurchin",
        "name": "Pincurchin",
        "generation": 8,
        "evolutionChainId": 454,
        "genus": "Sea Urchin Pokemon"
    },
    {
        "id": 872,
        "slug": "snom",
        "name": "Snom",
        "generation": 8,
        "evolutionChainId": 455,
        "genus": "Worm Pokemon"
    },
    {
        "id": 873,
        "slug": "frosmoth",
        "name": "Frosmoth",
        "generation": 8,
        "evolutionChainId": 455,
        "genus": "Frost Moth Pokemon"
    },
    {
        "id": 874,
        "slug": "stonjourner",
        "name": "Stonjourner",
        "generation": 8,
        "evolutionChainId": 456,
        "genus": "Big Rock Pokemon"
    },
    {
        "id": 875,
        "slug": "eiscue",
        "name": "Eiscue",
        "generation": 8,
        "evolutionChainId": 457,
        "genus": "Penguin Pokemon"
    },
    {
        "id": 876,
        "slug": "indeedee",
        "name": "Indeedee",
        "generation": 8,
        "evolutionChainId": 458,
        "genus": "Emotion Pokemon"
    },
    {
        "id": 877,
        "slug": "morpeko",
        "name": "Morpeko",
        "generation": 8,
        "evolutionChainId": 459,
        "genus": "Two-Sided Pokemon"
    },
    {
        "id": 878,
        "slug": "cufant",
        "name": "Cufant",
        "generation": 8,
        "evolutionChainId": 460,
        "genus": "Copperderm Pokemon"
    },
    {
        "id": 879,
        "slug": "copperajah",
        "name": "Copperajah",
        "generation": 8,
        "evolutionChainId": 460,
        "genus": "Copperderm Pokemon"
    },
    {
        "id": 880,
        "slug": "dracozolt",
        "name": "Dracozolt",
        "generation": 8,
        "evolutionChainId": 461,
        "genus": "Fossil Pokemon"
    },
    {
        "id": 881,
        "slug": "arctozolt",
        "name": "Arctozolt",
        "generation": 8,
        "evolutionChainId": 462,
        "genus": "Fossil Pokemon"
    },
    {
        "id": 882,
        "slug": "dracovish",
        "name": "Dracovish",
        "generation": 8,
        "evolutionChainId": 463,
        "genus": "Fossil Pokemon"
    },
    {
        "id": 883,
        "slug": "arctovish",
        "name": "Arctovish",
        "generation": 8,
        "evolutionChainId": 464,
        "genus": "Fossil Pokemon"
    },
    {
        "id": 884,
        "slug": "duraludon",
        "name": "Duraludon",
        "generation": 8,
        "evolutionChainId": 465,
        "genus": "Alloy Pokemon"
    },
    {
        "id": 885,
        "slug": "dreepy",
        "name": "Dreepy",
        "generation": 8,
        "evolutionChainId": 466,
        "genus": "Lingering Pokemon"
    },
    {
        "id": 886,
        "slug": "drakloak",
        "name": "Drakloak",
        "generation": 8,
        "evolutionChainId": 466,
        "genus": "Caretaker Pokemon"
    },
    {
        "id": 887,
        "slug": "dragapult",
        "name": "Dragapult",
        "generation": 8,
        "evolutionChainId": 466,
        "genus": "Stealth Pokemon"
    },
    {
        "id": 888,
        "slug": "zacian",
        "name": "Zacian",
        "generation": 8,
        "evolutionChainId": 467,
        "genus": "Warrior Pokemon"
    },
    {
        "id": 889,
        "slug": "zamazenta",
        "name": "Zamazenta",
        "generation": 8,
        "evolutionChainId": 468,
        "genus": "Warrior Pokemon"
    },
    {
        "id": 890,
        "slug": "eternatus",
        "name": "Eternatus",
        "generation": 8,
        "evolutionChainId": 469,
        "genus": "Gigantic Pokemon"
    },
    {
        "id": 891,
        "slug": "kubfu",
        "name": "Kubfu",
        "generation": 8,
        "evolutionChainId": 470,
        "genus": "Wushu Pokemon"
    },
    {
        "id": 892,
        "slug": "urshifu",
        "name": "Urshifu",
        "generation": 8,
        "evolutionChainId": 470,
        "genus": "Wushu Pokemon"
    },
    {
        "id": 893,
        "slug": "zarude",
        "name": "Zarude",
        "generation": 8,
        "evolutionChainId": 471,
        "genus": "Rogue Monkey Pokemon"
    },
    {
        "id": 894,
        "slug": "regieleki",
        "name": "Regieleki",
        "generation": 8,
        "evolutionChainId": 472,
        "genus": "Electron Pokemon"
    },
    {
        "id": 895,
        "slug": "regidrago",
        "name": "Regidrago",
        "generation": 8,
        "evolutionChainId": 473,
        "genus": "Dragon Orb Pokemon"
    },
    {
        "id": 896,
        "slug": "glastrier",
        "name": "Glastrier",
        "generation": 8,
        "evolutionChainId": 474,
        "genus": "Wild Horse Pokemon"
    },
    {
        "id": 897,
        "slug": "spectrier",
        "name": "Spectrier",
        "generation": 8,
        "evolutionChainId": 475,
        "genus": "Swift Horse Pokemon"
    },
    {
        "id": 898,
        "slug": "calyrex",
        "name": "Calyrex",
        "generation": 8,
        "evolutionChainId": 476,
        "genus": "King Pokemon"
    },
    {
        "id": 899,
        "slug": "wyrdeer",
        "name": "Wyrdeer",
        "generation": 8,
        "evolutionChainId": 120,
        "genus": "Big Horn Pokemon"
    },
    {
        "id": 900,
        "slug": "kleavor",
        "name": "Kleavor",
        "generation": 8,
        "evolutionChainId": 58,
        "genus": "Axe Pokemon"
    },
    {
        "id": 901,
        "slug": "ursaluna",
        "name": "Ursaluna",
        "generation": 8,
        "evolutionChainId": 110,
        "genus": "Peat Pokemon"
    },
    {
        "id": 902,
        "slug": "basculegion",
        "name": "Basculegion",
        "generation": 8,
        "evolutionChainId": 280,
        "genus": "Big Fish Pokemon"
    },
    {
        "id": 903,
        "slug": "sneasler",
        "name": "Sneasler",
        "generation": 8,
        "evolutionChainId": 109,
        "genus": "Free Climb Pokemon"
    },
    {
        "id": 904,
        "slug": "overqwil",
        "name": "Overqwil",
        "generation": 8,
        "evolutionChainId": 106,
        "genus": "Pin Cluster Pokemon"
    },
    {
        "id": 905,
        "slug": "enamorus",
        "name": "Enamorus",
        "generation": 8,
        "evolutionChainId": 477,
        "genus": "Love-Hate Pokemon"
    },
    {
        "id": 906,
        "slug": "sprigatito",
        "name": "Sprigatito",
        "generation": 9,
        "evolutionChainId": 478,
        "genus": "Grass Cat Pokemon"
    },
    {
        "id": 907,
        "slug": "floragato",
        "name": "Floragato",
        "generation": 9,
        "evolutionChainId": 478,
        "genus": "Grass Cat Pokemon"
    },
    {
        "id": 908,
        "slug": "meowscarada",
        "name": "Meowscarada",
        "generation": 9,
        "evolutionChainId": 478,
        "genus": "Magician Pokemon"
    },
    {
        "id": 909,
        "slug": "fuecoco",
        "name": "Fuecoco",
        "generation": 9,
        "evolutionChainId": 479,
        "genus": "Fire Croc Pokemon"
    },
    {
        "id": 910,
        "slug": "crocalor",
        "name": "Crocalor",
        "generation": 9,
        "evolutionChainId": 479,
        "genus": "Fire Croc Pokemon"
    },
    {
        "id": 911,
        "slug": "skeledirge",
        "name": "Skeledirge",
        "generation": 9,
        "evolutionChainId": 479,
        "genus": "Singer Pokemon"
    },
    {
        "id": 912,
        "slug": "quaxly",
        "name": "Quaxly",
        "generation": 9,
        "evolutionChainId": 480,
        "genus": "Duckling Pokemon"
    },
    {
        "id": 913,
        "slug": "quaxwell",
        "name": "Quaxwell",
        "generation": 9,
        "evolutionChainId": 480,
        "genus": "Practicing Pokemon"
    },
    {
        "id": 914,
        "slug": "quaquaval",
        "name": "Quaquaval",
        "generation": 9,
        "evolutionChainId": 480,
        "genus": "Dancer Pokemon"
    },
    {
        "id": 915,
        "slug": "lechonk",
        "name": "Lechonk",
        "generation": 9,
        "evolutionChainId": 481,
        "genus": "Hog Pokemon"
    },
    {
        "id": 916,
        "slug": "oinkologne",
        "name": "Oinkologne",
        "generation": 9,
        "evolutionChainId": 481,
        "genus": "Hog Pokemon"
    },
    {
        "id": 917,
        "slug": "tarountula",
        "name": "Tarountula",
        "generation": 9,
        "evolutionChainId": 482,
        "genus": "String Ball Pokemon"
    },
    {
        "id": 918,
        "slug": "spidops",
        "name": "Spidops",
        "generation": 9,
        "evolutionChainId": 482,
        "genus": "Trap Pokemon"
    },
    {
        "id": 919,
        "slug": "nymble",
        "name": "Nymble",
        "generation": 9,
        "evolutionChainId": 483,
        "genus": "Grasshopper Pokemon"
    },
    {
        "id": 920,
        "slug": "lokix",
        "name": "Lokix",
        "generation": 9,
        "evolutionChainId": 483,
        "genus": "Grasshopper Pokemon"
    },
    {
        "id": 921,
        "slug": "pawmi",
        "name": "Pawmi",
        "generation": 9,
        "evolutionChainId": 484,
        "genus": "Mouse Pokemon"
    },
    {
        "id": 922,
        "slug": "pawmo",
        "name": "Pawmo",
        "generation": 9,
        "evolutionChainId": 484,
        "genus": "Mouse Pokemon"
    },
    {
        "id": 923,
        "slug": "pawmot",
        "name": "Pawmot",
        "generation": 9,
        "evolutionChainId": 484,
        "genus": "Hands-On Pokemon"
    },
    {
        "id": 924,
        "slug": "tandemaus",
        "name": "Tandemaus",
        "generation": 9,
        "evolutionChainId": 485,
        "genus": "Couple Pokemon"
    },
    {
        "id": 925,
        "slug": "maushold",
        "name": "Maushold",
        "generation": 9,
        "evolutionChainId": 485,
        "genus": "Family Pokemon"
    },
    {
        "id": 926,
        "slug": "fidough",
        "name": "Fidough",
        "generation": 9,
        "evolutionChainId": 486,
        "genus": "Puppy Pokemon"
    },
    {
        "id": 927,
        "slug": "dachsbun",
        "name": "Dachsbun",
        "generation": 9,
        "evolutionChainId": 486,
        "genus": "Dog Pokemon"
    },
    {
        "id": 928,
        "slug": "smoliv",
        "name": "Smoliv",
        "generation": 9,
        "evolutionChainId": 487,
        "genus": "Olive Pokemon"
    },
    {
        "id": 929,
        "slug": "dolliv",
        "name": "Dolliv",
        "generation": 9,
        "evolutionChainId": 487,
        "genus": "Olive Pokemon"
    },
    {
        "id": 930,
        "slug": "arboliva",
        "name": "Arboliva",
        "generation": 9,
        "evolutionChainId": 487,
        "genus": "Olive Pokemon"
    },
    {
        "id": 931,
        "slug": "squawkabilly",
        "name": "Squawkabilly",
        "generation": 9,
        "evolutionChainId": 488,
        "genus": "Parrot Pokemon"
    },
    {
        "id": 932,
        "slug": "nacli",
        "name": "Nacli",
        "generation": 9,
        "evolutionChainId": 489,
        "genus": "Rock Salt Pokemon"
    },
    {
        "id": 933,
        "slug": "naclstack",
        "name": "Naclstack",
        "generation": 9,
        "evolutionChainId": 489,
        "genus": "Rock Salt Pokemon"
    },
    {
        "id": 934,
        "slug": "garganacl",
        "name": "Garganacl",
        "generation": 9,
        "evolutionChainId": 489,
        "genus": "Rock Salt Pokemon"
    },
    {
        "id": 935,
        "slug": "charcadet",
        "name": "Charcadet",
        "generation": 9,
        "evolutionChainId": 490,
        "genus": "Fire Child Pokemon"
    },
    {
        "id": 936,
        "slug": "armarouge",
        "name": "Armarouge",
        "generation": 9,
        "evolutionChainId": 490,
        "genus": "Fire Warrior Pokemon"
    },
    {
        "id": 937,
        "slug": "ceruledge",
        "name": "Ceruledge",
        "generation": 9,
        "evolutionChainId": 490,
        "genus": "Fire Blades Pokemon"
    },
    {
        "id": 938,
        "slug": "tadbulb",
        "name": "Tadbulb",
        "generation": 9,
        "evolutionChainId": 491,
        "genus": "EleTadpole Pokemon"
    },
    {
        "id": 939,
        "slug": "bellibolt",
        "name": "Bellibolt",
        "generation": 9,
        "evolutionChainId": 491,
        "genus": "EleFrog Pokemon"
    },
    {
        "id": 940,
        "slug": "wattrel",
        "name": "Wattrel",
        "generation": 9,
        "evolutionChainId": 492,
        "genus": "Storm Petrel Pokemon"
    },
    {
        "id": 941,
        "slug": "kilowattrel",
        "name": "Kilowattrel",
        "generation": 9,
        "evolutionChainId": 492,
        "genus": "Frigatebird Pokemon"
    },
    {
        "id": 942,
        "slug": "maschiff",
        "name": "Maschiff",
        "generation": 9,
        "evolutionChainId": 493,
        "genus": "Rascal Pokemon"
    },
    {
        "id": 943,
        "slug": "mabosstiff",
        "name": "Mabosstiff",
        "generation": 9,
        "evolutionChainId": 493,
        "genus": "Boss Pokemon"
    },
    {
        "id": 944,
        "slug": "shroodle",
        "name": "Shroodle",
        "generation": 9,
        "evolutionChainId": 494,
        "genus": "Toxic Mouse Pokemon"
    },
    {
        "id": 945,
        "slug": "grafaiai",
        "name": "Grafaiai",
        "generation": 9,
        "evolutionChainId": 494,
        "genus": "Toxic Monkey Pokemon"
    },
    {
        "id": 946,
        "slug": "bramblin",
        "name": "Bramblin",
        "generation": 9,
        "evolutionChainId": 495,
        "genus": "Tumbleweed Pokemon"
    },
    {
        "id": 947,
        "slug": "brambleghast",
        "name": "Brambleghast",
        "generation": 9,
        "evolutionChainId": 495,
        "genus": "Tumbleweed Pokemon"
    },
    {
        "id": 948,
        "slug": "toedscool",
        "name": "Toedscool",
        "generation": 9,
        "evolutionChainId": 496,
        "genus": "Woodear Pokemon"
    },
    {
        "id": 949,
        "slug": "toedscruel",
        "name": "Toedscruel",
        "generation": 9,
        "evolutionChainId": 496,
        "genus": "Woodear Pokemon"
    },
    {
        "id": 950,
        "slug": "klawf",
        "name": "Klawf",
        "generation": 9,
        "evolutionChainId": 497,
        "genus": "Ambush Pokemon"
    },
    {
        "id": 951,
        "slug": "capsakid",
        "name": "Capsakid",
        "generation": 9,
        "evolutionChainId": 498,
        "genus": "Spicy Pepper Pokemon"
    },
    {
        "id": 952,
        "slug": "scovillain",
        "name": "Scovillain",
        "generation": 9,
        "evolutionChainId": 498,
        "genus": "Spicy Pepper Pokemon"
    },
    {
        "id": 953,
        "slug": "rellor",
        "name": "Rellor",
        "generation": 9,
        "evolutionChainId": 499,
        "genus": "Rolling Pokemon"
    },
    {
        "id": 954,
        "slug": "rabsca",
        "name": "Rabsca",
        "generation": 9,
        "evolutionChainId": 499,
        "genus": "Rolling Pokemon"
    },
    {
        "id": 955,
        "slug": "flittle",
        "name": "Flittle",
        "generation": 9,
        "evolutionChainId": 500,
        "genus": "Frill Pokemon"
    },
    {
        "id": 956,
        "slug": "espathra",
        "name": "Espathra",
        "generation": 9,
        "evolutionChainId": 500,
        "genus": "Ostrich Pokemon"
    },
    {
        "id": 957,
        "slug": "tinkatink",
        "name": "Tinkatink",
        "generation": 9,
        "evolutionChainId": 501,
        "genus": "Metalsmith Pokemon"
    },
    {
        "id": 958,
        "slug": "tinkatuff",
        "name": "Tinkatuff",
        "generation": 9,
        "evolutionChainId": 501,
        "genus": "Hammer Pokemon"
    },
    {
        "id": 959,
        "slug": "tinkaton",
        "name": "Tinkaton",
        "generation": 9,
        "evolutionChainId": 501,
        "genus": "Hammer Pokemon"
    },
    {
        "id": 960,
        "slug": "wiglett",
        "name": "Wiglett",
        "generation": 9,
        "evolutionChainId": 502,
        "genus": "Garden Eel Pokemon"
    },
    {
        "id": 961,
        "slug": "wugtrio",
        "name": "Wugtrio",
        "generation": 9,
        "evolutionChainId": 502,
        "genus": "Garden Eel Pokemon"
    },
    {
        "id": 962,
        "slug": "bombirdier",
        "name": "Bombirdier",
        "generation": 9,
        "evolutionChainId": 503,
        "genus": "Item Drop Pokemon"
    },
    {
        "id": 963,
        "slug": "finizen",
        "name": "Finizen",
        "generation": 9,
        "evolutionChainId": 504,
        "genus": "Dolphin Pokemon"
    },
    {
        "id": 964,
        "slug": "palafin",
        "name": "Palafin",
        "generation": 9,
        "evolutionChainId": 504,
        "genus": "Dolphin Pokemon"
    },
    {
        "id": 965,
        "slug": "varoom",
        "name": "Varoom",
        "generation": 9,
        "evolutionChainId": 505,
        "genus": "Single-Cyl Pokemon"
    },
    {
        "id": 966,
        "slug": "revavroom",
        "name": "Revavroom",
        "generation": 9,
        "evolutionChainId": 505,
        "genus": "Multi-Cyl Pokemon"
    },
    {
        "id": 967,
        "slug": "cyclizar",
        "name": "Cyclizar",
        "generation": 9,
        "evolutionChainId": 506,
        "genus": "Mount Pokemon"
    },
    {
        "id": 968,
        "slug": "orthworm",
        "name": "Orthworm",
        "generation": 9,
        "evolutionChainId": 507,
        "genus": "Earthworm Pokemon"
    },
    {
        "id": 969,
        "slug": "glimmet",
        "name": "Glimmet",
        "generation": 9,
        "evolutionChainId": 508,
        "genus": "Ore Pokemon"
    },
    {
        "id": 970,
        "slug": "glimmora",
        "name": "Glimmora",
        "generation": 9,
        "evolutionChainId": 508,
        "genus": "Ore Pokemon"
    },
    {
        "id": 971,
        "slug": "greavard",
        "name": "Greavard",
        "generation": 9,
        "evolutionChainId": 509,
        "genus": "Ghost Dog Pokemon"
    },
    {
        "id": 972,
        "slug": "houndstone",
        "name": "Houndstone",
        "generation": 9,
        "evolutionChainId": 509,
        "genus": "Ghost Dog Pokemon"
    },
    {
        "id": 973,
        "slug": "flamigo",
        "name": "Flamigo",
        "generation": 9,
        "evolutionChainId": 510,
        "genus": "Synchronize Pokemon"
    },
    {
        "id": 974,
        "slug": "cetoddle",
        "name": "Cetoddle",
        "generation": 9,
        "evolutionChainId": 511,
        "genus": "Terra Whale Pokemon"
    },
    {
        "id": 975,
        "slug": "cetitan",
        "name": "Cetitan",
        "generation": 9,
        "evolutionChainId": 511,
        "genus": "Terra Whale Pokemon"
    },
    {
        "id": 976,
        "slug": "veluza",
        "name": "Veluza",
        "generation": 9,
        "evolutionChainId": 512,
        "genus": "Jettison Pokemon"
    },
    {
        "id": 977,
        "slug": "dondozo",
        "name": "Dondozo",
        "generation": 9,
        "evolutionChainId": 513,
        "genus": "Big Catfish Pokemon"
    },
    {
        "id": 978,
        "slug": "tatsugiri",
        "name": "Tatsugiri",
        "generation": 9,
        "evolutionChainId": 514,
        "genus": "Mimicry Pokemon"
    },
    {
        "id": 979,
        "slug": "annihilape",
        "name": "Annihilape",
        "generation": 9,
        "evolutionChainId": 24,
        "genus": "Rage Monkey Pokemon"
    },
    {
        "id": 980,
        "slug": "clodsire",
        "name": "Clodsire",
        "generation": 9,
        "evolutionChainId": 96,
        "genus": "Spiny Fish Pokemon"
    },
    {
        "id": 981,
        "slug": "farigiraf",
        "name": "Farigiraf",
        "generation": 9,
        "evolutionChainId": 101,
        "genus": "Long Neck Pokemon"
    },
    {
        "id": 982,
        "slug": "dudunsparce",
        "name": "Dudunsparce",
        "generation": 9,
        "evolutionChainId": 103,
        "genus": "Land Snake Pokemon"
    },
    {
        "id": 983,
        "slug": "kingambit",
        "name": "Kingambit",
        "generation": 9,
        "evolutionChainId": 317,
        "genus": "Big Blade Pokemon"
    },
    {
        "id": 984,
        "slug": "great-tusk",
        "name": "Great Tusk",
        "generation": 9,
        "evolutionChainId": 515,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 985,
        "slug": "scream-tail",
        "name": "Scream Tail",
        "generation": 9,
        "evolutionChainId": 516,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 986,
        "slug": "brute-bonnet",
        "name": "Brute Bonnet",
        "generation": 9,
        "evolutionChainId": 517,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 987,
        "slug": "flutter-mane",
        "name": "Flutter Mane",
        "generation": 9,
        "evolutionChainId": 518,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 988,
        "slug": "slither-wing",
        "name": "Slither Wing",
        "generation": 9,
        "evolutionChainId": 519,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 989,
        "slug": "sandy-shocks",
        "name": "Sandy Shocks",
        "generation": 9,
        "evolutionChainId": 520,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 990,
        "slug": "iron-treads",
        "name": "Iron Treads",
        "generation": 9,
        "evolutionChainId": 521,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 991,
        "slug": "iron-bundle",
        "name": "Iron Bundle",
        "generation": 9,
        "evolutionChainId": 522,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 992,
        "slug": "iron-hands",
        "name": "Iron Hands",
        "generation": 9,
        "evolutionChainId": 523,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 993,
        "slug": "iron-jugulis",
        "name": "Iron Jugulis",
        "generation": 9,
        "evolutionChainId": 524,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 994,
        "slug": "iron-moth",
        "name": "Iron Moth",
        "generation": 9,
        "evolutionChainId": 525,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 995,
        "slug": "iron-thorns",
        "name": "Iron Thorns",
        "generation": 9,
        "evolutionChainId": 526,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 996,
        "slug": "frigibax",
        "name": "Frigibax",
        "generation": 9,
        "evolutionChainId": 527,
        "genus": "Ice Fin Pokemon"
    },
    {
        "id": 997,
        "slug": "arctibax",
        "name": "Arctibax",
        "generation": 9,
        "evolutionChainId": 527,
        "genus": "Ice Fin Pokemon"
    },
    {
        "id": 998,
        "slug": "baxcalibur",
        "name": "Baxcalibur",
        "generation": 9,
        "evolutionChainId": 527,
        "genus": "Ice Dragon Pokemon"
    },
    {
        "id": 999,
        "slug": "gimmighoul",
        "name": "Gimmighoul",
        "generation": 9,
        "evolutionChainId": 528,
        "genus": "Coin Chest Pokemon"
    },
    {
        "id": 1000,
        "slug": "gholdengo",
        "name": "Gholdengo",
        "generation": 9,
        "evolutionChainId": 528,
        "genus": "Coin Entity Pokemon"
    },
    {
        "id": 1001,
        "slug": "wo-chien",
        "name": "Wo-Chien",
        "generation": 9,
        "evolutionChainId": 529,
        "genus": "Ruinous Pokemon"
    },
    {
        "id": 1002,
        "slug": "chien-pao",
        "name": "Chien-Pao",
        "generation": 9,
        "evolutionChainId": 530,
        "genus": "Ruinous Pokemon"
    },
    {
        "id": 1003,
        "slug": "ting-lu",
        "name": "Ting-Lu",
        "generation": 9,
        "evolutionChainId": 531,
        "genus": "Ruinous Pokemon"
    },
    {
        "id": 1004,
        "slug": "chi-yu",
        "name": "Chi-Yu",
        "generation": 9,
        "evolutionChainId": 532,
        "genus": "Ruinous Pokemon"
    },
    {
        "id": 1005,
        "slug": "roaring-moon",
        "name": "Roaring Moon",
        "generation": 9,
        "evolutionChainId": 533,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 1006,
        "slug": "iron-valiant",
        "name": "Iron Valiant",
        "generation": 9,
        "evolutionChainId": 534,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 1007,
        "slug": "koraidon",
        "name": "Koraidon",
        "generation": 9,
        "evolutionChainId": 535,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 1008,
        "slug": "miraidon",
        "name": "Miraidon",
        "generation": 9,
        "evolutionChainId": 536,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 1009,
        "slug": "walking-wake",
        "name": "Walking Wake",
        "generation": 9,
        "evolutionChainId": 537,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 1010,
        "slug": "iron-leaves",
        "name": "Iron Leaves",
        "generation": 9,
        "evolutionChainId": 538,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 1011,
        "slug": "dipplin",
        "name": "Dipplin",
        "generation": 9,
        "evolutionChainId": 442,
        "genus": "Candy Apple Pokemon"
    },
    {
        "id": 1012,
        "slug": "poltchageist",
        "name": "Poltchageist",
        "generation": 9,
        "evolutionChainId": 539,
        "genus": "Matcha Pokemon"
    },
    {
        "id": 1013,
        "slug": "sinistcha",
        "name": "Sinistcha",
        "generation": 9,
        "evolutionChainId": 539,
        "genus": "Matcha Pokemon"
    },
    {
        "id": 1014,
        "slug": "okidogi",
        "name": "Okidogi",
        "generation": 9,
        "evolutionChainId": 540,
        "genus": "Retainer Pokemon"
    },
    {
        "id": 1015,
        "slug": "munkidori",
        "name": "Munkidori",
        "generation": 9,
        "evolutionChainId": 541,
        "genus": "Retainer Pokemon"
    },
    {
        "id": 1016,
        "slug": "fezandipiti",
        "name": "Fezandipiti",
        "generation": 9,
        "evolutionChainId": 542,
        "genus": "Retainer Pokemon"
    },
    {
        "id": 1017,
        "slug": "ogerpon",
        "name": "Ogerpon",
        "generation": 9,
        "evolutionChainId": 543,
        "genus": "Mask Pokemon"
    },
    {
        "id": 1018,
        "slug": "archaludon",
        "name": "Archaludon",
        "generation": 9,
        "evolutionChainId": 465,
        "genus": "Alloy Pokemon"
    },
    {
        "id": 1019,
        "slug": "hydrapple",
        "name": "Hydrapple",
        "generation": 9,
        "evolutionChainId": 442,
        "genus": "Apple Hydra Pokemon"
    },
    {
        "id": 1020,
        "slug": "gouging-fire",
        "name": "Gouging Fire",
        "generation": 9,
        "evolutionChainId": 544,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 1021,
        "slug": "raging-bolt",
        "name": "Raging Bolt",
        "generation": 9,
        "evolutionChainId": 545,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 1022,
        "slug": "iron-boulder",
        "name": "Iron Boulder",
        "generation": 9,
        "evolutionChainId": 547,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 1023,
        "slug": "iron-crown",
        "name": "Iron Crown",
        "generation": 9,
        "evolutionChainId": 546,
        "genus": "Paradox Pokemon"
    },
    {
        "id": 1024,
        "slug": "terapagos",
        "name": "Terapagos",
        "generation": 9,
        "evolutionChainId": 548,
        "genus": "Tera Pokemon"
    },
    {
        "id": 1025,
        "slug": "pecharunt",
        "name": "Pecharunt",
        "generation": 9,
        "evolutionChainId": 549,
        "genus": "Subjugation Pokemon"
    }
];

const explicitCounterparts: Record<string, PokemonAnimalCounterpart> = {
    bulbasaur: {animal: "frog or toad", confidence: "medium", note: "Its squat body and wide mouth read closest to a frog or toad, even though the plant bulb is the main design cue."},
    ivysaur: {animal: "frog or toad", confidence: "medium", note: "The low amphibian body plan still reads closest to a frog or toad, with a large plant structure on its back."},
    venusaur: {animal: "toad", confidence: "medium", note: "Venusaur most closely resembles a bulky toad carrying a giant flowering plant."},
    charmander: {animal: "salamander or lizard", confidence: "strong", note: "The small reptile body and fire-tail silhouette point to a salamander or lizard."},
    charmeleon: {animal: "lizard", confidence: "strong", note: "Charmeleon reads most directly as a bipedal lizard."},
    charizard: {animal: "dragon", confidence: "broad", note: "Charizard is a fantasy dragon; among real animals, its base silhouette is closest to a large lizard."},
    squirtle: {animal: "turtle", confidence: "strong", note: "The shell, beak-like mouth, and aquatic posture are turtle traits."},
    wartortle: {animal: "turtle", confidence: "strong", note: "Wartortle is still primarily turtle-like, with fantasy ear and tail flourishes."},
    blastoise: {animal: "turtle", confidence: "strong", note: "Blastoise keeps the turtle shell and heavy aquatic reptile frame."},
    caterpie: {animal: "caterpillar", confidence: "strong", note: "Caterpie is a stylized caterpillar."},
    metapod: {animal: "chrysalis", confidence: "strong", note: "Metapod resembles the pupal stage of a butterfly or moth."},
    butterfree: {animal: "butterfly", confidence: "strong", note: "Butterfree is a butterfly-like insect."},
    weedle: {animal: "caterpillar", confidence: "strong", note: "Weedle is a stinging caterpillar-like larva."},
    kakuna: {animal: "cocoon", confidence: "strong", note: "Kakuna resembles an insect pupa or cocoon."},
    beedrill: {animal: "bee or wasp", confidence: "strong", note: "The striped body, wings, and stingers make Beedrill closest to a bee or wasp."},
    pikachu: {animal: "mouse or pika", confidence: "strong", note: "Pikachu is officially mouse-like, with many fans also noticing pika and squirrel-like traits."},
    raichu: {animal: "mouse or pika", confidence: "strong", note: "Raichu keeps the electric rodent design, closest to a mouse or pika."},
    nidoran_f: {animal: "rabbit or shrew", confidence: "medium", note: "Nidoran's ears and small mammal body make it closest to a rabbit or shrew-like mammal."},
    nidorina: {animal: "rabbit or shrew", confidence: "medium", note: "Nidorina is a fantasy mammal, closest to a rabbit or shrew with defensive spines."},
    nidoqueen: {animal: "rhinoceros or armored mammal", confidence: "broad", note: "Nidoqueen is a kaiju-like composite; the closest animal comparison is an armored rhinoceros-like mammal."},
    nidoran_m: {animal: "rabbit or shrew", confidence: "medium", note: "Nidoran's ears and small mammal body make it closest to a rabbit or shrew-like mammal."},
    nidorino: {animal: "rabbit or shrew", confidence: "medium", note: "Nidorino is a spined fantasy mammal with rabbit and shrew-like traits."},
    nidoking: {animal: "rhinoceros or armored mammal", confidence: "broad", note: "Nidoking is a kaiju-like composite; the closest animal comparison is an armored rhinoceros-like mammal."},
    clefairy: {animal: "no single real animal", confidence: "none", note: "Clefairy is primarily a fairy-like fantasy creature rather than a clear animal."},
    clefable: {animal: "no single real animal", confidence: "none", note: "Clefable is primarily a fairy-like fantasy creature rather than a clear animal."},
    jigglypuff: {animal: "no single real animal", confidence: "none", note: "Jigglypuff is a balloon-like fantasy creature, not a clean animal counterpart."},
    wigglytuff: {animal: "rabbit-like fantasy creature", confidence: "broad", note: "Wigglytuff has rabbit-like ears and mammal traits, but no single real animal counterpart."},
    oddish: {animal: "no single real animal", confidence: "none", note: "Oddish is plant-like rather than animal-like."},
    gloom: {animal: "no single real animal", confidence: "none", note: "Gloom is primarily plant-like rather than animal-like."},
    vileplume: {animal: "no single real animal", confidence: "none", note: "Vileplume is primarily flower-like rather than animal-like."},
    paras: {animal: "cicada nymph or crab", confidence: "medium", note: "Paras is a mushroom-bearing arthropod, often read as a cicada nymph or crab-like insect."},
    parasect: {animal: "cicada nymph or crab", confidence: "medium", note: "Parasect keeps the arthropod body under a giant fungus cap."},
    venonat: {animal: "gnat or moth", confidence: "medium", note: "Venonat is closest to a fuzzy insect such as a gnat or moth."},
    venomoth: {animal: "moth", confidence: "strong", note: "Venomoth is a moth-like insect."},
    drowzee: {animal: "tapir", confidence: "strong", note: "Drowzee is closest to a tapir, especially because of the trunk-like snout."},
    hypno: {animal: "tapir-like humanoid", confidence: "broad", note: "Hypno keeps tapir-like facial traits but is more humanoid overall."},
    exeggcute: {animal: "no single real animal", confidence: "none", note: "Exeggcute is egg-like and plant-like rather than a clear animal."},
    exeggutor: {animal: "no single real animal", confidence: "none", note: "Exeggutor is primarily palm-tree-like rather than animal-like."},
    cubone: {animal: "dinosaur-like reptile", confidence: "broad", note: "Cubone is a fantasy reptile with dinosaur-like proportions."},
    marowak: {animal: "dinosaur-like reptile", confidence: "broad", note: "Marowak is closest to a small dinosaur-like reptile."},
    kangaskhan: {animal: "kangaroo", confidence: "strong", note: "Kangaskhan is a pouch-carrying marsupial design closest to a kangaroo."},
    horsea: {animal: "seahorse", confidence: "strong", note: "Horsea is a seahorse-like fish."},
    seadra: {animal: "seahorse", confidence: "strong", note: "Seadra is a spiny seahorse-like fish."},
    staryu: {animal: "starfish", confidence: "strong", note: "Staryu is a starfish-like marine animal."},
    starmie: {animal: "starfish", confidence: "strong", note: "Starmie is a stylized starfish."},
    mr_mime: {animal: "no single real animal", confidence: "none", note: "Mr. Mime is a humanoid performer design, not an animal counterpart."},
    scyther: {animal: "praying mantis", confidence: "strong", note: "Scyther is closest to a praying mantis with blade-like forelimbs."},
    jynx: {animal: "no single real animal", confidence: "none", note: "Jynx is a humanoid fantasy design, not a clear animal counterpart."},
    electabuzz: {animal: "ape-like humanoid", confidence: "broad", note: "Electabuzz is a fantasy humanoid with ape and tiger-like cues."},
    magmar: {animal: "duck-like reptile", confidence: "broad", note: "Magmar is a fantasy creature with duck-billed and reptile-like traits."},
    lapras: {animal: "plesiosaur", confidence: "medium", note: "Lapras most closely resembles a plesiosaur-style marine reptile."},
    eevee: {animal: "fox or dog", confidence: "medium", note: "Eevee is a small mammal composite, most often read as fox-like with dog and cat traits."},
    vaporeon: {animal: "fox-like aquatic mammal", confidence: "broad", note: "Vaporeon keeps Eevee's mammal base but adds fish and aquatic traits."},
    jolteon: {animal: "fox or dog", confidence: "medium", note: "Jolteon keeps a fox-like mammal silhouette with spiky fantasy fur."},
    flareon: {animal: "fox or dog", confidence: "medium", note: "Flareon is closest to a fluffy fox-like mammal."},
    porygon: {animal: "no single real animal", confidence: "none", note: "Porygon is a virtual polygon creature rather than a real animal counterpart."},
    snorlax: {animal: "bear", confidence: "medium", note: "Snorlax is a bulky fantasy mammal most often compared to a bear."},
    articuno: {animal: "bird", confidence: "strong", note: "Articuno is an elemental bird design."},
    zapdos: {animal: "bird", confidence: "strong", note: "Zapdos is an elemental bird design."},
    moltres: {animal: "bird", confidence: "strong", note: "Moltres is an elemental bird design."},
    mewtwo: {animal: "cat-like humanoid", confidence: "broad", note: "Mewtwo is a psychic humanoid creature with cat-like traits, not a single real animal."},
    mew: {animal: "cat or embryo-like mammal", confidence: "broad", note: "Mew is a fantasy mammal with cat-like and embryo-like cues."}
};

const genusRules: Array<[RegExp, string]> = [
    [/\bStag Beetle\b/i, "stag beetle"],
    [/\bRhinoceros Beetle\b/i, "rhinoceros beetle"],
    [/\bPoison Moth\b/i, "moth"],
    [/\bPig Monkey\b/i, "monkey"],
    [/\bSea Lion\b/i, "sea lion"],
    [/\bWild Duck\b/i, "duck"],
    [/\bWater Fish\b/i, "fish"],
    [/\bMud Fish\b/i, "fish"],
    [/\bEleFish\b/i, "electric eel"],
    [/\bFirefly\b/i, "firefly"],
    [/\bFlycatcher\b/i, "flycatcher bird"],
    [/\bWood Gecko\b/i, "gecko"],
    [/\bLand Snake\b/i, "snake"],
    [/\bRock Snake\b/i, "snake"],
    [/\bBig Horn\b/i, "horned mammal"],
    [/\bLong Neck\b/i, "giraffe or sauropod"],
    [/\bGoldfish\b/i, "goldfish"],
    [/\bTadpole\b/i, "tadpole"],
    [/\bShellfish\b/i, "shellfish"],
    [/\bBivalve\b/i, "clam or oyster"],
    [/\bButterfly\b/i, "butterfly"],
    [/\bCocoon\b/i, "cocoon or chrysalis"],
    [/\bWorm\b/i, "worm or caterpillar"],
    [/\bMouse\b/i, "mouse"],
    [/\bDragon\b/i, "dragon"],
    [/\bFox\b/i, "fox"],
    [/\bPuppy\b/i, "dog"],
    [/\bBat\b/i, "bat"],
    [/\bRabbit\b/i, "rabbit"],
    [/\bMole\b/i, "mole"],
    [/\bPenguin\b/i, "penguin"],
    [/\bOwl\b/i, "owl"],
    [/\bDuck\b/i, "duck"],
    [/\bJellyfish\b/i, "jellyfish"],
    [/\bHorse\b/i, "horse"],
    [/\bSnake\b/i, "snake"],
    [/\bCobra\b/i, "cobra"],
    [/\bFish\b/i, "fish"],
    [/\bBird\b/i, "bird"],
    [/\bCat\b/i, "cat"],
    [/\bDog\b/i, "dog"],
    [/\bMonkey\b/i, "monkey"],
    [/\bChimp\b/i, "chimpanzee"],
    [/\bTurtle\b/i, "turtle"],
    [/\bGecko\b/i, "gecko"],
    [/\bCrocodile\b/i, "crocodile"],
    [/\bAlligator\b/i, "alligator"],
    [/\bCrab\b/i, "crab"],
    [/\bLobster\b/i, "lobster"],
    [/\bShrimp\b/i, "shrimp"],
    [/\bMantis\b/i, "mantis"],
    [/\bBee\b/i, "bee"],
    [/\bWasp\b/i, "wasp"],
    [/\bMoth\b/i, "moth"],
    [/\bFly\b/i, "fly"],
    [/\bAnt\b/i, "ant"],
    [/\bSpider\b/i, "spider"],
    [/\bScorpion\b/i, "scorpion"],
    [/\bFrog\b/i, "frog"],
    [/\bToad\b/i, "toad"],
    [/\bLizard\b/i, "lizard"],
    [/\bSeal\b/i, "seal"],
    [/\bWhale\b/i, "whale"],
    [/\bDolphin\b/i, "dolphin"],
    [/\bShark\b/i, "shark"],
    [/\bEel\b/i, "eel"],
    [/\bOctopus\b/i, "octopus"],
    [/\bSquid\b/i, "squid"],
    [/\bDeer\b/i, "deer"],
    [/\bGoat\b/i, "goat"],
    [/\bSheep\b|\bWool\b/i, "sheep"],
    [/\bCow\b|\bBull\b|\bOx\b/i, "cattle"],
    [/\bPig\b|\bHog\b|\bBoar\b/i, "pig"],
    [/\bBear\b/i, "bear"],
    [/\bPanda\b/i, "panda"],
    [/\bKoala\b/i, "koala"],
    [/\bKangaroo\b/i, "kangaroo"],
    [/\bElephant\b/i, "elephant"],
    [/\bRhinoceros\b|\bRhino\b/i, "rhinoceros"],
    [/\bHippo\b/i, "hippopotamus"],
    [/\bLion\b/i, "lion"],
    [/\bTiger\b/i, "tiger"],
    [/\bWolf\b/i, "wolf"],
    [/\bSquirrel\b/i, "squirrel"],
    [/\bHedgehog\b/i, "hedgehog"],
    [/\bFossil\b/i, "prehistoric animal"],
    [/\bShell\b/i, "shelled animal"],
    [/\bCoral\b/i, "coral"],
    [/\bKite\b/i, "ray"],
    [/\bWhiskers\b/i, "catfish"],
    [/\bAmmonite\b|\bSpiral\b/i, "ammonite"],
    [/\bPincer\b/i, "pincer-bearing arthropod"],
    [/\bScaly\b/i, "reptile or fish"],
    [/\bWing\b/i, "bird or winged animal"]
];

function normalizeSlug(slug: string) {
    return slug.replace(/-/g, "_");
}

function defaultCounterpart(row: PokemonAnimalRow): PokemonAnimalCounterpart {
    const explicit = explicitCounterparts[normalizeSlug(row.slug)];
    const genusCategory = row.genus.replace(/\s+Pokemon$/i, "");

    if (explicit) {
        return explicit;
    }

    for (const [pattern, animal] of genusRules) {
        if (pattern.test(genusCategory)) {
            const broad = ["dragon", "prehistoric animal", "horned mammal", "giraffe or sauropod", "reptile or fish", "shelled animal", "bird or winged animal"].includes(animal);
            return {
                animal,
                confidence: broad ? "broad" : "strong",
                note: "The official category is \"" + row.genus + "\", which makes " + animal + " the closest animal counterpart for quick comparison."
            };
        }
    }

    return {
        animal: "no single real animal",
        confidence: "none",
        note: "The official category is \"" + row.genus + "\", and the design does not point cleanly to one real animal."
    };
}

export function slugifyPokemonName(name: string) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function buildEntry(row: PokemonAnimalRow): PokemonAnimalEntry {
    const generation = pokemonAnimalGenerations.find((item) => item.id === row.generation) ?? pokemonAnimalGenerations[0];
    return {
        ...row,
        ...defaultCounterpart(row),
        generationSlug: generation.slug,
        generationLabel: generation.label
    };
}

function resolveFamilyCounterparts(entries: PokemonAnimalEntry[]) {
    const strongestByChain = new Map<number, PokemonAnimalEntry>();
    const confidenceRank: Record<PokemonAnimalConfidence, number> = {
        strong: 4,
        medium: 3,
        broad: 2,
        none: 1
    };

    for (const entry of entries) {
        if (entry.confidence === "none") {
            continue;
        }

        const current = strongestByChain.get(entry.evolutionChainId);

        if (!current || confidenceRank[entry.confidence] > confidenceRank[current.confidence]) {
            strongestByChain.set(entry.evolutionChainId, entry);
        }
    }

    return entries.map((entry) => {
        if (entry.confidence !== "none") {
            return entry;
        }

        const familyMatch = strongestByChain.get(entry.evolutionChainId);

        if (!familyMatch) {
            return entry;
        }

        return {
            ...entry,
            animal: familyMatch.animal,
            confidence: "broad" as const,
            note: `${entry.name} does not have a direct animal category, but its evolution line points to ${familyMatch.animal} as the closest animal counterpart.`
        };
    });
}

export const pokemonAnimalEntries: PokemonAnimalEntry[] = resolveFamilyCounterparts(pokemonAnimalRows.map(buildEntry));

export const pokemonAnimalEntriesBySlug = new Map(pokemonAnimalEntries.map((entry) => [entry.slug, entry]));
export const pokemonAnimalGenerationsBySlug = new Map(pokemonAnimalGenerations.map((generation) => [generation.slug, generation]));

export function getPokemonAnimalEntry(slug: string) {
    return pokemonAnimalEntriesBySlug.get(slug) ?? null;
}

export function getPokemonAnimalGeneration(slug: string) {
    return pokemonAnimalGenerationsBySlug.get(slug) ?? null;
}

export function getPokemonAnimalEntriesByGeneration(generationId: number) {
    return pokemonAnimalEntries.filter((entry) => entry.generation === generationId);
}

export function getPokemonAnimalSummary() {
    const strongCount = pokemonAnimalEntries.filter((entry) => entry.confidence === "strong").length;
    const mediumCount = pokemonAnimalEntries.filter((entry) => entry.confidence === "medium").length;
    const broadCount = pokemonAnimalEntries.filter((entry) => entry.confidence === "broad").length;
    const noSingleAnimalCount = pokemonAnimalEntries.filter((entry) => entry.confidence === "none").length;

    return {total: pokemonAnimalEntries.length, strongCount, mediumCount, broadCount, noSingleAnimalCount};
}

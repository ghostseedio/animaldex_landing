/**
 * Portuguese, Spanish and French copies of the /tier-list hub.
 *
 * These are NOT next-intl locales: only the hub is translated, so the pages
 * live at literal /pt/tier-list, /es/tier-list and /fr/tier-list routes under
 * the default (English) locale, and every list card links to the English
 * /tier-list/<slug> page. Species names stay English on purpose — they come
 * from the same ranking data as the English hub so the answers never drift.
 *
 * Keep this module free of server-only imports: tests and the sitemap builder
 * load it directly.
 */

export const TRANSLATED_TIER_LIST_HUB_LANGUAGES = ["pt", "es", "fr"] as const;
export type TranslatedTierListHubLanguage = typeof TRANSLATED_TIER_LIST_HUB_LANGUAGES[number];

/** Featured lists answered in the hub's quick answers + FAQ, in display order. */
export const TIER_LIST_HUB_ANSWER_SLUGS = [
    "fastest-animals",
    "strongest-animals",
    "smartest-animals",
    "most-dangerous-animals",
    "most-agile-animals",
    "most-adaptable-animals"
] as const;
export type TierListHubAnswerSlug = typeof TIER_LIST_HUB_ANSWER_SLUGS[number];

export const ENGLISH_TIER_LIST_HUB_PATH = "/tier-list";
export const INDONESIAN_TIER_LIST_HUB_PATH = "/id/tier-list";

export function getTranslatedTierListHubPath(language: TranslatedTierListHubLanguage) {
    return `/${language}/tier-list`;
}

export function getTranslatedTierListHubPaths() {
    return TRANSLATED_TIER_LIST_HUB_LANGUAGES.map(getTranslatedTierListHubPath);
}

/** hreflang map shared by all five hubs (en, id, pt, es, fr; x-default → English). */
export function getTierListHubLanguageAlternates(): Record<string, string> {
    return {
        en: ENGLISH_TIER_LIST_HUB_PATH,
        id: INDONESIAN_TIER_LIST_HUB_PATH,
        pt: getTranslatedTierListHubPath("pt"),
        es: getTranslatedTierListHubPath("es"),
        fr: getTranslatedTierListHubPath("fr"),
        "x-default": ENGLISH_TIER_LIST_HUB_PATH
    };
}

/** Language switcher entries, labelled in their own language. */
export const TIER_LIST_HUB_LANGUAGE_LINKS: Array<{language: string; label: string; href: string}> = [
    {language: "en", label: "English", href: ENGLISH_TIER_LIST_HUB_PATH},
    {language: "id", label: "Bahasa Indonesia", href: INDONESIAN_TIER_LIST_HUB_PATH},
    {language: "pt", label: "Português", href: getTranslatedTierListHubPath("pt")},
    {language: "es", label: "Español", href: getTranslatedTierListHubPath("es")},
    {language: "fr", label: "Français", href: getTranslatedTierListHubPath("fr")}
];

export type TierListHubLeaders = {
    fastest: string;
    strongest: string;
    smartest: string;
    dangerous: string;
};

type TierListHubListCopy = {
    /** "Fastest animal" — the quick-answer card label. */
    label: string;
    /** FAQ question. */
    question: string;
    /** List name as used inside the FAQ answer sentence. */
    listName: string;
    /** Translated context sentence appended to the FAQ answer (the English #1 reason would mix languages). */
    note: string;
};

export type TranslatedTierListHubCopy = {
    language: TranslatedTierListHubLanguage;
    /** BCP 47 tag for hreflang / lang attributes and date formatting. */
    htmlLang: string;
    openGraphLocale: string;
    languageName: string;
    metaTitle: string;
    metaDescription: (leaders: TierListHubLeaders) => string;
    eyebrow: string;
    title: string;
    introTitle: string;
    intro: [string, string];
    englishNotice: string;
    quickAnswersTitle: string;
    quickAnswersDescription: string;
    followedBy: (second: string, third: string) => string;
    viewList: string;
    allListsTitle: string;
    allListsDescription: string;
    filterAll: string;
    searchLabel: string;
    resultSingular: string;
    resultPlural: string;
    viewRanking: string;
    rankedSpeciesLabel: string;
    methodLabel: string;
    cardDescription: (categoryLabel: string, count: number) => string;
    methodologyTitle: string;
    methodologyDescription: string;
    faqTitle: string;
    faqAnswer: (first: string, second: string, third: string, listName: string) => string;
    otherLanguages: string;
    lists: Record<TierListHubAnswerSlug, TierListHubListCopy>;
    categories: Record<string, string>;
};

const pt: TranslatedTierListHubCopy = {
    language: "pt",
    htmlLang: "pt-BR",
    openGraphLocale: "pt_BR",
    languageName: "Português",
    metaTitle: "Tier List de Animais: Os Mais Rápidos, Fortes e Inteligentes",
    metaDescription: (leaders) =>
        `Tier list de animais do tier S ao D. Mais rápido: ${leaders.fastest}. Mais forte: ${leaders.strongest}. Mais inteligente: ${leaders.smartest}. Mais perigoso: ${leaders.dangerous}.`,
    eyebrow: "Tier lists do AnimalDex",
    title: "Tier list de animais: os mais rápidos, fortes e inteligentes",
    introTitle: "O que é uma tier list de animais?",
    intro: [
        "Uma tier list de animais organiza as espécies em níveis em vez de uma nota única: o tier S reúne os destaques absolutos, e os tiers A, B, C e D trazem os animais que se encaixam cada vez menos no critério. É um formato mais honesto do que um simples top 10, porque mostra quando vários animais estão praticamente empatados.",
        "Cada tier list do AnimalDex classifica 100 ou mais espécies em um único critério — velocidade, força, inteligência, perigo, agilidade, adaptabilidade e muito mais — e explica a metodologia por trás da ordem. As respostas rápidas abaixo vêm direto dos mesmos dados das listas completas."
    ],
    englishNotice: "As listas completas estão em inglês, e os nomes das espécies aparecem em inglês.",
    quickAnswersTitle: "Respostas rápidas",
    quickAnswersDescription: "O primeiro colocado de cada tier list em destaque, com os dois seguintes.",
    followedBy: (second, third) => `Seguido por ${second} e ${third}`,
    viewList: "Ver a tier list completa",
    allListsTitle: "Todas as tier lists",
    allListsDescription: "Filtre por categoria ou busque pelo nome da lista. Cada cartão abre a tier list completa em inglês.",
    filterAll: "Todas",
    searchLabel: "Buscar tier lists",
    resultSingular: "tier list",
    resultPlural: "tier lists",
    viewRanking: "Ver ranking",
    rankedSpeciesLabel: "Espécies ranqueadas",
    methodLabel: "Método",
    cardDescription: (categoryLabel, count) =>
        `Ranking de ${categoryLabel.toLowerCase()} com ${count} espécies, organizado do tier S ao D.`,
    methodologyTitle: "Como funcionam os rankings do AnimalDex",
    methodologyDescription:
        "Cada tier list usa sinais biológicos diferentes: velocidade registrada, força relativa, tamanho do corpo, força da mordida, cognição observada e risco documentado. Esses sinais são úteis, mas não são intercambiáveis, por isso cada lista explica o que está medindo.",
    faqTitle: "Perguntas frequentes sobre a tier list de animais",
    faqAnswer: (first, second, third, listName) =>
        `${first} é o número 1 da tier list de ${listName} do AnimalDex, seguido por ${second} e ${third}.`,
    otherLanguages: "Esta página em outros idiomas",
    lists: {
        "fastest-animals": {
            label: "Animal mais rápido",
            question: "Qual é o animal mais rápido do mundo?",
            listName: "animais mais rápidos",
            note: "Velocidade no ar, em terra e na água são tratadas como perguntas diferentes, então o mergulho de um falcão não é comparado diretamente com uma corrida em terra."
        },
        "strongest-animals": {
            label: "Animal mais forte",
            question: "Qual é o animal mais forte do mundo?",
            listName: "animais mais fortes",
            note: "A lista pesa o tamanho do corpo, a força aplicada e o uso real dessa força na natureza."
        },
        "smartest-animals": {
            label: "Animal mais inteligente",
            question: "Qual é o animal mais inteligente do mundo?",
            listName: "animais mais inteligentes",
            note: "Inteligência social, uso de ferramentas, comunicação e resolução de problemas são avaliados juntos, sem fingir que existe um QI único para todos os animais."
        },
        "most-dangerous-animals": {
            label: "Animal mais perigoso",
            question: "Qual é o animal mais perigoso do mundo?",
            listName: "animais mais perigosos",
            note: "O perigo considera o risco documentado para as pessoas, que depende do contexto do encontro, da região e da exposição."
        },
        "most-agile-animals": {
            label: "Animal mais ágil",
            question: "Qual é o animal mais ágil do mundo?",
            listName: "animais mais ágeis",
            note: "Aqui, agilidade significa controle do corpo, mudanças de direção e manobras em alta velocidade."
        },
        "most-adaptable-animals": {
            label: "Animal mais adaptável",
            question: "Qual é o animal mais adaptável do mundo?",
            listName: "animais mais adaptáveis",
            note: "Adaptabilidade mede a capacidade de prosperar em habitats muito diferentes, inclusive em ambientes modificados pelo ser humano."
        }
    },
    categories: {
        speed: "Velocidade",
        strength: "Força",
        size: "Tamanho",
        intelligence: "Inteligência",
        danger: "Perigo",
        agility: "Agilidade",
        bite_force: "Força da mordida",
        endurance: "Resistência",
        hunting: "Caça",
        eyesight: "Visão",
        resilience: "Resiliência",
        armor: "Armadura",
        stealth: "Furtividade",
        teamwork: "Trabalho em equipe",
        adaptability: "Adaptabilidade",
        camouflage: "Camuflagem",
        strike: "Golpe",
        invasive: "Espécies invasoras",
        reproduction: "Reprodução",
        reputation: "Reputação",
        rarity: "Raridade",
        fatality: "Letalidade",
        culture: "Cultura",
        communication: "Comunicação",
        character: "Caráter"
    }
};

const es: TranslatedTierListHubCopy = {
    language: "es",
    htmlLang: "es",
    openGraphLocale: "es_ES",
    languageName: "Español",
    metaTitle: "Tier List de Animales: Los Más Rápidos, Fuertes e Inteligentes",
    metaDescription: (leaders) =>
        `Tier list de animales del tier S al D. Más rápido: ${leaders.fastest}. Más fuerte: ${leaders.strongest}. Más inteligente: ${leaders.smartest}. Más peligroso: ${leaders.dangerous}.`,
    eyebrow: "Tier lists de AnimalDex",
    title: "Tier list de animales: los más rápidos, fuertes e inteligentes",
    introTitle: "¿Qué es una tier list de animales?",
    intro: [
        "Una tier list de animales ordena las especies en niveles en lugar de darles una sola puntuación: el tier S reúne a los mejores absolutos y los tiers A, B, C y D agrupan a los animales que encajan cada vez menos en el criterio. Es un formato más honesto que un simple top 10, porque muestra cuándo varios animales están prácticamente empatados.",
        "Cada tier list de AnimalDex clasifica 100 o más especies según un solo criterio —velocidad, fuerza, inteligencia, peligro, agilidad, adaptabilidad y más— y explica la metodología detrás del orden. Las respuestas rápidas de abajo salen de los mismos datos que las listas completas."
    ],
    englishNotice: "Las listas completas están en inglés, y los nombres de las especies aparecen en inglés.",
    quickAnswersTitle: "Respuestas rápidas",
    quickAnswersDescription: "El número 1 de cada tier list destacada, con los dos siguientes.",
    followedBy: (second, third) => `Le siguen ${second} y ${third}`,
    viewList: "Ver la tier list completa",
    allListsTitle: "Todas las tier lists",
    allListsDescription: "Filtra por categoría o busca por el nombre de la lista. Cada tarjeta abre la tier list completa en inglés.",
    filterAll: "Todas",
    searchLabel: "Buscar tier lists",
    resultSingular: "tier list",
    resultPlural: "tier lists",
    viewRanking: "Ver ranking",
    rankedSpeciesLabel: "Especies clasificadas",
    methodLabel: "Método",
    cardDescription: (categoryLabel, count) =>
        `Ranking de ${categoryLabel.toLowerCase()} con ${count} especies, ordenado del tier S al D.`,
    methodologyTitle: "Cómo funcionan los rankings de AnimalDex",
    methodologyDescription:
        "Cada tier list usa señales biológicas distintas: velocidad registrada, fuerza relativa, tamaño corporal, fuerza de mordida, cognición observada y riesgo documentado. Son señales útiles, pero no intercambiables, por eso cada lista explica qué está midiendo.",
    faqTitle: "Preguntas frecuentes sobre la tier list de animales",
    faqAnswer: (first, second, third, listName) =>
        `${first} ocupa el puesto número 1 en la tier list de ${listName} de AnimalDex, seguido de ${second} y ${third}.`,
    otherLanguages: "Esta página en otros idiomas",
    lists: {
        "fastest-animals": {
            label: "Animal más rápido",
            question: "¿Cuál es el animal más rápido del mundo?",
            listName: "animales más rápidos",
            note: "La velocidad en el aire, en tierra y en el agua se trata como preguntas distintas, así que el picado de un halcón no se compara directamente con una carrera en tierra."
        },
        "strongest-animals": {
            label: "Animal más fuerte",
            question: "¿Cuál es el animal más fuerte del mundo?",
            listName: "animales más fuertes",
            note: "La lista pondera el tamaño corporal, la fuerza aplicada y el uso real de esa fuerza en la naturaleza."
        },
        "smartest-animals": {
            label: "Animal más inteligente",
            question: "¿Cuál es el animal más inteligente del mundo?",
            listName: "animales más inteligentes",
            note: "La inteligencia social, el uso de herramientas, la comunicación y la resolución de problemas se valoran juntos, sin fingir que existe un único coeficiente intelectual para todos los animales."
        },
        "most-dangerous-animals": {
            label: "Animal más peligroso",
            question: "¿Cuál es el animal más peligroso del mundo?",
            listName: "animales más peligrosos",
            note: "El peligro se basa en el riesgo documentado para las personas, que depende del contexto del encuentro, la región y la exposición."
        },
        "most-agile-animals": {
            label: "Animal más ágil",
            question: "¿Cuál es el animal más ágil del mundo?",
            listName: "animales más ágiles",
            note: "Aquí, agilidad significa control del cuerpo, cambios de dirección y maniobras a gran velocidad."
        },
        "most-adaptable-animals": {
            label: "Animal más adaptable",
            question: "¿Cuál es el animal más adaptable del mundo?",
            listName: "animales más adaptables",
            note: "La adaptabilidad mide la capacidad de prosperar en hábitats muy distintos, incluidos los entornos modificados por el ser humano."
        }
    },
    categories: {
        speed: "Velocidad",
        strength: "Fuerza",
        size: "Tamaño",
        intelligence: "Inteligencia",
        danger: "Peligro",
        agility: "Agilidad",
        bite_force: "Fuerza de mordida",
        endurance: "Resistencia",
        hunting: "Caza",
        eyesight: "Vista",
        resilience: "Resiliencia",
        armor: "Armadura",
        stealth: "Sigilo",
        teamwork: "Trabajo en equipo",
        adaptability: "Adaptabilidad",
        camouflage: "Camuflaje",
        strike: "Ataque",
        invasive: "Especies invasoras",
        reproduction: "Reproducción",
        reputation: "Reputación",
        rarity: "Rareza",
        fatality: "Letalidad",
        culture: "Cultura",
        communication: "Comunicación",
        character: "Carácter"
    }
};

const fr: TranslatedTierListHubCopy = {
    language: "fr",
    htmlLang: "fr",
    openGraphLocale: "fr_FR",
    languageName: "Français",
    metaTitle: "Tier List des Animaux : les plus rapides, forts et intelligents",
    metaDescription: (leaders) =>
        `Tier list des animaux du tier S au tier D. Le plus rapide : ${leaders.fastest}. Le plus fort : ${leaders.strongest}. Le plus intelligent : ${leaders.smartest}. Le plus dangereux : ${leaders.dangerous}.`,
    eyebrow: "Tier lists AnimalDex",
    title: "Tier list des animaux : les plus rapides, forts et intelligents",
    introTitle: "Qu’est-ce qu’une tier list des animaux ?",
    intro: [
        "Une tier list des animaux classe les espèces par paliers plutôt qu’avec une seule note : le tier S regroupe les champions absolus, puis les tiers A, B, C et D rassemblent les animaux qui correspondent de moins en moins au critère. Ce format est plus honnête qu’un simple top 10, car il montre quand plusieurs animaux sont pratiquement à égalité.",
        "Chaque tier list AnimalDex classe 100 espèces ou plus selon un seul critère — vitesse, force, intelligence, danger, agilité, adaptabilité et bien d’autres — et explique la méthodologie derrière l’ordre. Les réponses rapides ci-dessous proviennent des mêmes données que les listes complètes."
    ],
    englishNotice: "Les listes complètes sont en anglais, et les noms des espèces restent en anglais.",
    quickAnswersTitle: "Réponses rapides",
    quickAnswersDescription: "Le numéro 1 de chaque tier list phare, avec les deux suivants.",
    followedBy: (second, third) => `Suivi de ${second} et ${third}`,
    viewList: "Voir la tier list complète",
    allListsTitle: "Toutes les tier lists",
    allListsDescription: "Filtrez par catégorie ou cherchez une liste par son nom. Chaque carte ouvre la tier list complète en anglais.",
    filterAll: "Toutes",
    searchLabel: "Rechercher une tier list",
    resultSingular: "tier list",
    resultPlural: "tier lists",
    viewRanking: "Voir le classement",
    rankedSpeciesLabel: "Espèces classées",
    methodLabel: "Méthode",
    cardDescription: (categoryLabel, count) =>
        `Classement par ${categoryLabel.toLowerCase()} de ${count} espèces, du tier S au tier D.`,
    methodologyTitle: "Comment fonctionnent les classements AnimalDex",
    methodologyDescription:
        "Chaque tier list s’appuie sur des signaux biologiques différents : vitesse mesurée, force relative, taille du corps, force de morsure, cognition observée et risque documenté. Ces signaux sont utiles mais pas interchangeables, c’est pourquoi chaque liste précise ce qu’elle mesure.",
    faqTitle: "Questions fréquentes sur la tier list des animaux",
    faqAnswer: (first, second, third, listName) =>
        `${first} est numéro 1 de la tier list AnimalDex des ${listName}, suivi de ${second} et ${third}.`,
    otherLanguages: "Cette page dans d’autres langues",
    lists: {
        "fastest-animals": {
            label: "Animal le plus rapide",
            question: "Quel est l’animal le plus rapide du monde ?",
            listName: "animaux les plus rapides",
            note: "La vitesse dans les airs, sur terre et dans l’eau est traitée comme trois questions différentes : le piqué d’un faucon n’est pas comparé directement à une course au sol."
        },
        "strongest-animals": {
            label: "Animal le plus fort",
            question: "Quel est l’animal le plus fort du monde ?",
            listName: "animaux les plus forts",
            note: "Le classement tient compte de la taille du corps, de la force produite et de l’usage réel de cette force dans la nature."
        },
        "smartest-animals": {
            label: "Animal le plus intelligent",
            question: "Quel est l’animal le plus intelligent du monde ?",
            listName: "animaux les plus intelligents",
            note: "Intelligence sociale, usage d’outils, communication et résolution de problèmes sont évalués ensemble, sans prétendre qu’un QI unique s’applique à tous les animaux."
        },
        "most-dangerous-animals": {
            label: "Animal le plus dangereux",
            question: "Quel est l’animal le plus dangereux du monde ?",
            listName: "animaux les plus dangereux",
            note: "Le danger repose sur le risque documenté pour l’humain, qui dépend du contexte de la rencontre, de la région et de l’exposition."
        },
        "most-agile-animals": {
            label: "Animal le plus agile",
            question: "Quel est l’animal le plus agile du monde ?",
            listName: "animaux les plus agiles",
            note: "Ici, l’agilité désigne le contrôle du corps, les changements de direction et les manœuvres à grande vitesse."
        },
        "most-adaptable-animals": {
            label: "Animal le plus adaptable",
            question: "Quel est l’animal le plus adaptable du monde ?",
            listName: "animaux les plus adaptables",
            note: "L’adaptabilité mesure la capacité à prospérer dans des habitats très variés, y compris les milieux transformés par l’humain."
        }
    },
    categories: {
        speed: "Vitesse",
        strength: "Force",
        size: "Taille",
        intelligence: "Intelligence",
        danger: "Danger",
        agility: "Agilité",
        bite_force: "Force de morsure",
        endurance: "Endurance",
        hunting: "Chasse",
        eyesight: "Vue",
        resilience: "Résilience",
        armor: "Armure",
        stealth: "Discrétion",
        teamwork: "Travail d’équipe",
        adaptability: "Adaptabilité",
        camouflage: "Camouflage",
        strike: "Frappe",
        invasive: "Espèces invasives",
        reproduction: "Reproduction",
        reputation: "Réputation",
        rarity: "Rareté",
        fatality: "Létalité",
        culture: "Culture",
        communication: "Communication",
        character: "Caractère"
    }
};

export const translatedTierListHubs: Record<TranslatedTierListHubLanguage, TranslatedTierListHubCopy> = {pt, es, fr};

export function getTranslatedTierListHub(language: TranslatedTierListHubLanguage) {
    return translatedTierListHubs[language];
}

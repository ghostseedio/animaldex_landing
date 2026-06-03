const {mkdirSync, readFileSync, writeFileSync} = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const moduleCache = new Map();

const FLAGSHIP_CANDIDATES = [
    "Harpy Eagle",
    "Cockroach",
    "Anglerfish",
    "Alligator Snapping Turtle",
    "Barn Owl",
    "Bald Eagle",
    "Snowy Owl",
    "Great Horned Owl",
    "Komodo Dragon",
    "Polar Bear",
    "Orangutan",
    "Cheetah",
    "White Rhinoceros",
    "Black Rhinoceros",
    "Octopus",
    "Wandering Albatross",
    "Pigeon",
    "Goose",
    "Dolphin",
    "Gorilla",
    "Shark",
    "Elephant",
    "Axolotl",
    "Kookaburra"
];

const SEARCH_DEMAND_SCORE = {
    "shark": 10,
    "elephant": 10,
    "gorilla": 9,
    "dolphin": 9,
    "octopus": 9,
    "cheetah": 8,
    "polar-bear": 8,
    "cockroach": 8,
    "anglerfish": 7,
    "harpy-eagle": 7,
    "kookaburra": 6,
    "alligator-snapping-turtle": 6
};

function resolveLocalModulePath(fromFile, specifier) {
    if (specifier.startsWith("@/")) {
        return path.resolve(process.cwd(), "src", `${specifier.slice(2)}.ts`);
    }
    if (specifier.startsWith(".")) {
        return path.resolve(path.dirname(fromFile), `${specifier}.ts`);
    }
    return null;
}

function loadTsModule(filePath) {
    const normalizedPath = path.normalize(filePath);
    if (moduleCache.has(normalizedPath)) {
        return moduleCache.get(normalizedPath);
    }
    const source = readFileSync(normalizedPath, "utf8");
    const transpiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true
        },
        fileName: normalizedPath
    });
    const module = {exports: {}};
    moduleCache.set(normalizedPath, module.exports);
    const localRequire = (specifier) => {
        const localPath = resolveLocalModulePath(normalizedPath, specifier);
        return localPath ? loadTsModule(localPath) : require(specifier);
    };
    const runner = new Function("require", "module", "exports", "__filename", "__dirname", transpiled.outputText);
    runner(localRequire, module, module.exports, normalizedPath, path.dirname(normalizedPath));
    moduleCache.set(normalizedPath, module.exports);
    return module.exports;
}

function toSlug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function table(headers, rows) {
    return [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.join(" | ")} |`)
    ].join("\n");
}

function parseArgs(argv) {
    const args = {out: "docs/seo/animaldex-flagship-gap-report.md"};
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === "--out" && argv[index + 1]) {
            args.out = argv[index + 1];
            index += 1;
        }
    }
    return args;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const {speciesEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/species.ts"));
    const {speciesSystemsIntelligence} = loadTsModule(path.resolve(process.cwd(), "src/data/species-systems-intelligence.ts"));
    const {getBehavioralPrincipleProfile} = loadTsModule(path.resolve(process.cwd(), "src/data/species-behavioral-principles.ts"));

    const speciesBySlug = new Map(speciesEntries.map((entry) => [entry.slug, entry]));
    const existingNames = new Set(speciesEntries.map((entry) => entry.name.toLowerCase()));

    const ranked = FLAGSHIP_CANDIDATES.map((name) => {
        const slug = toSlug(name);
        const existing = speciesBySlug.get(slug);
        const profile = existing
            ? getBehavioralPrincipleProfile(existing.slug, speciesSystemsIntelligence[existing.slug], speciesSystemsIntelligence)
            : null;

        const searchDemand = SEARCH_DEMAND_SCORE[slug] ?? 7;
        const principleValue = profile
            ? ["Memory", "Observation", "Adaptability", "Teamwork", "Communication"].includes(profile.principle) ? 9 : 7
            : 8;
        const brandFit = /(owl|eagle|shark|elephant|dolphin|gorilla|cheetah|octopus|rhino|bear)/.test(slug) ? 9 : 7;

        const relatedToken = slug.split("-").find((token) => {
            if (token.length < 4) return false;
            return Array.from(existingNames).some((item) => item.includes(token));
        });
        const contentReadiness = existing ? 10 : relatedToken ? 7 : 5;
        const gapBoost = existing ? 0 : 2;
        const weightedScore = Number(((searchDemand * 0.35) + (principleValue * 0.25) + (brandFit * 0.25) + (contentReadiness * 0.15) + gapBoost).toFixed(2));

        return {
            name,
            slug,
            status: existing ? "Present" : "Missing",
            principle: profile?.principle ?? "TBD",
            searchDemand,
            principleValue,
            brandFit,
            contentReadiness,
            weightedScore,
            recommendation: existing
                ? "Keep optimized; improve internal links and principle polish."
                : "High-priority species page candidate."
        };
    }).sort((a, b) => b.weightedScore - a.weightedScore);

    const lines = [];
    lines.push("# AnimalDex Flagship Species Gap Report");
    lines.push("");
    lines.push(`_Generated: ${new Date().toISOString()}_`);
    lines.push("");
    lines.push("## Ranking Model");
    lines.push("");
    lines.push("- Score dimensions: Search demand, Principle value, Brand fit, Content readiness.");
    lines.push("- Weighted formula: `0.35*search + 0.25*principle + 0.25*brand + 0.15*readiness + gapBoost`.");
    lines.push("- `gapBoost` favors missing species to prioritize expansion opportunities.");
    lines.push("");
    lines.push("## Ranked Opportunities");
    lines.push("");
    lines.push(table(
        ["Rank", "Animal", "Slug", "Status", "Principle", "Search", "Principle Value", "Brand Fit", "Readiness", "Weighted", "Recommendation"],
        ranked.map((item, index) => [
            String(index + 1),
            item.name,
            `\`${item.slug}\``,
            item.status,
            item.principle,
            String(item.searchDemand),
            String(item.principleValue),
            String(item.brandFit),
            String(item.contentReadiness),
            String(item.weightedScore),
            item.recommendation
        ])
    ));
    lines.push("");
    lines.push("## Priority Direction");
    lines.push("");
    lines.push("- First: keep 100% principle coverage quality high across existing species.");
    lines.push("- Second: add missing flagship species with highest weighted score.");
    lines.push("- Third: wire each new flagship into principle hubs and animal-page semantic clusters on publish.");

    const outPath = path.resolve(process.cwd(), args.out);
    mkdirSync(path.dirname(outPath), {recursive: true});
    writeFileSync(outPath, lines.join("\n"), "utf8");
    console.log(`Generated ${outPath}`);
}

main();

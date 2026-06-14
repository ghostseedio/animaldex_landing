const {existsSync, mkdirSync, readFileSync, writeFileSync} = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const moduleCache = new Map();

const FLAGSHIP_SLUGS = new Set([
    "harpy-eagle", "cockroach", "anglerfish", "alligator-snapping-turtle", "barn-owl", "bald-eagle",
    "snowy-owl", "great-horned-owl", "komodo-dragon", "polar-bear", "orangutan", "sumatran-orangutan",
    "cheetah", "white-rhinoceros", "black-rhinoceros", "octopus", "wandering-albatross", "pigeon",
    "goose", "dolphin", "gorilla", "shark", "elephant", "african-bush-elephant", "axolotl", "kookaburra",
    "lion", "tiger", "wolf", "crow", "blue-ringed-octopus", "beluga-whale", "indus-river-dolphin",
    "lionfish", "spotted-winged-antlion", "tiger-salamander", "chameleon", "crocodile", "jellyfish",
    "firefly", "eagle", "fox", "cat", "snake", "raven", "dragonfly", "sea-turtle", "giant-tortoise",
    "carp", "otter", "leopard", "rhino"
]);

const MEGA_FAUNA = [
    "lion", "tiger", "bear", "wolf", "eagle", "owl", "shark", "dolphin", "elephant", "gorilla",
    "orangutan", "rhino", "rhinoceros", "cheetah", "fox", "penguin", "whale", "octopus", "crocodile",
    "alligator", "hippopotamus", "giraffe", "deer", "cat", "chameleon", "jellyfish", "snake", "raven",
    "leopard", "sea-turtle", "giant-tortoise"
];

const SYMBOLISM_KEYWORDS = [
    "eagle", "owl", "shark", "dolphin", "elephant", "gorilla", "tiger", "lion", "wolf", "bear",
    "rhino", "rhinoceros", "octopus", "cheetah", "orangutan", "komodo", "albatross", "axolotl",
    "kookaburra", "whale", "dragon", "cat", "fox", "chameleon", "crocodile", "jellyfish", "firefly",
    "snake", "raven", "dragonfly", "carp", "sea-turtle", "giant-tortoise", "leopard", "otter"
];

const CLUSTER_PRINCIPLES = new Set([
    "Memory", "Observation", "Teamwork", "Adaptability", "Endurance", "Precision",
    "Stealth", "Communication", "Resilience", "Efficiency"
]);

function readEnvFile(filePath) {
    if (!existsSync(filePath)) {
        return;
    }

    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) {
            continue;
        }
        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}

function parseArgs(argv) {
    const args = {
        csvOut: "docs/seo/behavior-lessons-backfill-priority.csv",
        mdOut: "docs/seo/behavior-lessons-backfill-priority.md"
    };

    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === "--csv-out" && argv[index + 1]) {
            args.csvOut = argv[index + 1];
            index += 1;
        } else if (argv[index] === "--md-out" && argv[index + 1]) {
            args.mdOut = argv[index + 1];
            index += 1;
        }
    }

    return args;
}

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
    const localRequire = (specifier) => {
        const localPath = resolveLocalModulePath(normalizedPath, specifier);
        return localPath ? loadTsModule(localPath) : require(specifier);
    };

    const runner = new Function("require", "module", "exports", "__filename", "__dirname", transpiled.outputText);
    runner(localRequire, module, module.exports, normalizedPath, path.dirname(normalizedPath));
    moduleCache.set(normalizedPath, module.exports);
    return module.exports;
}

function getSupabaseConfig() {
    const {getSupabaseUrl, getSupabaseServerReadKey, getSupabaseHeaders} = loadTsModule(
        path.resolve(process.cwd(), "src/lib/supabase-http.ts")
    );
    const supabaseUrl = getSupabaseUrl();
    const key = getSupabaseServerReadKey();

    if (!supabaseUrl || !key) {
        return null;
    }

    return {supabaseUrl, headers: getSupabaseHeaders(key)};
}

async function fetchCatalogSlugsWithLessons(config) {
    const rows = [];
    let offset = 0;

    while (true) {
        const searchParams = new URLSearchParams({
            select: "landing_page_slug",
            core_lesson: "not.is.null",
            landing_page_slug: "not.is.null",
            limit: "1000",
            offset: String(offset)
        });

        const response = await fetch(`${config.supabaseUrl}/rest/v1/species_catalog_v1?${searchParams.toString()}`, {
            headers: config.headers
        });

        if (!response.ok) {
            throw new Error(`Catalog fetch failed (${response.status})`);
        }

        const batch = await response.json();
        if (!Array.isArray(batch) || batch.length === 0) {
            break;
        }

        rows.push(...batch);
        if (batch.length < 1000) {
            break;
        }
        offset += 1000;
    }

    return new Set(rows.map((row) => row.landing_page_slug).filter(Boolean));
}

function normalizeIdentityKey(slug) {
    return slug.trim().toLowerCase();
}

function roleTitleToPrincipleName(roleTitle) {
    return roleTitle
        .replace(/^The\s+/i, "")
        .replace(/\s+(Engine|Platform|Turret|Regulator|Analyst|Network|Array|Computer|Commander|Pilot|Adapter|Hardware|System|Specialist|Controller|Protocol|Navigator|Monitor|Frog|Cat|Bird|Fish|Crab|Turtle|Monkey|Bear|Wolf|Dragon|Shark|Whale|Owl|Eagle|Array)$/i, "")
        .trim();
}

function titleCaseWords(value) {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function buildPrincipleName(entry, profile, systemsEntry) {
    if (profile.source === "manual") {
        return profile.principle;
    }

    if (systemsEntry?.roleTitle) {
        const fromRole = roleTitleToPrincipleName(systemsEntry.roleTitle);
        if (fromRole.length >= 4 && fromRole.length <= 40) {
            return titleCaseWords(fromRole);
        }
    }

    if (!CLUSTER_PRINCIPLES.has(profile.principle)) {
        return profile.principle;
    }

    const categoryToken = entry.analysis.category.split(/\s+/)[0];
    return titleCaseWords(`${categoryToken} ${profile.principle}`);
}

function buildPrincipleExpression(profile) {
    if (profile.principleExpression) {
        return profile.principleExpression;
    }

    return buildPrincipleExpressionFromMotto(profile.motto, profile.coreLesson);
}

function buildPrincipleExpressionFromMotto(motto, coreLesson) {
    if (motto && motto.length <= 90) {
        return motto.endsWith(".") ? motto : `${motto}.`;
    }

    const trimmed = coreLesson.trim();
    if (trimmed.length <= 90) {
        return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
    }

    return `${trimmed.slice(0, 87).trim()}...`;
}

function scorePriority(entry, profile, systemsEntry) {
    const reasons = [];
    let score = 0;
    const slug = entry.slug;
    const label = `${entry.name} ${slug}`.toLowerCase();

    if (FLAGSHIP_SLUGS.has(slug)) {
        score += 40;
        reasons.push("flagship");
    }

    for (const keyword of MEGA_FAUNA) {
        if (slug.includes(keyword) || entry.name.toLowerCase().includes(keyword)) {
            score += 18;
            reasons.push(`mega-fauna:${keyword}`);
            break;
        }
    }

    for (const keyword of SYMBOLISM_KEYWORDS) {
        if (slug.includes(keyword) || label.includes(keyword)) {
            score += 10;
            reasons.push(`symbolism:${keyword}`);
            break;
        }
    }

    const symbolismIntents = entry.searchIntents.filter((value) => /(meaning|symbolism|spiritual|lesson|archetype)/i.test(value)).length;
    if (symbolismIntents > 0) {
        score += Math.min(12, symbolismIntents * 4);
        reasons.push(`symbolism-intent:${symbolismIntents}`);
    }

    if (profile.source === "manual") {
        score += 15;
        reasons.push("curated-draft");
    } else if (systemsEntry) {
        score += 10;
        reasons.push("systems-intelligence");
    } else {
        score += 4;
        reasons.push("inferred-only");
    }

    if (entry.analysis.rarityScore <= 70) {
        score += 4;
        reasons.push("common-species");
    }

    if (/(mammal|bird|reptile|fish|amphibian|primate)/i.test(entry.analysis.category)) {
        score += 3;
        reasons.push("core-taxa");
    }

    return {score, reasons};
}

function priorityTier(score) {
    if (score >= 70) {
        return "P0";
    }
    if (score >= 50) {
        return "P1";
    }
    if (score >= 30) {
        return "P2";
    }
    return "P3";
}

function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
}

function table(headers, rows) {
    return [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, "\\|")).join(" | ")} |`)
    ].join("\n");
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    readEnvFile(path.resolve(process.cwd(), ".env.local"));
    readEnvFile(path.resolve(process.cwd(), ".env"));

    const config = getSupabaseConfig();
    if (!config) {
        throw new Error("Missing Supabase config");
    }

    const {speciesEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/species.ts"));
    const {speciesSystemsIntelligence} = loadTsModule(path.resolve(process.cwd(), "src/data/species-systems-intelligence.ts"));
    const {getBehavioralPrincipleProfile} = loadTsModule(path.resolve(process.cwd(), "src/data/species-behavioral-principles.ts"));

    const catalogSlugs = await fetchCatalogSlugsWithLessons(config);
    const missing = speciesEntries
        .filter((entry) => !catalogSlugs.has(entry.slug))
        .map((entry) => {
            const systemsEntry = speciesSystemsIntelligence[entry.slug] ?? null;
            const profile = getBehavioralPrincipleProfile(entry.slug, systemsEntry, speciesSystemsIntelligence);
            const priority = scorePriority(entry, profile, systemsEntry);
            const principleName = buildPrincipleName(entry, profile, systemsEntry);
            const editorialNote = profile.source === "manual"
                ? "Curated manual profile from species-behavioral-principles.ts; review before catalog import."
                : systemsEntry
                    ? "Draft from systems intelligence; refine principle_name and biological_basis before import."
                    : "Inferred draft only; prioritize editorial rewrite before import.";

            return {
                entry,
                profile,
                systemsEntry,
                priority,
                principleName,
                editorialNote
            };
        })
        .sort((left, right) => right.priority.score - left.priority.score || left.entry.name.localeCompare(right.entry.name));

    const csvHeaders = [
        "priority_rank",
        "priority_tier",
        "priority_score",
        "priority_reasons",
        "landing_page_slug",
        "normalized_identity_key",
        "display_name",
        "scientific_name",
        "principle_name",
        "principle_expression",
        "core_lesson",
        "biological_basis",
        "short_motto",
        "best_use_cases",
        "draft_source",
        "draft_quality_flag",
        "editorial_note",
        "suggested_import_source"
    ];

    const csvRows = missing.map((item, index) => {
        const {entry, profile, priority, principleName, editorialNote} = item;

        return [
            index + 1,
            priorityTier(priority.score),
            priority.score,
            priority.reasons.join("; "),
            entry.slug,
            entry.normalizedIdentityKey ?? normalizeIdentityKey(entry.slug),
            entry.name,
            entry.analysis.scientificName,
            principleName,
            buildPrincipleExpression(profile),
            profile.coreLesson,
            profile.biologicalBasis,
            profile.motto,
            JSON.stringify(profile.bestFor),
            profile.source,
            profile.source === "manual" ? "curated" : item.systemsEntry ? "systems_intelligence" : "inferred",
            editorialNote,
            "manual_website_gap_backfill_v1"
        ];
    });

    const csvPath = path.resolve(process.cwd(), args.csvOut);
    mkdirSync(path.dirname(csvPath), {recursive: true});
    writeFileSync(
        csvPath,
        [csvHeaders.join(","), ...csvRows.map((row) => row.map(csvEscape).join(","))].join("\n"),
        "utf8"
    );

    const tierCounts = {P0: 0, P1: 0, P2: 0, P3: 0};
    for (const item of missing) {
        tierCounts[priorityTier(item.priority.score)] += 1;
    }

    const mdLines = [];
    mdLines.push("# Behavior Lessons Backfill Priority");
    mdLines.push("");
    mdLines.push(`_Generated: ${new Date().toISOString()}_`);
    mdLines.push("");
    mdLines.push("## Summary");
    mdLines.push("");
    mdLines.push(`- Website species missing DB lesson rows: **${missing.length}**`);
    mdLines.push(`- CSV output: \`${args.csvOut}\``);
    mdLines.push(`- Suggested import source tag: \`manual_website_gap_backfill_v1\``);
    mdLines.push("");
    mdLines.push("| Tier | Count | Guidance |");
    mdLines.push("| --- | ---: | --- |");
    mdLines.push(`| P0 | ${tierCounts.P0} | Import first: flagship / high-intent symbolism / mega-fauna |`);
    mdLines.push(`| P1 | ${tierCounts.P1} | Second wave after P0 review |`);
    mdLines.push(`| P2 | ${tierCounts.P2} | Batch editorial pass |`);
    mdLines.push(`| P3 | ${tierCounts.P3} | Lower urgency generic archetypes |`);
    mdLines.push("");
    mdLines.push("## Top 20 Priority Rows");
    mdLines.push("");
    mdLines.push(table(
        ["Rank", "Tier", "Score", "Animal", "Slug", "Draft principle", "Draft source"],
        missing.slice(0, 20).map((item, index) => [
            String(index + 1),
            priorityTier(item.priority.score),
            String(item.priority.score),
            item.entry.name,
            `\`${item.entry.slug}\``,
            item.principleName,
            item.profile.source
        ])
    ));
    mdLines.push("");
    mdLines.push("## CSV Columns");
    mdLines.push("");
    mdLines.push("- `priority_*`: editorial queue ordering only; not imported to Supabase.");
    mdLines.push("- `principle_name` through `best_use_cases`: draft payload for `species_behavior_principles`.");
    mdLines.push("- Manual profiles come from `src/data/species-behavioral-principles.ts`.");
    mdLines.push("- Review species-specific `principle_name` values before import.");
    mdLines.push("- Join to catalog by `landing_page_slug` / `normalized_identity_key` when inserting behavior rows.");

    const mdPath = path.resolve(process.cwd(), args.mdOut);
    writeFileSync(mdPath, mdLines.join("\n"), "utf8");

    console.log(`Generated ${csvPath}`);
    console.log(`Generated ${mdPath}`);
    console.log(`Rows: ${missing.length} (P0=${tierCounts.P0}, P1=${tierCounts.P1}, P2=${tierCounts.P2}, P3=${tierCounts.P3})`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

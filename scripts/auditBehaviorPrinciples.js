const {existsSync, readFileSync} = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

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

readEnvFile(path.resolve(process.cwd(), ".env.local"));
readEnvFile(path.resolve(process.cwd(), ".env"));

const moduleCache = new Map();

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

async function fetchAll(config, endpoint) {
    const rows = [];
    let offset = 0;

    while (true) {
        const separator = endpoint.includes("?") ? "&" : "?";
        const response = await fetch(
            `${config.supabaseUrl}${endpoint}${separator}limit=1000&offset=${offset}`,
            {headers: config.headers}
        );

        if (!response.ok) {
            throw new Error(`Fetch failed (${response.status}): ${endpoint}`);
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

    return rows;
}

async function main() {
    const config = getSupabaseConfig();
    if (!config) {
        console.error("Missing Supabase config");
        process.exit(1);
    }

    const {speciesEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/species.ts"));
    const {speciesSystemsIntelligence} = loadTsModule(path.resolve(process.cwd(), "src/data/species-systems-intelligence.ts"));
    const {getBehavioralPrincipleProfile} = loadTsModule(path.resolve(process.cwd(), "src/data/species-behavioral-principles.ts"));

    const [principles, catalog] = await Promise.all([
        fetchAll(config, "/rest/v1/species_behavior_principles?select=principle_name,source,core_lesson,species_profile_id"),
        fetchAll(config, "/rest/v1/species_catalog_v1?select=landing_page_slug,normalized_identity_key,display_name,principle_name,core_lesson,short_motto,biological_basis,principle_expression,best_use_cases")
    ]);

    const bySource = {};
    for (const row of principles) {
        bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    }

    const bySlug = new Map();
    for (const row of catalog) {
        if (row.landing_page_slug) {
            bySlug.set(row.landing_page_slug, row);
        }
        if (row.normalized_identity_key) {
            bySlug.set(row.normalized_identity_key.replace(/_/g, "-"), row);
        }
    }

    let websiteWithDbCore = 0;
    let principleMismatch = 0;
    const mismatchSamples = [];

    for (const entry of speciesEntries) {
        const dbRow = bySlug.get(entry.slug);
        const localProfile = getBehavioralPrincipleProfile(
            entry.slug,
            speciesSystemsIntelligence[entry.slug],
            speciesSystemsIntelligence
        );

        if (dbRow?.core_lesson) {
            websiteWithDbCore += 1;
        }

        if (dbRow?.principle_name && localProfile && dbRow.principle_name !== localProfile.principle && mismatchSamples.length < 10) {
            principleMismatch += 1;
            mismatchSamples.push({
                slug: entry.slug,
                name: entry.name,
                dbPrinciple: dbRow.principle_name,
                localPrinciple: localProfile.principle,
                dbCoreLesson: dbRow.core_lesson,
                localCoreLesson: localProfile.coreLesson
            });
        } else if (dbRow?.principle_name && localProfile && dbRow.principle_name !== localProfile.principle) {
            principleMismatch += 1;
        }
    }

    const websiteSlugs = new Set(speciesEntries.map((entry) => entry.slug));
    const dbLessonsMissingWebsite = catalog.filter(
        (row) => row.core_lesson && row.landing_page_slug && !websiteSlugs.has(row.landing_page_slug)
    );

    console.log(JSON.stringify({
        db: {
            speciesBehaviorPrinciplesRows: principles.length,
            speciesBehaviorPrinciplesWithCoreLesson: principles.filter((row) => row.core_lesson).length,
            uniquePrincipleNames: new Set(principles.map((row) => row.principle_name).filter(Boolean)).size,
            sourceBreakdown: bySource,
            catalogRows: catalog.length,
            catalogWithPrinciple: catalog.filter((row) => row.principle_name).length,
            catalogWithCoreLesson: catalog.filter((row) => row.core_lesson).length
        },
        website: {
            speciesCount: speciesEntries.length,
            speciesWithDbCoreLesson: websiteWithDbCore,
            speciesMissingDbCoreLesson: speciesEntries.length - websiteWithDbCore,
            principleNameMismatchesVsLocalInference: principleMismatch
        },
        gap: {
            dbLessonsMissingWebsitePage: dbLessonsMissingWebsite.length
        },
        samples: {
            mismatches: mismatchSamples,
            missingWebsitePages: dbLessonsMissingWebsite.slice(0, 8).map((row) => ({
                slug: row.landing_page_slug,
                name: row.display_name,
                principle: row.principle_name
            })),
            websiteMissingDb: speciesEntries
                .filter((entry) => !bySlug.get(entry.slug)?.core_lesson)
                .slice(0, 8)
                .map((entry) => entry.slug)
        }
    }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

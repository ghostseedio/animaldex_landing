const {readFileSync} = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const moduleCache = new Map();

function readEnvFile(filePath) {
    const raw = readFileSync(filePath, "utf8");

    for (const line of raw.split(/\r?\n/)) {
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

        if (localPath) {
            return loadTsModule(localPath);
        }

        return require(specifier);
    };

    const runner = new Function("require", "module", "exports", "__filename", "__dirname", transpiled.outputText);
    runner(localRequire, module, module.exports, normalizedPath, path.dirname(normalizedPath));

    moduleCache.set(normalizedPath, module.exports);

    return module.exports;
}

async function main() {
    readEnvFile(path.resolve(process.cwd(), ".env"));

    const {speciesDescriptors} = loadTsModule(path.resolve(process.cwd(), "src/data/species-descriptors.ts"));
    const {speciesSubtitleStories} = loadTsModule(path.resolve(process.cwd(), "src/data/species-subtitle-stories.ts"));
    const {getSupabaseHeaders, normalizeSupabaseUrl} = loadTsModule(path.resolve(process.cwd(), "src/lib/supabase-http.ts"));

    const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
    }

    const countResponse = await fetch(`${supabaseUrl}/rest/v1/species_subtitles?select=slug&locale=eq.en`, {
        headers: getSupabaseHeaders(serviceKey, {Prefer: "count=exact"})
    });

    if (!countResponse.ok) {
        throw new Error(`Count query failed with ${countResponse.status}: ${await countResponse.text()}`);
    }

    const samples = [
        "tawny-owl",
        "three-toed-sloth",
        "komodo-dragon",
        "barn-owl",
        "aardvark",
        "giant-panda"
    ];

    const searchParams = new URLSearchParams({
        select: "slug,descriptor,subtitle_story,updated_at",
        locale: "eq.en",
        slug: `in.(${samples.join(",")})`,
        order: "slug.asc"
    });

    const sampleResponse = await fetch(`${supabaseUrl}/rest/v1/species_subtitles?${searchParams.toString()}`, {
        headers: getSupabaseHeaders(serviceKey)
    });

    if (!sampleResponse.ok) {
        throw new Error(`Sample query failed with ${sampleResponse.status}: ${await sampleResponse.text()}`);
    }

    const rows = await sampleResponse.json();
    const comparison = rows.map((row) => ({
        slug: row.slug,
        descriptorMatches: row.descriptor === speciesDescriptors[row.slug],
        subtitleMatches: row.subtitle_story === speciesSubtitleStories[row.slug],
        updatedAt: row.updated_at,
        subtitlePreview: row.subtitle_story.slice(0, 140)
    }));

    console.log(JSON.stringify({
        contentRange: countResponse.headers.get("content-range"),
        sampleCount: rows.length,
        comparisons: comparison
    }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});

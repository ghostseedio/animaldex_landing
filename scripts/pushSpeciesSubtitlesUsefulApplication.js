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

function chunk(array, size) {
    const output = [];

    for (let index = 0; index < array.length; index += size) {
        output.push(array.slice(index, index + size));
    }

    return output;
}

async function main() {
    const envPath = path.resolve(process.cwd(), ".env");
    readEnvFile(envPath);

    const {speciesDescriptors} = loadTsModule(path.resolve(process.cwd(), "src/data/species-descriptors.ts"));
    const {speciesSubtitleStories} = loadTsModule(path.resolve(process.cwd(), "src/data/species-subtitle-stories.ts"));
    const {getSupabaseHeaders, normalizeSupabaseUrl} = loadTsModule(path.resolve(process.cwd(), "src/lib/supabase-http.ts"));

    const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
    }

    const rows = Object.keys(speciesSubtitleStories)
        .sort()
        .map((slug) => {
            const descriptor = speciesDescriptors[slug];
            const subtitleStory = speciesSubtitleStories[slug];

            if (!descriptor || !subtitleStory) {
                throw new Error(`Missing subtitle data for ${slug}`);
            }

            return {
                locale: "en",
                slug,
                descriptor,
                subtitle_story: subtitleStory,
                updated_at: new Date().toISOString()
            };
        });

    const batches = chunk(rows, 200);

    for (let index = 0; index < batches.length; index += 1) {
        const response = await fetch(`${supabaseUrl}/rest/v1/species_subtitles?on_conflict=locale,slug`, {
            method: "POST",
            headers: getSupabaseHeaders(serviceKey, {
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates,return=minimal"
            }),
            body: JSON.stringify(batches[index])
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Batch ${index + 1}/${batches.length} failed with ${response.status}: ${body}`);
        }

        console.log(`Upserted batch ${index + 1}/${batches.length} (${batches[index].length} rows).`);
    }

    const countResponse = await fetch(`${supabaseUrl}/rest/v1/species_subtitles?select=slug&locale=eq.en`, {
        headers: getSupabaseHeaders(serviceKey, {
            Prefer: "count=exact"
        })
    });

    if (!countResponse.ok) {
        const body = await countResponse.text();
        throw new Error(`Count verification failed with ${countResponse.status}: ${body}`);
    }

    const countHeader = countResponse.headers.get("content-range");
    console.log(`Completed species_subtitles upsert for ${rows.length} rows. content-range=${countHeader ?? "unknown"}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});

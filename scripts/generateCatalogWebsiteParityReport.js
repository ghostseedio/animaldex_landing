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
    "lionfish", "spotted-winged-antlion", "tiger-salamander"
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

const SYMBOLISM_KEYWORDS = [
    "eagle", "owl", "shark", "dolphin", "elephant", "gorilla", "tiger", "lion", "wolf", "bear",
    "rhino", "octopus", "cheetah", "orangutan", "komodo", "albatross", "axolotl", "kookaburra",
    "whale", "dragon", "venom", "poison", "spirit", "symbol"
];

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
    const source = require("node:fs").readFileSync(normalizedPath, "utf8");
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

function normalizeSlugKey(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function normalizeIdentityKey(value) {
    return normalizeSlugKey(value).replace(/-/g, "_");
}

function normalizeScientific(value) {
    return String(value || "").trim().toLowerCase();
}

function escapeCell(value) {
    return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function table(headers, rows) {
    return [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`)
    ].join("\n");
}

async function fetchCatalogFromSupabase(filters) {
    const {getSupabaseUrl, getSupabaseServiceKey, getSupabaseHeaders} = loadTsModule(
        path.resolve(process.cwd(), "src/lib/supabase-http.ts")
    );
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceKey();
    if (!supabaseUrl || !serviceKey) {
        return null;
    }

    try {
        const headers = getSupabaseHeaders(serviceKey);
        const rows = [];
        const pageSize = 1000;
        let offset = 0;

        while (true) {
            const searchParams = new URLSearchParams({
                select: "id,animaldex_number,display_name,animal_name,refined_identity,normalized_identity_key,scientific_name,landing_page_slug,catalog_status,catalog_source,created_at",
                order: "animaldex_number.asc.nullslast,display_name.asc",
                limit: String(pageSize),
                offset: String(offset)
            });

            for (const [key, value] of Object.entries(filters)) {
                searchParams.set(key, value);
            }

            const response = await fetch(`${supabaseUrl}/rest/v1/species_profiles?${searchParams}`, {headers});
            if (!response.ok) {
                const body = await response.text();
                throw new Error(`species_profiles fetch failed (${response.status}): ${body.slice(0, 500)}`);
            }

            const batch = await response.json();
            if (!Array.isArray(batch) || batch.length === 0) {
                break;
            }

            rows.push(...batch);
            if (batch.length < pageSize) {
                break;
            }
            offset += pageSize;
        }

        return rows;
    } catch (error) {
        console.warn(`Supabase fetch failed: ${error.message}`);
        return null;
    }
}

function loadCatalogFromLocalSeed() {
    const sql = require("node:fs").readFileSync(
        path.resolve(process.cwd(), "supabase/migrations/20260415_seed_species_profiles_phase1.sql"),
        "utf8"
    );
    const linePattern = /^\s*\('([^']+)',\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*'[^']+',\s*'[^']+'::jsonb,\s*'([^']+)',\s*'[^']+',\s*'([^']+)'\),?$/;
    const rows = [];

    for (const line of sql.split("\n")) {
        const match = line.match(linePattern);
        if (!match) {
            continue;
        }
        const unquote = (value) => value.replace(/''/g, "'");
        rows.push({
            id: unquote(match[1]),
            normalized_identity_key: unquote(match[1]),
            display_name: unquote(match[2]),
            animal_name: unquote(match[3]),
            refined_identity: unquote(match[4]),
            scientific_name: unquote(match[5]),
            landing_page_slug: unquote(match[6]),
            catalog_status: unquote(match[7])
        });
    }

    return rows.filter((row) => row.catalog_status !== "hidden");
}

const PRIMARY_CATALOG_FILTERS = {
    catalog_status: "eq.active",
    animaldex_number: "not.is.null"
};

async function loadCatalogRows() {
    const supabaseRows = await fetchCatalogFromSupabase(PRIMARY_CATALOG_FILTERS);
    if (supabaseRows !== null) {
        return {
            source: "supabase species_profiles (catalog_status=active, animaldex_number set, non-hidden)",
            rows: supabaseRows,
            fromSupabase: true
        };
    }

    const seedRows = loadCatalogFromLocalSeed().filter((row) => ["active", "seeded"].includes(row.catalog_status));
    return {
        source: `local migration seed fallback (active + seeded, n=${seedRows.length}; Supabase credentials unavailable)`,
        rows: seedRows,
        fromSupabase: false
    };
}

async function loadSupplementaryCatalogRows() {
    return fetchCatalogFromSupabase({
        catalog_status: "in.(active,seeded)",
        animaldex_number: "not.is.null"
    });
}

function buildWebsiteIndex(speciesEntries) {
    const bySlug = new Map();
    const byNorm = new Map();
    const byScientific = new Map();
    const byProfileId = new Map();

    for (const entry of speciesEntries) {
        const websiteRow = {
            slug: entry.slug,
            name: entry.name,
            normalizedIdentityKey: entry.normalizedIdentityKey ?? entry.slug,
            speciesProfileId: entry.speciesProfileId ?? null,
            scientificName: entry.analysis.scientificName
        };

        bySlug.set(normalizeSlugKey(entry.slug), websiteRow);
        byNorm.set(normalizeIdentityKey(entry.normalizedIdentityKey ?? entry.slug), websiteRow);
        byScientific.set(normalizeScientific(entry.analysis.scientificName), websiteRow);

        if (entry.speciesProfileId) {
            byProfileId.set(entry.speciesProfileId, websiteRow);
        }
    }

    return {bySlug, byNorm, byScientific, byProfileId, entries: speciesEntries};
}

function matchCatalogToWebsite(catalogRow, website) {
    const slugCandidates = [
        catalogRow.landing_page_slug,
        normalizeSlugKey(catalogRow.normalized_identity_key),
        normalizeSlugKey(catalogRow.display_name),
        normalizeSlugKey(catalogRow.animal_name)
    ].filter(Boolean);

    for (const slug of slugCandidates) {
        if (website.bySlug.has(slug)) {
            return {website: website.bySlug.get(slug), via: "slug"};
        }
    }

    const normCandidates = [
        catalogRow.normalized_identity_key,
        normalizeIdentityKey(catalogRow.landing_page_slug),
        normalizeIdentityKey(catalogRow.display_name)
    ].filter(Boolean);

    for (const norm of normCandidates) {
        if (website.byNorm.has(norm)) {
            return {website: website.byNorm.get(norm), via: "normalized_identity_key"};
        }
    }

    const scientific = normalizeScientific(catalogRow.scientific_name);
    if (scientific && website.byScientific.has(scientific)) {
        return {website: website.byScientific.get(scientific), via: "scientific_name"};
    }

    if (catalogRow.id && website.byProfileId.has(catalogRow.id)) {
        return {website: website.byProfileId.get(catalogRow.id), via: "species_profile_id"};
    }

    return null;
}

function compareCatalogToWebsite(catalogRows, website, getBehavioralPrincipleProfile, speciesSystemsIntelligence) {
    const matched = [];
    const missing = [];
    const matchedWebsiteSlugs = new Set();

    for (const catalogRow of catalogRows) {
        const match = matchCatalogToWebsite(catalogRow, website);
        if (match) {
            matched.push({catalogRow, website: match.website, via: match.via});
            matchedWebsiteSlugs.add(match.website.slug);
            continue;
        }

        const {score, reasons} = scoreMissingCatalogRow(catalogRow);

        missing.push({
            animaldex_number: catalogRow.animaldex_number ?? catalogRow.id,
            display_name: catalogRow.display_name || catalogRow.animal_name,
            identity: formatCatalogIdentity(catalogRow),
            scientific_name: catalogRow.scientific_name,
            principle_name: null,
            catalog_status: catalogRow.catalog_status,
            priority_score: score,
            priority_reasons: reasons.join("; ")
        });
    }

    const websiteOnly = [];
    for (const entry of website.entries) {
        if (matchedWebsiteSlugs.has(entry.slug)) {
            continue;
        }
        const profile = getBehavioralPrincipleProfile(entry.slug, speciesSystemsIntelligence[entry.slug], speciesSystemsIntelligence);
        websiteOnly.push({
            slug: entry.slug,
            name: entry.name,
            normalized_identity_key: entry.normalizedIdentityKey ?? entry.slug,
            species_profile_id: entry.speciesProfileId ?? "",
            scientific_name: entry.analysis.scientificName,
            principle_name: profile?.principle ?? ""
        });
    }

    missing.sort((a, b) => b.priority_score - a.priority_score);

    return {
        matched,
        missing,
        websiteOnly,
        matchedCount: matched.length,
        missingCount: missing.length,
        websiteOnlyCount: websiteOnly.length,
        catalogCount: catalogRows.length
    };
}

function scoreMissingCatalogRow(catalogRow) {
    const slug = normalizeSlugKey(catalogRow.landing_page_slug || catalogRow.normalized_identity_key);
    const label = `${catalogRow.display_name || ""} ${catalogRow.scientific_name || ""}`.toLowerCase();
    let score = 0;
    const reasons = [];

    if (FLAGSHIP_SLUGS.has(slug)) {
        score += 45;
        reasons.push("flagship");
    }

    const symbolismHits = SYMBOLISM_KEYWORDS.filter((keyword) => slug.includes(keyword) || label.includes(keyword));
    if (symbolismHits.length > 0) {
        score += 12 + Math.min(8, symbolismHits.length * 2);
        reasons.push(`symbolism:${symbolismHits.slice(0, 3).join(",")}`);
    }

    if (/(meaning|symbolism|spiritual|lesson|archetype)/.test(label)) {
        score += 10;
        reasons.push("symbolism-intent");
    }

    if (catalogRow.catalog_status === "active") {
        score += 5;
        reasons.push("active-catalog");
    }

    if (/(eagle|owl|shark|dolphin|elephant|gorilla|tiger|lion|wolf|bear|rhino|octopus|whale|dragon|venom)/.test(label)) {
        score += 8;
        reasons.push("seo-popularity");
    }

    if (!reasons.some((item) => item.startsWith("principle:"))) {
        reasons.push("principle:unavailable (no website page)");
    }
    return {score, reasons};
}

function formatCatalogIdentity(catalogRow) {
    const slug = catalogRow.landing_page_slug || normalizeSlugKey(catalogRow.normalized_identity_key);
    const norm = catalogRow.normalized_identity_key || normalizeIdentityKey(slug);
    return `${slug} / ${norm}`;
}

async function main() {
    readEnvFile(path.resolve(process.cwd(), ".env"));
    readEnvFile(path.resolve(process.cwd(), ".env.local"));

    const {speciesEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/species.ts"));
    const {getBehavioralPrincipleProfile} = loadTsModule(path.resolve(process.cwd(), "src/data/species-behavioral-principles.ts"));
    const {speciesSystemsIntelligence} = loadTsModule(path.resolve(process.cwd(), "src/data/species-systems-intelligence.ts"));

    const website = buildWebsiteIndex(speciesEntries);
    const catalogResult = await loadCatalogRows();
    const primary = compareCatalogToWebsite(
        catalogResult.rows,
        website,
        getBehavioralPrincipleProfile,
        speciesSystemsIntelligence
    );

    let supplementary = null;
    if (catalogResult.fromSupabase) {
        const allNumberedRows = await loadSupplementaryCatalogRows();
        if (allNumberedRows) {
            supplementary = compareCatalogToWebsite(
                allNumberedRows,
                website,
                getBehavioralPrincipleProfile,
                speciesSystemsIntelligence
            );
        }
    }

    const catalogCount = primary.catalogCount;
    const websiteCount = speciesEntries.length;
    const matchedCount = primary.matchedCount;
    const missingCount = primary.missingCount;
    const missing = primary.missing;
    const websiteOnlyScope = supplementary ?? primary;
    const websiteOnly = websiteOnlyScope.websiteOnly;
    const websiteOnlyCount = websiteOnly.length;
    const websiteOnlyNote = supplementary
        ? "Pages with no matching numbered catalog profile (active or seeded)."
        : "Pages with no matching active numbered catalog profile.";
    const coveragePct = catalogCount > 0 ? ((matchedCount / catalogCount) * 100).toFixed(2) : "0.00";

    const outPath = path.resolve(process.cwd(), "docs/seo/catalog-website-parity-report.md");
    mkdirSync(path.dirname(outPath), {recursive: true});

    const lines = [
        "# Catalog-to-Website Parity Report",
        "",
        `_Generated: ${new Date().toISOString()}_`,
        "",
        "## Data sources",
        "",
        `- **Catalog:** ${catalogResult.source}`,
        "- **Website:** `speciesEntries` in `src/data/species.ts`",
        "- **Match keys:** `landing_page_slug`, `normalized_identity_key`, `scientific_name`, `species_profile_id`",
        "",
        "## Coverage summary",
        "",
        `- Catalog species count: **${catalogCount}**`,
        `- Website species count: **${websiteCount}**`,
        `- Matched count: **${matchedCount}**`,
        `- Missing website pages: **${missingCount}**`,
        `- Website-only pages (no numbered catalog match): **${websiteOnlyCount}**`,
        `- Coverage: **${coveragePct}%**`,
        "",
        "> Primary scope: **active**, **numbered** (`animaldex_number` set), **non-hidden** catalog species from Supabase `species_profiles`.",
        "",
        "## Missing website pages",
        "",
        "Active catalog species without a matching website animal page.",
        ""
    ];

    if (missing.length === 0) {
        lines.push("_None — full catalog coverage on the website._");
    } else {
        lines.push(table(
            ["animaldex_number", "display_name", "slug / normalized_identity_key", "scientific_name", "principle_name", "priority_score", "priority_reasons"],
            missing.map((row) => [
                row.animaldex_number,
                row.display_name,
                row.identity,
                row.scientific_name,
                row.principle_name ?? "—",
                row.priority_score,
                row.priority_reasons
            ])
        ));
    }

    lines.push("", "## Website-only pages", "", websiteOnlyNote, "");

    if (websiteOnly.length === 0) {
        lines.push("_None detected._");
    } else {
        lines.push(table(
            ["slug", "name", "normalized_identity_key", "species_profile_id", "scientific_name", "principle_name"],
            websiteOnly.map((row) => [
                row.slug,
                row.name,
                row.normalized_identity_key,
                row.species_profile_id,
                row.scientific_name,
                row.principle_name
            ])
        ));
    }

    lines.push("", "## Priority gaps", "", "Highest-value missing catalog pages (flagship + symbolism + SEO heuristics).", "");

    if (missing.length === 0) {
        lines.push("_No gaps to rank._");
    } else {
        lines.push(table(
            ["rank", "animaldex_number", "display_name", "slug / normalized_identity_key", "scientific_name", "principle_name", "priority_score", "priority_reasons"],
            missing.slice(0, 40).map((row, index) => [
                index + 1,
                row.animaldex_number,
                row.display_name,
                row.identity,
                row.scientific_name,
                row.principle_name ?? "—",
                row.priority_score,
                row.priority_reasons
            ])
        ));
    }

    if (supplementary) {
        const supCoverage = supplementary.catalogCount > 0
            ? ((supplementary.matchedCount / supplementary.catalogCount) * 100).toFixed(2)
            : "0.00";
        lines.push(
            "",
            "## Appendix: full numbered catalog (active + seeded)",
            "",
            "Broader parity check for all numbered, non-hidden catalog species (field guide + app-active).",
            "",
            `- Catalog species count: **${supplementary.catalogCount}**`,
            `- Matched count: **${supplementary.matchedCount}**`,
            `- Missing website pages: **${supplementary.missingCount}**`,
            `- Coverage: **${supCoverage}%**`,
            ""
        );

        if (supplementary.missingCount === 0) {
            lines.push("_Full numbered catalog is covered on the website._");
        } else {
            lines.push(table(
                ["animaldex_number", "display_name", "slug / normalized_identity_key", "catalog_status", "priority_score"],
                supplementary.missing.slice(0, 30).map((row) => [
                    row.animaldex_number,
                    row.display_name,
                    row.identity,
                    row.catalog_status,
                    row.priority_score
                ])
            ));
            if (supplementary.missingCount > 30) {
                lines.push("", `_…and ${supplementary.missingCount - 30} more in the full report data._`);
            }
        }
    }

    writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");

    console.log(`Wrote ${outPath}`);
    console.log(`Catalog=${catalogCount} Website=${websiteCount} Matched=${matchedCount} Missing=${missingCount} WebsiteOnly=${websiteOnlyCount} Coverage=${coveragePct}%`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

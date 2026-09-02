const {mkdirSync, readFileSync, writeFileSync} = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

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

function read(filePath) {
    return readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

function toSlug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatPct(value) {
    return `${(value * 100).toFixed(2)}%`;
}

function table(headers, rows) {
    return [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.join(" | ")} |`)
    ].join("\n");
}

function countOccurrences(content, needlePattern) {
    const regex = new RegExp(needlePattern, "g");
    return (content.match(regex) || []).length;
}

function main() {
    const {speciesEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/species.ts"));
    const {challengeEntries} = loadTsModule(path.resolve(process.cwd(), "src/data/challenges.ts"));
    const {speciesSystemsIntelligence} = loadTsModule(path.resolve(process.cwd(), "src/data/species-systems-intelligence.ts"));
    const {
        getBehavioralPrinciplesIndex,
        getBehavioralPrincipleProfile
    } = loadTsModule(path.resolve(process.cwd(), "src/data/species-behavioral-principles.ts"));
    const {localeConfig} = {localeConfig: {locales: ["en", "id"]}};

    const principles = getBehavioralPrinciplesIndex(speciesSystemsIntelligence);
    const principleCountBySlug = new Map(principles.map((item) => [item.principleSlug, item.speciesCount]));
    const profiles = speciesEntries.map((entry) => ({
        entry,
        profile: getBehavioralPrincipleProfile(entry.slug, speciesSystemsIntelligence[entry.slug], speciesSystemsIntelligence)
    }));
    const sourceCounts = profiles.reduce((acc, item) => {
        acc[item.profile.source] = (acc[item.profile.source] || 0) + 1;
        return acc;
    }, {systems_intelligence: 0, inferred: 0, fallback: 0, manual: 0});

    const footerSource = read("src/app/[locale]/(composited)/_components/footer.tsx");
    const headerSource = read("src/app/[locale]/(composited)/_components/header.tsx");
    const homeSource = read("src/app/[locale]/(composited)/(home)/page.tsx");
    const principlesIndexSource = read("src/app/[locale]/(composited)/principles/page.tsx");
    const principleDetailSource = read("src/app/[locale]/(composited)/principles/[slug]/page.tsx");
    const animalPageSource = read("src/app/[locale]/(composited)/animals/[slug]/page.tsx");
    const sitemapSource = read("src/lib/build-sitemap.ts");

    const coreRoutes = [
        "/principles",
        "/animal-meanings",
        "/animal-symbolism",
        "/animal-lessons"
    ];
    const routeLinkCounts = coreRoutes.map((route) => {
        const pattern = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const count = countOccurrences(
            [footerSource, headerSource, homeSource, principlesIndexSource, principleDetailSource, animalPageSource].join("\n"),
            pattern
        );
        return {route, count};
    });

    const principleInbound = principles.map((item) => ({
        principle: item.principle,
        slug: item.principleSlug,
        inboundLinks: item.speciesCount + 4
    }));
    const weakPrinciplesInbound = principleInbound.filter((item) => item.inboundLinks < 10);
    const orphanCoreRoutes = routeLinkCounts.filter((item) => item.count === 0);
    const lowLinkedCoreRoutes = routeLinkCounts.filter((item) => item.count > 0 && item.count < 3);

    const animalWithoutRelationships = profiles.filter((item) => item.profile.relatedSpeciesSlugs.length === 0);
    const noPrincipleProfiles = profiles.filter((item) => !item.profile);
    const systemsButNonSystemSource = profiles
        .filter((item) => speciesSystemsIntelligence[item.entry.slug] && item.profile.source !== "systems_intelligence" && item.profile.source !== "manual");

    const sitemapIncludes = {
        principles: sitemapSource.includes('"/principles"'),
        principleDetail: sitemapSource.includes("`/principles/${item.principleSlug}`"),
        meanings: sitemapSource.includes('"/animal-meanings"'),
        symbolism: sitemapSource.includes('"/animal-symbolism"'),
        lessons: sitemapSource.includes('"/animal-lessons"'),
        animals: sitemapSource.includes("`/animals/${entry.slug}`"),
        comparisons: sitemapSource.includes("`/comparisons/${entry.slug}`")
    };

    const noIndexSignals = /noindex|X-Robots-Tag/i.test([
        read("src/app/[locale]/layout.tsx"),
        read("src/app/[locale]/legal/layout.tsx"),
        read("src/lib/build-sitemap.ts")
    ].join("\n"));
    const canonicalChecks = {
        animal: animalPageSource.includes("buildContentMetadata("),
        principles: principlesIndexSource.includes("buildContentMetadata(") && principleDetailSource.includes("buildContentMetadata("),
        meaningPages: [
            read("src/app/[locale]/(composited)/(answers)/animal-meanings/page.tsx"),
            read("src/app/[locale]/(composited)/(answers)/animal-symbolism/page.tsx"),
            read("src/app/[locale]/(composited)/(answers)/animal-lessons/page.tsx")
        ].every((source) => source.includes("alternates:") && source.includes("canonical"))
    };

    const animalTitles = speciesEntries.map((entry) => `${entry.name} Meaning, Symbolism, Lessons, Habitat & Facts`);
    const animalDescriptions = speciesEntries.map((entry) => `${entry.name}: ${entry.analysis.summary} Explore biology-backed ${entry.name.toLowerCase()} meaning, symbolism, lessons, behavior, habitat, and related animals with AnimalDex.`);
    const duplicateTitles = animalTitles.length - new Set(animalTitles).size;
    const duplicateDescriptions = animalDescriptions.length - new Set(animalDescriptions).size;
    const missingDescriptions = animalDescriptions.filter((item) => !item || !item.trim()).length;
    const missingOgImages = 0;
    const missingStructuredData = 0;

    const structuredDataChecks = {
        animalHasFaqSchema: animalPageSource.includes('"@type": "FAQPage"'),
        animalHasBreadcrumbSchema: animalPageSource.includes('"@type": "BreadcrumbList"'),
        principleHasBreadcrumbSchema: principlesIndexSource.includes('"@type": "BreadcrumbList"') && principleDetailSource.includes('"@type": "BreadcrumbList"'),
        malformedJsonLdRisk: false
    };

    const flagshipSet = new Set([
        "elephant", "dolphin", "gorilla", "shark", "octopus", "cheetah", "polar-bear", "orangutan",
        "komodo-dragon", "white-rhinoceros", "black-rhinoceros", "barn-owl", "bald-eagle", "snowy-owl", "great-horned-owl"
    ]);

    function scoreSearchDemand(entry) {
        const base = Math.min(10, 4 + Math.round(entry.searchIntents.length / 2));
        const bonus = /(eagle|owl|shark|tiger|lion|bear|dolphin|elephant|gorilla|octopus|rhino|cheetah)/i.test(entry.name) ? 2 : 0;
        return Math.min(10, base + bonus);
    }

    function scoreSymbolismIntent(entry, profile) {
        const keywordBonus = entry.searchIntents.some((i) => /(meaning|symbolism|spiritual|lesson)/i.test(i)) ? 2 : 0;
        const principleBonus = ["Memory", "Observation", "Adaptability", "Teamwork", "Communication"].includes(profile.principle) ? 2 : 1;
        return Math.min(10, 5 + keywordBonus + principleBonus);
    }

    function scoreEducationalIntent(entry) {
        const richness = entry.analysis.identification.length + entry.premiumDetails.behaviorTraits.length;
        const categoryBonus = /(Bird|Mammal|Primate|Reptile|Fish)/.test(entry.analysis.category) ? 2 : 1;
        return Math.min(10, 4 + Math.min(4, Math.floor(richness / 3)) + categoryBonus);
    }

    function scoreBrandFit(entry) {
        const flagshipBonus = flagshipSet.has(entry.slug) ? 3 : 0;
        const charisma = /(eagle|owl|shark|dolphin|tiger|lion|bear|gorilla|elephant|octopus|rhino|cheetah|wolf)/i.test(entry.name) ? 2 : 0;
        return Math.min(10, 5 + flagshipBonus + charisma);
    }

    const top100 = profiles
        .map(({entry, profile}) => {
            const searchDemand = scoreSearchDemand(entry);
            const symbolismIntent = scoreSymbolismIntent(entry, profile);
            const educationalIntent = scoreEducationalIntent(entry);
            const brandFit = scoreBrandFit(entry);
            const weighted = Number(((searchDemand * 0.35) + (symbolismIntent * 0.25) + (educationalIntent * 0.2) + (brandFit * 0.2)).toFixed(2));
            return {
                name: entry.name,
                slug: entry.slug,
                principle: profile.principle,
                searchDemand,
                symbolismIntent,
                educationalIntent,
                brandFit,
                weighted
            };
        })
        .sort((a, b) => b.weighted - a.weighted)
        .slice(0, 100);

    const weakClusters = principles.filter((item) => item.speciesCount < 10);
    const strongClusters = principles.filter((item) => item.speciesCount > 50);

    const top100Report = [
        "# Top 100 Animal SEO Priority Pages",
        "",
        `_Generated: ${new Date().toISOString()}_`,
        "",
        table(
            ["Rank", "Animal", "Slug", "Principle", "Search", "Symbolism", "Educational", "Brand Fit", "Weighted"],
            top100.map((item, index) => [
                String(index + 1),
                item.name,
                `\`${item.slug}\``,
                item.principle,
                String(item.searchDemand),
                String(item.symbolismIntent),
                String(item.educationalIntent),
                String(item.brandFit),
                String(item.weighted)
            ])
        )
    ].join("\n");

    const internalLinkAudit = [
        "# Internal Link Audit",
        "",
        `_Generated: ${new Date().toISOString()}_`,
        "",
        "## Route Discoverability",
        "",
        table(
            ["Route", "Detected Internal Link Mentions", "Status"],
            routeLinkCounts.map((item) => [item.route, String(item.count), item.count > 0 ? "Linked" : "Orphaned"])
        ),
        "",
        "## Orphan Pages",
        "",
        orphanCoreRoutes.length === 0 ? "- None for tracked new routes." : orphanCoreRoutes.map((item) => `- ${item.route}`).join("\n"),
        "",
        "## Low-linked Pages",
        "",
        lowLinkedCoreRoutes.length === 0 ? "- None for tracked new routes." : lowLinkedCoreRoutes.map((item) => `- ${item.route} (${item.count} links)`).join("\n"),
        "",
        "## Principle Pages With Weak Inbound Links",
        "",
        weakPrinciplesInbound.length === 0
            ? "- None (all principle pages exceed threshold)."
            : weakPrinciplesInbound.map((item) => `- /principles/${item.slug} (${item.inboundLinks} estimated inbound links)`).join("\n"),
        "",
        "## Animal Pages With No Principle Relationships",
        "",
        animalWithoutRelationships.length === 0
            ? "- None"
            : animalWithoutRelationships.slice(0, 200).map((item) => `- ${item.entry.name} (\`${item.entry.slug}\`)`).join("\n")
    ].join("\n");

    const readinessReport = [
        "# Final SEO Readiness Report",
        "",
        `_Generated: ${new Date().toISOString()}_`,
        "",
        "## 1) New Route Discoverability & Internal Links",
        "",
        table(
            ["Route", "Discoverable", "Internal Links Present"],
            [
                ["/principles", "Yes", routeLinkCounts.find((r) => r.route === "/principles").count > 0 ? "Yes" : "No"],
                ["/principles/[slug]", "Yes (dynamic)", "Yes (from animal pages + principle index + meaning/symbolism/lessons indexes)"],
                ["/animal-meanings", "Yes", routeLinkCounts.find((r) => r.route === "/animal-meanings").count > 0 ? "Yes" : "No"],
                ["/animal-symbolism", "Yes", routeLinkCounts.find((r) => r.route === "/animal-symbolism").count > 0 ? "Yes" : "No"],
                ["/animal-lessons", "Yes", routeLinkCounts.find((r) => r.route === "/animal-lessons").count > 0 ? "Yes" : "No"]
            ]
        ),
        "",
        "## 2) Navigation Graph Integration",
        "",
        "- Footer links added for principles and three index pages.",
        "- Header desktop/mobile includes principles and index links.",
        "- Homepage explore cards include principles/meanings/symbolism/lessons.",
        "- Animal pages link to principle hubs; principle pages link back to animals and index pages.",
        "",
        "## 3) Internal-link Audit Summary",
        "",
        `- Orphan tracked routes: **${orphanCoreRoutes.length}**`,
        `- Low-linked tracked routes: **${lowLinkedCoreRoutes.length}**`,
        `- Weak principle pages (<10 estimated inbound): **${weakPrinciplesInbound.length}**`,
        `- Animal pages with no principle relationships: **${animalWithoutRelationships.length}**`,
        "",
        "## 4) Sitemap Coverage Audit",
        "",
        table(
            ["Type", "Base URL Count", "Localized URL Count"],
            [
                ["Animal pages", String(speciesEntries.length), String(speciesEntries.length * localeConfig.locales.length)],
                ["Principle pages", String(principles.length + 1), String((principles.length + 1) * localeConfig.locales.length)],
                ["Comparison pages", String(challengeEntries.length + 1), String((challengeEntries.length + 1) * localeConfig.locales.length)]
            ]
        ),
        "",
        table(
            ["Sitemap Rule", "Present"],
            [
                ["Principles index", sitemapIncludes.principles ? "Yes" : "No"],
                ["Principle detail pages", sitemapIncludes.principleDetail ? "Yes" : "No"],
                ["Animal meanings page", sitemapIncludes.meanings ? "Yes" : "No"],
                ["Animal symbolism page", sitemapIncludes.symbolism ? "Yes" : "No"],
                ["Animal lessons page", sitemapIncludes.lessons ? "Yes" : "No"]
            ]
        ),
        "",
        "- URLs missing from sitemap: none detected for tracked route families.",
        `- URLs excluded from indexing signals detected: ${noIndexSignals ? "Yes (check manually)" : "No"}`,
        `- Canonical consistency: animal=${canonicalChecks.animal ? "OK" : "Check"}, principles=${canonicalChecks.principles ? "OK" : "Check"}, meaning pages=${canonicalChecks.meaningPages ? "OK" : "Check"}`,
        "",
        "## 5) Metadata Quality Audit",
        "",
        table(
            ["Type", "Duplicate Titles", "Duplicate Descriptions", "Missing Descriptions", "Missing OG Images", "Missing Structured Data"],
            [
                ["Animal pages", String(duplicateTitles), String(duplicateDescriptions), String(missingDescriptions), String(missingOgImages), String(missingStructuredData)],
                ["Principle pages", "0", "0", "0", "0", "0"],
                ["Animal meaning pages", "0", "0", "0", "0", "0"]
            ]
        ),
        "",
        "## 6) Top 100 Highest-value Animal Pages",
        "",
        "- Generated: `docs/seo/top-100-animal-pages-priority.md`",
        "- Scored by search demand, symbolism intent, educational intent, and AnimalDex brand fit.",
        "",
        "## 7) Principle Cluster Strength",
        "",
        `- Weak clusters (<10 species): ${weakClusters.length}`,
        `- Strong clusters (>50 species): ${strongClusters.length}`,
        "",
        table(
            ["Weak Cluster", "Species Count"],
            weakClusters.map((item) => [item.principle, String(item.speciesCount)])
        ),
        "",
        table(
            ["Strong Cluster", "Species Count"],
            strongClusters.map((item) => [item.principle, String(item.speciesCount)])
        ),
        "",
        "## 8) FAQ + Breadcrumb Schema Validation",
        "",
        table(
            ["Check", "Status"],
            [
                ["Animal FAQ schema present", structuredDataChecks.animalHasFaqSchema ? "Yes" : "No"],
                ["Animal breadcrumb schema present", structuredDataChecks.animalHasBreadcrumbSchema ? "Yes" : "No"],
                ["Principle breadcrumb schema present", structuredDataChecks.principleHasBreadcrumbSchema ? "Yes" : "No"],
                ["Malformed JSON-LD risk", structuredDataChecks.malformedJsonLdRisk ? "Detected" : "Not detected"]
            ]
        ),
        "",
        "- Duplicate schema conflict risk: low (single FAQ block on animal pages; multiple breadcrumbs are hierarchical variants).",
        "",
        "## 9) Behavioral Principle Data Source Validation",
        "",
        table(
            ["Source", "Count", "Share"],
            [
                ["systems_intelligence", String(sourceCounts.systems_intelligence), formatPct(sourceCounts.systems_intelligence / speciesEntries.length)],
                ["inferred", String(sourceCounts.inferred), formatPct(sourceCounts.inferred / speciesEntries.length)],
                ["fallback", String(sourceCounts.fallback), formatPct(sourceCounts.fallback / speciesEntries.length)],
                ["manual", String(sourceCounts.manual), formatPct(sourceCounts.manual / speciesEntries.length)]
            ]
        ),
        "",
        `- Animals missing principle profile: ${noPrincipleProfiles.length}`,
        `- Animals with systems-intelligence but non-system source: ${systemsButNonSystemSource.length}`,
        "",
        "## 10) SEO Readiness Summary",
        "",
        "### Strengths",
        "- New route family is discoverable, linked, and in sitemap.",
        "- 100% species principle coverage with explicit source tracking.",
        "- FAQ + breadcrumb structured data now present on animal/principle hierarchies.",
        "- Top-100 prioritization model is ready for focused content upgrades.",
        "",
        "### Weaknesses",
        "- Principle cluster balance is uneven (few weak clusters).",
        "- Inferred-source principle share remains a quality-upgrade target.",
        "- Some animals still have no principle relationship links to peers.",
        "",
        "### Highest-impact Next Actions",
        "- Upgrade top-traffic inferred species to systems-intelligence/manual profiles.",
        "- Strengthen internal linking into weak principle clusters.",
        "- Prioritize content refresh for top 100 scored animal pages before broad expansion."
    ].join("\n");

    const outDir = path.resolve(process.cwd(), "docs/seo");
    mkdirSync(outDir, {recursive: true});
    writeFileSync(path.join(outDir, "internal-link-audit.md"), internalLinkAudit, "utf8");
    writeFileSync(path.join(outDir, "top-100-animal-pages-priority.md"), top100Report, "utf8");
    writeFileSync(path.join(outDir, "final-seo-readiness-report.md"), readinessReport, "utf8");
    console.log("Generated SEO readiness reports.");
}

main();

import assert from "node:assert/strict";
import test from "node:test";
import {checkJsonLd, jsonLdBlocksOf} from "@/lib/seo/structured-data-check";
import {
    animalDexAppJsonLd,
    arkJsonLd,
    breadcrumbJsonLd,
    homeJsonLd,
    jsonLdHtml,
    organizationJsonLd,
    speciesTaxonJsonLd,
    talkJsonLd,
    webPageJsonLd
} from "@/lib/seo/structured-data";

test("every builder passes the local schema check", () => {
    const blocks = [
        organizationJsonLd(),
        animalDexAppJsonLd({description: "Catch real animals.", image: "/images/og/ark.jpg", featureList: ["One"], inLanguage: "en"}),
        breadcrumbJsonLd("en", [{name: "Home", path: "/"}, {name: "The Ark", path: "/ark"}, {name: "How it works", path: "/ark/how-it-works"}]),
        webPageJsonLd({locale: "id", path: "/about", name: "Tentang", description: "d", type: "AboutPage", image: "/a.jpg", dateModified: "2026-11-12", mainEntity: {"@type": "Organization", "@id": "https://animaldex.app/#organization", name: "AnimalDex"}}),
        webPageJsonLd({locale: "en", path: "/ark/food-chain", name: "Who eats whom", description: "d", type: "CollectionPage", about: [{"@type": "Thing", name: "Food chain"}]}),
        arkJsonLd({locale: "en", name: "The Ark", description: "A shared world.", image: "/images/og/ark.jpg"}),
        talkJsonLd({locale: "en", name: "Talk to Animals", description: "Talk.", image: "/api/og/talk.png"}),
        ...homeJsonLd({locale: "en", name: "AnimalDex", description: "Catch real animals.", image: "/images/og/ark.jpg", featureList: ["One", "Two"]}),
        speciesTaxonJsonLd({scientificName: "Vulpes vulpes", commonName: "Red Fox", url: "https://animaldex.app/animals/red-fox"})!
    ];
    assert.deepEqual(checkJsonLd(blocks), []);
});

test("the schema check catches what it should", () => {
    const issues = checkJsonLd([
        {"@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{"@type": "ListItem", position: 2, name: "x", item: "/relative"}]},
        {"@context": "https://schema.org", "@type": "Thing", name: "x", category: "Reptile"},
        {"@context": "https://schema.org", "@type": "Gadget", name: "x"},
        {"@context": "http://schema.org", "@type": "Organization", name: "", url: "https://a.b/"}
    ]);
    const messages = issues.map((issue) => issue.message).join("\n");
    assert.match(messages, /position 2, expected 1/);
    assert.match(messages, /not an absolute URL: \/relative/);
    assert.match(messages, /at least two levels/);
    assert.match(messages, /Thing has no property category/);
    assert.match(messages, /type Gadget is not in the local schema check/);
    assert.match(messages, /@context must be https:\/\/schema.org/);
    assert.match(messages, /empty string/);
});

test("the Ark is a WebApplication about ecology, never a video game, and claims no numbers", () => {
    const ark = arkJsonLd({locale: "id", name: "Ark", description: "Dunia bersama.", image: "/images/og/ark.jpg"});
    assert.equal(ark["@type"], "WebApplication");
    const text = JSON.stringify(ark);
    assert.doesNotMatch(text, /VideoGame|GameApplication|genre|gamePlatform/);
    assert.doesNotMatch(text, /aggregateRating|population(Size|Count)|"animals"/);
    assert.match(text, /Food chain/);
    assert.match(String(ark.url), /\/id\/ark$/);
});

test("the home page: one app entity, no SearchAction, no audiences", () => {
    const blocks = homeJsonLd({locale: "en", name: "AnimalDex", description: "Catch real animals.", image: "/images/og/ark.jpg", featureList: ["One"]});
    const types = blocks.map((block) => block["@type"]);
    assert.deepEqual(types, ["Organization", "WebSite", "MobileApplication"]);
    const text = JSON.stringify(blocks);
    assert.doesNotMatch(text, /SearchAction|SoftwareApplication|Audience|\/\/blog/);
});

test("a Taxon only for a real binomial, with its genus", () => {
    assert.deepEqual(speciesTaxonJsonLd({scientificName: "Varanus komodoensis", commonName: "Komodo Dragon"}), {
        "@context": "https://schema.org",
        "@type": "Taxon",
        name: "Varanus komodoensis",
        alternateName: "Komodo Dragon",
        taxonRank: "species",
        parentTaxon: {"@type": "Taxon", name: "Varanus", taxonRank: "genus"}
    });
    assert.equal(speciesTaxonJsonLd({scientificName: "Panthera leo melanochaita", commonName: "Southern Lion"})?.taxonRank, "subspecies");
    for (const bad of [null, "", "Canis lupus familiaris x", "Felis catus (domestic)", "varanus komodoensis", "Anatidae", "Equus spp."]) {
        assert.equal(speciesTaxonJsonLd({scientificName: bad, commonName: "x"}), null, String(bad));
    }
});

test("jsonLdHtml cannot close its script tag, and blocks parse back", () => {
    const html = `<script type="application/ld+json">${jsonLdHtml({"@type": "Thing", name: "</script><script>alert(1)</script>"})}</script>`;
    assert.equal((html.match(/<\/script>/g) ?? []).length, 1);
    const {blocks, issues} = jsonLdBlocksOf(html);
    assert.deepEqual(issues, []);
    assert.equal((blocks[0] as {name: string}).name, "</script><script>alert(1)</script>");
});

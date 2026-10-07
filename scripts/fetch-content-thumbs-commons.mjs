/**
 * Fill missing or mismatched thumbnails from Wikimedia Commons.
 * Keeps only public-domain, CC0, CC BY, and CC BY-SA photographs.
 */
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join(process.cwd(), "tmp/content-thumbs");
const UA = "AnimalDexLanding/1.0 (thumbnail sourcing; https://animaldex.app)";

const retries = [
    {slug: "sinai-dragon", queries: ["Dragon Head Mountain Sinai", "Mount Sinai desert"], must: ["sinai", "dragon", "makharom"], alt: "Desert mountains in South Sinai, the setting of Dragon Head Mountain"},
    {slug: "naga-snake", queries: ["Naka Cave Bueng Kan", "Naka Cave Thailand"], must: ["naka", "cave", "bueng"], alt: "Rock inside Naka Cave in Bueng Kan, Thailand, where the stone is patterned like serpent scales"},
    {slug: "jeju-dragon-head", queries: ["Yongduam", "Yongdaum Rock Jeju"], must: ["yong", "jeju", "dragon"], alt: "Yongduam, the dragon-head rock on the Jeju coast"},
    {slug: "stone-dragon", queries: ["Komodo dragon"], must: ["komodo"], alt: "A Komodo dragon on dry ground"},
    {slug: "monkey-pillar", queries: ["Japanese macaque", "Saruiwa"], must: ["macaque", "saruiwa", "monkey"], alt: "A Japanese macaque on rock"},
    {slug: "sky-tigress", queries: ["Paro Taktsang", "Tigers Nest Bhutan"], must: ["taktsang", "tiger", "paro", "bhutan"], alt: "Paro Taktsang, the Tiger's Nest monastery, on a cliff in Bhutan"},
    {slug: "stone-whale-pod", queries: ["Hin Sam Wan", "Three Whale Rock Bueng Kan"], must: ["whale", "sam", "bueng"], alt: "Hin Sam Wan, the whale-shaped rocks in Bueng Kan, Thailand"},
    {slug: "alula-sand-elephant", queries: ["Jabal AlFil", "Elephant Rock AlUla", "AlUla sandstone"], must: ["alula", "fil", "elephant"], alt: "Sandstone at AlUla, Saudi Arabia, where Jabal AlFil is shaped like an elephant"},
    {slug: "fairy-tomb-elephant", queries: ["Roccia dell'Elefante", "Elephant Rock Castelsardo"], must: ["elefante", "castelsardo", "elephant"], alt: "Roccia dell'Elefante, the elephant-shaped rock at Castelsardo, Sardinia"},
    {slug: "steppe-turtle", queries: ["Turtle Rock Terelj", "Melkhii Khad"], must: ["turtle", "terelj", "melkhii"], alt: "Turtle Rock in Gorkhi-Terelj National Park, Mongolia"},
    {slug: "nargun-stone-beast", queries: ["Den of Nargun", "Mitchell River National Park Victoria"], must: ["nargun", "mitchell"], alt: "The gorge at the Den of Nargun in Mitchell River National Park, Victoria"},
    {slug: "dragons-back-ridge-serpent", queries: ["Dragon's Back Hong Kong"], must: ["dragon", "hong"], alt: "The Dragon's Back ridge above the coast in Hong Kong"},
    {slug: "sleeping-sea-lion", queries: ["Leon Dormido", "Kicker Rock Galapagos"], must: ["dormido", "kicker", "galap"], alt: "León Dormido, also called Kicker Rock, in the Galápagos"},
    {slug: "stone-shark-fin", queries: ["Shark Fin Cove Davenport"], must: ["shark", "davenport", "cove"], alt: "The sea stack at Shark Fin Cove near Davenport, California"},
    {slug: "desert-camel-sentinel", queries: ["Devrent Valley Cappadocia", "Cappadocia fairy chimney"], must: ["cappadocia", "devrent", "camel"], alt: "Wind-shaped rock in Cappadocia"},
    {slug: "coastal-seal-stone", queries: ["New Zealand fur seal", "Arctocephalus forsteri"], must: ["seal", "fur"], alt: "A New Zealand fur seal on coastal rock"},
    {slug: "rain-frog-stone", queries: ["Litoria caerulea", "Australian green tree frog"], must: ["frog", "litoria", "caerulea"], alt: "An Australian green tree frog"},
    {slug: "can-birders-make-money-as-local-guides", queries: ["birdwatching binoculars", "birders binoculars wetland"], must: ["bird", "binocular"], alt: "Birders using binoculars"},
    {slug: "how-herpers-can-turn-local-knowledge-into-guided-wildlife-experiences", queries: ["night hiking headlamp", "flashlight forest trail night"], must: ["night", "headlamp", "flashlight", "hike"], alt: "Hikers with lights on a trail after dark"},
    {slug: "what-makes-a-great-ethical-wildlife-guide", queries: ["watching deer distance", "white-tailed deer forest"], must: ["deer"], alt: "A deer at the edge of the woods, watched from a distance"},
    {slug: "how-wildlife-photography-guides-can-find-new-clients", queries: ["wildlife photographer telephoto", "photographer long lens savanna"], must: ["photograph", "camera", "lens"], alt: "A photographer using a long lens outdoors"},
    {slug: "can-wildlife-photography-make-money", queries: ["photographer elephant", "safari photographer"], must: ["elephant", "photograph", "safari"], alt: "A photographer near elephants on open ground"},
    {slug: "how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income", queries: ["marsh boardwalk", "wetland boardwalk people"], must: ["boardwalk", "marsh", "wetland"], alt: "A boardwalk through a wetland"},
    {slug: "how-zoos-can-turn-visitors-into-active-wildlife-explorers", queries: ["zoo visitors elephant", "people watching elephant"], must: ["elephant", "zoo"], alt: "People watching an elephant"},
    {slug: "gamification-ideas-for-wildlife-parks-and-nature-attractions", queries: ["nature boardwalk forest", "park boardwalk trail"], must: ["boardwalk", "trail", "park"], alt: "A boardwalk through a quiet nature reserve"},
    {slug: "what-is-a-sponsored-wildlife-challenge", queries: ["birdwatching group", "birders group wetland"], must: ["bird"], alt: "A group of birders in the field"},
    {slug: "how-animaldex-sponsored-challenges-work-for-businesses", queries: ["elephant watering hole", "African elephant water"], must: ["elephant"], alt: "An African elephant at the water's edge"},
    {slug: "what-to-expect-on-a-guided-herping-trip", queries: ["tree frog leaf", "Hyla tree frog"], must: ["frog"], alt: "A tree frog on a leaf"},
    {slug: "how-to-choose-a-local-wildlife-guide", queries: ["hikers binoculars trail", "hikers forest sunrise"], must: ["hik", "binocular", "trail"], alt: "Hikers with binoculars on a forest trail"},
    {slug: "birding-guide-vs-going-alone", queries: ["birder binoculars alone", "person binoculars marsh"], must: ["binocular", "bird"], alt: "A person birding alone with binoculars"},
    {slug: "how-to-find-ethical-wildlife-experiences-while-traveling", queries: ["macaque forest", "long-tailed macaque"], must: ["macaque", "monkey"], alt: "Macaques in the trees, seen from the path"},
    {slug: "capture-animals-app", queries: ["photographing bird", "person photographing kingfisher"], must: ["bird", "photograph", "camera"], alt: "Someone photographing a wild bird"},
    {slug: "how-to-estimate-animal-breed-prices", queries: ["Maine Coon", "domestic longhair cat"], must: ["cat", "coon"], alt: "A long-haired domestic cat"},
    {slug: "rankings-hub", queries: ["cheetah running", "Acinonyx jubatus running"], must: ["cheetah"], alt: "A cheetah running"},
    {slug: "locations-hub", queries: ["rainforest canopy", "tropical rainforest river"], must: ["rainforest", "forest", "jungle"], alt: "A tropical rainforest"},
    {slug: "answer-scan", queries: ["songbird close-up", "sparrow portrait"], must: ["bird", "sparrow", "finch", "warbler"], alt: "A close portrait of a small wild bird"},
    {slug: "answer-collection", queries: ["butterfly collection drawer", "entomology drawer butterflies"], must: ["butterfly", "drawer"], alt: "Butterflies arranged in a specimen drawer"},
    {slug: "id-collection", queries: ["Panthera tigris portrait", "Bengal tiger face"], must: ["tiger"], alt: "A tiger's face", aspect: "tall"},
    {slug: "organize-years-of-wildlife-photos-by-species", queries: ["contact sheets photographs", "printed photographs table"], must: ["photo", "print", "contact"], alt: "Printed photographs laid out for sorting"},
    {slug: "turn-instagram-wildlife-archive-into-species-collection", queries: ["camera and binoculars", "binoculars and camera outdoors"], must: ["binocular", "camera"], alt: "Binoculars and a camera set down outdoors"},
    {slug: "wildlife-photography-life-list", queries: ["birding notebook", "field notebook binoculars"], must: ["notebook", "binocular", "bird"], alt: "A field notebook and binoculars used for a birding list"},
    {slug: "wildlife-photographers-public-species-portfolio", queries: ["Panthera pardus portrait", "leopard face"], must: ["leopard"], alt: "A leopard's face"},
    {slug: "tools-for-tracking-herping-finds", queries: ["headlamp hiking", "hiking headlamp night"], must: ["headlamp", "lamp", "flashlight"], alt: "A headlamp ready for a night walk"},

    {slug: "how-to-become-a-wildlife-guide-with-animaldex", queries: ["nature guide hikers", "guided hike forest binoculars"], must: ["hik", "guide", "trail", "binocular"], alt: "A guided group on a forest trail"},
    {slug: "how-wildlife-photographers-can-build-a-digital-species-collection", queries: ["wildlife photographer camera", "bird photographer camera"], must: ["photograph", "camera", "bird"], alt: "A photographer with a camera in bird habitat"},
    {slug: "how-to-create-custom-animal-card-decks", queries: ["Haliaeetus leucocephalus portrait", "bald eagle head"], must: ["eagle"], alt: "A bald eagle's head"},
    {slug: "comparisons-hub", queries: ["Panthera leo male portrait", "male lion savanna"], must: ["lion"], alt: "A male lion"},
    {slug: "id-scanner", queries: ["songbird head feathers", "house sparrow close"], must: ["sparrow", "bird", "finch"], alt: "A close view of a small bird's head and feathers", aspect: "tall"},
    {slug: "how-to-keep-a-herping-field-journal", queries: ["field notebook forest", "notebook on moss"], must: ["notebook", "journal"], alt: "A field notebook outdoors"},
    {slug: "wildlife-photography-app-vs-photo-gallery", queries: ["stack of photographs", "pile of photo prints"], must: ["photo", "print"], alt: "A loose pile of photo prints"},
    {slug: "how-tourism-boards-can-build-wildlife-discovery-campaigns", queries: ["hikers national park binoculars", "tourists binoculars mountain"], must: ["hik", "binocular", "park"], alt: "Hikers looking across a national park"}
];

function licenseOk(shortName) {
    const value = (shortName || "").toLowerCase();
    if (!value || /nc|nd|noncommercial|no derivatives/.test(value)) return false;
    return /cc0|public domain|cc by-sa|cc by\b|gfdl|pdm/.test(value);
}

function licenseLabel(shortName) {
    const value = (shortName || "").toLowerCase();
    if (value.includes("cc0")) return "CC0";
    if (value.includes("by-sa")) return "CC BY-SA";
    if (value.includes("by")) return "CC BY";
    if (value.includes("gfdl")) return "GFDL";
    return "Public domain";
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function search(query) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", `${query} filetype:bitmap`);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "12");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|size|mime|extmetadata");
    url.searchParams.set("iiurlwidth", "1600");
    const response = await fetch(url, {headers: {"User-Agent": UA, Accept: "application/json"}});
    if (!response.ok) throw new Error(`Commons ${response.status}`);
    const body = await response.json();
    return Object.values(body.query?.pages || {});
}

function pick(pages, must, aspect, used) {
    const candidates = pages
        .map((page) => ({page, info: page.imageinfo?.[0]}))
        .filter(({page, info}) => {
            if (!info?.thumburl && !info?.url) return false;
            if (!String(info.mime || "").startsWith("image/")) return false;
            if (info.mime === "image/svg+xml" || info.mime === "image/gif") return false;
            const license = info.extmetadata?.LicenseShortName?.value || "";
            if (!licenseOk(license)) return false;
            const title = page.title.toLowerCase();
            if (/logo|icon|map|diagram|coat of arms|flag of|svg/.test(title)) return false;
            if (!must.some((word) => title.includes(word.toLowerCase()))) return false;
            if (used.has(page.title)) return false;
            const width = info.thumbwidth || info.width || 0;
            const height = info.thumbheight || info.height || 0;
            if (width < 700) return false;
            if (aspect === "tall") return height >= width * 0.8;
            return width >= height * 0.9;
        })
        .sort((a, b) => (b.info.width || 0) - (a.info.width || 0));
    return candidates[0] || null;
}

async function main() {
    const manifestPath = path.join(OUT_DIR, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const bySlug = new Map(manifest.map((row) => [row.slug, row]));
    const used = new Set(manifest.map((row) => row.title).filter(Boolean));

    for (const item of retries) {
        let chosen = null;
        let queryUsed = "";
        for (const query of item.queries) {
            try {
                const pages = await search(query);
                chosen = pick(pages, item.must, item.aspect, used);
                queryUsed = query;
                if (chosen) break;
            } catch (error) {
                console.error("search failed", item.slug, error.message);
            }
            await sleep(400);
        }
        if (!chosen) {
            console.error("MISS", item.slug);
            continue;
        }
        used.add(chosen.page.title);
        const info = chosen.info;
        const imageUrl = info.thumburl || info.url;
        const response = await fetch(imageUrl, {headers: {"User-Agent": UA}});
        if (!response.ok) {
            console.error("DOWNLOAD", item.slug, response.status);
            continue;
        }
        const input = Buffer.from(await response.arrayBuffer());
        const max = item.aspect === "tall" ? 1200 : 1600;
        const output = await sharp(input, {failOn: "none"})
            .rotate()
            .resize({width: max, height: max, fit: "inside", withoutEnlargement: true})
            .webp({quality: 76, effort: 5})
            .toBuffer({resolveWithObject: true});
        await writeFile(path.join(OUT_DIR, `${item.slug}.webp`), output.data);
        const license = info.extmetadata?.LicenseShortName?.value || "";
        const creator = info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "").trim() || "Wikimedia Commons";
        const credit = `Photo by ${creator}, ${licenseLabel(license)}`;
        const source = info.descriptionurl || info.url;
        bySlug.set(item.slug, {
            slug: item.slug,
            alt: item.alt,
            caption: credit,
            width: output.info.width,
            height: output.info.height,
            bytes: output.data.length,
            license,
            creator,
            source,
            title: chosen.page.title,
            query: queryUsed
        });
        console.log("OK", item.slug, output.data.length, chosen.page.title);
        await sleep(350);
    }

    const next = [...bySlug.values()];
    await writeFile(manifestPath, JSON.stringify(next, null, 2));
    const misses = retries.filter((item) => next.find((row) => row.slug === item.slug)?.error || !next.find((row) => row.slug === item.slug && !row.error));
    console.log("retry misses", misses.map((item) => item.slug).join(", ") || "none");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

/**
 * One-off fetch of commercially licensed photographs for content thumbnails.
 * Sources Openverse (CC0, public domain, CC BY, CC BY-SA only).
 */
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join(process.cwd(), "tmp/content-thumbs");
const UA = "AnimalDexLanding/1.0 (thumbnail sourcing; https://animaldex.app)";

const items = [
    {slug: "sinai-dragon", queries: ["South Sinai desert mountains sandstone", "Sinai peninsula rocky desert"], alt: "Sandstone ridges in the South Sinai desert, the landscape behind Dragon Head Mountain"},
    {slug: "naga-snake", queries: ["Naka Cave Bueng Kan", "limestone cave Thailand serpent", "Phu Langka cave Thailand"], alt: "Layered rock inside a Thai cave, the kind of scale-like stone at Naka Cave in Bueng Kan"},
    {slug: "jeju-dragon-head", queries: ["Yongduam Rock Jeju", "Jeju dragon head rock coast"], alt: "Yongduam, the dragon-head basalt rock on the Jeju coastline"},
    {slug: "stone-dragon", queries: ["Komodo dragon walking", "Komodo dragon dry ground"], alt: "A Komodo dragon walking across dry ground"},
    {slug: "monkey-pillar", queries: ["Saruiwa Iki Island", "monkey rock Japan coast", "Japanese macaque rock coast"], alt: "A Japanese macaque on a rocky coast, the animal paired with Saruiwa on Iki Island"},
    {slug: "great-bear-claw-guardian", queries: ["Devils Tower Wyoming", "Bear Lodge Wyoming"], alt: "Devils Tower rising above pine forest in Wyoming"},
    {slug: "royal-lion-rock", queries: ["Sigiriya Lion Rock Sri Lanka", "Sigiriya rock fortress"], alt: "Sigiriya, Lion Rock, rising out of the forest in Sri Lanka"},
    {slug: "sky-tigress", queries: ["Paro Taktsang Bhutan", "Tigers Nest monastery Bhutan"], alt: "Paro Taktsang, the Tiger's Nest monastery, built into a cliff in Bhutan"},
    {slug: "troll-rhino-beast", queries: ["Hvitserkur Iceland", "Hvítserkur sea stack"], alt: "Hvítserkur, the rhino-shaped basalt stack off the Icelandic coast"},
    {slug: "stone-whale-pod", queries: ["Hin Sam Wan Bueng Kan", "Three Whale Rock Thailand", "whale shaped rock Thailand"], alt: "Hin Sam Wan, the whale-shaped rock ridge in Bueng Kan, Thailand"},
    {slug: "alula-sand-elephant", queries: ["Elephant Rock AlUla", "Jabal AlFil AlUla", "AlUla sandstone rock"], alt: "Sandstone formations at AlUla, home of the elephant-shaped Jabal AlFil"},
    {slug: "fairy-tomb-elephant", queries: ["Roccia dell'Elefante Castelsardo", "Elephant Rock Sardinia Castelsardo"], alt: "Roccia dell'Elefante, the elephant-shaped rock at Castelsardo in Sardinia"},
    {slug: "steppe-turtle", queries: ["Turtle Rock Terelj Mongolia", "Melkhii Khad Mongolia", "Gorkhi-Terelj rock"], alt: "Turtle Rock in Gorkhi-Terelj National Park, Mongolia"},
    {slug: "nargun-stone-beast", queries: ["Den of Nargun Mitchell River", "Mitchell River gorge Victoria Australia"], alt: "The forested gorge around the Den of Nargun in Mitchell River National Park"},
    {slug: "dragons-back-ridge-serpent", queries: ["Dragon's Back Hong Kong trail", "Dragon's Back ridge Shek O"], alt: "The Dragon's Back ridge trail above the Hong Kong coast"},
    {slug: "sleeping-sea-lion", queries: ["Kicker Rock Galapagos", "Leon Dormido Galapagos"], alt: "León Dormido, Kicker Rock, rising from the sea in the Galápagos"},
    {slug: "stone-shark-fin", queries: ["Shark Fin Cove Davenport", "Davenport California sea stack"], alt: "The rock fin at Shark Fin Cove near Davenport, California"},
    {slug: "desert-camel-sentinel", queries: ["Devrent Valley camel rock Cappadocia", "Cappadocia fairy chimney camel", "Camel Rock New Mexico"], alt: "Wind-carved rock in Cappadocia, where formations include a camel shape"},
    {slug: "coastal-seal-stone", queries: ["New Zealand fur seal rocks", "fur seal rocky shore"], alt: "A fur seal hauled out on a rocky shore"},
    {slug: "rain-frog-stone", queries: ["Australian green tree frog", "Litoria caerulea wet"], alt: "An Australian green tree frog on a wet branch"},

    {slug: "how-to-become-a-wildlife-guide-with-animaldex", queries: ["wildlife guide binoculars group trail", "nature guide leading hikers forest"], alt: "A guide walking a small group along a forest trail with binoculars"},
    {slug: "can-birders-make-money-as-local-guides", queries: ["birdwatching guide binoculars dawn", "birders wetland binoculars"], alt: "Birders with binoculars watching a wetland at dawn"},
    {slug: "how-to-start-offering-local-birding-experiences", queries: ["egrets rice field dawn", "egret wetland sunrise"], alt: "Egrets in a wetland at first light, the kind of dawn walk a local birding outing follows"},
    {slug: "how-herpers-can-turn-local-knowledge-into-guided-wildlife-experiences", queries: ["night hike headlamp forest", "people flashlight forest night"], alt: "A small group using lights on a forest path at night"},
    {slug: "what-makes-a-great-ethical-wildlife-guide", queries: ["deer forest distance watching", "people watching deer from distance"], alt: "People watching a deer from a distance at the edge of the woods"},
    {slug: "how-wildlife-photography-guides-can-find-new-clients", queries: ["wildlife photographer telephoto lens field", "photographer long lens savanna"], alt: "A wildlife photographer working with a long lens in the field"},

    {slug: "how-wildlife-photographers-can-build-a-digital-species-collection", queries: ["wildlife photographer reviewing photos", "photographer camera birds"], alt: "A photographer with a camera among wild birds"},
    {slug: "can-wildlife-photography-make-money", queries: ["wildlife photographer savanna", "photographer elephant distance"], alt: "A photographer at a distance from elephants on open ground"},
    {slug: "how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income", queries: ["boardwalk wetland birders", "people walking marsh boardwalk"], alt: "People walking a wetland boardwalk at sunrise"},
    {slug: "why-every-wildlife-photographer-should-track-the-species-they-photograph", queries: ["heron frog butterfly wetland", "grey heron fishing"], alt: "A heron hunting in shallow water, one entry in a species record"},
    {slug: "from-birding-to-herping-build-a-public-record-of-what-you-find", queries: ["robin bird perched", "European robin branch"], alt: "A robin perched on a branch, the sort of small bird a field list starts with"},
    {slug: "wildlife-photography-challenges-that-make-you-better-in-the-field", queries: ["dragonfly macro photograph", "photographer dragonfly close"], alt: "A dragonfly photographed up close in wet grass"},
    {slug: "how-animaldex-rewards-genuine-wildlife-contribution", queries: ["bird hide photographer", "photographer blind wetland bird"], alt: "A careful view of a wild bird from a hide"},

    {slug: "how-zoos-can-turn-visitors-into-active-wildlife-explorers", queries: ["zoo visitors watching elephant", "family watching elephant zoo"], alt: "Visitors paused in front of an elephant at a zoo"},
    {slug: "interactive-zoo-marketing-ideas-that-go-beyond-discount-tickets", queries: ["people sketching zoo", "zoo giraffe visitors"], alt: "Visitors looking up at a giraffe instead of rushing past the habitat"},
    {slug: "how-aquariums-can-use-digital-wildlife-challenges-to-increase-engagement", queries: ["jellyfish aquarium tank", "people watching jellyfish"], alt: "Jellyfish drifting in an aquarium tank"},
    {slug: "gamification-ideas-for-wildlife-parks-and-nature-attractions", queries: ["boardwalk nature reserve golden hour", "wildlife park trail deer"], alt: "A quiet boardwalk through a nature reserve in warm light"},
    {slug: "how-tourism-boards-can-build-wildlife-discovery-campaigns", queries: ["hikers binoculars mountain valley", "travelers looking national park"], alt: "Travelers with binoculars looking across a misty national park valley"},
    {slug: "what-is-a-sponsored-wildlife-challenge", queries: ["group birdwatching sunrise wetland", "birders walking together marsh"], alt: "A small group birding together across a wetland at sunrise"},
    {slug: "how-animaldex-sponsored-challenges-work-for-businesses", queries: ["zoo staff elephant habitat", "elephant watering hole visitors"], alt: "An elephant at a watering hole with people watching from a distance"},

    {slug: "how-to-find-ethical-herping-tours-and-local-reptile-guides", queries: ["snake on forest trail", "wild snake leaf litter"], alt: "A wild snake on the forest floor, seen and left alone"},
    {slug: "what-to-expect-on-a-guided-herping-trip", queries: ["tree frog on leaf night", "frog on wet leaf"], alt: "A tree frog on a wet leaf, the kind of find a slow herping walk looks for"},
    {slug: "how-to-choose-a-local-wildlife-guide", queries: ["two hikers trailhead binoculars dawn", "hikers meeting forest path sunrise"], alt: "Two hikers with binoculars meeting on a forest path at dawn"},
    {slug: "birding-guide-vs-going-alone", queries: ["solo birder reeds binoculars", "person alone binoculars marsh"], alt: "A birder alone with binoculars in the reeds"},
    {slug: "what-happens-on-a-night-wildlife-walk", queries: ["frog night forest", "moth night light"], alt: "A frog in the dark, typical of what a night wildlife walk is looking for"},
    {slug: "wildlife-photography-tours-what-to-look-for", queries: ["kingfisher perched branch", "common kingfisher branch"], alt: "A kingfisher perched on a branch, unstaged"},
    {slug: "how-to-find-ethical-wildlife-experiences-while-traveling", queries: ["macaque forest distance people", "monkeys in forest canopy"], alt: "Monkeys in the canopy, watched from the path rather than handled"},
    {slug: "best-types-of-wildlife-activities-for-animal-lovers", queries: ["shore crab tide pool", "tide pool wildlife"], alt: "A shore crab in a tide pool, one of many kinds of wildlife outing"},

    {slug: "biomimicry-in-animals", queries: ["great white shark swimming", "shark underwater close"], alt: "A shark gliding underwater, one of the animals behind biomimicry in design"},
    {slug: "capture-animals-app", queries: ["person photographing kingfisher", "photographing a small bird outdoors"], alt: "Someone photographing a small wild bird outdoors"},
    {slug: "how-to-estimate-animal-breed-prices", queries: ["maine coon cat portrait", "long haired cat and dog indoors"], alt: "A long-haired cat sitting in soft indoor light"},
    {slug: "how-to-create-custom-animal-card-decks", queries: ["bald eagle portrait", "eagle head close up"], alt: "A bald eagle portrait, the kind of image a collectible animal card is built around"},
    {slug: "what-animals-can-teach-us-about-self-improvement", queries: ["african wild dogs running", "wild dog pack savanna"], alt: "African wild dogs moving together across open ground"},

    {slug: "ugliest-animals", queries: ["blobfish", "naked mole rat", "goblin shark"], alt: "A naked mole-rat, one of the animals people most often call ugly"},
    {slug: "rankings-hub", queries: ["cheetah running savanna", "cheetah sprint"], alt: "A cheetah at full stretch, the kind of animal a speed ranking starts with"},
    {slug: "locations-hub", queries: ["rainforest canopy aerial", "tropical rainforest river aerial"], alt: "A tropical rainforest river seen from above"},
    {slug: "comparisons-hub", queries: ["lion and tiger", "male lion portrait savanna"], alt: "A male lion in warm savanna light"},

    {slug: "answer-scan", queries: ["bird feathers close up identification", "songbird close portrait"], alt: "A close portrait of a songbird, the kind of detail an identification starts from"},
    {slug: "answer-collection", queries: ["butterfly collection specimens drawer", "mounted butterflies drawer"], alt: "Butterflies arranged in a collection drawer"},
    {slug: "answer-learning", queries: ["owl perched dusk forest", "tawny owl branch"], alt: "An owl perched in a dark forest"},
    {slug: "answer-analysis", queries: ["red fox and wolf", "red fox forest portrait"], alt: "A red fox in the forest, shown clearly enough to compare with similar animals"},
    {slug: "answer-discovery", queries: ["kingfisher river jungle", "kingfisher diving"], alt: "A kingfisher beside a stream"},

    {slug: "id-scanner", aspect: "tall", queries: ["songbird close up portrait", "bird head feathers detail"], alt: "A close view of a wild bird's head and feathers"},
    {slug: "id-collection", aspect: "tall", queries: ["tiger face portrait", "bengal tiger portrait"], alt: "A tiger's face, kept as a portrait rather than a passing snapshot"},
    {slug: "id-comparisons", aspect: "tall", queries: ["bald eagle portrait", "vulture portrait close"], alt: "A bald eagle in a tight portrait for side-by-side comparison"},
    {slug: "id-lessons", aspect: "tall", queries: ["grey wolf portrait snow", "wolf face close"], alt: "A wolf's face in winter light"},

    {slug: "organize-years-of-wildlife-photos-by-species", queries: ["pile of printed photographs table", "photographer contact sheets"], alt: "Printed photographs spread on a table, ready to be sorted by subject"},
    {slug: "turn-instagram-wildlife-archive-into-species-collection", queries: ["camera binoculars stump forest", "dslr and binoculars outdoors"], alt: "A camera and binoculars set down at the edge of the woods"},
    {slug: "wildlife-photography-life-list", queries: ["notebook binoculars bird hide", "birding notebook binoculars"], alt: "Binoculars and a field notebook at a birding spot"},
    {slug: "wildlife-photography-app-vs-photo-gallery", queries: ["old photo prints stack", "scattered photo prints"], alt: "A loose stack of photo prints, the opposite of a species index"},
    {slug: "wildlife-photographers-public-species-portfolio", queries: ["leopard close portrait", "african leopard face"], alt: "A leopard's face, the kind of portrait a species portfolio is built from"},
    {slug: "wildlife-photos-sitting-on-instagram", queries: ["great blue heron marsh", "heron standing reeds"], alt: "A heron standing in the reeds"},
    {slug: "how-to-keep-a-herping-field-journal", queries: ["notebook forest floor", "field notebook moss"], alt: "A closed field notebook on the forest floor"},
    {slug: "reptile-amphibian-life-list", queries: ["red eyed tree frog", "Agalychnis callidryas"], alt: "A red-eyed tree frog on a leaf"},
    {slug: "organize-snake-reptile-photos-by-species", queries: ["tokay gecko", "gecko close up rock"], alt: "A gecko on rock, one species among many reptile photos"},
    {slug: "what-to-record-when-you-find-a-snake", queries: ["garter snake grass", "snake in grass distance"], alt: "A snake in the grass, observed without being approached"},
    {slug: "herping-photography-without-disturbing-wildlife", queries: ["lizard sunning rock telephoto", "collared lizard rock"], alt: "A lizard basking on a rock, photographed from a distance"},
    {slug: "herping-photos-searchable-collection", queries: ["poison dart frog", "blue poison dart frog"], alt: "A poison dart frog, bright enough to file under its own species"},
    {slug: "tools-for-tracking-herping-finds", queries: ["headlamp hiking backpack night", "flashlight hiking trail night"], alt: "A headlamp and pack on a night trail"},
    {slug: "wildlife-creators-need-a-species-archive", queries: ["snowy owl perched", "snowy owl"], alt: "A snowy owl perched"},
    {slug: "wildlife-photography-searchable-body-of-work", queries: ["african elephant herd walking", "elephant family savanna"], alt: "An elephant family walking across the savanna"},
    {slug: "wildlife-creator-profile-around-species", queries: ["bald eagle in flight", "bald eagle soaring"], alt: "A bald eagle in flight"},
    {slug: "preserve-context-behind-animal-encounters", queries: ["white tailed deer forest habitat", "deer standing in woods"], alt: "A deer standing in the woods, habitat included rather than cropped away"},
    {slug: "how-to-keep-track-of-animals-you-have-seen", queries: ["birder with binoculars", "woman binoculars birdwatching"], alt: "A birder raising binoculars"},
    {slug: "how-many-animals-have-you-already-encountered", queries: ["zebra herd savanna", "wildebeest and zebra"], alt: "Zebras on the savanna, part of a much larger set of animals a person might already have seen"},
    {slug: "already-seen-hundreds-of-animals-start-collection", queries: ["green sea turtle swimming", "sea turtle reef"], alt: "A green sea turtle swimming over a reef"}
];

const ALLOWED = new Set(["cc0", "pdm", "by", "by-sa"]);
const LICENSE_LABEL = {cc0: "CC0", pdm: "Public domain", by: "CC BY", "by-sa": "CC BY-SA"};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function search(query, aspect) {
    const url = new URL("https://api.openverse.org/v1/images/");
    url.searchParams.set("q", query);
    url.searchParams.set("license", "cc0,pdm,by,by-sa");
    url.searchParams.set("category", "photograph");
    url.searchParams.set("aspect_ratio", aspect);
    url.searchParams.set("page_size", "12");
    const response = await fetch(url, {headers: {"User-Agent": UA, Accept: "application/json"}});
    if (!response.ok) throw new Error(`Openverse ${response.status} for ${query}`);
    const body = await response.json();
    return body.results || [];
}

function usable(result, used) {
    if (!ALLOWED.has(result.license)) return false;
    if (used.has(result.id) || used.has(result.url)) return false;
    if (!result.url || !/^https?:/i.test(result.url)) return false;
    if ((result.width || 0) < 800) return false;
    const title = `${result.title || ""} ${result.tags?.map((tag) => tag.name).join(" ") || ""}`.toLowerCase();
    if (/diagram|infographic|logo|icon|poster|screenshot|illustration|drawing|painting|vector|map of|coat of arms/.test(title)) return false;
    return true;
}

async function download(url) {
    const response = await fetch(url, {headers: {"User-Agent": UA}, redirect: "follow"});
    if (!response.ok) throw new Error(`Download ${response.status}`);
    const type = response.headers.get("content-type") || "";
    if (!type.startsWith("image/")) throw new Error(`Not an image: ${type}`);
    return Buffer.from(await response.arrayBuffer());
}

async function main() {
    await mkdir(OUT_DIR, {recursive: true});
    const used = new Set();
    const manifest = [];
    for (const item of items) {
        const aspect = item.aspect || "wide";
        let chosen = null;
        let queryUsed = "";
        for (const query of item.queries) {
            try {
                const results = await search(query, aspect);
                chosen = results.find((result) => usable(result, used) && (aspect === "tall" ? result.height >= result.width : result.width > result.height));
                if (!chosen) chosen = results.find((result) => usable(result, used));
                queryUsed = query;
                if (chosen) break;
            } catch (error) {
                console.error("search failed", item.slug, query, error.message);
            }
            await sleep(250);
        }
        if (!chosen) {
            console.error("MISS", item.slug);
            manifest.push({slug: item.slug, alt: item.alt, error: "no result"});
            continue;
        }
        used.add(chosen.id);
        used.add(chosen.url);
        try {
            const input = await download(chosen.url);
            const image = sharp(input, {failOn: "none"}).rotate();
            const meta = await image.metadata();
            const max = aspect === "tall" ? 1200 : 1600;
            const output = await image
                .resize({width: max, height: max, fit: "inside", withoutEnlargement: true})
                .webp({quality: 76, effort: 5})
                .toBuffer({resolveWithObject: true});
            const file = path.join(OUT_DIR, `${item.slug}.webp`);
            await writeFile(file, output.data);
            const credit = `Photo by ${chosen.creator || "unknown"}, ${LICENSE_LABEL[chosen.license] || chosen.license}`;
            manifest.push({
                slug: item.slug,
                alt: item.alt,
                caption: credit,
                width: output.info.width,
                height: output.info.height,
                bytes: output.data.length,
                license: chosen.license,
                creator: chosen.creator,
                source: chosen.foreign_landing_url || chosen.url,
                title: chosen.title,
                query: queryUsed
            });
            console.log("OK", item.slug, output.info.width, output.info.height, output.data.length, chosen.license, chosen.title);
        } catch (error) {
            console.error("DOWNLOAD FAIL", item.slug, error.message);
            manifest.push({slug: item.slug, alt: item.alt, error: error.message, url: chosen.url});
        }
        await sleep(200);
    }
    await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
    const misses = manifest.filter((row) => row.error);
    console.log(`done ${manifest.length - misses.length}/${items.length} misses=${misses.length}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

const {readdir, stat, writeFile} = require("fs/promises");
const path = require("path");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"]);
const publicRoot = path.join(process.cwd(), "public");
const imageRoot = path.join(publicRoot, "images");
const outFile = path.join(process.cwd(), "src/data/public-image-assets.json");

async function visit(directory, assets) {
    const entries = await readdir(directory, {withFileTypes: true});
    for (const entry of entries) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            await visit(absolutePath, assets);
            continue;
        }
        if (!entry.isFile() || !IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
        const fileStat = await stat(absolutePath);
        const relativePath = path.relative(publicRoot, absolutePath).split(path.sep).join("/");
        assets.push({
            path: `public/${relativePath}`,
            url: `/${relativePath.split("/").map(encodeURIComponent).join("/")}`,
            filename: entry.name,
            createdAt: fileStat.mtime.toISOString(),
            source: "Website",
            metadata: {size: fileStat.size, mimetype: `image/${path.extname(entry.name).slice(1).toLowerCase()}`}
        });
    }
}

async function main() {
    const assets = [];
    try {
        await visit(imageRoot, assets);
    } catch (error) {
        if (error && error.code !== "ENOENT") throw error;
    }
    assets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    await writeFile(outFile, `${JSON.stringify(assets)}\n`);
    console.log(`Wrote ${assets.length} public image assets to ${path.relative(process.cwd(), outFile)}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

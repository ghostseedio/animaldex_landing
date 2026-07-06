#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
    args.set(process.argv[index], process.argv[index + 1]);
}

const sourcePath = args.get("--source") ?? "/tmp/native_range_countries.geojson";
const outputDir = args.get("--output") ?? path.resolve("public/images/native-range");
const d3ModuleCandidates = [
    args.get("--d3-module"),
    path.resolve("node_modules/d3-geo/src/index.js"),
    path.resolve(".native-range-build/node_modules/d3-geo/src/index.js")
].filter(Boolean);

const width = 900;
const height = 540;
const padding = 24;
const worldAssetName = "world_base";

const d3ModulePath = d3ModuleCandidates.find((candidate) => fs.existsSync(candidate));

if (!d3ModulePath) {
    console.error("Could not find d3-geo. Run: npm install --prefix ./.native-range-build d3-geo");
    process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
    console.error(`GeoJSON source not found: ${sourcePath}`);
    process.exit(1);
}

const {geoCircle, geoNaturalEarth1, geoPath} = await import(pathToFileURL(d3ModulePath).href);

const regions = {
    north_america: [
        "Belize", "Bermuda", "Canada", "Costa Rica", "Cuba", "Dominican Republic", "El Salvador", "Greenland",
        "Guatemala", "Haiti", "Honduras", "Jamaica", "Mexico", "Nicaragua", "Panama", "Puerto Rico", "The Bahamas",
        "Trinidad and Tobago", "United States of America"
    ],
    south_america: [
        "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Falkland Islands", "French Guiana",
        "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela"
    ],
    europe: [
        "Albania", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Czech Republic",
        "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy",
        "Kosovo", "Latvia", "Lithuania", "Luxembourg", "Macedonia", "Malta", "Moldova", "Montenegro", "Netherlands",
        "Norway", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine",
        "United Kingdom"
    ],
    north_africa_middle_east: [
        "Algeria", "Armenia", "Azerbaijan", "Cyprus", "Egypt", "Georgia", "Iran", "Iraq", "Israel", "Jordan", "Kuwait",
        "Lebanon", "Libya", "Mauritania", "Morocco", "Northern Cyprus", "Oman", "Qatar", "Saudi Arabia", "Sudan",
        "Syria", "Tunisia", "Turkey", "United Arab Emirates", "West Bank", "Western Sahara", "Yemen"
    ],
    sub_saharan_africa: [
        "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Central African Republic", "Chad",
        "Democratic Republic of the Congo", "Djibouti", "Equatorial Guinea", "Eritrea", "Ethiopia", "Gabon", "Gambia",
        "Ghana", "Guinea", "Guinea Bissau", "Ivory Coast", "Kenya", "Lesotho", "Liberia", "Madagascar", "Malawi", "Mali",
        "Mozambique", "Namibia", "Niger", "Nigeria", "Republic of the Congo", "Rwanda", "Senegal", "Sierra Leone",
        "Somalia", "Somaliland", "South Africa", "South Sudan", "Swaziland", "Togo", "Uganda", "United Republic of Tanzania",
        "Zambia", "Zimbabwe"
    ],
    central_asia: [
        "Afghanistan", "Kazakhstan", "Kyrgyzstan", "Mongolia", "Russia", "Tajikistan", "Turkmenistan", "Uzbekistan"
    ],
    south_asia: ["Bangladesh", "Bhutan", "India", "Nepal", "Pakistan", "Sri Lanka"],
    southeast_asia: [
        "Brunei", "Cambodia", "East Timor", "Indonesia", "Laos", "Malaysia", "Myanmar", "Philippines", "Thailand", "Vietnam"
    ],
    east_asia: ["China", "Japan", "North Korea", "South Korea", "Taiwan"],
    australia_oceania: ["Australia", "Fiji", "New Caledonia", "New Zealand", "Papua New Guinea", "Solomon Islands", "Vanuatu"]
};

const geojson = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const features = geojson.features ?? [];
const byName = new Map(features.map((feature) => [feature.properties?.name, feature]));

const projection = geoNaturalEarth1().fitExtent(
    [[padding, padding], [width - padding, height - padding]],
    {type: "Sphere"}
);
const pathGenerator = geoPath(projection);

function ensureDir(directory) {
    fs.mkdirSync(directory, {recursive: true});
}

function polygonPath(featureSet) {
    return featureSet
        .map((feature) => pathGenerator(feature))
        .filter(Boolean)
        .join(" ");
}

function svgDocument(pathData) {
    return [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        `<rect width="${width}" height="${height}" fill="none"/>`,
        `<path d="${pathData}" fill="#000000" stroke="none" fill-rule="evenodd"/>`,
        `</svg>`
    ].join("\n");
}

function writeSvg(assetName, pathData) {
    ensureDir(outputDir);
    fs.writeFileSync(path.join(outputDir, `${assetName}.svg`), svgDocument(pathData));
}

writeSvg(worldAssetName, polygonPath(features));

for (const [regionKey, countryNames] of Object.entries(regions)) {
    const regionFeatures = countryNames
        .map((countryName) => byName.get(countryName))
        .filter(Boolean);

    if (regionFeatures.length === 0) {
        throw new Error(`No features matched for ${regionKey}`);
    }

    writeSvg(`range_${regionKey}`, polygonPath(regionFeatures));
}

const arcticCircle = geoCircle().center([0, 90]).radius(24).precision(2)();
const antarcticCircle = geoCircle().center([0, -90]).radius(30).precision(2)();
writeSvg("range_arctic_antarctic", polygonPath([arcticCircle, antarcticCircle]));
writeSvg("range_southern_ocean", polygonPath([antarcticCircle]));
writeSvg("range_arctic_ocean", polygonPath([arcticCircle]));

console.log(`Generated native range SVG assets in ${outputDir}`);

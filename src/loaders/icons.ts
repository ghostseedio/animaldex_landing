import {default as icons} from "@/data/icons.json";
import {PathData} from "@/app/[locale]/_components/icon-canvas";

// This is needed because TypeScript doesn't support `as const` for JSON imports,
// so it thinks that the `fillRule` property can be any string. (It can't.)
export const checkedIcons = icons.filter((i): i is PathData =>
    i.fillRule === "nonzero" || i.fillRule === "evenodd"
);
const animalIconNames = new Set(["Paw", "Fish", "Bird", "Butterfly", "Turtle", "Cat Head", "Rabbit", "Crab", "Frog", "Owl"]);

// Fallback shapes for silhouette canvases while the species art loads.
export const animalIcons = checkedIcons.filter((i) => animalIconNames.has(i._name));

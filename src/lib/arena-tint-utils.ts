import type {ArenaModuleAccent} from "@/lib/app-module-thumbnails";

export function arenaAccentBlendColor(accent: ArenaModuleAccent) {
    switch (accent) {
        case "violet":
            return "rgba(167, 139, 250, 0.24)";
        case "orange":
            return "rgba(251, 146, 60, 0.24)";
        case "cyan":
            return "rgba(34, 211, 238, 0.24)";
        default:
            return "rgba(192, 132, 252, 0.24)";
    }
}

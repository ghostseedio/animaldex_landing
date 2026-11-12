/** One line about the plan: land, buildings, households, farms, zoo slots (for the plan picture and the reports). */

import type {TownPlan} from "@/ark-scene/islands/town/plan";

export function townAreaSummary(plan: TownPlan, land: number): string {
    const count = (kind: string) => plan.buildings.filter((b) => b.kind === kind).length;
    const households = plan.buildings.reduce((sum, b) => sum + b.households, 0);
    return `land ${(land / 10000).toFixed(2)} ha · houses ${count("house")} · terraces ${count("terrace")} · flats ${count("flats")} · homes ${count("house") + count("terrace") + count("flats")} · households ${households} · buildings ${plan.buildings.length} · farms ${plan.farms.length} · zoo slots ${plan.zoo.slots.length}`;
}

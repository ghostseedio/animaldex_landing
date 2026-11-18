/**
 * Development's crises (`/ark/endangered?fixture=crises`): the contract's example answer (AnimalDex
 * docs/ark/audits/ecosystem/crises-api-contract.md, `crises-fixture.json`), with its times moved to be 5 hours, 2
 * hours and 27 hours before `now`. Made-up data, never in production (the page only reads it under `next dev`).
 * `&fixture=crises-ended` adds a crisis that was saved and one that ended extinct, as a shared link to an ended crisis
 * would show.
 */

export const ARK_CRISES_FIXTURE_IDS = {
    boar: "6f3c0f4e-2f7b-4c53-9a31-1d6a8c0a5b01",
    squirrel: "2a9e5d71-6c0b-4e86-b3f4-7d1c9a2e4c02",
    lynx: "9d4b7c13-8e2a-4f59-a6c0-3b5e1d7f9a03",
    saved: "4c8d2e60-7a1b-4d93-8e5f-2a6c0b9d1e04",
    extinct: "7e1a9b35-5c4d-4f20-a8b6-1d3e5f7a9c05"
} as const;

const HOUR = 3_600_000;

export function arkCrisesFixture(now = Date.now(), ended = false): {available: true; ark_day: number; as_of: string; crises: Array<Record<string, unknown>>} {
    const ago = (hours: number) => new Date(now - hours * HOUR).toISOString();
    const day = (hours: number) => Math.round((262.4 - hours / 1.1) * 10) / 10;
    const open = [
        {
            id: ARK_CRISES_FIXTURE_IDS.boar,
            species_profile_id: "0b1d6a0e-4c5e-4a45-8d3a-5f0f1e6c7a11",
            name: "Wild Boar",
            scientific_name: "Sus scrofa",
            model_slug: "wild-boar",
            page_slug: "wild-boar",
            band: "last",
            status: "open",
            wild_count: 1,
            opened_ark_day: day(5),
            opened_at: ago(5),
            ended_ark_day: null,
            ended_at: null,
            last_animal_ids: ["b7f4a3d2-9e1c-4b6a-8f20-3c5d7e9a1b02"],
            habitat: "Broadleaf and mixed forest, scrub and marshy edges.",
            countries: ["DE", "PL", "FR"]
        },
        {
            id: ARK_CRISES_FIXTURE_IDS.squirrel,
            species_profile_id: "5c2e8f90-1a7d-4b3e-9c64-0e8b2d4f6a22",
            name: "Red Squirrel",
            scientific_name: "Sciurus vulgaris",
            model_slug: "red-squirrel",
            page_slug: "red-squirrel",
            band: "critical",
            status: "open",
            wild_count: 2,
            opened_ark_day: day(2),
            opened_at: ago(2),
            ended_ark_day: null,
            ended_at: null,
            last_animal_ids: ["c1a2b3d4-5e6f-4a7b-8c9d-0e1f2a3b4c03", "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f04"],
            habitat: "Conifer and mixed woodland with a continuous canopy.",
            countries: ["GB", "IE", "FR", "SE"]
        },
        {
            id: ARK_CRISES_FIXTURE_IDS.lynx,
            species_profile_id: "8e6a0c42-3d1f-4a95-b7e8-6c4a2f0d1b33",
            name: "Eurasian Lynx",
            scientific_name: "Lynx lynx",
            model_slug: "eurasian-lynx",
            page_slug: "eurasian-lynx",
            band: "critical",
            status: "open",
            wild_count: 2,
            opened_ark_day: day(27),
            opened_at: ago(27),
            ended_ark_day: null,
            ended_at: null,
            last_animal_ids: ["e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a05", "f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f7a8b06"],
            habitat: "Dense forest with rocky ground, from lowland woods to mountain slopes.",
            countries: ["NO", "SE", "FI"]
        }
    ];
    const over = ended
        ? [
              {
                  id: ARK_CRISES_FIXTURE_IDS.saved,
                  species_profile_id: "1a3c5e70-9b2d-4f48-a6c1-8e0d2b4f6a44",
                  name: "Snow Leopard",
                  scientific_name: "Panthera uncia",
                  model_slug: "snow-leopard",
                  page_slug: "snow-leopard",
                  band: "last",
                  status: "saved",
                  wild_count: 2,
                  opened_ark_day: day(60),
                  opened_at: ago(60),
                  ended_ark_day: day(30),
                  ended_at: ago(30),
                  last_animal_ids: ["a8b9c0d1-e2f3-4a4b-8c5d-6e7f8a9b0c07"],
                  habitat: "Steep, rocky mountain slopes above the tree line.",
                  countries: ["CN", "MN", "NP"]
              },
              {
                  id: ARK_CRISES_FIXTURE_IDS.extinct,
                  species_profile_id: "2b4d6f81-0c3e-4a59-b7d2-9f1e3c5a7b55",
                  name: "Giant Panda",
                  scientific_name: "Ailuropoda melanoleuca",
                  model_slug: "giant-panda",
                  page_slug: "giant-panda",
                  band: "last",
                  status: "extinct",
                  wild_count: 0,
                  opened_ark_day: day(80),
                  opened_at: ago(80),
                  ended_ark_day: day(50),
                  ended_at: ago(50),
                  last_animal_ids: [],
                  habitat: "Cool, damp bamboo forest in mountain ranges.",
                  countries: ["CN"]
              }
          ]
        : [];
    return {available: true, ark_day: 262.4, as_of: new Date(now).toISOString(), crises: [...open, ...over]};
}

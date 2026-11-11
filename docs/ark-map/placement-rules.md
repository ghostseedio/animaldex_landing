# Ark map: placement rules by type (B3/B4)

The owner's "realistic placement for every animal" list (brief "extreme detail + realistic spawning", section 2), and how the map follows each rule. Code: `src/ark-scene/map/place.ts`, `points.ts`, `water.ts`. Checks: `src/ark-scene/map/validate.ts`, run in CI by `src/lib/ark-map.test.ts` (the report is `validator.md`).

Every place is a pure function of the terrain (the graphics lane's `sampler.ts`), the animal's zone, its slot and rank (from the server) and its species. Nobody moves when another animal arrives or leaves, and every viewer sees the same Ark.

## Who goes where, in order

1. **Held**: they wait at the landing. That is decision 2 (the Antarctic 12), the head louse, decision 5's no-text, no-zone species that have an Ark model (3; 38 more have no model and never come aboard), and the reviewed holds. A held water species waits in the sea off the shore (or the lake), never on the beach.
2. **Divers that haul out** (`shoreOf`; the owner, 2026-11-11: "penguins floating in the ocean"): they stand on dry land within 7 m of the sea, a colony one spot each and close together, and that spot is their home and their rest.
   - The cold cove (its ice runs down to the sea; its rocky shore beside it) takes the Antarctic and sub-Antarctic penguins, the polar seals and the walrus, and the held Antarctic species.
   - Their own warm coast's rocks and beach take the warm-water penguins (African, Humboldt, Galápagos, Magellanic), the other seals and the sea lions.
   - The auks the table puts at sea get their cliffs and rocks.
   - In the water they swim under the surface in the upper band and come up to breathe (`sea-depth.ts` diverDepth). A penguin lies down to swim (`swimBodyPitch`).
3. **Water species** (they have a band in `depth-bands.json`): by their depth band, never by a land map tag (`water.ts`).
   - Pond bands: the lake's open water, as sea-depth places them.
   - Coast species, and sea species of a land or shore zone: the sea off their zone's coast, as sea-depth places them.
   - A reef or open-ocean zone's own species: a cell of their band's water. Reef on the reef; seabed on the floor under 7.5 m; deep in deep water (7.5 m and more); surface, upper and mid sharing the open water on a fixed pattern. Every cell is at least 1.2 m deep, inside the ring the camera sees.
   - A small salt-water floor species of the rocky shore (a limpet, a shore crab): a tide pool.
   - A floor species (a crab, a star, a flatfish; an octopus or a moray in its hole) keeps half its body clear of the reef lane's coral heads and the cleaning station's coral (`reef.ts` reefLandmarks), so it is never drawn inside one. The map's anemone and cleaning-station anchors (the reef site −3, −2 and +4, +3) are where the reef lane draws them: keep them there.
4. **Small animals** (size stat 15 or less): an attach point of the graphics lane's scenery whose tag their text names and whose size fits them (`attachOf`), each list thinned to 1.2 body lengths apart. Only small invertebrates under 12 cm are micro animals (`trueMicro`, from `body.json`). A small bird, bat, mammal, lizard or frog is perched on its point (`perch`), which is its home and fixed roost on the behaviour schedule. Bats take hang points under limbs first. A perched cluster's members each take a point of their own, 1.5 body lengths apart (a puffin colony's ledges).
5. **Tree animals**: hangers and leapers always, and canopy-layer climbers and perchers whose text names the trees (not only as their roost). A large one takes a thick `limb` of the real forest that fits it, holds its mass with a margin of 1.5, and has room above it; a hanger takes a `canopy_hang` point with the drop below it (`limbsFor`). With no fitting limb, it takes a canopy tree's limb (`arborealOf`, `layers.ts`).
6. **Everyone else**: a cell of their tag (`points.ts`). Each 2.5 m cell belongs to one tag, shared out by the launch points each tag needs in its zone. The launch points come first in a zone's list. Slot k takes cell k mod n, lap k div n (a fixed half-cell offset), so no two clusters ever take one spot. Their tags are tried in their text's order, up to each tag's first lap.
7. **Partners**: attached to a host of their group when one is aboard, otherwise at their own spot (section 6 of the plan).

## The owner's rules

| Rule | How | Checked by |
|---|---|---|
| Ground animals on the terrain surface, never floating or sinking, never inside rocks, trees or buildings | the ground's height at a cell clear of scenery for the body's radius; walkers, crawlers, hoppers and diggers only where behaviour's walk grid lets them walk (slope 0.9, the mountains zone 2.4) | `floats_or_sinks`, `inside_scenery`, `off_walk_grid` |
| Surface crawlers on any surface (ground, trunks, branches, leaves, rocks, walls, the ceiling under the porch), aligned to it; geckos and spiders upside down | the graphics lane's attach points (`sampler.ts`; leaves, bark and branches on the drawn asset trees): leaf, branch, bark, rock face, house wall, flower head, leaf litter, and `house_eave` (upside down, crawlers and climbers only); on a tree they sway with it each frame (`attachSway`) | `small_not_on_attach_point`, `invalid_surface`, `wrong_facing` (back along the point's normal, heading along the surface) |
| Perchers only on real branches, rock tops, cliff ledges, roof edges, fence posts | small perchers on attach points (never in a hole); tree perchers on a canopy limb, or on the crown | `invalid_surface` (a flyer in a worm hole or burrow; a tree percher on the ground) |
| Hangers, climbers and perchers grip the branch | on the drawn limb's own surface, a hanger under it with its back down; the scene seats the rig's supporting grip bones, not its underside, on the point (`grip.ts`) | `floats_or_sinks` (off the limb's surface), `wrong_facing`; the rig check `validate-grips.ts` (needs the local rig files; CI skips it) |
| Flyers land only at valid perches, the ground or the water | as above; altitude bands are the behaviour and rig lanes' | as above |
| Burrowers in soil or sand, emerging at their entrance | a small burrower's burrow entrance is its attach point (worm hole, burrow), the chamber below; a large one's burrow under its spot | `floats_or_sinks` (the chamber not underground, the entrance not its point) |
| Sessile animals fixed to rock, reef or hosts | sea sessiles by their band (on the floor, clear of the coral heads); a small shore one in a tide pool | `wrong_depth_band`, `wrong_water`, `inside_scenery` (in a coral head) |
| Animals on hosts: attached to a present host, otherwise their fallback spot | riders on a grazer's back or under a shark, followers at a grazer's feet, parasites beside the host (never harming it) | `floats_or_sinks` (off its host), `wrong_medium` (a rider out of its host's medium) |
| Sleeping animals at their roost, nest, den or burrow at night | the roost from `sleep_pattern` within the animal's reach: a burrow, a tree, an attach point or ground of that tag | `roost_invalid` (at midnight and noon, by the behaviour lane's state) |
| Water species in their band, salt or fresh | `water.ts` | `wrong_water`, `wrong_depth_band` (per class), `floats_or_sinks` (its loop leaves the water) |
| Predators kept from their prey at spawn | behaviour's `spaceHomes` moves a predator's home away; the map's `mapHabitatAt` keeps the moved home on the predator's own ground (one hook line in `index.ts`) | `ark-map.test.ts`: at least 20 m on both fixtures (now 29.7 and 37.2 m at the closest) |

## Open

- **Rig clips that lift too many feet** on a branch or wall (8 species: 3 spiders, 3 wasps, a motmot, a lory). They are reviewed in `validator-holds.json` and are the rig lane's to fix.
- **Fence posts**: the map takes `fence_post` points, but none exist until the props lane publishes its paddock and picket fences' post tops (graphics-interface.md, "Fences the props lane draws").
- **Launch points**: the table asks for 481. 412 stand on the ground or in the water, because some tags in some zones have fewer cells than they want. The canopy's 92 are the canopy trees' limbs (`layers.ts`), not ground cells.

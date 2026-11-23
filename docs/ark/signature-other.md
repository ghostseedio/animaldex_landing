# Signature behaviours outside defence, group life, young care and hunting (lane SIG-OTHER, 2026-11-20)

The catalogue (AnimalDex `docs/ark/signature-behaviours.json`, decision 367) has 2,952 rows. This lane takes the themes the
other signature lanes do not: signature, look change, courtship, territory, contest, partnership, nest building, seasonal,
birth, migration, hibernation, web, tool use, dung. It builds the M and L rows the scene did not show yet, most-seen species
first (aboard counts from the real Ark, 2026-11-20), and only through shared builds that read the species' own row: nothing
is drawn for a species whose row does not say it, every entry keeps the row's quote, and the data is built by a script from
the catalogue, never edited by hand.

## What is built

**Look states** (`src/ark-scene/look-state.ts`, `look-states.json`, `scripts/ark-look-states.mts`; shader pieces in
`animal-look-shader.ts`; the antler cycle's way: no new draw call, texture, attribute or download).

- *The night* (16 species): a tone by the island's daylight, so it costs nothing per animal and every viewer sees the same:
  the house geckos and the wall gecko pale, the crested gecko goes darker and richer (its own row says so), goldfish,
  guppy, Siamese fighting fish, tetras, tiger barb, angelfish, a yellow tang and a gourami fade, a veiled chameleon fades to
  pale green, and a Carolina wolf spider's eyes shine green (a glow: the tone's colour added as light, on the eyes too).
- *Displays that swell* (13 species): a region of the model's rest pose pushed out along its normals by the animal's strength
  (the vertex shader): a green iguana's, green anole's and brown anole's dewlap (pink, orange), an oriental garden lizard's red
  throat and a forest lizard's puffed throat in their push-ups, a veiled chameleon's inflated body and flared colours in its
  contest, the vocal sacs of a bullfrog, a marsh frog (paired, grey, at the cheeks) and a Great Plains toad while they call, a
  grey crowned crane's red throat sac, a siamang's throat sac, a frigatebird's red pouch, a starling's puffed throat. The
  strength follows the recipe block the animal is in now (`pushup`/`display`, `call`), sex-gated where the row says "male".
- *Cheeks that fill* (4 species): a long-tailed macaque's, a Campbell's dwarf hamster's, an eastern chipmunk's and a
  mandrill's cheek pouches fill while it takes food and stay full for a while after.
- *Seasons* (10 species, by the Ark year's month, the seeded sex): a mallard and a mandarin drake's drab eclipse plumage, a
  black-headed gull's brown hood and a great crested grebe's chestnut ruff in the species' stored mating months, a winter
  white dwarf hamster's grey-brown outside winter, a five-lined skink's orange jaws, a spider mite's winter orange-red, a
  white-tailed deer's and a red deer's thickened autumn neck, a raccoon dog's autumn fattening.
- The state rides in `arkCoat.y` above the antlers' 32s (512 each, 0-15). The antler decode in both shaders is now
  `mod(floor(y/32), 16)`.

**Flights** (`recipe-templates.ts`, `data/ark/signature-recipes-other.json`, `scripts/ark-signature-flights.mts`, applied by
`scripts/ark-signature-recipes.mts`): `sally_chase` (a male holds a perch and darts out and back: 12 dragonflies,
butterflies, a bee fly and a carpenter bee), `patrol_low` (a male patrols low over his ground: 4 moths, butterflies and a
wasp), `display_flight` (a dove or pigeon climbs steeply and glides down: 3). A "here" stay now respects a template's sex.

**Tail postures** (`tail-posture.ts`, `tail-postures.json`, `scripts/ark-tail-postures.mts`; the legged driver's tail
chain): a dog's tail wags as a social signal (it looks at another animal or the camera, or is at play), a coati carries its
ringed tail straight up while it walks, a chipmunk runs with its tail up, a hamadryas baboon holds it in an arch, an olive
baboon bends it near the base, a toque macaque carries it in an S.

## Held, and why

`look-states.json` `skipped`, `signature-recipes-other.json` `held` and `tail-postures.json` `skipped` name every row looked
at and not drawn, with the reason: no stored mating months to say when (tiger barb, tilapia, iguana, skinks, lizards), shapes
(plumes, rolls and tumbles), a pair in tandem, a plunge that needs a flight block that does not exist, a row that needs the
scene to know when something has fed.

## Checking it

`node scripts/ark-behaviours-clips.mjs --out <dir> --scenes lsdewlap,lssac,lscheek,lsfish,lsland,lsseasonwater,lsseasonland`
(each species close up with its state off and on; the night scenes move the clock to 01:00), `--scenes sally,sallyb,patrol,display`
(a male followed through the act), `--scenes tails`. Coverage: `npx tsx scripts/ark-signature-other-coverage.mts --catalogue <catalogue>`
writes `data/ark/signature-other-coverage.json`.

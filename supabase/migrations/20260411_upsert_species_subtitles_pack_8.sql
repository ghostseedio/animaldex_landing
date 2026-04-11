with seeds (slug, name, category, trait_1, trait_2, trait_3, habitat, descriptor) as (
    values
        ('xantus-hummingbird', 'Xantus''s Hummingbird', 'Bird', 'emerald-green upperparts', 'slender curved nectar bill', 'rapid flower-to-flower hovering', 'oasis thicket, dry scrub, and flowering desert woodland', 'The emerald oasis hummingbird animal'),
        ('xantus-murrelet', 'Xantus''s Murrelet', 'Bird', 'small black-and-white seabird body', 'fast low skimming flight', 'night colony return to islands', 'rocky island coast, offshore sea, and marine cliff habitat', 'The night-returning murrelet animal'),
        ('xeme', 'Xeme', 'Bird', 'forked tail in flight', 'sharp black hood in breeding season', 'buoyant ocean-edge gliding', 'Arctic tundra coast, estuary, and open pelagic sea', 'The fork-tailed polar gull animal'),
        ('x-ray-tetra', 'X-ray Tetra', 'Fish', 'semi-transparent silver body', 'yellow-and-black fin tips', 'tight schooling freshwater movement', 'slow river, floodplain pool, and planted freshwater habitat', 'The glass-bodied schooling fish animal'),
        ('uakari', 'Uakari', 'Mammal', 'bare bright-red face', 'short tail', 'high-canopy seed-cracking troop life', 'flooded forest, riverine canopy, and humid lowland woodland', 'The red-faced canopy monkey animal'),
        ('uinta-ground-squirrel', 'Uinta Ground Squirrel', 'Mammal', 'short upright sentinel posture', 'tan alpine-meadow coat', 'burrow-linked colony behavior', 'mountain meadow, sagebrush flat, and alpine grassland edge', 'The meadow sentinel squirrel animal'),
        ('upland-goose', 'Upland Goose', 'Bird', 'bold white male plumage', 'barred brown female coat', 'windswept grassland pair life', 'coastal grassland, upland plain, and open Patagonian scrub', 'The windswept grassland goose animal'),
        ('ultramarine-lorikeet', 'Ultramarine Lorikeet', 'Bird', 'deep ultramarine-blue plumage', 'brush-tipped nectar tongue', 'flowering-canopy flock movement', 'island forest, coconut grove, and flowering tropical woodland', 'The ultramarine island lorikeet animal'),
        ('ugandan-kob', 'Ugandan Kob', 'Mammal', 'sleek chestnut antelope body', 'lyre-curved horns', 'lek-based open-grassland display', 'savannah grassland, floodplain edge, and open woodland', 'The lek-dancing kob animal'),
        ('zebra-finch', 'Zebra Finch', 'Bird', 'barred tail and chest patterning', 'bright orange beak', 'constant social chirping', 'arid grassland, scrub, and dry woodland', 'The striped song finch animal'),
        ('zebra-longwing', 'Zebra Longwing', 'Insect', 'long narrow black-and-yellow wings', 'slow floating forest flight', 'pollen-feeding butterfly behavior', 'forest edge, garden, and humid tropical scrub', 'The ribbon-striped butterfly animal'),
        ('zander', 'Zander', 'Fish', 'elongated predatory body', 'spiny dorsal fins', 'dim-water ambush hunting', 'river, reservoir, and deep freshwater lake habitat', 'The twilight ambush pikeperch animal'),
        ('zokor', 'Zokor', 'Mammal', 'mole-like powerful digging limbs', 'tiny hidden eyes', 'subterranean tunnel engineering', 'alpine meadow soil, steppe, and upland grassland', 'The tunnel-forging zokor animal'),
        ('zone-tailed-hawk', 'Zone-tailed Hawk', 'Bird of prey', 'vulture-mimicking dark soaring silhouette', 'broad banded tail', 'stealth approach over open country', 'canyon, woodland, and open scrubland edge', 'The mimic-soaring hawk animal')
)
insert into public.species_subtitles (locale, slug, descriptor, subtitle_story)
select
    'en',
    slug,
    descriptor,
    'The ' || name || ' is a ' || lower(category) || ' with ' || lower(trait_1) || ', ' || lower(trait_2) || ', and ' || lower(trait_3) || '. It belongs to ' || lower(habitat) || ' where those traits help it stay effective.'
from seeds
on conflict (locale, slug) do update
set descriptor = excluded.descriptor,
    subtitle_story = excluded.subtitle_story,
    updated_at = timezone('utc', now());

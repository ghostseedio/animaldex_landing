begin;

lock table public.species_profiles in share row exclusive mode;

alter table public.species_subtitles
    drop constraint if exists species_subtitles_descriptor_format;

alter table public.species_subtitles
    add column if not exists species_profile_id uuid,
    add column if not exists subtitle text,
    add column if not exists source text;

create unique index if not exists species_subtitles_species_profile_locale_key
    on public.species_subtitles (species_profile_id, locale)
    where species_profile_id is not null;

create unique index if not exists species_behavior_principles_species_profile_id_key
    on public.species_behavior_principles (species_profile_id);

create unique index if not exists animal_value_profiles_species_profile_id_key
    on public.animal_value_profiles (species_profile_id);

with seed_animals as (
    select *
    from jsonb_to_recordset($seed$[
  {
    "normalized_identity_key": "tremoctopus_spp",
    "landing_page_slug": "blanket-octopus",
    "display_name": "Blanket Octopus",
    "animal_name": "Octopus",
    "scientific_name": "Tremoctopus spp.",
    "refined_identity": "Blanket Octopus",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 62,
      "speed": 58,
      "size": 54,
      "intelligence": 77,
      "rarity": 91
    },
    "size_scale_score": 54,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "blanket-octopus.png",
      "notes": "Genus-level profile for blanket octopuses."
    },
    "subtitle": {
      "descriptor": "Living ribbon of the open sea",
      "subtitle_story": "Blanket octopuses drift through warm open oceans with flowing webbing that can unfurl like a living cape. Females are dramatically larger than males, and their flexible bodies turn softness, display, and surprise into survival tools.",
      "subtitle": "Living ribbon of the open sea. Blanket octopuses drift through warm open oceans with flowing webbing that can unfurl like a living cape. Females are dramatically larger than males, and their flexible bodies turn softness, display, and surprise into survival tools."
    },
    "behavior_principle": {
      "principle_name": "Display",
      "principle_expression": "Expand your presence when the moment calls for it.",
      "core_lesson": "Softness does not mean weakness; sometimes the best defense is visible confidence.",
      "biological_basis": "Blanket octopuses can spread dramatic webbing to appear larger and more difficult to attack in open water.",
      "short_motto": "Unfurl your power.",
      "best_use_cases": [
        "confidence",
        "visibility",
        "creative defense"
      ]
    },
    "value_profile": {
      "value_low": 18000,
      "value_typical": 52000,
      "value_high": 120000,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 91,
      "conservation_rarity": 76,
      "habitat_cost": 88,
      "public_interest": 83,
      "source_notes": "Open-ocean cephalopod stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Warm pelagic oceans and tropical/subtropical open water.",
      "range_text": "Tropical and subtropical oceans worldwide."
    }
  },
  {
    "normalized_identity_key": "glaucus_atlanticus",
    "landing_page_slug": "blue-glaucus",
    "display_name": "Blue Glaucus",
    "animal_name": "Sea Slug",
    "scientific_name": "Glaucus atlanticus",
    "refined_identity": "Blue Glaucus",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 57,
      "speed": 32,
      "size": 8,
      "intelligence": 35,
      "rarity": 84
    },
    "size_scale_score": 8,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "blue-glaucus.webp",
      "notes": "Species-level profile."
    },
    "subtitle": {
      "descriptor": "Tiny sea dragon with stolen sting",
      "subtitle_story": "The blue glaucus floats upside down at the ocean surface, using brilliant color and stored stinging cells from its prey as protection. It is small, delicate, and unexpectedly dangerous.",
      "subtitle": "Tiny sea dragon with stolen sting. The blue glaucus floats upside down at the ocean surface, using brilliant color and stored stinging cells from its prey as protection. It is small, delicate, and unexpectedly dangerous."
    },
    "behavior_principle": {
      "principle_name": "Alchemy",
      "principle_expression": "Transform what threatens you into protection.",
      "core_lesson": "The right adaptation can turn danger into an advantage.",
      "biological_basis": "Blue glaucuses feed on stinging siphonophores and can store defensive stinging cells from that prey.",
      "short_motto": "Turn threat into armor.",
      "best_use_cases": [
        "resilience",
        "adaptation",
        "strategic boundaries"
      ]
    },
    "value_profile": {
      "value_low": 9000,
      "value_typical": 28000,
      "value_high": 68000,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 95,
      "conservation_rarity": 63,
      "habitat_cost": 80,
      "public_interest": 88,
      "source_notes": "Pelagic nudibranch stewardship and education proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Ocean surface drift zones, often associated with blue-water neuston communities.",
      "range_text": "Warm and temperate oceans, including Atlantic, Pacific, and Indian Ocean regions."
    }
  },
  {
    "normalized_identity_key": "grimpoteuthis_spp",
    "landing_page_slug": "dumbo-octopus",
    "display_name": "Dumbo Octopus",
    "animal_name": "Octopus",
    "scientific_name": "Grimpoteuthis spp.",
    "refined_identity": "Dumbo Octopus",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 44,
      "speed": 38,
      "size": 28,
      "intelligence": 73,
      "rarity": 88
    },
    "size_scale_score": 28,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "dumbo-octopus.webp",
      "notes": "Genus-level profile for dumbo octopuses."
    },
    "subtitle": {
      "descriptor": "Deep-sea drifter with ear-like fins",
      "subtitle_story": "Dumbo octopuses live in the deep ocean, moving with gentle fin strokes above the seafloor. Their rounded bodies and quiet motion show a survival style built on pressure, patience, and softness.",
      "subtitle": "Deep-sea drifter with ear-like fins. Dumbo octopuses live in the deep ocean, moving with gentle fin strokes above the seafloor. Their rounded bodies and quiet motion show a survival style built on pressure, patience, and softness."
    },
    "behavior_principle": {
      "principle_name": "Ease",
      "principle_expression": "Move gently through heavy pressure.",
      "core_lesson": "Calm movement can be the strongest response in extreme conditions.",
      "biological_basis": "Dumbo octopuses inhabit deep-sea environments and move with fin-powered hovering rather than constant aggressive swimming.",
      "short_motto": "Float under pressure.",
      "best_use_cases": [
        "calm",
        "emotional pressure",
        "patience"
      ]
    },
    "value_profile": {
      "value_low": 22000,
      "value_typical": 75000,
      "value_high": 180000,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 99,
      "conservation_rarity": 78,
      "habitat_cost": 98,
      "public_interest": 86,
      "source_notes": "Deep-sea cephalopod conservation and research proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Deep ocean seafloor and bathyal to abyssal zones.",
      "range_text": "Deep oceans worldwide."
    }
  },
  {
    "normalized_identity_key": "papilio_glaucus_larva",
    "landing_page_slug": "eastern-tiger-swallowtail-caterpillar",
    "display_name": "Eastern Tiger Swallowtail Caterpillar",
    "animal_name": "Caterpillar",
    "scientific_name": "Papilio glaucus",
    "refined_identity": "Eastern Tiger Swallowtail Caterpillar",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 31,
      "speed": 12,
      "size": 10,
      "intelligence": 22,
      "rarity": 45
    },
    "size_scale_score": 10,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "eastern-tiger-swallowtail-caterpillar.webp",
      "notes": "Separate indexed life-stage profile for Papilio glaucus larva."
    },
    "subtitle": {
      "descriptor": "Leaf-mimic larva with false eyes",
      "subtitle_story": "The Eastern Tiger Swallowtail caterpillar survives by disguise, first resembling bird droppings and later flashing false eye spots. Its power is not speed or force, but timing, camouflage, and transformation.",
      "subtitle": "Leaf-mimic larva with false eyes. The Eastern Tiger Swallowtail caterpillar survives by disguise, first resembling bird droppings and later flashing false eye spots. Its power is not speed or force, but timing, camouflage, and transformation."
    },
    "behavior_principle": {
      "principle_name": "Becoming",
      "principle_expression": "Protect the unfinished stage.",
      "core_lesson": "Growth often needs camouflage before it can become visible.",
      "biological_basis": "Swallowtail caterpillars use disguise and defensive display before metamorphosing into adult butterflies.",
      "short_motto": "Guard the becoming.",
      "best_use_cases": [
        "growth",
        "patience",
        "self-protection"
      ]
    },
    "value_profile": {
      "value_low": 300,
      "value_typical": 1200,
      "value_high": 3500,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 40,
      "conservation_rarity": 26,
      "habitat_cost": 22,
      "public_interest": 58,
      "source_notes": "Pollinator education and habitat stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Deciduous woodland edges, gardens, parks, and host plants.",
      "range_text": "Eastern North America."
    }
  },
  {
    "normalized_identity_key": "papilio_glaucus",
    "landing_page_slug": "eastern-tiger-swallowtail",
    "display_name": "Eastern Tiger Swallowtail",
    "animal_name": "Butterfly",
    "scientific_name": "Papilio glaucus",
    "refined_identity": "Eastern Tiger Swallowtail",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 35,
      "speed": 55,
      "size": 20,
      "intelligence": 28,
      "rarity": 48
    },
    "size_scale_score": 20,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "eastern-tiger-swallowtail.webp",
      "notes": "Adult species profile."
    },
    "subtitle": {
      "descriptor": "Sunlit pollinator of eastern woodlands",
      "subtitle_story": "The Eastern Tiger Swallowtail is a large yellow-and-black butterfly often seen gliding through gardens, woodland edges, and open fields. It carries the energy of emergence, movement, and bright seasonal presence.",
      "subtitle": "Sunlit pollinator of eastern woodlands. The Eastern Tiger Swallowtail is a large yellow-and-black butterfly often seen gliding through gardens, woodland edges, and open fields. It carries the energy of emergence, movement, and bright seasonal presence."
    },
    "behavior_principle": {
      "principle_name": "Emergence",
      "principle_expression": "Let the finished form become visible.",
      "core_lesson": "After preparation, there is a moment to move openly and be seen.",
      "biological_basis": "Adult swallowtails emerge from metamorphosis as mobile pollinators that travel between flowers and habitats.",
      "short_motto": "Become visible.",
      "best_use_cases": [
        "renewal",
        "confidence",
        "creative expression"
      ]
    },
    "value_profile": {
      "value_low": 500,
      "value_typical": 1800,
      "value_high": 5000,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 36,
      "conservation_rarity": 28,
      "habitat_cost": 24,
      "public_interest": 70,
      "source_notes": "Pollinator habitat stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Woodlands, parks, gardens, fields, and riparian edges.",
      "range_text": "Eastern North America, with range extending into parts of the Great Plains and Mexico."
    }
  },
  {
    "normalized_identity_key": "uca_spp",
    "landing_page_slug": "fiddler-crab",
    "display_name": "Fiddler Crab",
    "animal_name": "Crab",
    "scientific_name": "Uca spp.",
    "refined_identity": "Fiddler Crab",
    "identity_kind": "generic_parent",
    "canonical_game_stats": {
      "dominance": 46,
      "speed": 42,
      "size": 12,
      "intelligence": 36,
      "rarity": 42
    },
    "size_scale_score": 12,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "fiddler-crab.webp",
      "notes": "Generic parent profile for fiddler crabs."
    },
    "subtitle": {
      "descriptor": "Mudflat signaler with one giant claw",
      "subtitle_story": "Fiddler crabs live between land and sea, waving oversized claws to signal rivals and mates. Their world is rhythm, tide, territory, and display.",
      "subtitle": "Mudflat signaler with one giant claw. Fiddler crabs live between land and sea, waving oversized claws to signal rivals and mates. Their world is rhythm, tide, territory, and display."
    },
    "behavior_principle": {
      "principle_name": "Signal",
      "principle_expression": "Make your intentions readable.",
      "core_lesson": "Clear signals reduce wasted conflict and attract the right attention.",
      "biological_basis": "Male fiddler crabs use enlarged claws in waving displays for communication, courtship, and territorial contests.",
      "short_motto": "Signal clearly.",
      "best_use_cases": [
        "communication",
        "boundaries",
        "social confidence"
      ]
    },
    "value_profile": {
      "value_low": 400,
      "value_typical": 1500,
      "value_high": 4500,
      "value_basis": "habitat_stewardship",
      "value_category": "wild",
      "care_complexity": 38,
      "conservation_rarity": 24,
      "habitat_cost": 32,
      "public_interest": 52,
      "source_notes": "Coastal wetland habitat stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Mudflats, mangroves, salt marshes, and intertidal coastal zones.",
      "range_text": "Tropical and temperate coastal regions worldwide, depending on species."
    }
  },
  {
    "normalized_identity_key": "pteropodidae",
    "landing_page_slug": "fruit-bat",
    "display_name": "Fruit Bat",
    "animal_name": "Bat",
    "scientific_name": "Pteropodidae",
    "refined_identity": "Fruit Bat",
    "identity_kind": "generic_parent",
    "canonical_game_stats": {
      "dominance": 48,
      "speed": 62,
      "size": 42,
      "intelligence": 64,
      "rarity": 61
    },
    "size_scale_score": 42,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "fruit-bat.webp",
      "notes": "Family-level generic parent profile for fruit bats/flying foxes."
    },
    "subtitle": {
      "descriptor": "Night gardener of tropical forests",
      "subtitle_story": "Fruit bats carry seeds and pollen across the night, linking trees, islands, and forests through flight. Their value is often hidden until the ecosystem needs renewal.",
      "subtitle": "Night gardener of tropical forests. Fruit bats carry seeds and pollen across the night, linking trees, islands, and forests through flight. Their value is often hidden until the ecosystem needs renewal."
    },
    "behavior_principle": {
      "principle_name": "Renewal",
      "principle_expression": "Carry growth farther than yourself.",
      "core_lesson": "Influence can be indirect; what you spread may matter more than what you keep.",
      "biological_basis": "Many fruit bats disperse seeds and pollinate plants, supporting forest regeneration.",
      "short_motto": "Spread the forest.",
      "best_use_cases": [
        "long-term impact",
        "networking",
        "restoration"
      ]
    },
    "value_profile": {
      "value_low": 6000,
      "value_typical": 22000,
      "value_high": 65000,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 82,
      "conservation_rarity": 58,
      "habitat_cost": 76,
      "public_interest": 72,
      "source_notes": "Pollination and seed-dispersal ecosystem stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Tropical and subtropical forests, orchards, mangroves, and island ecosystems.",
      "range_text": "Africa, Asia, Australia, and Pacific/Indian Ocean islands, depending on species."
    }
  },
  {
    "normalized_identity_key": "paguroidea",
    "landing_page_slug": "hermit-crab",
    "display_name": "Hermit Crab",
    "animal_name": "Crab",
    "scientific_name": "Paguroidea",
    "refined_identity": "Hermit Crab",
    "identity_kind": "generic_parent",
    "canonical_game_stats": {
      "dominance": 36,
      "speed": 28,
      "size": 14,
      "intelligence": 42,
      "rarity": 38
    },
    "size_scale_score": 14,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "hermit-crab.webp",
      "notes": "Superfamily-level generic parent profile."
    },
    "subtitle": {
      "descriptor": "Borrowed-shell survivor of shorelines",
      "subtitle_story": "Hermit crabs protect soft bodies with borrowed shells, changing homes as they grow. Their survival depends on resourcefulness, timing, and knowing when a shell no longer fits.",
      "subtitle": "Borrowed-shell survivor of shorelines. Hermit crabs protect soft bodies with borrowed shells, changing homes as they grow. Their survival depends on resourcefulness, timing, and knowing when a shell no longer fits."
    },
    "behavior_principle": {
      "principle_name": "Fit",
      "principle_expression": "Leave the shell that limits your growth.",
      "core_lesson": "Protection is useful only while it still fits the life you are building.",
      "biological_basis": "Hermit crabs occupy empty shells and must trade up as their bodies grow.",
      "short_motto": "Change shells.",
      "best_use_cases": [
        "transition",
        "resourcefulness",
        "personal growth"
      ]
    },
    "value_profile": {
      "value_low": 300,
      "value_typical": 1200,
      "value_high": 4000,
      "value_basis": "care_complexity",
      "value_category": "exotic",
      "care_complexity": 52,
      "conservation_rarity": 22,
      "habitat_cost": 34,
      "public_interest": 62,
      "source_notes": "Captive-care and coastal education stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Shorelines, reefs, tide pools, coastal forests, and marine benthic zones depending on species.",
      "range_text": "Worldwide in marine and some terrestrial tropical/coastal habitats."
    }
  },
  {
    "normalized_identity_key": "passer_domesticus",
    "landing_page_slug": "house-sparrow",
    "display_name": "House Sparrow",
    "animal_name": "Sparrow",
    "scientific_name": "Passer domesticus",
    "refined_identity": "House Sparrow",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 38,
      "speed": 52,
      "size": 12,
      "intelligence": 49,
      "rarity": 12
    },
    "size_scale_score": 12,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "house-sparrow.webp",
      "notes": "Species-level profile."
    },
    "subtitle": {
      "descriptor": "City survivor with social instincts",
      "subtitle_story": "House sparrows thrive around people, finding food, shelter, and opportunity in human-made places. Their strength is adaptability at small scale.",
      "subtitle": "City survivor with social instincts. House sparrows thrive around people, finding food, shelter, and opportunity in human-made places. Their strength is adaptability at small scale."
    },
    "behavior_principle": {
      "principle_name": "Adaptability",
      "principle_expression": "Find the opening in ordinary places.",
      "core_lesson": "Everyday success often comes from noticing small opportunities quickly.",
      "biological_basis": "House sparrows are highly adaptable birds that live closely alongside human settlements.",
      "short_motto": "Use what is near.",
      "best_use_cases": [
        "adaptability",
        "urban survival",
        "practical thinking"
      ]
    },
    "value_profile": {
      "value_low": 100,
      "value_typical": 500,
      "value_high": 1500,
      "value_basis": "public_interest",
      "value_category": "wild",
      "care_complexity": 22,
      "conservation_rarity": 8,
      "habitat_cost": 10,
      "public_interest": 48,
      "source_notes": "Common urban wildlife education proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Cities, farms, villages, parks, gardens, and human-modified landscapes.",
      "range_text": "Native to Eurasia and North Africa; introduced widely around the world."
    }
  },
  {
    "normalized_identity_key": "morpho_menelaus",
    "landing_page_slug": "menelaus-blue-morpho",
    "display_name": "Menelaus Blue Morpho",
    "animal_name": "Butterfly",
    "scientific_name": "Morpho menelaus",
    "refined_identity": "Menelaus Blue Morpho",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 34,
      "speed": 50,
      "size": 24,
      "intelligence": 25,
      "rarity": 72
    },
    "size_scale_score": 24,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "menelaus-blue-morpho.webp",
      "notes": "Species-level profile."
    },
    "subtitle": {
      "descriptor": "Iridescent flash of rainforest light",
      "subtitle_story": "The Menelaus Blue Morpho turns rainforest shade into sudden electric blue. Its wings make visibility temporary, flashing between camouflage and brilliance as it moves.",
      "subtitle": "Iridescent flash of rainforest light. The Menelaus Blue Morpho turns rainforest shade into sudden electric blue. Its wings make visibility temporary, flashing between camouflage and brilliance as it moves."
    },
    "behavior_principle": {
      "principle_name": "Radiance",
      "principle_expression": "Reveal brilliance in flashes, not constantly.",
      "core_lesson": "Mystery and visibility can work together when timed well.",
      "biological_basis": "Blue morphos have brilliant dorsal wing color and more muted undersides, creating alternating visibility during flight.",
      "short_motto": "Flash, then vanish.",
      "best_use_cases": [
        "creativity",
        "timing",
        "personal presence"
      ]
    },
    "value_profile": {
      "value_low": 1200,
      "value_typical": 4500,
      "value_high": 12000,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 45,
      "conservation_rarity": 52,
      "habitat_cost": 45,
      "public_interest": 82,
      "source_notes": "Rainforest pollinator/invertebrate education proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Tropical rainforest understory and riverine forest.",
      "range_text": "Central and South America, especially Amazonian rainforest regions."
    }
  },
  {
    "normalized_identity_key": "pyrausta_aurata",
    "landing_page_slug": "mint-moth",
    "display_name": "Mint Moth",
    "animal_name": "Moth",
    "scientific_name": "Pyrausta aurata",
    "refined_identity": "Mint Moth",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 22,
      "speed": 34,
      "size": 7,
      "intelligence": 18,
      "rarity": 44
    },
    "size_scale_score": 7,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "mint-moth.webp",
      "notes": "Species-level profile for common mint moth usage."
    },
    "subtitle": {
      "descriptor": "Tiny jewel of herb gardens",
      "subtitle_story": "The mint moth is a small, bright moth often connected with mint-family plants. Its quiet charm comes from detail, color, and the hidden life of garden edges.",
      "subtitle": "Tiny jewel of herb gardens. The mint moth is a small, bright moth often connected with mint-family plants. Its quiet charm comes from detail, color, and the hidden life of garden edges."
    },
    "behavior_principle": {
      "principle_name": "Detail",
      "principle_expression": "Small signals can still be beautiful.",
      "core_lesson": "Impact does not always need scale; precision and placement matter.",
      "biological_basis": "Small moths often live in close relationship with specific host plants and microhabitats.",
      "short_motto": "Small can shine.",
      "best_use_cases": [
        "detail work",
        "humility",
        "quiet creativity"
      ]
    },
    "value_profile": {
      "value_low": 150,
      "value_typical": 700,
      "value_high": 2200,
      "value_basis": "habitat_stewardship",
      "value_category": "wild",
      "care_complexity": 28,
      "conservation_rarity": 24,
      "habitat_cost": 16,
      "public_interest": 38,
      "source_notes": "Garden invertebrate and pollinator habitat proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Gardens, meadows, grasslands, hedgerows, and mint-family host plants.",
      "range_text": "Europe and nearby regions; exact range depends on local taxonomy and records."
    }
  },
  {
    "normalized_identity_key": "puma_concolor",
    "landing_page_slug": "mountain-lion",
    "display_name": "Mountain Lion",
    "animal_name": "Cougar",
    "scientific_name": "Puma concolor",
    "refined_identity": "Mountain Lion",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 86,
      "speed": 78,
      "size": 72,
      "intelligence": 70,
      "rarity": 68
    },
    "size_scale_score": 72,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "mountain-lion.webp",
      "notes": "Species-level profile."
    },
    "subtitle": {
      "descriptor": "Silent ambush cat of the Americas",
      "subtitle_story": "Mountain lions move through forests, deserts, and mountains with solitary precision. They rely on stealth, range, and explosive timing rather than constant confrontation.",
      "subtitle": "Silent ambush cat of the Americas. Mountain lions move through forests, deserts, and mountains with solitary precision. They rely on stealth, range, and explosive timing rather than constant confrontation."
    },
    "behavior_principle": {
      "principle_name": "Stealth",
      "principle_expression": "Save force for the decisive moment.",
      "core_lesson": "Quiet preparation can be more powerful than visible aggression.",
      "biological_basis": "Mountain lions are solitary ambush predators with large territories and explosive hunting attacks.",
      "short_motto": "Wait, then strike.",
      "best_use_cases": [
        "focus",
        "strategy",
        "independence"
      ]
    },
    "value_profile": {
      "value_low": 25000,
      "value_typical": 85000,
      "value_high": 190000,
      "value_basis": "sanctuary_stewardship",
      "value_category": "wild",
      "care_complexity": 93,
      "conservation_rarity": 58,
      "habitat_cost": 94,
      "public_interest": 88,
      "source_notes": "Large carnivore sanctuary stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Mountains, forests, deserts, grasslands, and scrublands.",
      "range_text": "Western North America through Central and South America, with fragmented regional populations."
    }
  },
  {
    "normalized_identity_key": "salpidae",
    "landing_page_slug": "salp",
    "display_name": "Salp",
    "animal_name": "Salp",
    "scientific_name": "Salpidae",
    "refined_identity": "Salp",
    "identity_kind": "generic_parent",
    "canonical_game_stats": {
      "dominance": 18,
      "speed": 25,
      "size": 18,
      "intelligence": 8,
      "rarity": 70
    },
    "size_scale_score": 18,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "salp.webp",
      "notes": "Family-level generic parent profile."
    },
    "subtitle": {
      "descriptor": "Transparent ocean filter in drifting chains",
      "subtitle_story": "Salps move through the open sea as gelatinous filter-feeders, sometimes forming chains that pulse with the current. Their quiet work links plankton, carbon, and the deep ocean.",
      "subtitle": "Transparent ocean filter in drifting chains. Salps move through the open sea as gelatinous filter-feeders, sometimes forming chains that pulse with the current. Their quiet work links plankton, carbon, and the deep ocean."
    },
    "behavior_principle": {
      "principle_name": "Flow",
      "principle_expression": "Let movement and filtering do the work.",
      "core_lesson": "Progress can come from rhythm, simplicity, and removing excess.",
      "biological_basis": "Salps filter-feed while drifting and swimming through pelagic waters, playing roles in marine food webs and carbon movement.",
      "short_motto": "Filter and flow.",
      "best_use_cases": [
        "simplicity",
        "systems thinking",
        "letting go"
      ]
    },
    "value_profile": {
      "value_low": 5000,
      "value_typical": 18000,
      "value_high": 60000,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 96,
      "conservation_rarity": 50,
      "habitat_cost": 84,
      "public_interest": 60,
      "source_notes": "Pelagic ecosystem and ocean carbon education proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Pelagic open-ocean waters.",
      "range_text": "Oceans worldwide, often blooming regionally under favorable plankton conditions."
    }
  },
  {
    "normalized_identity_key": "chrysomallon_squamiferum",
    "landing_page_slug": "scaly-foot-snail",
    "display_name": "Scaly-foot Snail",
    "animal_name": "Snail",
    "scientific_name": "Chrysomallon squamiferum",
    "refined_identity": "Scaly-foot Snail",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 50,
      "speed": 6,
      "size": 10,
      "intelligence": 16,
      "rarity": 96
    },
    "size_scale_score": 10,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "scaly-foot-snail.webp",
      "notes": "Species-level profile."
    },
    "subtitle": {
      "descriptor": "Iron-armored snail of hydrothermal vents",
      "subtitle_story": "The scaly-foot snail lives around deep-sea hydrothermal vents and is famous for metal-rich armor-like scales. It is a symbol of surviving where pressure, heat, and chemistry are extreme.",
      "subtitle": "Iron-armored snail of hydrothermal vents. The scaly-foot snail lives around deep-sea hydrothermal vents and is famous for metal-rich armor-like scales. It is a symbol of surviving where pressure, heat, and chemistry are extreme."
    },
    "behavior_principle": {
      "principle_name": "Armor",
      "principle_expression": "Build protection from the pressure around you.",
      "core_lesson": "Harsh environments can become the source of your strongest defenses.",
      "biological_basis": "The scaly-foot snail is associated with hydrothermal vents and has distinctive sclerites that can incorporate iron sulfides.",
      "short_motto": "Forge your armor.",
      "best_use_cases": [
        "resilience",
        "protection",
        "harsh conditions"
      ]
    },
    "value_profile": {
      "value_low": 35000,
      "value_typical": 120000,
      "value_high": 300000,
      "value_basis": "conservation_significance",
      "value_category": "conservation",
      "care_complexity": 100,
      "conservation_rarity": 96,
      "habitat_cost": 100,
      "public_interest": 79,
      "source_notes": "Rare deep-sea hydrothermal vent species stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Deep-sea hydrothermal vent fields.",
      "range_text": "Indian Ocean hydrothermal vent systems where the species is known."
    }
  },
  {
    "normalized_identity_key": "actiniaria",
    "landing_page_slug": "sea-anemone",
    "display_name": "Sea Anemone",
    "animal_name": "Sea Anemone",
    "scientific_name": "Actiniaria",
    "refined_identity": "Sea Anemone",
    "identity_kind": "generic_parent",
    "canonical_game_stats": {
      "dominance": 42,
      "speed": 5,
      "size": 20,
      "intelligence": 12,
      "rarity": 46
    },
    "size_scale_score": 20,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "sea-anemone.webp",
      "notes": "Order-level generic parent profile."
    },
    "subtitle": {
      "descriptor": "Flower-like hunter with stinging patience",
      "subtitle_story": "Sea anemones look like underwater flowers, but their tentacles are built for capture. They teach the power of staying rooted while remaining responsive to what passes nearby.",
      "subtitle": "Flower-like hunter with stinging patience. Sea anemones look like underwater flowers, but their tentacles are built for capture. They teach the power of staying rooted while remaining responsive to what passes nearby."
    },
    "behavior_principle": {
      "principle_name": "Patience",
      "principle_expression": "Stay open, but keep your defenses ready.",
      "core_lesson": "Receptivity works best when paired with boundaries.",
      "biological_basis": "Sea anemones are mostly stationary cnidarians that use stinging tentacles to capture prey and defend themselves.",
      "short_motto": "Rooted, not passive.",
      "best_use_cases": [
        "patience",
        "boundaries",
        "receptivity"
      ]
    },
    "value_profile": {
      "value_low": 800,
      "value_typical": 3500,
      "value_high": 15000,
      "value_basis": "care_complexity",
      "value_category": "exotic",
      "care_complexity": 72,
      "conservation_rarity": 36,
      "habitat_cost": 70,
      "public_interest": 68,
      "source_notes": "Marine aquarium/coral reef stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Coral reefs, rocky shores, tide pools, kelp forests, and marine benthic habitats.",
      "range_text": "Oceans worldwide, depending on species."
    }
  },
  {
    "normalized_identity_key": "scotoplanes_globosa",
    "landing_page_slug": "sea-pig",
    "display_name": "Sea Pig",
    "animal_name": "Sea Cucumber",
    "scientific_name": "Scotoplanes globosa",
    "refined_identity": "Sea Pig",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 20,
      "speed": 8,
      "size": 16,
      "intelligence": 10,
      "rarity": 83
    },
    "size_scale_score": 16,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "sea-pig.webp",
      "notes": "Species-level profile using Scotoplanes globosa as canonical sea pig entry."
    },
    "subtitle": {
      "descriptor": "Deep-sea walker of soft mud",
      "subtitle_story": "Sea pigs are deep-sea sea cucumbers that walk over soft seafloor with tube feet, feeding through the sediment. They look strange because they are perfectly shaped for a world of darkness, pressure, and drifting food.",
      "subtitle": "Deep-sea walker of soft mud. Sea pigs are deep-sea sea cucumbers that walk over soft seafloor with tube feet, feeding through the sediment. They look strange because they are perfectly shaped for a world of darkness, pressure, and drifting food."
    },
    "behavior_principle": {
      "principle_name": "Grounding",
      "principle_expression": "Keep moving even when the world is dark and soft.",
      "core_lesson": "Progress does not need glamour; it needs contact with the ground beneath you.",
      "biological_basis": "Sea pigs use tube feet to move across deep soft sediments while feeding on organic material in the mud.",
      "short_motto": "Walk the deep floor.",
      "best_use_cases": [
        "persistence",
        "humility",
        "difficult environments"
      ]
    },
    "value_profile": {
      "value_low": 12000,
      "value_typical": 40000,
      "value_high": 110000,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 98,
      "conservation_rarity": 66,
      "habitat_cost": 96,
      "public_interest": 76,
      "source_notes": "Deep-sea benthic ecosystem education proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Abyssal and deep-sea soft sediment seafloors.",
      "range_text": "Deep ocean basins worldwide, depending on species records."
    }
  },
  {
    "normalized_identity_key": "echinoidea",
    "landing_page_slug": "sea-urchin",
    "display_name": "Sea Urchin",
    "animal_name": "Sea Urchin",
    "scientific_name": "Echinoidea",
    "refined_identity": "Sea Urchin",
    "identity_kind": "generic_parent",
    "canonical_game_stats": {
      "dominance": 38,
      "speed": 7,
      "size": 15,
      "intelligence": 10,
      "rarity": 40
    },
    "size_scale_score": 15,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "sea-urchin.webp",
      "notes": "Class-level generic parent profile."
    },
    "subtitle": {
      "descriptor": "Spined grazer of reefs and kelp",
      "subtitle_story": "Sea urchins move slowly, but their grazing can reshape entire underwater habitats. Their spines show that even small, quiet creatures can change a landscape.",
      "subtitle": "Spined grazer of reefs and kelp. Sea urchins move slowly, but their grazing can reshape entire underwater habitats. Their spines show that even small, quiet creatures can change a landscape."
    },
    "behavior_principle": {
      "principle_name": "Influence",
      "principle_expression": "Small pressure can reshape a whole system.",
      "core_lesson": "Consistent action matters, especially when many small choices accumulate.",
      "biological_basis": "Sea urchins graze algae and can strongly affect kelp forest and reef ecosystems.",
      "short_motto": "Small force, big effect.",
      "best_use_cases": [
        "consistency",
        "ecosystem thinking",
        "quiet impact"
      ]
    },
    "value_profile": {
      "value_low": 500,
      "value_typical": 2500,
      "value_high": 9000,
      "value_basis": "habitat_stewardship",
      "value_category": "wild",
      "care_complexity": 58,
      "conservation_rarity": 28,
      "habitat_cost": 46,
      "public_interest": 55,
      "source_notes": "Marine ecosystem stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Rocky reefs, coral reefs, seagrass beds, kelp forests, and seafloor habitats.",
      "range_text": "Oceans worldwide, depending on species."
    }
  },
  {
    "normalized_identity_key": "spondylus_spp",
    "landing_page_slug": "spiny-oyster",
    "display_name": "Spiny Oyster",
    "animal_name": "Oyster",
    "scientific_name": "Spondylus spp.",
    "refined_identity": "Spiny Oyster",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 28,
      "speed": 1,
      "size": 18,
      "intelligence": 5,
      "rarity": 67
    },
    "size_scale_score": 18,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "spiny-oyster.png",
      "notes": "Genus-level profile for spiny oysters."
    },
    "subtitle": {
      "descriptor": "Armored jewel fixed to the reef",
      "subtitle_story": "Spiny oysters attach themselves to hard surfaces and grow sculptural shells with ridges and spines. They carry the symbolism of staying rooted while building beauty as protection.",
      "subtitle": "Armored jewel fixed to the reef. Spiny oysters attach themselves to hard surfaces and grow sculptural shells with ridges and spines. They carry the symbolism of staying rooted while building beauty as protection."
    },
    "behavior_principle": {
      "principle_name": "Rooting",
      "principle_expression": "Build beauty where you are fixed.",
      "core_lesson": "Commitment to place can become a source of strength and identity.",
      "biological_basis": "Spiny oysters are sessile bivalves that attach to substrates and develop heavily ornamented shells.",
      "short_motto": "Root and ornament.",
      "best_use_cases": [
        "commitment",
        "patience",
        "protective beauty"
      ]
    },
    "value_profile": {
      "value_low": 1000,
      "value_typical": 6000,
      "value_high": 25000,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 65,
      "conservation_rarity": 58,
      "habitat_cost": 62,
      "public_interest": 70,
      "source_notes": "Reef bivalve stewardship and cultural-interest proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Tropical and subtropical reefs, rocky substrates, and shallow marine habitats.",
      "range_text": "Warm marine regions worldwide, depending on species."
    }
  },
  {
    "normalized_identity_key": "centrochelys_sulcata",
    "landing_page_slug": "sulcata-tortoise",
    "display_name": "Sulcata Tortoise",
    "animal_name": "Tortoise",
    "scientific_name": "Centrochelys sulcata",
    "refined_identity": "Sulcata Tortoise",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 58,
      "speed": 10,
      "size": 55,
      "intelligence": 38,
      "rarity": 64
    },
    "size_scale_score": 55,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "sulcata-tortoise.webp",
      "notes": "Species-level profile."
    },
    "subtitle": {
      "descriptor": "Desert grazer built for endurance",
      "subtitle_story": "The Sulcata Tortoise is a large African tortoise shaped by dry grasslands and long endurance. It survives through digging, grazing, armor, and slow persistence.",
      "subtitle": "Desert grazer built for endurance. The Sulcata Tortoise is a large African tortoise shaped by dry grasslands and long endurance. It survives through digging, grazing, armor, and slow persistence."
    },
    "behavior_principle": {
      "principle_name": "Endurance",
      "principle_expression": "Move slowly enough to last.",
      "core_lesson": "Strength is often the ability to continue without rushing.",
      "biological_basis": "Sulcata tortoises are large, long-lived grazers adapted to hot dry regions and burrowing behavior.",
      "short_motto": "Slow is strong.",
      "best_use_cases": [
        "endurance",
        "patience",
        "grounded progress"
      ]
    },
    "value_profile": {
      "value_low": 3000,
      "value_typical": 12000,
      "value_high": 35000,
      "value_basis": "care_complexity",
      "value_category": "exotic",
      "care_complexity": 78,
      "conservation_rarity": 55,
      "habitat_cost": 74,
      "public_interest": 78,
      "source_notes": "Long-lived tortoise care and sanctuary stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Sahelian grasslands, savannas, scrublands, and semi-arid regions.",
      "range_text": "Southern edge of the Sahara/Sahel region of Africa."
    }
  },
  {
    "normalized_identity_key": "rhizomys_sumatrensis",
    "landing_page_slug": "sumatran-bamboo-rat",
    "display_name": "Sumatran Bamboo Rat",
    "animal_name": "Bamboo Rat",
    "scientific_name": "Rhizomys sumatrensis",
    "refined_identity": "Sumatran Bamboo Rat",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 34,
      "speed": 20,
      "size": 24,
      "intelligence": 36,
      "rarity": 62
    },
    "size_scale_score": 24,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "sumatran-bamboo-rat.webp",
      "notes": "Species-level profile."
    },
    "subtitle": {
      "descriptor": "Underground bamboo specialist",
      "subtitle_story": "The Sumatran Bamboo Rat is a burrowing rodent tied to bamboo and underground shelter. Its life is hidden, practical, and built around tunnels, roots, and stored safety.",
      "subtitle": "Underground bamboo specialist. The Sumatran Bamboo Rat is a burrowing rodent tied to bamboo and underground shelter. Its life is hidden, practical, and built around tunnels, roots, and stored safety."
    },
    "behavior_principle": {
      "principle_name": "Preparation",
      "principle_expression": "Build the hidden structure before it is needed.",
      "core_lesson": "Security often comes from foundations no one else sees.",
      "biological_basis": "Bamboo rats are fossorial rodents that use burrows and feed heavily on roots and bamboo-related plant material.",
      "short_motto": "Build below.",
      "best_use_cases": [
        "preparation",
        "security",
        "quiet work"
      ]
    },
    "value_profile": {
      "value_low": 1500,
      "value_typical": 6000,
      "value_high": 18000,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 60,
      "conservation_rarity": 48,
      "habitat_cost": 42,
      "public_interest": 42,
      "source_notes": "Southeast Asian burrowing rodent habitat stewardship proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Bamboo forests, forest edges, agricultural margins, and burrowable soils.",
      "range_text": "Southeast Asia, including areas associated with Sumatra and surrounding mainland regions."
    }
  },
  {
    "normalized_identity_key": "carassius_auratus_tosakin",
    "landing_page_slug": "tosakin-goldfish",
    "display_name": "Tosakin Goldfish",
    "animal_name": "Goldfish",
    "scientific_name": "Carassius auratus",
    "refined_identity": "Tosakin Goldfish",
    "identity_kind": "domestic_parent",
    "canonical_game_stats": {
      "dominance": 24,
      "speed": 22,
      "size": 12,
      "intelligence": 26,
      "rarity": 78
    },
    "size_scale_score": 12,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "tosakin-goldfish.webp",
      "notes": "Indexed domestic variety profile. Do not use breed_market_profiles for this batch."
    },
    "subtitle": {
      "descriptor": "Living fan of ornamental water",
      "subtitle_story": "The Tosakin Goldfish is prized for its flowing, fan-like tail and delicate ornamental form. It represents careful cultivation, visual grace, and the patience of selective tradition.",
      "subtitle": "Living fan of ornamental water. The Tosakin Goldfish is prized for its flowing, fan-like tail and delicate ornamental form. It represents careful cultivation, visual grace, and the patience of selective tradition."
    },
    "behavior_principle": {
      "principle_name": "Refinement",
      "principle_expression": "Let care shape beauty over time.",
      "core_lesson": "Some forms of excellence come from patience, tradition, and precise attention.",
      "biological_basis": "Ornamental goldfish varieties are shaped by selective breeding and require careful aquatic husbandry.",
      "short_motto": "Refine with care.",
      "best_use_cases": [
        "refinement",
        "patience",
        "aesthetics"
      ]
    },
    "value_profile": {
      "value_low": 500,
      "value_typical": 2500,
      "value_high": 12000,
      "value_basis": "care_complexity",
      "value_category": "domestic",
      "care_complexity": 68,
      "conservation_rarity": 20,
      "habitat_cost": 48,
      "public_interest": 74,
      "source_notes": "Ornamental aquatics care and rarity proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Domestic ornamental ponds and aquariums.",
      "range_text": "Domestic variety derived from goldfish; maintained by aquarists and breeders rather than a wild native range."
    }
  },
  {
    "normalized_identity_key": "corvinella_corvina",
    "landing_page_slug": "yellow-billed-shrike",
    "display_name": "Yellow-billed Shrike",
    "animal_name": "Shrike",
    "scientific_name": "Corvinella corvina",
    "refined_identity": "Yellow-billed Shrike",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 52,
      "speed": 56,
      "size": 18,
      "intelligence": 54,
      "rarity": 55
    },
    "size_scale_score": 18,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "yellow-billed-shrike.webp",
      "notes": "Species-level profile."
    },
    "subtitle": {
      "descriptor": "Long-tailed watcher of African scrub",
      "subtitle_story": "The Yellow-billed Shrike is a social, sharp-eyed bird of African savannas and scrub. It combines alert watching, quick movement, and bold calls with the precision of a small predator.",
      "subtitle": "Long-tailed watcher of African scrub. The Yellow-billed Shrike is a social, sharp-eyed bird of African savannas and scrub. It combines alert watching, quick movement, and bold calls with the precision of a small predator."
    },
    "behavior_principle": {
      "principle_name": "Watchfulness",
      "principle_expression": "See clearly before you act sharply.",
      "core_lesson": "Precision starts with observation.",
      "biological_basis": "Shrikes are alert passerines known for predatory habits, exposed perching, and quick strikes on prey.",
      "short_motto": "Watch, then act.",
      "best_use_cases": [
        "focus",
        "discernment",
        "decisive action"
      ]
    },
    "value_profile": {
      "value_low": 1200,
      "value_typical": 4500,
      "value_high": 14000,
      "value_basis": "conservation_significance",
      "value_category": "wild",
      "care_complexity": 52,
      "conservation_rarity": 38,
      "habitat_cost": 35,
      "public_interest": 46,
      "source_notes": "African passerine habitat and education proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Savanna, scrubland, open woodland, and thorny bush.",
      "range_text": "Tropical Africa from West Africa eastward into parts of East Africa."
    }
  },
  {
    "normalized_identity_key": "hippocampus_kuda",
    "landing_page_slug": "yellow-seahorse",
    "display_name": "Yellow Seahorse",
    "animal_name": "Seahorse",
    "scientific_name": "Hippocampus kuda",
    "refined_identity": "Yellow Seahorse",
    "identity_kind": "species",
    "canonical_game_stats": {
      "dominance": 30,
      "speed": 12,
      "size": 10,
      "intelligence": 32,
      "rarity": 75
    },
    "size_scale_score": 10,
    "generation_metadata": {
      "seed_batch": "new_indexed_animals_2026_06",
      "image_file": "yellow-seahorse.webp",
      "notes": "Species-level profile."
    },
    "subtitle": {
      "descriptor": "Gentle seagrass anchor with a curled tail",
      "subtitle_story": "The Yellow Seahorse moves slowly through seagrass and shallow marine habitats, anchoring itself with a curled tail. Its strength is delicacy, camouflage, and unusual parental care.",
      "subtitle": "Gentle seagrass anchor with a curled tail. The Yellow Seahorse moves slowly through seagrass and shallow marine habitats, anchoring itself with a curled tail. Its strength is delicacy, camouflage, and unusual parental care."
    },
    "behavior_principle": {
      "principle_name": "Anchoring",
      "principle_expression": "Hold gently to what keeps you steady.",
      "core_lesson": "Stability does not have to be rigid; it can be delicate and alive.",
      "biological_basis": "Seahorses use prehensile tails to anchor to seagrass or coral, and males brood developing young.",
      "short_motto": "Hold gently.",
      "best_use_cases": [
        "stability",
        "care",
        "gentleness"
      ]
    },
    "value_profile": {
      "value_low": 2500,
      "value_typical": 10000,
      "value_high": 40000,
      "value_basis": "conservation_significance",
      "value_category": "conservation",
      "care_complexity": 84,
      "conservation_rarity": 72,
      "habitat_cost": 72,
      "public_interest": 82,
      "source_notes": "Seahorse conservation, seagrass habitat, and careful husbandry proxy. Not a sale price."
    },
    "native_range": {
      "habitat": "Seagrass beds, mangroves, estuaries, coral reefs, and shallow coastal waters.",
      "range_text": "Indo-Pacific coastal waters, depending on population and taxonomy."
    }
  }
]$seed$::jsonb)
    as x (
        normalized_identity_key text,
        landing_page_slug text,
        display_name text,
        animal_name text,
        scientific_name text,
        refined_identity text,
        identity_kind text,
        canonical_game_stats jsonb,
        size_scale_score int,
        generation_metadata jsonb,
        subtitle jsonb,
        behavior_principle jsonb,
        value_profile jsonb,
        native_range jsonb
    )
),
existing_profiles as (
    select
        p.normalized_identity_key,
        p.animaldex_number
    from public.species_profiles p
    join seed_animals s on s.normalized_identity_key = p.normalized_identity_key
),
existing_max as (
    select coalesce(max(animaldex_number), 0) as max_num
    from public.species_profiles
),
numbered as (
    select
        s.*,
        case
            when ep.animaldex_number is not null then ep.animaldex_number
            else em.max_num + count(*) filter (where ep.animaldex_number is null) over (order by s.landing_page_slug)
        end as proposed_animaldex_number
    from seed_animals s
    left join existing_profiles ep on ep.normalized_identity_key = s.normalized_identity_key
    cross join existing_max em
),
upserted_profiles as (
    insert into public.species_profiles (
        normalized_identity_key,
        display_name,
        animal_name,
        scientific_name,
        refined_identity,
        identity_source,
        identity_confidence,
        identity_kind,
        canonical_game_stats,
        size_scale_score,
        generation_status,
        generation_model_version,
        generation_metadata,
        landing_page_slug,
        catalog_source,
        catalog_status,
        animaldex_number
    )
    select
        normalized_identity_key,
        display_name,
        animal_name,
        scientific_name,
        refined_identity,
        'refined_identity',
        1.0,
        identity_kind,
        canonical_game_stats,
        size_scale_score,
        'ready',
        'seed:manual_catalog',
        generation_metadata || jsonb_build_object('native_range', native_range),
        landing_page_slug,
        'manual',
        'active',
        proposed_animaldex_number
    from numbered
    on conflict (normalized_identity_key) do update set
        display_name = excluded.display_name,
        animal_name = excluded.animal_name,
        scientific_name = excluded.scientific_name,
        refined_identity = excluded.refined_identity,
        identity_source = excluded.identity_source,
        identity_confidence = excluded.identity_confidence,
        identity_kind = excluded.identity_kind,
        canonical_game_stats = excluded.canonical_game_stats,
        size_scale_score = excluded.size_scale_score,
        generation_status = excluded.generation_status,
        generation_model_version = excluded.generation_model_version,
        generation_metadata = excluded.generation_metadata,
        landing_page_slug = excluded.landing_page_slug,
        catalog_source = excluded.catalog_source,
        catalog_status = excluded.catalog_status,
        animaldex_number = coalesce(public.species_profiles.animaldex_number, excluded.animaldex_number)
    returning id, normalized_identity_key, landing_page_slug
),
profile_seed as (
    select
        p.id as species_profile_id,
        p.landing_page_slug,
        s.normalized_identity_key,
        s.subtitle,
        s.behavior_principle,
        s.value_profile
    from upserted_profiles p
    join seed_animals s on s.normalized_identity_key = p.normalized_identity_key
),
upserted_subtitles as (
    insert into public.species_subtitles (
        species_profile_id,
        locale,
        slug,
        descriptor,
        subtitle_story,
        subtitle,
        source
    )
    select
        species_profile_id,
        'en',
        landing_page_slug,
        subtitle->>'descriptor',
        subtitle->>'subtitle_story',
        subtitle->>'subtitle',
        'manual'
    from profile_seed
    on conflict (locale, slug) do update set
        species_profile_id = excluded.species_profile_id,
        descriptor = excluded.descriptor,
        subtitle_story = excluded.subtitle_story,
        subtitle = excluded.subtitle,
        source = excluded.source,
        updated_at = timezone('utc', now())
    returning species_profile_id
),
upserted_behavior_principles as (
    insert into public.species_behavior_principles (
        species_profile_id,
        principle_name,
        principle_expression,
        core_lesson,
        biological_basis,
        short_motto,
        best_use_cases,
        source
    )
    select
        species_profile_id,
        behavior_principle->>'principle_name',
        behavior_principle->>'principle_expression',
        behavior_principle->>'core_lesson',
        behavior_principle->>'biological_basis',
        behavior_principle->>'short_motto',
        behavior_principle->'best_use_cases',
        'manual'
    from profile_seed
    on conflict (species_profile_id) do update set
        principle_name = excluded.principle_name,
        principle_expression = excluded.principle_expression,
        core_lesson = excluded.core_lesson,
        biological_basis = excluded.biological_basis,
        short_motto = excluded.short_motto,
        best_use_cases = excluded.best_use_cases,
        source = excluded.source,
        updated_at = timezone('utc', now())
    returning species_profile_id
),
upserted_value_profiles as (
    insert into public.animal_value_profiles (
        species_profile_id,
        value_low,
        value_typical,
        value_high,
        value_currency,
        value_basis,
        value_category,
        care_complexity,
        conservation_rarity,
        habitat_cost,
        public_interest,
        source_notes,
        source_confidence
    )
    select
        species_profile_id,
        (value_profile->>'value_low')::int,
        (value_profile->>'value_typical')::int,
        (value_profile->>'value_high')::int,
        'USD',
        value_profile->>'value_basis',
        value_profile->>'value_category',
        (value_profile->>'care_complexity')::int,
        (value_profile->>'conservation_rarity')::int,
        (value_profile->>'habitat_cost')::int,
        (value_profile->>'public_interest')::int,
        value_profile->>'source_notes',
        0.55
    from profile_seed
    on conflict (species_profile_id) do update set
        value_low = excluded.value_low,
        value_typical = excluded.value_typical,
        value_high = excluded.value_high,
        value_currency = excluded.value_currency,
        value_basis = excluded.value_basis,
        value_category = excluded.value_category,
        care_complexity = excluded.care_complexity,
        conservation_rarity = excluded.conservation_rarity,
        habitat_cost = excluded.habitat_cost,
        public_interest = excluded.public_interest,
        source_notes = excluded.source_notes,
        source_confidence = excluded.source_confidence,
        updated_at = timezone('utc', now())
    returning species_profile_id
)
select
    (select count(*) from upserted_profiles) as species_profiles_upserted,
    (select count(*) from upserted_subtitles) as species_subtitles_upserted,
    (select count(*) from upserted_behavior_principles) as behavior_principles_upserted,
    (select count(*) from upserted_value_profiles) as value_profiles_upserted;

commit;

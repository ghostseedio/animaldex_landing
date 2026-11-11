-- The live catalogue for scripts/ark-species-stats.mts (true scale, docs/ark/true-scale.md). Read only:
--   supabase db query --linked -f scripts/ark-true-scale/catalogue.sql -o json > catalogue.json   (from the AnimalDex repo)
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '2s';
SELECT vs.model_slug AS slug,
       vs.zone,
       vs.excluded_reason,
       sp.display_name,
       sp.scientific_name,
       sp.canonical_game_stats AS stats,
       sp.size_scale_score,
       sp.generation_metadata->>'stats_basis' AS basis,
       t.length_m::text AS t_length,
       t.length_phrase AS t_phrase,
       t.length_source AS t_source,
       t.size AS t_size,
       fg.signature_traits,
       fg.interesting_facts,
       fg.sex_difference_notes,
       fg.species_spotlight
FROM voyage_species vs
JOIN species_profiles sp ON sp.id = vs.species_profile_id
LEFT JOIN voyage_species_traits t ON t.species_profile_id = vs.species_profile_id
LEFT JOIN species_field_guide fg ON fg.species_profile_id = vs.species_profile_id
ORDER BY vs.model_slug;
COMMIT;

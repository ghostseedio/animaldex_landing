insert into public.species_subtitles (locale, slug, descriptor, subtitle_story)
values
    ('en', 'pig', 'The curious root-and-learn animal', 'The Pig is a sturdy social mammal with a sensitive snout, flexible diet, and a surprising ability to learn patterns quickly. It shows that intelligence can grow out of curiosity, memory, and constant contact with the world right in front of it. For us, the message is simple: people who can adjust without losing themselves stay hard to stop.'),
    ('en', 'black-vulture', 'The black-wing cleanup scout animal', 'The Black Vulture is a dark broad-winged scavenger with a bare black head, tight social groups, and a confident habit of riding warm air over open country. It succeeds by watching carefully, following information fast, and arriving where the opportunity opens first. In human life, this reminds us that trust and coordination often beat raw individual power.'),
    ('en', 'kangal', 'The calm pasture guardian animal', 'The Kangal is a massive guardian dog with a broad head, calm watchfulness, and a body built for protecting livestock in open country. It works best when patience, confidence, and sudden defensive force all belong to the same system. For us, the message is simple: a clear boundary is often more powerful than a late reaction.'),
    ('en', 'giant-tortoise', 'The ancient island shell giant animal', 'The Giant Tortoise is a huge slow-moving reptile with a domed shell, pillar-like legs, and a life measured in decades. It turns protection, patience, and steady movement into a survival strategy that feels older than hurry itself. Its lesson for us is clear: protection is strongest when it is visible early and used well.')
on conflict (locale, slug) do update
set descriptor = excluded.descriptor,
    subtitle_story = excluded.subtitle_story,
    updated_at = timezone('utc', now());

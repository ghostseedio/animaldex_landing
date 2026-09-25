insert into public.species_subtitles (locale, slug, descriptor, subtitle_story)
values
    ('en', 'grizzly-bear', 'The hump-backed mountain force animal', 'The Grizzly Bear is a huge brown bear with a shoulder hump, long claws, and a life built around strength, digging, and explosive short-range force. It feels calm until it does not, which is why distance and respect matter so much around it. For us, the message is simple: consistency can carry us through places where motivation alone cannot.')
on conflict (locale, slug) do update
set descriptor = excluded.descriptor,
    subtitle_story = excluded.subtitle_story,
    updated_at = timezone('utc', now());

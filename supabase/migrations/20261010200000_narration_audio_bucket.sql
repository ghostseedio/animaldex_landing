-- Saved AI voiceovers for blog posts and animal stories
-- (src/lib/narration/cloud-voice.ts). One MP3 per text + voice, named by its
-- hash, so a piece is voiced once and every later listener plays the file.
-- Public: the page's <audio> element plays it directly. The route also
-- creates the bucket on first use if this migration has not been applied.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('narration-audio', 'narration-audio', true, 52428800, ARRAY['audio/mpeg'])
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

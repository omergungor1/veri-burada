-- Detay claim: worker başına en fazla 10 işletme.
-- Eklenti bu turu tarar, bitirir, sonra tek seferde gönderir.
UPDATE public.app_config
SET value = '10'::jsonb, updated_at = now()
WHERE key = 'detail_batch_size';

-- Detay claim batch: worker başına 100 -> 50 (diğer worker'lar daha az beklesin)
UPDATE public.app_config
SET value = '50'::jsonb, updated_at = now()
WHERE key = 'detail_batch_size';

-- localization config: optional per-meeting locale & language settings
-- one jsonb column on meetings, no join tables — the whole config travels as one object
--
-- format: {"unit_system": "metric", "week_start": "monday", "non_work_days": ["sat", "sun"],
--          "audience": "international", "timezone_awareness": true,
--          "transliteration": [{"language": "hindi", "priority": 1, "usage": 0.5},
--                              {"language": "english", "priority": 2, "usage": 0.5}]}
--
-- transliteration with priority + usage lets one meeting run e.g. hinglish:
-- select hindi + english, reorder which wins conflicts, slide how much each carries.

ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS localization JSONB;

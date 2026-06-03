-- Switch the default trial policy from metered 20 minutes to a fixed 24-hour window.
UPDATE "site_config_versions"
SET "configJson" = jsonb_set(
    "configJson",
    '{trial,totalMinutes}',
    '1440'::jsonb,
    true
)
WHERE "configKey" = 'payments.runtime'
  AND "configJson"->'trial' IS NOT NULL
  AND "configJson"->'trial'->>'totalMinutes' ~ '^[0-9]+$'
  AND ("configJson"->'trial'->>'totalMinutes')::int = 20;

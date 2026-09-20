-- Backfill only records whose own description names a verified shared world.
-- Manual Universe values and already classified records remain untouched.

UPDATE characters
SET universe='SUCC',
    universes='["SUCC"]',
    universe_source_field='description:known-universe',
    updated_at=CURRENT_TIMESTAMP
WHERE COALESCE(universe_source_field,'')!='admin:manual'
  AND COALESCE(universe,'')=''
  AND COALESCE(universes,'[]') IN ('','[]')
  AND (
    LOWER(COALESCE(description,'') || ' ' || COALESCE(short_description,'')) LIKE '%succ universe%'
    OR LOWER(COALESCE(description,'') || ' ' || COALESCE(short_description,'')) LIKE '%supernatural university of california%'
  );

UPDATE characters
SET universe='SUVA University',
    universes='["SUVA University"]',
    universe_source_field='description:known-universe',
    updated_at=CURRENT_TIMESTAMP
WHERE COALESCE(universe_source_field,'')!='admin:manual'
  AND COALESCE(universe,'')=''
  AND COALESCE(universes,'[]') IN ('','[]')
  AND (
    LOWER(COALESCE(description,'') || ' ' || COALESCE(short_description,'')) LIKE '%suva (superhuman vocational academy)%'
    OR LOWER(COALESCE(description,'') || ' ' || COALESCE(short_description,'')) LIKE '%suva university%'
  );

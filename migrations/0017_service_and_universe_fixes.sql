-- 2026-10-05, agreed with the admin.
-- 1) Five more service cards (announcements / thank-you posts) get the "Service" tag.
UPDATE characters SET service=1 WHERE janitor_uuid IN (
  '8806236d-3ed2-44f3-9414-70ad90b8edfe',
  '77376866-5b5a-422b-af44-757d3898ff50',
  '64bb3dfa-025f-44b5-b1fa-6e5eb1a1d5ab',
  '5a04e8f5-7dba-43a0-9cd5-c5d12e6e1f5c',
  '460cba72-730a-4bea-90fd-144a6e443667'
);

-- 2) Universe labels from creators' descriptions: a decorative symbol is not a universe, and one universe
--    was written two ways. Curation rules only change what the site shows; stored source values stay as they are.
INSERT INTO universe_curation(source_key,source_value,public_universes,parent_universe,subuniverse,active,note,updated_at) VALUES
('✧','✧','[]','','',1,'decorative symbol from Bride4corpse descriptions, not a universe',CURRENT_TIMESTAMP),
('setting demi-human verse','setting demi-human verse','["Demi-human Verse"]','','',1,'"setting" is a heading word; same universe as demi-human verse',CURRENT_TIMESTAMP),
('demi-human verse','demi-human verse','["Demi-human Verse"]','','',1,'canonical casing',CURRENT_TIMESTAMP)
ON CONFLICT(source_key) DO UPDATE SET
  public_universes=excluded.public_universes,
  parent_universe=excluded.parent_universe,
  subuniverse=excluded.subuniverse,
  active=excluded.active,
  note=excluded.note,
  updated_at=CURRENT_TIMESTAMP;
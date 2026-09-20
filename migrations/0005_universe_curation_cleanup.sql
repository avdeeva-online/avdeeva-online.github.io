-- Remove generic creator metadata from the public Universe facet and merge a
-- casing duplicate. Raw character source values stay intact and reversible.

INSERT INTO universe_curation(source_key,source_value,public_universes,parent_universe,subuniverse,active,note,updated_at) VALUES
('collab','Collab','[]','','',1,'generic collaboration label is not a shared universe',CURRENT_TIMESTAMP),
('and plot','AND PLOT','[]','','',1,'description heading captured as WORLD value',CURRENT_TIMESTAMP),
('birthday bot','birthday bot','[]','','',1,'one-off creator note is not a shared universe',CURRENT_TIMESTAMP),
('212 kings','212 kings','["212 KINGS"]','','',1,'canonical casing',CURRENT_TIMESTAMP)
ON CONFLICT(source_key) DO UPDATE SET
  public_universes=excluded.public_universes,
  parent_universe=excluded.parent_universe,
  subuniverse=excluded.subuniverse,
  active=excluded.active,
  note=excluded.note,
  updated_at=CURRENT_TIMESTAMP;

UPDATE universe_curation
SET public_universes='[]',active=1,note='collaboration label is not a shared universe',updated_at=CURRENT_TIMESTAMP
WHERE source_key IN (
  'janitorcup2025 (a leidenpotato hockey collab) - search that tag for more bots',
  'crown records rapper collab',
  'four horseman collab by leidenpotato for her 1 year server anniversary',
  'hawthorne university collab by overlord melvin',
  'the ledger collab'
);

UPDATE universe_curation
SET public_universes='["Bridgerton Inspired"]',active=1,note='keep the shared setting; drop generic Collab facet',updated_at=CURRENT_TIMESTAMP
WHERE source_key='bridgerton inspired collab';

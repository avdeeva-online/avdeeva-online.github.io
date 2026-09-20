-- Normalize verified series labels without inferring Universe from hashtags.
-- Raw character source values stay intact and reversible.

INSERT INTO universe_curation(source_key,source_value,public_universes,parent_universe,subuniverse,active,note,updated_at) VALUES
('succ - a universe created by io on janitorai','succ - a universe created by io on janitorai','["SUCC"]','','',1,'canonical series label; creator attribution remains in the source description',CURRENT_TIMESTAMP),
('suvauniversity','SUVAUNIVERSITY','["SUVA University"]','','',1,'canonical readable series label',CURRENT_TIMESTAMP)
ON CONFLICT(source_key) DO UPDATE SET
  public_universes=excluded.public_universes,
  parent_universe=excluded.parent_universe,
  subuniverse=excluded.subuniverse,
  active=excluded.active,
  note=excluded.note,
  updated_at=CURRENT_TIMESTAMP;

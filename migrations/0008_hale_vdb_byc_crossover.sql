-- Expand the verified Hale University × Voodoo Boys/Bayou Crew Next Gen
-- crossover into separate selectable Universe values. Raw source stays intact.

INSERT INTO universe_curation(source_key,source_value,public_universes,parent_universe,subuniverse,active,note,updated_at) VALUES
('hale university x vdb','hale university x vdb','["Hale University","Voodoo Boys","Voodoo Boys Next Gen"]','','',1,'verified crossover: VDB means Voodoo Boys Next Gen in the seven-card Hale University series',CURRENT_TIMESTAMP),
('byc next gen','byc next gen','["Bayou Crew","Bayou Crew Next Gen"]','Bayou Crew','Bayou Crew Next Gen',1,'verified crossover: BYC means Bayou Crew Next Gen in the seven-card Hale University series',CURRENT_TIMESTAMP)
ON CONFLICT(source_key) DO UPDATE SET
  public_universes=excluded.public_universes,
  parent_universe=excluded.parent_universe,
  subuniverse=excluded.subuniverse,
  active=excluded.active,
  note=excluded.note,
  updated_at=CURRENT_TIMESTAMP;

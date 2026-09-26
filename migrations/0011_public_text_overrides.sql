-- Admin-written public text for the record card. Empty = use the tagline / main description split
-- automatically from the creator's description (src/description-sections.js). Re-import never touches them.
ALTER TABLE characters ADD COLUMN public_hook TEXT NOT NULL DEFAULT '';
ALTER TABLE characters ADD COLUMN public_about TEXT NOT NULL DEFAULT '';
-- Service cards (announcements, FAQ, milestone thank-yous, lore info) stay on the site but get their own
-- "📢 Service" tag. The flag is admin-owned: import and the DataCat re-check never write it, so it survives re-imports.
ALTER TABLE characters ADD COLUMN service INTEGER NOT NULL DEFAULT 0;

-- Marked by the admin on 2026-10-05 (14 announcement / FAQ cards + the Voodoo/Bayou lore info card).
UPDATE characters SET service=1 WHERE janitor_uuid IN (
  '135deb7f-9393-48e3-9d32-21d9ba4c3211',
  '53310822-01cf-4808-af57-4d6eaeef66c3',
  'fe241465-4f77-439d-9831-b9674b8712d4',
  '9eaa6728-f506-4d7d-b063-8125237dabfd',
  '96070ff3-fc21-42cd-9cc8-d3cf04f88827',
  '6e46d87b-be0a-4535-be2e-73906e39c3d5',
  '0632dae4-3fbe-469d-977c-27990cb9da77',
  '7d5fcf93-6b17-47dd-a333-bb27d13fa38e',
  '376d148b-dd79-46cd-a7e3-c7989d2c64dc',
  'aed942b6-fbd5-4f0d-a84b-ae2439a15f06',
  '6022156d-614d-4555-b3f7-c9183847a41b',
  '2f0d782d-a912-4715-bdfa-2c4f64e723e7',
  'f571a2b2-38d5-4d2b-9960-6d2543c8a7c8',
  '8ba94d9e-008c-4456-ad30-90ebfc71fc35',
  'ce3f49ec-8f14-4894-868a-bcb2b2d7e69c'
);

-- Service cards are now hidden from the public catalog (they stay in the admin with the "📢 Service" tag).
-- More announcement / update / milestone / goodbye cards found on 2026-10-11.
UPDATE characters SET service=1 WHERE janitor_uuid IN (
  '4ea43585-cbe8-42b3-ab49-d228400f4d26', -- itsVii: Very small update
  '34115eb0-c2ee-4b57-a13a-e5dc5f2b287a', -- iamVII: Happy 1 year anniversary
  '341750ca-6c5c-4b16-8c03-f8627d9e8234', -- WaywardSoul: Small Update
  'af0b5f56-5162-4b05-bce5-256b0cd9b4aa', -- kikisbookstore: THANK U FOR 8K
  '41db4361-46d8-496b-a0f8-4974db80ae17', -- kikisbookstore: discord (again)
  'd4f2abbb-18ab-4a0d-974b-ed98ebd57243', -- kiki_exe: 20K
  'dd95e99c-a0d1-4f5d-90d8-1eee36d564f3', -- kiki_exe: goodbye
  '00926188-a4e9-41b9-8377-fbc668f90e9c', -- darcyz: 20K!! ♡
  '1f2cb1e6-ccf3-44ff-a200-4899d6fc803d'  -- Nytaka: Update Bot
);

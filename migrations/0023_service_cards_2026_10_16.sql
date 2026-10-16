-- More service cards (announcements / surveys / idea boxes / thank-you posts) found on 2026-10-16:
-- hidden from the public catalog and CODEX, kept in the admin with the "Service" tag (untick there to bring one back).
UPDATE characters SET service=1 WHERE janitor_uuid IN (
  '4c586901-7854-4d3b-a166-61f10193daf3', -- iamVII: Botting issue
  'cea5984b-268a-444f-a6fe-0dc08dd6734c', -- iamVII: ST Cards
  'b120ee55-1ba8-422b-997e-5182dabe3c91', -- itsVii: Umbra - Noctis University App
  'dbbc27c3-a27e-431f-9a5f-3ecb6d591c4d', -- itsVii: We need to talk about JAI
  '4d70c616-9980-409d-82f6-a3f790e54561', -- itsVii: Suggestions
  '24f0f8ea-6bb6-4ea1-a08e-01d5aa4da086', -- Zakurei: Idea Box
  'f8b7d50f-f022-4d78-8fb1-9ad4c2d61850', -- Zakurei: Survey
  'f60734e1-046b-419a-8ca9-4eb28ef9ddad', -- Zakurei: New bot on the alt account
  '3b0e1d49-0c74-4923-a0ac-08b5533df815', -- Mavile Garcia: 5,000 OF YOU?!
  '062dbdd3-2d70-4bec-882a-bbcd5e290536', -- kikisbookstore: yap yap
  'ad5a5293-6cab-401e-8bd4-fb634f3c9ae1', -- kiki_exe: summer swap
  '7b1b4ae3-f1a8-498d-96b9-8c2fe0f6f7dc', -- kikisbookstore: fem bots
  '13d21d7c-c40d-4e96-876f-eba4d7c920b7', -- kikisbookstore: 3000?!
  'ee54f6e0-3751-4780-ad3a-983f64937d8e', -- deffeo: we need to talk about loviyn
  '9baee1f4-4ee2-4857-b2e4-73f96a3dfd7c', -- darcdama: SUGGESTIONS
  'a71c4fbc-504a-4bbd-ab75-257d88e4b6f7', -- Delirenous: Let's talk
  '177ac748-e251-49db-867b-66e60979b0b1'  -- Delirenous: Creator Showcase
);

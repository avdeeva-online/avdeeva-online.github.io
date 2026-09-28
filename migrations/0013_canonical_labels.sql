-- One spelling per author, hashtag and tag (agreed with the admin 2026-09-28).
-- The same rules live in src/filter-normalization.js (import, DataCat re-check, admin save, public output),
-- so this one-time rewrite of stored rows cannot be undone by a later re-import.
-- Only labels change: bots keep their janitor_uuid, and lorebook links / card downloads are keyed by it.

-- Authors: one spelling per person.
UPDATE characters SET author='KOISIMM' WHERE lower(author)='koisimm' AND author<>'KOISIMM';
UPDATE characters SET author='SEPHA' WHERE lower(author)='sepha' AND author<>'SEPHA';
UPDATE lorebooks SET author='KOISIMM' WHERE lower(author)='koisimm' AND author<>'KOISIMM';
UPDATE lorebooks SET author='SEPHA' WHERE lower(author)='sepha' AND author<>'SEPHA';

-- Hashtags: lower case, typos and same-meaning variants merged, duplicates inside one bot removed (first position kept).
UPDATE characters SET hashtags=(
  SELECT COALESCE(json_group_array(v),'[]') FROM (
    SELECT v,MIN(k) AS k FROM (
      SELECT CASE lower(trim(ltrim(trim(value),'#'))) WHEN 'agegape' THEN 'agegap' WHEN 'agegaprelationship' THEN 'agegap' WHEN 'agegapromance' THEN 'agegap' WHEN 'postapocalpyse' THEN 'postapocalyptic' WHEN 'postapocalpytic' THEN 'postapocalyptic' WHEN 'zombieapacolypse' THEN 'zombieapocalypse' WHEN 'toxicrelashionship' THEN 'toxicrelationship' WHEN 'secretrelathionship' THEN 'secretrelationship' WHEN 'omegavers' THEN 'omegaverse' WHEN 'myheroacadamia' THEN 'myheroacademia' WHEN 'mha' THEN 'myheroacademia' WHEN 'olderbrothersbestfrie' THEN 'olderbrothersbestfriend' WHEN 'vincericcardosyndicat' THEN 'vincericcardosyndicate' WHEN 'naivebutagressive' THEN 'naivebutaggressive' WHEN 'kinktobe2024' THEN 'kinktober' WHEN '2000' THEN '2000s' WHEN 'greekgods' THEN 'greekgod' WHEN 'hurtandcomfort' THEN 'hurtcomfort' WHEN 'darkromantic' THEN 'darkromance' WHEN 'afo' THEN 'allforone' WHEN 'draco' THEN 'dracomalfoy' WHEN 'oldercharxyoungeruser' THEN 'olderchar' WHEN 'youngercharxolderuser' THEN 'olderchar' WHEN 'olderuserxyoungerchar' THEN 'olderuser' WHEN 'studentxprofessor' THEN 'professorandstudent' WHEN 'japanese' THEN 'japan' WHEN 'bestfriendchar' THEN 'bestfriend' ELSE lower(trim(ltrim(trim(value),'#'))) END AS v,key AS k FROM json_each(characters.hashtags)
    ) WHERE v<>'' GROUP BY v ORDER BY k
  )
) WHERE json_valid(hashtags) AND json_type(hashtags)='array';

-- Tags: "👨‍🦰 Male" is the same tag as "👨 Male".
UPDATE characters SET tags=(
  SELECT COALESCE(json_group_array(v),'[]') FROM (
    SELECT v,MIN(k) AS k FROM (
      SELECT CASE value WHEN '👨‍🦰 Male' THEN '👨 Male' ELSE value END AS v,key AS k FROM json_each(characters.tags)
    ) GROUP BY v ORDER BY k
  )
) WHERE json_valid(tags) AND EXISTS(SELECT 1 FROM json_each(characters.tags) WHERE value='👨‍🦰 Male');
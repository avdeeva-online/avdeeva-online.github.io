-- Normalize legacy remote HUB files once instead of on every Worker request.
UPDATE hub_resource_files
SET storage='remote', r2_key=''
WHERE external_url!='' AND (storage IS NULL OR storage='' OR storage='d1');

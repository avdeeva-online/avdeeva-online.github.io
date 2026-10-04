-- Extra links of a TAVO HUB resource (up to 5): JSON [{"label":"Regex","url":"https://…"}], shown as buttons
-- next to the main "get it from the author's post" link. The resource itself is never hosted.
ALTER TABLE hub_resources ADD COLUMN extra_links TEXT NOT NULL DEFAULT '[]';

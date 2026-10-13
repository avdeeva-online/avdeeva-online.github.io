// Card files (PNG / JSON) are not built by us for visitors: the download buttons open the bot's own page on DataCat,
// where the file is taken from them directly. Text that is public anyway (description, scenario, greetings, tags,
// lorebooks) stays in our catalog.
export const datacatCardPage=uuid=>`https://datacat.run/characters/recent/janitor/${String(uuid||'').toLowerCase()}`;

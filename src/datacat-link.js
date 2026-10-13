// Card files (PNG / JSON) are not built by us for visitors: the download buttons open the bot's own page on DataCat,
// where the file is taken from them directly. Text that is public anyway (description, scenario, greetings, tags,
// lorebooks) stays in our catalog.
export const datacatCardPage=uuid=>`https://datacat.run/characters/recent/janitor/${String(uuid||'').toLowerCase()}`;
// The same bot on JannyAI: its address is the JanitorAI one with the domain swapped (janitorai.com → jannyai.com),
// slug included. The visitor's browser opens it directly — our server never calls JannyAI.
const JANITOR_PAGE=/^https?:\/\/(?:www\.)?janitorai\.com(\/characters\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[^\s?#]*)/i;
export function jannyPage(janitorUrl,uuid){const m=String(janitorUrl||'').match(JANITOR_PAGE);if(m)return`https://jannyai.com${m[1]}`;const id=String(uuid||'').toLowerCase();return /^[0-9a-f-]{36}$/.test(id)?`https://jannyai.com/characters/${id}`:''}

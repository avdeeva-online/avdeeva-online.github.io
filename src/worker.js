function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function extractJanitorUuid(input) {
  const m = String(input || "").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0].toLowerCase() : null;
}
function datacatHeaders(env) {
  return { accept: "application/json", "x-device-token": env.DATACAT_DEVICE_TOKEN || "", "x-session-token": env.DATACAT_SESSION_TOKEN || "", "user-agent": "ARCHIVE.EXE/1.0" };
}
async function fetchDatacatPublic(env, uuid) {
  if (!env.DATACAT_DEVICE_TOKEN || !env.DATACAT_SESSION_TOKEN) return { state: "SESSION_MISSING", status: 500 };
  const endpoint = `https://datacat.run/api/characters/recent-public/${encodeURIComponent(uuid)}?view=modal&sourceKind=janitor`;
  const r = await fetch(endpoint, { headers: datacatHeaders(env), redirect: "follow" });
  if (r.status === 404) return { state: "MISSING", status: 404 };
  if (r.status === 410) return { state: "UNAVAILABLE", status: 410 };
  if (!r.ok) return { state: "ERROR", status: r.status, detail: (await r.text()).slice(0, 500) };
  try { return { state: "FOUND", status: 200, data: await r.json() }; }
  catch { return { state: "ERROR", status: 502, detail: "DataCat returned non-JSON content." }; }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      let db = false, databaseError = null;
      try { db = (await env.DB.prepare("SELECT 1 AS ok").first())?.ok === 1; } catch (e) { databaseError = String(e?.message || e); }
      const envKeys = Object.keys(env).sort();
      return json({ ok: true, worker: "archive-exe", database: db, databaseError, datacatSecrets: Boolean(env.DATACAT_DEVICE_TOKEN && env.DATACAT_SESSION_TOKEN), envKeys, hasDatacatDeviceToken: Object.prototype.hasOwnProperty.call(env, "DATACAT_DEVICE_TOKEN"), hasDatacatSessionToken: Object.prototype.hasOwnProperty.call(env, "DATACAT_SESSION_TOKEN") });
    }
    if (url.pathname === "/api/debug/datacat") {
      const uuid = extractJanitorUuid(url.searchParams.get("uuid") || "");
      if (!uuid) return json({ ok: false, error: "INVALID_UUID" }, 400);
      const dc = await fetchDatacatPublic(env, uuid);
      if (dc.state !== "FOUND") return json({ ok: false, state: dc.state, status: dc.status, detail: dc.detail || null }, dc.status || 500);
      return json({ ok: true, state: "DATACAT_RAW_DEBUG", janitorUuid: uuid, raw: dc.data });
    }
    return env.ASSETS.fetch(request);
  }
};

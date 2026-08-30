
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function extractJanitorUuid(input) {
  if (!input) return null;
  const match = String(input).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0].toLowerCase() : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      let db = false;
      let dbError = null;

      try {
        const row = await env.DB.prepare("SELECT 1 AS ok").first();
        db = row?.ok === 1;
      } catch (error) {
        dbError = String(error?.message || error);
      }

      return json({
        ok: true,
        worker: "archive-exe",
        database: db,
        databaseError: dbError
      });
    }

    if (url.pathname === "/api/import" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({
          ok: false,
          error: "INVALID_JSON"
        }, 400);
      }

      const janitorUrl = String(body?.url || "").trim();
      const janitorUuid = extractJanitorUuid(janitorUrl);

      if (!janitorUuid) {
        return json({
          ok: false,
          error: "INVALID_JANITOR_URL",
          message: "Janitor UUID was not found in the submitted URL."
        }, 400);
      }

      try {
        const character = await env.DB.prepare(`
          SELECT
            id,
            janitor_uuid,
            slug,
            name,
            author,
            universe,
            pov,
            tags,
            hashtags,
            short_description,
            description,
            scenario,
            intros,
            image_url,
            janitor_url,
            datacat_url,
            card_url,
            lorebook_url,
            source,
            status,
            created_at,
            updated_at
          FROM characters
          WHERE janitor_uuid = ?
          LIMIT 1
        `).bind(janitorUuid).first();

        if (character) {
          return json({
            ok: true,
            state: "FOUND",
            janitorUuid,
            character
          });
        }

        return json({
          ok: true,
          state: "MISSING",
          janitorUuid,
          janitorUrl,
          next: "DATACAT_RETRIEVAL"
        });
      } catch (error) {
        return json({
          ok: false,
          error: "DATABASE_ERROR",
          message: String(error?.message || error)
        }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};

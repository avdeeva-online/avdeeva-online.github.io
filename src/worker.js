function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function extractJanitorUuid(input) {
  const m = String(input || "").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0].toLowerCase() : null;
}

function stripHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugify(name, uuid) {
  const base = String(name || "character")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "character"}-${uuid.slice(0, 8)}`;
}

function inferPov(tags) {
  const s = tags.map(x => String(x).toLowerCase()).join(" ");
  if (s.includes("fempov") || s.includes("female pov")) return "FemPOV";
  if (s.includes("malepov") || s.includes("male pov")) return "MalePOV";
  if (s.includes("anypov") || s.includes("any pov")) return "AnyPOV";
  return "";
}

function datacatHeaders(env) {
  return {
    "accept": "application/json",
    "x-device-token": env.DATACAT_DEVICE_TOKEN || "",
    "x-session-token": env.DATACAT_SESSION_TOKEN || "",
    "user-agent": "ARCHIVE.EXE/1.0"
  };
}

async function fetchDatacatPublic(env, uuid) {
  if (!env.DATACAT_DEVICE_TOKEN || !env.DATACAT_SESSION_TOKEN) {
    return { state: "SESSION_MISSING", status: 500 };
  }

  const endpoint =
    `https://datacat.run/api/characters/recent-public/${encodeURIComponent(uuid)}?view=modal&sourceKind=janitor`;

  const r = await fetch(endpoint, {
    headers: datacatHeaders(env),
    redirect: "follow"
  });

  if (r.status === 404) return { state: "MISSING" };
  if (r.status === 410) return { state: "UNAVAILABLE" };

  if (!r.ok) {
    const body = await r.text();
    return {
      state: (r.status === 401 || r.status === 403) ? "SESSION_ERROR" : "ERROR",
      status: r.status,
      detail: body.slice(0, 500)
    };
  }

  try {
    return { state: "FOUND", data: await r.json() };
  } catch {
    return { state: "ERROR", status: 502, detail: "DataCat returned non-JSON content." };
  }
}

function getDatacatCharacter(payload) {
  const c = payload?.character;
  return c && typeof c === "object" ? c : null;
}

function getLorebookScript(character) {
  const scripts = Array.isArray(character?.scripts) ? character.scripts : [];
  return scripts.find(s =>
    s &&
    String(s.type || "").toLowerCase() === "lorebook" &&
    s.is_public !== false &&
    s.is_code_public !== false &&
    typeof s.script === "string" &&
    s.script.trim()
  ) || null;
}

function parseDatacatExact(payload, uuid, janitorUrl, origin) {
  const c = getDatacatCharacter(payload);
  if (!c) throw new Error("DataCat response has no character object.");

  const tags = (Array.isArray(c.tags) ? c.tags : [])
    .map(t => typeof t === "string" ? t : (t?.name || t?.slug || ""))
    .map(x => String(x).trim())
    .filter(Boolean);

  const hashtags = (Array.isArray(c.custom_tags) ? c.custom_tags : [])
    .map(x => String(x).trim().replace(/^#/, ""))
    .filter(Boolean);

  const description = stripHtml(c.description || c.rawDescription || c.raw_description || "");
  const lorebook = getLorebookScript(c);
  const avatar =
    c.avatarDisplayUrl ||
    c.avatar_display_url ||
    c.avatar ||
    c.avatarVariantUrls?.card ||
    c.avatar_variant_urls?.card ||
    "";

  const scenario = typeof c.scenario === "string" ? stripHtml(c.scenario) : "";
  const intros = [];

  return {
    janitor_uuid: uuid,
    slug: slugify(c.name || c.chat_name || c.chatName, uuid),
    name: String(c.name || c.chat_name || c.chatName || `Janitor ${uuid.slice(0, 8)}`).trim(),
    author: String(c.creator_name || c.creatorName || "").trim(),
    author_url: "",
    universe: "",
    pov: inferPov(tags),
    tags,
    hashtags,
    short_description: description.slice(0, 300),
    description,
    scenario,
    intros,
    image_url: avatar,
    janitor_url: janitorUrl,
    datacat_url: `https://datacat.run/characters/recent/janitor/${uuid}`,
    card_url: "",
    lorebook_url: lorebook ? `${origin}/api/characters/${uuid}/lorebook` : "",
    source: "janitor",
    status: "published"
  };
}

async function getExisting(env, uuid) {
  return await env.DB.prepare(`
    SELECT * FROM characters
    WHERE janitor_uuid = ?
    LIMIT 1
  `).bind(uuid).first();
}

async function saveCharacter(env, c) {
  await env.DB.prepare(`
    INSERT INTO characters (
      janitor_uuid, slug, name, author, author_url, universe, pov,
      tags, hashtags, short_description, description, scenario, intros,
      image_url, janitor_url, datacat_url, card_url, lorebook_url,
      source, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(janitor_uuid) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      author = excluded.author,
      author_url = excluded.author_url,
      universe = excluded.universe,
      pov = excluded.pov,
      tags = excluded.tags,
      hashtags = excluded.hashtags,
      short_description = excluded.short_description,
      description = excluded.description,
      scenario = excluded.scenario,
      intros = excluded.intros,
      image_url = excluded.image_url,
      janitor_url = excluded.janitor_url,
      datacat_url = excluded.datacat_url,
      card_url = excluded.card_url,
      lorebook_url = excluded.lorebook_url,
      source = excluded.source,
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    c.janitor_uuid, c.slug, c.name, c.author, c.author_url, c.universe, c.pov,
    JSON.stringify(c.tags), JSON.stringify(c.hashtags), c.short_description,
    c.description, c.scenario, JSON.stringify(c.intros), c.image_url,
    c.janitor_url, c.datacat_url, c.card_url, c.lorebook_url,
    c.source, c.status
  ).run();
}

function safeFilename(value) {
  return String(value || "lorebook")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "lorebook";
}

async function lorebookDownload(env, uuid) {
  const dc = await fetchDatacatPublic(env, uuid);
  if (dc.state !== "FOUND") {
    return json({
      ok: false,
      state: `DATACAT_${dc.state}`,
      status: dc.status || null,
      detail: dc.detail || null
    }, dc.state === "MISSING" ? 404 : 502);
  }

  const c = getDatacatCharacter(dc.data);
  const book = getLorebookScript(c);
  if (!book) {
    return json({ ok: false, state: "LOREBOOK_NOT_AVAILABLE", janitorUuid: uuid }, 404);
  }

  let parsed;
  try {
    parsed = JSON.parse(book.script);
  } catch {
    parsed = book.script;
  }

  const filename = `${safeFilename(book.title || c?.name)}.json`;
  return new Response(JSON.stringify(parsed, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store"
    }
  });
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
        databaseError: dbError,
        datacatSecrets: Boolean(env.DATACAT_DEVICE_TOKEN && env.DATACAT_SESSION_TOKEN)
      });
    }

    if (url.pathname === "/api/debug/datacat" && request.method === "GET") {
      const uuid = extractJanitorUuid(url.searchParams.get("uuid"));
      if (!uuid) return json({ ok: false, error: "INVALID_UUID" }, 400);
      const dc = await fetchDatacatPublic(env, uuid);
      return json({
        ok: dc.state === "FOUND",
        state: dc.state === "FOUND" ? "DATACAT_RAW_DEBUG" : `DATACAT_${dc.state}`,
        janitorUuid: uuid,
        raw: dc.state === "FOUND" ? dc.data : undefined,
        status: dc.status,
        detail: dc.detail
      }, dc.state === "FOUND" ? 200 : 502);
    }

    const loreMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/lorebook$/i);
    if (loreMatch && request.method === "GET") {
      return lorebookDownload(env, loreMatch[1].toLowerCase());
    }

    const charMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})$/i);
    if (charMatch && request.method === "GET") {
      const row = await getExisting(env, charMatch[1].toLowerCase());
      return row ? json({ ok: true, character: row }) : json({ ok: false, error: "NOT_FOUND" }, 404);
    }

    if (url.pathname === "/api/import" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "INVALID_JSON" }, 400);
      }

      const janitorUrl = String(body?.url || "").trim();
      const uuid = extractJanitorUuid(janitorUrl);
      if (!uuid) return json({ ok: false, error: "INVALID_JANITOR_URL" }, 400);

      try {
        const dc = await fetchDatacatPublic(env, uuid);

        if (dc.state === "FOUND") {
          const parsed = parseDatacatExact(dc.data, uuid, janitorUrl, url.origin);
          await saveCharacter(env, parsed);
          const saved = await getExisting(env, uuid);

          return json({
            ok: true,
            state: "IMPORTED_FROM_DATACAT",
            janitorUuid: uuid,
            character: saved
          });
        }

        if (dc.state === "UNAVAILABLE") {
          return json({
            ok: false,
            state: "UNAVAILABLE",
            janitorUuid: uuid,
            message: "DataCat reports this record as deleted or unavailable."
          }, 410);
        }

        if (dc.state === "MISSING") {
          const existing = await getExisting(env, uuid);
          if (existing) {
            return json({
              ok: true,
              state: "FOUND_IN_ARCHIVE",
              janitorUuid: uuid,
              character: existing,
              note: "DataCat lookup is currently missing this record, so the existing archive copy was kept."
            });
          }
          return json({
            ok: true,
            state: "NEEDS_DATACAT_RETRIEVAL",
            janitorUuid: uuid,
            janitorUrl,
            message: "Character is not stored in DataCat yet. Next step is retrieval-v2."
          });
        }

        return json({
          ok: false,
          state: dc.state === "SESSION_ERROR" ? "DATACAT_SESSION_ERROR" : "DATACAT_ERROR",
          janitorUuid: uuid,
          status: dc.status || null,
          detail: dc.detail || null
        }, 502);
      } catch (error) {
        return json({
          ok: false,
          error: "IMPORT_ERROR",
          message: String(error?.message || error)
        }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};

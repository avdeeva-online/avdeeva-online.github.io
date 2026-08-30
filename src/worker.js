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

function safeFilename(value, fallback = "character") {
  return String(value || fallback)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || fallback;
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

async function fetchDatacatView(env, uuid, view = "modal") {
  if (!env.DATACAT_DEVICE_TOKEN || !env.DATACAT_SESSION_TOKEN) {
    return { state: "SESSION_MISSING", status: 500 };
  }

  const endpoint = `https://datacat.run/api/characters/recent-public/${encodeURIComponent(uuid)}?view=${encodeURIComponent(view)}&sourceKind=janitor`;
  const r = await fetch(endpoint, { headers: datacatHeaders(env), redirect: "follow" });

  if (r.status === 404) return { state: "MISSING", status: 404 };
  if (r.status === 410) return { state: "UNAVAILABLE", status: 410 };
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

async function fetchDatacatPublic(env, uuid) {
  return fetchDatacatView(env, uuid, "modal");
}

function getDatacatCharacter(payload) {
  const c = payload?.character;
  return c && typeof c === "object" ? c : null;
}

function getLorebookScript(character) {
  const scripts = Array.isArray(character?.scripts) ? character.scripts : [];
  return scripts.find(s =>
    s && String(s.type || "").toLowerCase() === "lorebook" &&
    s.is_public !== false && s.is_code_public !== false &&
    typeof s.script === "string" && s.script.trim()
  ) || null;
}

function walkValues(root, callback, seen = new WeakSet()) {
  if (!root || typeof root !== "object" || seen.has(root)) return;
  seen.add(root);
  callback(root);
  for (const value of Object.values(root)) walkValues(value, callback, seen);
}

function findField(root, names) {
  const wanted = new Set(names.map(x => String(x).toLowerCase()));
  let result;
  walkValues(root, obj => {
    if (result !== undefined) return;
    for (const [key, value] of Object.entries(obj)) {
      if (!wanted.has(key.toLowerCase()) || value == null) continue;
      if (typeof value === "string" && !value.trim()) continue;
      result = value;
      return;
    }
  });
  return result;
}

function normalizeText(value) {
  if (value == null) return "";
  if (typeof value === "string") return stripHtml(value);
  if (typeof value === "object") {
    const nested = value.content ?? value.text ?? value.value ?? value.body ?? value.description;
    if (nested != null && nested !== value) return normalizeText(nested);
  }
  return "";
}

function normalizeGreetings(value) {
  const list = Array.isArray(value) ? value : (value == null ? [] : [value]);
  return list.map(normalizeText).filter(Boolean);
}

function getCharacterTags(c) {
  return (Array.isArray(c?.tags) ? c.tags : [])
    .map(t => typeof t === "string" ? t : (t?.name || t?.slug || ""))
    .map(x => String(x).trim())
    .filter(Boolean);
}

function getCharacterHashtags(c) {
  return (Array.isArray(c?.custom_tags) ? c.custom_tags : [])
    .map(x => String(x).trim().replace(/^#/, ""))
    .filter(Boolean);
}

function getAvatar(c) {
  return c?.avatarDisplayUrl || c?.avatar_display_url || c?.avatar ||
    c?.avatarVariantUrls?.card || c?.avatar_variant_urls?.card || "";
}

function parseDatacatExact(payload, uuid, janitorUrl, origin) {
  const c = getDatacatCharacter(payload);
  if (!c) throw new Error("DataCat response has no character object.");

  const tags = getCharacterTags(c);
  const hashtags = getCharacterHashtags(c);
  const description = stripHtml(c.description || c.rawDescription || c.raw_description || "");
  const lorebook = getLorebookScript(c);
  const scenario = typeof c.scenario === "string" ? stripHtml(c.scenario) : "";
  const cardAvailable = c.downloads_disabled !== true && Boolean(
    c.chara_card_v2_json || c.tab_availability?.personality || c.tab_availability?.greeting
  );

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
    intros: [],
    image_url: getAvatar(c),
    janitor_url: janitorUrl,
    datacat_url: `https://datacat.run/characters/recent/janitor/${uuid}`,
    card_url: cardAvailable ? `${origin}/api/characters/${uuid}/card` : "",
    lorebook_url: lorebook ? `${origin}/api/characters/${uuid}/lorebook` : "",
    source: "janitor",
    status: "published"
  };
}

async function getExisting(env, uuid) {
  return await env.DB.prepare(`SELECT * FROM characters WHERE janitor_uuid = ? LIMIT 1`).bind(uuid).first();
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
      slug = excluded.slug, name = excluded.name, author = excluded.author,
      author_url = excluded.author_url, universe = excluded.universe, pov = excluded.pov,
      tags = excluded.tags, hashtags = excluded.hashtags,
      short_description = excluded.short_description, description = excluded.description,
      scenario = excluded.scenario, intros = excluded.intros, image_url = excluded.image_url,
      janitor_url = excluded.janitor_url, datacat_url = excluded.datacat_url,
      card_url = excluded.card_url, lorebook_url = excluded.lorebook_url,
      source = excluded.source, status = excluded.status, updated_at = CURRENT_TIMESTAMP
  `).bind(
    c.janitor_uuid, c.slug, c.name, c.author, c.author_url, c.universe, c.pov,
    JSON.stringify(c.tags), JSON.stringify(c.hashtags), c.short_description,
    c.description, c.scenario, JSON.stringify(c.intros), c.image_url,
    c.janitor_url, c.datacat_url, c.card_url, c.lorebook_url,
    c.source, c.status
  ).run();
}

async function lorebookDownload(env, uuid) {
  const dc = await fetchDatacatPublic(env, uuid);
  if (dc.state !== "FOUND") {
    return json({ ok: false, state: `DATACAT_${dc.state}`, status: dc.status || null, detail: dc.detail || null }, dc.state === "MISSING" ? 404 : 502);
  }

  const c = getDatacatCharacter(dc.data);
  const book = getLorebookScript(c);
  if (!book) return json({ ok: false, state: "LOREBOOK_NOT_AVAILABLE", janitorUuid: uuid }, 404);

  let parsed;
  try { parsed = JSON.parse(book.script); } catch { parsed = book.script; }
  const filename = `${safeFilename(book.title || c?.name, "lorebook")}.json`;
  return new Response(JSON.stringify(parsed, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store"
    }
  });
}

async function collectCardDefinition(env, uuid, modalPayload) {
  const c = getDatacatCharacter(modalPayload);
  if (!c) return null;

  if (c.chara_card_v2_json && typeof c.chara_card_v2_json === "object") {
    return c.chara_card_v2_json;
  }
  if (typeof c.chara_card_v2_json === "string" && c.chara_card_v2_json.trim()) {
    try { return JSON.parse(c.chara_card_v2_json); } catch {}
  }

  const views = ["personality", "greeting", "scenario", "alt_greetings"];
  const payloads = { modal: modalPayload };
  await Promise.all(views.map(async view => {
    const r = await fetchDatacatView(env, uuid, view);
    if (r.state === "FOUND") payloads[view] = r.data;
  }));

  const personality = normalizeText(findField(payloads, [
    "personality", "definition", "character_definition", "characterDefinition", "prompt", "persona"
  ]));
  const firstMes = normalizeText(findField(payloads, [
    "first_mes", "first_message", "firstMessage", "greeting", "initial_message", "initialMessage"
  ]));
  const scenario = normalizeText(findField(payloads, ["scenario"]));
  const mesExample = normalizeText(findField(payloads, [
    "mes_example", "example_dialogs", "exampleDialogs", "example_dialog", "exampleDialog"
  ]));
  const alternateGreetings = normalizeGreetings(findField(payloads, [
    "alternate_greetings", "alternateGreetings", "alt_greetings", "altGreetings", "alternative_greetings"
  ]));

  if (!personality && !firstMes) return null;

  const tags = [...getCharacterTags(c), ...getCharacterHashtags(c).map(x => `#${x}`)];
  const lorebook = getLorebookScript(c);
  let characterBook;
  if (lorebook) {
    try { characterBook = { name: lorebook.title || "Lorebook", entries: JSON.parse(lorebook.script) }; }
    catch { characterBook = undefined; }
  }

  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: String(c.chat_name || c.chatName || c.name || "Character"),
      description: personality,
      personality: personality,
      scenario,
      first_mes: firstMes,
      mes_example: mesExample,
      creator_notes: stripHtml(c.description || c.rawDescription || c.raw_description || ""),
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: alternateGreetings,
      tags,
      creator: String(c.creator_name || c.creatorName || ""),
      character_version: String(c.updated_at || c.extracted_update_at || ""),
      extensions: {
        archive_exe: {
          janitor_uuid: uuid,
          source: "janitor",
          janitor_url: `https://janitorai.com/characters/${uuid}`,
          datacat_url: `https://datacat.run/characters/recent/janitor/${uuid}`,
          avatar_url: getAvatar(c)
        }
      },
      ...(characterBook ? { character_book: characterBook } : {})
    }
  };
}

async function cardDownload(env, uuid) {
  const dc = await fetchDatacatPublic(env, uuid);
  if (dc.state !== "FOUND") {
    return json({ ok: false, state: `DATACAT_${dc.state}`, status: dc.status || null, detail: dc.detail || null }, dc.state === "MISSING" ? 404 : 502);
  }

  const c = getDatacatCharacter(dc.data);
  if (c?.downloads_disabled === true) {
    return json({ ok: false, state: "CARD_DOWNLOAD_DISABLED", janitorUuid: uuid }, 403);
  }

  const card = await collectCardDefinition(env, uuid, dc.data);
  if (!card) {
    return json({
      ok: false,
      state: "CARD_DEFINITION_NOT_AVAILABLE",
      janitorUuid: uuid,
      message: "DataCat reports definition tabs, but this API session did not expose the character definition/greeting yet."
    }, 409);
  }

  const filename = `${safeFilename(c?.chat_name || c?.chatName || c?.name, "character")}.json`;
  return new Response(JSON.stringify(card, null, 2), {
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
    if (loreMatch && request.method === "GET") return lorebookDownload(env, loreMatch[1].toLowerCase());

    const cardMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})\/card$/i);
    if (cardMatch && request.method === "GET") return cardDownload(env, cardMatch[1].toLowerCase());

    const charMatch = url.pathname.match(/^\/api\/characters\/([0-9a-f-]{36})$/i);
    if (charMatch && request.method === "GET") {
      const row = await getExisting(env, charMatch[1].toLowerCase());
      return row ? json({ ok: true, character: row }) : json({ ok: false, error: "NOT_FOUND" }, 404);
    }

    if (url.pathname === "/api/import" && request.method === "POST") {
      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "INVALID_JSON" }, 400); }

      const janitorUrl = String(body?.url || "").trim();
      const uuid = extractJanitorUuid(janitorUrl);
      if (!uuid) return json({ ok: false, error: "INVALID_JANITOR_URL" }, 400);

      try {
        const dc = await fetchDatacatPublic(env, uuid);
        if (dc.state === "FOUND") {
          const parsed = parseDatacatExact(dc.data, uuid, janitorUrl, url.origin);
          await saveCharacter(env, parsed);
          const saved = await getExisting(env, uuid);
          return json({ ok: true, state: "IMPORTED_FROM_DATACAT", janitorUuid: uuid, character: saved });
        }

        if (dc.state === "UNAVAILABLE") {
          return json({ ok: false, state: "UNAVAILABLE", janitorUuid: uuid, message: "DataCat reports this record as deleted or unavailable." }, 410);
        }

        if (dc.state === "MISSING") {
          const existing = await getExisting(env, uuid);
          if (existing) {
            return json({ ok: true, state: "FOUND_IN_ARCHIVE", janitorUuid: uuid, character: existing, note: "DataCat lookup is currently missing this record, so the existing archive copy was kept." });
          }
          return json({ ok: true, state: "NEEDS_DATACAT_RETRIEVAL", janitorUuid: uuid, janitorUrl, message: "Character is not stored in DataCat yet. Next step is retrieval-v2." });
        }

        return json({
          ok: false,
          state: dc.state === "SESSION_ERROR" ? "DATACAT_SESSION_ERROR" : "DATACAT_ERROR",
          janitorUuid: uuid,
          status: dc.status || null,
          detail: dc.detail || null
        }, 502);
      } catch (error) {
        return json({ ok: false, error: "IMPORT_ERROR", message: String(error?.message || error) }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
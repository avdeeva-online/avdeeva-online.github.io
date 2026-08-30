function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
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

function stripHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function walk(obj, cb) {
  if (!obj || typeof obj !== "object") return;
  cb(obj);
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") walk(v, cb);
  }
}

function findFirst(root, keys) {
  const wanted = new Set(keys.map(x => x.toLowerCase()));
  let found;
  walk(root, obj => {
    if (found !== undefined) return;
    for (const [k, v] of Object.entries(obj)) {
      if (wanted.has(k.toLowerCase()) && v != null && String(v).trim() !== "") {
        found = v;
        return;
      }
    }
  });
  return found;
}

function chooseCard(root) {
  let best = { score: -1, obj: root };
  walk(root, obj => {
    const keys = Object.keys(obj).map(k => k.toLowerCase());
    let score = 0;
    for (const k of [
      "name", "description", "personality", "scenario",
      "first_mes", "first_message", "alternate_greetings",
      "creator_notes", "tags"
    ]) {
      if (keys.includes(k)) score += (k === "scenario" || k === "first_mes") ? 4 : 2;
    }
    if (score > best.score) best = { score, obj };
  });

  if (best.obj?.data && typeof best.obj.data === "object") {
    const d = best.obj.data;
    const keys = Object.keys(d).map(k => k.toLowerCase());
    if (keys.some(k => ["description", "scenario", "first_mes", "first_message"].includes(k))) {
      return d;
    }
  }
  return best.obj;
}

function toText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) {
    return v.map(x => {
      if (x && typeof x === "object") return x.name || x.label || x.value || JSON.stringify(x);
      return String(x);
    }).join(", ");
  }
  if (typeof v === "object") return v.name || v.label || v.value || JSON.stringify(v);
  return String(v);
}

function toArray(v) {
  if (v == null || v === "") return [];
  return Array.isArray(v) ? v : [v];
}

function pickImage(root) {
  let candidate = findFirst(root, [
    "avatar", "avatar_url", "avatarUrl", "image", "image_url",
    "imageUrl", "thumbnail", "media_url", "mediaUrl"
  ]);

  if (candidate && typeof candidate === "object") {
    candidate = candidate.url || candidate.src || candidate.path;
  }
  if (candidate && /^https?:/i.test(String(candidate))) return String(candidate);

  let found = "";
  walk(root, obj => {
    if (found) return;
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && /^https?:\/\/[^ ]+\.(png|jpe?g|webp)(\?|$)/i.test(v)) {
        found = v;
        break;
      }
    }
  });
  return found;
}

function detectLorebook(root) {
  let yes = false;
  walk(root, obj => {
    for (const [k, v] of Object.entries(obj)) {
      const key = k.toLowerCase();
      if (["character_book", "characterbook", "lorebook", "worldbook", "world_info", "worldinfo"].includes(key)) {
        if (v && ((Array.isArray(v) && v.length) || typeof v === "object")) yes = true;
      }
    }
  });
  return yes;
}

function inferPov(tags) {
  const s = tags.map(x => String(x).toLowerCase()).join(" ");
  if (s.includes("fempov") || s.includes("female pov")) return "FemPOV";
  if (s.includes("malepov") || s.includes("male pov")) return "MalePOV";
  if (s.includes("anypov") || s.includes("any pov")) return "AnyPOV";
  return "";
}

function slugify(name, uuid) {
  const base = String(name || "character")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (base || "character") + "-" + uuid.slice(0, 8);
}

function parseDatacat(root, uuid, janitorUrl) {
  const card = chooseCard(root);

  const name = stripHtml(toText(
    card.name ?? findFirst(root, ["character_name", "characterName", "name", "title"])
  ));
  const author = stripHtml(toText(
    card.creator ?? card.author ?? findFirst(root, ["creator_name", "creatorName", "author", "username"])
  ));

  const rawTags = card.tags ?? findFirst(root, ["tags", "tag_names", "tagNames"]);
  const tags = toArray(rawTags).map(x => {
    if (x && typeof x === "object") return String(x.name || x.label || x.value || "").trim();
    return String(x).trim();
  }).filter(Boolean);

  const description = stripHtml(toText(
    card.description ?? card.personality ?? findFirst(root, ["definition", "description", "personality"])
  ));
  const scenario = stripHtml(toText(card.scenario ?? findFirst(root, ["scenario"])));

  const first =
    card.first_mes ??
    card.first_message ??
    findFirst(root, ["first_mes", "first_message", "firstMessage", "greeting", "opening"]);

  const alt =
    card.alternate_greetings ??
    card.alternateGreetings ??
    findFirst(root, ["alternate_greetings", "alternateGreetings", "alternative_greetings"]);

  const intros = [first, ...toArray(alt)]
    .filter(Boolean)
    .map(v => stripHtml(toText(v)))
    .filter(Boolean);

  const authorUrl = toText(findFirst(root, [
    "creator_url", "creatorUrl", "author_url", "authorUrl", "profile_url", "profileUrl"
  ]));

  return {
    janitor_uuid: uuid,
    slug: slugify(name, uuid),
    name: name || `Janitor ${uuid.slice(0, 8)}`,
    author,
    author_url: authorUrl && /^https?:/i.test(authorUrl) ? authorUrl : "",
    universe: "",
    pov: inferPov(tags),
    tags,
    hashtags: [],
    short_description: description.slice(0, 300),
    description,
    scenario,
    intros,
    image_url: pickImage(root),
    janitor_url: janitorUrl,
    datacat_url: `https://datacat.run/characters/recent/janitor/${uuid}`,
    card_url: "",
    lorebook_url: detectLorebook(root) ? "DATACAT_LOREBOOK_PRESENT" : "",
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
    return {
      state: "SESSION_MISSING",
      status: 500,
      detail: "Cloudflare secrets DATACAT_DEVICE_TOKEN / DATACAT_SESSION_TOKEN are missing."
    };
  }

  const endpoint =
    `https://datacat.run/api/characters/recent-public/${encodeURIComponent(uuid)}?view=modal&sourceKind=janitor`;

  const r = await fetch(endpoint, {
    headers: datacatHeaders(env),
    redirect: "follow"
  });

  if (r.status === 404) return { state: "MISSING" };
  if (r.status === 410) return { state: "UNAVAILABLE" };

  if (r.status === 401 || r.status === 403) {
    const body = await r.text();
    return {
      state: "SESSION_ERROR",
      status: r.status,
      detail: body.slice(0, 500)
    };
  }

  if (!r.ok) {
    const body = await r.text();
    return {
      state: "ERROR",
      status: r.status,
      detail: body.slice(0, 500)
    };
  }

  let data;
  try {
    data = await r.json();
  } catch {
    return {
      state: "ERROR",
      status: 502,
      detail: "DataCat returned non-JSON content."
    };
  }

  return { state: "FOUND", data };
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

      const envKeys = Object.keys(env).sort();

      return json({
        ok: true,
        worker: "archive-exe",
        database: db,
        databaseError: dbError,
        datacatSecrets:
          Boolean(env.DATACAT_DEVICE_TOKEN && env.DATACAT_SESSION_TOKEN),
        envKeys,
        hasDatacatDeviceToken:
          Object.prototype.hasOwnProperty.call(env, "DATACAT_DEVICE_TOKEN"),
        hasDatacatSessionToken:
          Object.prototype.hasOwnProperty.call(env, "DATACAT_SESSION_TOKEN")
      });
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

      if (!uuid) {
        return json({ ok: false, error: "INVALID_JANITOR_URL" }, 400);
      }

      try {
        const existing = await getExisting(env, uuid);

        if (existing) {
          return json({
            ok: true,
            state: "FOUND_IN_ARCHIVE",
            janitorUuid: uuid,
            character: existing
          });
        }

        const dc = await fetchDatacatPublic(env, uuid);

        if (dc.state === "FOUND") {
          const parsed = parseDatacat(dc.data, uuid, janitorUrl);
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
          return json({
            ok: true,
            state: "NEEDS_DATACAT_RETRIEVAL",
            janitorUuid: uuid,
            janitorUrl,
            message: "Authorized DataCat lookup worked, but this character is not stored there yet. Next step: retrieval-v2."
          });
        }

        if (dc.state === "SESSION_MISSING") {
          return json({
            ok: false,
            state: "DATACAT_SECRETS_MISSING",
            janitorUuid: uuid,
            detail: dc.detail
          }, 500);
        }

        if (dc.state === "SESSION_ERROR") {
          return json({
            ok: false,
            state: "DATACAT_SESSION_ERROR",
            janitorUuid: uuid,
            status: dc.status,
            detail: dc.detail
          }, 502);
        }

        return json({
          ok: false,
          state: "DATACAT_ERROR",
          janitorUuid: uuid,
          status: dc.status,
          detail: dc.detail
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

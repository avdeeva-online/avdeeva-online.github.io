import worker from "./worker.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function extractUuid(input) {
  const m = String(input || "").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0].toLowerCase() : null;
}

function headers(env, jsonBody = false) {
  return {
    "accept": "application/json",
    ...(jsonBody ? { "content-type": "application/json" } : {}),
    "x-device-token": env.DATACAT_DEVICE_TOKEN || "",
    "x-session-token": env.DATACAT_SESSION_TOKEN || "",
    "user-agent": "ARCHIVE.EXE/1.0"
  };
}

async function safeJsonResponse(response) {
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; }
  catch { body = text.slice(0, 4000); }
  return { status: response.status, ok: response.ok, body };
}

async function fetchView(env, uuid, view) {
  const url = `https://datacat.run/api/characters/recent-public/${encodeURIComponent(uuid)}?view=${encodeURIComponent(view)}&sourceKind=janitor`;
  try {
    return await safeJsonResponse(await fetch(url, {
      headers: headers(env),
      redirect: "follow"
    }));
  } catch (error) {
    return { status: 0, ok: false, body: { error: String(error?.message || error) } };
  }
}

async function debugRetrieval(env, uuid) {
  if (!env.DATACAT_DEVICE_TOKEN || !env.DATACAT_SESSION_TOKEN) {
    return json({ ok: false, error: "DATACAT_SECRETS_MISSING" }, 500);
  }

  const requestId = crypto.randomUUID();
  const retrievalBody = {
    url: `https://janitorai.com/characters/${uuid}`,
    openLoginIfNoSession: true,
    appearOnPublicFeed: false,
    publicFeedVisibilityIntent: false,
    useSeparateWorkerServer: false,
    inlinePostExtractCreatorProfile: true,
    idempotencyKey: `${uuid}-debug-${Date.now()}`,
    extractSourceMode: "core_plus_janny",
    alwaysReextract: true
  };

  let retrieval;
  try {
    retrieval = await safeJsonResponse(await fetch("https://datacat.run/api/character/retrieval-v2", {
      method: "POST",
      headers: {
        ...headers(env, true),
        "x-request-id": requestId
      },
      body: JSON.stringify(retrievalBody),
      redirect: "follow"
    }));
  } catch (error) {
    retrieval = { status: 0, ok: false, body: { error: String(error?.message || error) } };
  }

  const views = {};
  for (const view of ["modal", "personality", "greeting", "scenario", "alt_greetings"]) {
    views[view] = await fetchView(env, uuid, view);
  }

  return json({
    ok: retrieval.ok,
    state: "DATACAT_RETRIEVAL_DEBUG",
    janitorUuid: uuid,
    retrieval: {
      status: retrieval.status,
      ok: retrieval.ok,
      body: retrieval.body
    },
    views
  }, retrieval.ok ? 200 : 502);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/debug/retrieval" && request.method === "GET") {
      const uuid = extractUuid(url.searchParams.get("uuid"));
      if (!uuid) return json({ ok: false, error: "INVALID_UUID" }, 400);
      return debugRetrieval(env, uuid);
    }

    return worker.fetch(request, env, ctx);
  }
};

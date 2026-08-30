
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Tiny health check: confirms that the Worker code is running
    // and that the D1 binding is available.
    if (url.pathname === "/api/health") {
      let db = false;
      let dbError = null;

      try {
        const row = await env.DB.prepare("SELECT 1 AS ok").first();
        db = row?.ok === 1;
      } catch (error) {
        dbError = String(error?.message || error);
      }

      return Response.json({
        ok: true,
        worker: "archive-exe",
        database: db,
        databaseError: dbError
      });
    }

    // All normal site requests still go to the static ARCHIVE.EXE files.
    return env.ASSETS.fetch(request);
  }
};

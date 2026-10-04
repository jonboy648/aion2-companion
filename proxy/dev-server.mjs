// Local e2e: runs the same handler as the Worker on http://localhost:8787 (real upstream, in-memory cache).
// No STATS (D1) binding and no ADMIN_* secrets here, so analytics logging is a no-op and /admin/stats answers 401.
// To try the admin route locally: ADMIN_TOKEN=x node dev-server.mjs still answers 503 (no database), by design.
import http from "node:http";
import { handle } from "./worker.js";

const env = {
  ALLOWED_ORIGINS:
    process.env.ALLOWED_ORIGINS ??
    "https://becomecube.com,https://www.becomecube.com,http://localhost:5173,http://localhost:4173",
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
};
const store = new Map();
const cache = {
  async match(req) {
    const e = store.get(req.url);
    if (!e || e.exp < Date.now()) return undefined;
    return new Response(e.body, { status: e.status, headers: e.headers });
  },
  async put(req, res) {
    store.set(req.url, {
      body: await res.arrayBuffer(),
      status: res.status,
      headers: [...res.headers],
      exp: Date.now() + 600_000,
    });
  },
};

const server = http.createServer(async (req, res) => {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  headers.set("CF-Connecting-IP", req.socket.remoteAddress ?? "local");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length && req.method !== "GET" && req.method !== "HEAD" ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://localhost:8787${req.url}`, { method: req.method, headers, body });
  const r = await handle(request, env, undefined, { cache });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
});
const port = Number(process.env.PORT ?? 8787);
server.listen(port, () => console.log(`armory proxy dev server on http://localhost:${port}`));

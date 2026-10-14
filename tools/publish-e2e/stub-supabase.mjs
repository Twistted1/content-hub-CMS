/**
 * Minimal PostgREST stand-in for exercising the real `publish-due-posts` edge
 * function without touching a live Supabase project.
 *
 * It implements only the surface that function actually calls, and it records
 * every request plus the final row state so a run can be asserted rather than
 * eyeballed:
 *
 *   POST  /rest/v1/rpc/claim_due_posts      -> claim scheduled posts
 *   POST  /rest/v1/rpc/get_cron_secret      -> the Vault secret
 *   GET   /rest/v1/post_platforms           -> rows for a post
 *   GET   /rest/v1/webhook_configs          -> a user's active webhooks
 *   PATCH /rest/v1/post_platforms           -> delivery bookkeeping
 *   PATCH /rest/v1/posts                    -> post-level bookkeeping
 *   GET   /__state                          -> { calls, posts, postPlatforms }
 *
 * Anything else is answered 404 and recorded, so an unimplemented call shows up
 * as a visible failure instead of silent success.
 */
import { createServer } from "node:http";

/** Filter rows by PostgREST-style query params (`col=eq.value`). */
function applyFilters(rows, url) {
  let out = rows;
  for (const [key, raw] of url.searchParams) {
    if (key === "select" || key === "order" || key === "limit") continue;
    const [op, ...rest] = raw.split(".");
    const value = rest.join(".");
    if (op === "eq") {
      out = out.filter((r) => String(r[key]) === value);
    } else if (op === "is") {
      out = out.filter((r) =>
        value === "null" ? r[key] === null : String(r[key]) === value,
      );
    } else if (op === "gte") {
      out = out.filter((r) => r[key] >= value);
    } else if (op === "lt") {
      out = out.filter((r) => r[key] < value);
    }
  }
  return out;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (chunks.length === 0) return null;
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * @param {object} scenario
 * @param {Array} scenario.posts           rows `claim_due_posts` may return
 * @param {Array} scenario.postPlatforms   rows keyed by post_id
 * @param {Array} scenario.webhooks        rows in `webhook_configs`
 * @param {string} scenario.cronSecret     value `get_cron_secret` returns
 */
export function createStubSupabase(scenario = {}) {
  const calls = [];
  const state = {
    posts: (scenario.posts ?? []).map((p) => ({ ...p })),
    postPlatforms: (scenario.postPlatforms ?? []).map((p) => ({ ...p })),
    webhooks: (scenario.webhooks ?? []).map((w) => ({ ...w })),
  };
  // Which posts the next claim returns. Mirrors `claim_due_posts` returning
  // only rows still inside the retry window.
  const claimable = () =>
    state.posts.filter((p) => p.status === "scheduled" && p.claimable !== false);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const body = await readBody(req);
    calls.push({ method: req.method, path: url.pathname, query: url.search, body });

    if (url.pathname === "/__state") {
      return json(res, 200, { calls, ...state });
    }

    if (url.pathname === "/rest/v1/rpc/claim_due_posts") {
      const claimed = claimable();
      // The real RPC stamps the attempt; the function reads it back to decide
      // whether retries are exhausted.
      for (const p of claimed) {
        p.publish_attempts = (p.publish_attempts ?? 0) + 1;
        p.publish_attempted_at = new Date().toISOString();
      }
      return json(res, 200, claimed);
    }

    if (url.pathname === "/rest/v1/rpc/get_cron_secret") {
      return json(res, 200, scenario.cronSecret ?? "stub-cron-secret");
    }

    if (url.pathname === "/rest/v1/post_platforms" && req.method === "GET") {
      return json(res, 200, applyFilters(state.postPlatforms, url));
    }

    if (url.pathname === "/rest/v1/webhook_configs" && req.method === "GET") {
      return json(res, 200, applyFilters(state.webhooks, url));
    }

    if (url.pathname === "/rest/v1/post_platforms" && req.method === "PATCH") {
      const targets = applyFilters(state.postPlatforms, url);
      for (const t of targets) Object.assign(t, body);
      return json(res, 200, targets);
    }

    if (url.pathname === "/rest/v1/posts" && req.method === "PATCH") {
      const targets = applyFilters(state.posts, url);
      for (const t of targets) Object.assign(t, body);
      return json(res, 200, targets);
    }

    return json(res, 404, { error: `stub: unhandled ${req.method} ${url.pathname}` });
  });

  return {
    state,
    calls,
    /** Swap the fixture between scenarios, keeping one server + one Deno process. */
    reset(next) {
      state.posts = next.posts.map((p) => ({ ...p }));
      state.postPlatforms = next.postPlatforms.map((p) => ({ ...p }));
      state.webhooks = next.webhooks.map((w) => ({ ...w }));
      calls.length = 0;
    },
    listen(port) {
      return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(port)));
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

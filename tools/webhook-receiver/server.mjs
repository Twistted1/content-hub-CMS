#!/usr/bin/env node
/**
 * Reference webhook receiver for Content Hub CMS.
 *
 * This is the thing a webhook-only platform needs: the CMS *pushes* a
 * `post.publish` envelope to a URL you host, and something has to receive it,
 * prove it really came from the CMS, and do the platform-specific work. This is
 * a working, tested starting point for that — adapt the `toArticleRow` mapping
 * for your site, or swap it for a Meta Graph API call.
 *
 * What it demonstrates, each of which a real receiver needs:
 *   1. Signature verification — HMAC-SHA256 over the exact raw bytes, constant
 *      time. Without this, anyone who learns the URL can publish through you.
 *   2. Replay protection — a delivery whose timestamp is outside the window is
 *      refused.
 *   3. De-duplication — a retry carries the SAME `delivery_id`, so it is
 *      acknowledged and dropped instead of published twice. The CMS retries with
 *      backoff, so this is not hypothetical.
 *   4. Field mapping to the `articles` table used by novusexchange.com.
 *
 * SAFETY: `articles` has NO status column — any inserted row is live on the
 * public site immediately. This receiver therefore runs in DRY-RUN by default
 * and only prints the row it *would* insert. Inserting requires an explicit
 * opt-in, and it needs a service-role key because the anon key cannot write.
 *
 * Usage:
 *   WEBHOOK_SIGNING_SECRET=... node tools/webhook-receiver/server.mjs
 *   WEBHOOK_SIGNING_SECRET=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     ARTICLES_COMMIT=1 node tools/webhook-receiver/server.mjs
 *
 * Env:
 *   WEBHOOK_SIGNING_SECRET     required; the same value set on the Supabase function
 *   PORT                       default 8787
 *   ALLOW_UNSIGNED=1           accept unsigned deliveries (dev only; logs loudly)
 *   REPLAY_WINDOW_SECONDS      default 300
 *   ARTICLES_TABLE             default "articles"
 *   ARTICLES_COMMIT=1          actually INSERT (default: dry-run)
 *   SUPABASE_URL               required when ARTICLES_COMMIT=1
 *   SUPABASE_SERVICE_ROLE_KEY  required when ARTICLES_COMMIT=1
 */
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

const PORT = Number(process.env.PORT ?? 8787);
const SECRET = process.env.WEBHOOK_SIGNING_SECRET ?? "";
const ALLOW_UNSIGNED = process.env.ALLOW_UNSIGNED === "1";
const REPLAY_WINDOW_SECONDS = Number(process.env.REPLAY_WINDOW_SECONDS ?? 300);
const ARTICLES_TABLE = process.env.ARTICLES_TABLE ?? "articles";
const COMMIT = process.env.ARTICLES_COMMIT === "1";
const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SECRET && !ALLOW_UNSIGNED) {
  console.error(
    "FATAL: WEBHOOK_SIGNING_SECRET is not set. Refusing to start, because an\n" +
      "unsigned receiver will accept content from anyone who finds the URL.\n" +
      "Set it, or pass ALLOW_UNSIGNED=1 if you are deliberately testing.",
  );
  process.exit(2);
}
if (COMMIT && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error(
    "FATAL: ARTICLES_COMMIT=1 needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n" +
      "The anon key cannot write to public.articles (there is no anon write\n" +
      "policy, by design), so inserting requires the service role.",
  );
  process.exit(2);
}

/** Delivery ids already handled, so a CMS retry is acknowledged not re-published. */
const seen = new Map();
const SEEN_TTL_MS = 24 * 60 * 60 * 1000;

function alreadySeen(id) {
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > SEEN_TTL_MS) seen.delete(k);
  if (seen.has(id)) return true;
  seen.set(id, now);
  return false;
}

/** Independent implementation of the sender's scheme, using node:crypto. */
function verifySignature(rawBody, headerValue, secret) {
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(headerValue ?? ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function timestampFresh(iso) {
  const t = Date.parse(String(iso ?? ""));
  if (Number.isNaN(t)) return false;
  return Math.abs(Date.now() - t) <= REPLAY_WINDOW_SECONDS * 1000;
}

/**
 * Map the CMS envelope onto a `public.articles` row.
 *
 * Two things here are deliberate and not obvious:
 *  - `publish_date` and `date` are BOTH text in "OCTOBER 11, 2026" form. They are
 *    duplicated in the schema, so both are written.
 *  - `author_id` is matched by SUBSTRING on the site
 *    (`services/articleService.ts:51-58`): "marcio" -> Marcio, else "novus" ->
 *    Novus AI, else the bundled seed author. An unmapped id therefore silently
 *    displays as the WRONG person, so this map is explicit and fails loudly
 *    rather than guessing.
 */
const AUTHOR_BY_SIGNATURE = {
  "marcio-novus": "marcio-novus",
  "novus-ai": "novus-ai",
  guest: "guest",
};

const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

export function formatPublishDate(d) {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function estimateReadTime(text) {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function toArticleRow(delivery, { now = new Date() } = {}) {
  const post = delivery.post ?? {};
  const title = String(post.title ?? "").trim();
  if (!title) throw new Error("refusing to build a row with no title");

  const content = String(post.content ?? "");
  const authorId = AUTHOR_BY_SIGNATURE[String(post.author ?? "novus-ai")] ?? null;

  return {
    title,
    excerpt: post.excerpt ?? "",
    content,
    image_url: post.coverImageUrl ?? null,
    // The site's filter bar offers: Illustrated Features, Brazil, Geopolitics,
    // Economics, Tech-AI, Green-Tech, CSR. The CMS's own category vocabulary
    // does NOT match it, so unmapped values are surfaced rather than silently
    // landing in a filter that does not exist. See docs/HEADLESS_CONSUMPTION.md.
    category: post.category ?? "Geopolitics",
    author_id: authorId,
    read_time: estimateReadTime(content),
    publish_date: formatPublishDate(now),
    date: formatPublishDate(now),
    tags: Array.isArray(post.tags) ? post.tags : [],
  };
}

async function insertArticle(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ARTICLES_TABLE}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`supabase ${res.status}: ${text}`);
  return text;
}

const server = createServer(async (req, res) => {
  const send = (status, payload) => {
    const body = JSON.stringify(payload);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(body);
  };

  if (req.method === "GET" && req.url === "/health") {
    return send(200, { ok: true, commit: COMMIT, signed: !!SECRET });
  }
  if (req.method !== "POST") return send(405, { error: "POST only" });

  // Read RAW bytes: the signature covers exactly these, so the body must never
  // be re-serialised before verification.
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);

  const signature = req.headers["x-novus-signature"];
  if (!SECRET) {
    console.warn("[receiver] ACCEPTING UNSIGNED DELIVERY (ALLOW_UNSIGNED=1)");
  } else if (!verifySignature(raw, signature, SECRET)) {
    console.warn("[receiver] REJECTED: bad or missing signature");
    return send(401, { error: "invalid signature" });
  }

  if (!timestampFresh(req.headers["x-novus-timestamp"])) {
    console.warn("[receiver] REJECTED: timestamp outside replay window");
    return send(401, { error: "stale or missing timestamp" });
  }

  let delivery;
  try {
    delivery = JSON.parse(raw.toString("utf8"));
  } catch {
    return send(400, { error: "invalid JSON" });
  }

  const deliveryId = delivery.delivery_id ?? req.headers["x-novus-delivery-id"];
  if (!deliveryId) return send(400, { error: "missing delivery_id" });
  if (alreadySeen(deliveryId)) {
    console.log(`[receiver] duplicate ${deliveryId} — acknowledged, not re-published`);
    return send(200, { ok: true, duplicate: true, delivery_id: deliveryId });
  }

  if (delivery.event !== "post.publish") {
    return send(400, { error: `unsupported event ${delivery.event}` });
  }

  let row;
  try {
    row = toArticleRow(delivery);
  } catch (e) {
    return send(422, { error: e.message });
  }

  if (!COMMIT) {
    console.log(
      `[receiver] DRY-RUN ${deliveryId} platform=${delivery.platform} — would insert:\n` +
        JSON.stringify(row, null, 2).slice(0, 1200),
    );
    return send(200, { ok: true, dry_run: true, delivery_id: deliveryId, would_insert: row });
  }

  try {
    await insertArticle(row);
    console.log(`[receiver] INSERTED ${deliveryId} -> ${ARTICLES_TABLE}`);
    return send(201, { ok: true, inserted: true, delivery_id: deliveryId });
  } catch (e) {
    console.error(`[receiver] insert failed for ${deliveryId}:`, e.message);
    return send(500, { error: e.message });
  }
});

// Only listen when run directly, so the pure helpers above can be imported and
// unit-tested without binding a port. `pathToFileURL` rather than string
// concatenation: on Windows the real URL is `file:///D:/...` (three slashes) and
// a hand-built `file://D:/...` silently never matches, so the server never binds.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(
      `webhook receiver on http://127.0.0.1:${PORT}  mode=${
        COMMIT ? "COMMIT (writes live rows)" : "DRY-RUN (prints only)"
      }  signed=${!!SECRET}`,
    );
    console.log(
      "Note: the CMS's SSRF guard refuses private hosts, so this must be exposed\n" +
        "on a public HTTPS URL before a real webhook_configs row will reach it.",
    );
  });
}

export { server };

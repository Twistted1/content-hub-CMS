#!/usr/bin/env node
/**
 * Self-test for the reference receiver.
 *
 * Starts the real `server.mjs` on an ephemeral port and drives it over HTTP, so
 * the signature check, the replay window, the de-duplication and the dry-run
 * mapping are all exercised as a running process rather than as imported
 * functions. Asserts the cases that matter:
 *
 *   - a correctly signed delivery is accepted
 *   - a tampered body is REJECTED (the whole point of signing)
 *   - a missing signature is rejected
 *   - a signature made with the wrong secret is rejected
 *   - a stale timestamp is rejected (replay protection)
 *   - a repeated delivery_id is acknowledged as a duplicate, keyed on the CMS's
 *     stable `delivery_id`, so a retry cannot double-publish
 *   - the articles mapping produces the fields the site actually reads
 *
 * Usage: node tools/webhook-receiver/selftest.mjs
 */
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(HERE, "server.mjs");
const SECRET = "selftest-signing-secret";
const PORT = 8791;

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok: !!ok, detail });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}${ok || !detail ? "" : `\n         -> ${detail}`}`);
}

const sign = (body, secret = SECRET) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

const delivery = (overrides = {}) => ({
  event: "post.publish",
  delivery_id: "post-1:website",
  platform: "website",
  post: {
    id: "post-1",
    title: "Signed delivery",
    content: "Body text ".repeat(50),
    excerpt: "An excerpt",
    tags: ["a"],
    type: "article",
    coverImageUrl: "https://example.com/c.png",
    scheduledAt: null,
  },
  timestamp: new Date().toISOString(),
  ...overrides,
});

async function post(bodyString, headers) {
  const res = await fetch(`http://127.0.0.1:${PORT}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: bodyString,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* leave null */
  }
  return { status: res.status, json };
}

async function main() {
  console.log("=== webhook receiver self-test ===");
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, WEBHOOK_SIGNING_SECRET: SECRET, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (b) => {
    out += b.toString();
  });
  child.stderr.on("data", (b) => {
    out += b.toString();
  });

  try {
    // Wait for the listener.
    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      try {
        up = (await fetch(`http://127.0.0.1:${PORT}/health`)).ok;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!up) {
      console.error("FATAL: receiver never started\n" + out);
      process.exitCode = 1;
      return;
    }

    const body = JSON.stringify(delivery());
    const ts = new Date().toISOString();

    let r = await post(body, { "X-Novus-Signature": sign(body), "X-Novus-Timestamp": ts });
    check("correctly signed delivery accepted", r.status === 200 && r.json?.dry_run === true, JSON.stringify(r.json));

    check(
      "mapping produces the fields the site reads",
      r.json?.would_insert?.title === "Signed delivery" &&
        typeof r.json.would_insert.read_time === "number" &&
        typeof r.json.would_insert.publish_date === "string" &&
        typeof r.json.would_insert.date === "string" &&
        r.json.would_insert.author_id === "novus-ai",
      JSON.stringify(r.json?.would_insert),
    );
    check(
      "publish_date is in the site's uppercase TEXT format",
      /^[A-Z]+ \d{1,2}, \d{4}$/.test(r.json?.would_insert?.publish_date ?? ""),
      r.json?.would_insert?.publish_date,
    );

    // The critical one: a modified body must not verify.
    const tampered = body.replace("Signed delivery", "Tampered delivery");
    r = await post(tampered, { "X-Novus-Signature": sign(body), "X-Novus-Timestamp": ts });
    check("TAMPERED body rejected with 401", r.status === 401, `status ${r.status}`);

    r = await post(body, { "X-Novus-Timestamp": ts });
    check("missing signature rejected with 401", r.status === 401, `status ${r.status}`);

    r = await post(body, { "X-Novus-Signature": sign(body, "wrong-secret"), "X-Novus-Timestamp": ts });
    check("signature from the wrong secret rejected", r.status === 401, `status ${r.status}`);

    r = await post(body, {
      "X-Novus-Signature": sign(body),
      "X-Novus-Timestamp": new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    });
    check("stale timestamp rejected (replay protection)", r.status === 401, `status ${r.status}`);

    // Same delivery_id again — a CMS retry must not publish twice.
    r = await post(body, { "X-Novus-Signature": sign(body), "X-Novus-Timestamp": ts });
    check(
      "repeated delivery_id acknowledged as duplicate, not re-published",
      r.status === 200 && r.json?.duplicate === true,
      JSON.stringify(r.json),
    );

    // A different post id is a different delivery and must go through.
    const other = JSON.stringify(delivery({ delivery_id: "post-2:website", post: { ...delivery().post, id: "post-2" } }));
    r = await post(other, { "X-Novus-Signature": sign(other), "X-Novus-Timestamp": ts });
    check("a different delivery_id is not treated as a duplicate", r.status === 200 && !r.json?.duplicate, JSON.stringify(r.json));

    const missingTitle = JSON.stringify(
      delivery({ delivery_id: "post-3:website", post: { ...delivery().post, title: "" } }),
    );
    r = await post(missingTitle, { "X-Novus-Signature": sign(missingTitle), "X-Novus-Timestamp": ts });
    check("a title-less delivery is refused rather than published blank", r.status === 422, `status ${r.status}`);
  } finally {
    child.kill();
  }

  const failed = results.filter((x) => !x.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error("self-test error:", e);
  process.exitCode = 1;
});

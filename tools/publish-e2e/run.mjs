/**
 * End-to-end proof of the webhook publishing path.
 *
 * It runs the **real, unmodified** `supabase/functions/publish-due-posts/index.ts`
 * (via Deno, the same runtime Supabase uses) against a local PostgREST stub, and
 * points its webhook delivery at a receiver over the public internet. Nothing in
 * the delivery path is reimplemented here — the function's own claim loop, its
 * own SSRF guard, its own payload builder, its own timeout and its own
 * bookkeeping writes are what get exercised. Only the database is faked.
 *
 * Usage:
 *   node tools/publish-e2e/run.mjs --receiver https://webhook.site/<uuid>
 *
 * `--receiver` must be an https URL that the harness can also read back from.
 * For webhook.site the read-back is the public token API, so no credential is
 * needed. Exits non-zero if any assertion fails.
 */
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createStubSupabase } from "./stub-supabase.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const EDGE_FUNCTION = resolve(REPO, "supabase/functions/publish-due-posts/index.ts");

// Set on the function's env so outbound deliveries are actually signed, and kept
// here so the harness can recompute the expected digest independently.
const SIGNING_SECRET = "e2e-webhook-signing-secret";

const DENO = process.env.DENO_BIN ?? "deno";
const STUB_PORT = Number(process.env.STUB_PORT ?? 54321);
// std@0.168.0's `serve` ignores the PORT env var and binds 8000, so this is a
// fixed default rather than something the harness can steer. Overridable only
// for the case where 8000 is genuinely occupied on the machine running it.
const EDGE_PORT = Number(process.env.EDGE_PORT ?? 8000);
const SERVICE_KEY = "stub-service-role-key";
const CRON_SECRET = "stub-cron-secret";
const USER_ID = "00000000-0000-4000-8000-000000000001";

const args = process.argv.slice(2);
const receiverIdx = args.indexOf("--receiver");
const RECEIVER = receiverIdx === -1 ? process.env.RECEIVER_URL : args[receiverIdx + 1];

if (!RECEIVER) {
  console.error("FATAL: pass --receiver https://your-receiver.example/hook");
  process.exit(2);
}

/* ── receiver read-back ─────────────────────────────────────────────── */

function receiverToken(url) {
  const m = String(url).match(/webhook\.site\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

async function receiverRequests(url) {
  const token = receiverToken(url);
  if (!token) return null; // unknown receiver: cannot read back, caller decides
  const resp = await fetch(`https://webhook.site/token/${token}/requests?sorting=newest`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`receiver read-back failed: HTTP ${resp.status}`);
  const data = await resp.json();
  return data.data ?? [];
}

/* ── assertions ─────────────────────────────────────────────────────── */

const results = [];
function check(scenario, label, condition, detail) {
  results.push({ scenario, label, ok: !!condition, detail });
  const mark = condition ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${label}${condition || !detail ? "" : `\n         -> ${detail}`}`);
}

/* ── harness ────────────────────────────────────────────────────────── */

async function waitForEdge() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${EDGE_PORT}/`, {
        method: "OPTIONS",
      });
      if (r.status === 200 || r.status === 401 || r.status === 204) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

function invoke(headers) {
  return fetch(`http://127.0.0.1:${EDGE_PORT}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function main() {
  console.log("=== publish-due-posts end-to-end harness ===");
  console.log(`edge function : ${EDGE_FUNCTION}`);
  console.log(`receiver      : ${RECEIVER}`);
  console.log(`db            : local PostgREST stub on 127.0.0.1:${STUB_PORT}\n`);

  const stub = createStubSupabase({ cronSecret: CRON_SECRET });
  await stub.listen(STUB_PORT);

  const before = await receiverRequests(RECEIVER);
  if (before) console.log(`receiver starts with ${before.length} request(s)\n`);

  const child = spawn(
    DENO,
    [
      "run",
      "--quiet",
      "--allow-net",
      "--allow-env",
      "--allow-read",
      "--no-check",
      EDGE_FUNCTION,
    ],
    {
      cwd: REPO,
      env: {
        ...process.env,
        SUPABASE_URL: `http://127.0.0.1:${STUB_PORT}`,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        SUPABASE_ANON_KEY: "stub-anon-key",
        WEBHOOK_SIGNING_SECRET: SIGNING_SECRET,
        TWITTER_CLIENT_ID: "stub",
        TWITTER_CLIENT_SECRET: "stub",
      },
    },
  );
  let denoStderr = "";
  child.stderr.on("data", (b) => {
    denoStderr += b.toString();
  });
  child.stdout.on("data", (b) => {
    denoStderr += b.toString();
  });

  let ok = true;
  try {
    if (!(await waitForEdge())) {
      console.error("FATAL: edge function never became reachable.\n" + denoStderr);
      process.exitCode = 1;
      return;
    }
    console.log("edge function is up\n");

    /* ── Scenario 1: a webhook-only platform actually delivers ───────── */
    console.log("Scenario 1 — website (webhook-only) delivers end to end");
    const postId1 = "post-website-1";
    stub.reset({
      posts: [
        {
          id: postId1,
          user_id: USER_ID,
          title: "Go-live proof",
          content: "Delivered through the real publish-due-posts path.",
          cover_image_url: null,
          status: "scheduled",
          publish_attempts: 0,
        },
      ],
      postPlatforms: [
        { id: "pp-website-1", post_id: postId1, platform: "website", status: "scheduled" },
      ],
      webhooks: [
        {
          id: "wh-1",
          user_id: USER_ID,
          name: "go-live-proof",
          url: RECEIVER,
          platforms: ["website"],
          headers: { "X-Harness": "publish-e2e" },
          is_active: true,
        },
      ],
    });

    const r1 = await invoke({ Authorization: `Bearer ${SERVICE_KEY}` });
    const b1 = await r1.json();
    check("1", "function returns HTTP 200", r1.status === 200, `status ${r1.status} body ${JSON.stringify(b1)}`);
    check("1", "one post was claimed and processed", b1.published === 1, JSON.stringify(b1));
    check(
      "1",
      "website reported success via webhook",
      b1.results?.[0]?.perPlatform?.[0]?.success === true &&
        b1.results[0].perPlatform[0].via === "webhook",
      JSON.stringify(b1.results?.[0]?.perPlatform),
    );
    check(
      "1",
      "post_platforms row marked published",
      stub.state.postPlatforms[0].status === "published",
      `status=${stub.state.postPlatforms[0].status}`,
    );
    check(
      "1",
      "posts row marked published with retry bookkeeping cleared",
      stub.state.posts[0].status === "published" &&
        stub.state.posts[0].publish_attempts === 0 &&
        stub.state.posts[0].publish_error === null,
      JSON.stringify(stub.state.posts[0]),
    );

    if (before) {
      // Give the receiver a moment to register the delivery.
      let after = [];
      for (let i = 0; i < 20; i++) {
        await sleep(1000);
        after = await receiverRequests(RECEIVER);
        if (after.length > before.length) break;
      }
      const newOnes = after.slice(0, after.length - before.length);
      check(
        "1",
        "receiver actually received the delivery",
        newOnes.length >= 1,
        `receiver went from ${before.length} to ${after.length} request(s)`,
      );
      const got = newOnes[newOnes.length - 1];
      let payload = null;
      try {
        payload = JSON.parse(got?.content ?? "{}");
      } catch {
        /* leave null */
      }
      check(
        "1",
        "receiver got the documented post.publish envelope",
        payload?.event === "post.publish" &&
          payload?.platform === "website" &&
          payload?.post?.id === postId1 &&
          typeof payload?.post?.content === "string" &&
          typeof payload?.timestamp === "string",
        JSON.stringify(payload),
      );
      // The unified contract. Both delivery paths must send these, because a
      // real receiver (a Meta/website receiver) has to be able to rely on them:
      // `delivery_id` to de-duplicate retries, and `type` because Instagram
      // cannot publish text-only and needs to know a feed post from a Reel.
      check(
        "1",
        "envelope carries a stable delivery_id for de-duplication",
        payload?.delivery_id === `${postId1}:website`,
        String(payload?.delivery_id),
      );
      check(
        "1",
        "envelope carries content type, tags, excerpt and scheduledAt",
        typeof payload?.post?.type === "string" &&
          payload.post.type.length > 0 &&
          Array.isArray(payload?.post?.tags) &&
          payload?.post != null &&
          "excerpt" in payload.post &&
          "scheduledAt" in payload.post,
        JSON.stringify({ type: payload?.post?.type, tags: payload?.post?.tags }),
      );
      check(
        "1",
        "envelope has a top-level platform, not a nested platforms array",
        typeof payload?.platform === "string" && !("platforms" in (payload ?? {})),
        JSON.stringify({ platform: payload?.platform, platforms: payload?.platforms }),
      );
      // Signing, verified the way a receiver must: recompute the digest over the
      // exact bytes received and compare. A receiver that cannot do this has to
      // trust anything that reaches its URL.
      const sentSignature = String(got?.headers?.["x-novus-signature"] ?? "");
      const expectedSignature = `sha256=${createHmac("sha256", SIGNING_SECRET)
        .update(got?.content ?? "")
        .digest("hex")}`;
      check(
        "1",
        "delivery carries a valid HMAC signature over the raw body",
        sentSignature.length > 0 && sentSignature === expectedSignature,
        `sent=${sentSignature.slice(0, 20)}… expected=${expectedSignature.slice(0, 20)}…`,
      );
      check(
        "1",
        "delivery identifies itself for de-duplication via header too",
        String(got?.headers?.["x-novus-delivery-id"] ?? "") === `${postId1}:website`,
        String(got?.headers?.["x-novus-delivery-id"]),
      );
      check(
        "1",
        "delivery carries a parseable timestamp for replay protection",
        !Number.isNaN(Date.parse(String(got?.headers?.["x-novus-timestamp"] ?? ""))),
        String(got?.headers?.["x-novus-timestamp"]),
      );
      check(
        "1",
        "configured custom header was forwarded",
        String(got?.headers?.["x-harness"] ?? "") === "publish-e2e",
        JSON.stringify(got?.headers),
      );
    } else {
      console.log("  [SKIP] receiver read-back unavailable for this URL");
    }

    /* ── Scenario 2: the silent-failure mode named in the brief ──────── */
    console.log("\nScenario 2 — no active webhook row: must fail loudly, not silently");
    const postId2 = "post-ig-1";
    stub.reset({
      posts: [
        {
          id: postId2,
          user_id: USER_ID,
          title: "Undeliverable",
          content: "No webhook is configured for instagram.",
          cover_image_url: null,
          status: "scheduled",
          publish_attempts: 2,
        },
      ],
      postPlatforms: [{ id: "pp-ig-1", post_id: postId2, platform: "instagram", status: "scheduled" }],
      webhooks: [],
    });

    const r2 = await invoke({ Authorization: `Bearer ${SERVICE_KEY}` });
    const b2 = await r2.json();
    const err2 = b2.results?.[0]?.perPlatform?.[0]?.error ?? "";
    check("2", "function still returns HTTP 200 (per-post failure, not a crash)", r2.status === 200);
    check(
      "2",
      'platform failure names the platform: "No active webhook configured for instagram"',
      err2 === "No active webhook configured for instagram",
      err2,
    );
    check(
      "2",
      "post stays queued for retry rather than being dropped",
      stub.state.posts[0].status === "scheduled",
      `status=${stub.state.posts[0].status}`,
    );
    check(
      "2",
      "attempt count surfaced in publish_error",
      String(stub.state.posts[0].publish_error ?? "").includes("attempt 3/5"),
      String(stub.state.posts[0].publish_error),
    );
    check(
      "2",
      "post_platforms row marked failed",
      stub.state.postPlatforms[0].status === "failed",
      `status=${stub.state.postPlatforms[0].status}`,
    );

    /* ── Scenario 3: exhausted retries park the post ─────────────────── */
    console.log("\nScenario 3 — retries exhausted parks the post as failed");
    const postId3 = "post-ig-2";
    stub.reset({
      posts: [
        {
          id: postId3,
          user_id: USER_ID,
          title: "Exhausted",
          content: "Five attempts.",
          cover_image_url: null,
          status: "scheduled",
          publish_attempts: 4,
        },
      ],
      postPlatforms: [{ id: "pp-ig-2", post_id: postId3, platform: "instagram", status: "scheduled" }],
      webhooks: [],
    });
    await invoke({ Authorization: `Bearer ${SERVICE_KEY}` });
    check(
      "3",
      "post parked as failed at the attempt cap",
      stub.state.posts[0].status === "failed",
      `status=${stub.state.posts[0].status} error=${stub.state.posts[0].publish_error}`,
    );

    /* ── Scenario 4: SSRF guard is applied on the delivery path ──────── */
    console.log("\nScenario 4 — SSRF guard rejects a non-public webhook target");
    const postId4 = "post-ssrf-1";
    stub.reset({
      posts: [
        {
          id: postId4,
          user_id: USER_ID,
          title: "SSRF",
          content: "Should never be delivered.",
          cover_image_url: null,
          status: "scheduled",
          publish_attempts: 0,
        },
      ],
      postPlatforms: [{ id: "pp-ssrf-1", post_id: postId4, platform: "facebook", status: "scheduled" }],
      webhooks: [
        {
          id: "wh-evil",
          user_id: USER_ID,
          name: "internal",
          url: "https://127.0.0.1/hook",
          platforms: ["facebook"],
          headers: {},
          is_active: true,
        },
      ],
    });
    const b4 = await (await invoke({ Authorization: `Bearer ${SERVICE_KEY}` })).json();
    const err4 = b4.results?.[0]?.perPlatform?.[0]?.error ?? "";
    check(
      "4",
      "loopback webhook is filtered out, not dialled",
      err4 === "No active webhook configured for facebook",
      err4,
    );

    /* ── Scenario 5: cron-secret auth path ──────────────────────────── */
    console.log("\nScenario 5 — cron auth via x-cron-secret (the path pg_cron uses)");
    stub.reset({ posts: [], postPlatforms: [], webhooks: [] });
    const r5 = await invoke({ "x-cron-secret": CRON_SECRET });
    check("5", "valid cron secret is accepted", r5.status === 200, `status ${r5.status}`);
    const usedGetCronSecret = stub.calls.some((c) =>
      c.path.endsWith("/rpc/get_cron_secret"),
    );
    check("5", "secret was read from the database, not compared to a literal", usedGetCronSecret);

    stub.reset({ posts: [], postPlatforms: [], webhooks: [] });
    const r6 = await invoke({ "x-cron-secret": "wrong-secret" });
    check("5", "wrong cron secret is rejected", r6.status === 401, `status ${r6.status}`);

    /* ── Scenario 6: unauthenticated is refused ─────────────────────── */
    console.log("\nScenario 6 — unauthenticated call is refused");
    stub.reset({ posts: [], postPlatforms: [], webhooks: [] });
    const r7 = await invoke({});
    check("6", "no credentials -> 401", r7.status === 401, `status ${r7.status}`);
    const claimed = stub.calls.some((c) => c.path.endsWith("/rpc/claim_due_posts"));
    check("6", "no claim was attempted before the auth check", !claimed);

    ok = results.every((r) => r.ok);
  } finally {
    child.kill();
    await stub.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  if (denoStderr.trim()) {
    console.log("\n--- edge function stderr ---\n" + denoStderr.trim());
  }
  if (!ok) {
    console.log("\nFAILED CHECKS:");
    for (const f of failed) console.log(`  ${f.scenario}: ${f.label} -> ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("harness error:", e);
  process.exitCode = 1;
});

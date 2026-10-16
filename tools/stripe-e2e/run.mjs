/**
 * Objective 3: verify one real, non-test transaction through the app's OWN
 * checkout path — i.e. the browser calls `create-checkout`, Stripe hosts the
 * payment, Stripe calls `stripe-webhook`, and the webhook writes the row.
 *
 * Why this shape:
 *  - `check-subscription` (and therefore the Billing page) reads its answer from
 *    **Stripe**, not from our database. A "pro" reply from it proves the Stripe
 *    subscription exists; it does NOT prove the webhook wrote anything. So this
 *    script's pass condition is the `subscriptions` row itself, read back through
 *    the user's own session (RLS: `Users can view their own subscription`).
 *  - That makes the assertion "the webhook's write landed", which is the part
 *    that has silently broken before in this project.
 *
 * Credentials come from the environment, never from a file in the repo:
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, VERIFY_EMAIL, VERIFY_PASSWORD
 *
 * Usage:
 *   node tools/stripe-e2e/run.mjs [--plan pro] [--billing monthly] [--headed]
 */
import { chromium } from "@playwright/test";
import { setTimeout as sleep } from "node:timers/promises";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.VERIFY_EMAIL;
const PASSWORD = process.env.VERIFY_PASSWORD;
const APP_URL = process.env.APP_URL ?? "https://content-cms-hub.vercel.app";

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : argv[i + 1];
};
const PLAN = flag("plan", "pro");
const BILLING = flag("billing", "monthly");
const HEADED = argv.includes("--headed");

for (const [k, v] of Object.entries({
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: ANON,
  VERIFY_EMAIL: EMAIL,
  VERIFY_PASSWORD: PASSWORD,
})) {
  if (!v) {
    console.error(`FATAL: ${k} is not set`);
    process.exit(2);
  }
}

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok: !!ok, detail });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}${ok || !detail ? "" : `\n         -> ${detail}`}`);
}

const api = (path, init = {}, token) =>
  fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

async function signIn() {
  const r = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`sign-in failed: HTTP ${r.status} ${JSON.stringify(j)}`);
  return { token: j.access_token, userId: j.user.id };
}

/** The row `stripe-webhook` is responsible for writing. */
async function readSubscriptionRow(token) {
  const r = await api("/rest/v1/subscriptions?select=*", {}, token);
  if (!r.ok) throw new Error(`subscriptions read failed: HTTP ${r.status} ${await r.text()}`);
  const rows = await r.json();
  return rows[0] ?? null;
}

async function callCreateCheckout(token) {
  const r = await api("/functions/v1/create-checkout", {
    method: "POST",
    body: JSON.stringify({ plan: PLAN, billing: BILLING }),
  }, token);
  const j = await r.json();
  if (!r.ok || !j.url) throw new Error(`create-checkout failed: HTTP ${r.status} ${JSON.stringify(j)}`);
  return j.url;
}

async function callCheckSubscription(token) {
  const r = await api("/functions/v1/check-subscription", { method: "POST" }, token);
  return { status: r.status, body: await r.json().catch(() => null) };
}

/** Pay the Stripe-hosted page with the canonical test card. */
async function payCheckout(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("domcontentloaded");

  // Stripe's Checkout markup is not a stable API, so fill by accessible name
  // with a few fallbacks rather than by CSS class.
  const fill = async (nameRe, value) => {
    const field = page.getByLabel(nameRe).first();
    await field.waitFor({ state: "visible", timeout: 45000 });
    await field.fill(value);
  };

  await fill(/card number/i, "4242 4242 4242 4242");
  await fill(/expir/i, "12 / 34");
  await fill(/cvc|security code/i, "123");
  const nameField = page.getByLabel(/name on card|cardholder/i).first();
  if (await nameField.count()) await nameField.fill("Go Live Verify").catch(() => {});

  // Postal/zip is required for some countries.
  for (const re of [/postal code/i, /zip/i]) {
    const f = page.getByLabel(re).first();
    if (await f.count()) {
      await f.fill("10115").catch(() => {});
      break;
    }
  }

  const submit = page
    .getByRole("button", { name: /^(subscribe|pay|start trial|continue)/i })
    .first();
  await submit.waitFor({ state: "visible", timeout: 30000 });
  await submit.click();
}

async function main() {
  console.log("=== Stripe test-mode purchase through the app's own checkout ===");
  console.log(`app        : ${APP_URL}`);
  console.log(`plan       : ${PLAN} / ${BILLING}`);
  console.log(`account    : ${EMAIL}\n`);

  const { token, userId } = await signIn();
  console.log(`signed in   : user ${userId}`);

  const before = await readSubscriptionRow(token);
  console.log(`before      : tier=${before?.tier} end_date=${before?.end_date}`);
  if (before?.tier === PLAN) {
    // Not a failure of the code and not a pass either: this account has already
    // been upgraded, so a re-run would prove nothing about the webhook. Exit 2
    // to keep "I verified it" distinguishable from "I could not verify it".
    console.log(
      `\nSKIPPED: this account is already on "${PLAN}", so a purchase would add no\n` +
        `evidence. Point VERIFY_EMAIL/VERIFY_PASSWORD at a fresh free account to re-verify.`,
    );
    process.exitCode = 2;
    return;
  }
  check("baseline subscriptions row exists and is not already paid", !!before, JSON.stringify(before));

  const checkoutUrl = await callCreateCheckout(token);
  check("create-checkout returned a Stripe Checkout URL", /^https:\/\/checkout\.stripe\.com\//.test(checkoutUrl), checkoutUrl);
  console.log(`checkout    : ${checkoutUrl.slice(0, 80)}...`);

  const browser = await chromium.launch({ headless: !HEADED });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await payCheckout(page, checkoutUrl);
    console.log("submitted payment; waiting for the redirect back into the app");

    let landed = false;
    try {
      await page.waitForURL(new RegExp(APP_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), { timeout: 90000 });
      landed = true;
    } catch {
      landed = false;
    }
    check("Stripe redirected back into the app after payment", landed, page.url());
  } finally {
    await browser.close();
  }

  // The webhook is asynchronous: poll for the row it writes.
  let after = before;
  let waited = 0;
  for (; waited < 120; waited += 5) {
    after = await readSubscriptionRow(token);
    if (after?.tier === PLAN) break;
    await sleep(5000);
  }

  check(
    `stripe-webhook wrote tier="${PLAN}" to the subscriptions table`,
    after?.tier === PLAN,
    `after ${waited}s: ${JSON.stringify(after)}`,
  );
  check("subscription end_date was populated by the webhook", !!after?.end_date, String(after?.end_date));
  check(
    "row's updated_at moved past its created_at (a real write, not the signup default)",
    !!(after?.updated_at && after?.created_at && after.updated_at > after.created_at),
    `created=${after?.created_at} updated=${after?.updated_at}`,
  );

  const cs = await callCheckSubscription(token);
  check(
    "check-subscription reports the paid tier",
    cs.body?.tier === PLAN && cs.body?.subscribed === true,
    JSON.stringify(cs.body),
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exitCode = 1;
});

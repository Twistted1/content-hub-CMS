import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Retries transient failures (network blips, Stripe 5xx/429) up to twice with backoff.
// Does NOT retry 4xx client errors (bad request, auth) since retrying those just repeats
// the same failure.
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { statusCode?: number })?.statusCode;
      const isClientError = typeof status === "number" && status >= 400 && status < 500;
      const message = err instanceof Error ? err.message : String(err);
      logStep(`${label} failed (attempt ${i + 1}/${attempts})`, { message, status });
      if (isClientError || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 300 * Math.pow(3, i)));
    }
  }
  throw lastErr;
}

serve(async (req) => {
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!webhookSecret || !stripeKey) {
    logStep("ERROR", { message: "Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY" });
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  // Verify the webhook signature
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    logStep("ERROR", { message: "Missing stripe-signature header" });
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    logStep("Webhook verified", { type: event.type, id: event.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logStep("Webhook verification failed", { message });
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Helper: resolve the Supabase user_id for a Stripe customer. Customers created via
  // create-checkout are tagged with metadata.supabase_user_id; fall back to matching
  // auth.users by email for any customer created before that tagging existed.
  const getUserId = async (customer: Stripe.Customer): Promise<string | null> => {
    const metaId = customer.metadata?.supabase_user_id;
    if (metaId) return metaId;

    if (!customer.email) return null;
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      logStep("Fallback user lookup failed", { email: customer.email, error: error.message });
      return null;
    }
    const match = data.users.find((u) => u.email === customer.email);
    if (!match) {
      logStep("Could not find user by email", { email: customer.email });
      return null;
    }
    return match.id;
  };

  // Helper: upsert subscription record
  const upsertSubscription = async (
    userId: string,
    tier: "free" | "starter" | "pro",
    endDate: string | null
  ) => {
    const { error } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          tier,
          end_date: endDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (error) {
      logStep("Failed to upsert subscription", { userId, tier, error: error.message, code: error.code, details: error.details, hint: error.hint });
      throw new Error(`DB upsert failed: ${error.message}`);
    } else {
      logStep("Subscription synced", { userId, tier, endDate });
    }
  };

  // Price ID → tier mapping (matches check-subscription function's PRICE_TO_TIER)
  const PRICE_TO_TIER: Record<string, "starter" | "pro"> = {
    price_1TUbGi99SwZHUFarbpocgTj2: "starter",
    price_1TUbHN99SwZHUFarK9uTjwbD: "starter",
    price_1TUbI699SwZHUFar0ur6blfp: "pro",
    price_1TUbIu99SwZHUFarlyuyIqnp: "pro",
  };
  // Legacy product IDs (old $29 pro / $99 enterprise) — fold into "pro" for back-compat
  const LEGACY_PRO_PRODUCTS = new Set(["prod_Tu23n9E83kU6SH", "prod_Tu24enzVGb9KJl"]);

  const resolveTier = (subscription: Stripe.Subscription): "free" | "starter" | "pro" => {
    const item = subscription.items.data[0];
    const priceId = item?.price?.id;
    const productId = item?.price?.product as string;
    if (priceId && PRICE_TO_TIER[priceId]) return PRICE_TO_TIER[priceId];
    if (productId && LEGACY_PRO_PRODUCTS.has(productId)) return "pro";
    return "free";
  };

  // Stripe moved current_period_end/current_period_start off the top-level Subscription
  // object onto each subscription item as part of flexible billing intervals -- reading
  // the now-undefined top-level field and calling .toISOString() on the resulting
  // Invalid Date threw "Invalid time value" and crashed the handler before the DB write
  // ever ran. Check the item first, fall back to top-level for older data.
  const getPeriodEndISO = (subscription: Stripe.Subscription): string | null => {
    const itemEnd = subscription.items.data[0]?.current_period_end;
    const topLevelEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
    const periodEnd = typeof itemEnd === "number" ? itemEnd : (typeof topLevelEnd === "number" ? topLevelEnd : null);
    return periodEnd !== null ? new Date(periodEnd * 1000).toISOString() : null;
  };

  // Tracked so the response body itself shows what actually happened -- "received: true"
  // was identical whether the DB was written or silently skipped, which is exactly how a
  // real skip got mistaken for a real fix. Visible in Stripe's Workbench on any delivery,
  // no log access needed.
  let outcome: string = "unhandled_event_type";

  try {
    switch (event.type) {
      // ── Subscription activated or renewed ───────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await withRetry("customers.retrieve", () =>
          stripe.customers.retrieve(subscription.customer as string)
        ) as Stripe.Customer;
        const userId = await getUserId(customer);
        if (!userId) {
          logStep("No matching Supabase user, skipping", { customerId: customer.id, email: customer.email });
          outcome = `skipped_no_user:customer=${customer.id}:email=${customer.email ?? "none"}`;
          break;
        }

        const isActive = subscription.status === "active" || subscription.status === "trialing";
        const tier = isActive ? resolveTier(subscription) : "free";
        const endDate = isActive ? getPeriodEndISO(subscription) : null;

        await upsertSubscription(userId, tier, endDate);
        outcome = `wrote:user=${userId}:tier=${tier}`;
        break;
      }

      // ── Subscription cancelled or expired ───────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await withRetry("customers.retrieve", () =>
          stripe.customers.retrieve(subscription.customer as string)
        ) as Stripe.Customer;
        const userId = await getUserId(customer);
        if (!userId) {
          outcome = `skipped_no_user:customer=${customer.id}:email=${customer.email ?? "none"}`;
          break;
        }

        await upsertSubscription(userId, "free", null);
        outcome = `wrote:user=${userId}:tier=free`;
        break;
      }

      // ── Invoice paid (successful renewal) ─────────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceCustomer = await withRetry("customers.retrieve", () =>
          stripe.customers.retrieve(invoice.customer as string)
        ) as Stripe.Customer;
        const userId = await getUserId(invoiceCustomer);
        if (!userId) {
          logStep("No matching Supabase user, skipping", { customerId: invoiceCustomer.id, email: invoiceCustomer.email });
          outcome = `skipped_no_user:customer=${invoiceCustomer.id}:email=${invoiceCustomer.email ?? "none"}`;
          break;
        }

        // Re-check subscription to get current tier on renewal
        const subs = await withRetry("subscriptions.list", () =>
          stripe.subscriptions.list({
            customer: invoice.customer as string,
            status: "active",
            limit: 1,
          })
        );

        if (subs.data.length > 0) {
          const subscription = subs.data[0];
          const tier = resolveTier(subscription);
          const endDate = getPeriodEndISO(subscription);
          await upsertSubscription(userId, tier, endDate);
          outcome = `wrote:user=${userId}:tier=${tier}`;
        } else {
          outcome = `skipped_no_active_subscription:customer=${invoice.customer}`;
        }
        break;
      }

      // ── Payment failed ──────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", {
          customer: invoice.customer,
          email: invoice.customer_email,
          amount: invoice.amount_due,
        });
        // Don't downgrade immediately — Stripe retries. Subscription.deleted fires if all retries fail.
        outcome = "payment_failed_noted";
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
        outcome = `unhandled_event_type:${event.type}`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logStep("ERROR handling event", { type: event.type, id: event.id, message, stack });
    return new Response(`Handler error: ${message}`, { status: 500 });
  }

  logStep("Done", { outcome });
  return new Response(JSON.stringify({ received: true, outcome }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});

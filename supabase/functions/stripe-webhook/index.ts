import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

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
    logStep("Webhook verified", { type: event.type });
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

  // Helper: resolve user_id from Stripe customer email
  const getUserIdByEmail = async (email: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .single();
    if (error) {
      logStep("Could not find user by email", { email, error: error.message });
      return null;
    }
    return data?.user_id ?? null;
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
      logStep("Failed to upsert subscription", { userId, tier, error: error.message });
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

  try {
    switch (event.type) {
      // ── Subscription activated or renewed ──────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
        if (!customer.email) break;
        const userId = await getUserIdByEmail(customer.email);
        if (!userId) break;

        const isActive = subscription.status === "active" || subscription.status === "trialing";
        const tier = isActive ? resolveTier(subscription) : "free";
        const endDate = new Date(subscription.current_period_end * 1000).toISOString();

        await upsertSubscription(userId, tier, isActive ? endDate : null);
        break;
      }

      // ── Subscription cancelled or expired ──────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
        if (!customer.email) break;
        const userId = await getUserIdByEmail(customer.email);
        if (!userId) break;

        await upsertSubscription(userId, "free", null);
        break;
      }

      // ── Invoice paid (successful renewal) ─────────────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.customer_email) break;
        const userId = await getUserIdByEmail(invoice.customer_email);
        if (!userId) break;

        // Re-check subscription to get current tier on renewal
        const subs = await stripe.subscriptions.list({
          customer: invoice.customer as string,
          status: "active",
          limit: 1,
        });

        if (subs.data.length > 0) {
          const subscription = subs.data[0];
          const tier = resolveTier(subscription);
          const endDate = new Date(subscription.current_period_end * 1000).toISOString();
          await upsertSubscription(userId, tier, endDate);
        }
        break;
      }

      // ── Payment failed ─────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", {
          customer: invoice.customer,
          email: invoice.customer_email,
          amount: invoice.amount_due,
        });
        // Don't downgrade immediately — Stripe retries. Subscription.deleted fires if all retries fail.
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logStep("ERROR handling event", { type: event.type, message });
    return new Response(`Handler error: ${message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map Stripe price IDs → tier + billing interval (Starter / Pro, monthly + yearly)
const PRICE_TO_TIER: Record<string, { tier: "starter" | "pro"; interval: "monthly" | "yearly" }> = {
  price_1TUbGi99SwZHUFarbpocgTj2: { tier: "starter", interval: "monthly" },
  price_1TUbHN99SwZHUFarK9uTjwbD: { tier: "starter", interval: "yearly" },
  price_1TUbI699SwZHUFar0ur6blfp: { tier: "pro", interval: "monthly" },
  price_1TUbIu99SwZHUFarlyuyIqnp: { tier: "pro", interval: "yearly" },
};

// Legacy product IDs (old $29 pro / $99 enterprise) — fold into "pro" for back-compat
const LEGACY_PRO_PRODUCTS = new Set(["prod_Tu23n9E83kU6SH", "prod_Tu24enzVGb9KJl"]);

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Retries transient failures (network blips, Stripe 5xx/429) up to twice with backoff.
// Does NOT retry 4xx client errors since retrying those just repeats the same failure.
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified", { prefix: stripeKey.slice(0, 12) });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await withRetry("customers.list", () =>
      stripe.customers.list({ email: user.email!, limit: 1 })
    );

    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ subscribed: false, tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await withRetry("subscriptions.list", () =>
      stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      })
    );
    const hasActiveSub = subscriptions.data.length > 0;
    let tier: "free" | "starter" | "pro" = "free";
    let billingInterval: "monthly" | "yearly" | null = null;
    let subscriptionEnd: string | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });

      const item = subscription.items.data[0];
      const priceId = item.price.id;
      const productId = item.price.product as string;
      const mapped = PRICE_TO_TIER[priceId];
      if (mapped) {
        tier = mapped.tier;
        billingInterval = mapped.interval;
      } else if (LEGACY_PRO_PRODUCTS.has(productId)) {
        tier = "pro";
        billingInterval = item.price.recurring?.interval === "year" ? "yearly" : "monthly";
      }
      logStep("Determined subscription tier", { tier, billingInterval, priceId, productId });
    } else {
      logStep("No active subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier,
      billing_interval: billingInterval,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const stripeType = (error as { type?: string })?.type;
    const stripeCode = (error as { code?: string })?.code;
    const stripeStatus = (error as { statusCode?: number })?.statusCode;
    logStep("ERROR", { message: errorMessage, stack, stripeType, stripeCode, stripeStatus });
    return new Response(JSON.stringify({ error: errorMessage, stripeType, stripeCode, stripeStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

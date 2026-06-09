import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Price IDs for subscription plans (Starter $10, Pro $20; yearly ~20% off)
const PRICE_IDS: Record<string, Record<string, string>> = {
  starter: {
    monthly: "price_1TUbGi99SwZHUFarbpocgTj2",
    yearly: "price_1TUbHN99SwZHUFarK9uTjwbD",
  },
  pro: {
    monthly: "price_1TUbI699SwZHUFar0ur6blfp",
    yearly: "price_1TUbIu99SwZHUFarlyuyIqnp",
  },
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body for plan + billing interval
    const { plan, billing = "monthly" } = await req.json();
    const planPrices = PRICE_IDS[plan as string];
    if (!planPrices) throw new Error(`Invalid plan: ${plan}`);
    const priceId = planPrices[billing as string];
    if (!priceId) throw new Error(`Invalid billing interval: ${billing}`);
    logStep("Plan selected", { plan, billing, priceId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Build redirect URLs from a server-controlled allowlist to prevent open-redirect attacks
    // via a caller-controlled Origin header.
    const ALLOWED_ORIGINS = new Set<string>(
      [
        Deno.env.get("SITE_URL"),
        "https://id-preview--31c64459-d7d6-45e8-9eeb-bedede902146.lovable.app",
      ].filter((v): v is string => !!v),
    );
    const requestOrigin = req.headers.get("origin") ?? "";
    const origin = ALLOWED_ORIGINS.has(requestOrigin)
      ? requestOrigin
      : (Deno.env.get("SITE_URL") || "https://id-preview--31c64459-d7d6-45e8-9eeb-bedede902146.lovable.app");

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
    });
    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

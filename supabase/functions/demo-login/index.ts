import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_EMAIL = "test@contenthub.io";
const DEMO_PASSWORD = "TestDemo123!";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Demo login is not configured");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const auth = createClient(supabaseUrl, anonKey);

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Content Hub Demo" },
    });

    const userAlreadyExists = createError?.message.toLowerCase().includes("already");
    if (createError && !userAlreadyExists) {
      throw createError;
    }

    let demoUserId = createdUser.user?.id;
    if (userAlreadyExists) {
      const { data: users, error: listError } = await admin.auth.admin.listUsers();
      if (listError) throw listError;

      const demoUser = users.users.find((user) => user.email?.toLowerCase() === DEMO_EMAIL);
      if (!demoUser) throw new Error("Demo user could not be found");

      demoUserId = demoUser.id;
      const { error: updateError } = await admin.auth.admin.updateUserById(demoUser.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Content Hub Demo" },
      });
      if (updateError) throw updateError;
    }

    if (demoUserId) {
      await admin.from("profiles").upsert({ user_id: demoUserId, display_name: "Content Hub Demo" }, { onConflict: "user_id" });
      await admin.from("user_roles").upsert({ user_id: demoUserId, role: "user" }, { onConflict: "user_id,role" });
      await admin.from("subscriptions").upsert({ user_id: demoUserId, tier: "free" }, { onConflict: "user_id" });
    }

    const { data: signInData, error: signInError } = await auth.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (signInError) throw signInError;

    return new Response(JSON.stringify({ session: signInData.session }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Demo login failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
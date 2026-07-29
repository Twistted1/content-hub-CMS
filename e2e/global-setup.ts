import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AUTH_STATE_PATH = path.join(__dirname, ".e2e-auth-state.json");

export interface E2EAuthState {
  authAvailable: boolean;
  email: string;
  password: string;
}

/**
 * Auth-dependent specs need a confirmed user to sign in as. Supabase requires
 * email confirmation by default and there's no way to toggle that (or fetch
 * the service_role key) through the tooling available to this setup, so a
 * human has to provide E2E_SUPABASE_SERVICE_ROLE_KEY once (see
 * .env.e2e.example). Without it, this upserts nothing and auth-dependent
 * specs skip themselves at runtime rather than failing the whole run.
 */
export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.E2E_TEST_EMAIL || "e2e-test@contenthub.test";
  const password = process.env.E2E_TEST_PASSWORD || "E2E-test-password-1";

  const authAvailable = Boolean(url && serviceRoleKey);
  const state: E2EAuthState = { authAvailable, email, password };
  fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify(state));

  if (!authAvailable) {
    console.warn(
      "[e2e] E2E_SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_URL) not set — " +
        "skipping test-user setup. Auth-dependent specs will skip themselves."
    );
    return;
  }

  const admin = createClient(url!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw new Error(`[e2e] Failed to list users: ${listError.message}`);

  const existingUser = existing.users.find((u) => u.email === email);
  const userId = existingUser
    ? existingUser.id
    : await (async () => {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error) throw new Error(`[e2e] Failed to create test user: ${error.message}`);
        return data.user.id;
      })();

  if (existingUser) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`[e2e] Failed to reset test user: ${error.message}`);
  }

  // Clean up data from previous runs so count/list assertions stay deterministic.
  await admin.from("templates").delete().eq("user_id", userId);
  await admin.from("posts").delete().eq("user_id", userId);
  await admin.from("notes").delete().eq("user_id", userId);
}

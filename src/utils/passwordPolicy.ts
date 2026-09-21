import { isPasswordLeaked } from "@/utils/pwnedPassword";

/**
 * Leaked-password enforcement for the two reachable password entry points:
 * signup (Auth page) and password change (Settings > Security).
 *
 * Why the check runs client-side, before the Supabase call, and why that is
 * still worth having: this app talks to `supabase.auth` directly from the
 * browser, so there is no server-side signup/password-change handler to hook.
 * Supabase's own "Leaked Password Protection" toggle is the only true
 * server-side enforcement and it is Pro-only. The free `before_user_created`
 * Auth Hook cannot substitute for it - that hook's payload carries the
 * `auth.users` row, which holds only the bcrypt `encrypted_password`, never
 * the plaintext, so it has nothing to check against HIBP.
 *
 * Checking first means a breached password is refused before an account is
 * ever created, so nothing has to be rolled back. (A client cannot delete its
 * own auth user - `auth.admin.deleteUser` needs a service role - so a
 * check-after-create design would leave a weak account stranded.)
 *
 * Residual limitation, stated rather than hidden: a determined client that
 * calls `supabase.auth.signUp` / `updateUser` directly still bypasses this.
 * Closing that fully requires either the Pro toggle or an owned backend
 * holding a service role key.
 */

export interface PasswordCheckResult {
  leaked: boolean;
  error: { message: string } | null;
}

/**
 * Run `signUp` only if `password` is not in a known breach.
 *
 * `signUp` is injected rather than imported so the caller keeps ownership of
 * the actual Supabase call and this stays unit-testable.
 */
export async function signUpWithoutLeakedPassword(
  signUp: (password: string) => Promise<{ error: { message: string } | null }>,
  password: string,
): Promise<PasswordCheckResult> {
  if (await isPasswordLeaked(password)) {
    return { leaked: true, error: null };
  }

  const { error } = await signUp(password);
  return { leaked: false, error };
}

/**
 * Run `updatePassword` only if `password` is not in a known breach.
 *
 * The current-password re-authentication and the Supabase call stay with the
 * caller; this only owns the breach policy.
 */
export async function changePasswordWithoutLeaked(
  updatePassword: (password: string) => Promise<{ error: { message: string } | null }>,
  password: string,
): Promise<PasswordCheckResult> {
  if (await isPasswordLeaked(password)) {
    return { leaked: true, error: null };
  }

  const { error } = await updatePassword(password);
  return { leaked: false, error };
}

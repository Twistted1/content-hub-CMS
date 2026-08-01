# Action items — only you can do these

Pulled out of `docs/MASTER_CHECKLIST.md` so they're in one place, separate
from everything that's already done. Nothing code-related is blocking;
these are dashboard settings, business decisions, or things only your own
browser/accounts can verify.

1. ~~Branch protection on `main`~~ — **done, 2026-07-31.** Rule existed
   but the pattern was `Main` (capital M), so it silently applied to 0
   branches. Fixed to lowercase `main`, confirmed `test`/`e2e` checks
   attached, verified "Currently applies to 1 branch."
2. ~~Leaked-password protection~~ — **decided, 2026-07-31: staying off.**
   Requires Supabase Pro; you chose not to upgrade for now. Not a live
   vulnerability, just a hardening item — revisit if the project moves
   to Pro later.
3. **Google Sign-In** — app code already supports it; needs your Google
   Cloud Console OAuth Client ID + Secret pasted into Supabase
   Authentication → Sign In/Providers → Google. You were mid-setup here
   too. Email/password login is unaffected either way.
4. **Live delivery, never observed end-to-end** — LinkedIn/X direct
   publish, webhook publishing (IG/FB/TikTok/YouTube/Rumble/Podcast/
   Website), Stripe checkout against a real account. Code is read-verified
   but needs either your real connected accounts, or you telling me which
   of these to cover with sandbox/test-mode integration tests instead
   (Stripe has one; most social platforms don't).
5. **Mobile responsiveness on authenticated pages** — this sandbox can't
   reach Supabase from a browser, so I could only check Landing/Auth
   (clean). Open your own browser's device toolbar on the live Vercel
   preview, sign in, click through — Calendar is the one page I'd bet is
   cramped on narrow screens.
6. **Optional cleanup** — formally delete the 6 stubbed edge functions via
   Supabase dashboard (Edge Functions → select → Delete). No urgency, the
   stubs already close the exposure.

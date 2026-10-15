# webhook-receiver — the other half of publishing

Six of the eight platforms this CMS supports are delivered by **pushing** a JSON
envelope to a URL you host. Nothing arrives unless something is listening. This
directory is that something: a working, tested receiver you can adapt, so the
hardest part of "make Instagram work" is a deploy rather than a project.

## Why you need this rather than just a URL

A receiver is a public HTTPS endpoint. Without a way to check that a delivery
really came from your CMS, it has to trust **anything** that reaches its URL —
and a receiver that forwards to a social platform would then post it. The CMS
signs every delivery with HMAC-SHA256 so you can refuse everything else.

## Run it

```bash
# DRY-RUN (default) — verifies, de-duplicates, and prints the row it would insert
WEBHOOK_SIGNING_SECRET=<the same value set on your Supabase function> \
  node tools/webhook-receiver/server.mjs

# Actually write to public.articles
WEBHOOK_SIGNING_SECRET=... \
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
ARTICLES_COMMIT=1 node tools/webhook-receiver/server.mjs

# Prove the whole thing works, before pointing anything at it
node tools/webhook-receiver/selftest.mjs
```

| Env | Default | Meaning |
|---|---|---|
| `WEBHOOK_SIGNING_SECRET` | — | **Required.** Same value as on the edge function. Refuses to start without it. |
| `PORT` | `8787` | Listen port |
| `ALLOW_UNSIGNED` | off | Accept unsigned deliveries. Dev only; logs loudly. |
| `REPLAY_WINDOW_SECONDS` | `300` | How stale a delivery may be |
| `ARTICLES_COMMIT` | off | **Dry-run unless set.** See below. |
| `ARTICLES_TABLE` | `articles` | Target table |

## Set the secret on the CMS side

The sender reads `WEBHOOK_SIGNING_SECRET` from the edge function environment. If
it is unset, deliveries go out **unsigned** and the delivery result records
`signed: false` — visible, not silent, but not safe. Set it in
Supabase → Project Settings → Edge Functions → Secrets, then redeploy
`publish-due-posts` and `content-pipeline` (secrets are read per invocation, but
a redeploy removes any doubt).

## What a delivery looks like

Headers: `X-Novus-Signature: sha256=<hex>`, `X-Novus-Delivery-Id`,
`X-Novus-Timestamp`, plus any custom headers configured on the webhook row.

```json
{
  "event": "post.publish",
  "delivery_id": "<post-id>:<platform>",
  "platform": "website",
  "post": {
    "id": "…", "title": "…",
    "content": "… already truncated to this platform's caption limit",
    "excerpt": null, "tags": [], "type": "text",
    "coverImageUrl": null, "scheduledAt": null
  },
  "timestamp": "2026-10-14T13:04:54.306Z"
}
```

Three details that matter when you write your own:

1. **Verify against the raw bytes**, never a re-serialised body. `JSON.parse`
   then `JSON.stringify` can reorder or re-space and the digest will not match.
   `server.mjs` reads the raw buffer first for exactly this reason.
2. **`delivery_id` is stable across retries** (`postId:platform`), deliberately
   not random. The CMS retries with exponential backoff, so a receiver that
   ignores this will publish the same post up to five times. De-duplicate on it.
3. **`type` tells you the media kind.** Instagram cannot publish text-only at
   all and needs to know whether this is a feed post, a Reel or a story.

## ⚠️ Why the default is dry-run

`public.articles` has **no status column** — any inserted row is live on
novusexchange.com immediately. There is no draft state, no undo, and no review.
This receiver therefore prints the row it *would* insert and writes nothing until
you pass `ARTICLES_COMMIT=1`. When you do turn it on, treat a CMS→site insert as
an explicit publishing action, never an automatic side effect of approving
content in the CMS.

Inserting also needs the **service-role key**, because the anon key cannot write
to `articles` (there is no anon write policy — that is correct and intentional;
one of the site's own documents suggests a policy that would make the table
world-writable, which must not be applied).

## Adapting it for Meta

`toArticleRow` is the site-specific part; everything above it is generic. For
Instagram/Facebook, replace it with a Graph API call using `post.coverImageUrl`
(Instagram requires a publicly reachable image, which the CMS provides) and
`post.type`. Remember Instagram needs an image — a text-only post cannot be
delivered there at all.

## Field mapping notes for `articles`

Not obvious, and each will silently misbehave if you get it wrong:

- **`author_id` is matched by substring**, not looked up: the site maps anything
  containing `marcio` → Marcio, else `novus` → Novus AI, else it falls back to a
  bundled seed author. An unmapped id displays as the **wrong person**. The
  `authors` table exists but is never queried by the site.
- **`publish_date` and `date` are both text** in `"OCTOBER 11, 2026"` form, and
  are duplicated in the schema — write both.
- **`category` must come from the site's own list** — `Illustrated Features`,
  `Brazil`, `Geopolitics`, `Economics`, `Tech-AI`, `Green-Tech`, `CSR`. The CMS
  generates a *different* vocabulary (Media, Technology, Security, Climate,
  Corporate Social Responsibility); only Geopolitics and Economics overlap, so
  unmapped values end up visible only under "All".
- **`read_time`** is not stored by the CMS and has to be derived.
- **Display order is `id` ascending** and nothing re-sorts it, so a high id
  renders last regardless of its date.

## Reaching it from the CMS

The CMS's SSRF guard refuses non-public hosts, so this must be exposed on a
public **HTTPS** URL (a tunnel, a small host, or a serverless function) before a
real `webhook_configs` row can deliver to it. Point the row at that URL on
`/pipeline` → Webhooks, and use the custom-headers box if your endpoint needs an
auth token.

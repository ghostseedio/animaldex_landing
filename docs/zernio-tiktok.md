# TikTok posting through Zernio

AnimalDex's own TikTok developer app was rejected (internal use), so the admin
Content Studio (`/admin/story-videos`, Share dialog) no longer talks to TikTok
itself. TikTok posts go through [Zernio](https://docs.zernio.com), which holds
the connection to the official AnimalDex TikTok account. The other platforms
(YouTube, Instagram, Facebook, X) still use their own OAuth apps, unchanged.

## What was removed

Code:

- `src/app/api/admin/social/tiktok-creator/` (the whole route): read TikTok
  `creator_info` with the stored OAuth token. Replaced by
  `GET /api/admin/social/tiktok-account`.
- `src/lib/social/oauth.ts`: `ENV_NAMES.tiktok`, the TikTok authorize-URL
  branch (`https://www.tiktok.com/v2/auth/authorize/`, scope
  `user.info.basic,video.publish`, hex PKCE), the token-exchange branch and the
  refresh branch (`https://open.tiktokapis.com/v2/oauth/token/`). The module
  now works on `OAuthPlatform = Exclude<SocialPlatform, "tiktok">` and exports
  `isOAuthPlatform()`.
- `src/lib/social/publishers.ts`: `publishTikTok`, `tiktokChunkPlan` and the
  TikTok Content Posting API upload (`/v2/post/publish/...`). `publishers` is
  now `Record<OAuthPlatform, ...>`.
- `src/lib/social/account-metrics.ts`: `tiktokByLogin` and `tiktokTotalViews`
  (TikTok Display API through the OAuth login). TikTok metrics now sync only
  with `TIKTOK_RESEARCH_ACCESS_TOKEN`.
- `src/lib/social/tiktok-options.ts`: `parseTikTokCreatorInfo` and
  `TikTokCreatorInfo` (TikTok's own creator_info shape). The account's
  allowances now come from Zernio as `TikTokAccountInfo`.
- Tests for `tiktokChunkPlan` and `parseTikTokCreatorInfo` in
  `src/lib/social-share.test.ts`.

Routes that now refuse TikTok:

- `GET /api/admin/social/connect/tiktok` and
  `GET /api/admin/social/callback/tiktok` answer 404
  "TikTok is connected through Zernio". The redirect URI
  `https://animaldex.app/api/admin/social/callback/tiktok` is no longer
  needed anywhere.
- `DELETE /api/admin/social/connections?platform=tiktok` answers 400
  "TikTok is managed in Zernio".

Environment:

- `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` were removed from the
  repo-root `.env`. Nothing reads them any more. Remove them from the
  production server's env file too (they were the rejected app's credentials).

Stored tokens:

- The `admin_social_connections` row with `platform = 'tiktok'` (encrypted
  access/refresh tokens from the rejected app) is deleted whenever
  `GET /api/admin/social/connections` finds one (the Content Studio calls it
  on load); the server logs
  `removed the stored TikTok OAuth tokens; TikTok now posts through Zernio`.
  This already ran on 2026-10-17 against the shared Supabase project, so the
  row is gone. Nothing reads it any more. The table itself and the other
  platforms' rows are untouched.

What you can delete outside this repo:

- TikTok for Developers: the rejected app (its client key/secret, the
  `user.info.basic` / `video.publish` scopes, the Login Kit redirect URI
  above, and the Content Posting API product).
- Password manager: the TikTok client key/secret entries.

## What was added

- `src/lib/social/zernio-core.ts` (pure: request/response shapes, error
  mapping, webhook signature check, schedule rules) and
  `src/lib/social/zernio.ts` (server-only; sends the API key):
  `getTikTokAccount()`, `uploadVideoToZernio()`, `postToTikTok()`,
  `getZernioPost()`, `deleteZernioPost()`.
- `src/lib/social/zernio-sync.ts`: `rowsNeedingSync`, `zernioPatchForRow`,
  `rateLimitRetryDelaySeconds` (pure) and `reconcileZernioRows()` (shared by
  the share-log GET and the webhook).
- `src/lib/social/runner.ts`: TikTok rows upload the normalised MP4 to
  Zernio's presigned storage (Zernio copies it to permanent storage when the
  post is created), then create the post (publish now, or `scheduledFor` +
  `timezone`; `draft` sends to the TikTok Creator Inbox with the account's
  public privacy level, which the creator changes in the app). If Zernio stops
  answering during the create call, the row stays `processing` with a note to
  check the Zernio dashboard, so a blind retry cannot post the video twice;
  the 30-minute stale rule frees it.
  A 429 with `Retry-After` of at most 90 s is waited out once and the create
  retried (same `x-request-id`, so no duplicate).
- `POST /api/admin/social/posts`: TikTok targets accept `scheduledFor` (ISO
  with offset, 2 min to 30 days ahead) and `timezone` (IANA); TikTok drafts are
  allowed again; scheduling on any other platform is a 400.
- `DELETE /api/admin/social/posts?id=<rowId>`: cancels a scheduled TikTok post
  in Zernio and marks the row failed with "Cancelled before publishing".
- `GET /api/admin/social/posts` reconciles waiting TikTok rows with Zernio
  (at most 8 per request, each at most every 20 s, one reconcile at a time)
  before listing. A published row still missing its URL is asked again for up
  to an hour, because TikTok hands Zernio the public URL some minutes after
  publishing. A post deleted in the Zernio dashboard turns its row `failed`
  ("no longer exists in Zernio") instead of waiting forever.
- `GET /api/admin/social/tiktok-account`: who Zernio posts as, the privacy
  levels and interaction toggles the account allows, the disclosure types.
- `GET /api/admin/social/connections`: the TikTok entry has
  `provider: "zernio"`, `manageUrl: "https://zernio.com/dashboard"`, the
  account nickname when the lookup works and `error` when it does not.
- `POST /api/webhooks/zernio`: Zernio's delivery of post state changes.
- `src/lib/social/store.ts`: `updatePost` also writes `options`;
  `findPostByExternalId()`.
- Tests: `src/lib/social-zernio.test.ts`.

Share-log row semantics for TikTok (`admin_social_posts`, schema unchanged):
`external_id` = Zernio post id as soon as it exists; `external_url` = the
TikTok post URL once published; `options.tiktok` = the chosen options;
`options.zernio` = `{postId, scheduledFor, timezone, platformPostId, publishedAt, syncedAt}`.
Status `processing` while uploading/creating (and while Zernio reports
`publishing`), `queued` with `options.zernio.scheduledFor` = scheduled and
waiting in Zernio, `published`, `failed` with the reason. A row with a Zernio
post id is never treated as stale.

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `ZERNIO_API_KEY` | production server env (set) | `Authorization: Bearer` for `https://zernio.com/api/v1` |
| `ZERNIO_TIKTOK_ACCOUNT_ID` | production server env (set) | the connected TikTok account's id in Zernio |
| `ZERNIO_WEBHOOK_SECRET` | production server env (optional) | HMAC secret for `POST /api/webhooks/zernio`; without it the route answers 503 and the log relies on polling |

All three are server-only; none is `NEXT_PUBLIC_`. They are documented in
`.env.example`.

## Registering the webhook (optional, faster status updates)

Pick a long random secret, set it on the server as `ZERNIO_WEBHOOK_SECRET`,
restart, then register it with Zernio:

```sh
curl -X POST https://zernio.com/api/v1/webhooks/settings \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AnimalDex production",
    "url": "https://animaldex.app/api/webhooks/zernio",
    "secret": "'"$ZERNIO_WEBHOOK_SECRET"'",
    "events": ["post.published", "post.failed", "post.partial", "post.cancelled", "post.platform.published", "post.platform.failed", "post.tiktok.url_resolved"]
  }'
```

Zernio signs each delivery with `X-Zernio-Signature` = hex HMAC-SHA256 of the
raw body under that secret, and retries until it gets a 2xx within 5 s
(at-least-once; re-applying the same state is harmless). The route matches the
delivery to a share-log row by `external_id`, so a post created outside the
Content Studio is acknowledged and ignored.

## Verifying

Admin calls need the Content Studio session cookie; the simplest way is the
browser's dev tools on `/admin/story-videos`. From a shell, replace
`$COOKIE` with the `Cookie:` header copied from any `/api/admin/...` request.

1. Zernio reaches the account:

   ```sh
   curl -s https://animaldex.app/api/admin/social/tiktok-account -H "Cookie: $COOKIE"
   # {"ok":true,"account":{"accountId":"...","nickname":"...","privacyLevels":[...],"interactions":{...},...}}
   curl -s https://animaldex.app/api/admin/social/connections -H "Cookie: $COOKIE"
   # tiktok: {"provider":"zernio","configured":true,"connected":true,"accountName":"...","manageUrl":"https://zernio.com/dashboard","error":null}
   ```

2. Schedule one short video about 10 minutes ahead (the Share dialog does
   this; the raw call is):

   ```sh
   curl -s -X POST https://animaldex.app/api/admin/social/posts -H "Cookie: $COOKIE" -H "Content-Type: application/json" -d '{
     "speciesProfileId": "<species_profile_id>",
     "mediaPath": "story_video/<id>/en.mp4",
     "targets": [{
       "platform": "tiktok", "mode": "post", "caption": "Test post #AnimalDex",
       "scheduledFor": "'"$(date -u -v+10M +%Y-%m-%dT%H:%M:00Z)"'", "timezone": "Europe/London",
       "tiktok": {"privacyLevel": "PUBLIC_TO_EVERYONE", "allowComment": true, "allowDuet": false, "allowStitch": false,
                  "brandOrganic": false, "brandContent": false, "madeWithAi": true, "previewConfirmed": true}
     }]
   }'
   # {"ok":true,"queued":["tiktok"],"skipped":[]}
   ```

3. Watch the row: within a minute `GET /api/admin/social/posts` shows the
   TikTok row with `status: "queued"`, `external_id` = the Zernio post id and
   `options.zernio.scheduledFor` set. The same post appears in the Zernio
   dashboard as scheduled. After the scheduled time the row turns
   `published` with `external_url` (by webhook at once, or on the next poll).

4. Cancel instead, while it is still queued:

   ```sh
   curl -s -X DELETE "https://animaldex.app/api/admin/social/posts?id=<rowId>" -H "Cookie: $COOKIE"
   # {"ok":true}; the row is failed with "Cancelled before publishing"
   ```

5. Webhook reachability (no cookie): `curl -s https://animaldex.app/api/webhooks/zernio`
   answers `{"ok":true,"service":"zernio-webhook","configured":true}` once
   the secret is set. An unsigned POST answers 401.

Error paths surface in the share log's `error` column with the next step:
bad or missing env (400 at queue time), an unsupported video ("Zernio could
not accept the video: ..."), Zernio or TikTok rate limits ("... Try again in
N s/min"), a duplicate ("... Change the caption or the video ..."), and a
disconnected Zernio account ("reconnect it in the Zernio dashboard").

Accounts connected to Zernio through TikTok for Business can only publish
videos as `PUBLIC_TO_EVERYONE`; other levels are rejected at creation unless
the post is a draft. The dialog says so under the privacy select.

The old TikTok OAuth rows for the posts shared before this change keep their
`external_id` (TikTok publish id) and are unaffected.

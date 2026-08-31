# Support AI-ready architecture

This pass keeps **one canonical article source** (`src/data/support-content.ts` compiled by `src/lib/support-articles.ts`) and **one search primitive** (`searchSupportArticles` / `GET /api/support/search`).

## Retrieval boundary (future assistant)

```
support-content.ts  →  support-articles.ts  →  searchSupportArticles()
                                                      ↓
                                            GET /api/support/search
                                                      ↓
                              future support assistant (RAG, not fine-tuned)
                                                      ↓
                                    answer + cited article links
                                                      ↓
                              human escalation via existing DM support thread
```

## Reuse points

| Consumer | Entry |
|----------|--------|
| `/support` search UI | `GET /api/support/search` |
| Support admin article picker | `GET /api/admin/support/articles/search` |
| Future AI assistant | `searchSupportArticlesForRetrieval()` |

## Human support

- Web: `getSupportChatHref()` → `/app/messages/{systemSupportUserId}`
- Admin: existing `admin_send_support_direct_message` RPC + support inbox
- Article cards in chat: `[[adex-article:category/slug]]` token parsed by `support-article-messages.ts`

## Not in this pass

- Production AI agent
- DB-backed article CMS (schema-ready via compiled articles; migrate when CMS wired)
- iOS pinning source (not in this repo; web sorts `isSystem` conversations first)

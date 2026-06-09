# Activity, Expiry, and Inbox Refactor

**Branch:** `feature/activity-expiry-inbox`  
**Date:** June 8, 2026

## Overview

This branch tightens how unread activity is tracked, makes expiring posts easier to find, and groups engagement notifications by post.

| Area | Summary |
|---|---|
| Reaction seen | Clears only when the host opens and leaves post detail — not when scrolling Post Activity cards |
| Expiring filters | Post Activity scope filter; feed quick-action (unreacted + expiring) on its own row; filter menu toggle (all expiring) |
| User inbox | `userInbox/{userId}/items/{itemId}` replaces client-side unread + per-post listeners |

## User inbox data model

```
userInbox/{userId}/items/{itemId}
```

`UserInboxItem` is a discriminated union on `type` with shared fields: `userId`, `postId`, `surface`, `readAt`, `createdAt`, `metadata`.

### Surface routing

| Type | Surface | Notes |
|---|---|---|
| `post_reaction` | `post_activity` | Deduped doc id `{postId}_post_reaction` |
| `conversation_message` | `post_activity` | |
| `private_note` | `post_activity` | |
| `private_note_reply` | `post_activity` if recipient is post host; else `notifications` | |
| `comment_reply`, `new_post`, requests/invites | `notifications` | |

**Unread** = items where `readAt == null` (client filters after snapshot; treats missing `readAt` as unread). A single `subscribeToUserInbox` listener at startup replaces global per-authored-post message/note listeners. Cloud Function writes use full `set()` (not merge) so `readAt: null` is stored reliably on re-notifications.

### Mark-read triggers

| Screen | Inbox types marked read |
|---|---|
| Post detail (blur) | `post_reaction` for that post |
| Conversation (focus) | `conversation_message` for that post |
| Private notes host (focus) | `private_note` for that post |
| Private note thread (focus) | `private_note_reply` for that note |

## Expiring-soon logic

Warning windows (unchanged):

- Daily circles: 3 days before expiry
- Custom circles: 7 days before expiry

Helpers in `src/lib/post/post.utils.ts`:

- `isPostExpiringSoon(timestamp, isDaily)`
- `hasUserReactedToPost(post, userId)`

### Feed UI

- **Status pills** (Big News, Worth Knowing, etc.) — first quick-filter row
- **Expiring filter** — second row, dashed-outline button with clock icon; filters to unreacted posts in the warning window
- **Filter menu** — "Expiring soon" toggle shows all expiring posts in scope (including reacted)

## Cloud Function writes

`writeUserInboxItem` in `functions/src/index.ts` runs from `sendAppNotification` (single-user and channel-tier fan-out). Keeps notification types in sync with `src/models/types.ts`.

Deploy before testing:

```bash
npm run deploy:rules
npm run deploy:indexes
# deploy functions per project convention
```

## Client architecture

| Layer | File | Role |
|---|---|---|
| Slice | `store/slices/userInboxSlice.ts` | Inbox items in Redux |
| Selectors | `store/crossSelectors/userInboxSelectors.ts` | Grouped unread for Post Activity + Notifications |
| Selectors | `store/crossSelectors/activitySelectors.ts` | Bell badge includes notification-surface inbox |
| Listener | `hooks/dataListeners/useDataListenerRealtimeData.ts` | Single inbox subscription |
| Firestore | `services/firebase/firestore.ts` | Subscribe + mark-read helpers |
| Provider | `providers/AuthorPostActivityProvider.tsx` | Thin wrapper over inbox selectors |
| Notifications | `app/(protected)/notifications.tsx` | Activity section grouped by post |
| Feed | `app/(protected)/feed.tsx` | Expiring quick filter + menu toggle |
| Post Activity | `app/(protected)/post-activity.tsx` | Expiring scope filter |

## Migration note

AsyncStorage seen keys (`POST_REACTIONS_SEEN_KEY`, etc.) are removed. No backfill — users may see a one-time badge reset until new activity arrives.

## Manual test

1. React to a host's post while they scroll Post Activity → badge stays until they open post detail.
2. Create posts in 3d/7d warning window → Post Activity "Expiring soon" filter lists them soonest-first.
3. Feed: tap dashed "Expiring soon · not reacted" row → only unreacted expiring posts; filter menu "Expiring soon" includes reacted ones.
4. `comment_reply` on someone else's post → Notifications Activity (grouped), not Post Activity.
5. Confirm one `userInbox` listener at startup (not N message/note listeners per authored post).

## Related docs

- `apps/mobile/BRANCH_NARRATIVE.md` — reviewer narrative (appended sections)
- `apps/mobile/TESTING.md` — manual QA checklists (appended sections)
- `apps/mobile/BETA_UPDATE_NOTES.txt` — beta tester bullets

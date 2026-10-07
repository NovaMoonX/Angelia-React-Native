# Notification tap routing & private note blank-screen fix

**Date:** 2026-10-07 · **Branch:** `claude/fervent-knuth-g6g5wq` · **Start of the next version after 1.0.9**

## Overview

| Item | Detail |
| --- | --- |
| Symptom | Tapping a private-note conversation notification opened a permanently blank screen |
| Root cause | `private-note-thread/[postId]/[noteId]` read the note only from Redux (`selectPrivateNoteById`). Redux is filled solely by the post-detail / notes-list screens, so a thread opened from a push, inbox row or cold start never had the note and rendered an empty `<View>` forever |
| Also fixed | Blank states on `private-notes-host` / `private-notes-sender`; navigation during render on the sender screen; duplicated + drifting tap-routing tables; daily prompt `existingText` vs `notificationPrompt`; double-handler race on the same tap |

## Tap flow (after)

1. **Warm tap** (app running/backgrounded): module-level listener in `app/_layout.tsx` → skipped if no `currentUser` → `handleNotificationResponse`.
2. **Cold start**: `useDataListenerNotifications` calls `getLastNotificationResponseAsync()` once `currentUser` exists → `handleNotificationResponse`.
3. `handleNotificationResponse` claims the tap atomically (`consumeNotificationResponse`), waits for the navigator (`pushRouteWhenNavigatorReady`), then calls `navigateFromNotification`. If the navigator never became ready the claim is released.
4. `navigateFromNotification` resolves the target: daily prompt/wind-down → `post/new` with `notificationPrompt`; remote types → `resolveRemoteNotificationTarget`.

## Route table (`lib/notification/notificationRouting.ts`)

| `type` | Screen | Required ids (missing → Notifications inbox) |
| --- | --- | --- |
| `join_channel_request` | `join-request/[id]` | `joinRequestId` |
| `join_channel_accepted` | `channel-accepted` | – |
| `custom_circle_invite` | `circle-invite/[id]` | `requestId` |
| `connection_request` | `connection-request/[id]` | `connectionRequestId` |
| `connection_accepted` | `my-people` | – |
| `new_post`, `post_reaction` | `post/[id]` | `postId` |
| `conversation_message`, `comment_reply` | `conversation` | `postId` |
| `private_note` | `private-notes-host/[postId]` | `postId` |
| `private_note_reply` | `private-note-thread/[postId]/[noteId]` | `postId`, `noteId` |
| unknown | no navigation | – |

All remote targets carry `from=notifications` so back returns to the inbox.

## Private note screens

- `usePrivateNoteById` → `subscribeToPrivateNote` (single-doc listener; existing rules already allow the Host and the note author to `get` it). Redux copy wins when present (list screens, demo mode).
- `PrivateNoteScreenState` shows a spinner while the user/note/posts are still loading and an "isn't available" message with a back button once they are loaded but the post/note is missing or not shared with the user.
- Back navigation falls back to Feed when the post/note is gone (previously a dead-end post-detail "not available" screen).

## Client file map

- `src/lib/notification/notificationRouting.ts`, `navigateFromNotification.ts`, `handleNotificationResponse.ts` (new)
- `src/lib/notificationResponseDedup.ts` (atomic `consume…` + `release…`)
- `src/app/_layout.tsx`, `src/hooks/dataListeners/useDataListenerNotifications.ts` (now thin callers)
- `src/hooks/usePrivateNoteById.ts`, `src/components/PrivateNoteScreenState.tsx` (new)
- `src/app/(protected)/private-note-thread/…`, `private-notes-host/…`, `private-notes-sender/…`
- `src/services/firebase/firestore.ts` (`subscribeToPrivateNote`)

No Cloud Functions, rules, or index changes — nothing to deploy.

## Known follow-up (not changed here)

`useDataListenerRealtimeData` prunes inbox items whose post/channel is not in Redux yet and marks them read. At startup posts load incrementally, so unread items for not-yet-loaded posts can be marked read prematurely. Tracked as a separate task.

## Manual test

See `apps/mobile/TESTING.md` → Feature 6 and `apps/mobile/NOTIFICATION_TESTING.md` Scenario F/F2.

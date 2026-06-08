# Investigation Report: Private Notes Not Appearing Until App Reload

**Date:** June 8, 2026  
**Issue:** Host receives a private-note push notification, but the note does not appear in the app until the user fully reloads.

---

## Executive Summary

Private notes were not updating in real time because **hosts never subscribed to their own note stream while viewing a post**. The `usePrivateNotes` hook intentionally skipped Firestore subscriptions when the current user was the Host, assuming a global background listener in `useDataListenerRealtimeData` would keep Redux in sync. That global path was fragile: a failed listener was treated as "already subscribed" and never retried, so notes only appeared after a cold start recreated subscriptions.

---

## Root Cause

### Primary: Host hook skipped live subscription

`usePrivateNotes` contained this guard:

```ts
if (!postId || !hostId || isDemo || isCurrentUserHost) {
  setLoaded(true);
  return;
}
```

When the Host opened post detail or the private-notes screen, the hook read from Redux only and **never attached an `onSnapshot` listener**. Real-time updates depended entirely on the global authored-post listener.

### Secondary: Global listener could get stuck after error

In `useDataListenerRealtimeData`, messages and private notes were bundled in one ref per post. If `subscribeToPrivateNotesForPost` hit a transient rules/auth error:

1. `onError` cleared notes to `[]`
2. The combined unsubscribe ref remained set
3. The effect skipped re-subscription on subsequent runs (`if (authoredPostActivityUnsubsRef.current[post.id]) return`)

Until a full app reload cleared refs, the Host saw stale or empty note data even though notifications still fired (notifications are written independently of the client subscription).

---

## Fix

### 1. `usePrivateNotes` always subscribes when `postId` + `hostId` are set

The hook now attaches its own Firestore listener for Host screens. The global listener remains for badges/post-activity when no post screen is open.

### 2. Global listener split and error recovery

- Separate refs for message vs. private-note subscriptions per authored post
- On private-note subscription error: tear down the dead listener and remove the ref entry so the next `posts` / `currentUser` effect pass can retry
- Stop clearing `notesByPost` to `[]` on transient subscription errors

---

## Files Changed

| File | Change |
|---|---|
| `apps/mobile/src/hooks/usePrivateNotes.ts` | Removed Host skip; always subscribe on active post screens |
| `apps/mobile/src/hooks/dataListeners/useDataListenerRealtimeData.ts` | Split message/note refs; retry-friendly error handling |

---

## Verification

1. Log in as the Host and open a post (or private-notes screen); leave it open.
2. From another account, send a private note to that post.
3. The note should appear immediately without reloading.
4. Post-activity unread badges should still update when the Host is elsewhere in the app.

---

## Related Patterns

- Post conversation messages use the same global-vs-local split: hosted posts rely on `useDataListenerRealtimeData`, visitors subscribe locally in `conversation.tsx`.
- Private notes now mirror messages for **active Host screens** — local subscription guarantees live updates where the user is looking.

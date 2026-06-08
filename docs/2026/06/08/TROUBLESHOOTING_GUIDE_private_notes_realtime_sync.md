# Troubleshooting Guide: Private Notes Not Showing Live

**Last updated:** June 8, 2026

---

## Symptom A: Notification received, empty private notes screen

### Check 1 — Demo mode

Demo mode skips all Firestore subscriptions. Notes come from static `DEMO_DATA.privateNotes` only.

### Check 2 — Host identity

Private-notes-host screen requires `currentUser.id === post.authorId`. Wrong account → redirect to post detail.

### Check 3 — Subscription path

| Context | Expected listener |
|---|---|
| Host on post detail / private-notes screen | `usePrivateNotes` → `subscribeToPrivateNotesForPost` |
| Host on feed / post-activity | Global listener in `useDataListenerRealtimeData` |

If neither is active, Redux `notesByPost[postId]` stays empty.

### Check 4 — Firestore rules

Host read requires:

```
request.auth.uid == get(post).authorId
```

Visitor read requires `resource.data.authorId == request.auth.uid`.

---

## Symptom B: Notes appear only after reload

**Likely cause (pre-fix):** Global listener failed once; ref prevented re-subscription.

**After fix:** Confirm `usePrivateNotes` is subscribing (not skipping for Host). Reload should no longer be required.

**If still happening:**

1. Check Metro logs for Firestore permission-denied on `privateNotes` query
2. Confirm composite index not required (single-field `orderBy('timestamp')` on subcollection)
3. Verify `posts` slice still contains the authored post (global listener only subscribes to posts in Redux)

---

## Symptom C: Badge shows unread but list is empty

Post-activity badges use `notesByPost` via `activitySelectors`. Same subscription paths as above. If global listener is stuck, badge may lag until next successful snapshot.

**Workaround for testers:** Open the post once (triggers `usePrivateNotes` local subscription).

---

## Manual Test Script

1. Account A (Host): create post, stay on post detail.
2. Account B (visitor): send private note from post detail.
3. Account A: note should appear within 1–2 seconds.
4. Account A: navigate to feed, send another note from B.
5. Account A: post-activity badge should update without reload.

---

## Related Docs

- [INVESTIGATION_REPORT_private_notes_realtime_sync.md](./INVESTIGATION_REPORT_private_notes_realtime_sync.md)
- [QUICK_REFERENCE_private_notes_realtime_sync.md](./QUICK_REFERENCE_private_notes_realtime_sync.md)

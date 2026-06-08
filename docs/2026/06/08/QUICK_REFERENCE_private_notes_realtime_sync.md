# Quick Reference: Private Notes Real-Time Sync

**Status:** ✅ Fixed (June 8, 2026)  
**Symptom:** Notification arrives; note missing until app reload

---

## The Problem

| What works | What broke |
|---|---|
| Push notification (`private_note`) | Live note list on Host screens |
| Note visible after cold start | Note missing while app stays open |

---

## Why

```
HOST OPENS POST SCREEN
        │
        ▼
usePrivateNotes (before fix)
  → isCurrentUserHost? skip subscription
  → read Redux only
        │
        ▼
Global listener (background)
  → should update Redux
  → if listener dies → ref blocks retry → stale data
```

---

## The Fix (two parts)

1. **`usePrivateNotes`** — always subscribe when `postId` + `hostId` are set (not demo).
2. **`useDataListenerRealtimeData`** — separate note/message refs; on note listener error, drop ref so next effect pass retries.

---

## Key Files

| File | Role |
|---|---|
| `src/hooks/usePrivateNotes.ts` | Per-post subscription for Host UI |
| `src/hooks/dataListeners/useDataListenerRealtimeData.ts` | Background subscriptions for all authored posts |
| `src/services/firebase/firestore.ts` | `subscribeToPrivateNotesForPost` |
| `src/store/slices/privateNotesSlice.ts` | `notesByPost` Redux state |

---

## Debugging Checklist

- [ ] Host is not in demo mode (`isDemo` skips all Firestore subs)
- [ ] `postId` and `hostId` passed into `usePrivateNotes` on Host screens
- [ ] Global listener logs show subscription for the authored `postId`
- [ ] Firestore rules allow Host read on `posts/{postId}/privateNotes`
- [ ] No lingering `subscriptionFailed` on private-notes-host screen

---

## Data Path

```
Firestore: posts/{postId}/privateNotes/{noteId}
    ↓ onSnapshot
usePrivateNotes (active screen) OR global listener (background)
    ↓ dispatch setPrivateNotes
privateNotesSlice.notesByPost[postId]
    ↓ selector
Post detail / private-notes-host / post-activity badges
```

# Private Note Conversations

**Date:** June 8, 2026

## Overview

Hosts and note authors can now continue a private note as a threaded conversation, similar to post conversations but limited to the two participants.

## Data model

```
posts/{postId}/privateNotes/{noteId}           ← original note document
posts/{postId}/privateNotes/{noteId}/messages/{messageId}  ← thread replies
```

Thread replies reuse the existing `Message` interface (`authorId`, `text`, `timestamp`, `parentId`, `reactions`).

The opening note text is rendered from the parent `PrivateNote` document — it is not duplicated into the messages subcollection.

## Access control (Firestore rules)

| Action | Who |
|---|---|
| Read thread messages | Post Host **or** note author |
| Create reply | Post Host **or** note author (must set `authorId` to self) |
| Edit reply | Message author only (text field) |

## Client architecture

| Layer | File | Role |
|---|---|---|
| Subscription | `usePrivateNoteThread.ts` | Live `onSnapshot` for thread messages |
| Redux | `privateNotesSlice.ts` | `threadMessagesByKey` keyed by `postId:noteId` |
| Send action | `privateNoteThreadActions.ts` | Optimistic write + `private_note_reply` notification |
| Screen | `private-note-thread/[postId]/[noteId].tsx` | Conversation UI (flat list, no threading) |
| Entry points | `private-notes-host`, `private-notes-sender` | Tap a note card → open thread |

## Notifications

| Type | Target | Deep link |
|---|---|---|
| `private_note` | Host | `private-notes-host/[postId]` |
| `private_note_reply` | Other participant | `private-note-thread/[postId]/[noteId]` |

Both respect `postActivity.privateNotesEnabled` in notification settings (Cloud Function).

## Manual test

1. Visitor sends a private note on a post.
2. Host opens Private Notes → taps the note → sends a reply.
3. Visitor opens Your Notes → taps the same note → sees Host reply → responds.
4. Confirm push / tap routing for `private_note_reply` opens the thread directly.

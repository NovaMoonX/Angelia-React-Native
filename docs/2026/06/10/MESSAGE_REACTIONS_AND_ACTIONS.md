# Message Reactions + Message Actions (v1.0.10)

## Overview

| Area | Change |
|---|---|
| Conversation messages | Unified action sheet + inline reactions + author delete |
| Private note thread replies | Unified action sheet + inline reactions + author edit/delete |
| Message identity affordance | Avatar tap opens participant profile modal |

## Data Model

- `Message.reactions` remains `Record<string, string[]>` (`emoji -> userIds`).
- No new top-level collections were introduced.
- Existing message docs now support reaction updates and author deletes in both:
  - `posts/{postId}/messages/{messageId}`
  - `posts/{postId}/privateNotes/{noteId}/messages/{messageId}`

## Access Rules

Updated in `apps/mobile/firestore.rules`:

- **Conversation messages**
  - Participants can update reactions.
  - Message author can delete their own non-system message.
- **Private note thread messages**
  - Thread participants can update reactions.
  - Message author can delete their own non-system message.

## Client File Map

- `apps/mobile/src/hooks/useMessageActions.ts`
  - Shared action flow used by conversation + private note threads.
- `apps/mobile/src/components/conversation/MessageActionSheet.tsx`
  - Unified Reply/React/Edit/Delete action surface.
- `apps/mobile/src/components/conversation/MessageReactionRow.tsx`
  - Inline reaction chips with names.
- `apps/mobile/src/components/conversation/ConversationMessage.tsx`
  - Avatar press, menu trigger, and reaction row integration.
- `apps/mobile/src/store/actions/conversationActions.ts`
  - `toggleConversationMessageReaction`, `deleteConversationMessage`.
- `apps/mobile/src/store/actions/privateNoteThreadActions.ts`
  - `editPrivateNoteThreadMessage`, `togglePrivateNoteThreadMessageReaction`, `deletePrivateNoteThreadMessageAction`.
- `apps/mobile/src/services/firebase/firestore.ts`
  - Firestore helpers for message reaction toggles and deletes.

## Deploy Steps

1. Deploy Firestore rules:
   - `npm run deploy:rules`
2. No index changes required for this feature.

## Manual Test Checklist

- Conversation: long-press/⋯ opens message action sheet.
- Conversation: react to a message; reaction appears optimistically and persists.
- Conversation: reaction chips show who reacted.
- Conversation: delete own message shows destructive confirm and removes message.
- Private note thread: react/edit/delete works for persisted thread replies.
- Private note thread: seed note is read-only (no action sheet).
- Avatar tap in both screens opens profile modal for other participants.

## Related Branch Docs

- `apps/mobile/BRANCH_NARRATIVE.md`
- `apps/mobile/TESTING.md`
- `apps/mobile/BETA_UPDATE_NOTES.txt`

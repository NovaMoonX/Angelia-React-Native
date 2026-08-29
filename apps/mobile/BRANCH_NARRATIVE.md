# Beta v1.0.7 Branch Narrative

**Branch:** beta-v-1.0.7  
**Date:** May 2026  
**Theme:** More precise notifications, steadier post creation, and clearer conversation context

---

## Story Overview

This branch tightens the parts of Angelia that matter most in daily use: what should ping you, what should stay unread until you actually review it, and whether a half-finished post survives the camera or media flow. The work also makes conversation threads much easier to follow by rendering replies in-place, showing their context, and keeping the visual thread lines connected.

---

## Feature 1: More Precise Notification Controls

### The Problem

Notification settings were too coarse. Users could not separately control reaction alerts, conversation-message alerts, and direct reply alerts, and there was no clear release notice guiding people to these new controls.

### The Solution

Notification Settings now exposes dedicated switches for **Reaction Notifications**, **Message Notifications**, and **Reply Notifications**. The Notifications screen and feed bell also work as a coordinated release-notice system: the bell dot clears when you visit Notifications, while the release card itself stays until you actually open Notification Settings.

### Technical Detail

- File: [src/app/(protected)/notification-settings.tsx](src/app/(protected)/notification-settings.tsx)
	Added the new post-activity switches and save flows for reactions, conversation messages, and replies.
- File: [src/app/(protected)/notifications.tsx](src/app/(protected)/notifications.tsx)
	Added the release notice card that routes into Notification Settings.
- File: [src/app/(protected)/feed.tsx](src/app/(protected)/feed.tsx)
	Added the versioned bell-dot behavior for the notification-controls release notice.
- File: [src/models/constants.ts](src/models/constants.ts)
	Stores the release-notice version and AsyncStorage keys that control notice and badge visibility.

---

## Feature 2: Faster Per-Circle Post Notification Tuning

### The Problem

Per-circle post notifications were noisy and slow to configure. Users were seeing circles they host in a screen that should really be about circles they follow, and enabling everything one toggle at a time was tedious.

### The Solution

The Post Notification Settings screen now focuses only on circles the current user has **joined** from other people. It groups those circles by host, supports a per-circle **Enable All** switch, and also supports a host-level **Enable All** switch to flip a whole person's circles at once without losing the default Big News behavior when turning everything back down.

### Technical Detail

- File: [src/app/(protected)/post-notification-settings.tsx](src/app/(protected)/post-notification-settings.tsx)
	Filters to joined circles, groups them by host, and adds both group-level and per-circle bulk toggles.
- File: [src/app/(protected)/notification-settings.tsx](src/app/(protected)/notification-settings.tsx)
	Summarizes how many joined circles currently have extra alerts enabled.
- File: [src/models/constants.ts](src/models/constants.ts)
	Provides the default circle-post notification settings used when a circle has not been customized yet.

---

## Feature 3: Conversation Threads Are Easier To Read And Use

### The Problem

Conversation replies were hard to track. Flat ordering made it harder to see what a reply belonged to, deeper reply chains lost clarity, and conversation banners did not visually match post detail.

### The Solution

Replies now render directly after the message they respond to, quoted context appears in-thread, and the connector lines stay visually connected across sibling and descendant replies. Users can long-press to reply, get a one-time reply hint, double tap their own messages to edit them, and see a clear warning when a thread is already at the maximum reply depth. If they already started typing something new, switching into edit mode first asks for confirmation so that draft is not silently lost. Big News and Worth Knowing banners in conversation also now read as centered header callouts instead of off-balance badges.

### Technical Detail

- File: [src/app/(protected)/conversation.tsx](src/app/(protected)/conversation.tsx)
	Builds the threaded row model, persists conversation last-seen timestamps, shows the reply and edit hints, branches the composer between new-message and edit mode, and blocks replies deeper than the supported level.
- File: [src/components/conversation/ConversationMessage.tsx](src/components/conversation/ConversationMessage.tsx)
	Renders the connective line system, quoted-parent preview, and double-tap entry point for editable messages.
- File: [src/store/actions/conversationActions.ts](src/store/actions/conversationActions.ts)
	Adds the async edit-message path with optimistic local updates and Firestore persistence.
- File: [src/store/actions/postActions.ts](src/store/actions/postActions.ts)
	Supports joining a conversation before a user posts their first message.
- File: [src/models/constants.ts](src/models/constants.ts)
	Holds the reply-hint, edit-hint, and conversation-seen storage keys used by the screen.

---

## Feature 4: Post Creation Now Survives Camera, Gallery, And Audio Detours

### The Problem

It was too easy to lose work while building a post. Moving into camera, gallery, or audio flows could strand the user away from the composer, and there was no strong local-draft safety net if the user backed out mid-flow.

### The Solution

Post Create now saves a local draft for the current user, including text, selected circle, priority, media, pending status, and hint dismissals. Closing Camera, Gallery, or Audio Record now routes back into Post Create with the in-progress state preserved. Reset now requires confirmation, successful upload clears the saved draft, and the composer shows a dismissible heads-up that gallery video uploads are still limited.

### Technical Detail

- File: [src/app/(protected)/post/new.tsx](src/app/(protected)/post/new.tsx)
	Hydrates and persists the local draft, confirms reset/cancel flows, and stores hint-dismissal state alongside the draft.
- File: [src/app/(protected)/camera.tsx](src/app/(protected)/camera.tsx)
	Returns captured media and all existing compose state back into Post Create instead of dumping the user back to Feed.
- File: [src/app/(protected)/gallery.tsx](src/app/(protected)/gallery.tsx)
	Preserves compose state while selecting gallery media.
- File: [src/app/(protected)/audio-record.tsx](src/app/(protected)/audio-record.tsx)
	Keeps the in-app audio-record flow inside the same compose round-trip.
- File: [src/app/(protected)/post/uploading.tsx](src/app/(protected)/post/uploading.tsx)
	Clears the saved draft only after a successful upload completes.
- File: [src/models/constants.ts](src/models/constants.ts)
	Stores the per-user draft key.

---

## Feature 5: Unread Signals Now Clear At The Right Time

### The Problem

Unread behavior had become too eager. Simply making a post card visible could clear message or private-note unread state, and hosts could leave post detail while unread conversation or note indicators were still active.

### The Solution

Unread reaction state now clears only after leaving Post Detail, while unread conversation messages and private notes stay active until the user opens the relevant detail views. For hosts, leaving Post Detail with unread messages or private notes now shows a warning modal with a safe path to review immediately, exit anyway, or permanently disable the warning.

### Technical Detail

- File: [src/app/(protected)/post/[id].tsx](src/app/(protected)/post/[id].tsx)
	Coordinates the host leave-warning modal, post-detail unread handling, and reaction-notification dismissal for the current post.
- File: [src/hooks/useAuthorPostActivity.ts](src/hooks/useAuthorPostActivity.ts)
	Separates reaction-seen behavior from conversation/private-note unread tracking so visibility alone does not over-clear activity.
- File: [src/app/(protected)/conversation.tsx](src/app/(protected)/conversation.tsx)
	Writes the conversation last-seen timestamp only when the conversation screen is actually opened.
- File: [src/models/constants.ts](src/models/constants.ts)
	Stores the leave-warning dismissal key and conversation last-seen key.

---

## Feature 6: Authors Can Fully Edit Published Posts

### The Problem

After publishing, authors had no way to correct or improve a post. Text, tier, circle, media order, captions, and attachments were all locked. There was also no audit signal for authors that a post had been edited.

### The Solution

Post Detail now includes an author-only edit action. The composer opens in edit mode with existing content prefilled, and authors can change all post content (text, tier, circle, media order, captions, add/remove attachments). During save, removed existing attachments are only removed from the post after Firebase Storage deletion succeeds; if deletion fails, the edit is blocked and no partial media removal is committed. Edited posts now store `lastEditedAt`, and only the author sees a "Last edited" timestamp in Post Detail.

### Technical Detail

- File: [src/app/(protected)/post/[id].tsx](src/app/(protected)/post/[id].tsx)
	Adds author-only edit entry point and author-only `lastEditedAt` display.
- File: [src/app/(protected)/post/new.tsx](src/app/(protected)/post/new.tsx)
	Adds edit mode hydration for existing post data and preserves edit context through media routes.
- File: [src/app/(protected)/post/uploading.tsx](src/app/(protected)/post/uploading.tsx)
	Supports create vs edit execution paths and edit-specific success/error copy.
- File: [src/store/actions/postActions.ts](src/store/actions/postActions.ts)
	Adds `editPostContent` thunk with upload/retain/remove media logic and `lastEditedAt` updates.
- File: [src/services/firebase/storage.ts](src/services/firebase/storage.ts)
	Adds URL-based post-media deletion helper used to verify storage deletion before content removal.
- File: [src/models/types.ts](src/models/types.ts)
	Adds `Post.lastEditedAt: number | null`.
- File: [firestore.rules](firestore.rules)
	Tightens non-author post update rules so reaction/conversation updates cannot mutate content fields like `text`, `media`, `tier`, or `lastEditedAt`.

---

## Feature 7: Cleaner Edit Header And Stronger Audio Recording Workflow

### The Problem

Two parts of post creation/editing still felt rough: edit mode still surfaced a Reset action that did not fit the save-focused intent, and post-detail header controls felt cramped for authors. On top of that, the audio recorder was a one-clip flow with no in-screen playback metadata editing, making multi-clip audio posting slow.

### The Solution

Edit mode now hides Reset entirely, so the top bar stays focused on Cancel and Save. Post Detail now gives the author's edit/delete actions more spacing so taps feel less cramped. Audio recording now supports a true multi-clip flow: up to the attachment limit, per-clip 3-minute cap, persistent timing summaries, in-screen playback preview, and per-recording title/caption editing before returning to Post Create. On iPhone, the screen now also flips the audio session into recording mode before capture starts so the microphone reliably begins recording on the first tap.

### Technical Detail

- File: [src/app/(protected)/post/new.tsx](src/app/(protected)/post/new.tsx)
	Hides Reset in edit mode and threads audio title through media preview state.
- File: [src/app/(protected)/post/[id].tsx](src/app/(protected)/post/[id].tsx)
	Adds extra spacing for author header actions and passes audio titles into post-detail audio cards and full-screen viewer.
- File: [src/app/(protected)/audio-record.tsx](src/app/(protected)/audio-record.tsx)
	Reworks the screen into a multi-record queue with 3-minute auto-stop, clip list management, playback preview, title/caption inputs, and explicit iOS audio-mode switching before and after capture.
- File: [src/components/AudioAttachmentPlayer.tsx](src/components/AudioAttachmentPlayer.tsx)
	Adds optional title rendering so named audio clips display consistently in feed/detail/full-view contexts.
- File: [src/components/MediaViewerModal.tsx](src/components/MediaViewerModal.tsx)
	Supports forwarding audio titles to the full-view audio player.
- File: [src/components/PostCreateMediaUploader.tsx](src/components/PostCreateMediaUploader.tsx)
	Extends draft media typing for audio title/duration metadata.
- File: [src/components/PostCard.tsx](src/components/PostCard.tsx)
	Passes audio titles through media viewer state and inline audio cards.
- File: [src/store/actions/postActions.ts](src/store/actions/postActions.ts)
	Persists audio titles during upload and edit paths so saved posts retain recording names.
- File: [src/models/types.ts](src/models/types.ts)
	Adds `MediaItem.title: string | null` for persisted post media.

---

## Cross-Cutting Changes

- **AsyncStorage state is now versioned and scoped more deliberately.** Notification-release notices, conversation hints, conversation last-seen timestamps, host leave-warning preferences, and post-create drafts all use named constants in [src/models/constants.ts](src/models/constants.ts).
- **Conversation state is now more intentionally local to the conversation screen.** Reply hints, depth warnings, join-conversation gating, and thread layout all live together in [src/app/(protected)/conversation.tsx](src/app/(protected)/conversation.tsx), making future conversation work easier to reason about.
- **The compose round-trip is now a true multi-screen workflow instead of separate dead ends.** Camera, gallery, audio record, and upload-complete behavior all now preserve or clear the same draft source of truth.

---

## User-Facing Impact

| Feature | Benefit | Where |
|---|---|---|
| Separate reaction, message, and reply switches | Users can choose exactly which post activity should ping them | Notification Settings |
| Joined-circle bulk toggles | Faster tuning for circle-specific post alerts | Post Notification Settings |
| Threaded replies and quoted context | Conversation threads are easier to read and respond to | Conversation |
| Local draft persistence and safe return paths | Users stop losing half-finished posts while moving through media flows | Post Create, Camera, Gallery, Audio Record |
| Safer unread behavior for hosts | Important message/private-note indicators stay visible until actually reviewed | Post Detail, Conversation, Private Notes |
| Full post editing after publish | Authors can fix and improve posts without reposting | Post Detail, Post Create, Uploading |
| Multi-clip audio recording with titles | Recording audio for posts is faster, clearer, and easier to organize | Audio Record, Post Create, Post Detail, Feed |

---

## Testing Checklist

- [ ] Visit Notifications with a pending release notice dot on the feed bell -> the bell dot clears, but the release card remains until Notification Settings is opened.
- [ ] Toggle Reaction Notifications, Message Notifications, and Reply Notifications on and off -> each setting saves and affects delivery behavior correctly.
- [ ] Open Post Notification Settings with joined circles from multiple hosts -> circles are grouped by host and owned circles do not appear.
- [ ] Use both the group-level and per-circle Enable All switches -> all toggles update together and fall back to Big News only when turned off.
- [ ] In Conversation, long-press a message to reply -> the reply banner appears and the reply posts directly under its parent.
- [ ] Double tap one of your own messages -> edit mode opens, the composer is prefilled, and saving updates that existing message instead of posting a new one.
- [ ] Start typing a fresh draft, then double tap one of your older messages -> confirmation appears before the draft is cleared and edit mode begins.
- [ ] Reply to a reply until the thread depth limit is reached -> the warning appears and no deeper reply state is entered.
- [ ] Start a post, add text/media/status, then open and close Camera, Gallery, and Audio Record -> Post Create restores the same draft each time.
- [ ] Reset a draft -> confirmation appears before anything is cleared.
- [ ] Publish a draft successfully -> reopening Post Create does not restore the old draft.
- [ ] As a host with unread messages or private notes, leave Post Detail -> warning modal appears with Review now, Exit Post Anyway, and Don't show this again options.
- [ ] Open Post Detail without opening Conversation or Private Notes -> only reaction unread clears; message/private-note unread stays active.
- [ ] As post author, open Post Detail and tap Edit -> composer is prefilled and save updates the existing post.
- [ ] Remove an existing attachment during edit while storage deletion is blocked -> save fails and attachment remains on the post.
- [ ] As non-author, open the same post -> no edit action and no "Last edited" timestamp are shown.
- [ ] In edit mode, confirm the Reset action is hidden while Cancel and Save remain visible.
- [ ] In Post Detail, confirm there is extra visual/tap spacing between the author edit and delete actions.
- [ ] In Audio Record, record multiple clips (up to file limit), verify each clip auto-stops at 90 seconds max, and confirm total timing stays visible.
- [ ] Add title and caption to at least one recorded clip, use recordings in a post, then confirm title appears in audio players and caption appears in media viewer.

---

## Files Changed

| File | Purpose |
|---|---|
| `src/app/(protected)/notification-settings.tsx` | New top-level reaction, message, and reply controls |
| `src/app/(protected)/notifications.tsx` | Release notice card for notification controls |
| `src/app/(protected)/feed.tsx` | Feed-bell release notice badge behavior |
| `src/app/(protected)/post-notification-settings.tsx` | Joined-circle grouping and bulk notification toggles |
| `src/app/(protected)/conversation.tsx` | Threaded conversation ordering, reply hint, and seen-state handling |
| `src/components/conversation/ConversationMessage.tsx` | Connected thread-line rendering, reply context UI, and double-tap edit gesture |
| `src/store/actions/conversationActions.ts` | Send/edit conversation actions with optimistic updates |
| `src/app/(protected)/post/new.tsx` | Draft persistence, reset confirmation, and compose recovery |
| `src/app/(protected)/camera.tsx` | Return captured media back into Post Create |
| `src/app/(protected)/gallery.tsx` | Preserve compose state during gallery selection |
| `src/app/(protected)/audio-record.tsx` | In-app audio recording return path into Post Create |
| `src/app/(protected)/post/uploading.tsx` | Draft cleanup only after successful upload |
| `src/app/(protected)/post/[id].tsx` | Host leave-warning modal and post-detail unread handling |
| `src/store/actions/postActions.ts` | Full post-edit thunk and media deletion verification before removal |
| `src/services/firebase/storage.ts` | Storage delete helper for existing post attachments |
| `src/models/types.ts` | Adds `Post.lastEditedAt` field |
| `src/app/(protected)/audio-record.tsx` | Multi-clip audio recording flow with per-clip metadata editing |
| `src/components/AudioAttachmentPlayer.tsx` | Audio title display support |
| `src/components/MediaViewerModal.tsx` | Audio title plumbing for full-view playback |
| `firestore.rules` | Prevents non-author update paths from mutating editable post content fields |
| `src/hooks/useAuthorPostActivity.ts` | Correct unread separation across reaction/message/private-note activity |
| `src/models/constants.ts` | Shared AsyncStorage keys and notification/draft versions |

---

## Summary

**For users:** this branch makes Angelia feel more trustworthy. Notifications are more specific, conversations are easier to follow, posts are much harder to lose while composing, and unread markers now stick around until the right screen is actually reviewed.

**For maintainers:** the branch consolidates user-preference and transient UI state into named constants, keeps notification-release logic versioned, and turns compose recovery into a single consistent flow across camera, gallery, audio, and upload completion.

**For reviewers:** the main themes to inspect are settings persistence, thread rendering order, draft hydration/cleanup, and the exact moments unread state is cleared.

---

## Feature: Reactions Seen Only on Post Detail

### The Problem

Scrolling past a post card in Post Activity marked new reactions as reviewed even when the host never opened post detail. That made the unread badge disappear too early.

### The Solution

Reaction unread now clears only when the host opens post detail and leaves the screen. Post Activity card visibility no longer writes seen state.

### Technical Detail

- File: [src/app/(protected)/post-activity.tsx](src/app/(protected)/post-activity.tsx)
	Removed viewability-based `markPostsSeen` and blur flush.
- File: [src/app/(protected)/post/[id].tsx](src/app/(protected)/post/[id].tsx)
	Marks reaction inbox items read on blur when leaving post detail.

---

## Feature: Expiring-Soon Filters

### The Problem

Posts nearing expiry (daily 3-day / custom 7-day warning window) were hard to spot in a busy feed or Post Activity list.

### The Solution

Post Activity adds an **Expiring soon** scope filter with soonest-first sort. Feed adds a quick-action pill for unreacted expiring posts and a filter-menu toggle for all expiring posts in scope.

### Technical Detail

- File: [src/lib/post/post.utils.ts](src/lib/post/post.utils.ts)
	`isPostExpiringSoon()` and `hasUserReactedToPost()` helpers.
- File: [src/app/(protected)/post-activity.tsx](src/app/(protected)/post-activity.tsx)
	Expiring scope filter and sort.
- File: [src/app/(protected)/feed.tsx](src/app/(protected)/feed.tsx)
	Expiring quick filter on its own row (dashed outline) below status pills; filter menu integration.
- File: [docs/2026/06/08/ACTIVITY_EXPIRY_INBOX.md](../../docs/2026/06/08/ACTIVITY_EXPIRY_INBOX.md)
	Durable feature reference for inbox, expiry, and reaction-seen behavior.
- File: [src/components/FeedChannelFilterModal.tsx](src/components/FeedChannelFilterModal.tsx)
	`expiringSoonOnly` toggle on apply.

---

## Feature: User Inbox and Post-Grouped Notifications

### The Problem

Unread for reactions, messages, and private notes was computed client-side with per-post Firestore listeners and AsyncStorage seen keys. That was expensive at scale and hard to keep consistent across screens.

### The Solution

A `userInbox` collection drives unread state from a single listener. Cloud Functions write inbox items when notifications fire. Post Activity and Notifications read from Redux selectors; mark-read happens when the user visits the right screen (post detail, conversation, private notes). Notifications adds an **Activity** section that groups inbox items by post.

### Technical Detail

- File: [functions/src/index.ts](functions/src/index.ts)
	`writeUserInboxItem` on notification send; surface routing and reaction dedupe.
- File: [firestore.rules](firestore.rules)
	Rules for `userInbox/{userId}/items/{itemId}`.
- File: [src/store/slices/userInboxSlice.ts](src/store/slices/userInboxSlice.ts)
	Inbox Redux slice.
- File: [src/store/crossSelectors/userInboxSelectors.ts](src/store/crossSelectors/userInboxSelectors.ts)
	Grouped unread selectors for Post Activity and Notifications.
- File: [src/hooks/dataListeners/useDataListenerRealtimeData.ts](src/hooks/dataListeners/useDataListenerRealtimeData.ts)
	Single `subscribeToUserInbox`; removed global per-authored-post message/note listeners.
- File: [src/app/(protected)/notifications.tsx](src/app/(protected)/notifications.tsx)
	Activity section with post-grouped inbox rows.
- File: [src/providers/AuthorPostActivityProvider.tsx](src/providers/AuthorPostActivityProvider.tsx)
	Thin wrapper over inbox selectors (no AsyncStorage).

---

## Feature: Message Actions + Message Reactions (v1.0.10)

### The Problem

Conversation message interactions were split across hidden gestures, and private note replies had no matching action model. Users could not react to individual replies, and message deletion support was missing.

### The Solution

Both Conversation and Private Note Thread screens now use one unified message action entry (long-press or ⋯ button). That action sheet supports reply/react/edit/delete based on context. Message-level emoji reactions now work inline with optimistic updates, and reaction chips show who reacted.

### Technical Detail

- File: [src/hooks/useMessageActions.ts](src/hooks/useMessageActions.ts)  
	Shared action orchestration for conversation and private-note message flows.
- File: [src/components/conversation/MessageActionSheet.tsx](src/components/conversation/MessageActionSheet.tsx)  
	Unified action surface for Reply/React/Edit/Delete.
- File: [src/components/conversation/MessageReactionRow.tsx](src/components/conversation/MessageReactionRow.tsx)  
	Inline reaction chips showing counts and participant names.
- File: [src/components/conversation/ConversationMessage.tsx](src/components/conversation/ConversationMessage.tsx)  
	Adds ⋯ action button, avatar profile-open tap handling, and inline reactions.
- File: [src/store/actions/conversationActions.ts](src/store/actions/conversationActions.ts)  
	Adds optimistic message reaction toggles and delete thunk for conversation messages.
- File: [src/store/actions/privateNoteThreadActions.ts](src/store/actions/privateNoteThreadActions.ts)  
	Adds optimistic edit/reaction/delete thunks for private-note thread replies.
- File: [src/store/slices/conversationSlice.ts](src/store/slices/conversationSlice.ts)  
	Adds optimistic reducers for message reactions and deletes.
- File: [src/store/slices/privateNotesSlice.ts](src/store/slices/privateNotesSlice.ts)  
	Adds optimistic reducers for private-note thread edit/reaction updates.
- File: [src/services/firebase/firestore.ts](src/services/firebase/firestore.ts)  
	Adds message reaction toggle + delete operations for both conversation and private-note thread paths.
- File: [firestore.rules](firestore.rules)  
	Allows participant reaction updates and author-only (non-system) message deletes for both message subcollections.

---

# PR 80 Fix Log (Live)

Last updated: 2026-05-16

## Scope
- Fix review issues raised during PR 80 deep review.
- Track what changed, why, and how as work lands.

## In Progress
- [x] Remove production debug logs from conversation-edit flow.
- [x] Make message edit optimistic flow rollback-safe.
- [x] Prevent media data loss in post edit by reordering delete/update steps.
- [x] Replace newly introduced any usages with concrete types.
- [x] Align Firestore message-edit rule with non-system intent.
- [x] Refresh beta update modal content/version for this release cycle.

## Change Entries
- Work started. Opened all target files and validated issue locations from review findings.
- Removed conversation edit debug logging in screen/thunk/Firestore update path to reduce production log noise while preserving user-facing toasts.
- Added optimistic edit rollback in conversation thunk: captures previous text and restores it when Firestore update fails.
- Reordered post-edit media deletion flow: removed media is now deleted from Storage only after post document update succeeds (best-effort cleanup), preventing broken post media on save failures.
- Replaced newly added any types with explicit types:
	- Navigation beforeRemove event + pending action refs in post detail.
	- Layout/gesture event types in AudioAttachmentPlayer.
	- Queue helper dispatch params in post actions now use AppDispatch.
- Tightened Firestore rules for message edits so isSystem must remain unchanged during text-only updates.
- Refreshed beta modal copy to reflect this release and bumped BETA_UPDATE_VERSION to 2026-05-16-beta-v1.0.7.
- Removed remaining ConversationEdit debug logs from ConversationMessage press/double-tap detection.
- Adjusted upload queue helper dispatch typing to Dispatch<UnknownAction> to keep explicit typing without thunk generic mismatch errors.
- Updated beta modal copy direction: audio is now framed as a new user feature, post-activity notification controls explicitly mention reactions/messages, and dev-facing announcement targeting copy was removed.
- Softened upload copy in BetaUpdateModal to be less technical and added explicit user guidance to stay in-app during uploads because uploads pause in background.
- Refactored Firestore message-edit rule to use optionalFieldUnchanged('isSystem') instead of inline optional-field comparison logic.
- Fixed feed filtering-spinner false positive on return-to-feed by splitting mount guards: cold-launch init and filter-change effect now use separate refs.
- Fixed feed header auto-hide on restored scroll position by priming initial scroll Y and only animating hide/show during user-driven drag/momentum scroll.
- Hardened Android toast close behavior: increased swipe-intent thresholds and dismisses now trigger on close-button press-in to avoid gesture-cancelled taps.
- Added per-toast autoDismissMs support and set the "Your post is live!" foreground toast to auto-dismiss in ~2.2s as a fallback when swipe close fails.
- Navigation flow tightened:
	- Leaving Conversation/Private Notes now always routes back to Post Details.
	- Leaving Post Details now always routes to Feed with stack clear so users cannot back-navigate into stale detail screens.

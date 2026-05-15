# Testing Guide — Haptics, GIF Fix, Scroll-to-Top, Media Reorder, Captions & MP3

**Branch:** beta-v-1.0.7
**Last updated:** May 15, 2026

---

## Device Setup

**Primary:** Android (used for all standard testing)  
**Secondary:** iPhone (used when two users/devices are needed, or when iOS-specific behavior is likely)

> **When to pull out the iPhone:**
> - Testing a feature that involves two different user accounts simultaneously
> - Testing a feature that likely behaves differently on iOS (pickers, keyboard, safe area, haptics)
> - Confirming a bug fix works on both platforms before closing it out

---

## Feature 1: Haptic Feedback

**Devices:** Android primary. Pull out iPhone if haptics feel wrong — iOS and Android have different haptic engines.

### Android

- [ ] Long-press any post on the feed → feel a medium pulse at the moment the action fires (not after, not before)
- [ ] Confirm the card scale animation also plays (the two are combined)
- [ ] Open the reaction peel on a post (long-press → reaction strip appears)
- [ ] Tap each emoji in the peel → feel a light tap on each one
- [ ] Confirm no haptic fires when simply scrolling the feed (no false triggers)
- [ ] Confirm no haptic fires when tapping to navigate to a post detail (long-press only)

### iPhone (if needed)

- [ ] Repeat the long-press and emoji-tap tests above
- [ ] Confirm haptics feel appropriate — iOS tends to be more pronounced than Android; if it feels too strong, note it

---

## Feature 2: GIF Playback

**Devices:** Android primary. iPhone if you want to confirm the fix holds across both platforms.

### Setup
You'll need a post with a GIF attachment. Either:
- Create a test post with a `.gif` file from your gallery, or
- Find an existing post that has a GIF already uploaded

### Android

- [ ] Open the feed and scroll to a post with a GIF
- [ ] Confirm the GIF animates (multiple frames play) — it should not be a frozen still frame
- [ ] Scroll the GIF post out of view and back in — confirm animates correctly after scroll-back (doesn't freeze on return)
- [ ] Scroll through a feed with multiple GIFs — confirm all of them animate, not just the first visible one
- [ ] Tap a GIF post to open post detail — confirm GIF still animates in the detail view

---

## Feature 3: Feed Scroll-to-Top on Cold Launch

**Devices:** Android primary.

> **Cold launch** = opening the app after it was fully backgrounded (swiped away from recents, or device restarted). Simply navigating away and back is not a cold launch.

### Android

- [ ] Force-stop the app (swipe from recents or use developer settings → Force Stop)
- [ ] Scroll the feed down a bit in your head (confirm you remember approximate position)
- [ ] Reopen the app → feed should jump to the top automatically (no manual scroll needed)
- [ ] Confirm the jump happens quickly and not jarringly (animated: false means instant, no flicker)

**Confirm "once per session" behavior:**
- [ ] After the auto-scroll fires on launch, scroll down manually
- [ ] Navigate away (e.g. tap Profile, tap back)
- [ ] Confirm the feed does NOT auto-scroll again — it should stay where you left it

**Confirm re-triggers on next cold launch:**
- [ ] Background the app (don't force-stop, just go to home screen or switch apps)
- [ ] Reopen the app → since the flag is cleared on background, it should scroll to top again
- [ ] Confirm this works consistently across multiple background/reopen cycles

---

## Feature 4: Media Reorder

**Devices:** Android primary.

### Setup
Select 3+ photos or videos when creating a new post so you have items to reorder.

### Android

- [ ] Open the post composer ("+" button)
- [ ] Attach 3 photos (or videos, or a mix)
- [ ] Confirm they appear in the media strip in the order you selected them
- [ ] Long-press the second thumbnail → reorder mode activates (left/right chevron arrows appear, selected item gets a highlight)
- [ ] Tap the left arrow → item moves one position left, arrows update to reflect new position
- [ ] Tap the right arrow → item moves one position right
- [ ] For the first item (position 0) → confirm left arrow is visually disabled and does nothing
- [ ] For the last item → confirm right arrow is visually disabled and does nothing
- [ ] Tap outside the reorder overlay → reorder mode exits, normal state restored
- [ ] Reorder items and then post → confirm the post shows media in the reordered sequence (not original picker order)

**Edge cases:**
- [ ] Reorder with 2 items (boundary positions, not just middle)
- [ ] Reorder a video — thumbnail should move correctly; video should still play from the new position
- [ ] Reorder, then add more media — new item appends at end, existing order preserved

---

## Feature 5: Media Captions

**Devices:** Android primary. iPhone warranted — keyboard behavior in bottom sheets differs significantly between platforms.

### Composer — adding captions (Android)

- [ ] Open the post composer and attach a photo
- [ ] On the thumbnail, tap the small icon in the bottom-left corner → caption modal slides up
- [ ] Type a caption (keep it under 300 characters)
- [ ] Confirm character counter updates as you type (e.g. "42/300")
- [ ] Tap **Save** → modal closes; 📝 badge appears on the thumbnail
- [ ] Tap the 📝 badge again → modal reopens with the previously saved caption pre-filled
- [ ] Edit the caption and save again → badge remains; correct new text is stored
- [ ] Open the caption modal → tap **Remove** → modal closes; 📝 badge disappears from thumbnail
- [ ] Add a caption, then delete the media item → no stale captions remain in state (verify by re-adding media)

**Character limit:**
- [ ] Try to type past 300 characters → input stops accepting new characters; counter shows 300/300

**Keyboard behavior (Android):**
- [ ] Caption modal opens → keyboard appears; sheet lifts up above keyboard without clipping
- [ ] Dismiss keyboard (tap outside input or system back) → sheet returns to normal position cleanly; no gap between bottom of sheet and screen edge

### Composer — captions on iPhone

- [ ] Repeat the add/save/remove/reopen flow above
- [ ] Keyboard behavior: on iOS, `KeyboardAvoidingView behavior='padding'` is used — confirm the sheet lifts correctly above keyboard
- [ ] Dismiss keyboard → no residual gap or layout jump

### Feed display — caption badge

- [ ] Create and post a photo with a caption
- [ ] Find the post in the feed → confirm 📝 badge appears on the thumbnail in the post card
- [ ] Find a post with no captions → confirm no badge appears

### Full-screen viewer — caption overlay

- [ ] Tap on a media item with a caption (in the feed or post detail) → full-screen viewer opens
- [ ] Confirm the caption text appears as an overlay near the bottom of the screen
- [ ] Confirm it doesn't overlap the close button or get clipped by the home bar
- [ ] Tap on a media item without a caption → full-screen viewer opens with no caption text visible

**Multi-image post:**
- [ ] Create a post with 3 photos, add captions to photos 1 and 3 only
- [ ] In the feed, swipe through the carousel → badges on photos 1 and 3, none on photo 2
- [ ] Open each photo in the viewer:
	- Photo 1: caption shows
	- Photo 2: no caption
	- Photo 3: caption shows

---

## Feature 6: MP3 Audio Attachments

**Devices:** Android primary. Use iPhone for parity check because audio session and silent-mode behavior can differ.

### Composer + picker flow

- [ ] Open post composer
- [ ] Tap the new music icon in the bottom toolbar
- [ ] Confirm gallery screen opens in **Select MP3** mode
- [ ] Pick 1–3 `.mp3` files
- [ ] Confirm audio tiles appear in the selected grid with a music icon and filename
- [ ] Tap **Done** and return to post composer
- [ ] Confirm audio attachments appear in the media strip as audio cards (not broken image thumbnails)

### Posting + feed rendering

- [ ] Publish a post containing at least one MP3 attachment
- [ ] Open feed and find the new post
- [ ] Confirm audio attachment renders as an audio card (play/pause control + timer)
- [ ] Tap play in feed card → audio starts
- [ ] Tap pause → audio pauses

### Post detail + full-screen viewer

- [ ] Open the post detail screen for the audio post
- [ ] Confirm audio card appears in post detail
- [ ] Tap the card to open full-screen media viewer
- [ ] Confirm viewer renders audio UI (not image/video)
- [ ] For local-file previews in compose flow, confirm waveform appears when available
- [ ] For remote uploaded audio, confirm fallback progress bar appears and playback still works

### iPhone parity checks

- [ ] Repeat picker → post → playback flow on iPhone
- [ ] Confirm audio plays even with iOS silent switch enabled
- [ ] Confirm play/pause state and timers update correctly

---

## Feature 7: Private Circles (Custom Circle Privacy Controls)

**Devices:** Android primary. iPhone recommended for two-account parity checks.

### Setup
- [ ] Use three accounts for clean coverage:
	- Account A (host): creates circles
	- Account B (member): joins host's private circle
	- Account C (stranger): not subscribed to host circles
- [ ] In Account A, create one public custom circle and one private custom circle

### Android

- [ ] In create/edit circle form, confirm Private toggle exists and defaults to OFF for new circles
- [ ] Create with Private ON and confirm circle card shows `🔒 Private`
- [ ] Edit same circle to Private OFF and back ON; confirm badge visibility updates correctly each save
- [ ] As Account B (non-host member), open private circle details and confirm invite link/QR section is hidden
- [ ] As Account A (host), open same private circle details and confirm invite link/QR section is visible
- [ ] As Account C, open Account A's post detail and leave the page; confirm private circle is not suggested while public circle can be
- [ ] In My Circles, confirm one-time private-circles notice appears
- [ ] Tap Learn more and confirm explanation modal opens
- [ ] Dismiss via Got it! and confirm notice does not reappear on revisit
- [ ] Reset storage, reopen notice, dismiss via X, and confirm notice still remains dismissed afterward

### iPhone (recommended)

- [ ] Repeat host vs non-host private invite visibility checks
- [ ] Repeat post-leave suggestion filtering check
- [ ] Repeat one-time notice display and dismissal behavior

---

## Regression Checks

Run these after all feature tests to confirm nothing was broken.

### Circles Core Behavior

- [ ] Creating a normal public custom circle still works end-to-end
- [ ] Editing circle name/description/color still works for host
- [ ] Leaving a custom circle still works with confirmation flow
- [ ] Deleting a custom circle as host still works with confirmation flow

### Invites + Membership

- [ ] Public circle invite links still work as before
- [ ] Private circle join still works when host shares invite
- [ ] Member list renders correctly for both public and private circles

### Feed + Post Detail

- [ ] Feed loads and scrolls normally
- [ ] Post detail opens/closes normally
- [ ] Exiting post detail no longer suggests private circles
- [ ] Leaving post detail can still suggest eligible public circles

---

## Known Limitations / Notes

- **Reorder is MVP** — it uses chevron arrows rather than drag-and-drop. This is intentional for this release. Drag-and-drop can be added later.
- **Captions are stored in Firestore** as part of the `MediaItem` array. If a post was created before this release, `caption` will be `null` — that's handled gracefully everywhere.
- **GIF fix** skips `recyclingKey` for GIFs only. Non-GIF images retain the key for performance.
- **Audio waveform** is shown for local `file://` paths; remote uploaded audio uses progress fallback in the current implementation.
- **Scroll-to-top** fires after 300ms to give the feed data time to load. If the feed is very slow, the scroll may fire before posts are ready (acceptable edge case for now).
- Existing channels without `isPrivate` are treated as public (`null`/falsy behavior).
- Daily circles remain effectively public behavior in this release (`isPrivate: false` at creation).
- Firestore docs now persist `isPrivate`; ensure old test data is recreated if behavior seems inconsistent.

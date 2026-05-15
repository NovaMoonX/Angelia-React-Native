# Testing Guide — Haptics, GIF Fix, Scroll-to-Top, Media Reorder & Captions

**Branch:** copilot/haptics-media-reorder-captions-gif-fix  
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

## Regression Checks

Run these after all feature tests to confirm nothing was broken.

### Feed

- [ ] Feed loads and scrolls normally
- [ ] Long-press still opens the reaction peel (haptics are additive, not replacing)
- [ ] Reaction peel still dispatches the selected emoji when tapped
- [ ] Navigating to post detail still works via a normal tap
- [ ] Images in the feed load correctly (no broken images from recyclingKey changes)

### Post Composer

- [ ] Can still create a text-only post
- [ ] Can still attach media (photo + video) without adding captions
- [ ] Can still remove media from the strip
- [ ] Media strip scrolls horizontally when more than ~3 items
- [ ] Post submits and navigates to the uploading screen correctly

### Media Viewer

- [ ] Opening any image in full-screen works
- [ ] Opening any video in full-screen works; video plays
- [ ] Closing the viewer returns to the correct screen

---

## Known Limitations / Notes

- **Reorder is MVP** — it uses chevron arrows rather than drag-and-drop. This is intentional for this release. Drag-and-drop can be added later.
- **Captions are stored in Firestore** as part of the `MediaItem` array. If a post was created before this release, `caption` will be `null` — that's handled gracefully everywhere.
- **GIF fix** skips `recyclingKey` for GIFs only. Non-GIF images retain the key for performance.
- **Scroll-to-top** fires after 300ms to give the feed data time to load. If the feed is very slow, the scroll may fire before posts are ready (acceptable edge case for now).

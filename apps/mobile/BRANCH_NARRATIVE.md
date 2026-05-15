# Haptics, GIF Fix, Scroll-to-Top, Media Reorder, Captions & MP3 Support — Branch Narrative

**Branch:** copilot/haptics-media-reorder-captions-gif-fix  
**Date:** May 2026  
**Theme:** Expressive interactions and richer media storytelling

---

## Story Overview

This branch focuses on making Angelia feel more alive and more creator-friendly. We improved tactile feedback, fixed GIF playback reliability, made feed entry behavior more intentional, gave creators control over media order and per-item captions, and now added MP3 audio support so posts can include voice clips and audio snippets.

---

## Feature 1: Haptic Feedback

### The Problem
Post interactions felt flat. Long-pressing and reaction taps had visual changes but no tactile acknowledgement.

### The Solution
- Long-pressing a post triggers medium-impact haptic feedback.
- Tapping an emoji reaction triggers light-impact haptic feedback.

### Technical Detail
- [src/components/PostCard.tsx](src/components/PostCard.tsx): medium haptic in `handleCardLongPress`
- [src/components/ReactionPill.tsx](src/components/ReactionPill.tsx): light haptic before `onSelect(emoji)`
- Dependency: `expo-haptics`

---

## Feature 2: GIF Playback Fix

### The Problem
GIFs could appear frozen on the first frame in list contexts due to view recycling.

### The Solution
Skip `recyclingKey` for GIF sources so animated images are re-instantiated and play correctly.

### Technical Detail
- [src/components/PostCard.tsx](src/components/PostCard.tsx): no `recyclingKey` when `url` ends with `.gif`
- [src/app/(protected)/post/new.tsx](src/app/(protected)/post/new.tsx): no `recyclingKey` when `type === 'image/gif'`

---

## Feature 3: Feed Scroll-to-Top on Cold Launch

### The Problem
Users could reopen the app and land deep in old scroll position instead of immediately seeing fresh feed content.

### The Solution
Auto-scroll to the top once per active session and reset this behavior when the app backgrounds.

### Technical Detail
- [src/models/constants.ts](src/models/constants.ts): `FEED_SESSION_SCROLLED_KEY`
- [src/app/(protected)/feed.tsx](src/app/(protected)/feed.tsx): mount-time top-scroll effect + flag write
- [src/components/DataListenerWrapper.tsx](src/components/DataListenerWrapper.tsx): clear flag when app state changes to background

---

## Feature 4: Media Reorder

### The Problem
Creators had no way to fix media order after selection.

### The Solution
Long-press a media thumbnail to enter reorder mode and move items left/right.

### Technical Detail
- [src/app/(protected)/post/new.tsx](src/app/(protected)/post/new.tsx):
  - `reorderIndex` state
  - `moveMedia()` swaps entries in `media`, `videoThumbnails`, and `thumbnailsRef`
  - `FlashList` replaced by horizontal `ScrollView` for simpler reorder overlays

---

## Feature 5: Media Captions

### The Problem
Posts lacked per-media context when multiple photos/videos were attached.

### The Solution
Each attachment can now hold an optional caption. Composer shows a caption control and badge, and the full-screen viewer displays the caption.

### Technical Detail
- Type updates:
  - [src/models/types.ts](src/models/types.ts): `MediaItem.caption: string | null`
  - [src/components/PostCreateMediaUploader.tsx](src/components/PostCreateMediaUploader.tsx): `MediaFile.caption: string | null`
- Data flow updates:
  - [src/app/(protected)/camera.tsx](src/app/(protected)/camera.tsx): `caption: null` when creating media
  - [src/app/(protected)/gallery.tsx](src/app/(protected)/gallery.tsx): `caption: null` when creating media
  - [src/store/actions/postActions.ts](src/store/actions/postActions.ts): caption persisted in `readyMedia`
- UI updates:
  - [src/app/(protected)/post/new.tsx](src/app/(protected)/post/new.tsx): caption modal and thumbnail badges
  - [src/components/PostCard.tsx](src/components/PostCard.tsx): caption badge on media
  - [src/components/MediaViewerModal.tsx](src/components/MediaViewerModal.tsx): caption overlay in full-screen viewer

---

## Feature 6: MP3 Audio Attachments

### The Problem
Posts supported only images/videos. Users couldn’t share quick voice notes or short audio clips.

### The Solution
Added MP3 attachment support to composer, upload pipeline, feed/detail rendering, and full-screen viewer.

### Technical Detail
- Dependencies:
  - `expo-audio`
  - `@simform_solutions/react-native-audio-waveform`
  - `expo-document-picker`
- App config / session:
  - [app.config.js](app.config.js): `expo-audio` plugin with microphone permission text
  - [src/app/_layout.tsx](src/app/_layout.tsx): `setAudioModeAsync({ playsInSilentMode: true })`
- Model and upload:
  - [src/models/types.ts](src/models/types.ts): `MediaItem.type` now includes `'audio'`
  - [src/store/actions/postActions.ts](src/store/actions/postActions.ts): MIME mapping now emits `'audio'` for `audio/*`
- Audio selection and compose flow:
  - [src/app/(protected)/post/new.tsx](src/app/(protected)/post/new.tsx): audio toolbar action, audio thumbnail card, audio preview routing
  - [src/app/(protected)/gallery.tsx](src/app/(protected)/gallery.tsx): `pickMode=audio` + MP3 picking via `expo-document-picker`
- Playback/UI:
  - [src/components/AudioAttachmentPlayer.tsx](src/components/AudioAttachmentPlayer.tsx): reusable audio player with `expo-audio`; local-file waveform (Simform static mode) and remote progress fallback
  - [src/components/PostCard.tsx](src/components/PostCard.tsx): audio card in feed posts
  - [src/app/(protected)/post/[id].tsx](src/app/(protected)/post/[id].tsx): audio card in post detail
  - [src/components/MediaViewerModal.tsx](src/components/MediaViewerModal.tsx): full-screen audio handling

---

## Cross-Cutting Changes

| Concern | What changed |
|---|---|
| Media model | `MediaItem.type` expanded to include `audio`; captions remain nullable and explicit |
| Upload mapping | MIME-to-domain conversion now handles `audio/*` |
| Media viewer | Full-screen modal now supports image, video, and audio |
| Composer picker | Gallery route can now run in image/video mode or MP3 mode |
| Audio session | App startup sets audio mode for silent-mode playback |

---

## User-Facing Impact

| Feature | Benefit | Where |
|---|---|---|
| Haptics | Interactions feel tactile and responsive | Feed + reaction interactions |
| GIF fix | Animated GIFs no longer freeze in list contexts | Feed/composer previews |
| Scroll-to-top | Opens to fresh content after relaunch | Feed |
| Reorder | Creators can fix attachment order before posting | Composer |
| Captions | Better context per attachment | Composer + feed/detail viewer |
| MP3 support | Share and play audio clips in posts | Composer + feed + post detail + full-screen viewer |

---

## Files Changed

| File | Purpose |
|---|---|
| `src/components/PostCard.tsx` | Haptics, GIF handling, captions, audio card rendering |
| `src/components/ReactionPill.tsx` | Haptic feedback on reaction tap |
| `src/components/MediaViewerModal.tsx` | Added audio mode + existing caption overlay |
| `src/components/AudioAttachmentPlayer.tsx` | New reusable audio playback UI |
| `src/components/PostCreateMediaUploader.tsx` | Caption field on `MediaFile` |
| `src/app/(protected)/post/new.tsx` | Reorder, captions, and audio picker/preview integration |
| `src/app/(protected)/gallery.tsx` | Added MP3 selection flow and audio tiles |
| `src/app/(protected)/post/[id].tsx` | Audio media rendering + viewer caption threading |
| `src/app/(protected)/feed.tsx` | Cold-launch scroll-to-top logic |
| `src/components/DataListenerWrapper.tsx` | Session scroll flag reset on background |
| `src/app/_layout.tsx` | Startup audio mode setup |
| `app.config.js` | Added `expo-audio` plugin configuration |
| `src/models/types.ts` | `MediaItem.type` includes `audio`; caption field retained |
| `src/store/actions/postActions.ts` | MIME mapping supports audio media type |

---

## Summary

**For users:** posts feel more responsive, GIFs animate reliably, feed opens where it should, media can be reordered and captioned, and MP3 clips can now be attached and played.

**For maintainers:** media handling is now tri-type (`image | video | audio`) with explicit caption fields and audio session setup centralized at app startup.

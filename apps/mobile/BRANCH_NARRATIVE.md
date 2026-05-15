# Haptics, GIF Fix, Scroll-to-Top, Media Reorder & Captions — Branch Narrative

**Branch:** copilot/haptics-media-reorder-captions-gif-fix  
**Date:** May 2026  
**Theme:** Polish, expressiveness, and creative control

---

## Story Overview

This branch is about **making the app feel more alive and giving creators more control**. Five independent improvements ship together: physical feedback when you interact with posts, GIFs that actually animate, an app that remembers where you want to start, the ability to arrange your media before posting, and captions so every photo or video can tell its story.

---

## Feature 1: Haptic Feedback

### The Problem
Tapping the reaction peel and long-pressing posts felt like interacting with a wall — visually something happens, but there's no physical acknowledgment. On mobile, tactile feedback signals that the app heard you.

### The Solution
- **Long-press a post** on the feed → medium impact haptic fires at the moment the press registers, alongside the existing card-scale animation.
- **Tap an emoji** in the reaction peel → light impact fires before the selection dispatches, making each tap feel crisp.

### Technical Detail
- **Installed:** `expo-haptics`
- **Files:**
  - [PostCard.tsx](src/components/PostCard.tsx) — `import * as Haptics from 'expo-haptics'`; `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` at the top of `handleCardLongPress`
  - [ReactionPill.tsx](src/components/ReactionPill.tsx) — `Haptics.impactAsync(ImpactFeedbackStyle.Light)` fires inside the emoji `onPress` before calling `onSelect(emoji)`
- **Pattern:** Both use `ImpactFeedbackStyle` (not notification; this is a touch, not an alert)

---

## Feature 2: GIF Playback Fix

### The Problem
GIFs uploaded to posts showed as a frozen first frame in the feed. `expo-image` uses a `recyclingKey` prop to reuse image nodes between list renders — but reuse means the animation state is preserved from a prior scroll position (or reset incorrectly), leaving the GIF stuck.

### The Solution
Skip `recyclingKey` for GIFs. Without it, `expo-image` creates a fresh node each time, which resets the animation and lets it play from frame 1.

### Technical Detail
- **File:** [PostCard.tsx](src/components/PostCard.tsx) — `CardMediaItem` image: `recyclingKey={item.url.toLowerCase().endsWith('.gif') ? undefined : item.url}`
- **File:** [new.tsx](src/app/(protected)/post/new.tsx) — media strip thumbnail: `recyclingKey={item.type === 'image/gif' ? undefined : item.uri}`
- **Why two checks:** PostCard uses the already-uploaded `url` string; new.tsx uses the raw `MediaFile.type` from the device picker.

---

## Feature 3: Feed Scroll-to-Top on Cold Launch

### The Problem
When Alice re-opens the app after a few hours, she lands mid-feed — exactly where she left off last session. But she wants to see what's new, and the feed has already loaded fresh posts at the top. She has to manually scroll all the way up.

### The Solution
On cold launch (first mount after the app was backgrounded), the feed scrolls to the top automatically — but only once per session. Opening and closing the notifications panel or navigating between tabs doesn't re-trigger it.

### Technical Detail
- **Constant:** `FEED_SESSION_SCROLLED_KEY = '@angelia/feed_session_scrolled'` added to [constants.ts](src/models/constants.ts)
- **File:** [feed.tsx](src/app/(protected)/feed.tsx) — `useEffect` on mount: reads AsyncStorage for the flag; if absent, schedules `flatListRef.current?.scrollToIndex({ index: 0, animated: false })` after 300ms (allows data to load first), then sets the flag to prevent repeat.
- **File:** [DataListenerWrapper.tsx](src/components/DataListenerWrapper.tsx) — Effect 15: `AppState.addEventListener('change', ...)` removes the flag when the app goes to `background`, so the next cold launch will scroll again.
- **Guard:** Uses the existing `isMountedRef` in feed.tsx so the scroll only fires on the first real mount.

---

## Feature 4: Media Reorder

### The Problem
Bob takes three photos, picks them in the wrong order, and has no way to fix it without canceling and starting over. The FlashList-based media strip in the post composer was read-only.

### The Solution
Long-press any thumbnail in the strip to enter reorder mode. Left/right chevron arrows appear; tap them to swap the item with its neighbor. Tap anywhere else to exit reorder mode.

### Technical Detail
- **File:** [new.tsx](src/app/(protected)/post/new.tsx):
  - Replaced `FlashList` with a horizontal `ScrollView` + manual `.map()` — needed imperative control over item layout for the reorder overlay
  - Added state: `reorderIndex: number | null`
  - Added `moveMedia(fromIndex, direction)`: swaps items in `media` state, `videoThumbnails` record, and `thumbnailsRef` simultaneously so nothing desyncs
  - Long-press on thumbnail → `setReorderIndex(index)`; arrows call `moveMedia`; tapping outside → `setReorderIndex(null)`
  - Disabled-state on arrows when item is at first/last position
  - New styles: `mediaThumbSelected`, `reorderOverlay`, `reorderArrow`, `reorderArrowDisabled`

---

## Feature 5: Media Captions

### The Problem
A photo without words leaves context on the table. Creator-focused apps let you annotate each photo or video so followers know exactly what they're looking at. Angelia didn't have this.

### The Solution
In the post composer, every media thumbnail now has a small caption button (📝 if a caption is set, a type icon if not). Tapping it opens a bottom-sheet modal with a text input (300 char limit). When a caption is saved, a 📝 badge appears on the thumbnail. When a viewer opens that media in full-screen, the caption overlays the bottom of the screen.

### Technical Detail
- **Type changes:**
  - [types.ts](src/models/types.ts) — `MediaItem` interface: added `caption: string | null`
  - [PostCreateMediaUploader.tsx](src/components/PostCreateMediaUploader.tsx) — `MediaFile` interface: added `caption: string | null`
- **Data flow:**
  - [camera.tsx](src/app/(protected)/camera.tsx) — `MediaFile` construction: `caption: null`
  - [gallery.tsx](src/app/(protected)/gallery.tsx) — `rawFiles.map()`: `caption: null`
  - [PostCreateMediaUploader.tsx](src/components/PostCreateMediaUploader.tsx) — picker `.map()`: `caption: null`
  - [postActions.ts](src/store/actions/postActions.ts) — `readyMedia` array: `caption: media[i].caption ?? null`
- **Composer UI:** [new.tsx](src/app/(protected)/post/new.tsx) — `captionTargetIndex`, `captionDraft` state; `openCaptionModal()`; `saveCaptions()`; caption bottom-sheet modal JSX; 📝 badge overlay; caption badge styles
- **Feed display:** [PostCard.tsx](src/components/PostCard.tsx) — `cardMediaItem`: 📝 badge on thumbnails when `item.caption` is set; `mediaViewer` state extended with `caption: string | null`; both `setMediaViewer` calls pass `caption: item.caption ?? null`
- **Full-screen viewer:** [MediaViewerModal.tsx](src/components/MediaViewerModal.tsx) — `caption?: string | null` prop; caption overlay View above `insets.bottom + 16`; `captionContainer` + `captionText` styles
- **Demo data:** [demoData.ts](src/lib/demoData.ts) — all `MediaItem` objects now include `caption: null`

---

## Cross-Cutting Changes

| Concern | What changed |
|---|---|
| `MediaItem` type | Added `caption: string | null` — required in Firestore reads, must always be present |
| `MediaFile` type | Added `caption: string | null` — all construction sites updated to `null` |
| `postActions.ts` | Threads caption from `MediaFile` → `readyMedia` → Firestore write |
| `constants.ts` | Added `FEED_SESSION_SCROLLED_KEY` |
| `expo-haptics` | New dependency, installed via `npx expo install` |

---

## User-Facing Impact

| Feature | Benefit | Where |
|---|---|---|
| Haptic feedback | Posts and reactions feel physical and responsive | Feed, reaction peel |
| GIF playback | GIFs animate correctly instead of freezing | Feed, post detail |
| Scroll-to-top | Opens to fresh content every cold launch | Feed |
| Media reorder | Creators can arrange photos/videos before posting | Post composer |
| Captions | Photos and videos can carry their own context | Post composer, feed, media viewer |

---

## Files Changed

| File | Purpose |
|---|---|
| `src/components/PostCard.tsx` | Haptics, GIF fix, caption badge, mediaViewer caption |
| `src/components/ReactionPill.tsx` | Haptic on emoji tap |
| `src/components/MediaViewerModal.tsx` | Caption overlay prop + styles |
| `src/components/PostCreateMediaUploader.tsx` | `caption: null` in MediaFile construction; `caption` field on `MediaFile` |
| `src/app/(protected)/post/new.tsx` | Media reorder (ScrollView, moveMedia, reorderIndex), captions (modal, badge, state) |
| `src/app/(protected)/camera.tsx` | `caption: null` in MediaFile |
| `src/app/(protected)/gallery.tsx` | `caption: null` in MediaFile |
| `src/app/(protected)/feed.tsx` | Cold-launch scroll-to-top effect |
| `src/components/DataListenerWrapper.tsx` | AppState listener to clear scroll flag on background |
| `src/models/types.ts` | `caption: string | null` on `MediaItem` |
| `src/models/constants.ts` | `FEED_SESSION_SCROLLED_KEY` |
| `src/store/actions/postActions.ts` | Threads caption into `readyMedia` |
| `src/lib/demoData.ts` | `caption: null` on all demo `MediaItem` objects |

---

## Summary

**For users:** The app now pulses when you touch it, GIFs actually move, you always land at the top when you open up fresh, you can rearrange your photos before posting, and every image can have its own caption.

**For maintainers:** Caption is a nullable field threaded end-to-end from device picker → Firestore → viewer. All construction sites default to `null`. The feed scroll flag lives in AsyncStorage and clears on background so it reliably re-fires each cold launch.


**Branch:** v1.0.7-features  
**Release Date:** May 2026  
**Theme:** User control, consistency, clarity

---

## Story Overview

This release gives users **more control over when they're visible, consistency in how reactions flow across their experience, and clarity about what's important**.

We asked ourselves three questions:
1. **Status Expiry:** What if users could pick exact times instead of being locked into preset durations?
2. **Reaction Sorting:** What if reactions were always in the same order everywhere, so users could find trending reactions without surprises?
3. **Upload Visibility:** What if users could see their posts uploading in real-time, instead of wondering if they've been sent?
4. **Post Importance:** What if We made it crystal clear which posts are worth knowing vs. big news, instead of hiding it in a tiny icon?
5. **Release Stability:** What if the app never told users "hey, update!" when they already had the latest version?

This branch answers all five. Here's how.

---

## Feature 1: Exact-Time Status Expiry

### The Problem
Alice wants her status to expire at 3 PM today, not "in 2 hours" (what if she sets it at 1:05 PM?). The old duration-based approach creates ambiguity.

### The Solution
**Status expiry now has two modes:**
- **Duration mode** (original) — "I'll be away for 2 hours"
- **Exact-time mode** (new) — "I'll be away until 3 PM"

When users toggle to "Exact time," they see a native date picker (Android) or modal spinner (iOS) to choose the moment. We validate they can't pick a time in the past and show them a friendly hint: "Expires today at 3:00 PM."

### Technical Detail
- **File:** [NowStatusModal.tsx](../src/app/(protected)/tabs/profile/NowStatusModal.tsx)
- **Key Changes:**
  - Added `ExpiryMode` union type: `'duration' | 'exact-time'`
  - New state: `expiryMode`, `selectedDate`, `selectedTime`
  - Platform-specific pickers: `@react-native-community/datetimepicker` on Android (native), custom modal spinner on iOS
  - Validation logic: reject any time before `Date.now()`
  - Future-time formatter: "Expires today at X:XX PM" or "Expires tomorrow at X:XX PM"
- **User Interaction:** Two toggle chips at top of modal; exact-time section appears/disappears based on selected mode
- **Styles:** New `modeWrap`, `modeChip`, `exactTimeWrap`, `exactTimeHint` classes for clear affordance

---

## Feature 2: Deterministic Reaction Sorting

### The Problem
Bob sees 🎉 at the top on the feed, but when he opens the post details, he sees ❤️ first. The order is random because we sort by insertion order, which differs per view. This hurts discoverability of trending reactions.

### The Solution
**All reactions now sort by the same four criteria, everywhere:**

1. **Count (descending)** — Most-reacted emoji first
2. **Oldest timestamp (ascending)** — When tied on count, the oldest reaction wins (early adopters rise to top)
3. **Emoji strength (descending)** — Predefined order: 🔥 > ❤️ > 🎉 > 😮 > 😄 > 😊 > 👀 > 😢
4. **Lexicographic fallback** — If somehow tied on all three, alphabetical emoji order

This ensures reactions **feel stable and intentional**, not random.

### Technical Detail
- **File:** [reaction.utils.ts](../src/services/utils/reaction.utils.ts) (new shared comparator)
- **Key Changes:**
  - Added `EMOJI_STRENGTH_ORDER` array with precomputed rank map
  - New function: `compareReactionGroupPriority(a, b)` — three-tier sort logic
  - New interface: `ReactionGroupPriorityEntry` — tracks `{ emoji, count, oldestTimestamp }`
  - Updated `getSuggestedReactionEmojis()` — now tracks oldest timestamp per emoji, maps to priority entries before sort
  - **Used by:**
    - [post/[id].tsx](../src/app/(protected)/post/[id].tsx) — reactionGroups header badges
    - [PostCard.tsx](../src/components/PostCard.tsx) — top 5 reactions in feed preview
    - Anywhere we render a reaction list
- **No schema changes** — backward compatible; timestamp is already tracked per reaction in Firestore

---

## Feature 3: Feed Upload Progress Bar

### The Problem
Carol uploads a photo to a circle, but doesn't see any indication it's uploading. Is it sent? Did the app crash? This creates anxiety.

### The Solution
**When Carol has posts currently uploading, a banner appears at the top of her feed:**

> 📤 Uploading 2 posts...

Tapping the banner takes her directly to Post Activity filtered to show only her uploading posts. Once all posts send, the banner disappears.

This turns a silent operation into a visible, reassuring progress indicator.

### Technical Detail
- **Files:**
  - [feed.tsx](../src/app/(protected)/feed.tsx) — upload banner UI + navigation
  - [activitySelectors.ts](../src/store/crossSelectors/activitySelectors.ts) — new selector: `selectCurrentUserUploadingPosts`
- **Key Changes:**
  - New Redux selector: filters current user's posts where `status === 'uploading'`, sorts newest first
  - Feed component imports selector; derives `uploadingCount` in state
  - Conditional Pressable banner rendering when `uploadingCount > 0`
  - Plural-aware text: "Uploading 1 post..." vs "Uploading N posts..."
  - Tap handler: navigates to `/post-activity?scope=uploading`
- **Styles:** `uploadingBanner`, `uploadingBannerText` — secondary theme color with icon + chevron affordance

---

## Feature 4: Post Activity "Uploading" Scope

### The Problem
The Post Activity screen always shows David's reactions, notes, and messages. But he wants to **focus on just what's uploading right now** — not scroll through all his past activity to find what's pending.

### The Solution
**Post Activity now has a third filter scope: "Uploading"**

The existing "All" and "Unread Only" chips stay. A new "Uploading (N)" chip appears when David has posts uploading. Tapping it shows only those posts with an upload-state hint: "Uploading now..."

This gives David a single, focused view of what's in-flight.

### Technical Detail
- **File:** [post-activity.tsx](../src/app/(protected)/post-activity.tsx)
- **Key Changes:**
  - Added `activityScope` union type: `'all' | 'unread' | 'uploading'`
  - Initialize from route param: `params?.scope ?? 'all'`
  - New memo: `filteredUploadingPosts` — filters and sorts uploading posts by selected circle
  - **Type-safe rendering:** Separate `FlashList` branches for uploading (Post[]) vs regular (AuthorPostActivitySummary[]) — avoids type conflicts with `keyExtractor` / `renderItem`
  - New callback: `renderUploadingCard` — renders PostCard + "Uploading now..." fallback text
  - New chip: "Uploading (N)" — only shows when uploading posts exist
  - `onViewableItemsChanged` handler updated to detect both data shapes gracefully
- **Why two FlashList branches?** Uploading posts are raw Post objects. Regular activity is summarized by author (AuthorPostActivitySummary). TypeScript can't unify these without runtime checks on every row, so we render separate lists with proper typing.

---

## Feature 5: Explicit Post Tier Badges

### The Problem
Eden sees tiny circular badges on posts labeled "Big News" or "Worth Knowing," but they're so small and tucked away that she barely notices which posts are from high-context circles. The tier system exists but feels invisible.

### The Solution
**Post tier badges are now prominent label badges with emoji + text:**

- **Post Details:** Badge appears in the header next to the circle name
- **Conversation:** Badge appears next to the circle info
- **Both show:** emoji + label (e.g., 🏆 "Big News" or 💡 "Worth Knowing")

By making tier visible and explicit, we help Eden quickly assess post importance at a glance.

### Technical Detail
- **Files:**
  - [post/[id].tsx](../src/app/(protected)/post/[id].tsx) — post detail tier badge
  - [conversation.tsx](../src/app/(protected)/conversation.tsx) — conversation tier badge
- **Key Changes:**
  - Both files import `POST_TIERS` constant (already existed)
  - Lookup: `POST_TIERS.find(t => t.value === post.tier)` → `tierBadgeConfig`
  - **Removed:** Old small `tierIndicator` dot (26×26 circle)
  - **Added:** New `tierBadge` row badge with emoji + label text (semantically clear)
  - Header layout: Added `badgesColumn` View wraps channel badge + tier badge vertically
  - Animations (conversation screen): Existing confetti/glow/scale animations for big-news already fire (unchanged)
- **Styles:** `badgesColumn`, `tierBadge`, `tierBadgeEmoji`, `tierBadgeText` — consistent with app theme
- **Why both screens?** Post Details and Conversation are two different contexts for viewing the same post. Users should see tier clarity in both.

---

## Feature 6: Runtime App Version Constant

### The Problem
Frank is running v1.0.7 (the latest), but the app keeps nagging him "hey, update to v1.0.7!" Because the app was checking `Constants.expoConfig.version` at runtime, which isn't cached, the version could drift if Firestore config didn't sync fast enough. Also, `Constants.expoConfig` doesn't exist on native iOS builds without extra setup.

### The Solution
**App version is now a compile-time constant that must be manually synced to `app.config.js`:**

1. When we bump the version in `app.config.js` for a release build, we also bump `APP_VERSION` in code
2. All version checks use the same constant (e.g., `useFeedModals` for update gating)
3. No runtime version drift, no "already updated" false prompts

### Technical Detail
- **Files:**
  - [constants.ts](../src/models/constants.ts) — new constant
  - [app.config.js](../../../app.config.js) — version field (source of truth for builds)
  - [useFeedModals.ts](../src/hooks/useFeedModals.ts) — update gating logic
  - [release-process.md](../docs/release-process.md) — new sync step in checklist
- **Key Changes:**
  - Added `export const APP_VERSION = '1.0.7'` with docstring: "Keep this in sync with expo.version in app.config.js"
  - Updated [useFeedModals.ts](../src/hooks/useFeedModals.ts):
    - Removed: `Constants from 'expo-constants'`
    - Added: `APP_VERSION from '@/models/constants'`
    - Changed: `String(Constants.expoConfig?.version ?? '0.0.0')` → `APP_VERSION`
  - Bumped [app.config.js](../../../app.config.js): `version: '1.0.6'` → `version: '1.0.7'`
  - Extended [release-process.md](../docs/release-process.md):
    - New section 1d: "Sync Runtime App Version Constant"
    - Explanation: "update gating compares server-required versions against this runtime constant. Keeping it in sync prevents false 'new update' prompts when users already installed the latest build but still have older cached dismissal metadata."
    - Checklist item: `[ ] APP_VERSION in src/models/constants.ts synced to app.config.js version`

---

## Cross-Cutting Changes

### Redux & Data Flow
- **New Selector:** `selectCurrentUserUploadingPosts` in [activitySelectors.ts](../src/store/crossSelectors/activitySelectors.ts)
  - Derived from posts slice (filters by userId + status === 'uploading')
  - Used by: feed upload banner, post-activity uploading scope
  - Memoized via `createSelector` to avoid unnecessary re-renders

### Reaction System Evolution
- **Existing Flow:** Posts already track reactions by emoji with timestamps
- **New Behavior:** All reaction displays now use shared `compareReactionGroupPriority` comparator
- **Backward Compat:** No schema changes; timestamp tracking already in place

### Type Safety
- Union types for new modes/scopes: `ExpiryMode`, `activityScope`
- Discriminated union for activity scope rendering (uploading vs. regular)
- No breaking changes to existing types

---

## User-Facing Impact

| Feature | User Benefit | Where It Shows |
|---------|--------------|----------------|
| Exact-time status | "I can expire my status at an exact time" | Profile > Set Status modal |
| Reaction sorting | "Trending reactions are consistent & discoverable" | Feed & Post Details |
| Upload banner | "I can see my posts uploading in real-time" | Feed top banner |
| Uploading scope | "I can focus on just what's in-flight" | Post Activity filter chips |
| Tier badges | "I instantly see which posts are important" | Post Details & Conversation |
| Version gating | "The app never tells me to update when I already have the latest" | In-app update modal (silent improvement) |

---

## Testing Checklist

- [ ] Status modal: Set exact time, verify platform-specific picker UX, confirm past-time validation
- [ ] Reactions: Upload a new post, add multiple reactions with different emojis, verify sort order in feed vs. post detail (should match)
- [ ] Upload banner: Upload a post, verify banner appears at feed top with count, tap to navigate to uploading scope
- [ ] Uploading scope: Verify "Uploading (N)" chip appears only when posts are uploading, displays correct count
- [ ] Tier badges: Create/view a big-news or worth-knowing post, verify label badge (not small dot) in both detail and conversation
- [ ] Version constant: Verify `APP_VERSION` matches `app.config.js`, confirm app checklist includes sync step

---

## Files Changed (13 total)

| File | Type | Lines | Purpose |
|------|------|-------|---------|
| [app.config.js](../../../app.config.js) | Config | ±1 | Version bump: 1.0.6 → 1.0.7 |
| [BETA_UPDATE_NOTES.txt](./BETA_UPDATE_NOTES.txt) | Docs | ±8 | 6 feature bullets for release |
| [release-process.md](../docs/release-process.md) | Docs | ±12 | New section: APP_VERSION sync + checklist item |
| [NowStatusModal.tsx](../src/app/(protected)/tabs/profile/NowStatusModal.tsx) | Feature | ±80 | Dual expiry modes + date/time pickers |
| [reaction.utils.ts](../src/services/utils/reaction.utils.ts) | Utility | ±40 | Shared comparator + priority interface |
| [post/[id].tsx](../src/app/(protected)/post/[id].tsx) | Screen | ±30 | Deterministic reaction sort + tier badge |
| [PostCard.tsx](../src/components/PostCard.tsx) | Component | ±10 | Deterministic reaction sort (top 5) |
| [conversation.tsx](../src/app/(protected)/conversation.tsx) | Screen | ±15 | Tier badge (label + emoji) |
| [feed.tsx](../src/app/(protected)/feed.tsx) | Screen | ±20 | Upload banner + navigation |
| [post-activity.tsx](../src/app/(protected)/post-activity.tsx) | Screen | ±40 | Uploading scope + type-safe rendering |
| [useFeedModals.ts](../src/hooks/useFeedModals.ts) | Hook | ±5 | Use APP_VERSION constant |
| [constants.ts](../src/models/constants.ts) | Config | ±3 | APP_VERSION = '1.0.7' |
| [activitySelectors.ts](../src/store/crossSelectors/activitySelectors.ts) | Selector | ±10 | selectCurrentUserUploadingPosts |

---

## Summary: What's the Impact?

**For Users:**
- Status expiry is now precise, not guessed
- Reactions feel consistent & trustworthy across the app
- Uploading is visible & reassuring
- Post importance is crystal clear
- App update prompts are reliable (no false "update available" noise)

**For Code:**
- Two new Redux selectors + one new shared comparator (reusable patterns)
- Type-safe conditional rendering for multi-shape data (FlashList with discriminated union)
- Platform-aware native pickers (graceful Android/iOS differences)
- Zero breaking changes (backward compatible all features)
- Documentation updated to prevent future version-constant drift

**For Experience:**
- UX feels more intentional (exact times, consistent reactions, visible uploads)
- Clarity improves (tier badges, uploading scope focus)
- Trust increases (no lazy version prompts)

---

**Created:** May 14, 2026  
**Status:** Ready for QA ✅

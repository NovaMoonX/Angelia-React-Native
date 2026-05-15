# Private Circles — Branch Narrative

**Branch:** copilot/private-circles  
**Date:** May 2026  
**Theme:** Creator control and audience privacy for custom circles

---

## Story Overview

This branch gives circle hosts the ability to make a custom circle private — invite-only, not discoverable, and fully host-controlled. Users can toggle a circle's privacy when creating or editing it, see a clear visual indicator, and discover the feature via a one-time notice card on the My Circles tab.

---

## Feature 1: Private Circle Toggle in Create/Edit

### The Problem
All custom circles were inherently public: anyone with the invite link could request to join, and circles would be suggested to strangers after they left a post. Hosts had no way to limit who discovers or joins their circle.

### The Solution
A **Private** toggle was added to the circle creation and edit form. When enabled:
- Only the host can invite people (invite link is hidden from members)
- The circle is not suggested post-leave
- A 🔒 badge appears on the circle card

When disabled (default), circles behave exactly as before.

### Technical Detail
- File: [src/models/types.ts](src/models/types.ts) — `isPrivate: boolean | null` added to `Channel` interface (nullable so existing Firestore documents without the field default gracefully to public)
- File: [src/components/ChannelFormModal.tsx](src/components/ChannelFormModal.tsx) — RN `Switch` toggle added; controlled via `useState<boolean>`; `onSubmit` extended with `isPrivate: boolean`; dynamic description text explains the implications of each mode
- File: [src/store/actions/channelActions.ts](src/store/actions/channelActions.ts) — `createCustomChannel` and `editCustomChannel` thunks accept and forward `isPrivate`
- File: [src/services/firebase/firestore.ts](src/services/firebase/firestore.ts) — `createCustomChannel` passes `isPrivate`; `updateCustomChannel` spreads the full Channel so edits propagate automatically; `createDailyChannel` explicitly sets `isPrivate: false`

---

## Feature 2: Post-Leave Circle Suggestion Filtering

### The Problem
When a user leaves a post detail page, the app may suggest circles for them to join. Private circles were being suggested to users who have no connection to the host — exactly the opposite of what "private" means.

### The Solution
Private circles are now filtered from the suggestions list entirely.

### Technical Detail
- File: [src/app/(protected)/post/[id].tsx](src/app/(protected)/post/[id].tsx) — `!circle.isPrivate` guard added to the `ownerCustomCircles.filter()` call that populates `CircleJoinSuggestionsModal`

---

## Feature 3: Non-Owner Invite Restriction in ChannelModal

### The Problem
Any circle member who opened the "Circle Info" modal could see the invite link and share it with others — even for private circles.

### The Solution
For private circles, the invite link section is replaced with a friendly notice: `"🔒 This is a private circle. Only the host can invite new members."` Members never see the link or QR code for a private circle.

### Technical Detail
- File: [src/components/ChannelModal.tsx](src/components/ChannelModal.tsx) — New `isOwner?: boolean` prop; non-daily branch now conditionally renders either the invite link section or the private notice
- File: [src/components/account/MyChannelsTab.tsx](src/components/account/MyChannelsTab.tsx) — passes `isOwner={selectedChannel.ownerId === currentUser.id}`
- File: [src/components/account/SubscribedTab.tsx](src/components/account/SubscribedTab.tsx) — passes `isOwner={selectedChannel.ownerId === currentUser.id}`

---

## Feature 4: 🔒 Private Badge on Circle Card

### The Problem
There was no visual way to tell at a glance whether a circle was private.

### The Solution
A small `🔒 Private` text badge appears next to the circle name in `ChannelCard` for any circle with `isPrivate: true`.

### Technical Detail
- File: [src/components/ChannelCard.tsx](src/components/ChannelCard.tsx) — conditional `<Text>` badge rendered in the card header; new `privateBadge` style

---

## Feature 5: One-Time Private Circles Notice on My Circles Tab

### The Problem
Existing users won't know private circles exist. There was no in-app discovery mechanism.

### The Solution
A dismissible notice card appears at the top of the My Circles tab the first time after the feature ships. The card reads "🔒 You can now mark circles as private!" with a "Learn more" link that opens a bottom-sheet modal explaining public vs private circles in plain language.

Dismissal is persisted via AsyncStorage so the card never reappears after the user closes it (or taps "Got it!" in the learn-more sheet).

### Technical Detail
- File: [src/models/constants.ts](src/models/constants.ts) — `PRIVATE_CIRCLES_NOTICE_VERSION = '2026-05-private-circles'` and `PRIVATE_CIRCLES_NOTICE_SEEN_KEY(version)` following the same pattern as `NOTIFICATION_SETTINGS_NOTICE_VERSION`
- File: [src/components/account/MyChannelsTab.tsx](src/components/account/MyChannelsTab.tsx) — `noticeSeen` state loaded from AsyncStorage on mount; `learnMoreOpen` Modal state; `dismissNotice()` persists key; new styles: `noticeCard`, `noticeContent`, `learnMoreSheet`, etc.

---

## Cross-Cutting Changes

- **`isPrivate: false` backfilled** at all existing channel-creation call sites: onboarding (`complete-profile.tsx`), demo data (`demoData.ts` — all 4 channel objects), and daily channel creation (`firestore.ts`)
- **`isPrivate: boolean | null`** — nullable type means every existing Firestore document without the field is treated as public (`null` is falsy), so there is zero migration burden

---

## User-Facing Impact

| Feature | Benefit | Where |
|---|---|---|
| Private toggle | Host controls who can discover/join | Create/Edit Circle form |
| 🔒 badge | Instant visual clarity | Circle cards everywhere |
| Invite restriction | Members can't share invite links for private circles | Circle Info modal |
| Suggestion filter | Private circles stay private after post-leave | Post detail page |
| Notice card | Discoverability for existing users | My Circles tab (one-time) |

---

## Testing Checklist

- [ ] Create a new circle with Private toggle ON → circle card shows 🔒 badge
- [ ] Create a new circle with Private toggle OFF → no badge
- [ ] Edit an existing circle and toggle Private → badge appears/disappears after save
- [ ] As a member (not host) of a private circle, open Circle Info → confirm invite link / QR not visible
- [ ] As the host of a private circle, open Circle Info → confirm invite link IS visible
- [ ] Leave a post detail page where the host has custom circles — confirm private circles are NOT suggested
- [ ] Uninstall/clear storage → My Circles tab shows the notice card
- [ ] Tap "Learn more" → bottom sheet opens explaining private circles
- [ ] Tap "Got it!" → card disappears, does not return on re-open
- [ ] Tap ✕ dismiss → same as above
- [ ] Demo mode → notice card should not appear (demo has `isPrivate: false` on all fixture circles)

---

## Files Changed

| File | Purpose |
|---|---|
| `src/models/types.ts` | `isPrivate: boolean \| null` on `Channel` |
| `src/models/constants.ts` | Notice version + AsyncStorage key constants |
| `src/components/ChannelFormModal.tsx` | Private toggle UI in create/edit form |
| `src/components/account/MyChannelsTab.tsx` | Handler updates + notice card + learn-more modal |
| `src/store/actions/channelActions.ts` | `isPrivate` in create/edit thunks |
| `src/services/firebase/firestore.ts` | `isPrivate` in channel create functions |
| `src/app/(protected)/post/[id].tsx` | Filter private circles from post-leave suggestions |
| `src/components/ChannelModal.tsx` | `isOwner` prop + invite section gating |
| `src/components/ChannelCard.tsx` | 🔒 Private badge |
| `src/components/account/SubscribedTab.tsx` | Pass `isOwner` to ChannelModal |
| `src/app/complete-profile.tsx` | `isPrivate: false` on onboarding circles |
| `src/lib/demoData.ts` | `isPrivate: false` on all 4 demo channels |

---

## Summary

**For users:** Hosts now have real privacy controls. Mark a circle as private during creation or at any time in the edit screen. Private circles stay out of suggestions and keep the invite link away from members — so the host stays fully in control of who joins.

**For code maintainers:** `isPrivate: boolean | null` lives on the `Channel` model. Null and `false` both mean "public" — no migration needed. The notice pattern follows the existing `NOTIFICATION_SETTINGS_NOTICE_VERSION` approach in `constants.ts`.

**For reviewers:** All 12 files have targeted, minimal changes. The core logic is a simple boolean field with four enforcement points: form toggle, Firestore write, suggestion filter, and invite-link gate.

---

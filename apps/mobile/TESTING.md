# Testing Guide — feature/activity-expiry-inbox

**Branch:** feature/activity-expiry-inbox  
**Last updated:** June 8, 2026

---

## Before You Start Testing

- [ ] Run `npm install`
- [ ] Run `npm run env:pull` if this is a fresh clone or env values changed
- [ ] Rebuild the native app before the first test pass on this branch
- [ ] Android rebuild path: `npm run prebuild:android` then `npm run prod:android`
- [ ] If you are testing on iPhone too, use a fresh iOS native build before starting that pass
- [ ] Deploy Cloud Functions, `firestore.rules`, and `firestore.indexes.json` before testing inbox writes and queries
- [ ] Launch the app and confirm there is no red screen, Metro error, or broken startup route

---

## Device Setup

**Primary:** Android  
**Secondary:** iPhone

Use the iPhone when:
- [ ] You need two logged-in devices at once
- [ ] You are validating keyboard, picker, safe-area, or haptic differences
- [ ] You want parity confirmation before closing out the branch

---

## Feature 1: Private Notes Real-Time Sync

**Devices:** Android + iPhone required (two accounts).

### Setup

- [ ] Account A = post host with an active post open on Post Detail or Private Notes host screen
- [ ] Account B = member who can send private notes on A's post
- [ ] Host is not in demo mode

### Android

- [ ] With Account A already on Post Detail (host view), have Account B send a private note -> note appears on host screens **without** reloading the app
- [ ] With Account A on Private Notes host screen, have Account B send another note -> list updates live
- [ ] Confirm Post Detail **Private Notes** action shows updated count after new note arrives
- [ ] When a note has unread activity, confirm Post Detail highlights the private-notes entry (border/text + chevron)

### iPhone

- [ ] Repeat one live-arrival pass while host stays on Post Detail and one while on Private Notes host screen

---

## Feature 2: Private Note Conversations

**Devices:** Android + iPhone required (two accounts).

### Setup

- [ ] Account A = post host; Account B = note sender on A's post
- [ ] At least one private note already exists between the two accounts

### Android

- [ ] Account B sends a private note on A's post
- [ ] Account A opens Private Notes -> taps the note -> thread screen opens with the original note text
- [ ] Account A sends a reply -> Account B sees it when opening **Your Notes** -> same note -> thread
- [ ] Account B replies back -> both sides see messages in order without reload
- [ ] Tap a `private_note` push as host -> lands on Private Notes host screen and stays there (no bounce to Feed)
- [ ] Tap a `private_note_reply` push as the other participant -> opens the thread directly (`private-note-thread/[postId]/[noteId]`)
- [ ] With unread thread replies, confirm Post Detail highlights private-notes action and chevron until thread is opened

### iPhone

- [ ] Repeat one full back-and-forth thread pass and one `private_note_reply` notification tap-routing check

---

## Feature 3: Reactions Seen Only on Post Detail

**Devices:** Android primary. iPhone parity recommended.

### Setup

- [ ] Account A = post host with at least one active post
- [ ] Account B reacts to A's post while A is on Feed or Post Activity (not post detail)

### Android

- [ ] Scroll the post card fully into view in Post Activity -> reaction unread badge **stays** on the card
- [ ] Leave Post Activity without opening post detail -> badge still shows
- [ ] Open post detail for that post -> reaction unread clears on arrival (no need to leave first)
- [ ] From Feed, scrolling past the post does not clear reaction unread

### iPhone

- [ ] Repeat one full pass: scroll past card -> badge remains -> open post detail -> badge clears on arrival

---

## Feature 4: Expiring-Soon Filters

**Devices:** Android primary. iPhone parity recommended.

### Setup

- [ ] At least one daily post within the 3-day warning window and one custom post within the 7-day window
- [ ] Mix in posts outside the warning window and posts you have / have not reacted to

### Android

- [ ] Open Post Activity -> select **Expiring soon** scope -> only warning-window posts appear, soonest expiry first
- [ ] On Feed, confirm expiring banner appears **only when** there are unreacted expiring posts (hidden when count is 0)
- [ ] When visible, confirm amber banner sits on its own row below status pills with count badge and chevron
- [ ] Tap expiring banner -> label changes to "Showing expiring posts you have not reacted to"; count badge matches unreacted expiring posts only
- [ ] Open feed filter menu -> enable **Expiring soon** -> filter trigger shows **⏳** prefix and highlighted border; all expiring posts in scope appear, including ones you already reacted to
- [ ] Disable expiring filter -> feed returns to normal scope

### iPhone

- [ ] Repeat Post Activity expiring filter and one feed row vs menu filter check

---

## Feature 5: User Inbox and Post-Grouped Notifications

**Devices:** Android + iPhone required (two accounts).

### Setup

- [ ] Account A = post host; Account B = member reacting, messaging, and replying on A's posts
- [ ] Third scenario: B triggers `comment_reply` on **someone else's** post where A is not host

### Android

- [ ] Confirm app opens **one** `userInbox` listener at startup (not per-post message/note listeners for authored posts)
- [ ] When B reacts on A's post while A is on Feed, confirm primary-colored **New activity on your posts** banner appears above the feed list
- [ ] Confirm Post Activity header icon shows a red dot while unread post-activity inbox items exist
- [ ] B reacts to A's post -> A sees Post Activity unread; opening post detail clears it on arrival
- [ ] B sends conversation message -> unread clears when A opens conversation
- [ ] B sends private note -> unread clears when A opens private notes or thread
- [ ] Tap an inbox Activity item -> destination opens; item marks read when that screen gains focus
- [ ] From Notifications or a push tap, open conversation/post/private notes -> back returns to **Notifications** (not Feed or post detail)
- [ ] B triggers `comment_reply` on another host's post -> item appears under **Notifications** Activity (grouped by post), not Post Activity
- [ ] **Activity on your posts** section groups replies on your posts under a single "Your post" header with one snippet
- [ ] **Activity** section shows new posts and other items as flat cards (no duplicate author name or post snippet)
- [ ] Names use first name + last initial (e.g. "Alex T.") — not full name repeated in badges
- [ ] Daily Circle badge says "Daily Circle", not the owner's name again
- [ ] New-post cards show tier badge, circle label, and post snippet once
- [ ] Reply items show message preview under the action line
- [ ] Each section header has **Mark all seen** on the same row; confirm only clears that section
- [ ] Feed bell dot includes unread notification-surface inbox items (not only pending connection requests)
- [ ] Push notifications still arrive when inbox items are written

### iPhone

- [ ] Repeat one reaction, one conversation, and one Notifications Activity grouping check
- [ ] Confirm mark-read on **focus** (landing on screen) matches Android for post detail, conversation, private notes host, and private note thread

---

## Feature 5: Circle Post Notification Settings

**Devices:** Android (iPhone optional for layout parity).

### Setup

- [ ] Account A is connected to at least 2 other users (B and C)
- [ ] B and C each have active Daily Circles
- [ ] A is subscribed to at least one custom Circle from a connected user

### Android

- [ ] Open **Notification Settings** -> **Circle Post Notifications**
- [ ] Confirm every connected person's **Daily Circle** appears (owner name shown, not the literal word "Daily")
- [ ] Confirm joined custom Circles also appear under the correct owner group
- [ ] Daily and custom Circle cards start **collapsed** with a one-line summary of enabled notification types
- [ ] Tap a collapsed Circle card -> expands to show all toggles
- [ ] Use the search bar with a person's first name -> only matching owner groups/circles remain
- [ ] Clear search -> full list returns
- [ ] Toggle a setting on one Circle -> persists after leaving and re-opening the screen

### iPhone

- [ ] Repeat search + expand/collapse checks once for layout sanity

---

## Regression Checks

- [ ] Feed loads and scrolls normally with status pills and expiring row visible
- [ ] Post Detail opens and closes normally; host can open Conversation and Private Notes
- [ ] Post Activity -> Post Detail -> back returns to Post Activity
- [ ] Private Notes host and sender screens open from Post Detail without errors
- [ ] Pending connection / circle request UI on Notifications still works alongside Activity section

---

## Known Limitations / Notes

- **Inbox migration:** existing AsyncStorage seen state does not backfill. Users may see a one-time badge reset after deploy until new activity arrives.
- Deploy `firestore.rules`, `firestore.indexes.json`, and Cloud Functions before testing inbox or private-note reply writes.
- Private note threads are flat lists (no nested reply threading like post conversations).
- Expiring warning windows remain 3 days (daily) and 7 days (custom) — unchanged from prior behavior.

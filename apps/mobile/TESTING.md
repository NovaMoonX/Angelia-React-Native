# Testing Guide — beta-v-1.0.7

**Branch:** beta-v-1.0.7
**Last updated:** May 16, 2026

---

## Before You Start Testing

- [ ] Run `npm install`
- [ ] Run `npm run env:pull` if this is a fresh clone or env values changed
- [ ] Rebuild the native app before the first test pass on this branch
- [ ] Android rebuild path: `npm run prebuild:android` then `npm run prod:android`
- [ ] If you are testing on iPhone too, use a fresh iOS native build before starting that pass
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

## Feature 1: Notification Controls And Release Notice

**Devices:** Android primary. iPhone recommended for real push-parity checks.

### Setup

- [ ] Use Account A as the post owner
- [ ] Use Account B to react to and message on Account A's post
- [ ] Make sure Account A has at least one joined circle from someone else
- [ ] Start with the feed bell showing the release-notice dot if possible

### Android

- [x] Open the feed -> confirm the release-notice dot is visible on the bell before visiting Notifications
- [x] Open Notifications -> confirm the bell dot clears on return to feed
- [x] Stay on Notifications without opening Notification Settings -> confirm the release notice card still shows
- [x] Tap the release notice card -> Notification Settings opens
- [x] Return to Notifications -> confirm the release card is now gone
- [x] In Notification Settings, confirm **Reaction Notifications**, **Message Notifications**, and **Reply Notifications** rows all exist
- [x] Toggle Reaction Notifications OFF -> have Account B react to Account A's post -> no reaction push arrives
- [x] Toggle Reaction Notifications back ON -> repeat -> reaction push arrives
- [x] Toggle Message Notifications OFF -> have Account B send a new conversation message on Account A's post -> no message push arrives
- [x] Toggle Message Notifications back ON -> repeat -> message push arrives
- [ ] Toggle Reply Notifications OFF -> have Account B reply directly to one of Account A's conversation messages -> no reply push arrives
- [ ] Toggle Reply Notifications back ON -> repeat -> reply push arrives

### iPhone

- [ ] Repeat one full toggle-on and toggle-off cycle for each of the three post-activity switches
- [ ] Confirm push behavior matches Android expectations

---

## Feature 21: OTA Message Targeting (Device + App Version Range)

**Devices:** Android + iPhone required.

### Setup

- [ ] In Firestore, prepare `appConfig/broadcastMessage` with `active: true`, valid `id/title/body`, and targeting fields available: `targetDeviceType`, `minAppVersion`, `maxAppVersion`
- [ ] In Firestore, prepare `appConfig/feedbackForm` with `active: true`, valid `url`, and the same targeting fields
- [ ] Confirm the installed app version on both test devices (Settings/About or app logs) so range tests are deterministic

### Android

- [ ] Set broadcast `targetDeviceType: 'android'` with a matching version range -> confirm message appears on Android feed
- [ ] Keep same message active and set `targetDeviceType: 'ios'` -> confirm message no longer appears on Android
- [ ] Set `targetDeviceType: 'all'` -> confirm message appears again on Android
- [ ] Set broadcast `minAppVersion` above current Android app version -> confirm message is hidden
- [ ] Set broadcast `maxAppVersion` below current Android app version -> confirm message is hidden
- [ ] Set range that includes the current Android version -> confirm message appears
- [ ] Repeat one pass of the same targeting checks for `feedbackForm`

### iPhone

- [ ] Repeat the same `targetDeviceType` checks for both broadcast and feedback (`ios`, `android`, `all`)
- [ ] Repeat one min/max version-range exclusion and one inclusion check for both modals
- [ ] Confirm behavior matches Android expectations for identical config values

---

## Feature 2: Circle Post Notification Settings

**Devices:** Android primary. iPhone optional.

### Setup

- [ ] Use one account that has joined circles owned by at least two different people
- [ ] Make sure the same account also hosts at least one of its own custom circles

### Android

- [ ] Open Notification Settings -> tap **Post Notifications**
- [ ] Confirm only circles you have joined appear -> circles you host should not be listed
- [ ] Confirm circles are grouped by host name
- [ ] In each host group, confirm Daily Circle appears first when present
- [ ] Flip a host-level **Enable All** switch ON -> every circle in that host group enables all post types
- [ ] Flip the same host-level **Enable All** switch OFF -> each circle falls back to Big News ON and the other post types OFF
- [ ] On an individual circle card, flip **Enable All** ON -> Big News, Worth Knowing, Everyday Update, and Post With Attachments all turn on
- [ ] Flip that same circle-level **Enable All** OFF -> confirm Big News stays ON while the extra post types switch OFF
- [ ] Toggle individual rows one by one -> settings persist after leaving and reopening the screen

---

## Feature 3: Conversation Threads, Replies, And Thread Context

**Devices:** Android primary. iPhone recommended for feel/parity.

### Setup

- [ ] Use a post where Account B has reacted so they are allowed to join the conversation
- [ ] Use Account A as the post host and Account B as the participant
- [ ] Prefer a Big News or Worth Knowing post so the tier banner is visible in Conversation

### Android

- [ ] Open Conversation as a user who can access it but has not joined yet -> **Join Conversation** button appears
- [ ] Tap **Join Conversation** -> input bar appears
- [ ] On first open with existing messages, confirm the one-time reply hint appears
- [ ] Dismiss the hint with the X -> close and reopen Conversation -> hint stays dismissed
- [ ] If you have at least one non-system message of your own, confirm the one-time **double tap to edit** hint appears
- [ ] Dismiss the edit hint with the X -> close and reopen Conversation -> hint stays dismissed
- [ ] Long-press a root message -> reply banner appears above the input
- [ ] Send the reply -> it renders directly under the parent message, not at the very bottom of the thread
- [ ] Confirm the child bubble shows quoted context from the parent message
- [ ] With the keyboard open, single tap any message -> the keyboard dismisses
- [ ] With the keyboard open, double tap one of your own messages -> the keyboard stays open while edit mode starts
- [ ] Double tap one of your own messages -> the composer fills with that message text and the send button switches into update mode
- [ ] Edit the text and submit -> the original message updates instead of creating a new message row
- [ ] Start typing a brand-new draft, then double tap one of your own older messages -> confirmation appears before the draft is cleared
- [ ] Choose cancel on that confirmation -> your typed draft stays in the composer and edit mode does not start
- [ ] Trigger the confirmation again and accept -> draft clears, edit mode begins, and the input focuses on the older message text
- [ ] While in edit mode, tap the X on the edit banner -> edit mode closes and the composer clears
- [ ] Long-press that reply and send a second-level reply -> it renders directly beneath the first reply
- [ ] Try to reply again to the second-level reply -> warning appears saying the thread is too deep
- [ ] Confirm the deeper reply is not entered after the warning
- [ ] Build a thread with sibling replies under the same parent -> confirm the vertical ancestor line stays visually connected across siblings
- [ ] Open a Big News or Worth Knowing conversation -> confirm the slim banner text is centered under the header

---

## Feature 22: Back Navigation Consistency (Post Detail Flow)

**Devices:** Android primary. iPhone recommended parity check.

### Setup

- [ ] Use any post that has at least one reaction so Conversation is accessible
- [ ] Ensure the post also has at least one private note so both host/sender private-note routes can be tested

### Android

- [ ] Open a post from Feed -> open Conversation -> press back (header back, hardware back, and swipe-back if available) -> confirm you always land on Post Details
- [ ] From that same post, open host Private Notes (or sender Private Notes) -> leave via header back/hardware back/swipe-back -> confirm you always land on Post Details
- [ ] From Post Details, press back (header back and hardware back) -> confirm you always land on Feed
- [ ] After landing on Feed from Post Details, press back again -> confirm you cannot return to Post Details/Conversation/Private Notes (stack cleared)
- [ ] Trigger the unread-leave warning modal on Post Details (when applicable), choose **Exit Post Anyway** -> confirm it still lands on Feed with stack cleared
- [ ] If circle suggestions appear on leave, dismiss/continue through the modal -> confirm final destination is Feed with stack cleared

### iPhone

- [ ] Repeat one pass for Conversation and Private Notes back navigation -> both should always return to Post Details first
- [ ] Repeat one pass for leaving Post Details -> should always land on Feed and not allow back-navigation into prior detail screens

---

## Feature 24: Post Activity Unread Session Stability

**Devices:** Android primary. iPhone parity pass recommended.

### Setup

- [ ] Use Account A as post host and Account B as reactor
- [ ] Have Account B add a fresh reaction on one of Account A's posts
- [ ] Open Post Activity from Feed with the unread shortcut (or switch to **Unread Only**)

### Android

- [ ] Confirm the **Unread Only** chip label shows a count that matches the number of unread posts currently visible in that filter
- [ ] In **Unread Only**, confirm the reacted post appears
- [ ] Keep Post Activity open for at least 20-30 seconds -> confirm that post does not disappear on its own while you remain on this screen
- [ ] Scroll the post fully into view multiple times -> confirm it still stays visible in **Unread Only** during the same screen session
- [ ] Pull to refresh while still on Post Activity -> confirm the same unread post remains visible in **Unread Only**
- [ ] Leave Post Activity (back to Feed) -> reopen Post Activity and switch to **Unread Only** -> confirm that post is now cleared from unread and appears under **All Activity** instead

### iPhone

- [ ] Repeat one full pass of the same flow and confirm unread cards also stay visible until leaving Post Activity

---

## Feature 4: Audio Clip Metadata Editor Polish

**Devices:** Android primary. iPhone optional parity check.

### Setup

- [ ] Start a new post (or edit an existing post) that includes at least one audio attachment

### Android

- [ ] In Post Create, verify each audio attachment thumbnail shows the mic icon and title text vertically centered in the 80x80 preview square
- [ ] Tap the caption icon on an audio attachment -> the modal opens with two fields (title first, caption second)
- [ ] In that modal, confirm the title field is a single-line input (not a tall text area)
- [ ] Type past 60 characters in the title field -> input stops at 60 and the counter shows `60/60`
- [ ] Save, close, and reopen the same audio editor -> title and caption persist correctly
- [ ] Tap Remove in the audio clip editor -> both title and caption clear (title does not persist after reopening)
- [ ] Repeat the same flow while editing an existing post -> behavior matches create mode
- [ ] After clearing title/caption on an existing post and tapping Save on the post, reopen that post editor -> cleared title/caption stay cleared (no old values rehydrated)

### iPhone

- [ ] Repeat one pass of the same audio edit flow and confirm title input behavior + thumbnail centering match Android

---

## Feature 5: Queued Upload Reliability + Progress Tracking

**Devices:** Android primary. iPhone recommended for background behavior parity.

### Setup

- [ ] Use a post with multiple attachments (include at least one larger file)
- [ ] Ensure Notification permission is granted so local completion notices can appear

### Android

- [ ] Create a post with media and publish -> app should return to Feed quickly without waiting for full media upload
- [ ] Confirm Feed shows the upload banner with a live percentage value while uploads are in flight
- [ ] Tap the Feed upload banner -> Post Activity opens in Uploading scope
- [ ] Confirm uploading cards show progress percentage per post (not just a static "uploading" label)
- [ ] Watch one long upload from ~10% to completion and confirm progress never drops backward (it should only hold or increase)
- [ ] Background the app during upload, then return while upload is still running -> progress continues and post eventually becomes ready
- [ ] Background the app and wait for upload completion -> if completion happens while backgrounded, confirm local "post is live" notification appears
- [ ] Keep app in foreground during upload completion -> confirm "Your post is live" success toast appears when status transitions to ready
- [ ] Confirm the toast appears immediately on screen instead of staying invisible for a beat before animating in
- [ ] While that foreground success toast is visible, verify both dismiss methods work: tap the ✕ close icon and swipe (left/right/up/down) to dismiss
- [ ] Tap ✕ once and confirm dismiss starts on the first tap (with timestamped `ToastDebug` logs, close press and dismiss request should be near-immediate)
- [ ] After a successful swipe dismiss, confirm no extra pan logs/toast interactions continue for that same toast (no ghost gesture events after dismiss starts)
- [ ] Do not interact with that toast -> confirm it auto-dismisses on its own within a few seconds (no stuck toast)
- [ ] While a large upload is still reporting progress, verify toast close/swipe interactions still respond immediately (no delayed taps or missing swipe detection)
- [ ] With a tiny finger drift while tapping ✕ (not a true swipe), confirm the toast still dismisses on that first tap instead of requiring a second try
- [ ] Repeat the same toast dismiss flow and confirm no red screen or ErrorBoundary crash appears when the toast mounts, swipes, or closes
- [ ] Simulate unstable network (toggle offline/online) during upload -> upload resumes/retries and eventually resolves to ready or explicit error

### iPhone

- [ ] Repeat one media upload while app is backgrounded and confirm progress/ready transition behavior matches Android expectations
- [ ] Confirm local completion notice appears when upload finishes while app is backgrounded

### iPhone

- [ ] Repeat the long-press reply flow and depth-limit warning
- [ ] Confirm the input bar, reply banner, and keyboard behavior feel correct on iOS too

---

## Feature 4: Post Create Draft Persistence And Media Return Flow

**Devices:** Android primary. iPhone recommended for one parity pass if you are already testing there.

### Setup

- [ ] Start a new post with text, a non-default tier, and at least one attached item
- [ ] If possible, include both image/video and audio coverage in this pass

### Android

- [ ] In Post Create, type text, choose a circle, change the tier, and attach one media item
- [ ] Tap Camera -> capture media or just close the screen -> confirm you land back in Post Create with the existing draft intact
- [ ] Tap Gallery -> select media and return -> confirm previous text, tier, status, and earlier media are still there
- [ ] Tap Audio Record -> record audio or back out -> confirm Post Create restores the draft instead of dumping you to Feed
- [ ] Force-close and reopen the app while the draft exists -> reopen Post Create -> draft hydrates from local storage
- [ ] Dismiss the gallery-video limitation notice -> leave and return to Post Create -> dismissal state is preserved in the draft
- [ ] Tap **Reset** with a dirty draft -> confirmation appears before anything is cleared
- [ ] Confirm the Reset button only shows when the draft actually has changes
- [ ] Cancel out of Post Create with an in-progress draft -> discard confirmation appears
- [ ] Publish a post successfully -> return to Post Create -> the old draft does not come back

### iPhone

- [ ] Repeat at least one Camera return, one Gallery return, and one Audio Record return flow
- [ ] Confirm the draft still survives those round-trips on iOS

---

## Feature 5: Unread Integrity And Host Leave Warning

**Devices:** Android primary. iPhone useful when two devices are already in play.

### Setup

- [ ] Use Account A as the post host
- [ ] Use Account B to create all three kinds of post activity on Account A's post: reaction, conversation message, and private note
- [ ] Make sure Account A has unread indicators visible before starting the checks

### Android

- [ ] Open Post Activity -> confirm unread styling is visible for the affected post
- [ ] Let the post card become visible on screen -> confirm message and private-note unread do not clear just from visibility
- [ ] Open Post Detail -> do not open Conversation or Private Notes yet
- [ ] Leave Post Detail -> confirm reaction unread clears, but message/private-note unread still remain
- [ ] Reopen Post Detail while unread message/private-note indicators still exist -> try to leave as the host
- [ ] Confirm the warning modal appears
- [ ] Tap **Review now** -> confirm you stay in the post flow and can inspect the unread areas
- [ ] Reopen the warning and tap **Exit Post Anyway** -> confirm you leave the screen
- [ ] Reproduce the warning and tap **Don't show this again** -> confirm later exits no longer show the modal
- [ ] Open Conversation directly -> unread conversation indicator clears after that screen is actually opened
- [ ] Open Private Notes directly -> unread private-note indicator clears after that screen is actually opened

### iPhone

- [ ] Repeat one host leave-warning cycle and one unread-clear cycle for Conversation or Private Notes

---

## Feature 19: Edit Post (Author-Only, Full Content)

**Devices:** Android primary, iPhone parity check.

### Setup

- [ ] Use Account A as post author
- [ ] Create a post with text, tier, and at least 2 attachments (include one video if possible)
- [ ] Open that post in Post Detail as Account A

### Android

- [ ] Confirm author sees an edit icon in Post Detail header
- [ ] Tap edit icon → composer opens in edit mode with existing text/channel/tier/media prefilled
- [ ] Change text and tier, then save → Post Detail reflects updated text/tier
- [ ] Reorder media and update one caption, then save → Post Detail media order/caption reflect edits
- [ ] Add one new attachment during edit and save → new attachment appears on post
- [ ] Remove one existing attachment and save → removal succeeds only if storage delete succeeds first
- [ ] Validate failure path: simulate/trigger storage-delete failure for a removed existing attachment
  - Save should fail
  - Removed attachment should remain on the post (no partial content removal)
- [ ] Confirm post now has `lastEditedAt` set and author sees a "Last edited" timestamp in Post Detail
- [ ] Re-open same post as non-author account → "Last edited" timestamp is not shown
- [ ] As non-author, confirm no edit icon appears and edit route is inaccessible from normal UI

### iPhone

- [ ] Repeat edit flow with text/tier/media updates and confirm parity
- [ ] Confirm author-only "Last edited" visibility rule matches Android

### Edge cases

- [ ] Edit a text-only post (no media) → save works and sets `lastEditedAt`
- [ ] Edit a post but make no changes → save still succeeds without corruption
- [ ] Remove multiple existing attachments in one edit → all must pass storage deletion before save commits
- [ ] Edit a ready/published post and add new media where none existed before → save succeeds (no storage unauthorized error)
- [ ] Edit a ready/published post and replace existing media with a different file → save succeeds and old file removal does not block due to storage permissions
- [ ] Edit a post with image/audio-only attachments (no thumbnailUrl) and confirm save succeeds without Firestore "Unsupported field value: undefined"
- [ ] Start editing a post with one existing image, open Camera, record a new video, return to composer → original image preview remains visible and new video thumbnail is also visible
- [ ] Repeat the same flow through Gallery and Audio Record entry points → existing image preview still remains visible after returning
- [ ] Confirm existing image preview URI still includes valid Firebase download query token after round-trip (no broken `%2F`/query truncation behavior)
- [ ] Save edits after keeping one existing image + adding new media → existing image still renders in Feed/Post Detail after save (URL not lost)
- [ ] Move a post from Circle B to Circle A (Daily Circle case) and verify a member of Circle A sees it appear in Feed without manual refresh

---

## Feature 20: Private Note Notification Routing Stability

**Devices:** Android primary, iPhone strongly recommended.

### Setup

- [ ] Use Account A as a post host with at least one active post
- [ ] Use Account B to send Account A a private note on that post
- [ ] Ensure Account A receives a private-note push notification

### Android

- [ ] Tap the private-note notification from background/closed app state
- [ ] Confirm app opens to Private Notes host screen and stays there (no immediate navigation back to Feed)
- [ ] If this is the first private note on that post, confirm the screen remains stable and does not bounce
- [ ] Return to Feed manually, then tap another private-note notification for the same post
- [ ] Confirm routing is still stable and opens Private Notes correctly

### iPhone

- [ ] Repeat the same private-note tap flow from background and terminated app states
- [ ] Confirm there is no quick route reversal to Feed after landing on Private Notes
- [ ] Confirm the private-note screen remains open long enough to read notes without interruption

### Edge cases

- [ ] Host taps private-note notification while Firestore data is still loading → screen should wait without bouncing
- [ ] Host taps notification for a post with only one note (first-note scenario) → screen should remain on Private Notes

---

## Regression Checks

- [ ] Posting still succeeds for a plain text-only post
- [ ] Posting still succeeds for a media post
- [ ] Conversation still scrolls to the newest messages correctly
- [ ] Notification Settings still saves Daily Reminder and time-zone preferences correctly
- [ ] Post Detail still opens Conversation and Private Notes normally from the host view
- [ ] Feed bell badge behavior still works for normal unread notifications, not just the release notice dot

---

## Feature 20: Edit Mode Header Polish + Multi-Clip Audio Recorder

**Devices:** Android primary, iPhone parity check.

### Setup

- [ ] Use a post author account with permission to edit at least one post
- [ ] Start from Post Detail and also from Post Create with at least one existing media attachment

### Android

- [ ] Open an authored post and tap Edit
- [ ] Confirm the top bar in edit mode shows Cancel + Save and does not show Reset
- [ ] Return to Post Detail and confirm there is noticeably more spacing between the Edit and Delete header actions
- [ ] From Post Create, tap the mic icon to open Audio Record
- [ ] Record a clip and watch the timer continue until stop
- [ ] Let one recording run to 3 minutes and confirm it auto-stops with the max-length notice
- [ ] While recording, confirm a red countdown appears once 15 seconds remain and counts down to stop
- [ ] Record at least one additional clip and confirm a multi-clip list appears
- [ ] Confirm the summary line shows slots left, new clip count, and total recording time
- [ ] Select a clip, add a title and caption, then return to Post Create with Use Recordings
- [ ] Without typing a custom title, select a different clip and confirm Preview & Details shows that clip's default label (for example, Recording 2) instead of Audio clip
- [ ] Open the added audio in composer preview and confirm the title carries through
- [ ] Publish or save edit, then verify the same audio title appears in Feed/Post Detail audio players
- [ ] Add captions to one image, one video, and one audio item; confirm each shows the same icon-style caption indicator (not emoji) in Post Create, Feed card, and Post Detail
- [ ] Open a post card carousel containing only audio clips and confirm each clip is vertically centered with opaque background space above/below (no awkward extra bottom gap)
- [ ] Open a mixed-media carousel (image/video + audio) and confirm media height stays correct while audio items remain vertically centered
- [ ] Start playing an audio clip in a carousel, swipe to a different item, and confirm the previous audio stops immediately in both Feed cards and Post Detail
- [ ] While audio is playing, swipe rapidly across multiple carousel items and confirm there is no ErrorBoundary crash or red error banner
- [ ] Let a clip finish naturally, then tap Play once and confirm it restarts from 0:00 and plays again
- [ ] Open an audio player and confirm the waveform bars are visually stable (no shifting/random jumping while playback progresses)
- [ ] Confirm progress now reads through bar coloring + playhead (no opaque red block overlay look)
- [ ] Confirm the play/pause control is positioned on the right side of the audio card in both feed/post detail and full view
- [ ] Confirm waveform bars now render noticeably taller than before and remain readable in compact and full audio cards
- [ ] In carousel audio cards, confirm the player sits higher and occupies more height so the play button is not crowded against the carousel next/prev controls

### iPhone

- [ ] Repeat one edit-mode check to confirm Reset stays hidden while editing
- [ ] Repeat one multi-clip recording flow (at least 2 clips) and confirm title/caption input + playback behave correctly

### Edge cases

- [ ] Open Audio Record when already at max attachments and confirm Start Recording is disabled
- [ ] Record clips, remove one from the list, and confirm selection/timing updates correctly
- [ ] Back out of Audio Record with unsaved clips and confirm those clips still return to Post Create (no lost work)

---

## Feature 23: iPhone Audio Recording Session Activation

**Devices:** iPhone required.

### Setup

- [ ] Use an iPhone build from this branch
- [ ] Start from Post Create with room for at least one more attachment
- [ ] Keep Metro or Xcode logs visible so the `[audio-record]` debug lines can be observed during the pass

### iPhone

- [ ] Open Post Create -> tap the mic button -> confirm Audio Record opens
- [ ] On a fresh install or after resetting microphone permission, tap **Start Recording** -> allow microphone access -> confirm the recording starts on that same attempt
- [ ] With permission already granted, tap **Start Recording** once -> confirm the timer begins immediately and the red recording state appears
- [ ] Check device logs after tapping Start -> confirm you see `[audio-record] audio mode -> record (start-recording)`, `[audio-record] prepareToRecordAsync resolved`, and `[audio-record] record() invoked`
- [ ] Tap **Stop Recording** -> confirm the clip saves into the list instead of failing silently
- [ ] Check device logs after tapping Stop -> confirm you see `[audio-record] stop requested`, `[audio-record] stop resolved`, and `[audio-record] audio mode -> playback (stop-recording)`
- [ ] Play the saved clip inside Audio Record -> confirm playback still comes through after stopping the recording session
- [ ] Tap **Use 1 Recording** -> return to Post Create and confirm the new audio attachment is present

### Edge cases

- [ ] Start a recording, leave the screen, and confirm no stuck recording session remains active when you return
- [ ] Start and stop two recordings back to back -> both attempts should succeed without needing to relaunch the screen

---

## Known Limitations / Notes

- [ ] Gallery video uploads are still not the reliable path in every case; the in-app notice should remain visible until dismissed and the preferred path is still recording video in-app
- [ ] Reply depth is intentionally capped; the warning is expected behavior, not a bug

---

## Feature 8: Notification Settings — Reaction & Message Toggles

**Devices:** Android primary.

### Setup
- Have at least one circle you have **joined** (not owned) with recent post activity.

### Android

- [ ] Open **Notification Settings** (bell icon → Settings)
- [ ] Confirm a **🎉 Reaction Notifications** row is now present with a Switch
- [ ] Confirm a **💬 Message Notifications** row is now present with a Switch
- [ ] Confirm both default to ON for a fresh account
- [ ] Toggle Reaction Notifications OFF → save; trigger a test reaction on your post from another device
  - Confirm **no push arrives**
- [ ] Toggle Reaction Notifications back ON → test reaction again → push arrives
- [ ] Toggle Message Notifications OFF → have another user post a conversation message on your post
  - Confirm **no push arrives** for the new message
- [ ] Toggle back ON → message push arrives
- [ ] Confirm the pre-existing **Reply Notifications** toggle still functions correctly (direct replies still send notifications when on)

---

## Feature 9: Owned Circles Excluded from Post Notification Settings

**Devices:** Android primary.

### Setup
- Account A owns at least one custom circle and is subscribed to at least one circle owned by someone else.

### Android

- [ ] Open **Notification Settings** → scroll to **Post Notifications** section
- [ ] Confirm circles you **own** are **not listed** — only circles you have joined appear
- [ ] If you subscribe to circles from two different people, confirm those groups each appear with their owner's name
- [ ] Confirm **no empty sections** appear (owned-only users see "Once you join circles…" empty state)

### iPhone (if needed)

- [ ] Repeat the owned vs joined check on a second account

---

## Feature 10: Per-Circle & Per-Group "Enable All" Toggles

**Devices:** Android primary.

### Setup
- Be subscribed to at least 2 circles owned by different people.

### Android — Per-circle Enable All

- [ ] Open **Notification Settings** → **Post Notifications** → tap a circle card to expand it
- [ ] Confirm a **🔔 Enable All** switch appears at the bottom of the circle's toggle list
- [ ] When all 4 tiers are ON → Enable All shows as ON
- [ ] When at least 1 tier is OFF → Enable All shows as OFF
- [ ] Toggle Enable All OFF → Big News stays ON, Worth Knowing / Everyday / With Attachments all turn OFF
- [ ] Toggle Enable All ON → all 4 tiers turn ON
- [ ] Manually toggle any single tier → Enable All state updates accordingly

### Android — Per-group Enable All

- [ ] In the group header row (owner name), confirm a **🔔 Enable All** switch appears on the right
- [ ] Toggling group Enable All OFF → Big News stays ON for all circles in that group; other tiers OFF
- [ ] Toggling group Enable All ON → all tiers ON for every circle in that group
- [ ] If circles in the group have mixed tier states → group switch shows OFF

**Edge cases:**
- [ ] Single circle per group → per-group and per-circle switches should stay in sync
- [ ] After toggling group switch, open individual circle and confirm tiers match expected state

---

## Feature 11: Reply Threading & Quote Preview in Conversation

**Devices:** Android primary. iPhone for keyboard / layout parity.

### Reply threading order

- [ ] Open any post's conversation with multiple messages and at least one **reply** (message sent as a reply to another)
- [ ] Confirm replies appear immediately **after their parent message**, not at the bottom of the list
- [ ] Post a new root-level message; confirm it appears at the **end** of the list (after all threaded groups)
- [ ] Post a reply to an existing message; confirm it appears right after the parent, before subsequent root messages

### Reply banner quote preview (Android)

- [ ] Tap **Reply** on any message → reply banner appears at the bottom
- [ ] Confirm banner shows: `"Replying to [Name]"` + a **quoted preview** of the message text (up to 60 chars)
- [ ] For a short message: full text is shown
- [ ] For a long message: text is truncated with `…`
- [ ] Tap ✕ to close the reply banner → banner dismisses, input clears to normal

### Reply banner (iPhone)

- [ ] Repeat the above — confirm banner appears correctly above the keyboard on iOS
- [ ] No layout jump or gap below the banner after keyboard dismisses

### Quote block in message bubble

- [ ] Send a reply to a message
- [ ] Confirm the sent reply bubble shows a **left-border quote block** above the reply text, containing a preview of the original message
- [ ] For replies to long messages: confirm the quote preview is appropriately shortened

---

## Feature 12: Conversation Entry Animations Removed

**Devices:** Android primary.

### Setup
- Find or create a **Big News** or **Worth Knowing** post and open its conversation.

### Android

- [ ] Open the conversation for a Big News (🚨) post
- [ ] Confirm the header renders **immediately** with no scale-in animation
- [ ] Confirm there is **no confetti overlay** anywhere on screen
- [ ] Confirm there is **no glow / shimmer effect** behind the header
- [ ] Open a Worth Knowing post's conversation and repeat — same clean, static header
- [ ] For an Everyday post — confirm no change in behavior (already had no animations)

### iPhone

- [ ] Repeat for Big News and Worth Knowing conversation headers

---

## Feature 13: Post Detail Reaction Chip Tap + Haptics

**Devices:** Android primary, iPhone optional.

### Android

- [ ] Open a post detail with existing reaction chips (e.g. ❤️ 😂)
- [ ] Tap a chip you have **not** used yet → your reaction is added with that emoji
- [ ] Confirm a light haptic fires on chip tap
- [ ] Tap a chip you **already** reacted with → your reactions are removed (existing behavior)
- [ ] Long-press a post card in feed → confirm Android haptic now fires reliably

### iPhone

- [ ] Repeat chip tap add/remove checks and confirm behavior matches Android

---

## Feature 14: In-App Audio Recording (No Audio File Picker)

**Devices:** Android primary, iPhone parity check.

### Android

- [ ] In post composer, confirm audio toolbar icon is a **mic** (not music note)
- [ ] Tap mic icon → opens **Record Audio** screen (should not open file/folder picker)
- [ ] Tap **Start Recording** → timer starts
- [ ] Tap **Stop Recording** → recording is saved and **Use Recording** appears
- [ ] Tap **Use Recording** → returns to post composer and adds an audio item to media strip
- [ ] Confirm audio file upload picker is not shown anywhere in this flow

### iPhone

- [ ] Repeat start/stop/use flow and confirm same no-picker behavior

---

## Feature 15: Composer Hints + Reply Depth Rules

**Devices:** Android primary.

### Composer hints / reorder dismissal

- [ ] Add media in composer → caption hint card appears above strip
- [ ] Add media in composer → reorder hint card appears above strip
- [ ] Tap ✕ on each hint → only that hint dismisses
- [ ] Tap caption **T** on a media item → caption hint auto-dismisses
- [ ] Long-press a media item to start reorder → reorder hint auto-dismisses
- [ ] While reorder controls are visible, tap outside media strip area → reorder controls dismiss

### Conversation depth + visual alignment

- [ ] Send a reply to a root message (level 1) → shown under parent
- [ ] Reply to that reply (level 2) → shown under level 1 reply
- [ ] Long-press level 2 reply and try to reply again → warning banner appears: max depth reached
- [ ] Confirm reply connector line points toward the parent message avatar (not far-left offset)
- [ ] Confirm parent messages that have replies now show a vertical connector stem below the avatar so the thread path looks continuous
- [ ] For a 3-message chain (root -> reply -> reply-to-reply), confirm connectors appear visually connected across all rows
- [ ] For a parent with 2+ direct replies, confirm each sibling reply still shows a connector path from the same parent thread line (not just the first sibling)
- [ ] For replies, confirm the elbow corner is rounded (not a sharp 90-degree corner)
- [ ] For the last sibling in a reply group, confirm the parent spine does not continue downward past that final branch
- [ ] For a direct reply that has its own replies, confirm those nested replies do not break the original parent line for the later direct replies that come after it
- [ ] Scroll through a long nested thread and confirm connector lines are continuous with no visible gaps between row segments
- [ ] Confirm non-threaded messages remain unchanged

---

## Feature 16: Conversation Tier Banner Text Alignment

**Devices:** Android primary, iPhone parity check.

### Android

- [ ] Open a **Big News** post conversation and confirm the tier banner label text is centered within the banner area
- [ ] Open a **Worth Knowing** post conversation and confirm the tier banner label text is centered (not left-aligned)
- [ ] Confirm the emoji + label row stays visually centered across narrow and wide device widths

### iPhone

- [ ] Repeat Big News and Worth Knowing checks and confirm centered label text on iOS as well

---

## Feature 17: Post Detail Tier Banner Text Alignment

**Devices:** Android primary, iPhone parity check.

### Android

- [ ] Open a **Big News** post detail and confirm the tier banner label text is centered within the banner area
- [ ] Open a **Worth Knowing** post detail and confirm the tier banner label text is centered (not left-aligned)
- [ ] Confirm the emoji + label row stays visually centered across narrow and wide device widths

### iPhone

- [ ] Repeat Big News and Worth Knowing checks and confirm centered label text on iOS as well

---

## Feature 18: Post Create Draft Persistence + Media Screen Return Flow

**Devices:** Android primary, iPhone parity check.

### Camera/Gallery/Audio close behavior

- [ ] From Post Create, type text, choose a circle, and set priority to Worth Knowing
- [ ] Open Camera, then tap close (X) without posting
- [ ] Confirm you return to Post Create (not Feed) with your text/circle/priority preserved
- [ ] Open Gallery, cancel/close, and confirm you return to Post Create (not Feed)
- [ ] Open Audio Record, close (X), and confirm you return to Post Create (not Feed)

### Local draft persistence

- [ ] In Post Create, add text, one media item, and set a non-default priority
- [ ] Navigate away to Feed, then come back to Post Create
- [ ] Confirm draft content is restored locally (text/media/priority/circle)
- [ ] Add a pending status in the status prompt, leave and return, and confirm status is restored
- [ ] Dismiss the video limitation banner, leave and return, and confirm the dismissal state is preserved in the draft

### Cancel + reset behavior

- [ ] Tap Cancel with non-empty draft and confirm a destructive discard confirmation appears
- [ ] Cancel the confirmation and confirm draft remains intact
- [ ] Confirm again and discard; verify you land on Feed and draft is cleared
- [ ] Re-open Post Create and confirm it starts clean
- [ ] Confirm Reset is hidden on a fresh, untouched composer
- [ ] Add text/media/status or change priority/circle and confirm Reset appears
- [ ] Tap Reset with a filled draft and confirm destructive confirmation appears
- [ ] Confirm reset and verify text/media/status/priority/channel are reset to defaults on the same screen

### Publish success clears draft

- [ ] Create a draft with media and text, then publish successfully
- [ ] Return to Post Create after upload completes
- [ ] Confirm draft is cleared (fresh composer)

### Video limitation banner

- [ ] Confirm a thin banner appears above media action buttons warning that gallery video uploads are limited
- [ ] Confirm banner can be dismissed only via the close (X)
- [ ] Confirm banner text is readable and does not overlap bottom controls on small screens

### Android scroll behavior in Post Create

- [ ] On Android, add text + media + hints/banner and confirm the composer feels like one continuous vertical scroll area (no tiny top-only scroll region)
- [ ] Confirm priority chips, text area, status prompt, media strip, and video notice can all be reached in the same vertical scroll flow
- [ ] Confirm bottom toolbar remains fixed while content above it scrolls naturally

---

## Feature 19: Author Unread Leave Warning in Post Detail

**Devices:** Android primary, iPhone parity check.

### Author leave warning modal

- [ ] As the post host, create a post that has unread private notes and/or unread conversation messages (red indicator dots visible)
- [ ] Attempt to leave Post Detail (back button)
- [ ] Confirm an overlay appears before leaving and specifically mentions unread private notes and/or unread messages plus the red indicator
- [ ] Tap **Review Now** and confirm the overlay closes while staying on Post Detail
- [ ] Tap **Exit Post Anyway** and confirm navigation proceeds away from Post Detail
- [ ] Confirm there is clear visual spacing between **Exit Post Anyway** and **Don't show this again**

### Don't show again behavior

- [ ] Trigger the same leave warning and tap **Don't show this again**
- [ ] Confirm navigation proceeds away from Post Detail
- [ ] Re-open a different post as host with unread indicators and try leaving again
- [ ] Confirm the warning modal no longer appears (applies across posts)

### Post Activity unread message persistence

- [ ] As host, ensure a post has unread conversation activity (red message indicator)
- [ ] Open Post Activity in Unread Only scope and wait for the post card to become fully visible
- [ ] Confirm the unread message indicator does not clear just from visibility in Post Activity
- [ ] Open the conversation screen for that post, then return and confirm the message unread indicator clears as expected

### Post Detail leave behavior for unread indicators

- [ ] As host, open a post with only unread reaction activity and confirm indicator remains while still on Post Detail
- [ ] Leave Post Detail and confirm reaction unread indicator clears after exit
- [ ] As host, open a post with unread private notes and/or unread messages and confirm those indicators do not clear just from opening/leaving Post Detail
- [ ] Open Private Notes and confirm private-note unread clears there
- [ ] Open Conversation and confirm message unread clears there

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

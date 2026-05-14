# Notification Testing Plan

## How It Works (Quick Reference)

```
App writes doc → notifications/{id}
  → Cloud Function triggers
  → Looks up userNotificationSettings/{targetUserId}
  → Sends FCM push to all tokens in fcmTokens[]
  → Deletes the notification doc
```

The foreground handler (`DataListenerWrapper.tsx`, Effect 9) also shows an
in-app toast when a push arrives while the app is open.

---

## Prerequisites

1. **Sign in with a real account** (not demo mode — demo users have no FCM tokens).
2. **Grant notification permissions** when prompted, or go to
   Settings → Angelia → Notifications and enable them.
3. **Use a physical device** — simulators/emulators cannot receive FCM pushes.

---

## Step 1 — Find Your User ID

After signing in, open the Firebase Console → Firestore → `users` collection.
Find your document and copy your **user ID** (e.g. `abc123xyz`).

---

## Step 2 — Verify Your FCM Token Is Registered

In Firestore, open `userNotificationSettings/{yourUserId}`.
You should see a `fcmTokens` array with at least one entry like:

```json
{
  "deviceId": "...",
  "token": "fcm-token-string...",
  "deviceName": "iPhone 15 Pro"
}
```

If `fcmTokens` is empty or the document doesn't exist:
- Sign out and sign back in (token registration happens on sign-in).
- Check that notification permissions are granted on the device.

---

## Step 3 — Create a Test Notification in Firestore

Go to **Firestore Console → `notifications` collection → Add document**.

Set the **Document ID** to any unique string (e.g. `test-notif-1`).
Then add the fields for one of the scenarios below.

### Scenario A — Join Channel Request (you receive a request)

Someone wants to join one of your channels. You'll see an in-app toast and
a background push titled "New Join Request".

Replace `YOUR_USER_ID` with your real user ID.

```json
{
  "id": "test-notif-join-request-1",
  "type": "join_channel_request",
  "actorId": "fake-requester-id",
  "target": {
    "type": "user",
    "userId": "YOUR_USER_ID"
  },
  "createdAt": 1713484800000,
  "requesterId": "fake-requester-id",
  "requesterFirstName": "Taylor",
  "requesterLastName": "Test",
  "channelId": "YOUR_CHANNEL_ID",
  "channelName": "Your Channel Name",
  "joinRequestId": "fake-join-request-id"
}
```

> **Note:** `channelId` and `channelName` only affect the toast copy and the
> tap-routing deep link. They do not need to match a real Firestore channel
> for the push to fire.

---

### Scenario B — Join Request Accepted (your outgoing request was accepted)

You'll see an in-app toast titled "🎉 You've been accepted!" and a background
push titled "Request Accepted! 🎉".

```json
{
  "id": "test-notif-join-accepted-1",
  "type": "join_channel_accepted",
  "actorId": "fake-owner-id",
  "target": {
    "type": "user",
    "userId": "YOUR_USER_ID"
  },
  "createdAt": 1713484800000,
  "channelId": "any-channel-id",
  "channelName": "Cool Channel",
  "joinRequestId": "fake-join-request-id"
}
```

---

### Scenario C — Connection Request (you receive a request)

Someone wants to connect with you. You'll see an in-app toast and a background
push titled "🤝 Connection Request".

Replace `YOUR_USER_ID` with your real user ID, and `CONN_REQUEST_ID` with the
ID of the `connectionRequests` doc you want this notification to link to (it can
be a fake ID for push-delivery testing).

```json
{
  "id": "test-notif-conn-request-1",
  "type": "connection_request",
  "actorId": "fake-sender-id",
  "target": {
    "type": "user",
    "userId": "YOUR_USER_ID"
  },
  "createdAt": 1713484800000,
  "fromId": "fake-sender-id",
  "fromFirstName": "Jamie",
  "fromLastName": "Test",
  "connectionRequestId": "CONN_REQUEST_ID"
}
```

> **Note:** Tapping the push routes to `/(protected)/connection-request/[CONN_REQUEST_ID]`.
> The screen will show an error if `CONN_REQUEST_ID` is not a real Firestore doc —
> expected in testing mode.

---

### Scenario D — Connection Accepted (your request was accepted)

You'll see an in-app toast titled "🎉 You're connected!" and a background push
titled "🎉 You're connected!".

```json
{
  "id": "test-notif-conn-accepted-1",
  "type": "connection_accepted",
  "actorId": "fake-acceptor-id",
  "target": {
    "type": "user",
    "userId": "YOUR_USER_ID"
  },
  "createdAt": 1713484800000,
  "toFirstName": "Morgan",
  "toLastName": "Test",
  "connectionRequestId": "CONN_REQUEST_ID"
}
```

---

### Scenario E — New Post (per-circle tier preferences + attachments)

This is the new generalized post notification used for all post tiers.

- `tier` can be `everyday`, `worth-knowing`, or `big-news`.
- `hasAttachments` should be `true` when the post includes photos/videos.
- Delivery is filtered per recipient by `userNotificationSettings/{uid}.postByCircle[{channelId}]`:
  - `bigNewsEnabled`
  - `worthKnowingEnabled`
  - `everydayEnabled`
  - `withAttachmentsEnabled`

By default for each Circle, only `bigNewsEnabled` is on.

```json
{
  "id": "test-notif-new-post-1",
  "type": "new_post",
  "actorId": "fake-author-id",
  "target": {
    "type": "channel_tier",
    "channelId": "YOUR_CHANNEL_ID",
    "tier": "worth-knowing"
  },
  "createdAt": 1713484800000,
  "postId": "YOUR_POST_ID",
  "channelId": "YOUR_CHANNEL_ID",
  "channelName": "Book Club",
  "isDaily": false,
  "tier": "worth-knowing",
  "hasAttachments": true,
  "authorFirstName": "Alex",
  "authorLastName": "Test"
}
```

Expected behavior:
- Recipients who enabled either `worthKnowingEnabled` for this Circle OR
  `withAttachmentsEnabled` for this Circle should receive the push.
- Recipients with both toggles off should not receive this push.

---

### Scenario F — Private Note (you are the post Host and received a note)

A Circle member sent you a private note on one of your posts. You'll see an
in-app toast titled "🔒 Private note from …" and a background push with the
same message. Tapping either navigates to the private-notes screen for that post.

Replace `YOUR_USER_ID` with your real user ID and `YOUR_POST_ID` with the ID of
a post you authored. The note author can be a fake ID — it only affects the
display name in the toast/push copy.

```json
{
  "id": "test-notif-private-note-1",
  "type": "private_note",
  "actorId": "fake-author-id",
  "target": {
    "type": "user",
    "userId": "YOUR_USER_ID"
  },
  "createdAt": 1713484800000,
  "postId": "YOUR_POST_ID",
  "authorFirstName": "Jordan",
  "authorLastName": "Test"
}
```

> **Note:** Tapping the push routes to `/(protected)/private-notes/[YOUR_POST_ID]`.
> The screen will redirect back if `YOUR_POST_ID` is not a real post you authored
> or if there are no notes stored under it — expected in testing mode.

---

### Scenario G — Custom Circle Invite (you were invited by a connected Host)

You'll see an in-app toast prompting you to review the invite, and a background
push titled "✨ Circle Invite". Tapping routes directly to the invite review screen.

Replace `YOUR_USER_ID` with your real user ID and use a real `inviteCode` from
the Circle you want to test.

```json
{
  "id": "test-notif-custom-circle-invite-1",
  "type": "custom_circle_invite",
  "actorId": "fake-host-id",
  "target": {
    "type": "user",
    "userId": "YOUR_USER_ID"
  },
  "createdAt": 1713484800000,
  "inviterId": "fake-host-id",
  "inviterFirstName": "Avery",
  "inviterLastName": "Host",
  "requestId": "fake-circle-invite-id",
  "channelId": "YOUR_CUSTOM_CHANNEL_ID",
  "channelName": "Book Club",
  "inviteCode": "ABCDEFGH"
}
```

> **Note:** Tap handling sends users to `circle-invite/[requestId]`.
> If the request id is invalid, the invite screen will show an unavailable state — expected in test mode.

---

### Scenario H — Post Reaction (you are the Host)

Someone reacted to one of your posts. You'll see an in-app toast and a background
push. Tapping the notification opens the post detail screen.

Replace `YOUR_USER_ID` with your real user ID and `YOUR_POST_ID` with a post ID
you own.

```json
{
  "id": "test-notif-post-reaction-1",
  "type": "post_reaction",
  "actorId": "fake-reactor-id",
  "target": {
    "type": "user",
    "userId": "YOUR_USER_ID"
  },
  "createdAt": 1713484800000,
  "postId": "YOUR_POST_ID",
  "reactorFirstName": "Riley",
  "reactorLastName": "Test",
  "emoji": "🔥"
}
```

> **Cooldown behavior:** reaction pushes are throttled for 10 minutes per
> `targetUserId + actorId + postId`. If you create another `post_reaction`
> notification with the same target/actor/post immediately, the second one is
> consumed and deleted but should not send another push.

---

### Scenario I — Conversation Message (you are the Host)

Someone sent a message in your post conversation. You'll see an in-app toast and
a background push. Tapping the notification opens the conversation thread for
that post.

Replace `YOUR_USER_ID` with your real user ID and `YOUR_POST_ID` with a post ID
you own.

```json
{
  "id": "test-notif-conversation-message-1",
  "type": "conversation_message",
  "actorId": "fake-sender-id",
  "target": {
    "type": "user",
    "userId": "YOUR_USER_ID"
  },
  "createdAt": 1713484800000,
  "postId": "YOUR_POST_ID",
  "senderFirstName": "Jordan",
  "senderLastName": "Test",
  "messagePreview": "Just dropped a quick update in your conversation 💛"
}
```

> **Note:** Tap handling routes to `/(protected)/conversation?postId=...`.
> If `YOUR_POST_ID` is invalid, the conversation screen will show unavailable
> state — expected in test mode.

---

| App state | Expected behaviour |
|---|---|
| **Foreground** | In-app toast appears (DataListenerWrapper Effect 9). No system push shown. |
| **Background / killed** | System push notification appears in the notification tray. |

After the Cloud Function runs (usually within 1–2 seconds), the document will
be **automatically deleted** from the `notifications` collection. If the doc
persists, check the Cloud Function logs in Firebase Console → Functions → Logs.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Doc stays in Firestore | Cloud Function is not deployed or threw an error — check Functions logs |
| Doc deleted but no push received | `fcmTokens` is empty, permissions denied, or token is stale — sign out and back in |
| Toast not showing in foreground | App is not wrapped in `DataListenerWrapper`, or the `type` field value is wrong |
| Push arrives but tapping does nothing | `joinRequestId` / `channelName` in the data payload doesn't match a real doc — expected in test mode |

---

## Investigating Cloud Function Notification Failures

Use this guide when big-news (or any Cloud-Function-driven) notifications are
not appearing — neither in the foreground toast nor as a background system push.

### Step 1 — Confirm the Cloud Functions are deployed

1. Open [Firebase Console](https://console.firebase.google.com) → select your
   project → **Functions**.
2. Verify that `sendAppNotification` appears in the function list with a green
   status indicator.
3. If it is missing or shows an error, deploy it:
   ```bash
   npm run deploy:functions
   ```
   This runs `cd functions && npm run build && firebase deploy --only functions`.

### Step 2 — Verify the notification document is being written

After posting a **Big News** post from the app:

1. Open Firestore Console → `notifications` collection.
2. Within a second or two the document should appear and then disappear (the
   Cloud Function deletes it after processing).

**If the document never appears:**
- The client-side `sendBigNewsNotification` is failing silently. Open the app's
  JavaScript console / Metro logs and look for any `createAppNotification` or
  Firestore write errors.
- Confirm the posting user is **not** in demo mode — demo mode skips the real
  Firestore write entirely.

**If the document appears and stays:**
- The Cloud Function is not triggering. Continue to Step 3.

### Step 3 — Check Cloud Function logs

1. Firebase Console → **Functions** → **Logs** tab (or use the GCP Logs
   Explorer filtered to `resource.type="cloud_function"`).
2. Filter by function name `sendAppNotification`.
3. Look for:
   - `Successfully sent FCM to N tokens` — function ran and sent pushes.
   - `Failed to send FCM to token …` — function ran but FCM rejected a token
     (stale token — user should sign out and back in).
   - Any `Error` lines — indicates a runtime crash. Note the full stack trace.
4. If there are **no log lines** for `sendAppNotification` after a notification
   document was created, the Firestore trigger is not firing. Re-deploy the
   functions and try again.

### Step 4 — Verify the channel has subscribers

The `sendAppNotification` Cloud Function reads the channel's `subscribers` array
and fans out to each subscriber's FCM tokens.  If the array is empty (or only
contains the author), no one receives a push.

1. Firestore Console → `channels/{channelId}`.
2. Confirm your test user's UID is in the `subscribers` array.
3. If not, the test recipient must join the circle first (or for a daily circle,
   they must be connected to the channel owner).

### Step 5 — Verify the FCM token is registered on the recipient device

1. Firestore Console → `userNotificationSettings/{recipientUserId}`.
2. Confirm a `fcmTokens` array exists with at least one entry.
3. If missing or empty:
   - On the **physical device**, sign out of the app and sign back in.
     Token registration happens automatically on sign-in.
   - Confirm notification permissions are granted: device Settings → Angelia →
     Notifications → Allow.

### Step 6 — Try the manual Firestore test

Use **Scenario E** above to create a notification document directly in the
Firestore Console (bypassing the app entirely).  This isolates whether the
issue is in the client-side code or the Cloud Function.

- If the manual doc is processed and you receive a push: the problem is in
  `sendBigNewsNotification` / `postActions.ts` on the client.
- If the manual doc stays: the Cloud Function is not deployed or is crashing
  (see Steps 1–3).

### Step 7 — Common gotchas checklist

| Condition | Fix |
|---|---|
| Testing on iOS Simulator or Android Emulator | FCM does not deliver to simulators/emulators — use a **physical device** |
| Notification permissions not granted | Device Settings → Angelia → Notifications → enable |
| Signed in with demo account | Demo mode skips all real Firestore writes — sign in with a real account |
| Functions code changed locally but not deployed | Run `npm run deploy:functions` |
| Stale FCM token | Sign out and sign back in on the physical device |
| Recipient is the same user as the author | The Cloud Function excludes the post author from push recipients by design |
| Channel document missing `subscribers` field | Manually inspect the channel doc and ensure `subscribers` is a non-empty array |

---

## Re-running a Test

The Cloud Function triggers on **document creation**, so you must create a
**new document** each time. Either:
- Use a new unique Document ID (e.g. `test-notif-2`, `test-notif-3`), or
- Delete the old doc and re-create it with the same ID.

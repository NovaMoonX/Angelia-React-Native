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

### Scenario E — Big News Post (you are a subscriber of the channel)

A connected user or circle host published a `big-news` tier post. You'll see an
in-app toast titled "🌟 Big news from …!" and a background push with the same
message. Tapping either navigates to the post detail screen.

> **Important:** This notification uses a `channel_tier` target instead of a
> `user` target.  The Cloud Function reads the `channels/{channelId}` document
> to obtain the `subscribers` array, then fans out to all subscribers' FCM
> tokens (excluding the author).  Make sure `YOUR_CHANNEL_ID` refers to a real
> channel document that has your user ID in its `subscribers` array.

Replace `YOUR_USER_ID`, `YOUR_CHANNEL_ID`, and `YOUR_POST_ID` with real values.

```json
{
  "id": "test-notif-big-news-1",
  "type": "big_news_post",
  "actorId": "fake-author-id",
  "target": {
    "type": "channel_tier",
    "channelId": "YOUR_CHANNEL_ID",
    "tier": "big-news"
  },
  "createdAt": 1713484800000,
  "postId": "YOUR_POST_ID",
  "channelId": "YOUR_CHANNEL_ID",
  "isDaily": false,
  "authorFirstName": "Alex",
  "authorLastName": "Test"
}
```

For a **daily circle** big-news notification, change `"isDaily": true` and set
`channelId` to the daily channel ID (format: `{ownerId}-daily`).

> **Note:** Tapping the push routes to `/(protected)/post/[YOUR_POST_ID]`.
> The screen will show an error if `YOUR_POST_ID` is not a real Firestore post
> doc — expected in testing mode.

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

## Re-running a Test

The Cloud Function triggers on **document creation**, so you must create a
**new document** each time. Either:
- Use a new unique Document ID (e.g. `test-notif-2`, `test-notif-3`), or
- Delete the old doc and re-create it with the same ID.

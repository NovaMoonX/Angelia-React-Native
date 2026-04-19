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

## Step 4 — Observe the Result

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

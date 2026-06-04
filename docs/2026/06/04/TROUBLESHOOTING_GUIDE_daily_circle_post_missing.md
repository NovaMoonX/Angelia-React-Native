# Troubleshooting Guide: Investigate a Specific Missing Post Incident

## How to Investigate "User Got Notification But Post Not in Feed"

Use this step-by-step guide to diagnose what happened in a specific incident.

### Information You'll Need

Before starting, gather:
- **User ID** (Alice, who didn't see the post)
- **Author ID** (John, who posted)
- **Post ID** (specific post that was notified but not visible)
- **Approximate time of notification** (from user report or device log)
- **Post content or partial content** (to help identify the post)

---

## Step 1: Find the Post Document

**Go to:** Firebase Console → Firestore → `posts` collection

**Query:**
```
Find document with:
  - channelId: "{author_id}-daily" (e.g., "john-daily")
  - authorId: {author_id}
  - (Look for post matching the content description)
```

**Record:**
```
Post ID: ___________________
channelId: ___________________
authorId: ___________________
timestamp: ___________________
markedForDeletionAt: ___________________  ← KEY FIELD
```

### ✅ If `markedForDeletionAt` is NOT null (has a timestamp):

🎯 **ROOT CAUSE: Post Soft-Deleted**
- Post was deleted by author after being posted
- This is **Scenario A** (40% probability)
- Compare timestamp:
  - Post created: _________
  - Marked for deletion: _________
  - Time delta: _______ seconds
- If delta < 5 minutes, likely author quickly regretted/typo

**Diagnosis Complete.** Proceed to [Verify Post Ownership](#verify-post-ownership) as sanity check.

### ✅ If `markedForDeletionAt` IS null:

Continue to **Step 2**.

---

## Step 2: Check Connection Status

**Go to:** Firebase Console → Firestore → `connections` collection

**Query:**
```
collections/connections/{alice_id}/people/{john_id}
```

**Record:**
```
Connection exists: ☐ YES  ☐ NO
If YES:
  - userId: {john_id}
  - connectedAt: ___________________
```

### ✅ If connection DOES NOT exist:

🎯 **ROOT CAUSE: Connection Was Removed**
- User Alice and John were connected at time of post (notification sent)
- Connection was removed/deleted between notification send and feed read
- This is **Scenario B** (30% probability)

**Verify:** Check when connection was removed:
- Go to `disconnectRequests` collection (if still available)
- Look for request with `requesterId: {alice_id}` and `targetUserId: {john_id}`
- Check creation timestamp

**Diagnosis Complete.** Proceed to [Verify Subscriber Sync](#verify-subscriber-sync).

### ✅ If connection DOES exist:

Continue to **Step 3**.

---

## Step 3: Check Subscriber List in Channel

**Go to:** Firebase Console → Firestore → `channels` collection

**Query:**
```
channels/{john_id}-daily
```

**Record:**
```
Channel ID: {john_id}-daily
isDaily: true
subscribers: [list of user IDs]

Is {alice_id} in subscribers list?  ☐ YES  ☐ NO
```

### ✅ If `alice_id` is NOT in subscribers:

🎯 **ROOT CAUSE: User Removed from Subscribers**
- User was subscriber at time of post (notification sent)
- User was removed from `channel.subscribers` array
- This happens when Alice disconnects from John
- This is **Scenario B variant** (related to 30% probability)

**Check:** Is connection still present?
- If YES (connection exists but not in subscribers) → Sync issue, go to [Sync Verification](#verify-subscriber-sync)
- If NO (both connection and subscriber removed) → Normal disconnect, go to [Normal Disconnect Check](#normal-disconnect-check)

### ✅ If `alice_id` IS in subscribers:

Continue to **Step 4**.

---

## Step 4: Check Composite Firestore Index

**Go to:** Firebase Console → Firestore → Cloud Firestore → Indexes (Composite tab)

**Look for:**
```
Collection: posts
Fields: 
  - channelId (Ascending)
  - markedForDeletionAt (Ascending)
```

**Record:**
```
Index Status: 
  ☐ Enabled
  ☐ Building
  ☐ NOT FOUND ❌
```

### ✅ If index is NOT FOUND or Building:

🎯 **ROOT CAUSE: Missing or Incomplete Firestore Index**
- Post query cannot execute properly
- Posts from this channel appear invisible (query returns empty or errors silently)
- This is **Scenario D** (10% probability)

**Action:** Deploy index or wait for build to complete
```bash
cd apps/mobile
npm run deploy:indexes
```

**Diagnosis Complete.**

### ✅ If index is Enabled:

Continue to **Step 5**.

---

## Step 5: Check Cloud Function Logs

**Go to:** Google Cloud Console → Logs → Cloud Functions

**Query:**
```
resource.type="cloud_function"
resource.labels.function_name="sendAppNotification"
timestamp >= "{notification_time - 5min}"
timestamp <= "{notification_time + 5min}"
```

**Look for entries like:**
```
onDocumentCreated('notifications/{id}')
  → channel.subscribers read: ["alice", "bob", ...]
  → Checking notification settings for alice
  → Got FCM tokens: ["token1", "token2"]
  → Called sendFcmToTokens
```

**Record:**
```
Notification sent timestamp: ___________________
Recipients at send time: [list alice, bob, ...]
Was alice in the list?  ☐ YES  ☐ NO
```

### ✅ If alice was in recipients list at send time:

This confirms notification was sent to alice correctly. Proceed to **Step 6**.

### ❌ If alice was NOT in recipients list:

🎯 **Unexpected:** This would mean notification was not sent to alice at all.
- If user reported seeing notification, there's a discrepancy
- Could be logging delay or old logs cleared
- Go to [Device Notification Logs](#device-notification-logs)

---

## Step 6: Check Connection Removal Timing

**Go to:** Google Cloud Console → Logs → Cloud Functions

**Query:**
```
resource.type="cloud_function"
resource.labels.function_name="onDisconnectRequest"
timestamp >= "{notification_time}"
timestamp <= "{current_time}"

Search logs for:
  requesterId="{alice_id}"
  targetUserId="{john_id}"
```

**Record:**
```
onDisconnectRequest executed?  ☐ YES  ☐ NO

If YES:
  Disconnect timestamp: ___________________
  Time after notification send: _______ seconds
  
  If < 60 seconds: Connection removed very quickly
  If < 5 seconds: Disconnect happened during notification processing!
```

### ✅ If disconnect happened AFTER notification send:

🎯 **Confirms Root Cause B:** Connection removed after notification sent

**Timeline Summary:**
```
Notification sent:     T0 + {time}
Disconnect executed:   T0 + {time}
User read feed:        T0 + {time}

Post was invisible by the time feed was read ✅
```

**Diagnosis Complete.**

### ❌ If NO disconnect found:

Proceed to **Step 7** (Connection Divergence scenario).

---

## Step 7: Check Firestore Audit Logs for Read Denials

**Go to:** Google Cloud Console → Logs → Cloud Audit Logs

**Query:**
```
protoPayload.methodName="google.firestore.v1.Firestore.Read"
protoPayload.resourceName="projects/.../databases/.../documents/posts/{post_id}"
timestamp >= "{notification_time}"
severity="ERROR"
```

**Look for:**
```
Error message containing:
  - "Permission denied"
  - "PERMISSION_DENIED"
  - "Fail read"
```

**Record:**
```
Rule denial found?  ☐ YES  ☐ NO
If YES:
  Denied timestamp: ___________________
  Error message: _____________________________________
```

### ✅ If rule denial found:

🎯 **Confirms Scenario C:** Post query succeeded but security rules denied read

**Check which rule failed:**
- Look at error details for rule name
- Could be: `isConnectedToAuthorDailyChannel()`, `isChannelMember()`, etc.

**Timeline:**
```
Notification sent:     (connection was verified)
Read denied at:        {denial_timestamp}
Reason:                (check error message)
```

**Diagnosis Complete.**

### ❌ If NO read denials found:

This is unusual. Either:
- Logs not yet propagated (wait 5 min and retry)
- Post was never queried (feed query didn't include channel)
- Permission denial is happening at a different layer

Proceed to **Step 8** (Feed Query Verification).

---

## Step 8: Check Redux State Sync

**Required:** You'll need access to Alice's device or debug logs

**On Device (iOS/Android):**
1. Open app console (Chrome DevTools for web, or React Native debugger)
2. Find Redux store state
3. Look for:
   ```javascript
   state.connections.connections  // Should have john
   state.channels.connectionChannels  // Should have john-daily
   ```

**Or check Cloud Logging if telemetry available:**
```
Look for Redux dispatch events like:
  - setConnections([...])
  - setConnectionChannels([...])
  - setPosts([...])
```

**Record:**
```
When feed was opened:
  - connections.connections includes john?  ☐ YES  ☐ NO
  - channels.connectionChannels includes john-daily?  ☐ YES  ☐ NO
  - posts.items includes {post_id}?  ☐ YES  ☐ NO
```

### ✅ If john is in connections but john-daily NOT in channels:

🎯 **Redux State Divergence** between connections and channels
- Connection still exists, but daily channel wasn't fetched
- Likely a subscription management issue

**Check logs for:**
```
subscribeToConnectionChannels([connectedUserIds])
- Is this being called?
- What channel IDs is it receiving?
- Is john-daily in the response?
```

**Diagnosis Complete.**

### ❌ If john is NOT in connections:

This confirms connection was removed from Redux state before feed opened.

**Earlier Step 6 should have found the disconnect.** If not found, check if hard-delete (not via disconnect flow).

---

## Device Notification Logs

**On iOS:**
1. Settings → Notifications → Angelia
2. Check notification history if available
3. Look for timestamp of notification

**On Android:**
1. Settings → Apps → Notifications → Angelia
2. Check Notification Log (Android 14+)
3. Look for timestamp of notification

**Compare:**
```
Notification arrival time: ___________________
Feed opened time: ___________________
Difference: _______ seconds
```

If notification arrived but post invisible within seconds → likely post was deleted or connection removed.

---

## Summary Diagnosis Table

| Step | Check | Result | Root Cause | Probability |
|------|-------|--------|-----------|-------------|
| 1 | markedForDeletionAt | NOT null | Post Soft-Deleted | 40% |
| 2 | Connection exists | NO | Connection Removed | 30% |
| 3 | Subscriber list | Missing | Unsubscribed | 5% |
| 4 | Firestore index | Missing | Missing Index | 10% |
| 6 | Disconnect timing | Found | Confirmed Removal | 30% |
| 7 | Rule denials | Found | Read Denied | 15% |
| 8 | Redux state | Diverged | State Sync Issue | <5% |

---

## Verification Checklist

```
☐ Post document found in Firestore
☐ markedForDeletionAt status recorded
☐ Connection document status checked
☐ Channel subscribers list checked
☐ Composite Firestore index status verified
☐ Cloud Function logs reviewed
☐ onDisconnectRequest timing checked (if applicable)
☐ Firestore audit logs reviewed (if applicable)
☐ Redux state verified (if device access available)
```

---

## Common Patterns to Spot

### Pattern 1: Very Quick Deletion (Post Soft-Deleted)
```
timestamp: 1717498800000  (post created)
markedForDeletionAt: 1717498803000  (3 seconds later)
→ Author likely saw typo and deleted immediately
```

### Pattern 2: User Disconnected Shortly After Posting
```
Notification sent: 1717498802000
onDisconnectRequest: 1717498812000  (10 seconds later)
→ User decided to disconnect right after seeing notification
```

### Pattern 3: Connection Never Synced to Subscribers
```
connections/{alice}/people/{john}: EXISTS ✅
channels/john-daily.subscribers: MISSING ALICE ❌
→ Subscriber sync issue, check syncDailyChannelMembers dispatch
```

### Pattern 4: Silent Index Failure
```
No errors in logs
No denials in audit logs
But post invisible to user
→ Composite index not enabled, queries return empty silently
```

---

## If None of These Checks Find the Issue

This would be very unusual. If all checks come back clean:
1. Post not soft-deleted
2. Connection still exists
3. User in subscribers
4. Index enabled
5. No denials in logs

Then:
- **Check if user was actually connected** when post was created (verify `connectedAt` timestamp vs post timestamp)
- **Check if post created BEFORE connection** (post timestamp should be > connectedAt)
- **Check notification preferences** — was "big news" tier enabled? Check `userNotificationSettings/{alice_id}.bigNewsEnabled`
- **Check for Firestore rules errors** not captured in audit logs
- **Check browser console** for JavaScript errors preventing post fetch

---

## Escalation Path

| Severity | Evidence | Next Steps |
|----------|----------|-----------|
| Data Consistency Bug | Multiple incidents with same pattern | File bug, add logging, implement fix |
| User Error | Single incident, user deleted own post | Show toast explaining post was deleted |
| Index Issue | Multiple missing posts, index building | Monitor index deployment, force rebuild if needed |
| Security Rule Bug | Read denials with no clear reason | Review rule logic, test with sample data |
| Race Condition | Rare, timing-dependent incidents | Add debouncing, transaction guarantees, or buffering |


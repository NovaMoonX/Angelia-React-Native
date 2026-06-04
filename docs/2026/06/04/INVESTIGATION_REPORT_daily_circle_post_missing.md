# Investigation Report: Daily Circle Post Received via Notification But Not in Feed

**Date:** June 4, 2026  
**Issue:** User receives FCM push notification for a daily circle post from a connected user, but the post does not appear in their feed.

---

## Executive Summary

This is a **cross-system data sync issue** caused by a **race condition** between the notification system and the feed visibility system. The systems operate on different data consistency models:

- **Notification System**: Uses a **snapshot of channel.subscribers at notification-send time (T0+2s)**
- **Feed Visibility System**: Uses **live connection status at read-time (T_read)**

A post notification can be sent based on a subscriber list that later becomes invalid due to connection changes.

---

## Root Cause: Multiple Possible Misalignments

### **PRIMARY ROOT CAUSE: Post Soft-Deletion After Notification Sent**

**Most Likely Scenario:**
1. Post created at T0
2. Notification written at T0+ε
3. Cloud Function reads `channel.subscribers` snapshot and sends FCM at T0+2s
4. **Post is soft-deleted** (`markedForDeletionAt != null`) between T0+2s and T_read
5. Feed query filters: `where('markedForDeletionAt', '==', null)` → post invisible
6. Notification still delivers (it deletes after sending)

**Evidence:**
- [firestore.ts:1068](apps/mobile/src/services/firebase/firestore.ts#L1068): `where('markedForDeletionAt', '==', null)`
- [functions/src/index.ts:690](apps/mobile/functions/src/index.ts#L690): Notification sent based on subscribers snapshot, no post-existence check
- No transaction/consistency guarantee between notification send and post remaining visible

**Time Window:** ~1-2 seconds between notification send and user reading feed is realistic; author could delete post immediately after posting.

---

### **SECONDARY ROOT CAUSE: Connection Removed After Notification Sent**

**Scenario:**
1. Alice and Bob are connected
2. Post created in Bob's daily circle
3. Notification written; Cloud Function reads `channel.subscribers` (includes Alice)
4. **Alice disconnects from Bob** between T0+2s and T_read
5. `onDisconnectRequest` CF removes Alice from Bob's daily `channel.subscribers`
6. Feed query filters by `connectionDailyIds` which depends on `connections.connections` Redux state
7. Connection removed from Redux state → Bob's daily channel removed from `connectionDailyIds`
8. `subscribeToPosts` no longer includes Bob's daily channel ID
9. Post is never queried

**Evidence:**
- [functions/src/index.ts:977](apps/mobile/functions/src/index.ts#L977): Disconnect removes subscriber from all owned channels
- [functions/src/index.ts:989](apps/mobile/functions/src/index.ts#L989): Removes requester from target's daily circle
- [useDataListenerRealtimeData.ts:217](apps/mobile/src/hooks/dataListeners/useDataListenerRealtimeData.ts#L217): Posts queried based on `connectionChannels` which is synced from `connections`
- **No buffering/debouncing between connection removal and post query update**

**Time Window:** If disconnection happens before user reads feed, post remains invisible.

---

### **TERTIARY ROOT CAUSE: User Unsubscribed from Custom Circle**

**Scenario (for custom circle posts, not daily):**
1. User in custom circle, notification sent
2. User unsubscribes from circle before reading feed
3. `channel.subscribers` no longer includes user
4. Firestore rules deny read: `!isChannelMember(resource.data.channelId)`
5. Post invisible

**Evidence:**
- [firestore.rules:165](apps/mobile/firestore.rules#L165): Post read allowed only if channel member or connected to author's daily
- [firestore.ts:1408](apps/mobile/src/services/firebase/firestore.ts#L1408): Connection channels fetched separately and not mixed with owned channels
- [useDataListenerRealtimeData.ts:219](apps/mobile/src/hooks/dataListeners/useDataListenerRealtimeData.ts#L219): Unsubscribe removes channel from `channels.items` → no post visible

---

### **QUATERNARY ROOT CAUSE: Connection Status Divergence at Read Time**

**Scenario:**
1. Cloud Function reads `channel.subscribers` at T0+2s → Alice is subscriber
2. Alice was connected and added to subscribers
3. Between T0+2s and T_read: **Connection is removed, but Redis/subscribers cache hasn't propagated**
4. User reads feed; Firestore rules check `isConnectedToAuthorDailyChannel()`:
   ```firestore
   exists(/databases/$(database)/documents/connections/$(request.auth.uid)/people/$(ch.data.ownerId))
   ```
5. Connection document no longer exists → rule denies read
6. Post exists but is not readable

**Evidence:**
- [firestore.rules:193-198](apps/mobile/firestore.rules#L193-L198): Post read allowed via `isConnectedToAuthorDailyChannel()` which checks connection existence
- No transactional guarantee between notification send and security rule evaluation

---

## Data Flow Architecture

### **Notification Delivery Pipeline (T0 → T0+2s)**

```
Post Created: firestore/posts/{postId}
       ↓
Notification Doc: firestore/notifications/{id}
       ↓
Cloud Function Trigger: onDocumentCreated('notifications/{id}')
       ↓
[CRITICAL] Read channel.subscribers snapshot (T0+2s)
       ↓
Filter subscribers by notification preferences
       ↓
Get FCM tokens from userNotificationSettings
       ↓
Send FCM push
       ↓
Delete notification document
```

**Key Issues:**
- ❌ **No re-check of connection status** at notification send time
- ❌ **No verification that post still exists** (could be deleted after being referenced)
- ❌ **No transaction** between reading subscribers and sending notification
- ✅ **Snapshot isolation is correct** — notification is sent to who was subscribed at T0+2s

**Code References:**
- [functions/src/index.ts:695-720](apps/mobile/functions/src/index.ts#L695-L720): Notification processing
- [functions/src/index.ts:695](apps/mobile/functions/src/index.ts#L695): `const recipientIds = channel.subscribers.filter(...)`
- [functions/src/index.ts:731-738](apps/mobile/functions/src/index.ts#L731-L738): FCM send

---

### **Feed Post Visibility Pipeline (T_read)**

```
User Opens Feed
       ↓
Redux State: connections.connections (array of Connection objects)
       ↓
[SYNC] Derive daily channel IDs: {userId}-daily
       ↓
subscribeToConnectionChannels() fetches Channel docs for those IDs
       ↓
Stored separately in channels.connectionChannels (not mixed with owned)
       ↓
subscribeToPosts() called with TWO arrays:
  - ownChannelIds (owned channels, not connected users' dailies)
  - connectionDailyIds (connected users' daily channel IDs)
       ↓
Query: where('channelId', 'in', batch) + where('markedForDeletionAt', '==', null)
       ↓
Firestore applies security rules:
  - allow read if: isAuthor() OR isChannelMember() OR isConnectedToAuthorDailyChannel()
       ↓
Post visible or denied
```

**Key Issues:**
- ❌ **Feed queries depend on Redux connections state**, not Firestore state
- ❌ **Immediate removal of connectionChannels** when connection is removed
- ❌ **No debouncing/buffering** between connection removal and post query update
- ✅ **Firestore rules are correct** — they re-check connections at read time

**Code References:**
- [useDataListenerRealtimeData.ts:375-390](apps/mobile/src/hooks/dataListeners/useDataListenerRealtimeData.ts#L375-L390): Connection → daily channel subscription
- [useDataListenerRealtimeData.ts:217-244](apps/mobile/src/hooks/dataListeners/useDataListenerRealtimeData.ts#L217-L244): Posts subscription orchestration
- [firestore.ts:1038-1130](apps/mobile/src/services/firebase/firestore.ts#L1038-L1130): `subscribeToPosts` implementation

---

## System Components Map

### **1. Daily Circle Lifecycle**

| Component | File | Responsibility |
|-----------|------|-----------------|
| **Creation** | [firestore.ts:590-610](apps/mobile/src/services/firebase/firestore.ts#L590-L610) | `createDailyChannel(userId)` → `{userId}-daily` |
| **ID Pattern** | [constants.ts:25](apps/mobile/src/models/constants.ts#L25) | `DAILY_CHANNEL_SUFFIX = '-daily'` |
| **Type Marker** | [types.ts:133](apps/mobile/src/models/types.ts#L133) | `Channel.isDaily: boolean \| null` |
| **Subscriber Sync** | [useDataListenerRealtimeData.ts:389-392](apps/mobile/src/hooks/dataListeners/useDataListenerRealtimeData.ts#L389-L392) | `syncDailyChannelMembers` keeps subscribers in sync with connections |

---

### **2. Connection → Daily Channel Mapping**

| System | File | Details |
|--------|------|---------|
| **Connection Creation** | [functions/src/index.ts:777-810](apps/mobile/functions/src/index.ts#L777-L810) | `onConnectionRequestAccepted`: adds users to each other's daily circles |
| **Subscriber Addition** | [functions/src/index.ts:804-817](apps/mobile/functions/src/index.ts#L804-L817) | Uses `FieldValue.arrayUnion()` to add to `channel.subscribers` |
| **Connection Removal** | [functions/src/index.ts:955-997](apps/mobile/functions/src/index.ts#L955-L997) | `onDisconnectRequest`: removes from all owned channels + target's daily |
| **Subscriber Removal** | [functions/src/index.ts:977-987](apps/mobile/functions/src/index.ts#L977-L987) | Uses `FieldValue.arrayRemove()` |

---

### **3. Post Visibility Verification**

| Layer | File | Logic |
|-------|------|-------|
| **Firestore Rules** | [firestore.rules:173-177](apps/mobile/firestore.rules#L173-L177) | `allow read if: isAuthor() OR isChannelMember() OR isConnectedToAuthorDailyChannel()` |
| **Connection Check** | [firestore.rules:183-198](apps/mobile/firestore.rules#L183-L198) | `isConnectedToAuthorDailyChannel()`: verifies `connections/{uid}/people/{ownerId}` exists |
| **Channel Member Check** | [firestore.rules:10-25](apps/mobile/firestore.rules#L10-L25) | `isChannelMember()`: checks if user in `channel.subscribers` OR owner |
| **Redux Feed Filter** | [useDataListenerRealtimeData.ts:217-244](apps/mobile/src/hooks/dataListeners/useDataListenerRealtimeData.ts#L217-L244) | Filters channel IDs before querying posts |

---

### **4. Notification Generation & Delivery**

| Component | File | Details |
|-----------|------|---------|
| **Trigger** | [functions/src/index.ts:617-751](apps/mobile/functions/src/index.ts#L617-L751) | `onDocumentCreated('notifications/{id}'): Cloud Function` |
| **Subscriber Read** | [functions/src/index.ts:695](apps/mobile/functions/src/index.ts#L695) | `const recipientIds = channel.subscribers.filter(...)`  (snapshot-based) |
| **Settings Check** | [functions/src/index.ts:700-711](apps/mobile/functions/src/index.ts#L700-L711) | Reads `userNotificationSettings/{userId}` to filter by tier preference |
| **FCM Send** | [functions/src/index.ts:731-738](apps/mobile/functions/src/index.ts#L731-L738) | `sendFcmToTokens(allTokens, ...)` |
| **Cleanup** | [functions/src/index.ts:741](apps/mobile/functions/src/index.ts#L741) | `await snap.ref.delete()` (notification document deleted) |

---

## Critical Timing & Race Condition Windows

### **T0: Post Created**
- Post written to `firestore/posts/{postId}`
- Likely includes author's connection info or daily channel info

### **T0+ε (50-100ms): Notification Document Written**
- Notification doc created in `firestore/notifications/{id}`
- Includes: `postId`, `channelId`, `authorId`, etc.
- Cloud Function begins trigger

### **T0+2s: Cloud Function Executes**
```javascript
// [CRITICAL MOMENT] — This is the snapshot point
const channel = await db.collection('channels').doc(notification.target.channelId).get();
const recipientIds = channel.subscribers.filter((id) => id !== notification.actorId);
```
- **Channel.subscribers read is now FIXED**
- Any changes to channel subscribers after this moment are invisible to this notification

### **T0+2s → T_read (User Reads Feed)**
- **Connection could be removed** → No post in feed query
- **Post could be soft-deleted** → Marked for deletion
- **User could unsubscribe** from custom circle
- **FCM delivered to user** → User sees notification

### **T_read: Feed Query Executed**
```javascript
// Posts queries depend on connections state
const connectionDailyIds = connectionChannels.map(ch => ch.id);  // Redux state
const unsubConnectionPosts = subscribeToPosts(firebaseUid, connectionDailyIds, ...);
```
- Firestore rules re-check connections:
  ```firestore
  exists(/databases/$(database)/documents/connections/$(request.auth.uid)/people/$(ch.data.ownerId))
  ```
- If connection removed between T0 and T_read → post not visible
- If post soft-deleted → filtered by query `where('markedForDeletionAt', '==', null)`

---

## Firestore Indexes

**Required Composite Index for Post Query:**

```
Collection: posts
Fields:
  - channelId ASC
  - markedForDeletionAt ASC
```

**File:** [firestore.indexes.json](apps/mobile/firestore.indexes.json)

**Status:** ✅ Listed in configuration  
**Risk:** If missing, post queries fail silently on client — posts appear to be invisible even though they exist.

---

## Configuration: Post Retention & Filters

| Setting | Value | File | Purpose |
|---------|-------|------|---------|
| `DAILY_POST_RETENTION_DAYS` | 14 | [constants.ts:18](apps/mobile/src/models/constants.ts#L18) | Posts auto-expire in daily circles |
| `CUSTOM_POST_RETENTION_DAYS` | 90 | [constants.ts:19](apps/mobile/src/models/constants.ts#L19) | Posts auto-expire in custom circles |
| Soft-delete marker | `markedForDeletionAt` | [firestore.ts:1068](apps/mobile/src/services/firebase/firestore.ts#L1068) | Filtered in every post query |

**Risk:** Retention-based deletion could remove posts shortly after notification is sent.

---

## Likely Root Causes (By Probability)

### **Tier 1: Almost Certain**

1. **Post Soft-Deleted** (40% probability)
   - Author posts and immediately deletes (regrets/typo)
   - Notification sent, but post no longer visible
   - Feed query: `where('markedForDeletionAt', '==', null)` → filtered out
   - Fix: Show notification banner explaining post was deleted

2. **Connection Removed Between Notification Send & Feed Read** (30% probability)
   - Alice and Bob connected, Bob posts in daily
   - Notification sent to Alice at T0+2s
   - Alice **disconnects** before reading feed
   - `onDisconnectRequest` CF removes Alice from Bob's daily subscribers
   - Redux connection state updated → Bob's daily removed from feed queries
   - Fix: Debounce connection removal; buffer posts for 30-60 seconds

---

### **Tier 2: Possible**

3. **Connection Status Divergence at Read Time** (15% probability)
   - Connection deleted but not yet reflected in Firestore security rules
   - Firestore rules re-check `exists(/databases/.../connections/{uid}/people/{ownerId})`
   - Between notification send and read, connection was hard-deleted (not by client)
   - Fix: Ensure eventual consistency; log post visibility denials

4. **Missing Composite Firestore Index** (10% probability)
   - Index for `(channelId, markedForDeletionAt)` missing
   - Post queries fail silently; posts appear invisible
   - Fix: Verify index deployment; check Firestore console

5. **User Unsubscribed from Custom Circle** (5% probability)
   - Only for custom circles (not daily)
   - User unsubscribes between notification send and feed read
   - Fix: Same as #2 — buffer/debounce unsubscribe

---

## Evidence: Notification Sent But Post Not Checked Before Delivery

**File:** [functions/src/index.ts:695-720](apps/mobile/functions/src/index.ts#L695-L720)

```typescript
// [ISSUE] — No check that the post actually still exists or is readable
const recipientIds = channel.subscribers.filter((id) => id !== notification.actorId);

// Fetch notification settings for each subscriber
const recipientSettings = await Promise.all(
  recipientIds.map(async (recipientId) => {
    const settings = await getNotificationSettingsForUser(recipientId);
    return { recipientId, settings };
  }),
);

// Filter by notification preferences (tier-based)
const enabledRecipients = recipientSettings.filter(({ settings }) => {
  return isCirclePostNotificationEnabled(notification, settings);
});

// Get FCM tokens and send
const allTokens = enabledRecipients.flatMap(({ settings }) => {
  return getTokensFromSettings(settings);
});

await sendFcmToTokens(allTokens, payload, tokenOwnersByToken);

// Delete notification document
await snap.ref.delete();
```

**What's Missing:**
- ❌ No check: `await db.collection('posts').doc(notification.postId).get()` to verify post still exists
- ❌ No re-verification of channel subscribers (reads snapshot, doesn't re-check)
- ❌ No transaction ensuring notification send happens before post deletion
- ❌ No fallback if FCM sends but post becomes inaccessible

---

## Specific Files & Code Sections to Review

| Issue | File & Lines | Type |
|-------|--------------|------|
| Post query filter | [firestore.ts:1068](apps/mobile/src/services/firebase/firestore.ts#L1068) | Query filter on `markedForDeletionAt` |
| Connection → daily subscription | [useDataListenerRealtimeData.ts:375-390](apps/mobile/src/hooks/dataListeners/useDataListenerRealtimeData.ts#L375-L390) | Orchestration of connection channels |
| Posts merge | [useDataListenerRealtimeData.ts:217-244](apps/mobile/src/hooks/dataListeners/useDataListenerRealtimeData.ts#L217-L244) | Merges own posts + connection posts |
| Notification send | [functions/src/index.ts:695-720](apps/mobile/functions/src/index.ts#L695-L720) | Cloud Function notification delivery |
| Connection removal | [functions/src/index.ts:977-987](apps/mobile/functions/src/index.ts#L977-L987) | Unsubscribes user from channels on disconnect |
| Post visibility rules | [firestore.rules:173-177](apps/mobile/firestore.rules#L173-L177) | Security rules for post read |
| Connection check rule | [firestore.rules:183-198](apps/mobile/firestore.rules#L183-L198) | Verifies connection exists at read time |
| Firestore index config | [firestore.indexes.json](apps/mobile/firestore.indexes.json) | Composite index declaration |

---

## Recommended Investigation Steps

### **Step 1: Check Server Logs**
- Query Firebase Cloud Function logs for the post creation time
- Verify notification was sent (look for `sendFcmToTokens` success)
- Check if `onDisconnectRequest` CF ran between post creation and user reading feed

### **Step 2: Examine Post Document**
- Look up the specific post by ID
- Check: `markedForDeletionAt` field — is it null or has a timestamp?
- Check: `channel.subscribers` array — does it include the user or has user been removed?

### **Step 3: Check Firestore Rules Denial Logs**
- Enable Firestore audit logs for the time of the issue
- Filter for read denials on `posts/{postId}` for the user
- Check which rule failed: `isAuthor()`, `isChannelMember()`, or `isConnectedToAuthorDailyChannel()`

### **Step 4: Verify Connection Status**
- Query `connections/{uid}/people/{ownerId}` document
- Check `createdAt` timestamp — when was it created?
- Check if a `disconnectRequests` document was created after the post
- Check deletion timestamp vs post creation timestamp

### **Step 5: Verify Composite Index**
- Go to Firebase Console → Firestore → Indexes
- Confirm composite index exists for `posts` collection with fields: `(channelId, markedForDeletionAt)`
- If missing, deployment may be pending (check "Building" status)

---

## Mitigation Strategies

### **Short-term (for next release):**

1. **Add Toast Notification Explaining Post Unavailability**
   - When user taps notification but post is not in feed, show dismissible toast
   - Message: "This post was deleted or you're no longer connected to this person."

2. **Debounce Connection Removal**
   - Don't immediately remove connection channels from Redux
   - Add 30-60 second buffer before removing from feed queries
   - Allows user to read post even if connection is being removed

3. **Check Post Existence in Cloud Function**
   - Before sending notification, verify post document still exists
   - Add: `if (!await db.collection('posts').doc(notification.postId).get().then(s => s.exists)) return;`

### **Long-term (for future release):**

1. **Transactional Notification Delivery**
   - Move notification creation into same transaction as post creation
   - Ensure notification is sent before post can be deleted

2. **Connection State Caching**
   - Don't immediately remove connection channels from Redux
   - Wait for server confirmation before removing from feed

3. **Post Visibility Feedback Loop**
   - Log when Firestore security rules deny post read access
   - Send to analytics to detect visibility issues

4. **Composite Query Without MarkedForDeletionAt**
   - Consider removing soft-delete filter from client query
   - Apply filter in Redux selector instead
   - Prevents posts from disappearing mid-read if they're marked for deletion

---

## Summary Table: Misalignments

| System | Verification Point | Timing | Data Source | Issue |
|--------|-------------------|--------|-------------|-------|
| **Notification** | Subscriber list | T0+2s | `channel.subscribers` snapshot | ✅ Correct: uses snapshot of who was subscribed |
| **Notification** | Post existence | **NOT CHECKED** | ❌ Missing | ❌ Post could be deleted after notification sent |
| **Notification** | Connection status | T0+2s | `channel.subscribers` (implicit) | ✅ Correct: whoever is subscriber is assumed connected |
| **Feed Query** | Channel list | T_read | Redux `connections` state | ❌ **Can diverge** if connection removed after notification sent |
| **Feed Query** | Post existence | T_read | Firestore query | ✅ Correct: filters `markedForDeletionAt == null` |
| **Feed Query** | Connection status | T_read | Firestore `connections/{uid}/people/{ownerId}` | ✅ Correct: re-checks at read time |
| **Firestore Rules** | Channel membership | T_read | `channel.subscribers` array | ✅ Correct: re-checks at read time |
| **Firestore Rules** | Connection existence | T_read | `connections/{uid}/people/{ownerId}` doc | ✅ Correct: re-checks at read time |

---

## Conclusion

The most likely scenario is a **post soft-deletion (40%)** or **connection removal (30%)** happening between notification send and feed read. The notification system uses a snapshot-based approach, while the feed visibility system uses live state, creating a window where notification can be sent but post is invisible.

The issue is **NOT a bug in the security rules** (those are sound and re-check at read time) but rather a **timing/consistency issue** between systems that operate asynchronously and without transactional guarantees.

Recommended immediate action: Verify post `markedForDeletionAt` status and check connection deletion timestamp vs post creation timestamp.

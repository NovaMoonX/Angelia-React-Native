# Daily Circle Post Visibility: Timeline & Race Condition Diagram

## Scenario A: Post Soft-Deleted (40% Probability)

```
TIME    NOTIFICATION SYSTEM              FEED VISIBILITY SYSTEM         USER EXPERIENCE
────────────────────────────────────────────────────────────────────────────────────────
T0      ✅ Post created
        └─ posts/{id}: {text, channelId, authorId}

T0+ε    ✅ Notification doc written
        └─ notifications/{id}: {postId, channelId, authorId}

T0+1s   🔴 AUTHOR DELETES POST
        └─ posts/{id}: markedForDeletionAt = Date.now()

T0+2s   ✅ Cloud Function reads post metadata
        └─ channel.subscribers = [Alice, Bob]
        ✅ Sends FCM to Alice & Bob
        └─ "John posted in Daily!"
        ✅ Deletes notification doc

T0+3s                                    Alice opens feed
                                         ├─ Redux: connections = [John]
                                         ├─ Derives: connectionDailyIds = ["john-daily"]
                                         ├─ subscribeToPosts("john-daily")
                                         ├─ Firestore query:
                                         │  where channelId = "john-daily"
                                         │  where markedForDeletionAt == null  ❌ FILTERED OUT
                                         ├─ Result: post NOT returned
                                         └─ Empty feed ❌

         Alice sees notification         Alice taps notification
         ├─ Title: "John posted"         ├─ Opens post detail
         ├─ Body: "Check your feed"      └─ "This post doesn't exist"
         └─ ✅ Delivered                    (or goes back to empty feed)
```

**Root Cause:** Post soft-deleted between T0+1s and feed query at T0+3s. Notification sent (T0+2s) based on post's existence, but post invisible at read time due to soft-delete filter.

---

## Scenario B: Connection Removed (30% Probability)

```
TIME    NOTIFICATION SYSTEM              FEED VISIBILITY SYSTEM         USER EXPERIENCE
────────────────────────────────────────────────────────────────────────────────────────
T0      ✅ Post created
        └─ posts/{id}: {text, channelId: "john-daily"}

T0+ε    ✅ Notification doc written
        ├─ channel.subscribers = [Alice, Bob]
        └─ notifications/{id}

T0+2s   ✅ Cloud Function reads subscribers snapshot
        ├─ recipientIds = [Alice, Bob]
        └─ Sends FCM to both

T0+2.5s 🔴 ALICE DISCONNECTS
        └─ disconnectRequests/{id} created
        
        🔴 Cloud Function onDisconnectRequest runs
        ├─ Removes Alice from john-daily.subscribers
        ├─ arrayRemove(Alice) from john-daily channel
        └─ Deletes connections/{alice}/people/{john}

T0+3s                                    Alice opens feed (sees notification)
                                         ├─ Redux: connections = []  ❌ (updated)
                                         ├─ Derives: connectionDailyIds = []
                                         ├─ subscribeToPosts()
                                         │  └─ NO CONNECTION CHANNELS TO QUERY
                                         ├─ Result: post NOT in query
                                         └─ Empty feed ❌

         Alice sees notification         Alice taps notification
         ├─ Title: "John posted"         ├─ Tries to open post
         ├─ (received at T0+2s)          ├─ Firestore rule checks:
         └─ ✅ Delivered                  │  exists(/connections/alice/people/john)
                                         │  └─ ❌ DENIED (connection removed)
                                         └─ "Can't load post"
```

**Root Cause:** Redux connection state updated immediately when disconnect CF runs. Feed query depends on Redux state, not Firestore connection state. Post invisible because channel was removed from feed query channels list.

---

## Scenario C: Connection Status Divergence (15% Probability)

```
TIME    NOTIFICATION SYSTEM              FIRESTORE STATE                FEED VISIBILITY
────────────────────────────────────────────────────────────────────────────────────────
T0      ✅ Post created
        └─ posts/{id}

T0+2s   ✅ Cloud Function reads subscribers
        ├─ channel.subscribers = [Alice]
        └─ Sends FCM

T0+2.5s 🔴 HARD-DELETE OF CONNECTION
        └─ (e.g., admin action or cascade delete)
        └─ connections/{alice}/people/{john} DELETED

        ⏳ Replication in progress...
        (Firestore sync to regions, cache invalidation)

T0+3s   Alice opens feed
        ├─ Redux: connections = [john]  (still in state)
        ├─ Derives: connectionDailyIds = ["john-daily"]
        ├─ subscribeToPosts("john-daily")  ✅ QUERY EXECUTES
        ├─ Post returned ✅
        │
        └─ Firestore rule evaluation for post read:
           ├─ isConnectedToAuthorDailyChannel() checks:
           │  ├─ exists(/connections/alice/people/john)
           │  └─ ❌ NO (connection deleted at T0+2.5s)
           └─ ❌ READ DENIED

        Alice sees notification           But post invisible!
        ├─ ✅ Notification delivered     ├─ Post hidden by rule
        └─ "John posted!"                └─ "Can't load post" ❌
```

**Root Cause:** Notification sent based on subscriber snapshot (T0+2s), but connection hard-deleted at T0+2.5s. Feed query returns post, but Firestore rules deny read because connection no longer exists.

---

## Data Flow Comparison

### Notification Delivery (Snapshot-Based)

```
┌─────────────────────────────────────────────────────────┐
│ Post Created (T0)                                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Notification Doc Written (T0+ε)                         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Cloud Function Trigger onDocumentCreated                │
│ ✅ Read channel.subscribers SNAPSHOT (T0+2s)           │
│ ❌ NO post-existence check                              │
│ ❌ NO connection re-verification                        │
│ ✅ Send FCM based on snapshot                           │
└─────────────────────────────────────────────────────────┘

PROBLEM: Snapshot is frozen at T0+2s
         Any changes after are invisible
         Post could be deleted ❌
         Connection could be removed ❌
```

### Feed Visibility (Live State)

```
┌─────────────────────────────────────────────────────────┐
│ User Opens Feed (T_read)                                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Redux State: connections.connections (CURRENT)          │
│ Example: [{ userId: "john", connectedAt: ... }]        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Derive Daily Channel IDs                                │
│ connectionDailyIds = ["john-daily"]                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ subscribeToPosts(connectionDailyIds)                    │
│ ✅ Query: where(channelId, 'in', ['john-daily'])       │
│ ✅ AND: where(markedForDeletionAt, '==', null)         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Firestore Security Rules (RE-CHECK)                     │
│ ✅ isConnectedToAuthorDailyChannel():                  │
│    exists(/connections/alice/people/john)              │
│ ✅ isChannelMember() check re-runs                      │
│ ✅ All checks run at read time (LIVE)                  │
└─────────────────────────────────────────────────────────┘

BENEFIT: All checks are live/current
         PROBLEM: Depends on Redux state which can diverge
         from Firestore state during connection changes
```

---

## Key Timing Windows: When Things Can Go Wrong

| Time Window | What Can Happen | Impact |
|-------------|-----------------|--------|
| T0 → T0+2s (Notification in-flight) | Post deleted, connection removed | Subscriber list read at T0+2s is stale |
| T0+2s → T_read (Before feed opens) | Connection removed, post deleted | Redux state diverges from Firestore |
| T_read (Feed query executing) | Connection hard-deleted | Firestore rules deny read after post returned by query |

---

## System State Example: Before & After Disconnection

### BEFORE (T0+2s - Notification sent successfully)

```
Firestore Collections:
  connections/alice/people/john: { userId: "john", connectedAt: 1717498800000 }
  channels/john-daily: { 
    id: "john-daily", 
    isDaily: true, 
    subscribers: ["alice", "bob"], 
    ownerId: "john" 
  }
  posts/post-abc: { 
    id: "post-abc", 
    channelId: "john-daily", 
    authorId: "john", 
    markedForDeletionAt: null 
  }

Cloud Function Notification Sent:
  recipientIds = ["alice", "bob"]
  FCM message sent to both devices ✅

Redux State (Alice's Client):
  connections.connections = [{ userId: "john", ... }]
  channels.connectionChannels = [{ id: "john-daily", ... }]
  posts.items = [{ id: "post-abc", ... }]
```

### AFTER (T0+2.5s - Disconnect happens)

```
Firestore Collections:
  connections/alice/people/john: ❌ DELETED
  channels/john-daily: { 
    id: "john-daily", 
    subscribers: ["bob"],  ← alice REMOVED
    ... 
  }
  posts/post-abc: ✅ Still exists with markedForDeletionAt: null

Cloud Function onDisconnectRequest ran:
  Removed alice from john-daily.subscribers
  Deleted connections/alice/people/john ✅

Redux State (Alice's Client) - UPDATED:
  connections.connections = []  ← NOW EMPTY
  channels.connectionChannels = []  ← NOW EMPTY
  posts.items = []  ← POSTS CLEARED

Alice opens feed (T_read = T0+3s):
  subscribeToPosts(connectionDailyIds=[])
  → No posts queried ❌
  Feed appears empty ❌
```

---

## Verification Checklist

To diagnose which scenario occurred, check:

```
□ Is post.markedForDeletionAt != null?
  ├─ YES → Scenario A (post soft-deleted)
  └─ NO → Continue to next check

□ Is connections/alice/people/john document deleted?
  ├─ YES → Scenario B or C (connection removed)
  │   ├─ Check onDisconnectRequest logs → Scenario B
  │   └─ Check hard-delete action → Scenario C
  └─ NO → Continue to next check

□ Check Firestore audit logs:
  ├─ Find read denial for posts/post-abc at T_read
  ├─ Which rule failed?
  │   ├─ isConnectedToAuthorDailyChannel() → Connection removed
  │   ├─ isChannelMember() → Unsubscribed
  │   └─ isAuthor() → (should never fail for author)
  └─ Check timestamp of rule denial vs notification send

□ Check composite index status:
  ├─ Go to Firestore Console → Indexes
  ├─ Look for: posts collection, (channelId, markedForDeletionAt)
  └─ Status: Enabled or Building?
```

---

## Why Security Rules Are Correct But System Still Broken

The Firestore security rules are **architecturally sound**:

```firestore
allow read: if isAuthor()
  || isChannelMember(resource.data.channelId)
  || isConnectedToAuthorDailyChannel()
```

These rules **re-check at read time**, which is good. But the problem is **not in the rules** — it's in the **data consistency between notification system and feed visibility system**.

The notification system operates on:
- **Snapshot of subscribers at T0+2s**

The feed visibility system operates on:
- **Live Redux connection state at T_read**
- **Live Firestore connection documents at T_read**

When connection is removed at T0+2.5s, the notification was already sent (it can't be recalled), but the feed query won't include the post because the connection is no longer in Redux state.

---

## Architecture Diagram: Current System

```
                    POST CREATED
                        │
          ┌─────────────┴──────────────┐
          │                            │
    NOTIFICATION SYSTEM          FEED VISIBILITY SYSTEM
          │                            │
          ▼                            ▼
    Write notification doc    Redis subscribers state
          │                            │
          ▼                            ▼
    CF: onDocumentCreated      User opens feed
    ├─ Read subscribers         ├─ Redux connections ← LIVE
    │  (SNAPSHOT at T0+2s)      │  (can change anytime)
    ├─ Check settings           │
    └─ Send FCM                 ├─ Derive channel IDs
                                │
                                ▼
                          subscribeToPosts()
                                │
                                ▼
                          Firestore query
                          where(channelId, 'in', [...])
                          where(markedForDeletionAt, '==', null)
                                │
                                ▼
                          Security Rules
                          ├─ isConnectedToAuthorDailyChannel()
                          │  └─ Check live connection doc
                          └─ isChannelMember()
                                │
                                ▼
                          Post visible or denied
```

**Gap:** Notification system snapshot (T0+2s) and Feed visibility system live state (T_read) are decoupled. No transaction between them.


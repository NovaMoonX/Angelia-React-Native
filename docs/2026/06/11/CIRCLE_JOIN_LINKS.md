# Circle Join Links & Public Invite Previews

**Branch:** `fix/section-1-core-bug-fixes`  
**Release:** 1.0.10  
**Date:** June 11, 2026

## Overview

Custom Circle invite links and QR codes now land on a single public screen that works **before sign-in**. Visitors see circle name, description, host, and member count; signed-in members can request to join; invalid or expired links show a friendly error instead of a broken screen.

| Area | Summary |
|---|---|
| Public preview | `publicChannelInvites/{inviteCode}` — sanitized metadata readable without auth |
| Unified entry screen | `circle-invite-link` — shared by web links, deep links, QR scan, and manual code lookup |
| Server validation | Join requests verify invite code, host, and channel still exist |
| Backfill | One-time Cloud Function for circles created before preview sync shipped |
| Conversation nesting | Depth-2 replies keep root lineage (`rootId` / `grandparentId`) — separate from invite flow but ships on same branch |

## User flows

### 1. Shared link or QR (unauthenticated)

1. Visitor opens `https://angelia.app/invite/{channelId}/{inviteCode}` or scans a circle QR.
2. App routes to `/circle-invite-link` with `channelId` + `inviteCode` params.
3. Screen loads `publicChannelInvites/{inviteCode}` (no auth required).
4. Visitor sees circle card (name, description, host avatar, member count).
5. **Sign In** / **Sign Up** stores the circle in `pendingInvite` Redux slice and routes through auth.
6. After auth, `processPendingInvite` sends the join request automatically.

### 2. Shared link (already signed in)

Same screen; if not already a member and no pending request, shows optional intro message + **Request to Join**.

### 3. Manual code entry (`/join-channel`)

1. User enters 8-character invite code.
2. Lookup uses `getPublicChannelInvitePreview` (same collection).
3. Confirm step mirrors the public invite card UI.
4. Invalid code → `CircleInviteErrorModal`.

### 4. Host refreshes invite code

When a host regenerates their invite code, the client deletes the old `publicChannelInvites` doc and writes the new one. Old links fail preview lookup and join validation.

## Data model

### `publicChannelInvites/{inviteCode}`

Document ID is the **uppercase** invite code. Mirrors `PublicChannelInvitePreview` in `src/models/types.ts`:

| Field | Type | Notes |
|---|---|---|
| `channelId` | string | Target custom circle |
| `inviteCode` | string | Uppercase 8-char code |
| `name` | string | Circle display name |
| `description` | string | Circle description |
| `subscriberCount` | number | `channel.subscribers.length` at sync time |
| `ownerId` | string | Host user id |
| `markedForDeletionAt` | number \| null | Always `null` for active previews |

**Not included:** subscriber ids, post data, or private circle settings — only what a stranger needs to decide whether to request access.

### Client sync (ongoing)

`setPublicChannelInvitePreview` runs after:

- `createCustomChannel`
- `updateCustomChannel`
- `refreshChannelInviteCode` (delete old doc, write new)

`deletePublicChannelInvitePreview` runs when a custom circle is marked for deletion.

### Firestore security rules

```
match /publicChannelInvites/{inviteCode} {
  allow read: if true;
  allow create, update: if isSignedIn()
    && request.auth.uid == request.resource.data.ownerId
    && ...
  allow delete: if isSignedIn()
    && request.auth.uid == resource.data.ownerId;
}
```

Public read enables pre-auth landing. Only the circle host can write their preview doc.

### Join request validation

`createJoinRequest` in `firestore.ts` rejects when:

- Channel missing or `markedForDeletionAt != null`
- `inviteCode` does not match the channel's current code (catches expired links)
- `channelOwnerId` does not match the channel document's `ownerId`

Firestore rules additionally require the channel document to exist and `channelOwnerId` to match `channels/{channelId}.ownerId` on create.

## Routing map

| Entry | Route | Lands on |
|---|---|---|
| Web / universal link | `/invite/[channelId]/[inviteCode]` | Redirect → `/circle-invite-link` |
| App deep link | `angelia://invite/{channelId}/{inviteCode}` | Same redirect |
| QR scan | `scan-qr.tsx` → `parseInviteLink` | `/circle-invite-link` |
| Protected legacy route | `/(protected)/invite/...` | Redirect → `/circle-invite-link` |
| Manual code | `/join-channel` | Inline preview (same data source) |
| Onboarding pending invite | `complete-profile` → `/join-channel?fromOnboarding=1` | Code confirm flow |

Link helpers live in `src/lib/links.ts` (`getInviteShareLink`, `getInviteDeepLink`, `parseInviteLink`).

## Client file map

| File | Role |
|---|---|
| `src/app/circle-invite-link.tsx` | Public invite landing screen |
| `src/app/invite/[channelId]/[inviteCode].tsx` | Deep-link redirect |
| `src/app/join-channel.tsx` | Manual code entry + confirm |
| `src/app/scan-qr.tsx` | QR → circle-invite-link |
| `src/components/invite/CircleInviteErrorModal.tsx` | Shared invalid-link modal |
| `src/lib/channel/channelInvite.utils.ts` | `channelFromPublicInvitePreview` helper |
| `src/services/firebase/firestore.ts` | Preview CRUD, `getPublicChannelInvitePreview`, `createJoinRequest` |
| `src/store/slices/pendingInviteSlice.ts` | Stash circle across auth |
| `src/store/actions/inviteActions.ts` | `sendJoinRequest`, `processPendingInvite` |
| `firestore.rules` | `publicChannelInvites` + `channelJoinRequests` rules |

## One-time backfill (existing circles)

Circles created **before** preview sync shipped have no `publicChannelInvites` doc until the host next edits the circle or regenerates the code. Deploy and run the backfill function once:

```bash
npm run deploy:functions
```

Dry run:

```bash
PROJECT_ID=angelia-020726
TOKEN=$(gcloud auth print-identity-token)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "https://us-central1-${PROJECT_ID}.cloudfunctions.net/backfillPublicChannelInvitePreviews?dryRun=true"
```

Execute:

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "https://us-central1-${PROJECT_ID}.cloudfunctions.net/backfillPublicChannelInvitePreviews"
```

See `apps/mobile/functions/README.md` for full details. Safe to re-run (idempotent overwrite). Delete the function after a successful production run if desired.

## Deploy checklist

1. `npm run deploy:rules` — includes `publicChannelInvites` rules
2. `npm run deploy:functions` — includes `backfillPublicChannelInvitePreviews`
3. Run backfill once in production (see above)
4. Ship mobile app 1.0.10

No new composite Firestore indexes are required for preview lookup (single-document read by id).

## Manual test (quick)

1. **Pre-auth link** — open invite URL in a logged-out session → see circle name, host, member count; Sign Up → complete auth → join request sent.
2. **Invalid code** — change last character of invite code → `Circle not found` modal.
3. **Expired code** — host regenerates invite code → old link shows error; new link works.
4. **QR** — scan circle QR from Account → same screen as web link.
5. **Join-channel** — enter valid 8-char code from Subscribed tab → confirm card → request sends.
6. **Member state** — open link while already subscribed → "already a member" message.
7. **Backfill** — pick a circle that predates the feature, run backfill, confirm link works without host editing circle.

## Related docs

- `apps/mobile/BETA_UPDATE_NOTES.txt` — beta tester bullets
- `apps/mobile/TESTING.md` — Feature 6 manual QA checklist
- `apps/mobile/BRANCH_NARRATIVE.md` — reviewer narrative (appended section)
- `versions/1.0.10.txt` — production release notes
- `apps/mobile/functions/README.md` — backfill function runbook

# Angelia — Cloud Functions

Firebase Cloud Functions (Gen 2) for the Angelia app. Written in TypeScript, targeting Node.js 20.

---

## Functions

### `sendAppNotification`

**Trigger:** Firestore `onDocumentCreated` on `notifications/{notificationId}`

When a new document is created in the `notifications` collection, this function:
1. Reads the notification's `target` field to find the recipient user ID.
2. Fetches the user's FCM tokens from `userNotificationSettings/{userId}`.
3. Sends an FCM push to all registered devices via `sendEachForMulticast`.
4. Deletes the notification document.

Only `target.type === 'user'` is handled today. `channel_tier` and `thread` targets are reserved for future functions.

---

## Scripts

Run these from inside the `functions/` directory, or use the root-level npm scripts.

| Command | Description |
|---|---|
| `npm run build` | Compile TypeScript to `lib/` |
| `npm run build:watch` | Watch mode — recompile on save |
| `npm run deploy` | Build and deploy to Firebase |
| `npm run serve` | Build and start the Functions emulator locally |
| `npm run logs` | Tail live Cloud Function logs |

From the **project root**, prefer:

| Command | Description |
|---|---|
| `npm run deploy:functions` | Build + deploy functions only |
| `npm run deploy:all` | Build + deploy functions, Firestore rules, and Storage rules |

---

## Type Sync

The types in `src/index.ts` mirror `src/models/types.ts` in the app.
**They must be kept in sync.** See the copilot instructions for the full checklist when adding a new notification type.

---

## Known Issues & Resolutions

### Cannot change a function from HTTPS to a background trigger

**Error:**
```
Error: [sendAppNotification(us-central1)] Changing from an HTTPS function to a
background triggered function is not allowed. Please delete your function and
create a new one instead.
```

**Cause:** Firebase does not allow changing the trigger type of an existing deployed function in-place.

**Fix — dev/staging:** Delete the old function first, then redeploy.

```bash
firebase functions:delete sendAppNotification --region=us-central1
firebase deploy --only functions:sendAppNotification
```

**Fix — production (can't delete):** Rename the export in `src/index.ts` and deploy. The old function will linger until manually deleted later.

```ts
// src/index.ts
export const sendAppNotificationV2 = onDocumentCreated(...)
```

```bash
firebase deploy --only functions
```

---

### Build fails — missing permission on build service account

**Error:**
```
Build failed with status: FAILURE. Could not build the function due to a missing
permission on the build service account.
```

**Cause:** The Cloud Build service account is missing the required IAM role — typically caused by an organization policy change or a project that hasn't had Cloud Build fully initialized.

**Fix:**

1. Enable the IAM API for the project:
   https://console.cloud.google.com/apis/library/iam.googleapis.com

2. Open the project's service accounts:
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=angelia-020726

3. Find the default Compute Engine service account (ends in `@developer.gserviceaccount.com`). Grant it the **Cloud Build Service Account** role (`roles/cloudbuild.builds.builder`).

4. Re-run the deploy:
   ```bash
   npm run deploy:functions
   ```

**Reference:** https://cloud.google.com/functions/docs/troubleshooting#build-service-account

---

### Node.js runtime deprecation warning

**Warning:**
```
⚠  functions: Runtime Node.js 20 will be deprecated on 2026-04-30 and will be
decommissioned on 2026-10-30, after which you will not be able to deploy without
upgrading.
```

**Fix:** Update the `engines` field in `functions/package.json` and reinstall dependencies.

```json
{
  "engines": {
    "node": "22"
  }
}
```

```bash
npm install firebase-functions@latest firebase-admin@latest
```

Then redeploy:

```bash
npm run deploy:functions
```

**Reference:** https://cloud.google.com/functions/docs/runtime-support

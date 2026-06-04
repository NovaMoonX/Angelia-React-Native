# Release Process

This document outlines the end-to-end steps for building, submitting, and verifying a new production release of the Angelia app for both Android and iOS.

---

## 1. Pre-Release Prep

Do these steps **before** triggering any build. This is mandatory — see the copilot instructions for full rules on each.

### 1a. Update Beta Update Notes

Edit [`BETA_UPDATE_NOTES.txt`](../BETA_UPDATE_NOTES.txt) with a concise, friendly summary of everything that changed in this release. Write like you're texting a friend — warmly and clearly.

### 1b. Update the Beta Update Modal

Open [`src/models/constants.ts`](../src/models/constants.ts)
Open [`src/components/BetaUpdateModal.tsx`](../src/components/BetaUpdateModal.tsx) and:

1. **Bump `BETA_UPDATE_VERSION`** to a new string (e.g. `"1.1.0"` or a date like `"2026-06-01"`). This is the key that determines whether a user sees the modal — bumping it causes the modal to show again for everyone.
2. **Update `BETA_UPDATE_TITLE`** with a friendly headline (optional but encouraged).
3. **Replace `BETA_UPDATE_CHANGES`** with the current list of changes (max 5 entries). Draw from `BETA_UPDATE_NOTES.txt`. Roll minor fixes into a single `"Bug fixes & reliability"` entry.

### 1c. Bump the App Version

Open [`app.config.js`](../app.config.js) and increment the `version` field under `expo`:

```js
version: '1.0.1',  // e.g. bump from 1.0.0 → 1.0.1
```

> **Why this matters:** EAS and the app stores use the version to distinguish builds. Increment it with every new production release. Use semantic versioning — minor bumps (e.g. `1.0.0` → `1.0.1`) for standard updates, major bumps for large feature releases.

### 1d. Sync Runtime App Version Constant

Open [`src/models/constants.ts`](../src/models/constants.ts) and update:

```ts
export const APP_VERSION = '1.0.1';
```

Set it to the exact same semantic version used in `app.config.js`.

> **Why this matters:** update gating compares server-required versions against this runtime constant. Keeping it in sync prevents false "new update" prompts when users already installed the latest build but still have older cached dismissal metadata.

### 1e. Bump Notification Settings Notice Version (when needed)

If this release introduces **new notification controls** (or changes the release notice copy for those controls), bump:

- `NOTIFICATION_SETTINGS_NOTICE_VERSION` in [`src/models/constants.ts`](../src/models/constants.ts)

Use a new unique value (for example: `"2026-05-post-activity-controls-v2"`).

> **Why this matters:** The Notifications-screen release notice and the feed-bell release dot are versioned. Bumping the version is what makes the one-time notice/dot appear again for users for that specific release.
>
> If a release does **not** add new notification controls, leave this version unchanged so users don't get unnecessary repeat notices.

---

## 2. Build Production Binaries

Run both build commands from `apps/mobile/`. They submit cloud EAS builds and run in parallel — you don't need to wait for one to finish before starting the other.

### Android

```bash
npm run prod:android
```

This triggers an EAS production build for Android. Once complete, **download the `.aab` file** from the EAS dashboard and **manually upload it** in the [Google Play Console](https://play.google.com/console) under the appropriate track (Internal Testing → expand to Open/Closed testing as needed).

> **Note:** Android builds can take a while to complete — up to an hour in some cases. Keep an eye on the EAS dashboard for progress.

### iOS

```bash
npm run prod:ios
```

This triggers an EAS production build for iOS. iOS builds tend to complete more quickly than Android. Once the build completes, **submit it to App Store Connect / TestFlight directly from the terminal**:

```bash
eas submit --platform ios
```

EAS will automatically pull the latest build and submit it to TestFlight. No manual download needed.

---

## 3. Verify Availability

After both builds are submitted, verify that they're actually available to testers before moving to step 4.

### Android

Check the [Google Play Console](https://play.google.com/console) to confirm the new build has been processed and is showing as active on the testing track.

### iOS

Wait for the **TestFlight notification email** from Apple confirming the build is available for testing. Alternatively, you can open the TestFlight app and check if the new version appears. Either signal confirms it's live.

> Apple processes TestFlight builds asynchronously — it may take a few minutes to an hour. Do not trigger the in-app update alert until you've confirmed the build is live.

---

## 4. Trigger the In-App Update Alert

Once **both** platforms have confirmed builds available, update the `appConfig/mobile` document in Firestore with the new version strings so that the in-app update modal fires for users still on the old version.

### Which version string to use

Set `iosVersion` and `androidVersion` to the **exact semantic version** you put in `app.config.js` — e.g. `"1.0.1"`. This is the version the app reads at runtime via `Constants.expoConfig.version`.

> ⚠️ **Do NOT include the build number** in these fields. App stores display builds as `1.0.0 (13)` — the `(13)` is the internal build number, not the semantic version. If you write `"1.0.0 (13)"` in Firestore, the version parser will strip non-digit characters from the last segment and compare `0` against `13`, causing the update modal to fire incorrectly for users who are already on the current version.
>
> ✅ `"1.0.1"` — correct  
> ❌ `"1.0.0 (13)"` — incorrect, will cause false update prompts

**Fields to update in `appConfig/mobile`:**

| Field | Value |
|---|---|
| `iosVersion` | The new version string (e.g. `"1.0.1"`) — matches `version` in `app.config.js` |
| `androidVersion` | Same version string |
| `androidStoreUrl` | Play Store URL (only update if it changed) |

> See [`docs/ota-modals.md`](./ota-modals.md) for the full Firestore field reference and how the update modal priority system works.

---

## Quick Checklist

```
[ ] BETA_UPDATE_NOTES.txt updated
[ ] BetaUpdateModal.tsx version bumped + changes updated
[ ] app.config.js version incremented
[ ] APP_VERSION in src/models/constants.ts synced to app.config.js version
[ ] (If shipping new notification controls) NOTIFICATION_SETTINGS_NOTICE_VERSION bumped
[ ] npm run prod:android triggered
[ ] npm run prod:ios triggered
[ ] eas submit --platform ios run after iOS build completes
[ ] Android build verified in Play Console
[ ] iOS build verified in TestFlight (email notification or app check)
[ ] appConfig/mobile Firestore document updated to trigger in-app update alert
```

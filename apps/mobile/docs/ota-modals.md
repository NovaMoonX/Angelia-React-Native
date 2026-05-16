# OTA / Server-Side Feed Modals

These are the three modals that can be triggered remotely via Firestore without a new app release. They are all controlled by the `useFeedModals` hook (`src/hooks/useFeedModals.ts`) and rendered in `src/app/(protected)/feed.tsx`.

---

## Firestore Documents

All three modal configs live in separate flat documents under the `appConfig` collection. Each document contains only top-level scalar fields — no nested maps — so any field can be updated individually in the Firestore console without recreating a map object.

| Document | Purpose |
|---|---|
| `appConfig/mobile` | App version gate (`iosVersion`, `androidVersion`, `androidStoreUrl`) |
| `appConfig/broadcastMessage` | Broadcast message modal (`active`, `id`, `type`, `title`, `body`, `targetDeviceType`, `minAppVersion`, `maxAppVersion`) |
| `appConfig/feedbackForm` | Feedback form modal (`active`, `url`, `topic`, `targetDeviceType`, `minAppVersion`, `maxAppVersion`) |

The `subscribeToMobileAppConfig` function in `src/services/firebase/firestore.ts` opens three parallel `onSnapshot` listeners and merges their values into a single `MobileAppConfig` before emitting to callers. All three documents must exist for the merged config to be emitted — missing documents produce fallback defaults.

> **Old builds** only read `appConfig/mobile` for the version gate via `subscribeToLatestAppVersion`. They are unaffected by the `broadcastMessage` and `feedbackForm` documents.

---

## Priority Order

When more than one modal would trigger simultaneously, the hook shows only the highest-priority one:

| Priority | Modal ID     | Condition |
|----------|-------------|-----------|
| 1        | `onboarding`  | New user has not completed the onboarding guide |
| 2        | `betaUpdate`  | `BETA_UPDATE_VERSION` constant bumped and user hasn't seen it |
| 3        | `appVersion`  | Device version is behind `iosVersion` / `androidVersion` in Firestore |
| 4        | `appMessage`  | `broadcastMessage.active === true` and user hasn't dismissed this `id` |
| 5        | `feedbackForm`| `feedbackForm.active === true` and user hasn't dismissed this `url` |

---

## 1. App Version Update Modal

**Component:** `src/components/AppVersionUpdateModal.tsx`  
**Firestore document:** `appConfig/mobile`

**Fields:**

| Field | Type | Description |
|---|---|---|
| `iosVersion` | `string \| null` | Minimum required iOS app version (e.g. `"1.4.0"`). Set to `null` to disable the prompt. |
| `androidVersion` | `string \| null` | Minimum required Android app version. Set to `null` to disable. |
| `androidStoreUrl` | `string \| null` | Play Store URL to open on Android. Falls back to the `ANDROID_PLAY_STORE_URL` constant if `null`. |

**Behavior:**
- Compares the device's `Constants.expoConfig.version` against `iosVersion` or `androidVersion` (based on platform).
- Only shows when the device version is **strictly behind** the target version.
- Dismissal is persisted per platform via `APP_UPDATE_PROMPT_DISMISSED_VERSION_KEY` in AsyncStorage — the modal re-appears if the target version is bumped again.
- On iOS the "Open TestFlight" button deep-links to the TestFlight app (`itms-beta://`) then falls back to the TestFlight web URL.
- On Android the "Open Play Store" button opens `androidStoreUrl` (or the fallback constant).

**To prompt users to update:**
1. Set `iosVersion` or `androidVersion` to the new required version string.
2. Leave `androidStoreUrl` populated with the current Play Store listing URL.

---

## 2. App Message Modal (Broadcast)

**Component:** `src/components/AppMessageModal.tsx`  
**Firestore document:** `appConfig/broadcastMessage`

**Fields:**

| Field | Type | Description |
|---|---|---|
| `active` | `boolean` | Master switch. `false` = never shown. |
| `id` | `string \| null` | Unique identifier for this message. Change it to re-show the modal to users who previously dismissed it. |
| `type` | `'info' \| 'warning' \| 'success' \| 'urgent'` | Controls the accent color and emoji shown at the top of the modal. |
| `title` | `string \| null` | Short headline (e.g. `"Scheduled maintenance"`). |
| `body` | `string \| null` | One or two sentences of detail. |
| `targetDeviceType` | `'all' \| 'ios' \| 'android'` | Device targeting for this message. `all` (or missing) shows to both platforms. |
| `minAppVersion` | `string \| null` | Optional lower bound (inclusive) for app version targeting. Example: `"1.0.5"`. |
| `maxAppVersion` | `string \| null` | Optional upper bound (inclusive) for app version targeting. Example: `"1.0.9"`. |

**Type → emoji / accent color mapping:**

| Type | Emoji | Accent |
|---|---|---|
| `info` | 💡 | `#6366F1` (indigo) |
| `warning` | ⚠️ | `#F59E0B` (amber) |
| `success` | ✅ | `#10B981` (green) |
| `urgent` | 🚨 | `#EF4444` (red) |

**Behavior:**
- Only shown when `active === true`.
- Must match targeting rules: current device platform matches `targetDeviceType`, and app version falls inside `minAppVersion`/`maxAppVersion` when those bounds are provided.
- Dismissal is stored via `APP_MESSAGE_DISMISSED_KEY` in AsyncStorage, keyed to the message `id`. Changing the `id` causes the modal to re-appear for all users.
- Setting `active` to `false` immediately suppresses the modal for all users without requiring a dismissal.

**To send a broadcast message:**
1. Set `broadcastMessage.active = true`.
2. Give `id` a fresh unique string (e.g. a timestamp or slug like `"2026-06-outage"`).
3. Fill in `type`, `title`, and `body`.

**To stop showing it:**
- Set `active = false` (fastest), or set `id` to something users have already dismissed.

---

## 3. Feedback Form Modal

**Component:** `src/components/FeedbackFormModal.tsx`  
**Firestore document:** `appConfig/feedbackForm`

**Fields:**

| Field | Type | Description |
|---|---|---|
| `active` | `boolean` | Master switch. `false` = never shown. |
| `url` | `string \| null` | Full URL to a Google Form (or any URL). Change the URL to re-prompt users who dismissed the previous one. |
| `topic` | `string \| null` | Optional topic shown in the modal body as **"Topic: \<value\>"** (e.g. `"App experience"`). Omitted when `null`. |
| `targetDeviceType` | `'all' \| 'ios' \| 'android'` | Device targeting for this prompt. `all` (or missing) shows to both platforms. |
| `minAppVersion` | `string \| null` | Optional lower bound (inclusive) for app version targeting. |
| `maxAppVersion` | `string \| null` | Optional upper bound (inclusive) for app version targeting. |

**Behavior:**
- Only shown when `active === true`.
- Must match targeting rules: current device platform matches `targetDeviceType`, and app version falls inside `minAppVersion`/`maxAppVersion` when those bounds are provided.
- "Open form" button opens the URL with `Linking.openURL`; falls back to clipboard copy with a toast if the URL can't be opened.
- Dismissal is persisted via `FEEDBACK_FORM_DISMISSED_URL_KEY` in AsyncStorage, keyed to the exact URL string. Updating `url` re-shows the modal.

**To show a feedback prompt:**
1. Set `feedbackForm.active = true`.
2. Set `url` to the Google Form share link.

---

## Keeping This File Up to Date

Update this file whenever:
- A Firestore field is added, renamed, or removed from `appConfig/mobile`.
- A new modal type or priority level is added to `useFeedModals`.
- The dismissal logic for any modal changes (e.g. a new AsyncStorage key is introduced).
- The type/emoji/color mapping for `broadcastMessage` changes.

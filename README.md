# Angelia

Angelia is a warm, private social app for staying genuinely connected with close friends and family through invite-only channels. Users share life updates — everyday moments, noteworthy news, and big announcements — without public feeds or algorithmic pressure.

For a full product overview see [PRODUCT_SUMMARY.md](./PRODUCT_SUMMARY.md).

---

## Developer Guide

### Prerequisites

- Node.js (LTS)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- [EAS CLI](https://docs.expo.dev/build/setup/) (`npm install -g eas-cli`)
- Android Studio and/or Xcode (for native builds)
- Firebase project with Firestore, Storage, Auth, and Cloud Messaging enabled
- `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) from the Firebase console

### Initial Setup

```bash
git clone <repo-url>
cd Angelia-React-Native
npm install          # also auto-applies patches via postinstall
```

Pull development environment variables (requires EAS login):

```bash
eas login
npm run env:pull     # writes .env.development
```

---

### npm Scripts Reference

#### Android (primary development target)

| Script | When to run |
|---|---|
| `npm run android` | **Standard run command.** Builds and launches on a connected physical Android device. Run this after `prebuild:android` to start developing. |
| `npm run android:clean` | Use when you suspect a stale build cache is causing issues (e.g. native changes aren't reflected, unexplained crash on launch). Slower than `android` but guaranteed fresh. |
| `npm run android:devices` | Run when ADB can't see your device — restarts the ADB server and lists connected devices. |
| `npm run prebuild:android` | **Run after any config change** (`app.config.js`, new native plugin, or new native dependency). Regenerates the `android/` folder. Must be run before `npm run android` when changes are made. |
| `npm run prebuild:android:clean` | Same as above but wipes the existing `android/` folder first. Use when prebuild errors out or when upgrading Expo/SDK versions. |
| `npm run build:android` | Triggers a cloud EAS development build. Use when you need a shareable `.apk` or when local builds are failing due to machine-specific issues. |

#### iOS

| Script | When to run |
|---|---|
| `npm run ios` | Build and launch on a connected iOS device or simulator. |

#### Metro / Dev Server

| Script | When to run |
|---|---|
| `npm start` | Start the Metro bundler for JS-only changes (no native rebuild needed). |
| `npm run start:clean` | Use when Metro is serving stale modules or assets — clears the cache before starting. |
| `npm run web` | Start the web version via Expo. |

#### Code Quality

| Script | When to run |
|---|---|
| `npm run lint` | Run the Expo linter. Run before committing. |
| `npm run ts:check` | TypeScript type-check without emitting files. Run before committing. |

#### Environment & Config

| Script | When to run |
|---|---|
| `npm run env:pull` | Pull EAS development environment variables into `.env.development`. Run after initial clone or when env vars are updated. |
| `npm run env:android` | Upload `google-services.json` as a sensitive EAS env variable. Run once during project setup or when the file changes. |
| `npm run prebuild` | Run `expo prebuild` for all platforms (Android + iOS). Prefer platform-specific variants unless targeting both at once. |

#### Firebase Rules

| Script | When to run |
|---|---|
| `npm run deploy:rules:firestore` | Deploy Firestore security rules to Firebase. Run after editing `firestore.rules`. |
| `npm run deploy:rules:storage` | Deploy Storage security rules to Firebase. Run after editing `storage.rules`. |
| `npm run deploy:rules` | Deploy both Firestore and Storage rules at once. |

> **Before committing:** Run `npm run ts:check` and `npm run lint`. Both must pass cleanly.

---

### Typical Development Flow (Android physical device)

This is the standard day-to-day flow when developing on a physical Android device:

1. **`npm install`** — install/update dependencies (run whenever `package.json` changes)
2. **`npm run env:pull`** — sync the latest env variables (run after initial clone or when env changes)
3. **`npm run prebuild:android`** — regenerate the `android/` folder
   - Run this after: initial clone, changes to `app.config.js`, adding/removing native plugins or native dependencies
   - Use `prebuild:android:clean` when prebuild errors out or after an SDK upgrade
4. **`npm run android`** — build and launch on your connected Android device
   - Use `android:clean` when you suspect a stale build cache
5. **For JS-only changes after initial setup:** `npm start` is sufficient — no prebuild needed
6. **After editing Firestore or Storage rules:** `npm run deploy:rules`
7. **Before pushing:** `npm run ts:check` && `npm run lint`

---

### Project Structure

```
src/
  app/          # Expo Router screens ((protected)/ contains authenticated routes)
  components/   # Reusable UI components
  constants/    # App-wide constants (layout, colors, etc.)
  hooks/        # Custom React hooks
  lib/          # Low-level utilities and wrappers
  models/       # TypeScript types and constants (types.ts, constants.ts)
  providers/    # React context providers
  services/     # Firebase service layer (auth, firestore, storage, notifications)
  store/        # Redux Toolkit slices, actions, and hooks
  utils/        # Pure utility functions
assets/         # Images, fonts, icons
plugins/        # Custom Expo config plugins
scripts/        # Build/CI helper scripts
```

---

### Known Bugs & Solutions

> Add entries here when a tricky bug is discovered and resolved. This log exists so that if the same issue resurfaces, the fix is already documented.

#### FCM token registration hangs indefinitely on simulators

**Symptom:** App freezes on the loading screen or notification settings never load when running on an iOS/Android simulator.

**Cause:** Firebase Cloud Messaging (`@react-native-firebase/messaging`) can hang indefinitely when trying to register for FCM tokens on simulators that don't support push notifications.

**Fix:** FCM token registration must be fire-and-forget — do not `await` it in the main initialization chain. Wrap it in a `try/catch` inside `initNotifications` so that notification scheduling and settings loading are never blocked by FCM failures. See `src/components/DataListenerWrapper.tsx` and `src/store/actions/notificationActions.ts`.

---

#### `expo-modules-core` permission type mismatch

**Symptom:** TypeScript error when checking `Notifications.requestPermissionsAsync()` result against `PermissionStatus.GRANTED` — the types don't resolve cleanly due to node_modules hoisting.

**Cause:** `expo-notifications` and `expo` each bundle their own copy of `expo-modules-core`, and the hoisted type doesn't match the runtime import.

**Fix:** Cast the status check using `Notifications.PermissionStatus.GRANTED` directly on the `expo-notifications` import rather than importing from `expo-modules-core`. See `src/services/notifications.ts`.

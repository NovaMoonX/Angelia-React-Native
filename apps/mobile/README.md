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
| `npm run android` | **Compiles native code (Gradle), installs the `.apk` on the device, and starts Metro.** Run this after `prebuild:android` or any time native code, plugins, or `app.config.js` has changed. Also the first command to run on a fresh clone. |
| `npm run android:clean` | Use when you suspect a stale build cache is causing issues (e.g. native changes aren't reflected, unexplained crash on launch). Slower than `android` but guaranteed fresh. |
| `npm run android:devices` | Run when ADB can't see your device — restarts the ADB server and lists connected devices. |
| `npm run prebuild:android` | **Run after any config change** (`app.config.js`, new native plugin, or new native dependency). Regenerates the `android/` folder. Must be run before `npm run android` when changes are made. |
| `npm run prebuild:android:clean` | Same as above but wipes the existing `android/` folder first. Use when prebuild errors out or when upgrading Expo/SDK versions. |
| `npm run build:android` | Triggers a cloud EAS development build. Use when you need a shareable `.apk` or when local builds are failing due to machine-specific issues. |

#### iOS

| Script | When to run |
|---|---|
| `npm run ios` | Build and launch on a connected iOS device. Run after `setup-ios.sh` completes. |
| `npm run ios:clean` | Same as above but forces a fresh native build. Use when the cached build is stale. |
| `npm run prebuild:ios` | Regenerate the `ios/` folder without wiping it. Run after config changes. |
| `npm run prebuild:ios:clean` | Wipe and regenerate `ios/`. **Do not run this alone** — you must re-patch the Podfile and reinstall pods via `setup-ios.sh` after this. |
| `npm run build:ios` | Trigger a cloud EAS development build for iOS. |
| `bash scripts/setup-ios.sh` | **Full iOS setup from scratch.** Runs `prebuild --clean`, patches the Podfile for the RNFB non-modular header bug, and runs `pod install`. Run this after the initial clone and after any `prebuild:ios:clean`. |

#### Metro / Dev Server

| Script | When to run |
|---|---|
| `npm start` | **Start Metro only** — does not build or install the native app. The dev-client `.apk` (or `.app`) must already be installed on the device from a prior `npm run android` (or `npm run ios`). Use for JS-only iteration once the native binary is in place. |
| `npm run start:clean` | Same as above but clears Metro's cache first. Use when Metro is serving stale modules or assets. |
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

#### Firebase Rules & Functions

| Script | When to run |
|---|---|
| `npm run deploy:rules:firestore` | Deploy Firestore security rules to Firebase. Run after editing `firestore.rules`. |
| `npm run deploy:rules:storage` | Deploy Storage security rules to Firebase. Run after editing `storage.rules`. |
| `npm run deploy:rules` | Deploy both Firestore and Storage rules at once. |
| `npm run deploy:functions` | Build and deploy Cloud Functions to Firebase. Run after editing anything in `functions/src/`. |
| `npm run deploy:all` | Build and deploy everything — Firestore rules, Storage rules, and Cloud Functions — in one command. |

> **Before committing:** Run `npm run ts:check` and `npm run lint`. Both must pass cleanly.

---

### Typical Development Flow (iOS)

1. **`bash scripts/setup-ios.sh`** — run once after cloning, and again after any clean prebuild. This does everything: prebuild, Podfile patch, pod install.
2. **`npm run ios`** — build and launch on a connected device or simulator.
3. **For JS-only changes after the native app is installed:** `npm start` (Metro only) is sufficient — no native recompile needed. If the app isn't installed on the device yet, use `npm run ios` first.
4. **If you run `npm run prebuild:ios:clean`** manually, always follow it with `bash scripts/setup-ios.sh` — the script re-applies the Podfile patch that the clean wipes away.

---

### Typical Development Flow (Android physical device)

This is the standard day-to-day flow when developing on a physical Android device:

1. **`npm install`** — install/update dependencies (run whenever `package.json` changes)
2. **`npm run env:pull`** — sync the latest env variables (run after initial clone or when env changes)
3. **`npm run prebuild:android`** — regenerate the `android/` folder
   - Run this after: initial clone, changes to `app.config.js`, adding/removing native plugins or native dependencies
   - Use `prebuild:android:clean` when prebuild errors out or after an SDK upgrade
4. **`npm run android`** — compile (Gradle), install the `.apk`, and start Metro on your connected device
   - Use `android:clean` when you suspect a stale build cache
5. **For JS-only changes after the native app is installed:** `npm start` is sufficient — it starts Metro without rebuilding the native binary. If the app isn't installed yet (or you've run `prebuild:android` since the last install), use `npm run android` instead.
6. **After editing Firestore or Storage rules:** `npm run deploy:rules`
   - After editing Cloud Functions: `npm run deploy:functions`
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

### Testing Notifications

See [NOTIFICATION_TESTING.md](./NOTIFICATION_TESTING.md) for a step-by-step guide to manually testing push notifications via Firestore, including ready-to-paste JSON payloads and troubleshooting tips.

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

---

#### iOS build fails: non-modular header inside framework module (RNFB)

**Symptom:** `xcodebuild` exits with error code 65. Multiple `[-Werror,-Wnon-modular-include-in-framework-module]` errors pointing to files inside `@react-native-firebase/app/ios/RNFBApp/` (e.g. `RCTConvert+FIRApp.h`, `RNFBAppModule.h`, `RNFBSharedUtils.h`).

**Cause:** `expo prebuild --clean` (or `rm -rf ios`) regenerates the `ios/` folder and a fresh Podfile. The fresh Podfile does not include the build-settings override that tells Xcode to allow non-modular headers inside RNFB framework targets. React Native Firebase headers import React headers using `<React/...>` angle-bracket syntax, which Xcode rejects as non-modular when `DEFINES_MODULE = YES` (the CocoaPods default for dynamic frameworks).

**Fix:** After every clean prebuild, run `bash scripts/setup-ios.sh` from the repo root. The script patches the Podfile by injecting a `post_install` hook that sets `DEFINES_MODULE = NO` and `ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` for all `RNFB*` targets, then runs `pod install`. The patch is idempotent — running the script again when the patch is already present is safe. See `scripts/setup-ios.sh`.

---

#### Android bottom-sheet modal jumps when keyboard is dismissed

**Symptom:** On Android, when a keyboard is dismissed *inside* a bottom-sheet `<Modal>` (e.g. the private-note composer), the sheet snaps/jumps between its bottom-aligned position and a padded-from-bottom position.

**Cause:** Using `behavior='height'` on the `<KeyboardAvoidingView>` inside a Modal animates the KAV container height on keyboard hide. Because the backdrop uses `justifyContent: 'flex-end'`, the height restoration re-triggers flex layout and the sheet visibly snaps.

**Fix:** Use `behavior='padding'` on both iOS and Android for `<KeyboardAvoidingView>` inside a bottom-sheet Modal. `padding` adjusts only internal spacing and never changes the container height, eliminating the snap. See `src/components/PrivateNoteModal.tsx`.

---

#### Firestore subscription crashes with `Cannot read property 'docs' of null`

**Symptom:** The app throws `TypeError: Cannot read property 'docs' of null` from Firestore listeners, often in request/task/private-note subscriptions.

**Cause:** In React Native Firebase, `onSnapshot` query callbacks can surface a null snapshot transiently. Any listener that assumes `snap.docs` always exists will crash as soon as that happens.

**Fix:** Treat Firestore snapshots as nullable. For query listeners, always read docs through a null-safe fallback such as `snap?.docs ?? []` or the shared helper in `src/services/firebase/firestore.ts`. For document listeners, guard `snap` before reading `exists` or `data`. See `src/services/firebase/firestore.ts` and `.github/copilot-instructions.md`.

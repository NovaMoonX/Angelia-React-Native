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

| Script | Description |
|---|---|
| `npm start` | Start the Expo development server (Metro bundler) |
| `npm run start:clean` | Start with a cleared Metro cache — use when imports or assets behave unexpectedly |
| `npm run android` | Build and launch on a connected Android device |
| `npm run android:clean` | Same as above, but skips the build cache — useful after native dependency changes |
| `npm run android:devices` | Restart ADB and list connected Android devices |
| `npm run prebuild:android` | Run `expo prebuild` for Android (generates `android/` folder) |
| `npm run prebuild:android:clean` | Same as above with `--clean` — wipes the generated folder first |
| `npm run ios` | Build and launch on a connected iOS device or simulator |
| `npm run web` | Start the web version via Expo |
| `npm run lint` | Run the Expo linter |
| `npm run ts:check` | TypeScript type-check without emitting files |
| `npm run prebuild` | Run `expo prebuild` for all platforms |
| `npm run env:android` | Upload `google-services.json` as a sensitive EAS env variable for development builds |
| `npm run env:pull` | Pull EAS development environment variables into `.env.development` |
| `npm run build:android` | Trigger an EAS development build for Android (`--profile development`) |
| `npm run deploy:rules:firestore` | Deploy Firestore security rules to Firebase |
| `npm run deploy:rules:storage` | Deploy Storage security rules to Firebase |
| `npm run deploy:rules` | Deploy both Firestore and Storage rules at once |

> **Tip:** Run `npm run ts:check` and `npm run lint` before committing. Both must pass cleanly.

---

### Typical Development Flow

1. `npm install` — install/update dependencies
2. `npm run env:pull` — sync the latest env variables
3. `npm start` — start Metro (use `--clear` if you hit caching issues)
4. For native changes (new native modules, `app.config.js` edits): run `npm run prebuild:android` / `npm run prebuild:android:clean` then `npm run android`
5. After changing Firestore or Storage rules: `npm run deploy:rules`
6. Run `npm run ts:check` and `npm run lint` before pushing

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

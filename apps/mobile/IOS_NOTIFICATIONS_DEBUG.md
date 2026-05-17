# iOS Notifications Debug Guide

## Goal
Diagnose why push notifications are not arriving or not behaving correctly on iOS for Angelia.

## Quick Triage Matrix

- App receives notifications on Android but not iOS: likely APNs/Firebase/iOS entitlement/config mismatch
- Notification arrives in foreground only: notification handler or presentation settings issue
- Notification arrives only after opening app: background delivery / APNs token / permission issue
- Tap on notification opens app but does not route: response handler/data payload mismatch

---

## 1) Device + App Preconditions

- Use a **real iPhone** (simulator cannot receive APNs pushes)
- Confirm app build is a **development build or production/TestFlight build** with push configured
- Confirm user has granted notification permission on iOS:
  - iOS Settings -> Notifications -> Angelia -> Allow Notifications
- Confirm Focus / Do Not Disturb is not suppressing banners
- Confirm device has network connectivity

---

## 2) iOS Native Config Checks

### Apple Developer / App ID

- Push Notifications capability enabled for `com.angelia.app`
- APNs key (`.p8`) exists in Apple Developer account

### Firebase Project

- APNs auth key uploaded in Firebase Console -> Project Settings -> Cloud Messaging
- Team ID, Key ID, and Bundle ID match `com.angelia.app`

### Expo App Config

- Verify [app.config.js](app.config.js) has correct iOS bundle identifier and notification plugin settings
- Confirm `GoogleService-Info.plist` is present and correct for iOS app

### iOS Entitlements

- Confirm push entitlement exists in iOS project:
  - `aps-environment` should be present (`development` or `production` depending on build)
- Confirm Background Modes includes `remote-notification` if background pushes are expected

---

## 3) Runtime Token Verification

Add temporary logs around token registration paths and validate all values:

- APNs device token (native)
- Expo push token (if used)
- FCM token (if using Firebase Messaging)
- Confirm token is written to Firestore user doc and current (not stale)

Checklist:

- Log token on app start and after permission grant
- Compare token in app logs vs token saved in Firestore
- Reinstall app and verify token refresh path updates backend
- Ensure no stale token overwrite from older sessions/devices

---

## 4) Notification Permission + Handler Flow

In [src/app/_layout.tsx](src/app/_layout.tsx):

- Verify foreground handler (`Notifications.setNotificationHandler`) returns expected presentation flags
- Ensure daily reminder suppression logic does not accidentally suppress unrelated notifications
- Verify `addNotificationResponseReceivedListener` routes each payload type correctly

Validate each notification type data payload includes required routing keys:

- `type`
- `postId`, `joinRequestId`, `connectionRequestId`, etc. (as needed)

---

## 5) Firebase Cloud Messaging Checks

- Confirm Cloud Function writes notification documents correctly
- Confirm function fan-out writes valid push payload for iOS
- Confirm APNs headers are set correctly by Firebase (priority, content-available where needed)
- Check Firebase Function logs for failed sends, invalid tokens, or APNs auth errors

Useful checks:

- Invalid registration token errors
- NotRegistered / token mismatch errors
- APNs authentication key errors

---

## 6) Local vs Remote Notification Isolation

Use this to isolate system-level vs backend-level failures:

1. Trigger a **local notification** in app
2. Trigger a **remote push** from Firebase console or Cloud Function

Interpretation:

- Local works, remote fails: backend/APNs/token issue
- Both fail: app permission/config/runtime handler issue
- Remote appears in tray but tap routing fails: payload/response handler mapping issue

---

## 7) Build Profile / Environment Mismatch

Common failure source: tokens/environment crossed between dev/prod.

Check:

- Dev build uses development APNs environment
- TestFlight/prod build uses production APNs environment
- Firebase project and credentials align with build target
- `GoogleService-Info.plist` matches the same Firebase project expected by backend

---

## 8) Repro Script (Recommended)

For each test run, capture:

- iPhone model + iOS version
- App build/profile (dev, preview, prod)
- Logged-in user ID
- Notification permission status
- Token values (redact before sharing externally)
- Trigger action (what event should send notification)
- Expected result vs actual result
- Console logs + Cloud Function logs timestamp

---

## 9) Fast Fix Checklist

- Reinstall app on iPhone and re-grant notification permissions
- Force token refresh and overwrite backend token
- Verify APNs key in Firebase is valid and not expired/revoked
- Verify `aps-environment` entitlement in built app
- Send direct test message to current token
- Confirm payload has correct data keys for app routing

---

## 10) Current Code References

- [src/app/_layout.tsx](src/app/_layout.tsx): foreground notification handler + tap response routing
- [src/services/notifications.ts](src/services/notifications.ts): scheduling, dismissal, helpers
- [apps/mobile/functions/src/index.ts](functions/src/index.ts): push fan-out and payload builder
- [src/components/DataListenerWrapper.tsx](src/components/DataListenerWrapper.tsx): in-app prompt/notification-adjacent effects

---

## Notes

- iOS push debugging is easiest with one dedicated test user + one dedicated test device to reduce token churn.
- Keep token logging temporary and remove before release if verbose.
- Always verify on physical iPhone after any push-related config change.

---
name: 'Mobile PR Review'
description: 'PR code review instructions for the React Native Expo app'
applyTo: 'apps/mobile/**/*'
---

# GitHub Copilot PR Review Instructions

## Repository Context

This is a **Monorepo**. Reviews are focused exclusively on the **React Native Expo app**. Ignore website files entirely — do not comment on them.

Primary policy sources to enforce during review:
- `apps/mobile/docs/release-process.md`
- `.github/copilot-instructions.md`
- `apps/mobile/README.md` (developer workflow and known issues)

---

## PR Review Output Contract

- Prioritize findings first, ordered by severity.
- Always include file + line references for each issue.
- Classify each finding as:
	- **Blocker**: must be fixed before merge
	- **Suggestion**: good improvement, not merge-blocking
- If no issues are found, explicitly say so and call out any residual testing or release risk.

---

## Release Process Compliance (Blocker Checks)

When a PR includes user-facing changes that are intended for release, verify release-prep artifacts are updated per `apps/mobile/docs/release-process.md`.

Treat as **Blocker** when applicable but missing:
- `apps/mobile/BETA_UPDATE_NOTES.txt` updated with warm, user-facing branch highlights.
- `apps/mobile/src/components/BetaUpdateModal.tsx` updated for the release cycle:
	- `BETA_UPDATE_VERSION` bumped
	- `BETA_UPDATE_CHANGES` refreshed (max 5, user-visible impact)
- `apps/mobile/app.config.js` `expo.version` bumped for production release PRs.
- `apps/mobile/src/models/constants.ts` `APP_VERSION` matches `app.config.js` version.
- If shipping new notification controls, `NOTIFICATION_SETTINGS_NOTICE_VERSION` is bumped in `apps/mobile/src/models/constants.ts`.

If the PR is not a release PR, mark release-step items as "Not applicable" instead of raising false blockers.

---

## Branch Narrative + Testing Docs (Blocker Checks)

For feature branches with user-facing functionality or workflow changes:
- `apps/mobile/BRANCH_NARRATIVE.md` exists and reflects current work.
- `apps/mobile/TESTING.md` exists, has actionable manual QA steps, and aligns with branch scope.
- `TESTING.md` branch header matches active feature branch.

Missing or stale feature docs are **Blocker** for review completion.

---

## React Native / Expo Review Rules

### Architecture & Component Design
- Prefer functional components with hooks. Flag class components unless there's a documented reason.
- Components should follow single-responsibility. Flag components that mix data fetching, business logic, and rendering.
- Check that navigation follows the established Expo Router / React Navigation pattern used in the project.
- Screens should not contain inline styles beyond one-liners. Shared styles belong in a stylesheet or design system.

### Performance
- Flag `useEffect` calls with missing or overly broad dependency arrays.
- Warn on unnecessary re-renders: large components that don't use `React.memo`, callbacks not wrapped in `useCallback`, expensive computations not in `useMemo`.
- Warn on `FlatList` / `SectionList` usage without `keyExtractor`, `getItemLayout`, or `windowSize` optimization where the list is long.
- Flag image components that don't use a caching-aware solution (e.g., `expo-image` instead of raw `<Image>`).
- Be alert to heavy work happening on the JS thread that should be offloaded (animations should use `useNativeDriver: true` or Reanimated).

### Expo-Specific
- Flag usage of APIs not available in Expo Go if the project is still in managed workflow.
- Check that new native dependencies are reflected in  `app.config.js` plugins if required.
- Warn if `expo-updates` or OTA-sensitive files are changed without a comment explaining the intent.
- Check that environment variables use `EXPO_PUBLIC_` prefix for client-side exposure.

### Firestore & Data Safety
- Flag TypeScript optional (`?`) for Firestore document fields; require explicit nullable fields with `| null`.
- Flag Firestore writes that omit nullable fields instead of explicitly writing `null`.
- Flag `onSnapshot` listeners that assume non-null snapshots:
	- query listeners should use `snap?.docs ?? []` (or shared helper)
	- document listeners should guard before `exists` / `data` reads
- Flag missing error callbacks on subscriptions when a safe fallback state is expected.

### Destructive Action Safety
- Any irreversible user action must require confirmation via `useActionModal().confirm({ destructive: true, ... })` before execution.
- Examples: disconnect, leave circle, remove member, delete circle, or any permanent data removal.

### UX Copy & Terminology
- Ensure user-facing language uses:
	- "Circle" instead of "Channel"
	- "Host" instead of "Owner"
	- "Member" instead of "Subscriber"
- Ensure app tone is warm, playful, and encouraging (not formal/corporate).

### Selector and Storage Conventions
- Cross-slice selectors belong in `apps/mobile/src/store/crossSelectors/`, not inside individual slice files.
- AsyncStorage keys must be declared in `apps/mobile/src/models/constants.ts` and imported where used.

### Cross-Platform Compatibility
- Flag code that uses `Platform.OS === 'ios'` or `=== 'android'` without a clear justification or a corresponding else/fallback.
- Warn on direct use of `Dimensions.get('window')` without a listener or responsive hook — suggest `useWindowDimensions` instead.
- Check that any new UI is verified (or noted as needing verification) on both iOS and Android.
- Check safe-area usage on scroll and bottom actions (`useSafeAreaInsets`) to avoid clipped content.
- For bottom-sheet modals with `TextInput`, verify `ModalKeyboardView` + `useModalSheetPadding` pattern is followed.

### State Management
- Flag local state that should reasonably live in a shared store (Context, Zustand, Redux, etc.) if it's used across screens.
- Warn on prop drilling beyond two levels; suggest lifting to context or a store.
- Check that async state handling includes loading and error states — not just the happy path.

### Accessibility
- Flag interactive elements missing `accessibilityLabel` or `accessibilityRole`.
- Warn on `TouchableOpacity` / `Pressable` with no accessible text or hint.
- Check that color contrast for new UI elements is not obviously failing.

### Testing
- If business logic is added without a corresponding unit test, flag it as a suggestion.
- If a bug fix is submitted without a regression test, note that one would be valuable.

### Code Quality
- Flag `console.log` statements left in production paths.
- Warn on hardcoded strings that should be constants or i18n keys.
- Flag `any` types in TypeScript files — suggest a proper type or at least `unknown`.
- Warn on API calls made directly inside components without an abstraction layer (service, hook, or query).
- Flag `parseInt` / `parseFloat` usage; prefer `Number()`.
- Flag implicit-return arrow callbacks; prefer block body with explicit `return`.

---

## General Rules

- Never approve a PR that introduces hardcoded secrets, API keys, or credentials.
- Flag any dependency bumps that could have a breaking change, especially ones shared between the RN app and website.
- If a PR description is missing context on *why* a change was made (not just *what*), suggest the author add it.

---

## Tone & Format

- Be **specific**: reference the file and line when raising a concern.
- Distinguish between **blockers** (must fix before merge) and **suggestions** (nice to have).
- Lead with what's done well before raising issues.
# Copilot Instructions

## App tone

Angelia is a warm, playful, and encouraging app. All user-facing copy — placeholders, labels, empty states, toasts, and prompts — should reflect that energy. Avoid formal, corporate, or overly serious language. Write like a friendly, enthusiastic teammate.

## Channel badges

- Daily channels already include the word "Daily" in their badge text (the channel name itself contains "Daily").
  **Never** add a separate "Daily" label next to the badge — it is redundant.

## Daily channel display names

- Every user has exactly one daily channel, and its `name` is always `"Daily"` — showing it is meaningless.
- Wherever a daily channel's name would be displayed to the user (filter lists, pickers, labels, etc.), show the **owner's name** instead, formatted as `"FirstName L."` (first name + last initial + period).
- To resolve the owner, look up `channel.ownerId` in the users map (e.g. `selectAllUsersMapById` from `usersSlice`).
- The same rule applies to search/filter logic: match against the owner name, not the literal string `"Daily"`.

---

## Cloud Functions type sync

The notification types in `functions/src/index.ts` (the Cloud Functions entry point) mirror the types in `src/models/types.ts`. These **must be kept in sync** whenever notification types change.

Specifically, the following must always match between the two files:
- `AppNotificationType` union values
- `NotificationTarget` discriminated union shape
- `BaseAppNotification` fields (`actorId`, `target`, `createdAt`, `id`, `type`)
- Each per-notification-type interface (e.g. `JoinChannelRequestNotification`)

When adding a new notification type:
1. Add it to `AppNotificationType` in both files.
2. Add the corresponding interface in both files.
3. Add a `buildFcmPayload` branch in `functions/src/index.ts`.
4. Add a foreground toast handler in `src/components/DataListenerWrapper.tsx` (Effect 9).
5. Add a tap-routing branch in `src/app/_layout.tsx`.

---

## Keeping docs up to date

### PRODUCT_SUMMARY.md

`PRODUCT_SUMMARY.md` is the canonical product overview. Keep it current when:

- A **new core feature** is added or an existing one is significantly changed (e.g. new channel type, new post tier, new notification type).
- The **tech stack** changes (new major dependency, Firebase service, or platform support).
- A **key differentiator** no longer applies or a new one emerges.

Do **not** update it for routine bug fixes, refactors, UI tweaks, or minor additions that don't change what the product fundamentally is or does.

### README.md

`README.md` is the developer reference. Keep it current when:

- An **npm script** is added, removed, or its behavior meaningfully changes — update the *npm Scripts Reference* table.
- The **project structure** changes significantly (new top-level `src/` directory, major reorganization).
- A **new prerequisite** is required for local development.
- A **tricky bug** is found and resolved — add an entry to the *Known Bugs & Solutions* section describing the symptom, root cause, and fix with a file reference. Keep entries factual and concise.

Do **not** clutter the README with:
- Every minor dependency update
- Internal implementation details that don't affect the dev workflow
- Speculative or forward-looking notes

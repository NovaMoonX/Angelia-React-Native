# Copilot Instructions

## App tone

Angelia is a warm, playful, and encouraging app. All user-facing copy — placeholders, labels, empty states, toasts, and prompts — should reflect that energy. Avoid formal, corporate, or overly serious language. Write like a friendly, enthusiastic teammate.

## Terminology

- Use **"Circle"** instead of "Channel" in all user-facing text.
  - "Daily Channel" → **"Daily Circle"**
  - "Custom Channel" → **"Custom Circle"**
- Use **"Host"** instead of "Owner" when referring to the person who created a Circle.
- Use **"Member"** instead of "Subscriber" when referring to people who have joined a Circle.
- Internal code identifiers (variable names, Redux slices, Firestore collections, etc.) remain unchanged — only UI-facing strings change.

## Circle badges

- Daily circles already include the word "Daily" in their badge text (the circle name itself contains "Daily").
  **Never** add a separate "Daily" label next to the badge — it is redundant.

## Daily circle display names

- Every user has exactly one daily circle, and its `name` is always `"Daily"` — showing it is meaningless.
- Wherever a daily circle's name would be displayed to the user (filter lists, pickers, labels, etc.), show the **owner's name** instead, formatted as `"FirstName L."` (first name + last initial + period).
- To resolve the owner, look up `channel.ownerId` in the users map (e.g. `selectAllUsersMapById` from `usersSlice`).
- The same rule applies to search/filter logic: match against the owner name, not the literal string `"Daily"`.

---

## Firestore indexes (`firestore.indexes.json`)

`firestore.indexes.json` is the source of truth for composite Firestore indexes. Any query that combines filters on **two or more different fields** (including `in` with a second equality/inequality filter) requires a composite index. Missing indexes cause queries to fail silently on the client — the `onSnapshot` callback simply never fires.

**Keep `firestore.indexes.json` up to date whenever:**
- A new collection query is added in `src/services/firebase/firestore.ts` that uses more than one `where()` clause on different fields.
- An existing query gains a new filter.
- A query is removed (remove its index entry to keep the file clean).

**Current required indexes:**
| Collection | Fields | Reason |
|---|---|---|
| `posts` | `channelId ASC`, `markedForDeletionAt ASC` | `subscribeToPosts` uses `in` + `== null` |
| `connectionRequests` | `fromId ASC`, `toId ASC`, `status ASC` | `getExistingConnectionRequest` uses three filters |
| `channels` | `inviteCode ASC`, `markedForDeletionAt ASC` | `getChannelByInviteCode` uses two filters |

After updating `firestore.indexes.json`, deploy with:
```bash
npm run deploy:indexes
```

---

## Firestore field conventions

- **Never** use TypeScript optional (`?`) for fields that are stored in Firestore documents. Instead, use `| null` for nullable fields. Firestore does not natively support `undefined`, and optional fields can lead to subtle bugs or missing fields in documents.
  - ✅ `note: string | null`
  - ❌ `note?: string`
- Always provide an explicit value (including `null`) when writing documents, so the field is always present in Firestore.

---

## Cloud Functions type sync

The notification types in `functions/src/index.ts` (the Cloud Functions entry point) mirror the types in `src/models/types.ts`. These **must be kept in sync** whenever notification types change.

Specifically, the following must always match between the two files:
- `AppNotificationType` union values
- `NotificationTarget` discriminated union shape
- `BaseAppNotification` fields (`actorId`, `target`, `createdAt`, `id`, `type`)
- Each per-notification-type interface (e.g. `JoinChannelRequestNotification`)
- Domain model interfaces used by Cloud Functions (e.g. `ConnectionRequest`, `ChannelJoinRequest`)

When adding a new notification type:
1. Add it to `AppNotificationType` in both files.
2. Add the corresponding interface in both files.
3. Add a `buildFcmPayload` branch in `functions/src/index.ts`.
4. Add a foreground toast handler in `src/components/DataListenerWrapper.tsx` (Effect 9).
5. Add a tap-routing branch in `src/app/_layout.tsx`.
6. **Add a Firestore test example to `NOTIFICATION_TESTING.md`** (Scenario C, D, etc.) so the notification can be manually tested without a real device action.

---

## Cross-slice selectors (`src/store/crossSelectors/`)

Selectors that need to read from **more than one Redux slice** live in
`src/store/crossSelectors/`. Do **not** put cross-slice selectors directly in
individual slice files — they create circular-import risks and make it harder to
discover shared logic.

Conventions:
- One file per domain concern, named `<domain>Selectors.ts`
  (e.g. `activitySelectors.ts`, `myPeopleSelectors.ts`).
- Use RTK `createSelector` for memoisation.
- Import the file directly from `@/store/crossSelectors/<file>` — do not create
  a barrel `index.ts` unless the directory grows large enough to warrant one.

Current files:
| File | Exports | Purpose |
|---|---|---|
| `activitySelectors.ts` | `selectHasAnyPendingActivity` | `true` when user has any pending circle join request OR connection request — drives the bell badge in the feed header |
| `myPeopleSelectors.ts` | `selectMyPeopleData` | Derives a `people` array of `{ user, inCircle }` entries for the My People screen. `inCircle` is `true` when the person also shares a circle with the current user. |

---

## Safe area insets & demo-mode header gap

### Bottom insets
Always use `useSafeAreaInsets()` to account for home-bar / system-navigation-bar height.
- For `ScrollView`, apply the inset to `contentContainerStyle`:
  ```tsx
  contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
  ```
- For fixed `View` containers, apply it inline:
  ```tsx
  style={{ paddingBottom: insets.bottom + 24 }}
  ```
- **Never** use a flat pixel constant for bottom padding — it will clip content on devices with a home bar or soft navigation buttons.
- Prefer `ScrollView` over a plain `View` for any screen whose content could exceed the viewport, so users can always reach every button/action.

### Demo-mode header gap

In demo mode the `DemoModeBanner` is rendered **above** the `Stack` navigator in `_layout.tsx`, consuming the status-bar area. Expo Router uses `@react-navigation/native-stack` (NativeStack), which reads `useSafeAreaInsets().top` internally — meaning any NativeStack-managed header would double-count that gap.

**The fix: always use `headerShown: false` + `<ScreenHeader>` for any screen that needs a back button or title.**

> ⚠️ **Do NOT use NativeStack's built-in header** (`headerShown: true`) for screens inside this layout. NativeStack ignores `headerStatusBarHeight` (a JS Stack-only prop) and always adds its own top-inset padding regardless.
> ⚠️ **Do NOT use `SafeAreaInsetsContext.Provider`** to override top insets for the Stack — it does not work with NativeStack.

**`ScreenHeader` component** lives at `src/components/ScreenHeader.tsx`:
```tsx
<ScreenHeader title="My Screen" />
// Optional props:
// showBack?: boolean  (default: true)
// onBack?: () => void (default: router.back())
```
It reads `isDemo` from Redux and handles `paddingTop` automatically:
- demo mode → `paddingTop: 10`
- normal → `paddingTop: insets.top + 10`

**Pattern for screens with a header:**
```tsx
// In _layout.tsx:
<Stack.Screen name="my-screen" options={{ headerShown: false }} />

// In my-screen.tsx:
return (
  <View style={{ flex: 1 }}>
    <ScreenHeader title="My Screen" />
    {/* rest of content, e.g. ScrollView or KeyboardAvoidingView */}
  </View>
);
```

Place `<ScreenHeader>` **outside** any `<KeyboardAvoidingView>` so the existing `KEYBOARD_VERTICAL_OFFSET = 90` constant remains valid (the header height approximately matches the old native header height).

For screens that use a fully custom animated header (e.g. `conversation.tsx`), handle `paddingTop` manually: `paddingTop: isDemo ? 10 : insets.top + 10`.

---

## User Avatar (`user` prop)

The `Avatar` component accepts a `user` prop (`Pick<User, 'avatar' | 'avatarUrl'> | null`) that automatically resolves both the preset emoji and any custom profile photo. When `user` is provided, `preset` and `uri` are ignored.

**Always pass `user={user}` whenever rendering an Avatar for a specific user**, including:
- Post detail screens (the post author's avatar)
- Conversation / chat headers
- Profile cards and modals
- The share-connection screen (current user's avatar)
- Any other screen that shows a user's identity

```tsx
// ✅ correct — automatically uses avatarUrl if set, falls back to avatar preset
<Avatar user={user} size="md" />

// ❌ old pattern — do not use for User objects
<Avatar preset={user.avatar} uri={user.avatarUrl} size="md" />
```

The individual `preset` and `uri` props are only for non-User contexts, such as avatar edit previews (e.g. `AccountTab`, `complete-profile.tsx`) where the values come from local state rather than a `User` object.

---

## Keeping docs up to date

### PRODUCT_SUMMARY.md

`PRODUCT_SUMMARY.md` is the canonical product overview. Keep it current when:

- A **new core feature** is added or an existing one is significantly changed (e.g. new circle type, new post tier, new notification type).
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

---

## Code style conventions

### AsyncStorage keys

All `@angelia/…` AsyncStorage keys **must** be declared once as named exports in `src/models/constants.ts` and imported wherever they are used. Never define the same key string in more than one file. If a key is parameterised (e.g. per-post), export it as a function:

```ts
// ✅ correct — declared once, exported, imported elsewhere
export const PRIVATE_NOTES_SEEN_KEY = (postId: string) => `@angelia/private_notes_seen_${postId}`;

// ❌ wrong — local constant repeated across files
const PRIVATE_NOTES_SEEN_KEY = (postId: string) => `@angelia/private_notes_seen_${postId}`;
```

### `Number()` vs `parseInt`

Always use `Number()` to convert strings to numbers. Never use `parseInt` or `parseFloat`:

```ts
// ✅
const lastSeen = val ? Number(val) : 0;

// ❌
const lastSeen = val ? parseInt(val, 10) : 0;
```

### Arrow function return values

Arrow functions must always use an **explicit `return`** statement inside a block body `{ }`. Do not rely on implicit expression returns:

```ts
// ✅
allNotes.filter((n) => { return n.authorId === uid; })

// ❌
allNotes.filter((n) => n.authorId === uid)
```

This applies to all callbacks, `filter`, `map`, `find`, `sort`, etc.

### Icon + emoji: no duplicates

When a UI element already uses a vector icon (e.g. `<Feather name='mail' />`), do **not** also append a redundant emoji (e.g. `💌`) to the adjacent label. The icon and the emoji convey the same meaning — showing both is visually noisy.

```tsx
// ✅ icon-only with clean label
<Feather name='mail' size={15} color={theme.primary} />
<Text>or send {name} a private note</Text>

// ❌ icon + emoji duplicate
<Feather name='mail' size={15} color={theme.primary} />
<Text>Send {name} a private note 💌</Text>
```

### React Native: bottom-sheet modal keyboard-dismiss jump (Android)

**Symptom:** When a keyboard is dismissed *inside* a bottom-sheet `<Modal>` on Android, the sheet jumps between bottom-aligned and padded positions.

**Cause:** Using `behavior='height'` on the `<KeyboardAvoidingView>` inside a Modal causes the KAV container *height* to animate when the keyboard hides. Because the backdrop uses `justifyContent: 'flex-end'`, restoring the KAV height forces the sheet to re-anchor, producing a visible snap/jump.

**Fix:** Always use `behavior='padding'` (on **both** iOS and Android) for `<KeyboardAvoidingView>` inside a bottom-sheet `<Modal>`. `padding` adjusts only the internal spacing — the container height stays stable and the jump disappears.

```tsx
// ✅ — no jump on keyboard dismiss
<KeyboardAvoidingView style={{ flex: 1 }} behavior='padding'>

// ❌ — jumps on Android when keyboard closes
<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
```

See `src/components/PrivateNoteModal.tsx` for the canonical implementation.

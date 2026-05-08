# Angelia App Improvement Analysis

> Making Angelia feel like a native mobile app — not a web page in a wrapper.
>
> Benchmarked against: Instagram, WhatsApp, Discord, TikTok, Telegram, iMessage, Signal

---

## 🔴 Critical — Must-Fix for App-Like Feel

### 1. Add Bottom Tab Navigation

**Current:** The app uses only Stack navigation. Users must navigate to the feed, then manually push to Account, then go back. There's no quick way to jump between main sections.

**Expected (modern apps):** Instagram, WhatsApp, Discord, and TikTok all use a persistent bottom tab bar for primary destinations (Feed, Search/Discover, Create, Notifications, Profile).

**Recommendation:**
- Implement a bottom tab navigator using `@react-navigation/bottom-tabs` (or expo-router's `Tabs` layout)
- Primary tabs: **Feed**, **Channels**, **Notifications**, **Profile**
- The "New Post" action can remain as a FAB or become a center tab button
- Use icon + label format with a badge indicator for unread notifications

---

### 2. Add Haptic Feedback

**Current:** Zero haptic feedback anywhere in the app. Every tap feels the same — like poking a screen.

**Expected:** Instagram and TikTok use haptic feedback on reactions, likes, navigation taps, and success/error states. iOS apps especially rely on haptics for tactile confirmation.

**Recommendation:**
- Install `expo-haptics`
- Add light haptic on button presses and tab changes
- Add medium haptic on reactions and emoji taps
- Add success/error haptics for form submissions and actions
- Add selection haptic for toggle switches and selectors

---

### 3. Add Pull-to-Refresh on Feed

**Current:** The feed's `FlatList` has no `RefreshControl`. Users cannot pull down to refresh — a pattern so universal that its absence feels broken.

**Expected:** Every social/messaging app supports pull-to-refresh on feeds and lists.

**Recommendation:**
- Add `RefreshControl` to the feed `FlatList`
- Show a native spinner during refresh
- In demo mode, simulate a brief delay before "refreshing"

---

### 4. Add Swipe Gestures

**Current:** No swipe interactions. Posts can only be tapped. Modals can only be closed via buttons.

**Expected:** WhatsApp has swipe-to-reply, Instagram has swipe-to-go-back, Telegram has swipe-to-archive, and every iOS app supports gesture-driven modal dismissal.

**Recommendation:**
- Add swipe-to-go-back on Stack screens (already supported by react-navigation, ensure it's enabled)
- Add gesture-driven modal dismissal (drag down to close)
- Consider swipe actions on post cards (e.g., swipe to react quickly)
- Use `react-native-gesture-handler` for custom swipe interactions

---

### 5. Improve Accessibility

**Current:** Minimal accessibility. Only the `Button` component has `accessibilityRole` and `accessibilityLabel` support. Icons, avatars, reactions, and navigation elements have no accessibility attributes.

**Expected:** iOS and Android guidelines require accessible labels on all interactive elements. Screen readers should be able to navigate the entire app.

**Recommendation:**
- Add `accessibilityLabel` and `accessibilityRole` to all `Pressable` and interactive elements
- Add `accessibilityHint` for non-obvious actions (e.g., "Double tap to open post details")
- Add alt text to avatars and media
- Support Dynamic Type (use relative font sizing or `allowFontScaling`)
- Announce live regions for new content (new posts, reactions, notifications)

---

## 🟠 High Priority — Missing Features That Modern Apps Have

### 6. Add Long-Press Context Menus

**Current:** No long-press handling on any element.

**Expected:** Long-pressing a message in iMessage shows reactions. Long-pressing a post in Instagram shows a preview. Discord shows a full context menu on long-press.

**Recommendation:**
- Add `onLongPress` to post cards with options: Copy Text, Share, Report
- Add long-press on messages in conversation for: Copy, Reply, React
- Use a native-style action sheet (`ActionSheetIOS` on iOS or a bottom sheet on Android)

---

### 7. Replace Web-Style Select/Dropdown with Native Picker

**Current:** The `Select` component renders a centered modal overlay with options — a pattern from web UIs.

**Expected:** iOS uses `ActionSheetIOS` or a bottom picker wheel. Android uses a native dropdown or bottom sheet.

**Recommendation:**
- On iOS: Use `ActionSheetIOS.showActionSheetWithOptions` for short lists
- On Android: Use a native bottom sheet or the built-in `Picker` component
- For the channel filter on the feed, consider a horizontal chip/pill selector instead of a dropdown

---

### 8. Add Push Notification Infrastructure

**Current:** The `BellIcon` component shows a dot indicator for pending invites, but there's no push notification system.

**Expected:** Every messaging and social app sends push notifications for new posts, reactions, comments, and invites.

**Recommendation:**
- Set up `expo-notifications` for local and push notifications
- Register for push tokens on login
- Send notifications for: new posts in subscribed channels, reactions to your posts, new comments, channel invites
- Add notification preferences in Account settings

---

### 9. Add Share Sheet Integration

**Current:** No way to share content from within the app.

**Expected:** Instagram, TikTok, and WhatsApp all have native share buttons that open the system share sheet.

**Recommendation:**
- Add a share button on post detail using `Share.share()` from React Native
- Share post text and a deep link to the post
- Add share option for channel invite codes

---

### 10. Add Deep Linking

**Current:** No deep linking configuration visible. The app can't be opened to a specific screen from an external link.

**Expected:** WhatsApp opens specific chats from links. Instagram opens specific posts. This is table stakes for mobile apps.

**Recommendation:**
- Configure expo-router's deep linking for routes like `angelia://post/[id]`, `angelia://invite/[channelId]/[code]`
- Add universal links support for web URLs

---

## 🟡 Medium Priority — Polish & Refinement

### 11. Create a Design Token System

**Current:** Spacing, font sizes, border radii, and shadow values are hardcoded throughout the app with no consistent scale.

**Examples of inconsistency:**
- Padding varies between `12`, `16`, `20`, `24`, `40` with no rationale
- Font sizes range from `12` to `40` with no defined scale
- Border radii: `6`, `8`, `11`, `12`, `16`, `20`, `21`, `25`, `28` — no system

**Recommendation:**
- Create a `tokens.ts` file with:
  - Spacing scale: `4, 8, 12, 16, 24, 32, 48`
  - Font size scale: `xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28, display: 36`
  - Border radius scale: `sm: 6, md: 10, lg: 16, full: 9999`
  - Shadow presets: `subtle`, `card`, `elevated`, `floating`

---

### 12. Improve Button Press Feedback

**Current:** Buttons only change opacity on press (`0.8`). No scale animation, no ripple effect.

**Expected:** Instagram buttons scale down slightly on press. Android apps show ripple effects. Modern apps use spring animations for press states.

**Recommendation:**
- Add `Animated.spring` scale animation on press (scale to `0.97`)
- Use `TouchableNativeFeedback` with ripple on Android
- Add distinct press states per variant (primary: scale + darken, outline: scale + fill, etc.)

---

### 13. Add Skeleton Loading States

**Current:** Only `SkeletonPostCard` exists and is only used as the "load more" footer. Initial app load shows a basic spinner.

**Expected:** Instagram shows skeleton cards while loading. Discord shows skeleton messages. TikTok shows placeholder content.

**Recommendation:**
- Show skeleton post cards during initial feed load
- Add skeleton loaders for the account screen (profile section, channels)
- Add shimmer animation to skeletons (currently uses fade opacity)

---

### 14. Improve Empty States

**Current:** Empty feed shows `📭 No posts yet. Create your first post!` — text only, no action button.

**Expected:** Modern apps show illustrated empty states with a clear CTA button. WhatsApp shows "Start a conversation" with a button. Instagram shows "Share your first photo."

**Recommendation:**
- Add a CTA button to the empty state (e.g., "Create Your First Post" button)
- Consider adding an illustration or more prominent visual
- For channels: show "Create your first channel" with a button
- For notifications: show "All caught up!" with a positive illustration

---

### 15. Add Image Optimization

**Current:** `expo-image` is used but without optimization props. No blur placeholders, no progressive loading, no explicit caching strategy.

**Expected:** Instagram loads blurred thumbnails first, then sharp images. TikTok preloads video thumbnails.

**Recommendation:**
- Add `placeholder` prop with a blurhash or low-res thumbnail
- Add `transition` prop for fade-in effect on load
- Configure `cachePolicy` for aggressive caching
- Add image compression before upload in `PostCreateMediaUploader`

---

### 16. Optimize FlatList Performance

**Current:** Feed `FlatList` is missing several optimization props.

**Recommendation:**
- Add `removeClippedSubviews={true}` for off-screen item cleanup
- Add `maxToRenderPerBatch={10}` to limit render batches
- Add `windowSize={5}` to limit rendered items outside viewport
- Add `getItemLayout` if post cards have consistent heights
- Increase `LOAD_MORE` from 3 to 10 for smoother infinite scroll

---

### 17. Improve the Carousel Component

**Current:** Carousel uses text characters ("‹" and "›") for navigation arrows — a web pattern. Requires manual button taps to navigate.

**Expected:** Instagram and TikTok carousels are purely swipe-based with dot indicators. No arrow buttons.

**Recommendation:**
- Remove arrow buttons, rely on swipe gestures only
- Add dot/pill indicators below the carousel showing current position
- Use `react-native-reanimated` for smooth swipe transitions
- Consider using `FlatList` with `pagingEnabled` instead of custom scroll logic

---

### 18. Add Form Validation Feedback

**Current:** `Input` and `Textarea` components have no error state — no red border, no error message display.

**Expected:** Every modern app shows inline validation errors (red border + error text below the field).

**Recommendation:**
- Add `error` and `errorMessage` props to `Input` and `Textarea`
- Show red border and error text when `error` is true
- Add real-time validation (e.g., email format, required fields)

---

## 🟢 Nice-to-Have — Delightful Touches

### 19. Add Animated Tab Transitions

Tabs should support swipe navigation between tab content (swipe left/right to switch tabs), with a smooth animated indicator. This is standard in Material Design tabs.

### 20. Add Native Emoji Picker

Replace the custom emoji `TextInput` for reactions with a proper emoji picker or at least quick-access emoji buttons with categories. Consider using a library like `rn-emoji-keyboard`.

### 21. Add Search Functionality

Modern social apps have prominent search for finding posts, channels, and users. Consider adding a search tab or search bar on the feed screen.

### 22. Add Profile Picture Upload

Currently, users can only choose from emoji avatar presets. Consider adding camera/gallery photo upload for profile pictures, which is expected in social apps.

### 23. Add Micro-Animations

- Reaction emoji should "pop" when tapped (scale up then back to normal)
- New posts should animate into the list
- Channel badges should pulse when newly created
- Toast notifications should slide in with a spring animation

### 24. Add Offline Support

Modern messaging apps work offline. Queued messages send when connectivity returns. Posts should be viewable from cache even without internet.

### 25. Add Read Receipts / Activity Indicators

For channels, show who has viewed recent posts. For conversations, show typing indicators and read receipts — patterns from iMessage and WhatsApp.

---

## Summary

| Priority | Count | Impact |
|----------|-------|--------|
| 🔴 Critical | 5 | App feels broken without these |
| 🟠 High | 5 | Major missing features users expect |
| 🟡 Medium | 8 | Polish that separates good from great |
| 🟢 Nice-to-Have | 7 | Delightful touches for retention |

The single most impactful change would be **adding bottom tab navigation** — it instantly transforms the app from feeling like a web page to feeling like a real mobile application. Combined with haptic feedback and pull-to-refresh, these three changes alone would dramatically improve the perceived quality of the app.

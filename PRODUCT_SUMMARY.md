# Angelia — Product Summary

## What It Is

Angelia is a warm, private social app for people who want to stay genuinely connected with the people who matter most. Instead of broadcasting to a public audience, users share life updates — big and small — through invite-only channels with close friends, family, or small communities.

---

## Target Users

- People who feel overwhelmed by public social media but still want to share life moments with people they care about
- Families and friend groups who want a shared, low-pressure space to stay in the loop
- Anyone who values intentional sharing over performance-driven posting

---

## Core Concepts

### Channels
Channels are the backbone of Angelia. Each channel is a private stream owned by one person and shared with invited subscribers.

- **Daily Channels** — Auto-created for every user. A personal stream for everyday moments.
- **Custom Channels** — Up to 3 additional channels per user (e.g. "Family", "Travel", "Work Friends"), each with a custom color and description.
- Channels use **invite codes** and **QR codes** for easy, controlled access. New subscribers send a join request that the owner approves or declines.

### Posts & Tiers
Posts are the updates shared inside channels. Every post supports:
- Text, images, and video (up to 5 files, 10 MB each)
- **Emoji reactions** from a curated set
- **Threaded comments** with conversation enrollment (opt-in follow-up notifications)
- A **post tier** to signal importance:
  - 📅 **Everyday Update** — the default, no badge
  - ⭐ **Worth Knowing** — amber badge for noteworthy moments
  - 🔔 **Big News** — red badge for major announcements

### Feed & Filtering
The main feed aggregates posts from all subscribed channels. Users can filter by channel and by post tier, so they can quickly skim for big news or catch up on everything at their own pace.

### Notifications
- **Daily Prompts** — Scheduled local reminders to encourage users to post. Configurable time, timezone (manual or auto-detected), and on/off toggle.
- **Channel Join Requests** — In-app notification panel where channel owners can approve or decline pending requests.
- Built on **expo-notifications** for local scheduling and **Firebase Cloud Messaging (FCM)** for push delivery.

---

## Key Features

| Feature | Description |
|---|---|
| Private invite-only channels | No public profiles or discovery — you choose who's in |
| Daily channel | Built-in personal journal stream, always ready |
| Post tiers | Signal importance without cluttering the feed |
| Rich media posts | Photos and videos with auto-generated thumbnails |
| Emoji reactions & comments | Lightweight engagement without a like-count culture |
| QR code invites | Shareable QR for fast, frictionless channel joins |
| Daily prompt reminders | Gentle nudges to post, with full timezone control |
| Cosmic avatar presets | 12 whimsical avatars (no profile photos needed) |
| User status | Emoji + text status with expiry, like a lightweight "what I'm up to" |
| Dark / light mode | Automatic system-based theming |
| Demo mode | Full app experience without an account |

---

## Tech Stack

- **React Native** (Expo, Expo Router)
- **Firebase** — Auth (email + Google Sign-In), Firestore, Storage, Cloud Messaging
- **Redux Toolkit** — global state management
- **TypeScript** throughout

---

## Differentiators

- **Truly private by design** — no public feeds, no follower counts, no algorithmic ranking
- **Low-pressure posting** — post tiers and daily prompts encourage sharing without performance anxiety
- **Warm, playful tone** — the UI, copy, and avatar system all reinforce a friendly, human feel
- **Minimal friction** — QR code + invite code onboarding, no complex settings

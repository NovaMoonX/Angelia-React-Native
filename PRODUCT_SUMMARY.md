# Angelia — Product Summary

## What It Is

Angelia is a warm, private social app for people who want to stay genuinely connected with the people who matter most. Instead of broadcasting to a public audience, users share life updates — big and small — through invite-only Circles with close friends, family, or small communities.

---

## Target Users

- People who feel overwhelmed by public social media but still want to share life moments with people they care about
- Families and friend groups who want a shared, low-pressure space to stay in the loop
- Anyone who values intentional sharing over performance-driven posting

---

## Core Concepts

### Circles
Circles are the backbone of Angelia. Each Circle is a private stream hosted by one person and shared with invited members.

- **Daily Circles** — Auto-created for every user. A personal stream for everyday moments.
- **Custom Circles** — Up to 3 additional circles per user (e.g. "Family", "Travel", "Work Friends"), each with a custom color and description.
- Circles use **invite codes** and **QR codes** for easy, controlled access. New members send a join request that the host approves or declines.

### Posts & Tiers
Posts are the updates shared inside circles. Every post supports:
- Text, images, and video (up to 5 files, 10 MB each)
- **Emoji reactions** from a curated set
- **Threaded comments** with conversation enrollment (opt-in follow-up notifications)
- A **post tier** to signal importance:
  - 📅 **Everyday Update** — the default, no badge
  - ⭐ **Worth Knowing** — amber badge for noteworthy moments
  - 🔔 **Big News** — red badge for major announcements

**Post retention** — Posts are automatically cleaned up to keep circles fresh:
- Daily Circle posts are kept for **14 days**.
- Custom Circle posts are kept for **3 months (90 days)**.

### Feed & Filtering
The main feed aggregates posts from all joined circles. Users can filter by circle and by post tier, so they can quickly skim for big news or catch up on everything at their own pace.

### Notifications
- **Dual Daily Prompts** — Two scheduled local reminders: a mid-day check-in and an evening wind-down prompt. Users set their busy hours during onboarding; the app schedules a nudge in the middle of their day and another ~30 minutes after they normally wind down. Configurable times, timezone (manual or auto-detected), and on/off toggle.
- **Circle Join Requests** — In-app notification panel where circle hosts can approve or decline pending requests.
- Built on **expo-notifications** for local scheduling and **Firebase Cloud Messaging (FCM)** for push delivery.

### Onboarding
A guided 5-step wizard that establishes the warm, playful brand voice from the very first interaction:
1. **Identity & Tone** — Name entry and Cosmic Avatar selection.
2. **Join or Start** — Choose to join a friend's Circle (via QR / invite code) or start your own.
3. **Circle Templates** — Pick up to 2 life categories (Family & Friends, Hobbies, Life Log) to define the first Custom Circle.
4. **Habit Hook** — Set busy hours so the app can schedule mid-day and wind-down prompts.
5. **First Gift** — Post an initial update to break the ice.

---

## Key Features

| Feature | Description |
|---|---|
| Private invite-only circles | No public profiles or discovery — you choose who's in |
| Daily circle | Built-in personal journal stream, always ready |
| Post tiers | Signal importance without cluttering the feed |
| Rich media posts | Photos and videos with auto-generated thumbnails |
| Emoji reactions & comments | Lightweight engagement without a like-count culture |
| QR code invites | Shareable QR for fast, frictionless circle joins |
| Dual daily prompt reminders | Mid-day check-in + evening wind-down nudges, with full timezone control |
| Cosmic avatar presets | Whimsical avatars (no profile photos needed) |
| User status | Emoji + text status with expiry, like a lightweight "what I'm up to" |
| Dark / light mode | Automatic system-based theming |
| Demo mode | Full app experience without an account |
| Guided onboarding wizard | 5-step flow with progress bar, circle templates, and habit hook |

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
- **Minimal friction** — QR code + invite code onboarding, guided wizard, no complex settings

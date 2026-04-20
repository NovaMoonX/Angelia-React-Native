# Angelia — Product Summary

## What It Is

Angelia is a warm, private social app for people who want to stay genuinely connected with the people who matter most. Instead of posting to a public audience, users share life updates — big and small — inside invite-only Circles with close friends, family, and trusted groups.

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

### Connections

Angelia also includes a lightweight people layer built around trusted connections.

- Users can share a personal **connection link** or **QR code**.
- New people send a **connection request** that must be accepted.
- Once connected, both people can see each other's **Daily Circle** and appear in **My People**.

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

The main feed aggregates posts from all joined circles. Users can filter by circle and by post tier, helping them skim for major updates or settle in for a full catch-up.

### Notifications

- **Dual Daily Prompts** — Two scheduled local reminders: a mid-day check-in and an evening wind-down prompt. Users set their busy hours during onboarding, and Angelia schedules both nudges around that routine.
- **Join & Connection Requests** — In-app notifications help hosts review circle join requests and connection requests in one place.
- **Push notifications** — Built with **expo-notifications** and **Firebase Cloud Messaging (FCM)** for timely delivery.

### Onboarding

A guided 6-step onboarding flow introduces the product and helps users set up a meaningful, low-pressure experience right away:

1. **Identity & Tone** — Name entry, avatar selection, or custom profile photo.
2. **Join or Start** — Choose to join a friend's Circle (via QR / invite code) or start your own.
3. **Circle Setup** — Pick from Family & Friends, Hobbies, and Life Log templates to shape up to 3 custom Circles.
4. **Habit Hook** — Set busy hours so the app can schedule mid-day and wind-down prompts.
5. **Connection Bridge** — Share a connection link or QR code to bring trusted people in.
6. **First Gift** — Post an initial update to break the ice.

---

## Key Features

| Feature | Description |
|---|---|
| Private invite-only circles | No public profiles or discovery — you choose who's in |
| Daily circle | Built-in personal journal stream, always ready |
| Connection sharing | Personal links and QR codes help trusted people connect before joining your world |
| My People | A dedicated place to see your accepted connections and who is already in your circles |
| Post tiers | Signal importance without cluttering the feed |
| Rich media posts | Photos and videos with auto-generated thumbnails |
| Emoji reactions & comments | Lightweight engagement without a like-count culture |
| QR code invites | Shareable QR for fast, frictionless circle joins |
| Dual daily prompt reminders | Mid-day check-in + evening wind-down nudges, with full timezone control |
| Profile identity | Whimsical avatar presets plus optional custom profile photos |
| User status | Emoji + text status with expiry, like a lightweight "what I'm up to" |
| Dark / light mode | Automatic system-based theming |
| Demo mode | Full app experience without an account |
| Guided onboarding wizard | 6-step flow with circle setup, habit hooks, connection sharing, and first-post guidance |

---

## Tech Stack

- **React Native** (Expo, Expo Router)
- **Firebase** — Auth (email + Google Sign-In), Firestore, Storage, Cloud Messaging
- **React Native Firebase** + **expo-notifications** for messaging and notification delivery
- **Redux Toolkit** — global state management
- **TypeScript** throughout

---

## Differentiators

- **Truly private by design** — no public feeds, no follower counts, no algorithmic ranking
- **Low-pressure posting** — post tiers, gentle prompts, and async catch-up reduce the pressure to perform or reply instantly
- **Warm, playful tone** — the UI, copy, and avatar system all reinforce a friendly, human feel
- **Built for trusted relationships** — circles and connections work together so sharing stays personal, not performative
- **Minimal friction** — QR codes, invite codes, connection links, and guided onboarding keep setup simple

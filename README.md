# Angelia — Mono Repo

This repo contains both the Angelia mobile app and the Angelia marketing website, organized as a mono repo under `apps/`.

## Structure

| Path | Description |
|---|---|
| `apps/mobile/` | Expo / React Native app |
| `apps/web/` | Vite + React marketing site (Home & About) |

## Getting Started

### Mobile (`apps/mobile/`)

See [apps/mobile/README.md](apps/mobile/README.md) for full setup instructions.

```bash
cd apps/mobile
npm install
npm run start
```

### Web (`apps/web/`)

```bash
cd apps/web
npm install
npm run dev
```

## Root Scripts

These convenience scripts run the respective workspace commands from the root:

| Script | Description |
|---|---|
| `npm run mobile` | Start the Expo dev server |
| `npm run web` | Start the Vite dev server |
| `npm run web:build` | Build the web app for production |
| `npm run web:preview` | Preview the production web build |

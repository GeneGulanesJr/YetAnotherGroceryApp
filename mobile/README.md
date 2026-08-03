# YetAnotherGroceryApp — Mobile

The mobile application is the primary data-capture surface for YetAnotherGroceryApp.
It targets Android and iOS, works offline-first, and synchronizes with the shared
backend that the desktop application also reads from.

This package contains the initial scaffold. See [`../tech.mobile.md`](../tech.mobile.md)
for the full technical requirements.

## Stack

- **React Native** + **TypeScript** (strict mode)
- **Expo** (`expo prebuild`) with the New Architecture enabled
- **React Navigation** — native stack + bottom tabs
- **NativeWind** (Tailwind-based styling) with light/dark themes
- **Zustand** for transient UI state
- **TanStack Query** for optional server lookups
- **Drizzle ORM** schema for the local SQLite store (offline-first)
- Money stored as integer minor units (see `src/utils/money.ts`)

## Project structure

```
mobile/
├── App.tsx                  # Providers (query, safe area, gesture, navigation)
├── app.json                 # Expo config + permissions
├── src/
│   ├── navigation/          # Root navigator + bottom-tab navigator
│   ├── screens/             # Shopping, Lists, Capture, Library, History, Settings
│   ├── components/          # Shared UI building blocks
│   ├── theme/               # Design tokens (light/dark)
│   ├── store/               # Zustand stores
│   ├── utils/               # Pure helpers (money parsing/formatting + tests)
│   └── db/                  # Drizzle schema mirroring the backend tables
└── eas.json                 # EAS Build profiles
```

## Primary sections

Shopping · Lists · Capture · Library · History · Settings — matching the flows
described in the technical requirements.

## Scripts

| Script                  | Description                                  |
| ----------------------- | -------------------------------------------- |
| `npm start`             | Start the Expo dev server                    |
| `npm run ios`           | Build/run on iOS (requires a native build)   |
| `npm run android`       | Build/run on Android (requires a native build)|
| `npm run typecheck`     | Run `tsc --noEmit`                           |
| `npm test`              | Run Jest unit tests                          |

## What is implemented

- Expo + TypeScript strict project bootstrapping
- Six primary navigation tabs with placeholder screens
- NativeWind theming with light/dark support
- Zustand and TanStack Query providers wired up
- Drizzle schema for `products`, `prices`, and `stores` including shared sync
  columns (`id`, timestamps, `device_id`, `revision`, `sync_status`)
- Integer-minor-unit money parsing/formatting with unit tests

## Not yet implemented (next phases)

- Camera + barcode scanning (`react-native-vision-camera`, ML Kit)
- OCR capture flow (`expo-mlkit-ocr`) with confirmation overlays
- SQLite initialization, migrations, and repository layer via `expo-sqlite`
- Receipt processing and price-comparison pipeline
- Pull/push delta sync engine with last-write-wins conflict resolution
- Background tasks (`expo-task-manager`, `expo-background-task`)
- E2E tests (Detox)

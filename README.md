# Locaface Client (Expo)

Locaface is a mobile client built with Expo + React Native. project is a smart, AI-powered automated attendance system built with a modern full-stack architecture. The mobile client is developed using React Native, seamlessly integrating device cameras and geo-location for real-time presence tracking. The core biometric engine is an independent FastAPI microservice that utilizes the Deepface library and ArcFace model to accurately validate facial identities via cosine similarity calculations. For scalable data management, the system relies on Supabase (PostgreSQL), implementing strict Row Level Security (RLS) policies to ensure robust data privacy, secure authentication, and precise role-based access control between instructors and students

## Tech Stack

- Expo SDK 54
- React Native + TypeScript
- Expo Router (file-based routing)
- Supabase (`@supabase/supabase-js`)
- Vision Camera + face detector
- NativeWind (Tailwind-style RN utilities)

## Main Features

- Google Sign-In authentication
- Onboarding flow with profile setup and face registration (front/left/right)
- Class management (create, join by code, view details)
- Geofenced attendance flow (called "precence" in UI)
- Attendance history and proof preview
- Instructor tools: announcement, member management, session recap

## Project Structure (Client)

- `app/` – all routes/screens (`expo-router`)
- `src/lib/` – Supabase client, security helpers, business utilities
- `src/components/` – reusable UI components
- `assets/` – static assets

## Prerequisites

- Node.js 18+
- npm 9+
- Android Studio (for Android builds) and/or Xcode (for iOS)
- Expo CLI tooling (via `npx` is fine)

## Environment Variables

Create a `.env` file in `locaface/`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

# Optional (if used by your security service implementation)
EXPO_PUBLIC_AI_SERVICE_URL=http://YOUR_AI_HOST:8000
```

Important:
- Any `EXPO_PUBLIC_*` variable is embedded in the client bundle.
- Never place server secrets (service role keys, private keys) in the client `.env`.

## Install

```bash
npm install
```

## Run

```bash
npm run start
```

Android:

```bash
npm run android
```

iOS:

```bash
npm run ios
```

Web:

```bash
npm run web
```

## Lint

```bash
npm run lint
```

## Authentication and Routing Flow

- App bootstrap checks current Supabase session in `app/_layout.tsx`.
- If no session: redirects to `/auth`.
- If session exists: checks profile completeness in `profiles`.
- Incomplete profile: redirects to `/onboarding`.
- Complete profile: redirects to `/(tabs)/home`.

## Security Notes

- The client uses authenticated requests and HMAC-based request signing helpers in `src/lib/securityServices.ts`.
- Supabase session storage uses secure storage where available.
- Final access control must be enforced by Supabase RLS and server-side authorization logic.

## Related Services

This repository also includes an AI microservice under `AI Microservices/`.

Client calls that service for:
- face embedding registration
- liveness verification
- attendance decisioning
- proof URL signing fallback

## Troubleshooting

- If maps are blank: verify `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` and platform key restrictions.
- If login fails: verify Google client ID and Supabase auth provider config.
- If attendance proof is not visible: verify RLS policies and backend signed URL flow.

## Scripts Reference

- `npm run start` – Expo dev server
- `npm run android` – build/run Android app
- `npm run ios` – build/run iOS app
- `npm run web` – run web target
- `npm run lint` – run Expo lint rules

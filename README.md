# Daily Learn

A React Native app that sends 3 push notification quizzes per day, generated from content you upload. Upload a PDF, paste text, or drop in a document — the app chunks it, generates multiple-choice questions via Gemini AI, and delivers them as push notifications throughout the day.

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo SDK 54, Expo Router |
| API | Node.js 20 + Express 5, TypeScript |
| Database | PostgreSQL (Neon serverless) |
| AI | Google Gemini 2.0 Flash |
| Push | Expo Push Notification Service |
| Hosting | Fly.io (API), EAS Build (mobile) |

## Monorepo structure

```
├── api/          # Express API
│   ├── src/
│   │   ├── db/           # migrations + pg client
│   │   ├── middleware/   # auth, error handling
│   │   ├── routes/       # auth, content, questions, quiz, user
│   │   └── services/     # scheduler, push, AI, parser, chunker
│   └── fly.toml
├── mobile/       # Expo app
│   ├── app/
│   │   ├── (auth)/       # login, register
│   │   ├── (tabs)/       # home, upload, history, settings
│   │   └── quiz/[id].tsx
│   ├── services/         # axios client, notifications
│   └── store/            # Zustand auth store
└── .github/workflows/    # CI for api + mobile
```

## How it works

1. **Upload** — paste text or pick a PDF, DOCX, TXT, or Markdown file; the API chunks it and calls Gemini to generate multiple-choice questions with explanations
2. **Schedule** — a cron job runs at midnight and picks 3 random delivery windows (morning / midday / evening) for each user
3. **Deliver** — a per-minute job dispatches push notifications at the scheduled times via Expo's push service
4. **Quiz** — tap the notification to open the question; answer and see instant feedback with an explanation

## API setup

```bash
# from repo root
cp api/.env.example api/.env   # fill in DATABASE_URL, JWT secrets, GEMINI_API_KEY
npm install
npm run migrate --workspace=api
npm run dev --workspace=api
```

## Mobile setup

```bash
# from repo root
cp mobile/.env.example mobile/.env   # set EXPO_PUBLIC_API_URL
npm install
cd mobile && npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) on your device.

## Deploy

**API** — hosted on Fly.io. Migrations run automatically on deploy via `release_command`.

```bash
# from repo root
fly deploy -c api/fly.toml

# set required secrets once
fly secrets set GEMINI_API_KEY=... JWT_SECRET=... JWT_REFRESH_SECRET=... DATABASE_URL=... -a daily-learn-api
```

**Mobile** — built with EAS Build.

```bash
cd mobile
eas build --platform android --profile preview   # internal APK for testing
eas build --platform all --profile production    # store builds
```

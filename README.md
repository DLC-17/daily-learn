# Daily Learn

A full-stack learning app that generates quizzes and flashcards from content you upload. Upload a PDF, paste text, or drop in a document — the app chunks it, generates multiple-choice questions and flashcards via Groq AI, and delivers them as push notifications throughout the day. Available as a React Native mobile app and a Next.js web app.

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo SDK 54, Expo Router |
| Web | Next.js 15, React 19, Tailwind CSS, TanStack Query |
| API | Node.js 20 + Express 5, TypeScript |
| Database | PostgreSQL (Neon serverless) |
| AI | Groq (Llama 3.3 70B) |
| Push | Expo Push Notification Service |
| Hosting | Fly.io (API), EAS Build (mobile), Vercel (web) |

## Monorepo structure

```
├── api/          # Express API
│   ├── src/
│   │   ├── db/           # migrations + pg client
│   │   ├── middleware/   # auth, error handling
│   │   ├── routes/       # auth, content, questions, quiz, flashcards, topics, user
│   │   └── services/     # scheduler, push, AI, parser, chunker
│   └── Dockerfile
├── mobile/       # Expo app
│   ├── app/
│   │   ├── (auth)/       # login, register
│   │   ├── (tabs)/       # home, upload, history, settings
│   │   └── quiz/[id].tsx
│   ├── services/         # axios client, notifications
│   └── store/            # Zustand auth store
├── web/          # Next.js web app
│   ├── app/
│   │   ├── login/        # login page
│   │   ├── register/     # register page
│   │   ├── dashboard/    # upload, flashcards, history, settings
│   │   └── quiz/         # quiz flow
│   ├── components/       # shared UI components
│   └── lib/              # API client, utilities
└── .github/workflows/    # CI for api + mobile
```

## How it works

1. **Upload** — paste text or pick a PDF, DOCX, TXT, or Markdown file; the API chunks it and calls Groq to generate multiple-choice questions and flashcards with explanations
2. **Flashcards** — review term/definition cards grouped by topic before taking quizzes
3. **Schedule** — a cron job runs at midnight and picks 3 random delivery windows (morning / midday / evening) for each user
4. **Deliver** — a per-minute job dispatches push notifications at the scheduled times via Expo's push service
5. **Quiz** — tap the notification (mobile) or open the web app; answer and see instant feedback with an explanation; questions can be chained back-to-back
6. **History** — review past quiz results grouped by date and topic

## API setup

```bash
# from repo root
cp api/.env.example api/.env   # fill in DATABASE_URL, JWT secrets, GROQ_API_KEY
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

## Web setup

```bash
# from repo root
cp web/.env.example web/.env.local   # set NEXT_PUBLIC_API_URL
npm install
npm run dev --workspace=web
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

**API** — hosted on Fly.io. Migrations run automatically on deploy via `release_command`.

```bash
fly deploy -c api/fly.toml

# set required secrets once
fly secrets set GROQ_API_KEY=... JWT_SECRET=... JWT_REFRESH_SECRET=... DATABASE_URL=... -a daily-learn-api
```

**Mobile** — built with EAS Build.

```bash
cd mobile
eas build --platform android --profile preview   # internal APK for testing
eas build --platform all --profile production    # store builds
```

**Web** — deployed to Vercel. Connect the repo and set `NEXT_PUBLIC_API_URL` in the Vercel project environment variables.

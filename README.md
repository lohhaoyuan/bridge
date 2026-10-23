# Bridge Elo

Vue 3 + Vite frontend, Express API, Turso (hosted SQLite) database. Deploys to Vercel.

## Local

```bash
npm install
npm run dev        # web on :5173, API on :3001, data in data/bridge.db
```

Locally, the sign-in page also has a dev-only email sign-in, so you don't need Google set up to test. It's never available on Vercel.

## Accounts

- Players sign in with Google. **The first account to sign in becomes admin.**
- Admins can make other accounts admins under Admin → Accounts.
- On the Me page, players set their name and username and see their own stats. If they don't have a player yet, they create one there.
- An admin can also link an account to a player they created earlier (Admin → Accounts → Player).

## Deploy (Turso + Vercel)

Full walkthrough: [SETUP.md](SETUP.md). Short version:

1. Create a database at [turso.tech](https://turso.tech) and copy its **URL** (`libsql://…`) and an **auth token**.
2. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID**:
   - Type: Web application
   - Authorised redirect URI: `https://<your-site>/api/auth/google/callback`
   - Copy the client ID and client secret.
3. From this folder:

   ```bash
   vercel link
   vercel env add TURSO_DATABASE_URL production
   vercel env add TURSO_AUTH_TOKEN production
   vercel env add GOOGLE_CLIENT_ID production
   vercel env add GOOGLE_CLIENT_SECRET production
   vercel --prod
   ```
4. Sign in on the live site straight away, so that you're the first account and become admin.

Tables are created automatically on the first request.

| Env var              | Default                        |
| -------------------- | ------------------------------ |
| `TURSO_DATABASE_URL` | local file `data/bridge.db`    |
| `TURSO_AUTH_TOKEN`   | —                              |
| `GOOGLE_CLIENT_ID`   | —                              |
| `GOOGLE_CLIENT_SECRET` | —                            |
| `APP_URL`            | from request (sign-in redirect base) |
| `APP_TIMEZONE`       | `Asia/Singapore` (for streaks) |
| `API_PORT`           | `3001` (local only)            |

## Rating

Ratings are replayed from the full game history on every request, so deleting a game or changing a setting recalculates everything.

1. Pair rating = average of the two partners. Chance Team A wins: `E = 1 / (1 + 10^((Rb − Ra)/400))`.
2. The pair's total change is `2K × (result − E)`, where result is 1 for a win and 0 for a loss.
3. That total is split by hands won. Partner share `w = (hands + 1) / (pair's hands + 2)`.
   - Winners get `w` of the gain. The partner who won more hands gains more.
   - Losers take `1 − w` of the loss. The partner who won more hands loses less.
4. **Placement:** players are unranked until they've played 5 games.
5. **Inactivity decay:** after 14 days without a game, a rating above the starting rating drops 10 points per week. It never goes below the starting rating.

## Ranks

Rank thresholds are relative to the starting rating (1000):

| Rank       | Rating range |
| ---------- | ------------ |
| ♣ Clubs    | below 950    |
| ♦ Diamonds | 950–1049     |
| ♥ Hearts   | 1050–1149    |
| ♠ Spades   | 1150–1249    |
| No Trump   | 1250–1349    |
| Grand Slam | 1350 and up  |

## Streaks

A streak is the number of consecutive days with at least one game. Weekends never break a streak; any missed weekday does.

| Streak length | Flame colour     |
| ------------- | ---------------- |
| 1–4 days      | orange           |
| 5–9 days      | purple           |
| 10–19 days    | blue             |
| 20+ days      | animated rainbow |

All numbers above (except the rank offsets and flame thresholds) are editable under Admin → Rating settings.

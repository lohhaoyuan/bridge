# Zhirui Sucks At Cards

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

## Games and rating

Every game has its own rating. Ratings are replayed from the full history on every request, so deleting a game or changing a setting recalculates everything.

| Game | Players | Recorded | Rating |
| ---- | ------- | -------- | ------ |
| ♠ Bridge | 4 (2v2) | winning pair, hands won | pair rating = partners' average; pair moves `2K × (result − E)`, split by hands won (`(hands + 1) / (pair's hands + 2)`) |
| 🀄 Mahjong | 3–4 | one hand: winner, self-drawn or shooter, tai | self-drawn: winner beats everyone equally; off a discard the shooter takes most of the loss (weight 1.5 vs 0.25); +10% per tai above 1, up to ×2 |
| 2♠ Dai Di | 3–4 | winner, cards left | losers ranked by cards left; bigger card gap = bigger swing (up to ×2) |
| 🤥 Bluff | 3–10 | winner, cards left (optional) | winner vs everyone counts fully, the rest 30% |
| 💰 Texas Poker | 2–10 | finishing order | every place counts fully |
| 🔄 Uno | 2–10 | winner, points left | like Bluff, scaled by Uno points |

Free-for-all games compare every pair of players: each comparison moves both by `K × weight × margin × (result − E) / √(players − 1)`, with `E = 1 / (1 + 10^((Rb − Ra)/400))`. Bigger tables are worth more, but not linearly.

Shared rules, all editable under Admin → Settings:

- **K per game:** Bridge 40, Mahjong 20 (per hand), the rest 24.
- **Win streaks:** each straight win in that game adds +10% to the next gain (max +50%). The losers pay the same multiplier, so points stay balanced. Shown as an orange `×1.2` badge.
- **Placement:** unranked in a game until 5 games of it; those games move 1.5× faster.
- **Inactivity decay:** after 14 days without playing a game, a rating above the start drops 10 points a week, never below the start.

## GOAT score

The overall leaderboard ranks players by GOAT score, so the winner is whoever is strongest across the most games.

1. For each game, take how far the player's rating is from that game's class average, divided by the spread of ratings in that game. Every game then counts equally, whatever its K.
2. Multiply by experience: full credit after 10 games of that game, partial before.
3. Add up across every game played, ×100.

Being bad at a game counts against you, so the GOAT has to be good at lots of games, not just play lots.

## Ranks

Each game has its own ladder of six ranks, lowest first. The thresholds are the same for every game, relative to the starting rating (1000). Each game's leaderboard shows its ladder under the tabs.

| Rating | ♠ Bridge | 🀄 Mahjong | 2♠ Dai Di | 🤥 Bluff | 💰 Poker | 🔄 Uno |
| ------ | -------- | ---------- | --------- | -------- | -------- | ------ |
| below 920 | ♣ Clubs | 🎁 Tile Donor | 😵 Stuck With 13 | 📖 Open Book | 🐴 Donkey | 🤐 Forgot to Say UNO |
| 920–999 | ♦ Diamonds | 🐔 Chicken Hand | 3♦ Opener | 😰 Sweaty Palms | 🐟 Fish | ⏭ Skipped |
| 1000–1079 | ♥ Hearts | 🀄 Pung Pal | 👯 Pair Pusher | 😐 Poker Face | 📞 Calling Station | 🔄 Reverse |
| 1080–1159 | ♠ Spades | 🀫 Kong Artist | 📏 Straight Shooter | 🐍 Smooth Liar | ⚙️ Grinder | +2 Menace |
| 1160–1239 | No Trump | 🐉 Dragon Lord | 💣 Bomb Squad | 🎭 Con Artist | 🦈 Shark | +4 Villain |
| 1240+ | Grand Slam | 👑 Thirteen Wonders | 2♠ Big Two | 🤥 Pathological | 👑 Royal Flush | 🌈 Wild Card |

Names live in `src/ranks.js`.

## Editing games

Admin → Games → **Edit** on any game loads it back into the form, with a live preview of the corrected rating changes. Saving rewrites it in place, so it keeps its spot in the history, and every rating after it is recalculated. The game type can't be changed; delete it and add it again under the right game instead.

## Appearance

Anyone can open **Settings** to pick a theme (system, light, dark), accent colour, font and text size. Choices are saved per device.

## Streaks

A streak is the number of consecutive days with at least one game. Weekends never break a streak; any missed weekday does.

| Streak length | Flame colour     |
| ------------- | ---------------- |
| 1–4 days      | orange           |
| 5–9 days      | purple           |
| 10–19 days    | blue             |
| 20+ days      | animated rainbow |

All numbers above (except the rank offsets and flame thresholds) are editable under Admin → Rating settings.

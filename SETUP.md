# Setup

Takes about 15 minutes. You'll create three free accounts (Turso, Vercel, Google Cloud) and run a few commands in this folder (`bridge-elo`).

## 1. Database (Turso)

1. Go to [app.turso.tech](https://app.turso.tech) and sign up. Signing in with GitHub or Google is fine.
2. Click **Create Database**.
   - Name: `bridge-elo`
   - Location: the one closest to Singapore. The site's server runs in Singapore, so a nearby database keeps it fast.
3. Open the database and copy its **URL**. It starts with `libsql://`.
4. Click **Create Token**, keep the defaults (read & write, no expiry), and copy the token. It's only shown once.

Keep both values somewhere for step 2.

## 2. Hosting (Vercel)

In a terminal in the `bridge-elo` folder:

```bash
vercel login
```

Then create the project:

```bash
vercel link
```

Answer the prompts:

| Prompt                           | Answer              |
| -------------------------------- | ------------------- |
| Set up …?                        | **Y**               |
| Which scope?                     | your account        |
| Link to an existing project?     | **N**               |
| Project name                     | `bridge-elo`        |
| In which directory is your code? | `./` (press Enter)  |
| Modify settings?                 | **N**               |

Add the database details. Each command asks you to paste a value.

```bash
vercel env add TURSO_DATABASE_URL production
```
```bash
vercel env add TURSO_AUTH_TOKEN production
```

Deploy:

```bash
vercel --prod
```

When it finishes, it prints your site's address, e.g. `https://bridge-elo.vercel.app`. Copy it for step 3. The site works now, but nobody can sign in until step 4.

## 3. Google sign-in (Google Cloud)

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a project: use the project picker at the top, then **New project**. Name it `Bridge Elo`.
3. Open **APIs & Services → OAuth consent screen**. In newer consoles this is **Google Auth Platform**. Click **Get started**.
   - App name: `Bridge Elo`
   - User support email: your email
   - Audience: **External**
   - Contact email: your email
   - Agree, then **Create**.
4. Go to **Audience** and click **Publish app**, then confirm.
   - Without this, only accounts listed as "test users" can sign in.
   - This app only asks for name and email, so Google doesn't need to review it.
5. Go to **Clients** (or **Credentials → Create credentials → OAuth client ID**).
   - Application type: **Web application**
   - Name: `Bridge Elo`
   - **Authorised JavaScript origins**, add:
     - your Vercel address from step 2, e.g. `https://bridge-elo.vercel.app`
     - `http://localhost:5173` (for running it on your laptop)
   - Leave **Authorised redirect URIs** empty.
   - Click **Create**.
6. Copy the **Client ID**, which ends in `.apps.googleusercontent.com`. You don't need the client secret.

## 4. Connect Google and redeploy

```bash
vercel env add GOOGLE_CLIENT_ID production
```
```bash
vercel --prod
```

## 5. Become admin

**Do this straight away**: whoever signs in first becomes admin.

1. Open your site and click **Sign in** (bottom left), then sign in with Google.
2. On **Me**, enter your name (and your Discord username, if you want) and click **Create player**.
3. **Admin** now appears in the sidebar.

## 6. Get the class on it

- Share the link. Classmates sign in and create their own player on **Me**.
- To record a game: **Admin → Games**. Pick the 4 players, enter hands won, and mark the winning pair.
- To make someone else an admin: **Admin → Accounts → Make admin**. They need to have signed in once first.
- If you added players yourself before they signed up: **Admin → Accounts** → pick their player in the Player column to link it to their account.

## Updating the site later

After any code change, run this in the `bridge-elo` folder:

```bash
vercel --prod
```

Data lives in Turso, so redeploying never loses anything.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| Pages load but show "Server error" | Check the Turso URL and token: `vercel env ls`. Then look at the error with `vercel logs <your-site-url>`. |
| No Google button on Sign in | `GOOGLE_CLIENT_ID` is missing. Add it (step 4) and redeploy. |
| Google says the origin isn't allowed (`origin_mismatch`) | The exact site address (with `https://`, no trailing `/`) must be in Authorised JavaScript origins. Changes can take a few minutes to apply. |
| Only some people can sign in | The consent screen isn't published (step 3.4). |
| Someone else became admin first | Ask them to make you admin under Admin → Accounts. |

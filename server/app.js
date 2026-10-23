import express from 'express';
import crypto from 'node:crypto';
import { db, init, all, get, run, getSettings, saveSettings, loadPlayers, loadGames, insertGame, deleteGame } from './db.js';
import { computeRatings, dayNumber, SETTING_LIMITS } from './elo.js';
import { GOOGLE_ENABLED, DEV_LOGIN, googleAuthUrl, exchangeCode, signIn, accountForToken } from './auth.js';

const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Singapore';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// --- rating snapshot -------------------------------------------------------

const round1 = (x) => Math.round(x * 10) / 10;
const today = () => dayNumber(new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE }));

async function snapshot(extraGame) {
  const [settings, players, games] = await Promise.all([getSettings(), loadPlayers(), loadGames()]);
  if (extraGame) games.push(extraGame);
  return { settings, players, games, ...computeRatings(players, games, settings, today()) };
}

function playerSummary(p, s) {
  const last = p.history.at(-1);
  return {
    id: p.id,
    name: p.name,
    discord: p.discord,
    active: p.active,
    rating: Math.round(p.rating),
    peak: Math.round(p.peak),
    games: p.games,
    wins: p.wins,
    losses: p.losses,
    ranked: p.ranked,
    placement: p.ranked ? null : `${p.games}/${s.placementGames}`,
    tier: p.tier,
    decay: Math.round(p.decay),
    streak: p.streak.current,
    bestStreak: p.streak.best,
    lastPlayed: last?.playedAt ?? null,
    lastDelta: last ? round1(last.delta) : null,
  };
}

function gameView(g, snap) {
  const change = snap.changes.get(g.id);
  const side = (team) =>
    team.map(({ id, hands }) => {
      const c = change.players[id];
      return {
        id,
        name: snap.ratings.get(id).name,
        hands,
        before: Math.round(c.before),
        after: Math.round(c.after),
        delta: round1(c.delta),
      };
    });
  return {
    id: g.id,
    playedAt: g.playedAt,
    result: g.result,
    notes: g.notes,
    expectedA: round1(change.expectedA * 100),
    teamA: side(g.teamA),
    teamB: side(g.teamB),
  };
}

const newestFirst = (a, b) => (a.playedAt < b.playedAt ? 1 : a.playedAt > b.playedAt ? -1 : b.id - a.id);

// --- validation ------------------------------------------------------------

const parseHands = (v) => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 999) throw new HttpError(400, 'Hands must be a whole number ≥ 0');
  return n;
};

function parseGame(body, players) {
  const playedAt = String(body.playedAt ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedAt) || isNaN(Date.parse(playedAt))) throw new HttpError(400, 'Invalid date');

  const team = (t) => (Array.isArray(t) ? t : []).map((x) => ({ id: Number(x?.id), hands: parseHands(x?.hands) }));
  const teamA = team(body.teamA);
  const teamB = team(body.teamB);
  if (teamA.length !== 2 || teamB.length !== 2) throw new HttpError(400, 'Each team needs two players');
  const all = [...teamA, ...teamB].map((x) => x.id);
  if (new Set(all).size !== 4) throw new HttpError(400, 'Players must be different');
  const known = new Set(players.map((p) => p.id));
  if (!all.every((id) => known.has(id))) throw new HttpError(400, 'Unknown player');

  if (!['A', 'B'].includes(body.result)) throw new HttpError(400, 'Pick the winning team');

  return { playedAt, result: body.result, notes: String(body.notes ?? '').slice(0, 500), teamA, teamB };
}

function parseName(v) {
  const name = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 60) throw new HttpError(400, 'Name must be 1–60 characters');
  return name;
}

// Current Discord usernames, plus legacy name#1234 tags. Empty clears it.
function parseDiscord(v) {
  const tag = String(v ?? '').trim().replace(/^@/, '');
  if (tag && !/^[A-Za-z0-9_.]{2,32}(#\d{4})?$/.test(tag)) throw new HttpError(400, 'Invalid Discord username');
  return tag;
}

async function assertNameFree(name, exceptId = 0) {
  if (await get('SELECT 1 AS ok FROM players WHERE name = ? AND id != ?', [name, exceptId])) throw new HttpError(409, 'Name already taken');
}

// --- auth ------------------------------------------------------------------

const bearer = (req) => req.get('authorization')?.replace(/^Bearer /, '');

async function requireUser(req, res, next) {
  req.account = await accountForToken(bearer(req));
  if (!req.account) throw new HttpError(401, 'Not signed in');
  next();
}

async function requireAdmin(req, res, next) {
  await requireUser(req, res, () => {});
  if (!req.account.isAdmin) throw new HttpError(403, 'Admins only');
  next();
}

async function accountView(account) {
  const player = account.playerId ? await get('SELECT id, name, discord FROM players WHERE id = ?', [account.playerId]) : null;
  const { playerId, ...rest } = account;
  return { ...rest, isAdmin: !!account.isAdmin, player: player ?? null };
}

// --- routes ----------------------------------------------------------------

const app = express();
app.use(express.json());
const api = express.Router();
app.use('/api', api);

api.use(async (req, res, next) => {
  await init();
  next();
});

api.get('/meta', async (req, res) => {
  res.json({ settings: await getSettings(), limits: SETTING_LIMITS, googleEnabled: GOOGLE_ENABLED, devLogin: DEV_LOGIN });
});

api.get('/leaderboard', async (req, res) => {
  const snap = await snapshot();
  const rows = [...snap.ratings.values()]
    .filter((p) => p.active && p.games > 0)
    .sort((a, b) => b.ranked - a.ranked || b.rating - a.rating)
    .map((p) => playerSummary(p, snap.settings));
  res.json(rows);
});

api.get('/players', async (req, res) => {
  const snap = await snapshot();
  res.json([...snap.ratings.values()].map((p) => playerSummary(p, snap.settings)));
});

api.get('/players/:id', async (req, res) => {
  const snap = await snapshot();
  const p = snap.ratings.get(Number(req.params.id));
  if (!p) throw new HttpError(404, 'Player not found');
  const inGame = (g) => [...g.teamA, ...g.teamB].some((x) => x.id === p.id);
  const history = [{ rating: snap.settings.initialRating }, ...p.history];
  if (p.decay > 0) history.push({ rating: p.rating });
  res.json({
    player: playerSummary(p, snap.settings),
    history: history.map((h) => ({ playedAt: h.playedAt, rating: round1(h.rating) })),
    games: snap.games.filter(inGame).sort(newestFirst).map((g) => gameView(g, snap)),
  });
});

api.get('/games', async (req, res) => {
  const snap = await snapshot();
  res.json(snap.games.sort(newestFirst).map((g) => gameView(g, snap)));
});

// --- auth & profile ---

// Google redirects back to this exact URL, so it must be listed in the OAuth client's redirect URIs.
const siteOrigin = (req) =>
  process.env.APP_URL || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('x-forwarded-host') || req.get('host')}`;
const callbackUrl = (req) => `${siteOrigin(req)}/api/auth/google/callback`;
const safeNext = (n) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/me');
const STATE_COOKIE = 'g_state';
const stateCookieOptions = { httpOnly: true, sameSite: 'lax', path: '/api/auth/google' };

function readCookie(req, name) {
  for (const part of (req.get('cookie') || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

api.get('/auth/google/start', (req, res) => {
  if (!GOOGLE_ENABLED) throw new HttpError(404, 'Google sign-in is not configured');
  const state = crypto.randomBytes(16).toString('hex');
  const next = Buffer.from(safeNext(req.query.next)).toString('base64url');
  res.cookie(STATE_COOKIE, `${state}.${next}`, {
    ...stateCookieOptions,
    secure: siteOrigin(req).startsWith('https'),
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(googleAuthUrl(callbackUrl(req), state));
});

// The session token goes back in the URL fragment, which browsers never send to servers.
api.get('/auth/google/callback', async (req, res) => {
  const back = (params) => res.redirect(`/signin#${new URLSearchParams(params)}`);
  const [state, next] = readCookie(req, STATE_COOKIE).split('.');
  res.clearCookie(STATE_COOKIE, stateCookieOptions);
  if (req.query.error) return back({ error: req.query.error === 'access_denied' ? 'Sign-in cancelled' : 'Google sign-in failed' });
  if (!state || state !== req.query.state) return back({ error: 'Sign-in expired, please try again' });
  try {
    const token = await signIn(await exchangeCode(String(req.query.code), callbackUrl(req)));
    back({ token, next: safeNext(Buffer.from(next ?? '', 'base64url').toString()) });
  } catch (e) {
    console.error('Google sign-in failed:', e);
    back({ error: 'Google sign-in failed' });
  }
});

api.post('/auth/dev', async (req, res) => {
  if (!DEV_LOGIN) throw new HttpError(404, 'Not found');
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!/^\S+@\S+$/.test(email)) throw new HttpError(400, 'Invalid email');
  res.json({ token: await signIn({ sub: `dev:${email}`, email, name: email.split('@')[0], picture: '' }) });
});

api.get('/auth/me', requireUser, async (req, res) => res.json(await accountView(req.account)));

api.post('/auth/logout', async (req, res) => {
  const token = bearer(req);
  if (token) await run('DELETE FROM sessions WHERE token = ?', [token]);
  res.status(204).end();
});

// Create a player for yourself (only if you don't have one yet).
api.post('/me/player', requireUser, async (req, res) => {
  if (req.account.playerId) throw new HttpError(409, 'You already have a player');
  const name = parseName(req.body?.name);
  const discord = parseDiscord(req.body?.discord);
  await assertNameFree(name);
  const { lastInsertRowid } = await run('INSERT INTO players (name, discord) VALUES (?, ?)', [name, discord]);
  await run('UPDATE accounts SET player_id = ? WHERE id = ?', [Number(lastInsertRowid), req.account.id]);
  res.status(201).json(await accountView({ ...req.account, playerId: Number(lastInsertRowid) }));
});

api.patch('/me/player', requireUser, async (req, res) => {
  const id = req.account.playerId;
  if (!id) throw new HttpError(404, 'No player linked to your account');
  if (req.body?.name !== undefined) {
    const name = parseName(req.body.name);
    await assertNameFree(name, id);
    await run('UPDATE players SET name = ? WHERE id = ?', [name, id]);
  }
  if (req.body?.discord !== undefined) await run('UPDATE players SET discord = ? WHERE id = ?', [parseDiscord(req.body.discord), id]);
  res.json(await accountView(req.account));
});

// --- admin only below ---

api.post('/players', requireAdmin, async (req, res) => {
  const name = parseName(req.body?.name);
  await assertNameFree(name);
  const { lastInsertRowid } = await run('INSERT INTO players (name) VALUES (?)', [name]);
  res.status(201).json({ id: Number(lastInsertRowid), name });
});

api.patch('/players/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!(await get('SELECT 1 AS ok FROM players WHERE id = ?', [id]))) throw new HttpError(404, 'Player not found');
  if (req.body?.name !== undefined) {
    const name = parseName(req.body.name);
    await assertNameFree(name, id);
    await run('UPDATE players SET name = ? WHERE id = ?', [name, id]);
  }
  if (req.body?.discord !== undefined) await run('UPDATE players SET discord = ? WHERE id = ?', [parseDiscord(req.body.discord), id]);
  if (req.body?.active !== undefined) await run('UPDATE players SET active = ? WHERE id = ?', [req.body.active ? 1 : 0, id]);
  res.status(204).end();
});

api.delete('/players/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (await get('SELECT 1 AS ok FROM game_players WHERE player_id = ?', [id]))
    throw new HttpError(409, 'Player has games. Deactivate instead, or delete their games first.');
  await db.batch(
    [
      { sql: 'UPDATE accounts SET player_id = NULL WHERE player_id = ?', args: [id] },
      { sql: 'DELETE FROM players WHERE id = ?', args: [id] },
    ],
    'write',
  );
  res.status(204).end();
});

api.get('/accounts', requireAdmin, async (req, res) => {
  const rows = await all(
    `SELECT a.id, a.email, a.name, a.picture, a.is_admin AS isAdmin, a.player_id AS playerId, p.name AS playerName
     FROM accounts a LEFT JOIN players p ON p.id = a.player_id ORDER BY a.created_at`,
  );
  res.json(rows.map((r) => ({ ...r, isAdmin: !!r.isAdmin, me: r.id === req.account.id })));
});

api.patch('/accounts/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!(await get('SELECT 1 AS ok FROM accounts WHERE id = ?', [id]))) throw new HttpError(404, 'Account not found');
  if (req.body?.isAdmin !== undefined) {
    if (id === req.account.id && !req.body.isAdmin) throw new HttpError(400, "You can't remove your own admin access");
    await run('UPDATE accounts SET is_admin = ? WHERE id = ?', [req.body.isAdmin ? 1 : 0, id]);
  }
  if (req.body?.playerId !== undefined) {
    const playerId = req.body.playerId === null ? null : Number(req.body.playerId);
    if (playerId !== null) {
      if (!(await get('SELECT 1 AS ok FROM players WHERE id = ?', [playerId]))) throw new HttpError(404, 'Player not found');
      if (await get('SELECT 1 AS ok FROM accounts WHERE player_id = ? AND id != ?', [playerId, id]))
        throw new HttpError(409, 'That player is linked to another account');
    }
    await run('UPDATE accounts SET player_id = ? WHERE id = ?', [playerId, id]);
  }
  res.status(204).end();
});

api.post('/games/preview', requireAdmin, async (req, res) => {
  const game = { ...parseGame(req.body, await loadPlayers()), id: Number.MAX_SAFE_INTEGER };
  res.json(gameView(game, await snapshot(game)));
});

api.post('/games', requireAdmin, async (req, res) => {
  await insertGame(parseGame(req.body, await loadPlayers()));
  res.status(201).json({ ok: true });
});

api.delete('/games/:id', requireAdmin, async (req, res) => {
  await deleteGame(Number(req.params.id));
  res.status(204).end();
});

api.put('/settings', requireAdmin, async (req, res) => {
  const next = {};
  for (const [key, [min, max]] of Object.entries(SETTING_LIMITS)) {
    if (req.body?.[key] === undefined) continue;
    const v = Number(req.body[key]);
    if (!Number.isFinite(v) || v < min || v > max) throw new HttpError(400, `${key} must be between ${min} and ${max}`);
    next[key] = v;
  }
  await saveSettings(next);
  res.json(await getSettings());
});

api.use((req, res) => res.status(404).json({ error: 'Not found' }));

api.use((err, req, res, next) => {
  if (!(err instanceof HttpError)) console.error(err);
  res.status(err.status || 500).json({ error: err instanceof HttpError ? err.message : 'Server error' });
});

export default app;

import express from 'express';
import crypto from 'node:crypto';
import { db, init, all, get, run, getSettings, saveSettings, loadPlayers, loadMatches, insertGame, insertMatch, updateMatch, deleteMatch } from './db.js';
import { computeRatings, dayNumber, SETTING_LIMITS } from './elo.js';
import { GAMES, publicGames, parseMatchBody } from './games.js';
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

// `extraMatch` is added for previews; if it carries the uid of a recorded match
// it replaces that one (previewing an edit) and keeps its place in the history.
async function snapshot(extraMatch) {
  let [settings, players, matches] = await Promise.all([getSettings(), loadPlayers(), loadMatches()]);
  if (extraMatch) {
    const original = matches.find((m) => m.uid === extraMatch.uid);
    if (original) extraMatch.createdAt = original.createdAt;
    matches = [...matches.filter((m) => m !== original), extraMatch];
  }
  return { settings, players, matches, ...computeRatings(players, matches, settings, today()) };
}

// One player's record in one game.
function gameSummary(r, s) {
  const last = r.history.at(-1);
  return {
    rating: Math.round(r.rating),
    peak: Math.round(r.peak),
    games: r.games,
    wins: r.wins,
    losses: r.losses,
    ranked: r.ranked,
    placement: r.ranked ? null : `${r.games}/${s.placementGames}`,
    tier: r.tier,
    decay: Math.round(r.decay),
    lastPlayed: last?.playedAt ?? null,
    lastDelta: last ? round1(last.delta) : null,
  };
}

function personSummary(p, s) {
  return {
    id: p.id,
    name: p.name,
    discord: p.discord,
    active: p.active,
    games: p.games,
    wins: p.wins,
    ranked: p.ranked,
    placement: p.ranked ? null : `${p.games}/${s.placementGames}`,
    goat: Math.round(p.goat),
    streak: p.streak.current,
    bestStreak: p.streak.best,
    byGame: Object.fromEntries(Object.entries(p.byGame).map(([g, r]) => [g, gameSummary(r, s)])),
  };
}

function matchView(m, snap) {
  const change = snap.changes.get(m.uid);
  const person = (id, extra) => {
    const c = change.players[id];
    return {
      id,
      name: snap.people.get(id).name,
      ...extra,
      before: Math.round(c.before),
      after: Math.round(c.after),
      delta: round1(c.delta),
      hot: c.hot && c.delta > 0 ? round1(c.hot) : null,
    };
  };
  const base = { uid: m.uid, type: m.type, playedAt: m.playedAt, notes: m.notes, upset: change.upset };
  if (m.type === 'bridge') {
    return {
      ...base,
      result: m.result,
      expectedA: round1(change.expectedA * 100),
      teamA: m.teamA.map((x) => person(x.id, { hands: x.hands })),
      teamB: m.teamB.map((x) => person(x.id, { hands: x.hands })),
    };
  }
  return {
    ...base,
    details: m.details,
    players: [...m.players].sort((a, b) => a.place - b.place).map((x) => person(x.id, { place: x.place, value: x.value, role: x.role })),
  };
}

const involves = (m, id) => (m.type === 'bridge' ? [...m.teamA, ...m.teamB] : m.players).some((x) => x.id === id);
const newestFirst = (a, b) =>
  a.playedAt < b.playedAt ? 1 : a.playedAt > b.playedAt ? -1 : a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;

// --- validation ------------------------------------------------------------

const parseHands = (v) => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 999) throw new HttpError(400, 'Hands must be a whole number ≥ 0');
  return n;
};

function parseMatch(body, players) {
  const type = String(body.type ?? 'bridge');
  if (!GAMES[type]) throw new HttpError(400, 'Unknown game');
  const playedAt = String(body.playedAt ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedAt) || isNaN(Date.parse(playedAt))) throw new HttpError(400, 'Invalid date');
  const notes = String(body.notes ?? '').slice(0, 500);
  const known = new Set(players.map((p) => p.id));

  if (type !== 'bridge') {
    try {
      return { type, playedAt, notes, ...parseMatchBody(type, body, known) };
    } catch (e) {
      throw typeof e === 'string' ? new HttpError(400, e) : e;
    }
  }

  const team = (t) => (Array.isArray(t) ? t : []).map((x) => ({ id: Number(x?.id), hands: parseHands(x?.hands) }));
  const teamA = team(body.teamA);
  const teamB = team(body.teamB);
  if (teamA.length !== 2 || teamB.length !== 2) throw new HttpError(400, 'Each team needs two players');
  const all = [...teamA, ...teamB].map((x) => x.id);
  if (new Set(all).size !== 4) throw new HttpError(400, 'Players must be different');
  if (!all.every((id) => known.has(id))) throw new HttpError(400, 'Unknown player');
  if (!['A', 'B'].includes(body.result)) throw new HttpError(400, 'Pick the winning team');
  return { type, playedAt, notes, result: body.result, teamA, teamB };
}

function parseName(v) {
  const name = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 60) throw new HttpError(400, 'Name must be 1–60 characters');
  return name;
}

// Optional handle: Discord-style usernames, plus legacy name#1234 tags. Empty clears it.
function parseDiscord(v) {
  const tag = String(v ?? '').trim().replace(/^@/, '');
  if (tag && !/^[A-Za-z0-9_.]{2,32}(#\d{4})?$/.test(tag)) throw new HttpError(400, 'Invalid username');
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
  res.json({
    games: publicGames(),
    settings: await getSettings(),
    limits: SETTING_LIMITS,
    googleEnabled: GOOGLE_ENABLED,
    devLogin: DEV_LOGIN,
  });
});

// ?game=overall (GOAT) or a game key.
api.get('/leaderboard', async (req, res) => {
  const game = String(req.query.game || 'overall');
  if (game !== 'overall' && !GAMES[game]) throw new HttpError(404, 'Unknown game');
  const snap = await snapshot();
  const s = snap.settings;
  const people = [...snap.people.values()].filter((p) => p.active);
  if (game === 'overall') {
    const rows = people.filter((p) => p.games > 0).sort((a, b) => b.ranked - a.ranked || b.goat - a.goat);
    return res.json(rows.map((p) => personSummary(p, s)));
  }
  const rows = people
    .filter((p) => p.byGame[game])
    .sort((a, b) => b.byGame[game].ranked - a.byGame[game].ranked || b.byGame[game].rating - a.byGame[game].rating);
  res.json(rows.map((p) => ({ ...personSummary(p, s), ...gameSummary(p.byGame[game], s) })));
});

api.get('/players', async (req, res) => {
  const snap = await snapshot();
  res.json([...snap.people.values()].map((p) => personSummary(p, snap.settings)));
});

api.get('/players/:id', async (req, res) => {
  const snap = await snapshot();
  const p = snap.people.get(Number(req.params.id));
  if (!p) throw new HttpError(404, 'Player not found');
  const history = Object.fromEntries(
    Object.entries(p.byGame).map(([g, r]) => {
      const points = [{ rating: snap.settings.initialRating }, ...r.history];
      if (r.decay > 0) points.push({ rating: r.rating });
      return [g, points.map((h) => ({ playedAt: h.playedAt, rating: round1(h.rating) }))];
    }),
  );
  res.json({
    player: personSummary(p, snap.settings),
    history,
    matches: snap.matches.filter((m) => involves(m, p.id)).sort(newestFirst).map((m) => matchView(m, snap)),
  });
});

// ?game=<key> to filter.
api.get('/games', async (req, res) => {
  const snap = await snapshot();
  const game = req.query.game ? String(req.query.game) : null;
  const matches = game ? snap.matches.filter((m) => m.type === game) : snap.matches;
  res.json(matches.sort(newestFirst).map((m) => matchView(m, snap)));
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
  const played =
    (await get('SELECT 1 AS ok FROM game_players WHERE player_id = ?', [id])) ||
    (await get('SELECT 1 AS ok FROM match_players WHERE player_id = ?', [id]));
  if (played) throw new HttpError(409, 'Player has games. Deactivate instead, or delete their games first.');
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

// Removes the login only; the player and their games stay (unlinked).
api.delete('/accounts/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.account.id) throw new HttpError(400, "You can't delete your own account");
  await db.batch(
    [
      { sql: 'DELETE FROM sessions WHERE account_id = ?', args: [id] },
      { sql: 'DELETE FROM accounts WHERE id = ?', args: [id] },
    ],
    'write',
  );
  res.status(204).end();
});

const validUid = (uid) => /^[bm]\d+$/.test(uid);

async function existingType(uid) {
  if (!validUid(uid)) throw new HttpError(400, 'Invalid game id');
  const row = uid.startsWith('b')
    ? await get("SELECT 'bridge' AS type FROM games WHERE id = ?", [Number(uid.slice(1))])
    : await get('SELECT type FROM matches WHERE id = ?', [Number(uid.slice(1))]);
  if (!row) throw new HttpError(404, 'Game not found');
  return row.type;
}

// Body may include `editing: <uid>` to preview a change to a recorded game.
api.post('/games/preview', requireAdmin, async (req, res) => {
  const editing = req.body?.editing ? String(req.body.editing) : null;
  if (editing && (await existingType(editing)) !== req.body.type) throw new HttpError(400, "Can't change the game type");
  const match = { ...parseMatch(req.body, await loadPlayers()), uid: editing ?? 'preview', createdAt: '9999' };
  res.json(matchView(match, await snapshot(match)));
});

api.put('/games/:uid', requireAdmin, async (req, res) => {
  if ((await existingType(req.params.uid)) !== req.body?.type) throw new HttpError(400, "Can't change the game type");
  await updateMatch(req.params.uid, parseMatch(req.body, await loadPlayers()));
  res.status(204).end();
});

api.post('/games', requireAdmin, async (req, res) => {
  const match = parseMatch(req.body, await loadPlayers());
  await (match.type === 'bridge' ? insertGame(match) : insertMatch(match));
  res.status(201).json({ ok: true });
});

api.delete('/games/:uid', requireAdmin, async (req, res) => {
  if (!validUid(req.params.uid)) throw new HttpError(400, 'Invalid game id');
  await deleteMatch(req.params.uid);
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

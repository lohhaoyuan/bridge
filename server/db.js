import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SETTINGS } from './elo.js';

// Turso in production (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN), a local SQLite file otherwise.
function databaseUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.VERCEL) throw new Error('TURSO_DATABASE_URL is not set');
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const file = process.env.DB_PATH || path.join(root, 'data', 'bridge.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return `file:${file}`;
}

export const db = createClient({ url: databaseUrl(), authToken: process.env.TURSO_AUTH_TOKEN });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS players (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    discord    TEXT NOT NULL DEFAULT '',
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS games (
    id         INTEGER PRIMARY KEY,
    played_at  TEXT NOT NULL,
    result     TEXT NOT NULL CHECK (result IN ('A', 'B')),
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS game_players (
    game_id   INTEGER NOT NULL REFERENCES games(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    team      TEXT NOT NULL CHECK (team IN ('A', 'B')),
    seat      INTEGER NOT NULL,
    hands     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (game_id, player_id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value REAL NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id         INTEGER PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email      TEXT NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    picture    TEXT NOT NULL DEFAULT '',
    is_admin   INTEGER NOT NULL DEFAULT 0,
    player_id  INTEGER UNIQUE REFERENCES players(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS matches (
    id         INTEGER PRIMARY KEY,
    type       TEXT NOT NULL,
    played_at  TEXT NOT NULL,
    details    TEXT NOT NULL DEFAULT '{}',
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS match_players (
    match_id  INTEGER NOT NULL REFERENCES matches(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    seat      INTEGER NOT NULL,
    place     INTEGER NOT NULL,
    value     INTEGER,
    role      TEXT,
    PRIMARY KEY (match_id, player_id)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    expires_at INTEGER NOT NULL
  )`,
];

let ready;
export const init = () => (ready ??= db.batch(SCHEMA, 'write').catch((e) => ((ready = null), Promise.reject(e))));

const toObjects = (rs) => rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])));

export const all = async (sql, args = []) => toObjects(await db.execute({ sql, args }));
export const get = async (sql, args = []) => (await all(sql, args))[0];
export const run = (sql, args = []) => db.execute({ sql, args });

export async function getSettings() {
  const rows = await all('SELECT key, value FROM settings');
  const saved = rows.filter((r) => r.key in DEFAULT_SETTINGS).map((r) => [r.key, r.value]);
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(saved) };
}

export async function saveSettings(values) {
  const sql = 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
  await db.batch(Object.entries(values).map(([k, v]) => ({ sql, args: [k, v] })), 'write');
}

export async function loadPlayers() {
  const rows = await all('SELECT id, name, discord, active FROM players ORDER BY name');
  return rows.map((p) => ({ ...p, active: !!p.active }));
}

// Every recorded match across all games. Bridge lives in the original games
// tables (uid "b<id>"); every other game in matches (uid "m<id>").
export async function loadMatches() {
  const [gameRs, seatRs, matchRs, resultRs] = await db.batch(
    [
      'SELECT id, played_at AS playedAt, result, notes, created_at AS createdAt FROM games',
      'SELECT game_id, player_id, team, hands FROM game_players ORDER BY seat',
      'SELECT id, type, played_at AS playedAt, details, notes, created_at AS createdAt FROM matches',
      'SELECT match_id, player_id, place, value, role FROM match_players ORDER BY seat',
    ],
    'read',
  );
  const bridge = toObjects(gameRs).map((g) => ({ ...g, uid: `b${g.id}`, type: 'bridge', teamA: [], teamB: [] }));
  const bridgeById = new Map(bridge.map((g) => [g.id, g]));
  for (const r of toObjects(seatRs)) {
    bridgeById.get(r.game_id)?.[r.team === 'A' ? 'teamA' : 'teamB'].push({ id: r.player_id, hands: r.hands });
  }

  const others = toObjects(matchRs).map((m) => ({ ...m, uid: `m${m.id}`, details: JSON.parse(m.details), players: [] }));
  const otherById = new Map(others.map((m) => [m.id, m]));
  for (const r of toObjects(resultRs)) {
    otherById.get(r.match_id)?.players.push({ id: r.player_id, place: r.place, value: r.value, role: r.role });
  }
  return [...bridge, ...others];
}

// A batch runs as one transaction, so MAX(id) is the game inserted just before.
export async function insertGame(g) {
  const seat = (team, x, i) => ({
    sql: 'INSERT INTO game_players (game_id, player_id, team, seat, hands) VALUES ((SELECT MAX(id) FROM games), ?, ?, ?, ?)',
    args: [x.id, team, i, x.hands],
  });
  await db.batch(
    [
      { sql: 'INSERT INTO games (played_at, result, notes) VALUES (?, ?, ?)', args: [g.playedAt, g.result, g.notes] },
      ...g.teamA.map((x, i) => seat('A', x, i)),
      ...g.teamB.map((x, i) => seat('B', x, i)),
    ],
    'write',
  );
}

// Same MAX(id) trick as insertGame: the batch is one transaction.
export async function insertMatch(m) {
  await db.batch(
    [
      {
        sql: 'INSERT INTO matches (type, played_at, details, notes) VALUES (?, ?, ?, ?)',
        args: [m.type, m.playedAt, JSON.stringify(m.details), m.notes],
      },
      ...m.players.map((p, i) => ({
        sql: `INSERT INTO match_players (match_id, player_id, seat, place, value, role)
              VALUES ((SELECT MAX(id) FROM matches), ?, ?, ?, ?, ?)`,
        args: [p.id, i, p.place, p.value, p.role],
      })),
    ],
    'write',
  );
}

// Rewrites a recorded match in place (same id and created_at, so it keeps its
// spot in the history). The game type can't change.
export async function updateMatch(uid, m) {
  const id = Number(uid.slice(1));
  if (uid.startsWith('b')) {
    const seat = (team, x, i) => ({
      sql: 'INSERT INTO game_players (game_id, player_id, team, seat, hands) VALUES (?, ?, ?, ?, ?)',
      args: [id, x.id, team, i, x.hands],
    });
    return db.batch(
      [
        { sql: 'UPDATE games SET played_at = ?, result = ?, notes = ? WHERE id = ?', args: [m.playedAt, m.result, m.notes, id] },
        { sql: 'DELETE FROM game_players WHERE game_id = ?', args: [id] },
        ...m.teamA.map((x, i) => seat('A', x, i)),
        ...m.teamB.map((x, i) => seat('B', x, i)),
      ],
      'write',
    );
  }
  return db.batch(
    [
      {
        sql: 'UPDATE matches SET played_at = ?, details = ?, notes = ? WHERE id = ?',
        args: [m.playedAt, JSON.stringify(m.details), m.notes, id],
      },
      { sql: 'DELETE FROM match_players WHERE match_id = ?', args: [id] },
      ...m.players.map((p, i) => ({
        sql: 'INSERT INTO match_players (match_id, player_id, seat, place, value, role) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, p.id, i, p.place, p.value, p.role],
      })),
    ],
    'write',
  );
}

export async function deleteMatch(uid) {
  const id = Number(uid.slice(1));
  if (uid.startsWith('b')) return deleteGame(id);
  await db.batch(
    [
      { sql: 'DELETE FROM match_players WHERE match_id = ?', args: [id] },
      { sql: 'DELETE FROM matches WHERE id = ?', args: [id] },
    ],
    'write',
  );
}

async function deleteGame(id) {
  await db.batch(
    [
      { sql: 'DELETE FROM game_players WHERE game_id = ?', args: [id] },
      { sql: 'DELETE FROM games WHERE id = ?', args: [id] },
    ],
    'write',
  );
}

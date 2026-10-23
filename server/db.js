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

export async function loadGames() {
  const [gameRs, seatRs] = await db.batch(
    [
      'SELECT id, played_at AS playedAt, result, notes FROM games',
      'SELECT game_id, player_id, team, hands FROM game_players ORDER BY seat',
    ],
    'read',
  );
  const games = toObjects(gameRs).map((g) => ({ ...g, teamA: [], teamB: [] }));
  const byId = new Map(games.map((g) => [g.id, g]));
  for (const r of toObjects(seatRs)) {
    byId.get(r.game_id)?.[r.team === 'A' ? 'teamA' : 'teamB'].push({ id: r.player_id, hands: r.hands });
  }
  return games;
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

export async function deleteGame(id) {
  await db.batch(
    [
      { sql: 'DELETE FROM game_players WHERE game_id = ?', args: [id] },
      { sql: 'DELETE FROM games WHERE id = ?', args: [id] },
    ],
    'write',
  );
}

import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { db, get } from './db.js';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
// Email-only sign-in for local development. Never available on Vercel.
export const DEV_LOGIN = process.env.DEV_LOGIN === '1' && !process.env.VERCEL;

const SESSION_MS = 30 * 24 * 3600 * 1000;
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGoogle(credential) {
  if (!GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not set');
  const { payload } = await jwtVerify(String(credential), googleKeys, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: GOOGLE_CLIENT_ID,
  });
  if (!payload.email_verified) throw new Error('Google email is not verified');
  return { sub: payload.sub, email: payload.email, name: payload.name ?? '', picture: payload.picture ?? '' };
}

// Upserts the account and opens a session. The very first account becomes admin.
export async function signIn({ sub, email, name, picture }) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.batch(
    [
      {
        sql: `INSERT INTO accounts (google_sub, email, name, picture, is_admin)
              VALUES (?, ?, ?, ?, (SELECT COUNT(*) = 0 FROM accounts))
              ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture`,
        args: [sub, email, name, picture],
      },
      { sql: 'DELETE FROM sessions WHERE expires_at <= ?', args: [Date.now()] },
      {
        sql: 'INSERT INTO sessions (token, account_id, expires_at) SELECT ?, id, ? FROM accounts WHERE google_sub = ?',
        args: [token, Date.now() + SESSION_MS, sub],
      },
    ],
    'write',
  );
  return token;
}

export const accountForToken = (token) =>
  token
    ? get(
        `SELECT a.id, a.email, a.name, a.picture, a.is_admin AS isAdmin, a.player_id AS playerId
         FROM sessions s JOIN accounts a ON a.id = s.account_id
         WHERE s.token = ? AND s.expires_at > ?`,
        [token, Date.now()],
      )
    : undefined;

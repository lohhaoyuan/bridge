// Multi-game Elo.
//
// Every game keeps its own ratings. Bridge is rated as partnerships: a pair's
// strength is the mean of its two players, the pair moves by 2K(actual − expected),
// and that total is split between partners by hands won. Every other game is
// rated pairwise (see games.js): each comparison moves both players by
//   K · weight · margin · (actual − expected) / √(players − 1)
// so bigger tables are worth more, but not linearly.
//
// To keep it lively:
//  - a win streak multiplies gains: +`streakBonus` per consecutive win before
//    this one (up to `streakCap` wins). The losers pay the same multiplier, so
//    points stay balanced and hot players are dangerous;
//  - placement games move `placementBoost`× faster, so newcomers find their
//    level quickly.
//
// So that playing less never pays off:
//  - players are unranked in a game until they finish `placementGames` of it;
//  - after `decayGraceDays` without playing a game, a rating above the starting
//    rating drifts back down by `decayPerWeek` points per week.
//
// GOAT score: each game's rating is turned into "how far above the class
// average", scaled by that game's spread so every game counts equally, and
// weighted by experience (full credit after `goatFullGames` games). The sum
// across games is the GOAT score.

import { GAMES, GAME_KEYS } from './games.js';

export const DEFAULT_SETTINGS = {
  initialRating: 1000,
  kFactor: 40, // bridge (kept under its original key)
  ...Object.fromEntries(GAME_KEYS.filter((g) => g !== 'bridge').map((g) => [`k.${g}`, GAMES[g].k])),
  streakBonus: 0.1,
  streakCap: 5,
  placementGames: 5,
  placementBoost: 1.5,
  decayGraceDays: 14,
  decayPerWeek: 10,
  goatFullGames: 10,
};

export const SETTING_LIMITS = {
  initialRating: [0, 5000],
  kFactor: [1, 200],
  ...Object.fromEntries(GAME_KEYS.filter((g) => g !== 'bridge').map((g) => [`k.${g}`, [1, 200]])),
  streakBonus: [0, 1],
  streakCap: [0, 20],
  placementGames: [0, 50],
  placementBoost: [1, 5],
  decayGraceDays: [0, 365],
  decayPerWeek: [0, 200],
  goatFullGames: [1, 100],
};

export const kFor = (type, s) => (type === 'bridge' ? s.kFactor : s[`k.${type}`]);

// Rank tiers, as offsets from the starting rating (highest first).
export const TIERS = [
  ['grandslam', 240],
  ['notrump', 160],
  ['spades', 80],
  ['hearts', 0],
  ['diamonds', -80],
  ['clubs', -Infinity],
];

export const tierFor = (rating, s) => TIERS.find(([, offset]) => rating >= s.initialRating + offset)[0];

export const expected = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));

// Fraction of the pair's change credited to each partner (sums to 1).
// +1 smoothing keeps a 0-hand partner from getting nothing.
export function handShares([h1, h2]) {
  const w = (h1 + 1) / (h1 + h2 + 2);
  return [w, 1 - w];
}

// --- dates & streaks ---------------------------------------------------------

export const dayNumber = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000);
const isWeekend = (n) => [0, 6].includes((n + 4) % 7); // day 0 (1970-01-01) was a Thursday

// Two play days stay in one streak if no weekday between them was missed.
const connected = (from, to) => {
  for (let d = from + 1; d < to; d++) if (!isWeekend(d)) return false;
  return true;
};

export function streaks(playDays, today) {
  const days = [...new Set(playDays)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && connected(days[i - 1], d) ? run + 1 : 1;
    best = Math.max(best, run);
  });
  // Today still counts as open, so the streak is alive if the last play day connects to yesterday.
  const last = days.at(-1);
  const alive = last !== undefined && (last >= today || connected(last, today));
  return { current: alive ? run : 0, best };
}

// --- rating replay -------------------------------------------------------------

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const byTime = (a, b) =>
  a.playedAt < b.playedAt ? -1 : a.playedAt > b.playedAt ? 1 : a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;

function applyDecay(r, day, s) {
  if (r.lastDay === null || r.rating <= s.initialRating) return 0;
  const idle = day - r.lastDay - s.decayGraceDays;
  if (idle <= 0) return 0;
  const loss = Math.min(r.rating - s.initialRating, (idle / 7) * s.decayPerWeek);
  r.rating -= loss;
  return loss;
}

const newRecord = (s) => ({
  rating: s.initialRating,
  peak: s.initialRating,
  games: 0,
  wins: 0,
  losses: 0,
  winStreak: 0,
  history: [],
  lastDay: null,
});

const hotness = (r, s) => 1 + s.streakBonus * Math.min(r.winStreak, s.streakCap);

function record(r, { match, day, delta, won, hot }) {
  r.rating += delta;
  r.peak = Math.max(r.peak, r.rating);
  r.games += 1;
  r[won ? 'wins' : 'losses'] += 1;
  r.winStreak = won ? r.winStreak + 1 : 0;
  r.lastDay = day;
  r.history.push({ uid: match.uid, playedAt: match.playedAt, rating: r.rating, delta });
  return { after: r.rating, delta, hot: won && hot > 1 ? hot : null };
}

function rateBridge(match, rec, s, day) {
  const k = kFor('bridge', s);
  const sides = [
    { team: match.teamA, score: match.result === 'A' ? 1 : 0 },
    { team: match.teamB, score: match.result === 'B' ? 1 : 0 },
  ].map((side) => ({ ...side, recs: side.team.map((x) => rec(x.id)), shares: handShares(side.team.map((x) => x.hands)) }));

  const [ra, rb] = sides.map((side) => mean(side.recs.map((r) => r.rating)));
  sides[0].expected = expected(ra, rb);
  sides[1].expected = 1 - sides[0].expected;
  const winners = sides.find((side) => side.score === 1);
  // Share-weighted streak multiplier of the winning pair, charged to the losers.
  const winnersHot = winners.recs.reduce((sum, r, i) => sum + winners.shares[i] * hotness(r, s), 0);

  const updates = [];
  for (const side of sides) {
    const pairDelta = 2 * k * (side.score - side.expected);
    side.recs.forEach((r, i) => {
      // Winners: more hands → bigger share of the gain. Losers: more hands → smaller share of the loss.
      const won = side.score === 1;
      const share = won ? side.shares[i] : 1 - side.shares[i];
      const placement = r.games < s.placementGames ? s.placementBoost : 1;
      const hot = won ? hotness(r, s) : winnersHot;
      updates.push([side.team[i].id, r, { delta: pairDelta * share * placement * hot, won, hot }]);
    });
  }
  const players = {};
  for (const [id, r, u] of updates) players[id] = { before: r.rating, ...record(r, { match, day, ...u }) };
  return { expectedA: sides[0].expected, players };
}

function ratePairwise(match, rec, s, day) {
  const k = kFor(match.type, s);
  const ids = match.players.map((p) => p.id);
  const recs = Object.fromEntries(ids.map((id) => [id, rec(id)]));
  const winnerIds = new Set(match.players.filter((p) => p.place === 1).map((p) => p.id));
  const norm = Math.sqrt(ids.length - 1);
  const delta = Object.fromEntries(ids.map((id) => [id, 0]));

  for (const { a, b, s: score, w, m } of GAMES[match.type].pairs(match)) {
    const ra = recs[a];
    const rb = recs[b];
    // The streak of whoever won this comparison raises the stakes for both.
    const hot = score === 1 ? hotness(ra, s) : score === 0 ? hotness(rb, s) : 1;
    const d = (k * w * m * hot * (score - expected(ra.rating, rb.rating))) / norm;
    delta[a] += d;
    delta[b] -= d;
  }

  const updates = ids.map((id) => {
    const r = recs[id];
    const placement = r.games < s.placementGames ? s.placementBoost : 1;
    return [id, r, { delta: delta[id] * placement, won: winnerIds.has(id), hot: hotness(r, s) }];
  });
  const players = {};
  for (const [id, r, u] of updates) players[id] = { before: r.rating, ...record(r, { match, day, ...u }) };
  return { players };
}

// Replays every match in order, then decays everyone up to `today` (a day number).
export function computeRatings(players, matches, s, today) {
  const people = new Map(players.map((p) => [p.id, { ...p, byGame: {}, playDays: [] }]));
  const changes = new Map();

  for (const match of [...matches].sort(byTime)) {
    const day = dayNumber(match.playedAt);
    const rec = (id) => {
      const person = people.get(id);
      const r = (person.byGame[match.type] ??= newRecord(s));
      applyDecay(r, day, s);
      person.playDays.push(day);
      return r;
    };
    changes.set(match.uid, match.type === 'bridge' ? rateBridge(match, rec, s, day) : ratePairwise(match, rec, s, day));
  }

  for (const person of people.values()) {
    for (const r of Object.values(person.byGame)) {
      r.decay = applyDecay(r, today, s);
      r.ranked = r.games >= s.placementGames;
      r.tier = r.ranked ? tierFor(r.rating, s) : null;
    }
    person.streak = streaks(person.playDays, today);
    person.games = Object.values(person.byGame).reduce((n, r) => n + r.games, 0);
    person.wins = Object.values(person.byGame).reduce((n, r) => n + r.wins, 0);
  }

  // GOAT: per-game z-scores (spread floored at K so tiny classes don't blow up), weighted by experience.
  const spread = {};
  for (const g of GAME_KEYS) {
    const rs = [...people.values()].map((p) => p.byGame[g]).filter(Boolean).map((r) => r.rating);
    const mu = rs.length ? mean(rs) : s.initialRating;
    const sd = rs.length > 1 ? Math.sqrt(mean(rs.map((x) => (x - mu) ** 2))) : 0;
    spread[g] = { mu, sd: Math.max(sd, kFor(g, s)) };
  }
  for (const person of people.values()) {
    person.goatParts = {};
    for (const [g, r] of Object.entries(person.byGame)) {
      const weight = Math.min(1, r.games / s.goatFullGames);
      person.goatParts[g] = (100 * weight * (r.rating - spread[g].mu)) / spread[g].sd;
    }
    person.goat = Object.values(person.goatParts).reduce((a, b) => a + b, 0);
    person.ranked = person.games >= s.placementGames;
  }

  return { people, changes };
}

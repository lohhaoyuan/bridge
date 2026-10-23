// Simple partnership Elo.
//
// A pair's strength is the mean rating of its two players. The pair as a whole
// moves by K * (actual - expected), and that total is split between the partners
// by hands won: the partner who won more hands gains more on a win and loses
// less on a loss. With equal hands (or none recorded) the split is 50/50.
//
// To keep it lively:
//  - a win streak multiplies gains: +`streakBonus` per consecutive win before
//    this one (up to `streakCap` wins), so hot runs climb fast. The losers pay
//    the same multiplier, so points stay balanced and hot pairs are dangerous;
//  - placement games move `placementBoost`× faster, so newcomers find their
//    level quickly.
//
// So that playing less never pays off:
//  - players are unranked until they finish `placementGames` games;
//  - after `decayGraceDays` without a game, ratings above the starting rating
//    drift back down by `decayPerWeek` points per week (never below the start).

export const DEFAULT_SETTINGS = {
  initialRating: 1000,
  kFactor: 40,
  streakBonus: 0.1,
  streakCap: 5,
  placementGames: 5,
  placementBoost: 1.5,
  decayGraceDays: 14,
  decayPerWeek: 10,
};

export const SETTING_LIMITS = {
  initialRating: [0, 5000],
  kFactor: [1, 200],
  streakBonus: [0, 1],
  streakCap: [0, 20],
  placementGames: [0, 50],
  placementBoost: [1, 5],
  decayGraceDays: [0, 365],
  decayPerWeek: [0, 200],
};

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
const byDate = (a, b) => (a.playedAt < b.playedAt ? -1 : a.playedAt > b.playedAt ? 1 : a.id - b.id);

function applyDecay(p, day, s) {
  if (p.lastDay === null || p.rating <= s.initialRating) return 0;
  const idle = day - p.lastDay - s.decayGraceDays;
  if (idle <= 0) return 0;
  const loss = Math.min(p.rating - s.initialRating, (idle / 7) * s.decayPerWeek);
  p.rating -= loss;
  return loss;
}

// Replays every game in order, then decays everyone up to `today` (a day number).
export function computeRatings(players, games, s, today) {
  const state = new Map(
    players.map((p) => [
      p.id,
      {
        ...p,
        rating: s.initialRating,
        peak: s.initialRating,
        games: 0,
        wins: 0,
        losses: 0,
        winStreak: 0,
        history: [],
        lastDay: null,
        playDays: [],
      },
    ]),
  );
  const changes = new Map();

  for (const g of [...games].sort(byDate)) {
    const day = dayNumber(g.playedAt);
    const sides = [
      { team: g.teamA.map((x) => ({ p: state.get(x.id), hands: x.hands })), score: g.result === 'A' ? 1 : 0 },
      { team: g.teamB.map((x) => ({ p: state.get(x.id), hands: x.hands })), score: g.result === 'B' ? 1 : 0 },
    ];
    for (const side of sides) for (const { p } of side.team) applyDecay(p, day, s);

    const [ra, rb] = sides.map((side) => mean(side.team.map((x) => x.p.rating)));
    const ea = expected(ra, rb);
    sides[0].expected = ea;
    sides[1].expected = 1 - ea;

    for (const side of sides) side.shares = handShares(side.team.map((x) => x.hands));
    const hotness = (p) => 1 + s.streakBonus * Math.min(p.winStreak, s.streakCap);
    const winners = sides.find((side) => side.score === 1);
    // Share-weighted streak multiplier of the winning pair, charged to the losers.
    const winnersHot = winners.team.reduce((sum, { p }, i) => sum + winners.shares[i] * hotness(p), 0);

    const entry = { expectedA: ea, players: {} };
    for (const side of sides) {
      const pairDelta = 2 * s.kFactor * (side.score - side.expected);
      side.team.forEach(({ p }, i) => {
        // Winners: more hands → bigger share of the gain. Losers: more hands → smaller share of the loss.
        const won = side.score === 1;
        const share = won ? side.shares[i] : 1 - side.shares[i];
        const placement = p.games < s.placementGames ? s.placementBoost : 1;
        const hot = won ? hotness(p) : winnersHot;
        const delta = pairDelta * share * placement * hot;
        const before = p.rating;
        p.rating += delta;
        p.peak = Math.max(p.peak, p.rating);
        p.games += 1;
        p[won ? 'wins' : 'losses'] += 1;
        p.winStreak = won ? p.winStreak + 1 : 0;
        p.lastDay = day;
        p.playDays.push(day);
        p.history.push({ gameId: g.id, playedAt: g.playedAt, rating: p.rating, delta });
        entry.players[p.id] = { before, after: p.rating, delta, hot: hot > 1 ? hot : null };
      });
    }
    changes.set(g.id, entry);
  }

  for (const p of state.values()) {
    p.decay = applyDecay(p, today, s);
    p.ranked = p.games >= s.placementGames;
    p.tier = p.ranked ? tierFor(p.rating, s) : null;
    p.streak = streaks(p.playDays, today);
  }
  return { ratings: state, changes };
}

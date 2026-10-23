// Game definitions.
//
// Bridge is rated as partnerships (see elo.js). Every other game is rated
// pairwise: each player is compared with each other player in the match, and
// each comparison has a weight (how much it matters in this game) and a margin
// (how decisive it was). `pairs()` turns one recorded match into those
// comparisons: { a, b, s, w, m } where s is a's score against b (1, ½ or 0).

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Winner (place 1) vs everyone at full weight; the rest compared among themselves
// at `restWeight`. Margin grows with the gap in `value` (cards/points left).
function ordered({ restWeight, valueScale }) {
  return (match) => {
    const out = [];
    const ps = match.players;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const [a, b] = [ps[i], ps[j]];
        const s = a.place < b.place ? 1 : a.place > b.place ? 0 : 0.5;
        const w = a.place === 1 || b.place === 1 ? 1 : restWeight;
        const gap = valueScale && a.value != null && b.value != null ? Math.abs(a.value - b.value) : 0;
        const m = valueScale ? 1 + clamp(gap / valueScale, 0, 1) : 1;
        if (w > 0) out.push({ a: a.id, b: b.id, s, w, m });
      }
    }
    return out;
  };
}

// One mahjong hand. Self-drawn: everyone pays the winner equally. Off a discard:
// the shooter pays most, the other two a little. More tai, bigger swing.
function mahjongPairs(match) {
  const { winType, tai } = match.details;
  const winner = match.players.find((p) => p.role === 'winner');
  const m = 1 + clamp((tai - 1) * 0.1, 0, 1);
  return match.players
    .filter((p) => p !== winner)
    .map((p) => ({
      a: winner.id,
      b: p.id,
      s: 1,
      w: winType === 'self' ? 1 : p.role === 'shooter' ? 1.5 : 0.25,
      m,
    }));
}

export const GAMES = {
  bridge: { name: 'Bridge', icon: '♠', kind: 'bridge', min: 4, max: 4, k: 40 },
  mahjong: { name: 'Mahjong', icon: '🀄', kind: 'mahjong', min: 3, max: 4, k: 20, pairs: mahjongPairs },
  daidi: {
    name: 'Dai Di',
    icon: '2♠',
    kind: 'winner',
    min: 3,
    max: 4,
    k: 24,
    value: 'Cards left',
    valueMax: 13,
    pairs: ordered({ restWeight: 0.6, valueScale: 13 }),
  },
  bluff: {
    name: 'Bluff',
    icon: '🤥',
    kind: 'winner',
    min: 3,
    max: 10,
    k: 24,
    value: 'Cards left',
    valueMax: 52,
    pairs: ordered({ restWeight: 0.3, valueScale: 20 }),
  },
  poker: {
    name: 'Texas Poker',
    icon: '💰',
    kind: 'order',
    min: 2,
    max: 10,
    k: 24,
    pairs: ordered({ restWeight: 1, valueScale: 0 }),
  },
  uno: {
    name: 'Uno',
    icon: '🔄',
    kind: 'winner',
    min: 2,
    max: 10,
    k: 24,
    value: 'Points left',
    valueMax: 1000,
    pairs: ordered({ restWeight: 0.3, valueScale: 200 }),
  },
};

export const GAME_KEYS = Object.keys(GAMES);

// What the client needs to draw tabs and forms.
export const publicGames = () =>
  GAME_KEYS.map((key) => {
    const { name, icon, kind, min, max, value, valueMax } = GAMES[key];
    return { key, name, icon, kind, min, max, value: value ?? null, valueMax: valueMax ?? null };
  });

const int = (v, lo, hi) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};

// Validates a non-bridge match. Returns { players: [{ id, place, value, role }], details }
// or throws a message string.
export function parseMatchBody(type, body, knownIds) {
  const game = GAMES[type];
  const rows = Array.isArray(body.players) ? body.players : [];
  if (rows.length < game.min || rows.length > game.max) throw `${game.name} needs ${game.min}–${game.max} players`;
  const ids = rows.map((r) => Number(r?.id));
  if (new Set(ids).size !== ids.length) throw 'Players must be different';
  if (!ids.every((id) => knownIds.has(id))) throw 'Unknown player';

  if (game.kind === 'mahjong') {
    const winner = Number(body.winner);
    if (!ids.includes(winner)) throw 'Pick the winner';
    const winType = body.winType === 'self' ? 'self' : 'discard';
    const shooter = Number(body.shooter);
    if (winType === 'discard' && (!ids.includes(shooter) || shooter === winner)) throw 'Pick who discarded the winning tile';
    const tai = int(body.tai, 1, 20);
    if (tai === null) throw 'Tai must be a whole number from 1 to 20';
    return {
      players: ids.map((id) => ({
        id,
        place: id === winner ? 1 : 2,
        value: null,
        role: id === winner ? 'winner' : winType === 'discard' && id === shooter ? 'shooter' : null,
      })),
      details: { winType, tai },
    };
  }

  // Row order is the finishing order. For "winner" games the first row is the
  // winner and the rest are ranked by value (fewest cards/points left is better).
  const values = rows.map((r, i) => {
    if (!game.value || i === 0 || r?.value === '' || r?.value == null) return null;
    const v = int(r.value, 0, game.valueMax);
    if (v === null) throw `${game.value} must be a whole number from 0 to ${game.valueMax}`;
    return v;
  });
  const players = ids.map((id, i) => ({ id, place: i + 1, value: game.value ? (i === 0 ? 0 : values[i]) : null, role: null }));
  if (game.kind === 'winner' && values.slice(1).every((v) => v !== null)) {
    const rest = players.slice(1).sort((a, b) => a.value - b.value);
    rest.forEach((p, i) => (p.place = i > 0 && p.value === rest[i - 1].value ? rest[i - 1].place : i + 2));
    return { players: [players[0], ...rest], details: {} };
  }
  return { players, details: {} };
}

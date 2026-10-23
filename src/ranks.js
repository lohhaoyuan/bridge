// Rank names per game, lowest to highest. The server sends a tier key (shared
// across games, see TIERS in server/elo.js); each game names the six steps its
// own way. Colours climb the same way for every game.
export const TIER_KEYS = ['clubs', 'diamonds', 'hearts', 'spades', 'notrump', 'grandslam'];
export const TIER_COLORS = ['gray', 'orange', 'red', 'blue', 'purple', 'gold'];
// Lower bound of each tier, relative to the starting rating (matches server/elo.js).
export const TIER_OFFSETS = [null, -80, 0, 80, 160, 240];

// Real hands/cards from each game, in increasing strength.
export const RANK_NAMES = {
  bridge: ['♣ Clubs', '♦ Diamonds', '♥ Hearts', '♠ Spades', 'No Trump', 'Grand Slam'],
  mahjong: ['Chicken Hand', 'Ping Hu', 'Half Flush', 'All Pungs', 'Full Flush', 'Thirteen Wonders'],
  daidi: ['Pair', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'],
  bluff: ['Two', 'Ten', 'Jack', 'Queen', 'King', 'Ace'],
  poker: ['High Card', 'One Pair', 'Two Pair', 'Straight', 'Full House', 'Royal Flush'],
  uno: ['Number Card', 'Skip', 'Reverse', 'Draw Two', 'Wild', 'Wild Draw Four'],
};

export function rankLabel(game, tier) {
  const i = TIER_KEYS.indexOf(tier);
  return i < 0 ? null : { name: (RANK_NAMES[game] ?? RANK_NAMES.bridge)[i], color: TIER_COLORS[i], level: i };
}

// "below 920", "920–999", …, "1240+" for a given starting rating.
export function tierRange(i, initialRating) {
  const lo = TIER_OFFSETS[i];
  const hi = TIER_OFFSETS[i + 1];
  if (lo === null) return `below ${initialRating + hi}`;
  if (hi === undefined) return `${initialRating + lo}+`;
  return `${initialRating + lo}–${initialRating + hi - 1}`;
}

<script setup>
import { computed } from 'vue';
import { formatDate, signed } from '../api.js';

const props = defineProps({
  match: { type: Object, required: true },
  games: { type: Object, required: true }, // key → game definition
  highlight: { type: Number, default: null },
  deletable: { type: Boolean, default: false },
  editing: { type: Boolean, default: false },
});
defineEmits(['delete', 'edit']);

const game = computed(() => props.games[props.match.type] ?? { name: props.match.type, icon: '' });
const cls = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'faint');

// Bridge: Team A and Team B in their recorded order, with pre-game odds.
const bridge = computed(() => {
  const m = props.match;
  if (m.type !== 'bridge') return null;
  const oddsA = Math.round(m.expectedA);
  const teams = [
    { key: 'A', players: m.teamA, won: m.result === 'A', odds: oddsA },
    { key: 'B', players: m.teamB, won: m.result === 'B', odds: 100 - oddsA },
  ];
  return { teams };
});

const mahjong = computed(() => {
  const m = props.match;
  if (m.type !== 'mahjong') return null;
  const winner = m.players.find((p) => p.role === 'winner');
  const shooter = m.players.find((p) => p.role === 'shooter');
  return {
    winner,
    others: m.players.filter((p) => p !== winner),
    how: m.details.winType === 'self' ? 'Self-drawn' : `Off ${shooter?.name ?? '?'}'s discard`,
    tai: m.details.tai,
  };
});

const unit = computed(() => (game.value.value ?? '').replace(/ left$/, '').toLowerCase());
</script>

<template>
  <article class="match" :class="{ editing }">
    <header>
      <span class="tag game"><span>{{ game.icon }}</span>{{ game.name }}</span>
      <span class="muted date">{{ formatDate(match.playedAt) }}</span>
      <span v-if="match.upset" class="tag upset" :title="`Underdog win: points ×${match.upset}`">Upset ×{{ match.upset }}</span>
      <span v-if="match.notes" class="muted notes">{{ match.notes }}</span>
      <span v-if="deletable" class="actions">
        <span v-if="editing" class="tag editing-tag">Editing</span>
        <button v-else class="btn ghost" @click="$emit('edit', match)">Edit</button>
        <button class="btn ghost danger" @click="$emit('delete', match)">Delete</button>
      </span>
    </header>

    <!-- Bridge: Team A vs Team B, winner highlighted -->
    <div v-if="bridge" class="versus">
      <template v-for="(t, i) in bridge.teams" :key="t.key">
        <span v-if="i" class="vs">vs</span>
        <div class="team" :class="t.won ? 'won' : 'lost'">
          <div class="team-head">
            <span class="team-name">Team {{ t.key }}</span>
            <span v-if="t.won" class="badge">🏆 Won</span>
            <span class="odds num" :title="`Pre-game chance of winning`">{{ t.odds }}%</span>
          </div>
          <div v-for="p in t.players" :key="p.id" class="row">
            <RouterLink :to="`/players/${p.id}`" class="name" :class="{ me: p.id === highlight }">{{ p.name }}</RouterLink>
            <span class="faint small num" title="Hands won">{{ p.hands }}h</span>
            <span class="spacer"></span>
            <span v-if="p.hot" class="hot num" :title="`Win streak bonus ×${p.hot}`">×{{ p.hot }}</span>
            <span class="num small delta" :class="cls(p.delta)">{{ signed(Math.round(p.delta)) }}</span>
          </div>
        </div>
      </template>
    </div>

    <!-- Mahjong: one winning hand -->
    <div v-else-if="mahjong" class="sides">
      <div class="side won">
        <div class="label">{{ mahjong.how }} · {{ mahjong.tai }} tai</div>
        <div class="row">
          <RouterLink :to="`/players/${mahjong.winner.id}`" class="name" :class="{ me: mahjong.winner.id === highlight }">{{ mahjong.winner.name }}</RouterLink>
          <span class="num small" :class="cls(mahjong.winner.delta)">{{ signed(Math.round(mahjong.winner.delta)) }}</span>
          <span v-if="mahjong.winner.hot" class="hot num">×{{ mahjong.winner.hot }}</span>
        </div>
      </div>
      <div class="side lost">
        <div class="label">Paid</div>
        <div v-for="p in mahjong.others" :key="p.id" class="row">
          <RouterLink :to="`/players/${p.id}`" class="name" :class="{ me: p.id === highlight }">{{ p.name }}</RouterLink>
          <span v-if="p.role === 'shooter'" class="tag shooter">shooter</span>
          <span class="num small" :class="cls(p.delta)">{{ signed(Math.round(p.delta)) }}</span>
        </div>
      </div>
    </div>

    <!-- Everything else: finishing order -->
    <ol v-else class="order">
      <li v-for="p in match.players" :key="p.id" :class="{ first: p.place === 1 }">
        <span class="place num">{{ p.place }}</span>
        <RouterLink :to="`/players/${p.id}`" class="name" :class="{ me: p.id === highlight }">{{ p.name }}</RouterLink>
        <span v-if="unit && p.place > 1 && p.value != null" class="faint small num">{{ p.value }} {{ unit }}</span>
        <span class="spacer"></span>
        <span v-if="p.hot" class="hot num">×{{ p.hot }}</span>
        <span class="num small delta" :class="cls(p.delta)">{{ signed(Math.round(p.delta)) }}</span>
      </li>
    </ol>
  </article>
</template>

<style scoped>
.match {
  padding: 12px 0 14px;
  border-bottom: 1px solid var(--border);
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  min-height: 28px;
}
.game {
  display: inline-flex;
  gap: 5px;
  font-weight: 500;
}
.date {
  font-size: 13px;
}
.notes {
  font-size: 13px;
  font-style: italic;
}
.actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
}
.match.editing {
  background: var(--hl-soft);
  margin: 0 -10px;
  padding-left: 10px;
  padding-right: 10px;
  border-radius: 8px;
}
.editing-tag {
  background: var(--hl);
  color: var(--hl-text);
  margin-right: 6px;
}
.versus {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: stretch;
  gap: 8px;
  max-width: 640px;
}
.team {
  padding: 8px 10px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  min-width: 0;
}
.team.won {
  background: var(--hl);
  border-color: var(--hl-strong);
  box-shadow: inset 3px 0 0 var(--accent);
}
.team.lost {
  background: var(--bg-sidebar);
}
.team.lost .name {
  color: var(--text-2);
}
.team-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.team-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.won .team-name {
  color: var(--hl-text);
}
.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 0 6px;
  line-height: 18px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
}
.odds {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-3);
}
.vs {
  align-self: center;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-3);
}
@media (max-width: 480px) {
  .versus {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
  .vs {
    justify-self: center;
    line-height: 1;
  }
}
.upset {
  background: var(--orange-bg);
  color: var(--orange);
  font-weight: 600;
}
.sides {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  max-width: 640px;
}
.side {
  padding: 8px 10px;
  border-radius: 8px;
  min-width: 0;
}
.won {
  background: var(--hl);
}
.lost {
  background: var(--bg-sidebar);
}
.label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  margin-bottom: 2px;
}
.won .label {
  color: var(--hl-text);
}
.row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.won .name,
.first .name {
  font-weight: 600;
}
.name:hover {
  text-decoration: underline;
  text-decoration-color: var(--text-3);
}
.me {
  background: var(--hl-strong);
  border-radius: 3px;
  padding: 0 3px;
}
.small {
  font-size: 12px;
  white-space: nowrap;
}
.hot {
  font-size: 11px;
  font-weight: 600;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--orange-bg);
  color: var(--orange);
}
.shooter {
  font-size: 11px;
  background: var(--red-bg);
  color: var(--red);
}
.order {
  list-style: none;
  margin: 0;
  padding: 0;
  max-width: 640px;
}
.order li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 8px;
}
.order li.first {
  background: var(--hl);
}
.place {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  background: var(--gray-bg);
  color: var(--text-2);
  flex-shrink: 0;
}
.first .place {
  background: var(--yellow-bg);
  color: var(--yellow);
}
.spacer {
  flex: 1;
}
.delta {
  min-width: 32px;
  text-align: right;
}
</style>

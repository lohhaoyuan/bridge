<script setup>
import { formatDate, signed } from '../api.js';

defineProps({
  games: { type: Array, required: true },
  highlight: { type: Number, default: null },
  deletable: { type: Boolean, default: false },
});
defineEmits(['delete']);

const cls = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'faint');
const sides = (g) =>
  g.result === 'A'
    ? [['Winners', g.teamA, true], ['Losers', g.teamB, false]]
    : [['Winners', g.teamB, true], ['Losers', g.teamA, false]];
</script>

<template>
  <div class="table-wrap">
    <table class="table games" :class="{ deletable }">
      <thead>
        <tr>
          <th>Date</th>
          <th>Winners</th>
          <th>Losers</th>
          <th>Notes</th>
          <th v-if="deletable"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="g in games" :key="g.id">
          <td class="date muted">{{ formatDate(g.playedAt) }}</td>
          <td v-for="[label, team, won] in sides(g)" :key="label" class="side" :class="won ? 'won' : 'lost'" :data-label="label">
            <div v-for="p in team" :key="p.id" class="player">
              <RouterLink :to="`/players/${p.id}`" :class="{ me: p.id === highlight }">{{ p.name }}</RouterLink>
              <span class="faint hands num" title="Hands won">{{ p.hands }}h</span>
              <span class="num delta" :class="cls(p.delta)">{{ signed(Math.round(p.delta)) }}</span>
              <span v-if="p.hot" class="hot num" :title="`Win streak bonus ×${p.hot}`">×{{ p.hot }}</span>
            </div>
          </td>
          <td class="muted notes">{{ g.notes }}</td>
          <td v-if="deletable" class="del right">
            <button class="btn ghost danger" @click="$emit('delete', g)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.date {
  white-space: nowrap;
}
.player {
  display: flex;
  gap: 8px;
  align-items: baseline;
  white-space: nowrap;
}
.player a:hover {
  text-decoration: underline;
  text-decoration-color: var(--text-3);
}
.won {
  background: var(--hl-soft);
}
.won .player a {
  font-weight: 600;
}
.me {
  background: var(--hl);
  border-radius: 3px;
  padding: 0 3px;
  margin: 0 -3px;
}
.hands,
.delta {
  font-size: 12px;
}
.hot {
  font-size: 11px;
  font-weight: 600;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--orange-bg);
  color: var(--orange);
}
.notes {
  font-size: 13px;
  max-width: 240px;
}

/* Phones: each game becomes a card with winners and losers side by side. */
@media (max-width: 640px) {
  .table-wrap {
    margin: 0;
    overflow: visible;
  }
  .games thead {
    display: none;
  }
  .games,
  .games tbody {
    display: block;
  }
  .games tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: 'date date' 'win lose' 'notes notes';
    gap: 6px 8px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .games.deletable tr {
    grid-template-areas: 'date del' 'win lose' 'notes notes';
  }
  .games tbody tr:hover {
    background: none;
  }
  .games td {
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .date {
    grid-area: date;
    align-self: center;
    font-size: 12px;
  }
  .del {
    grid-area: del;
    justify-self: end;
  }
  .side {
    padding: 8px 10px;
    border-radius: 8px;
  }
  .won {
    grid-area: win;
    background: var(--hl);
  }
  .lost {
    grid-area: lose;
    background: var(--bg-sidebar);
  }
  .side::before {
    content: attr(data-label);
    display: block;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-3);
    margin-bottom: 2px;
  }
  .won::before {
    color: var(--hl-text);
  }
  .player {
    gap: 6px;
  }
  .player a {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .notes {
    grid-area: notes;
    max-width: none;
  }
  .notes:empty {
    display: none;
  }
}
</style>

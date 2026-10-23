<script setup>
import { formatDate, signed } from '../api.js';

defineProps({
  games: { type: Array, required: true },
  highlight: { type: Number, default: null },
  deletable: { type: Boolean, default: false },
});
defineEmits(['delete']);

const cls = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'faint');
</script>

<template>
  <div class="table-wrap">
    <table class="table">
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
          <td class="nowrap muted">{{ formatDate(g.playedAt) }}</td>
          <td v-for="side in g.result === 'A' ? ['teamA', 'teamB'] : ['teamB', 'teamA']" :key="side" :class="{ won: side === (g.result === 'A' ? 'teamA' : 'teamB') }">
            <div v-for="p in g[side]" :key="p.id" class="player">
              <RouterLink :to="`/players/${p.id}`" :class="{ me: p.id === highlight }">{{ p.name }}</RouterLink>
              <span class="faint hands num" title="Hands won">{{ p.hands }}h</span>
              <span class="num delta" :class="cls(p.delta)">{{ signed(Math.round(p.delta)) }}</span>
            </div>
          </td>
          <td class="muted notes">{{ g.notes }}</td>
          <td v-if="deletable" class="right">
            <button class="btn ghost danger" @click="$emit('delete', g)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.nowrap {
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
  background: var(--mint-soft);
}
.won .player a {
  font-weight: 600;
}
.me {
  background: var(--mint);
  border-radius: 3px;
  padding: 0 3px;
  margin: 0 -3px;
}
.hands,
.delta {
  font-size: 12px;
}
.notes {
  font-size: 13px;
  max-width: 240px;
}
</style>

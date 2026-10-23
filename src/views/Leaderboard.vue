<script setup>
import { ref, computed, onMounted } from 'vue';
import { api, auth, signed } from '../api.js';
import Flame from '../components/Flame.vue';
import RankTag from '../components/RankTag.vue';

const rows = ref(null);
const error = ref('');

const ranked = computed(() => rows.value?.filter((p) => p.ranked) ?? []);
const unranked = computed(() => rows.value?.filter((p) => !p.ranked) ?? []);
const cls = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'faint');

onMounted(async () => {
  try {
    rows.value = await api('/leaderboard');
  } catch (e) {
    error.value = e.message;
  }
});
</script>

<template>
  <h1>Leaderboard</h1>
  <p v-if="error" class="error">{{ error }}</p>
  <p v-else-if="rows && !rows.length" class="empty">No games yet</p>
  <template v-else-if="rows">
    <div v-if="ranked.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th class="rank">#</th>
            <th>Player</th>
            <th>Rank</th>
            <th class="right">Rating</th>
            <th class="right">Last</th>
            <th class="right wide">W–L</th>
            <th class="right wide">Games</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in ranked" :key="p.id" :class="{ me: p.id === auth.account?.player?.id }">
            <td class="rank num"><span class="medal" :class="['gold', 'silver', 'bronze'][i]">{{ i + 1 }}</span></td>
            <td class="who">
              <RouterLink :to="`/players/${p.id}`" class="name">{{ p.name }}</RouterLink>
              <Flame :days="p.streak" />
            </td>
            <td><RankTag :tier="p.tier" /></td>
            <td class="right num rating">{{ p.rating }}</td>
            <td class="right num" :class="cls(p.lastDelta)">{{ signed(Math.round(p.lastDelta)) }}</td>
            <td class="right num muted wide">{{ p.wins }}–{{ p.losses }}</td>
            <td class="right num muted wide">{{ p.games }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <template v-if="unranked.length">
      <h2>Unranked</h2>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Player</th>
              <th class="right">Placement</th>
              <th class="right">Rating</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in unranked" :key="p.id" :class="{ me: p.id === auth.account?.player?.id }">
              <td class="who">
                <RouterLink :to="`/players/${p.id}`" class="name">{{ p.name }}</RouterLink>
                <Flame :days="p.streak" />
              </td>
              <td class="right num muted">{{ p.placement }}</td>
              <td class="right num faint">{{ p.rating }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </template>
</template>

<style scoped>
.rank {
  width: 36px;
}
.who {
  white-space: nowrap;
}
.name {
  font-weight: 500;
  margin-right: 6px;
}
.name:hover {
  text-decoration: underline;
  text-decoration-color: var(--text-3);
}
.rating {
  font-weight: 600;
}
@media (max-width: 560px) {
  .rank {
    width: 30px;
  }
  .who {
    max-width: 150px;
  }
  .name {
    display: inline-block;
    max-width: calc(100% - 40px);
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
    margin-right: 4px;
  }
}
.me td {
  background: var(--mint);
}
.medal {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 12px;
  color: var(--text-3);
}
.medal.gold {
  background: var(--yellow-bg);
  color: var(--yellow);
  font-weight: 600;
}
.medal.silver {
  background: var(--gray-bg);
  color: var(--text-2);
  font-weight: 600;
}
.medal.bronze {
  background: var(--orange-bg);
  color: var(--orange);
  font-weight: 600;
}
</style>

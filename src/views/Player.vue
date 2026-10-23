<script setup>
import { ref, watch } from 'vue';
import { api } from '../api.js';
import GameTable from '../components/GameTable.vue';
import RatingChart from '../components/RatingChart.vue';
import RankTag from '../components/RankTag.vue';
import Flame from '../components/Flame.vue';

const props = defineProps({ id: { type: String, required: true } });

const data = ref(null);
const error = ref('');

watch(
  () => props.id,
  async (id) => {
    error.value = '';
    try {
      const d = await api(`/players/${id}`);
      data.value = d;
      document.title = `${d.player.name} · Bridge Elo`;
    } catch (e) {
      error.value = e.message;
    }
  },
  { immediate: true },
);
</script>

<template>
  <p v-if="error" class="error">{{ error }}</p>
  <template v-else-if="data">
    <h1>{{ data.player.name }}</h1>
    <div class="badges">
      <RankTag v-if="data.player.ranked" :tier="data.player.tier" />
      <span v-else class="tag">Unranked · {{ data.player.placement }}</span>
      <Flame :days="data.player.streak" />
      <span v-if="data.player.discord" class="discord muted">@{{ data.player.discord }}</span>
    </div>

    <div class="stats">
      <div class="main-stat">
        <span>Rating</span><b class="num">{{ data.player.rating }}</b>
        <small v-if="data.player.decay" class="down num">−{{ data.player.decay }} inactivity</small>
      </div>
      <div><span>Peak</span><b class="num">{{ data.player.peak }}</b></div>
      <div><span>W–L</span><b class="num">{{ data.player.wins }}–{{ data.player.losses }}</b></div>
      <div><span>Streak</span><b class="num">{{ data.player.streak }}</b></div>
      <div><span>Best streak</span><b class="num">{{ data.player.bestStreak }}</b></div>
    </div>

    <RatingChart v-if="data.history.length > 1" :points="data.history.map((h) => h.rating)" />

    <h2>Games</h2>
    <p v-if="!data.games.length" class="empty">No games yet</p>
    <GameTable v-else :games="data.games" :highlight="data.player.id" />
  </template>
</template>

<style scoped>
h1 {
  margin-bottom: 8px;
}
.badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
}
.discord {
  font-size: 13px;
}
.stats small {
  font-size: 12px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 24px;
}
.stats > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--bg-sidebar);
}
.stats > .main-stat {
  background: var(--hl);
}
.main-stat b {
  color: var(--hl-text);
}
.stats span:first-child {
  font-size: 12px;
  color: var(--text-2);
}
.stats b {
  font-size: 22px;
  font-weight: 600;
}
@media (max-width: 520px) {
  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    row-gap: 16px;
  }
}
</style>

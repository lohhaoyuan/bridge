<script setup>
import { ref, computed, watch } from 'vue';
import { api, getMeta, signed } from '../api.js';
import MatchCard from '../components/MatchCard.vue';
import RatingChart from '../components/RatingChart.vue';
import RankTag from '../components/RankTag.vue';
import Flame from '../components/Flame.vue';

const props = defineProps({ id: { type: String, required: true } });

const data = ref(null);
const games = ref([]);
const chartGame = ref(null);
const error = ref('');

const byKey = computed(() => Object.fromEntries(games.value.map((g) => [g.key, g])));
// Games this player has played, in the site's game order.
const played = computed(() => games.value.filter((g) => data.value?.player.byGame[g.key]));
const shownMatches = computed(() => (chartGame.value ? data.value.matches.filter((m) => m.type === chartGame.value) : data.value.matches));

watch(
  () => props.id,
  async (id) => {
    error.value = '';
    try {
      const [d, meta] = await Promise.all([api(`/players/${id}`), getMeta()]);
      data.value = d;
      games.value = meta.games;
      chartGame.value = played.value.length === 1 ? played.value[0].key : null;
      document.title = `${d.player.name} · Bridge Elo`;
    } catch (e) {
      error.value = e.message;
    }
  },
  { immediate: true },
);

const toggle = (key) => (chartGame.value = chartGame.value === key ? null : key);
</script>

<template>
  <p v-if="error" class="error">{{ error }}</p>
  <template v-else-if="data">
    <h1>{{ data.player.name }}</h1>
    <div class="badges">
      <Flame :days="data.player.streak" />
      <span v-if="data.player.discord" class="discord muted">@{{ data.player.discord }}</span>
    </div>

    <div class="stats">
      <div class="main-stat">
        <span>GOAT score</span><b class="num">{{ data.player.ranked ? signed(data.player.goat) : '—' }}</b>
        <small v-if="!data.player.ranked" class="muted num">{{ data.player.placement }} placement</small>
      </div>
      <div><span>Games</span><b class="num">{{ data.player.games }}</b></div>
      <div><span>Wins</span><b class="num">{{ data.player.wins }}</b></div>
      <div><span>Streak</span><b class="num">{{ data.player.streak }}</b></div>
      <div><span>Best streak</span><b class="num">{{ data.player.bestStreak }}</b></div>
    </div>

    <div v-if="played.length" class="per-game">
      <button
        v-for="g in played"
        :key="g.key"
        class="game-card"
        :class="{ on: chartGame === g.key }"
        @click="toggle(g.key)"
      >
        <div class="gname"><span>{{ g.icon }}</span>{{ g.name }}</div>
        <b class="num">{{ data.player.byGame[g.key].rating }}</b>
        <div class="meta">
          <RankTag v-if="data.player.byGame[g.key].ranked" :tier="data.player.byGame[g.key].tier" />
          <span v-else class="tag">{{ data.player.byGame[g.key].placement }}</span>
          <span class="faint num">{{ data.player.byGame[g.key].wins }}–{{ data.player.byGame[g.key].losses }}</span>
        </div>
        <small v-if="data.player.byGame[g.key].decay" class="down num">−{{ data.player.byGame[g.key].decay }} inactivity</small>
      </button>
    </div>

    <template v-if="chartGame && data.history[chartGame]?.length > 1">
      <h2>{{ byKey[chartGame].icon }} {{ byKey[chartGame].name }} rating</h2>
      <RatingChart :points="data.history[chartGame].map((h) => h.rating)" />
    </template>

    <h2>{{ chartGame ? `${byKey[chartGame].name} games` : 'Games' }}</h2>
    <p v-if="!shownMatches.length" class="empty">No games yet</p>
    <MatchCard v-for="m in shownMatches" v-else :key="m.uid" :match="m" :games="byKey" :highlight="data.player.id" />
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
  min-height: 8px;
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
  margin-bottom: 16px;
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
.per-game {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}
.game-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  cursor: pointer;
  text-align: left;
}
.game-card:hover {
  background: var(--hl-soft);
}
.game-card.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus);
}
.gname {
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
  font-weight: 500;
}
.game-card b {
  font-size: 20px;
  font-weight: 600;
}
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.game-card small {
  font-size: 11px;
}
@media (max-width: 520px) {
  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    row-gap: 8px;
  }
  .per-game {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

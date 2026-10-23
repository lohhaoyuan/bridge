<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, auth, getMeta, signed } from '../api.js';
import Flame from '../components/Flame.vue';
import RankTag from '../components/RankTag.vue';
import GameTabs from '../components/GameTabs.vue';
import { RANK_NAMES, TIER_KEYS, tierRange } from '../ranks.js';

const route = useRoute();
const router = useRouter();
const games = ref([]);
const initialRating = ref(1000);
const rows = ref(null);
const error = ref('');

const OVERALL = { key: 'overall', label: 'GOAT', icon: '🐐' };
const game = computed({
  get: () => (typeof route.query.game === 'string' ? route.query.game : 'overall'),
  set: (g) => router.replace({ query: g === 'overall' ? {} : { game: g } }),
});
const overall = computed(() => game.value === 'overall');
const gameDef = (key) => games.value.find((g) => g.key === key);

const ranked = computed(() => rows.value?.filter((p) => p.ranked) ?? []);
const unranked = computed(() => rows.value?.filter((p) => !p.ranked) ?? []);
const cls = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'faint');
const isMe = (p) => p.id === auth.account?.player?.id;
// Games a player has played, best rating first (for the GOAT row chips).
const playedGames = (p) => Object.entries(p.byGame).sort((a, b) => b[1].rating - a[1].rating);

watch(
  game,
  async (g) => {
    error.value = '';
    rows.value = null;
    try {
      const [meta, data] = await Promise.all([getMeta(), api(`/leaderboard?game=${encodeURIComponent(g)}`)]);
      games.value = meta.games;
      initialRating.value = meta.settings.initialRating;
      rows.value = data;
    } catch (e) {
      error.value = e.message;
    }
  },
  { immediate: true },
);
</script>

<template>
  <h1>Leaderboard</h1>
  <GameTabs v-if="games.length" v-model="game" :games="games" :extra="OVERALL" />
  <div v-if="!overall && RANK_NAMES[game]" class="ladder" aria-label="Ranks, lowest to highest">
    <template v-for="(tier, i) in TIER_KEYS" :key="tier">
      <span v-if="i" class="arrow faint">›</span>
      <span class="step" :title="tierRange(i, initialRating)">
        <RankTag :tier="tier" :game="game" />
        <small class="faint num">{{ tierRange(i, initialRating) }}</small>
      </span>
    </template>
  </div>

  <p v-if="error" class="error">{{ error }}</p>
  <p v-else-if="rows && !rows.length" class="empty">No games yet</p>
  <template v-else-if="rows">
    <div v-if="ranked.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th class="rank">#</th>
            <th>Player</th>
            <template v-if="overall">
              <th class="right">GOAT</th>
              <th class="wide">Games</th>
            </template>
            <template v-else>
              <th>Rank</th>
              <th class="right">Rating</th>
              <th class="right">Last</th>
              <th class="right wide">W–L</th>
            </template>
            <th class="right wide">Played</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in ranked" :key="p.id" :class="{ me: isMe(p) }">
            <td class="rank num"><span class="medal" :class="['gold', 'silver', 'bronze'][i]">{{ overall && i === 0 ? '🐐' : i + 1 }}</span></td>
            <td class="who">
              <RouterLink :to="`/players/${p.id}`" class="name">{{ p.name }}</RouterLink>
              <Flame :days="p.streak" />
            </td>
            <template v-if="overall">
              <td class="right num rating">{{ signed(p.goat) }}</td>
              <td class="wide">
                <span class="chips">
                  <span v-for="[g, r] in playedGames(p)" :key="g" class="chip" :title="`${gameDef(g)?.name}: ${r.rating}`">
                    {{ gameDef(g)?.icon }} <span class="num">{{ r.rating }}</span>
                  </span>
                </span>
              </td>
            </template>
            <template v-else>
              <td><RankTag :tier="p.tier" :game="game" /></td>
              <td class="right num rating">{{ p.rating }}</td>
              <td class="right num" :class="cls(p.lastDelta)">{{ signed(Math.round(p.lastDelta)) }}</td>
              <td class="right num muted wide">{{ p.wins }}–{{ p.losses }}</td>
            </template>
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
              <th class="right">{{ overall ? 'GOAT' : 'Rating' }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in unranked" :key="p.id" :class="{ me: isMe(p) }">
              <td class="who">
                <RouterLink :to="`/players/${p.id}`" class="name">{{ p.name }}</RouterLink>
                <Flame :days="p.streak" />
              </td>
              <td class="right num muted">{{ p.placement }}</td>
              <td class="right num faint">{{ overall ? signed(p.goat) : p.rating }}</td>
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
.ladder {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  margin: -8px 0 20px;
  padding-bottom: 2px;
}
.ladder::-webkit-scrollbar {
  display: none;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  flex-shrink: 0;
}
.step small {
  font-size: 11px;
  padding-left: 2px;
}
.arrow {
  line-height: 20px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  display: inline-flex;
  gap: 3px;
  align-items: center;
  font-size: 12px;
  padding: 0 6px;
  line-height: 20px;
  border-radius: 4px;
  background: var(--gray-bg);
  color: var(--text-2);
  white-space: nowrap;
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
  background: var(--hl);
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

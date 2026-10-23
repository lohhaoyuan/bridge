<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, getMeta } from '../api.js';
import GameTabs from '../components/GameTabs.vue';
import MatchCard from '../components/MatchCard.vue';

const route = useRoute();
const router = useRouter();
const games = ref([]);
const matches = ref(null);
const error = ref('');

const ALL = { key: 'all', label: 'All', icon: '✦' };
const game = computed({
  get: () => (typeof route.query.game === 'string' ? route.query.game : 'all'),
  set: (g) => router.replace({ query: g === 'all' ? {} : { game: g } }),
});
const byKey = computed(() => Object.fromEntries(games.value.map((g) => [g.key, g])));

watch(
  game,
  async (g) => {
    error.value = '';
    matches.value = null;
    try {
      const [meta, data] = await Promise.all([getMeta(), api(g === 'all' ? '/games' : `/games?game=${encodeURIComponent(g)}`)]);
      games.value = meta.games;
      matches.value = data;
    } catch (e) {
      error.value = e.message;
    }
  },
  { immediate: true },
);
</script>

<template>
  <h1>Games</h1>
  <GameTabs v-if="games.length" v-model="game" :games="games" :extra="ALL" />
  <p v-if="error" class="error">{{ error }}</p>
  <p v-else-if="matches && !matches.length" class="empty">No games yet</p>
  <template v-else-if="matches">
    <MatchCard v-for="m in matches" :key="m.uid" :match="m" :games="byKey" />
  </template>
</template>

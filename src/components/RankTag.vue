<script setup>
import { computed } from 'vue';
import { rankLabel } from '../ranks.js';

const props = defineProps({
  tier: { type: String, default: null },
  game: { type: String, default: 'bridge' },
});
const rank = computed(() => rankLabel(props.game, props.tier));
</script>

<template>
  <span v-if="rank" class="tag" :class="rank.color">{{ rank.name }}</span>
</template>

<style scoped>
.orange {
  background: var(--orange-bg);
  color: var(--orange);
}
.red {
  background: var(--red-bg);
  color: var(--red);
}
.blue {
  background: var(--blue-bg);
  color: var(--blue);
}
.purple {
  background: var(--purple-bg);
  color: var(--purple);
}
.gold {
  background: var(--yellow-bg);
  color: var(--yellow);
  font-weight: 600;
}
</style>

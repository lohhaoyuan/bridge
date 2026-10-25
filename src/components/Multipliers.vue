<script setup>
// Small badges explaining why a player's points were boosted in a match.
defineProps({ p: { type: Object, required: true } });
</script>

<template>
  <span v-if="p.upset" class="mult upset" :title="`Upset: underdog win, points ×${p.upset}`">⚡×{{ p.upset }}</span>
  <span v-if="p.hot" class="mult hot" :title="`Win streak: points ×${p.hot}`">🔥×{{ p.hot }}</span>
  <span v-if="p.placement" class="mult placement" :title="`Placement game: points ×${p.placement}`">🆕×{{ p.placement }}</span>
</template>

<style scoped>
.mult {
  font-size: 11px;
  font-weight: 600;
  padding: 0 4px;
  border-radius: 4px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.upset {
  background: var(--purple-bg);
  color: var(--purple);
}
.hot {
  background: var(--orange-bg);
  color: var(--orange);
}
.placement {
  background: var(--blue-bg);
  color: var(--blue);
}
</style>

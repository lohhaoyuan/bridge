<script setup>
defineProps({ tier: { type: String, default: null } });

const TIERS = {
  clubs: ['♣ Clubs', 'gray'],
  diamonds: ['♦ Diamonds', 'orange'],
  hearts: ['♥ Hearts', 'red'],
  spades: ['♠ Spades', 'blue'],
  notrump: ['No Trump', 'purple'],
  grandslam: ['Grand Slam', 'gold'],
};
</script>

<template>
  <span v-if="tier" class="tag" :class="TIERS[tier][1]">{{ TIERS[tier][0] }}</span>
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

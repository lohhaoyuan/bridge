<script setup>
import { computed } from 'vue';

const props = defineProps({ days: { type: Number, required: true } });

// Colour climbs with the streak: orange → purple → blue → rainbow.
const LEVELS = [
  [20, 'rainbow', ['#ff4d4d', '#ffd23f']],
  [10, 'blue', ['#1e6fd9', '#7fd3ff']],
  [5, 'purple', ['#8a3ffc', '#e0a8ff']],
  [1, 'orange', ['#f2541b', '#ffc24b']],
];

const level = computed(() => LEVELS.find(([min]) => props.days >= min));
const id = `flame-${Math.random().toString(36).slice(2, 8)}`;
</script>

<template>
  <span v-if="level" class="flame" :class="level[1]" :title="`${days}-day streak`">
    <svg viewBox="0 0 16 20" aria-hidden="true">
      <defs>
        <linearGradient :id="id" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" :stop-color="level[2][0]" />
          <stop offset="1" :stop-color="level[2][1]" />
        </linearGradient>
      </defs>
      <path
        :fill="`url(#${id})`"
        d="M8 0c.6 3-1 4.8-2.6 6.6C3.8 8.4 2 10.4 2 13.3 2 16.9 4.7 20 8 20s6-3.1 6-6.7c0-2.3-1-4.3-2.4-5.8.1 1.6-.5 2.9-1.6 3.6C10.3 7.6 9.6 3 8 0Z"
      />
      <path fill="#fff" fill-opacity=".55" d="M8 11.5c.2 1.4-.6 2.2-1.2 3-.5.6-.8 1.2-.8 1.9C6 17.8 6.9 19 8 19s2-1.2 2-2.6c0-1.6-.9-3.4-2-4.9Z" />
    </svg>
    <span class="num">{{ days }}</span>
  </span>
</template>

<style scoped>
.flame {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
  vertical-align: middle;
}
svg {
  width: 11px;
  height: 14px;
}
.orange {
  color: #d9730d;
}
.purple {
  color: #9065b0;
}
.blue {
  color: #337ea9;
}
.rainbow svg {
  animation: hue 3s linear infinite;
}
.rainbow .num {
  background: linear-gradient(90deg, #ff4d4d, #ffb000, #3ec46d, #2f8cff, #b45cff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
@keyframes hue {
  to {
    filter: hue-rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .rainbow svg {
    animation: none;
  }
}
</style>

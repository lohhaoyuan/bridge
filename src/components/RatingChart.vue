<script setup>
import { computed } from 'vue';

const props = defineProps({ points: { type: Array, required: true } });

const W = 600;
const H = 140;
const PAD = 8;

const geo = computed(() => {
  const ys = props.points;
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = Math.max(max - min, 20);
  const mid = (max + min) / 2;
  const lo = mid - span / 2;
  const x = (i) => PAD + (i / Math.max(ys.length - 1, 1)) * (W - 2 * PAD);
  const y = (v) => H - PAD - ((v - lo) / span) * (H - 2 * PAD);
  const pts = ys.map((v, i) => [x(i), y(v)]);
  return {
    line: pts.map((p) => p.join(',')).join(' '),
    area: `${PAD},${H - PAD} ${pts.map((p) => p.join(',')).join(' ')} ${x(ys.length - 1)},${H - PAD}`,
    last: pts.at(-1),
    min: Math.round(min),
    max: Math.round(max),
  };
});
</script>

<template>
  <div class="chart">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" aria-label="Rating over time">
      <polygon :points="geo.area" class="area" />
      <polyline :points="geo.line" class="line" vector-effect="non-scaling-stroke" />
    </svg>
    <div class="axis faint num">
      <span>{{ geo.max }}</span>
      <span>{{ geo.min }}</span>
    </div>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  height: 140px;
  padding-right: 40px;
}
svg {
  border-bottom: 1px solid var(--border);
  width: 100%;
  height: 100%;
  display: block;
}
.line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linejoin: round;
}
.area {
  fill: var(--accent);
  opacity: 0.08;
}
.axis {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  font-size: 11px;
  padding: 2px 0;
  pointer-events: none;
}
</style>

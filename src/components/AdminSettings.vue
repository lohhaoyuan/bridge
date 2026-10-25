<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';

const general = [
  ['initialRating', 'Starting rating', 1],
  ['streakBonus', 'Win streak bonus per win', 0.05],
  ['streakCap', 'Max streak wins counted', 1],
  ['placementGames', 'Games before ranked', 1],
  ['placementBoost', 'Placement game multiplier', 0.1],
  ['upsetThreshold', 'Upset if winner’s chance below', 0.05],
  ['upsetBonus', 'Upset multiplier', 0.1],
  ['decayGraceDays', 'Days before decay starts', 1],
  ['decayPerWeek', 'Decay per idle week', 1],
  ['goatFullGames', 'Games for full GOAT credit', 1],
];
const kFields = ref([]);
const sections = computed(() => [
  ['General', general],
  ['K-factor (how much one game moves ratings)', kFields.value],
]);

const values = reactive({});
const limits = ref({});
const status = ref('');
const error = ref('');

onMounted(async () => {
  const meta = await api('/meta');
  Object.assign(values, meta.settings);
  limits.value = meta.limits;
  kFields.value = meta.games.map((g) => [g.key === 'bridge' ? 'kFactor' : `k.${g.key}`, `${g.icon} ${g.name}`, 1]);
});

async function save() {
  error.value = '';
  status.value = '';
  try {
    Object.assign(values, await api('/settings', { method: 'PUT', body: { ...values } }));
    status.value = 'Saved';
  } catch (e) {
    error.value = e.message;
  }
}
</script>

<template>
  <form class="settings" @submit.prevent="save">
    <template v-for="[title, fields] in sections" :key="title">
      <h2>{{ title }}</h2>
      <label v-for="[key, label, step] in fields" :key="key" class="line">
        <span>{{ label }}</span>
        <input
          v-model.number="values[key]"
          type="number"
          class="input num"
          :step="step"
          :min="limits[key]?.[0]"
          :max="limits[key]?.[1]"
        />
      </label>
    </template>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="actions">
      <span class="muted">{{ status }}</span>
      <button class="btn primary">Save and recalculate</button>
    </div>
  </form>
</template>

<style scoped>
.settings {
  max-width: 420px;
  display: flex;
  flex-direction: column;
}
h2:first-child {
  margin-top: 0;
}
.line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.line .input {
  width: 110px;
  text-align: right;
}
.actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}
</style>

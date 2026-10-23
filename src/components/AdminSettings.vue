<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '../api.js';

const fields = [
  ['initialRating', 'Starting rating', 1],
  ['kFactor', 'K-factor', 1],
  ['streakBonus', 'Win streak bonus per win', 0.05],
  ['streakCap', 'Max streak wins counted', 1],
  ['placementGames', 'Games before ranked', 1],
  ['placementBoost', 'Placement game multiplier', 0.1],
  ['decayGraceDays', 'Days before decay starts', 1],
  ['decayPerWeek', 'Decay per idle week', 1],
];

const values = reactive({});
const limits = ref({});
const status = ref('');
const error = ref('');

onMounted(async () => {
  const meta = await api('/meta');
  Object.assign(values, meta.settings);
  limits.value = meta.limits;
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

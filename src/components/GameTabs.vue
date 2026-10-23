<script setup>
// Pill tabs for picking a game. `extra` adds a leading tab (e.g. Overall / All).
defineProps({
  games: { type: Array, required: true },
  modelValue: { type: String, required: true },
  extra: { type: Object, default: null }, // { key, label, icon }
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="game-tabs" role="tablist">
    <button
      v-for="g in extra ? [extra, ...games] : games"
      :key="g.key"
      role="tab"
      :aria-selected="modelValue === g.key"
      :class="{ on: modelValue === g.key }"
      @click="$emit('update:modelValue', g.key)"
    >
      <span class="icon">{{ g.icon }}</span>{{ g.label ?? g.name }}
    </button>
  </div>
</template>

<style scoped>
.game-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  margin: 0 0 20px;
  padding-bottom: 2px;
}
.game-tabs::-webkit-scrollbar {
  display: none;
}
button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--bg);
  color: var(--text-2);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}
button:hover {
  background: var(--hl-soft);
  color: var(--text);
}
button.on {
  background: var(--hl);
  border-color: var(--hl-strong);
  color: var(--hl-text);
}
.icon {
  font-size: 13px;
}
</style>

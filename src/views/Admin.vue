<script setup>
import { ref } from 'vue';
import AdminGames from '../components/AdminGames.vue';
import AdminPlayers from '../components/AdminPlayers.vue';
import AdminAccounts from '../components/AdminAccounts.vue';
import AdminSettings from '../components/AdminSettings.vue';

const tabs = { games: 'Games', players: 'Players', accounts: 'Accounts', settings: 'Settings' };
const tab = ref('games');
</script>

<template>
  <h1>Admin</h1>
  <div class="tabs">
    <button v-for="(label, key) in tabs" :key="key" :class="{ on: tab === key }" @click="tab = key">
      {{ label }}
    </button>
  </div>
  <AdminGames v-if="tab === 'games'" />
  <AdminPlayers v-else-if="tab === 'players'" />
  <AdminAccounts v-else-if="tab === 'accounts'" />
  <AdminSettings v-else />
</template>

<style scoped>
.tabs {
  scrollbar-width: none;
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
  overflow-x: auto;
}
.tabs button {
  border: 0;
  background: none;
  padding: 6px 8px;
  margin-bottom: -1px;
  color: var(--text-2);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.tabs button:hover {
  color: var(--text);
}
.tabs button.on {
  color: var(--text);
  border-bottom-color: var(--accent);
}
</style>

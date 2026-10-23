<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';
import GameTable from '../components/GameTable.vue';

const games = ref(null);
const error = ref('');

onMounted(async () => {
  try {
    games.value = await api('/games');
  } catch (e) {
    error.value = e.message;
  }
});
</script>

<template>
  <h1>Games</h1>
  <p v-if="error" class="error">{{ error }}</p>
  <p v-else-if="games && !games.length" class="empty">No games yet</p>
  <GameTable v-else-if="games" :games="games" />
</template>

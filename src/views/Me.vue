<script setup>
import { ref, reactive, watch } from 'vue';
import { auth, api } from '../api.js';
import Player from './Player.vue';

const form = reactive({ name: '', discord: '' });
const error = ref('');
const status = ref('');
const statsKey = ref(0);

watch(
  () => auth.account,
  (a) => {
    form.name = a?.player?.name ?? a?.name ?? '';
    form.discord = a?.player?.discord ?? '';
  },
  { immediate: true },
);

async function save() {
  error.value = '';
  status.value = '';
  try {
    const method = auth.account.player ? 'PATCH' : 'POST';
    auth.account = await api('/me/player', { method, body: { ...form } });
    status.value = 'Saved';
    statsKey.value++;
  } catch (e) {
    error.value = e.message;
  }
}
</script>

<template>
  <template v-if="auth.account">
    <form class="profile" @submit.prevent="save">
      <img v-if="auth.account.picture" :src="auth.account.picture" class="avatar" alt="" referrerpolicy="no-referrer" />
      <div class="fields">
        <label class="field"><span>Name</span><input v-model="form.name" class="input" maxlength="60" required /></label>
        <label class="field">
          <span>Discord</span>
          <input v-model="form.discord" class="input" maxlength="37" placeholder="username" />
        </label>
        <div class="actions">
          <span class="muted">{{ status }}</span>
          <button class="btn primary">{{ auth.account.player ? 'Save' : 'Create player' }}</button>
        </div>
      </div>
    </form>
    <p v-if="error" class="error">{{ error }}</p>

    <Player v-if="auth.account.player" :id="String(auth.account.player.id)" :key="statsKey" />
  </template>
</template>

<style scoped>
.profile {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 16px;
  border-radius: 8px;
  background: var(--mint-soft);
  border: 1px solid var(--mint-strong);
  margin-bottom: 48px;
}
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}
.fields {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}
.fields .field {
  flex: 1;
  min-width: 160px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>

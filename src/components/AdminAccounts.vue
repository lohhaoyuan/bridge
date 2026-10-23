<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';

const accounts = ref([]);
const players = ref([]);
const error = ref('');

async function load() {
  const [a, p] = await Promise.all([api('/accounts'), api('/players')]);
  accounts.value = a;
  players.value = p.sort((x, y) => x.name.localeCompare(y.name));
}
onMounted(() => load().catch((e) => (error.value = e.message)));

const linked = computed(() => new Set(accounts.value.map((a) => a.playerId).filter(Boolean)));
const optionsFor = (a) => players.value.filter((p) => p.id === a.playerId || !linked.value.has(p.id));

async function update(a, body) {
  error.value = '';
  try {
    await api(`/accounts/${a.id}`, { method: 'PATCH', body });
  } catch (e) {
    error.value = e.message;
  }
  await load().catch(() => {});
}

function toggleAdmin(a) {
  const verb = a.isAdmin ? 'Remove admin access from' : 'Make admin:';
  if (confirm(`${verb} ${a.email}?`)) update(a, { isAdmin: !a.isAdmin });
}
</script>

<template>
  <p v-if="error" class="error">{{ error }}</p>
  <p v-if="!accounts.length" class="empty">No accounts yet</p>
  <div v-else class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th>Account</th>
          <th>Player</th>
          <th>Role</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in accounts" :key="a.id">
          <td class="who">
            <img v-if="a.picture" :src="a.picture" alt="" referrerpolicy="no-referrer" />
            <div>
              <div class="name">{{ a.name || a.email }}</div>
              <div class="faint email">{{ a.email }}</div>
            </div>
          </td>
          <td>
            <select class="input" :value="a.playerId ?? ''" @change="update(a, { playerId: $event.target.value === '' ? null : Number($event.target.value) })">
              <option value="">—</option>
              <option v-for="p in optionsFor(a)" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </td>
          <td>
            <span class="tag" :class="{ blue: a.isAdmin }">{{ a.isAdmin ? 'Admin' : 'Player' }}</span>
          </td>
          <td class="right">
            <button v-if="!a.me" class="btn ghost" @click="toggleAdmin(a)">{{ a.isAdmin ? 'Remove admin' : 'Make admin' }}</button>
            <span v-else class="faint you">You</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.who {
  display: flex;
  align-items: center;
  gap: 10px;
}
.who img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}
.name {
  font-weight: 500;
}
.email {
  font-size: 12px;
}
select.input {
  height: 28px;
  min-width: 140px;
}
.you {
  font-size: 13px;
  padding-right: 8px;
}
</style>

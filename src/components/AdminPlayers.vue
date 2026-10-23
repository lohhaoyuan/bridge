<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';

const players = ref([]);
const name = ref('');
const editing = ref(null);
const draft = ref('');
const error = ref('');
const vFocus = { mounted: (el) => (el.focus(), el.select()) };

async function load() {
  players.value = (await api('/players')).sort((a, b) => a.name.localeCompare(b.name));
}
onMounted(() => load().catch((e) => (error.value = e.message)));

async function run(fn) {
  error.value = '';
  try {
    await fn();
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

const add = () =>
  run(async () => {
    await api('/players', { method: 'POST', body: { name: name.value } });
    name.value = '';
  });

function startEdit(p) {
  editing.value = p.id;
  draft.value = p.name;
}

const saveEdit = (p) =>
  run(async () => {
    if (draft.value.trim() && draft.value.trim() !== p.name) {
      await api(`/players/${p.id}`, { method: 'PATCH', body: { name: draft.value } });
    }
    editing.value = null;
  });

const toggle = (p) => run(() => api(`/players/${p.id}`, { method: 'PATCH', body: { active: !p.active } }));

const remove = (p) => {
  if (!confirm(`Delete ${p.name}?`)) return;
  run(() => api(`/players/${p.id}`, { method: 'DELETE' }));
};
</script>

<template>
  <form class="add" @submit.prevent="add">
    <input v-model="name" class="input" placeholder="Name" maxlength="60" />
    <button class="btn primary" :disabled="!name.trim()">Add player</button>
  </form>
  <p v-if="error" class="error">{{ error }}</p>

  <p v-if="!players.length" class="empty">No players yet</p>
  <div v-else class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th class="right">Rating</th>
          <th class="right">Games</th>
          <th class="wide">Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in players" :key="p.id" :class="{ inactive: !p.active }">
          <td>
            <input
              v-if="editing === p.id"
              v-model="draft"
              class="input edit"
              maxlength="60"
              @keydown.enter.prevent="saveEdit(p)"
              @keydown.esc="editing = null"
              @blur="saveEdit(p)"
              v-focus
            />
            <span v-else class="name" @click="startEdit(p)">{{ p.name }}</span>
          </td>
          <td class="right num">{{ p.rating }}</td>
          <td class="right num muted">{{ p.games }}</td>
          <td class="wide">
            <span class="tag" :class="p.active ? 'green' : ''">{{ p.active ? 'Active' : 'Inactive' }}</span>
          </td>
          <td class="right nowrap">
            <button class="btn ghost" @click="toggle(p)">{{ p.active ? 'Deactivate' : 'Activate' }}</button>
            <button v-if="!p.games" class="btn ghost danger" @click="remove(p)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.add {
  display: flex;
  gap: 8px;
  max-width: 420px;
  margin-bottom: 16px;
}
.add .input {
  flex: 1;
}
.name {
  cursor: text;
  font-weight: 500;
  padding: 2px 4px;
  margin: -2px -4px;
  border-radius: 4px;
}
.name:hover {
  background: var(--hover);
}
.edit {
  height: 28px;
  width: 100%;
  max-width: 240px;
}
.inactive .name,
.inactive .num {
  color: var(--text-3);
}
.nowrap {
  white-space: nowrap;
}
</style>

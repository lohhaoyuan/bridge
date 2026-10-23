<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { api, signed } from '../api.js';
import GameTable from './GameTable.vue';

const today = () => new Date().toLocaleDateString('en-CA');
const seat = () => ({ id: '', hands: '' });
const blank = () => ({ playedAt: today(), A: [seat(), seat()], B: [seat(), seat()], result: '', notes: '' });

const form = reactive(blank());
const players = ref([]);
const games = ref([]);
const preview = ref(null);
const error = ref('');
const busy = ref(false);

async function load() {
  const [p, g] = await Promise.all([api('/players'), api('/games')]);
  players.value = p.filter((x) => x.active).sort((a, b) => a.name.localeCompare(b.name));
  games.value = g;
}
onMounted(() => load().catch((e) => (error.value = e.message)));

const seats = computed(() => [...form.A, ...form.B]);
const optionsFor = (s) => {
  const taken = new Set(seats.value.filter((x) => x !== s).map((x) => x.id));
  return players.value.filter((p) => !taken.has(p.id));
};

const payload = computed(() => ({
  playedAt: form.playedAt,
  result: form.result,
  notes: form.notes.trim(),
  teamA: form.A.map((s) => ({ id: s.id, hands: s.hands })),
  teamB: form.B.map((s) => ({ id: s.id, hands: s.hands })),
}));
const ready = computed(() => seats.value.every((s) => s.id !== '') && form.result && form.playedAt);

let timer;
watch(payload, (body) => {
  clearTimeout(timer);
  if (!ready.value) return (preview.value = null);
  timer = setTimeout(async () => {
    try {
      preview.value = await api('/games/preview', { method: 'POST', body });
      error.value = '';
    } catch (e) {
      preview.value = null;
      error.value = e.message;
    }
  }, 200);
});

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    await api('/games', { method: 'POST', body: payload.value });
    Object.assign(form, blank(), { playedAt: form.playedAt });
    preview.value = null;
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function remove(g) {
  const names = [...g.teamA, ...g.teamB].map((p) => p.name).join(', ');
  if (!confirm(`Delete game ${g.playedAt} (${names})? Ratings will be recalculated.`)) return;
  try {
    await api(`/games/${g.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

const cls = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'faint');
</script>

<template>
  <form class="card" @submit.prevent="submit">
    <label class="field date"><span>Date</span><input v-model="form.playedAt" type="date" class="input" required /></label>

    <div class="teams">
      <div v-for="side in ['A', 'B']" :key="side" class="team" :class="{ won: form.result === side, lost: form.result && form.result !== side }">
        <div class="team-head">
          <span>Team {{ side }}</span>
          <span class="hands-label">Hands won</span>
        </div>
        <div v-for="(s, i) in form[side]" :key="i" class="seat">
          <select v-model="s.id" class="input">
            <option value="" disabled>Player</option>
            <option v-for="p in optionsFor(s)" :key="p.id" :value="p.id">{{ p.name }} · {{ p.rating }}</option>
          </select>
          <input v-model="s.hands" type="number" min="0" class="input hands" placeholder="0" />
        </div>
        <button type="button" class="btn win" :class="{ on: form.result === side }" @click="form.result = side">
          {{ form.result === side ? 'Winner' : 'Mark as winner' }}
        </button>
      </div>
    </div>

    <label class="field"><span>Notes</span><input v-model="form.notes" class="input" maxlength="500" /></label>

    <div v-if="preview" class="preview">
      <span class="muted">Team A {{ Math.round(preview.expectedA) }}% to win</span>
      <span v-for="p in [...preview.teamA, ...preview.teamB]" :key="p.id" class="num">
        {{ p.name }} <span :class="cls(p.delta)">{{ signed(Math.round(p.delta)) }}</span>
      </span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="actions">
      <button class="btn primary" :disabled="!ready || busy">Add game</button>
    </div>
  </form>

  <h2>History</h2>
  <p v-if="!games.length" class="empty">No games yet</p>
  <GameTable v-else :games="games" deletable @delete="remove" />
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.field.date {
  align-self: flex-start;
}
.teams {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.team {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 6px;
  background: var(--hover);
}
.team.won {
  background: var(--green-bg);
}
.team-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.team.won .team-head {
  color: var(--green);
}
.hands-label {
  font-weight: 400;
  width: 64px;
}
.seat {
  display: flex;
  gap: 6px;
}
.seat select {
  flex: 1;
}
.hands {
  width: 64px;
}
.win {
  margin-top: 2px;
  color: var(--text-2);
}
.win.on {
  color: var(--green);
  border-color: transparent;
  font-weight: 500;
}
.preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg-sidebar);
}
.actions {
  display: flex;
  justify-content: flex-end;
}
@media (max-width: 560px) {
  .teams {
    grid-template-columns: 1fr;
  }
}
</style>

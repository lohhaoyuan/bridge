<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { api, getMeta, signed } from '../api.js';
import GameTabs from './GameTabs.vue';
import MatchCard from './MatchCard.vue';

const today = () => new Date().toLocaleDateString('en-CA');
const seat = () => ({ id: '', hands: '', value: '' });

function blank(game, playedAt = today()) {
  const base = { playedAt, notes: '' };
  if (!game) return base;
  if (game.kind === 'bridge') return { ...base, A: [seat(), seat()], B: [seat(), seat()], result: '' };
  if (game.kind === 'mahjong') return { ...base, rows: [seat(), seat(), seat(), seat()], winner: '', winType: 'self', shooter: '', tai: 1 };
  return { ...base, rows: Array.from({ length: Math.max(game.min, Math.min(4, game.max)) }, seat) };
}

// Loads a recorded match back into the form shape for its game.
function fromMatch(m, game) {
  const base = { playedAt: m.playedAt, notes: m.notes ?? '' };
  const row = (p) => ({ id: p.id, hands: p.hands ?? '', value: p.value ?? '' });
  if (game.kind === 'bridge') return { ...base, A: m.teamA.map(row), B: m.teamB.map(row), result: m.result };
  if (game.kind === 'mahjong') {
    return {
      ...base,
      rows: m.players.map(row),
      winner: m.players.find((p) => p.role === 'winner')?.id ?? '',
      winType: m.details.winType,
      shooter: m.players.find((p) => p.role === 'shooter')?.id ?? '',
      tai: m.details.tai,
    };
  }
  return { ...base, rows: m.players.map((p, i) => ({ ...row(p), value: i === 0 ? '' : (p.value ?? '') })) };
}

const games = ref([]);
const type = ref('bridge');
const editing = ref(null); // the match being edited, or null when adding
let pendingEdit = null;
const formEl = ref(null);
const game = computed(() => games.value.find((g) => g.key === type.value));
const byKey = computed(() => Object.fromEntries(games.value.map((g) => [g.key, g])));
const form = ref(blank());
const players = ref([]);
const history = ref([]);
const preview = ref(null);
const error = ref('');
const busy = ref(false);

async function loadHistory() {
  history.value = await api(`/games?game=${type.value}`);
}

onMounted(async () => {
  try {
    const [meta, p] = await Promise.all([getMeta(), api('/players')]);
    games.value = meta.games;
    players.value = p.sort((a, b) => a.name.localeCompare(b.name));
    form.value = blank(game.value);
    await loadHistory();
  } catch (e) {
    error.value = e.message;
  }
});

watch(type, async () => {
  form.value = pendingEdit ? fromMatch(pendingEdit, game.value) : blank(game.value, form.value.playedAt);
  if (!pendingEdit) editing.value = null;
  pendingEdit = null;
  preview.value = null;
  error.value = '';
  await loadHistory().catch((e) => (error.value = e.message));
});

// Every seat that holds a player in the current form.
const seats = computed(() => (game.value?.kind === 'bridge' ? [...form.value.A, ...form.value.B] : form.value.rows ?? []));
const chosen = computed(() => seats.value.filter((s) => s.id !== '').map((s) => s.id));
// Active players, plus whoever already sits here (so editing an old game with a
// since-deactivated player still shows them).
const optionsFor = (s) => {
  const taken = new Set(seats.value.filter((x) => x !== s).map((x) => x.id));
  return players.value.filter((p) => !taken.has(p.id) && (p.active || p.id === s.id));
};
const ratingIn = (p) => p.byGame[type.value]?.rating ?? '—';
const nameOf = (id) => players.value.find((p) => p.id === id)?.name ?? '';

const addRow = () => form.value.rows.push(seat());
const removeRow = (i) => form.value.rows.splice(i, 1);
function move(i, dir) {
  const rows = form.value.rows;
  const j = i + dir;
  if (j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
}

const payload = computed(() => {
  const f = form.value;
  const base = { type: type.value, playedAt: f.playedAt, notes: f.notes.trim(), editing: editing.value?.uid };
  const kind = game.value?.kind;
  if (kind === 'bridge') {
    return {
      ...base,
      result: f.result,
      teamA: f.A.map((s) => ({ id: s.id, hands: s.hands })),
      teamB: f.B.map((s) => ({ id: s.id, hands: s.hands })),
    };
  }
  if (kind === 'mahjong') {
    return { ...base, players: f.rows.map((s) => ({ id: s.id })), winner: f.winner, winType: f.winType, shooter: f.shooter, tai: f.tai };
  }
  return { ...base, players: (f.rows ?? []).map((s) => ({ id: s.id, value: s.value })) };
});

const ready = computed(() => {
  const f = form.value;
  const g = game.value;
  if (!g || !f.playedAt || seats.value.some((s) => s.id === '')) return false;
  if (g.kind === 'bridge') return !!f.result;
  if (seats.value.length < g.min || seats.value.length > g.max) return false;
  if (g.kind === 'mahjong') return chosen.value.includes(f.winner) && (f.winType === 'self' || (chosen.value.includes(f.shooter) && f.shooter !== f.winner));
  return true;
});

let timer;
watch(
  payload,
  (body) => {
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
  },
  { deep: true },
);

const previewPlayers = computed(() => (preview.value ? (preview.value.players ?? [...preview.value.teamA, ...preview.value.teamB]) : []));

async function startEdit(m) {
  error.value = '';
  editing.value = m;
  if (m.type !== type.value) {
    pendingEdit = m; // the type watcher fills the form once the tab switches
    type.value = m.type;
  } else {
    form.value = fromMatch(m, game.value);
  }
  await nextTick();
  formEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
  editing.value = null;
  form.value = blank(game.value, form.value.playedAt);
  preview.value = null;
  error.value = '';
}

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    if (editing.value) {
      await api(`/games/${editing.value.uid}`, { method: 'PUT', body: payload.value });
      editing.value = null;
    } else {
      await api('/games', { method: 'POST', body: payload.value });
    }
    form.value = blank(game.value, form.value.playedAt);
    preview.value = null;
    await loadHistory();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function remove(m) {
  const names = (m.players ?? [...m.teamA, ...m.teamB]).map((p) => p.name).join(', ');
  if (!confirm(`Delete this ${byKey.value[m.type].name} game from ${m.playedAt} (${names})? Ratings will be recalculated.`)) return;
  try {
    await api(`/games/${m.uid}`, { method: 'DELETE' });
    if (editing.value?.uid === m.uid) cancelEdit();
    await loadHistory();
  } catch (e) {
    error.value = e.message;
  }
}

const cls = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'faint');
const placeLabel = (i) => (game.value.kind === 'winner' ? (i === 0 ? 'Winner' : '') : `${i + 1}${['st', 'nd', 'rd'][i] ?? 'th'}`);
</script>

<template>
  <GameTabs v-if="games.length" v-model="type" :games="games" />

  <form v-if="game" ref="formEl" class="card" :class="{ editing }" @submit.prevent="submit">
    <div v-if="editing" class="edit-banner">
      <span>Editing {{ game.name }} game from {{ editing.playedAt }}</span>
      <button type="button" class="btn ghost" @click="cancelEdit">Cancel</button>
    </div>
    <label class="field date"><span>Date</span><input v-model="form.playedAt" type="date" class="input" required /></label>

    <!-- Bridge: two pairs -->
    <div v-if="game.kind === 'bridge'" class="teams">
      <div v-for="side in ['A', 'B']" :key="side" class="team" :class="{ won: form.result === side }">
        <div class="team-head">
          <span>Team {{ side }}</span>
          <span class="col-label">Hands won</span>
        </div>
        <div v-for="(s, i) in form[side]" :key="i" class="seat">
          <select v-model="s.id" class="input">
            <option value="" disabled>Player</option>
            <option v-for="p in optionsFor(s)" :key="p.id" :value="p.id">{{ p.name }} · {{ ratingIn(p) }}</option>
          </select>
          <input v-model="s.hands" type="number" min="0" class="input small" placeholder="0" />
        </div>
        <button type="button" class="btn win" :class="{ on: form.result === side }" @click="form.result = side">
          {{ form.result === side ? 'Winner' : 'Mark as winner' }}
        </button>
      </div>
    </div>

    <!-- Mahjong: one hand -->
    <template v-else-if="game.kind === 'mahjong'">
      <div class="rows">
        <div class="row-head"><span>Players</span></div>
        <div v-for="(s, i) in form.rows" :key="i" class="seat" :class="{ won: s.id !== '' && s.id === form.winner }">
          <select v-model="s.id" class="input">
            <option value="" disabled>Player</option>
            <option v-for="p in optionsFor(s)" :key="p.id" :value="p.id">{{ p.name }} · {{ ratingIn(p) }}</option>
          </select>
          <button v-if="form.rows.length > game.min" type="button" class="btn ghost icon" title="Remove" @click="removeRow(i)">✕</button>
        </div>
        <button v-if="form.rows.length < game.max" type="button" class="btn ghost add" @click="addRow">+ Add player</button>
      </div>
      <div class="inline">
        <label class="field">
          <span>Winner</span>
          <select v-model="form.winner" class="input">
            <option value="" disabled>Pick</option>
            <option v-for="id in chosen" :key="id" :value="id">{{ nameOf(id) }}</option>
          </select>
        </label>
        <div class="field">
          <span>How</span>
          <div class="seg">
            <button type="button" :class="{ on: form.winType === 'self' }" @click="form.winType = 'self'">Self-drawn</button>
            <button type="button" :class="{ on: form.winType === 'discard' }" @click="form.winType = 'discard'">Discard</button>
          </div>
        </div>
        <label v-if="form.winType === 'discard'" class="field">
          <span>Discarded by</span>
          <select v-model="form.shooter" class="input">
            <option value="" disabled>Pick</option>
            <option v-for="id in chosen.filter((x) => x !== form.winner)" :key="id" :value="id">{{ nameOf(id) }}</option>
          </select>
        </label>
        <label class="field">
          <span>Tai</span>
          <input v-model.number="form.tai" type="number" min="1" max="20" class="input small" />
        </label>
      </div>
    </template>

    <!-- Everyone else: finishing order -->
    <div v-else class="rows">
      <div class="row-head">
        <span>{{ game.kind === 'winner' ? 'Winner first, then everyone else' : 'Finishing order' }}</span>
        <span v-if="game.value" class="col-label">{{ game.value }}</span>
      </div>
      <div v-for="(s, i) in form.rows" :key="i" class="seat" :class="{ won: i === 0 }">
        <span class="place">{{ placeLabel(i) }}</span>
        <select v-model="s.id" class="input">
          <option value="" disabled>Player</option>
          <option v-for="p in optionsFor(s)" :key="p.id" :value="p.id">{{ p.name }} · {{ ratingIn(p) }}</option>
        </select>
        <input v-if="game.value" v-model="s.value" type="number" min="0" :max="game.valueMax" class="input small" :placeholder="i === 0 ? '0' : '–'" :disabled="i === 0" />
        <template v-if="game.kind === 'order'">
          <button type="button" class="btn ghost icon" title="Move up" :disabled="i === 0" @click="move(i, -1)">↑</button>
          <button type="button" class="btn ghost icon" title="Move down" :disabled="i === form.rows.length - 1" @click="move(i, 1)">↓</button>
        </template>
        <button v-if="form.rows.length > game.min" type="button" class="btn ghost icon" title="Remove" @click="removeRow(i)">✕</button>
      </div>
      <button v-if="form.rows.length < game.max" type="button" class="btn ghost add" @click="addRow">+ Add player</button>
    </div>

    <label class="field"><span>Notes</span><input v-model="form.notes" class="input" maxlength="500" /></label>

    <div v-if="preview" class="preview">
      <span v-if="preview.expectedA != null" class="muted">Team A {{ Math.round(preview.expectedA) }}% to win</span>
      <span v-for="p in previewPlayers" :key="p.id" class="num">
        {{ p.name }} <span :class="cls(p.delta)">{{ signed(Math.round(p.delta)) }}</span>
      </span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="actions">
      <button class="btn primary" :disabled="!ready || busy">{{ editing ? 'Save changes' : `Add ${game.name} game` }}</button>
    </div>
  </form>

  <h2>History</h2>
  <p v-if="!history.length" class="empty">No games yet</p>
  <MatchCard
    v-for="m in history"
    v-else
    :key="m.uid"
    :match="m"
    :games="byKey"
    deletable
    :editing="editing?.uid === m.uid"
    @edit="startEdit"
    @delete="remove"
  />
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  scroll-margin-top: 72px;
}
.card.editing {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus);
}
.edit-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: -6px -6px 0;
  padding: 6px 6px 6px 10px;
  border-radius: 6px;
  background: var(--hl);
  color: var(--hl-text);
  font-weight: 500;
  font-size: 13px;
}
.field.date {
  align-self: flex-start;
}
.teams {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.team,
.rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 6px;
  background: var(--hover);
}
.team.won {
  background: var(--hl);
}
.team-head,
.row-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.team.won .team-head {
  color: var(--hl-text);
}
.col-label {
  font-weight: 400;
  width: 72px;
}
.seat {
  display: flex;
  gap: 6px;
  align-items: center;
  border-radius: 6px;
}
.rows .seat.won {
  background: var(--hl);
  margin: 0 -4px;
  padding: 0 4px;
}
.seat select {
  flex: 1;
  min-width: 0;
}
.small {
  width: 72px;
}
.place {
  width: 52px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.won .place {
  color: var(--hl-text);
}
.icon {
  width: 28px;
  padding: 0;
  flex-shrink: 0;
}
.add {
  align-self: flex-start;
}
.win {
  margin-top: 2px;
  color: var(--text-2);
}
.win.on {
  color: var(--hl-text);
  border-color: transparent;
  font-weight: 500;
}
.inline {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}
.seg {
  display: inline-flex;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  overflow: hidden;
  height: 32px;
}
.seg button {
  border: 0;
  background: none;
  padding: 0 10px;
  cursor: pointer;
  color: var(--text-2);
  white-space: nowrap;
}
.seg button + button {
  border-left: 1px solid var(--border-strong);
}
.seg button.on {
  background: var(--hl);
  color: var(--hl-text);
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
  .small {
    width: 56px;
  }
  .place {
    width: 44px;
  }
}
</style>

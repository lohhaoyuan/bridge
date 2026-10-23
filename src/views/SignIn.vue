<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { auth, getMeta, signInWith, acceptToken } from '../api.js';

const router = useRouter();
const route = useRoute();
const meta = ref(null);
const devEmail = ref('');
const error = ref('');
const busy = ref(false);

const next = computed(() => {
  const n = route.query.next;
  return typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/me';
});
const googleHref = computed(() => `/api/auth/google/start?next=${encodeURIComponent(next.value)}`);

async function devSignIn() {
  error.value = '';
  try {
    await signInWith('/auth/dev', { email: devEmail.value });
    router.replace(next.value);
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(async () => {
  // Coming back from Google: #token=…&next=… or #error=…
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.has('token') || params.has('error')) {
    history.replaceState(null, '', location.pathname + location.search);
    if (params.has('error')) error.value = params.get('error');
    else {
      busy.value = true;
      await acceptToken(params.get('token'));
      if (auth.account) return router.replace(params.get('next') || '/me');
      busy.value = false;
      error.value = 'Sign-in failed, please try again';
    }
  } else if (auth.account) {
    return router.replace(next.value);
  }
  meta.value = await getMeta();
});
</script>

<template>
  <h1>Sign in</h1>

  <p v-if="busy" class="muted">Signing in…</p>
  <div v-else-if="meta">
    <a v-if="meta.googleEnabled" :href="googleHref" class="google" @click="busy = true">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Continue with Google
    </a>
    <p v-else-if="!meta.devLogin" class="error">Google sign-in isn't configured.</p>

    <form v-if="meta.devLogin" class="dev" @submit.prevent="devSignIn">
      <span class="tag">Dev only</span>
      <input v-model="devEmail" class="input" type="email" placeholder="Email" />
      <button class="btn" :disabled="!devEmail">Sign in</button>
    </form>
  </div>

  <p v-if="error" class="error">{{ error }}</p>
</template>

<style scoped>
.google {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 18px 0 14px;
  border-radius: 999px;
  border: 1px solid var(--hl-strong);
  background: var(--hl-soft);
  color: var(--text);
  font-weight: 500;
  transition: background 0.15s, border-color 0.15s;
}
.google:hover {
  background: var(--hl);
  border-color: var(--accent);
}
.google:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus);
}
.google svg {
  width: 18px;
  height: 18px;
}
.dev {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 420px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.dev .input {
  flex: 1;
}
</style>

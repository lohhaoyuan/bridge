<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { auth, getMeta, signInWith } from '../api.js';

const router = useRouter();
const route = useRoute();
const meta = ref(null);
const button = ref(null);
const devEmail = ref('');
const error = ref('');

const done = () => router.replace(route.query.next || '/me');

async function handle(path, body) {
  error.value = '';
  try {
    await signInWith(path, body);
    done();
  } catch (e) {
    error.value = e.message;
  }
}

function loadGoogle() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
}

onMounted(async () => {
  if (auth.account) return done();
  meta.value = await getMeta();
  if (!meta.value.googleClientId) return;
  try {
    await loadGoogle();
    window.google.accounts.id.initialize({
      client_id: meta.value.googleClientId,
      callback: ({ credential }) => handle('/auth/google', { credential }),
    });
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    window.google.accounts.id.renderButton(button.value, { theme: dark ? 'filled_black' : 'outline', size: 'large', shape: 'pill' });
  } catch (e) {
    error.value = e.message;
  }
});

watch(() => auth.account, (a) => a && done());
</script>

<template>
  <h1>Sign in</h1>
  <div ref="button" class="google"></div>
  <p v-if="meta && !meta.googleClientId && !meta.devLogin" class="error">Google sign-in isn't configured (GOOGLE_CLIENT_ID).</p>

  <form v-if="meta?.devLogin" class="dev" @submit.prevent="handle('/auth/dev', { email: devEmail })">
    <span class="tag">Dev only</span>
    <input v-model="devEmail" class="input" type="email" placeholder="Email" />
    <button class="btn" :disabled="!devEmail">Sign in</button>
  </form>

  <p v-if="error" class="error">{{ error }}</p>
</template>

<style scoped>
.google {
  min-height: 44px;
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

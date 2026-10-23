<script setup>
import { useRouter } from 'vue-router';
import { auth, signOut } from './api.js';

const router = useRouter();

async function out() {
  await signOut();
  router.push('/');
}
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <RouterLink to="/" class="brand"><span class="logo">♠</span> Bridge Elo</RouterLink>
      <nav>
        <RouterLink to="/" class="item" exact-active-class="on">Leaderboard</RouterLink>
        <RouterLink to="/games" class="item" active-class="on">Games</RouterLink>
        <RouterLink v-if="auth.account" to="/me" class="item" active-class="on">Me</RouterLink>
        <RouterLink v-if="auth.account?.isAdmin" to="/admin" class="item" active-class="on">Admin</RouterLink>
      </nav>
      <div v-if="auth.ready" class="account">
        <template v-if="auth.account">
          <RouterLink to="/me" class="who">
            <img v-if="auth.account.picture" :src="auth.account.picture" alt="" referrerpolicy="no-referrer" />
            <span v-else class="initial">{{ (auth.account.player?.name || auth.account.email)[0].toUpperCase() }}</span>
            <span class="label">{{ auth.account.player?.name || auth.account.email }}</span>
          </RouterLink>
          <button class="btn ghost" @click="out">Sign out</button>
        </template>
        <RouterLink v-else to="/signin" class="item">Sign in</RouterLink>
      </div>
    </aside>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 224px;
  flex-shrink: 0;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  padding: 12px 8px;
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  padding: 6px 10px 14px;
}

.logo {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--mint);
  color: var(--mint-text);
  font-size: 13px;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.item {
  padding: 4px 10px;
  border-radius: 6px;
  color: var(--text-2);
  font-weight: 500;
  white-space: nowrap;
}

.item:hover {
  background: var(--hover);
}

.item.on {
  background: var(--mint);
  color: var(--mint-text);
}

.account {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.who {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  min-width: 0;
}

.who:hover {
  background: var(--hover);
}

.who img,
.initial {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.initial {
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 600;
  background: var(--gray-bg);
}

.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.account .btn {
  align-self: flex-start;
  margin-left: 2px;
}

.main {
  flex: 1;
  min-width: 0;
  padding: 72px 48px 96px;
  max-width: 1000px;
  margin: 0 auto;
}

@media (max-width: 720px) {
  .app {
    flex-direction: column;
  }
  .sidebar {
    width: auto;
    height: auto;
    position: static;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
    padding: 8px;
  }
  .brand {
    padding: 4px 8px;
  }
  nav {
    flex-direction: row;
    overflow-x: auto;
  }
  .account {
    margin: 0 0 0 auto;
    flex-direction: row;
    align-items: center;
  }
  .who .label {
    display: none;
  }
  .main {
    padding: 32px 16px 64px;
    width: 100%;
  }
}
</style>

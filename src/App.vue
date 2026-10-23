<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { auth, signOut } from './api.js';

const router = useRouter();

const ICONS = {
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3v1a3 3 0 0 1-3 3M7 6H4v1a3 3 0 0 0 3 3',
  list: 'M4 6h16M4 12h16M4 18h11',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  shield: 'M12 3l7.5 3v5.5c0 4.7-3.2 8.1-7.5 9.5-4.3-1.4-7.5-4.8-7.5-9.5V6L12 3z',
};

const links = computed(() =>
  [
    { to: '/', label: 'Leaderboard', icon: ICONS.trophy },
    { to: '/games', label: 'Games', icon: ICONS.list },
    auth.account && { to: '/me', label: 'Me', icon: ICONS.user },
    auth.account?.isAdmin && { to: '/admin', label: 'Admin', icon: ICONS.shield },
  ].filter(Boolean),
);

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
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="item"
          exact-active-class="on"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="l.icon" /></svg>
          <span>{{ l.label }}</span>
        </RouterLink>
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
        <RouterLink v-else to="/signin" class="item signin">Sign in</RouterLink>
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
  white-space: nowrap;
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
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  color: var(--text-2);
  font-weight: 500;
  white-space: nowrap;
}

.item svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
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

/* Phones: slim top bar for brand + account, bottom tab bar for navigation. */
@media (max-width: 720px) {
  .app {
    flex-direction: column;
  }
  .sidebar {
    width: auto;
    height: auto;
    position: sticky;
    z-index: 10;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    border-right: 0;
    border-bottom: 1px solid var(--border);
    padding: 8px 12px;
    padding-top: calc(8px + env(safe-area-inset-top));
  }
  .brand {
    padding: 4px 0;
  }
  nav {
    position: fixed;
    z-index: 10;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 0;
    background: var(--bg-sidebar);
    border-top: 1px solid var(--border);
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  }
  .item {
    flex-direction: column;
    gap: 2px;
    padding: 6px 4px;
    font-size: 11px;
    border-radius: 10px;
  }
  .item svg {
    width: 20px;
    height: 20px;
  }
  .account {
    margin: 0;
    flex-direction: row;
    align-items: center;
    gap: 4px;
  }
  .who {
    padding: 4px;
  }
  .who img,
  .initial {
    width: 26px;
    height: 26px;
  }
  .who .label {
    display: none;
  }
  .account .btn {
    margin: 0;
  }
  .signin {
    flex-direction: row;
    font-size: 14px;
    background: var(--mint);
    color: var(--mint-text);
    padding: 4px 12px;
  }
  .main {
    padding: 28px 16px calc(96px + env(safe-area-inset-bottom));
    width: 100%;
  }
}
</style>

import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import Leaderboard from './views/Leaderboard.vue';
import Games from './views/Games.vue';
import Player from './views/Player.vue';
import Me from './views/Me.vue';
import SignIn from './views/SignIn.vue';
import Admin from './views/Admin.vue';
import { auth, loadAccount } from './api.js';
import './style.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Leaderboard, meta: { title: 'Leaderboard' } },
    { path: '/games', component: Games, meta: { title: 'Games' } },
    { path: '/players/:id', component: Player, props: true, meta: { title: 'Player' } },
    { path: '/me', component: Me, meta: { title: 'Me', signedIn: true } },
    { path: '/signin', component: SignIn, meta: { title: 'Sign in' } },
    { path: '/admin', component: Admin, meta: { title: 'Admin', admin: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

const accountReady = loadAccount();

router.beforeEach(async (to) => {
  await accountReady;
  if ((to.meta.signedIn || to.meta.admin) && !auth.account) return { path: '/signin', query: { next: to.fullPath } };
  if (to.meta.admin && !auth.account.isAdmin) return '/';
});

router.afterEach((to) => (document.title = `${to.meta.title} · Bridge Elo`));

createApp(App).use(router).mount('#app');

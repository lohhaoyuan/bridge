import { reactive, watch } from 'vue';

// Per-device appearance preferences. index.html applies the saved ones before
// the app loads (same storage key and attributes), so there's no flash.
const KEY = 'appearance';

export const THEMES = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

// [key, label, swatch hue, swatch saturation scale]
export const ACCENTS = [
  ['pink', 'Pink', 327, 1],
  ['purple', 'Purple', 268, 1],
  ['blue', 'Blue', 212, 1],
  ['teal', 'Teal', 178, 1],
  ['green', 'Green', 145, 1],
  ['orange', 'Orange', 24, 1],
  ['graphite', 'Graphite', 220, 0.12],
];

export const FONTS = [
  ['default', 'Default'],
  ['serif', 'Serif'],
  ['mono', 'Mono'],
  ['rounded', 'Rounded'],
];

export const SIZES = [
  ['small', 'Small', 0.92],
  ['default', 'Default', 1],
  ['large', 'Large', 1.1],
];

const DEFAULTS = { theme: 'system', accent: 'pink', font: 'default', size: 'default' };

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const prefs = reactive(load());

// Nunito is the fallback for "Rounded" where the system has no rounded font.
function loadRoundedFont() {
  if (document.getElementById('font-rounded')) return;
  const link = document.createElement('link');
  link.id = 'font-rounded';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}

function apply() {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.accent = prefs.accent;
  root.dataset.font = prefs.font;
  root.style.setProperty('--zoom', SIZES.find(([k]) => k === prefs.size)?.[2] ?? 1);
  if (prefs.font === 'rounded') loadRoundedFont();
  // Match the browser/phone UI chrome to the sidebar colour.
  requestAnimationFrame(() => {
    const el = document.querySelector('.sidebar') ?? document.body;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(el).backgroundColor);
  });
}

export function resetPrefs() {
  Object.assign(prefs, DEFAULTS);
}

apply();
watch(prefs, () => {
  apply();
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);

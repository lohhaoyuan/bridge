<script setup>
import { prefs, THEMES, ACCENTS, FONTS, SIZES, resetPrefs } from '../prefs.js';

const FONT_PREVIEW = {
  default: "ui-sans-serif, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  rounded: "ui-rounded, 'SF Pro Rounded', Nunito, system-ui, sans-serif",
};
</script>

<template>
  <h1>Settings</h1>

  <section>
    <h2>Theme</h2>
    <div class="cards">
      <button v-for="[key, label] in THEMES" :key="key" class="card" :class="{ on: prefs.theme === key }" @click="prefs.theme = key">
        <span class="preview" :class="key">
          <span class="bar"></span>
          <span class="line"></span>
          <span class="line short"></span>
        </span>
        <span>{{ label }}</span>
      </button>
    </div>
  </section>

  <section>
    <h2>Accent</h2>
    <div class="swatches">
      <button
        v-for="[key, label, h, s] in ACCENTS"
        :key="key"
        class="swatch"
        :class="{ on: prefs.accent === key }"
        :title="label"
        :aria-label="label"
        :aria-pressed="prefs.accent === key"
        @click="prefs.accent = key"
      >
        <span class="dot" :style="{ background: `hsl(${h} ${57 * s}% 62%)` }"></span>
        <span class="name">{{ label }}</span>
      </button>
    </div>
  </section>

  <section>
    <h2>Font</h2>
    <div class="cards">
      <button v-for="[key, label] in FONTS" :key="key" class="card" :class="{ on: prefs.font === key }" @click="prefs.font = key">
        <span class="sample" :style="{ fontFamily: FONT_PREVIEW[key] }">Ag</span>
        <span>{{ label }}</span>
      </button>
    </div>
  </section>

  <section>
    <h2>Text size</h2>
    <div class="seg">
      <button v-for="[key, label] in SIZES" :key="key" :class="{ on: prefs.size === key }" @click="prefs.size = key">{{ label }}</button>
    </div>
  </section>

  <button class="btn ghost reset" @click="resetPrefs">Reset to defaults</button>
</template>

<style scoped>
section {
  margin-bottom: 28px;
}
h2 {
  margin: 0 0 10px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(116px, 1fr));
  gap: 10px;
  max-width: 560px;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--bg);
  cursor: pointer;
  color: var(--text-2);
  font-weight: 500;
  font-size: 13px;
}
.card:hover {
  background: var(--hl-soft);
}
.card.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus);
  color: var(--text);
}

/* Mini window previews for the theme cards. */
.preview {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  height: 58px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
}
.preview .bar {
  width: 40%;
  height: 7px;
  border-radius: 3px;
  background: var(--accent);
}
.preview .line {
  height: 5px;
  border-radius: 3px;
  background: rgba(55, 53, 47, 0.18);
}
.preview .line.short {
  width: 60%;
}
.preview.dark {
  background: #191919;
  border-color: rgba(255, 255, 255, 0.1);
}
.preview.dark .line {
  background: rgba(255, 255, 255, 0.2);
}
.preview.system {
  background: linear-gradient(135deg, #fff 50%, #191919 50%);
}
.preview.system .line {
  background: rgba(128, 128, 128, 0.4);
}

.sample {
  font-size: 26px;
  line-height: 1.1;
  color: var(--text);
  padding: 6px 0 2px;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 64px;
  padding: 8px 4px;
  border: 0;
  border-radius: 10px;
  background: none;
  cursor: pointer;
  color: var(--text-2);
  font-size: 12px;
}
.swatch:hover {
  background: var(--hover);
}
.dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}
.swatch.on .dot {
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}
.swatch.on {
  color: var(--text);
  font-weight: 500;
}

.seg {
  display: inline-flex;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  overflow: hidden;
}
.seg button {
  border: 0;
  background: none;
  padding: 6px 14px;
  cursor: pointer;
  color: var(--text-2);
}
.seg button + button {
  border-left: 1px solid var(--border-strong);
}
.seg button:hover {
  background: var(--hover);
}
.seg button.on {
  background: var(--hl);
  color: var(--hl-text);
  font-weight: 500;
}
.reset {
  margin-left: -8px;
}
@media (max-width: 560px) {
  .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

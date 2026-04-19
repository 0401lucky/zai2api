<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useBootstrapStore } from '@/stores/bootstrap'
import MetaPill from './MetaPill.vue'

const bootstrap = useBootstrapStore()
const { heroTitle, summaryText, panelSource, apiSource, apiEnabled } = storeToRefs(bootstrap)

function sourceLabel(source: string | null | undefined): string {
  switch (source) {
    case 'env':
      return '环境变量'
    case 'database':
      return '后台设置'
    case 'default':
      return '默认值'
    case 'disabled':
      return '未启用'
    default:
      return String(source ?? '未知')
  }
}

const panelText = computed(() => `面板密码 · ${sourceLabel(panelSource.value)}`)
const apiText = computed(() => {
  if (!apiEnabled.value) return 'API 密码 · 未启用'
  return `API 密码 · ${sourceLabel(apiSource.value)}`
})
</script>

<template>
  <section class="hero">
    <div class="hero-main">
      <div class="eyebrow">Workers / D1 / Assets</div>
      <h2>{{ heroTitle }}</h2>
      <p class="hero-copy">{{ summaryText }}</p>
    </div>
    <div class="hero-meta">
      <MetaPill tone="accent">{{ panelText }}</MetaPill>
      <MetaPill :tone="apiEnabled ? 'info' : 'muted'">{{ apiText }}</MetaPill>
    </div>
  </section>
</template>

<style scoped>
.hero {
  padding: 28px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow);
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.hero-main {
  min-width: 0;
  flex: 1 1 320px;
}

h2 {
  margin-top: 6px;
  font-size: 24px;
}

.hero-copy {
  margin-top: 10px;
  color: var(--muted);
  line-height: 1.7;
}

.eyebrow {
  color: var(--muted);
  font-size: 11.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>

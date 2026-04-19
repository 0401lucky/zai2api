<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useBootstrapStore, type ViewKey } from '@/stores/bootstrap'
import { useToastStore } from '@/stores/toast'
import { api, ApiError } from '@/api/client'
import Button from './Button.vue'

const bootstrap = useBootstrapStore()
const toast = useToastStore()
const { currentView, loggedIn, summaryText } = storeToRefs(bootstrap)

interface NavItem {
  key: ViewKey
  label: string
  hint: string
}

const nav: NavItem[] = [
  { key: 'accounts', label: '账号', hint: '账号池与游客来源' },
  { key: 'security', label: '安全', hint: '密码与保留策略' },
  { key: 'logs', label: '日志', hint: '最近运行记录' },
]

async function handleLogout() {
  try {
    await api.logout()
    toast.success('已退出后台')
    await bootstrap.refresh()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '退出失败'
    toast.error(message)
  }
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">Z</div>
      <div class="brand-text">
        <div class="eyebrow">Cloudflare Native</div>
        <h1>zai2api 控制台</h1>
      </div>
    </div>

    <p class="sidebar-copy">
      面向长期部署的账号代理后台。管理 JWT、账号池、安全设置与运行日志。
    </p>

    <section class="status-card">
      <div class="status-label">状态</div>
      <div class="status-value">{{ summaryText }}</div>
    </section>

    <nav v-if="loggedIn" class="nav" aria-label="主导航">
      <button
        v-for="item in nav"
        :key="item.key"
        type="button"
        :class="['nav-button', { active: currentView === item.key }]"
        :aria-current="currentView === item.key ? 'page' : undefined"
        @click="bootstrap.setView(item.key)"
      >
        <span class="nav-label">{{ item.label }}</span>
        <span class="nav-hint">{{ item.hint }}</span>
      </button>
    </nav>

    <div v-if="loggedIn" class="footer">
      <Button variant="danger" block @click="handleLogout">退出后台</Button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  padding: 28px;
  border-right: 1px solid var(--line);
  background: rgba(255, 248, 236, 0.76);
  backdrop-filter: blur(18px);
  display: grid;
  grid-template-rows: auto auto auto 1fr auto;
  gap: 24px;
  min-height: 100vh;
}

.brand {
  display: flex;
  gap: 16px;
  align-items: center;
}

.brand-mark {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #2f2413 0%, #0d6f63 100%);
  color: #fff7ea;
  font-size: 24px;
  font-weight: 700;
  box-shadow: 0 10px 30px rgba(13, 111, 99, 0.32);
  flex-shrink: 0;
}

.brand-text {
  min-width: 0;
}

h1 {
  margin-top: 6px;
  font-size: 18px;
}

.eyebrow {
  color: var(--muted);
  font-size: 11.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.sidebar-copy {
  line-height: 1.7;
  color: var(--muted);
  font-size: 13.5px;
}

.status-card {
  padding: 16px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--panel-strong);
  box-shadow: var(--shadow-sm);
}

.status-label {
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.status-value {
  margin-top: 8px;
  line-height: 1.6;
  font-size: 13.5px;
}

.nav {
  display: grid;
  gap: 8px;
}

.nav-button {
  display: grid;
  gap: 4px;
  padding: 13px 16px;
  text-align: left;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.nav-button:hover {
  background: var(--panel-muted);
  border-color: var(--line-strong);
}

.nav-button.active {
  background: var(--panel-strong);
  border-color: var(--line-strong);
  box-shadow: var(--shadow-sm);
}

.nav-label {
  font-weight: 600;
  font-size: 14px;
}

.nav-hint {
  color: var(--muted);
  font-size: 12px;
}

.footer {
  align-self: end;
}

@media (max-width: 980px) {
  .sidebar {
    min-height: auto;
    grid-template-rows: none;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
}
</style>

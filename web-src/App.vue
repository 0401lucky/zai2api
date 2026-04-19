<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ApiError } from '@/api/client'
import { useBootstrapStore } from '@/stores/bootstrap'
import { useToastStore } from '@/stores/toast'
import AppShell from '@/components/AppShell.vue'
import Toast from '@/components/Toast.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import SetupView from '@/views/SetupView.vue'
import LoginView from '@/views/LoginView.vue'
import AccountsView from '@/views/AccountsView.vue'
import SecurityView from '@/views/SecurityView.vue'
import LogsView from '@/views/LogsView.vue'

const bootstrap = useBootstrapStore()
const toast = useToastStore()
const { initializing, loggedIn, setupRequired, currentView } = storeToRefs(bootstrap)

type AppMode = 'loading' | 'setup' | 'login' | 'main'

const mode = computed<AppMode>(() => {
  if (initializing.value && !bootstrap.data) return 'loading'
  if (setupRequired.value) return 'setup'
  if (!loggedIn.value) return 'login'
  return 'main'
})

onMounted(async () => {
  try {
    await bootstrap.refresh()
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '读取后台状态失败'
    toast.error(message)
  }
})
</script>

<template>
  <div v-if="mode === 'loading'" class="boot">
    <div class="boot-inner">
      <div class="spinner" aria-hidden="true" />
      <p>正在读取后台状态…</p>
    </div>
  </div>

  <AppShell v-else>
    <SetupView v-if="mode === 'setup'" />
    <LoginView v-else-if="mode === 'login'" />
    <template v-else>
      <AccountsView v-if="currentView === 'accounts'" />
      <SecurityView v-else-if="currentView === 'security'" />
      <LogsView v-else-if="currentView === 'logs'" />
    </template>
  </AppShell>

  <Toast />
  <ConfirmDialog />
</template>

<style scoped>
.boot {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 40px;
}

.boot-inner {
  display: grid;
  justify-items: center;
  gap: 16px;
  color: var(--muted);
}

.spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid var(--accent-soft);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

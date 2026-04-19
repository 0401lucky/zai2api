import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api, ApiError } from '@/api/client'
import type { Bootstrap } from '@/api/types'

export type ViewKey = 'accounts' | 'security' | 'logs'

export const useBootstrapStore = defineStore('bootstrap', () => {
  const data = ref<Bootstrap | null>(null)
  const loading = ref(false)
  const initializing = ref(true)
  const error = ref<string | null>(null)
  const currentView = ref<ViewKey>('accounts')

  const loggedIn = computed(() => Boolean(data.value?.logged_in))
  const setupRequired = computed(() => Boolean(data.value?.setup_required))
  const accountsSummary = computed(() => data.value?.accounts ?? null)
  const guestSummary = computed(() => data.value?.guest_source ?? null)
  const panelSource = computed(() => data.value?.panel_password.source ?? null)
  const apiSource = computed(() => data.value?.api_password.source ?? null)
  const apiEnabled = computed(() => data.value?.api_password.enabled ?? false)

  const summaryText = computed(() => {
    const accounts = accountsSummary.value
    const guest = guestSummary.value
    if (!accounts) return '正在读取启动信息…'
    if ((accounts.persisted_healthy ?? 0) > 0) {
      return `健康 ${accounts.persisted_healthy} / 启用 ${accounts.persisted_enabled} / 总计 ${accounts.persisted_total} 个持久化账号。`
    }
    if (accounts.using_guest_source) {
      return accounts.persisted_total
        ? '当前没有健康持久化账号，正在使用游客来源。'
        : '当前没有持久化账号，正在使用游客来源。'
    }
    if (accounts.using_env_fallback) {
      return accounts.persisted_total
        ? '当前没有健康持久化账号，正在使用环境变量兜底。'
        : '当前没有持久化账号，正在使用环境变量兜底。'
    }
    if (guest?.enabled && guest.status === 'cooldown') {
      return '游客来源冷却中，当前没有可用持久化账号。'
    }
    if (guest?.enabled) {
      return '游客来源已启用，当前等待可用会话。'
    }
    return '当前尚未配置任何可用账号。'
  })

  const heroTitle = computed(() => (setupRequired.value ? '后台尚未初始化' : 'Cloudflare 后台已就绪'))

  async function refresh() {
    loading.value = true
    try {
      data.value = await api.bootstrap()
      error.value = null
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
      initializing.value = false
    }
  }

  function setView(view: ViewKey) {
    currentView.value = view
  }

  return {
    data,
    loading,
    initializing,
    error,
    currentView,
    loggedIn,
    setupRequired,
    accountsSummary,
    guestSummary,
    panelSource,
    apiSource,
    apiEnabled,
    summaryText,
    heroTitle,
    refresh,
    setView,
  }
})

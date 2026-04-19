import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api, ApiError } from '@/api/client'
import type { LogEntry, LogLevel } from '@/api/types'

export type LogLevelFilter = 'all' | LogLevel
export type LogCategoryFilter = 'all' | (string & {})

export const useLogsStore = defineStore('logs', () => {
  const items = ref<LogEntry[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const keyword = ref('')
  const levelFilter = ref<LogLevelFilter>('all')
  const categoryFilter = ref<LogCategoryFilter>('all')

  const categories = computed(() => {
    const set = new Set<string>()
    for (const log of items.value) set.add(log.category)
    return ['all', ...Array.from(set).sort()]
  })

  const levels = computed(() => {
    const set = new Set<LogLevel>()
    for (const log of items.value) set.add(log.level)
    return ['all', ...Array.from(set).sort()] as LogLevelFilter[]
  })

  const filtered = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    return items.value.filter((log) => {
      if (levelFilter.value !== 'all' && log.level !== levelFilter.value) return false
      if (categoryFilter.value !== 'all' && log.category !== categoryFilter.value) return false
      if (!kw) return true
      const detailsText = log.details ? JSON.stringify(log.details).toLowerCase() : ''
      return log.message.toLowerCase().includes(kw) || detailsText.includes(kw)
    })
  })

  async function load(limit = 100) {
    loading.value = true
    try {
      const payload = await api.listLogs(limit)
      items.value = payload.logs
      error.value = null
      loaded.value = true
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function setKeyword(value: string) {
    keyword.value = value
  }
  function setLevel(value: LogLevelFilter) {
    levelFilter.value = value
  }
  function setCategory(value: LogCategoryFilter) {
    categoryFilter.value = value
  }

  return {
    items,
    loading,
    loaded,
    error,
    keyword,
    levelFilter,
    categoryFilter,
    categories,
    levels,
    filtered,
    load,
    setKeyword,
    setLevel,
    setCategory,
  }
})

import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api, ApiError } from '@/api/client'
import type { SecuritySettings, SecurityUpdatePayload } from '@/api/types'

export const useSecurityStore = defineStore('security', () => {
  const data = ref<SecuritySettings | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    try {
      data.value = await api.getSecurity()
      error.value = null
      loaded.value = true
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function update(payload: SecurityUpdatePayload) {
    data.value = await api.updateSecurity(payload)
  }

  return { data, loading, loaded, error, load, update }
})

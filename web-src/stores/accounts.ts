import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api, ApiError } from '@/api/client'
import type { Account, GuestSource } from '@/api/types'

export type AccountStatusFilter = 'all' | 'active' | 'idle' | 'error' | 'disabled'

export const useAccountsStore = defineStore('accounts', () => {
  const items = ref<Account[]>([])
  const guestSource = ref<GuestSource | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const keyword = ref('')
  const statusFilter = ref<AccountStatusFilter>('all')

  const filtered = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    return items.value.filter((account) => {
      if (statusFilter.value !== 'all') {
        if (statusFilter.value === 'disabled') {
          if (account.enabled) return false
        } else {
          if (!account.enabled) return false
          if (account.status !== statusFilter.value) return false
        }
      }
      if (!kw) return true
      const haystack = [account.name, account.email, account.user_id, account.masked_jwt, account.masked_session_token]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(kw)
    })
  })

  const counts = computed(() => ({
    total: items.value.length,
    active: items.value.filter((a) => a.enabled && a.status === 'active').length,
    idle: items.value.filter((a) => a.enabled && a.status === 'idle').length,
    error: items.value.filter((a) => a.enabled && (a.status === 'error' || a.status === 'invalid')).length,
    disabled: items.value.filter((a) => !a.enabled).length,
  }))

  async function load() {
    loading.value = true
    try {
      const payload = await api.listAccounts()
      items.value = payload.accounts
      guestSource.value = payload.guest_source
      error.value = null
      loaded.value = true
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function create(jwt: string) {
    await api.createAccount(jwt)
    await load()
  }

  async function check(id: number) {
    await api.checkAccount(id)
    await load()
  }

  async function setEnabled(id: number, enabled: boolean) {
    if (enabled) {
      await api.enableAccount(id)
    } else {
      await api.disableAccount(id)
    }
    await load()
  }

  function setStatusFilter(value: AccountStatusFilter) {
    statusFilter.value = value
  }

  function setKeyword(value: string) {
    keyword.value = value
  }

  return {
    items,
    guestSource,
    loading,
    loaded,
    error,
    keyword,
    statusFilter,
    filtered,
    counts,
    load,
    create,
    check,
    setEnabled,
    setStatusFilter,
    setKeyword,
  }
})

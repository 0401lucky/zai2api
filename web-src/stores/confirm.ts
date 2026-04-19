import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

export const useConfirmStore = defineStore('confirm', () => {
  const pending = ref<Pending | null>(null)

  function open(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      pending.value = { ...options, resolve }
    })
  }

  function respond(ok: boolean) {
    const current = pending.value
    if (!current) return
    pending.value = null
    current.resolve(ok)
  }

  return { pending, open, respond }
})

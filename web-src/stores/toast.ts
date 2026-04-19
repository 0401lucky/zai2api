import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ToastLevel = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  level: ToastLevel
  message: string
}

const MAX_VISIBLE = 3
const DURATION_MS = 3600

let nextId = 1

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([])

  function push(level: ToastLevel, message: string) {
    const id = nextId++
    items.value = [...items.value, { id, level, message }]
    if (items.value.length > MAX_VISIBLE) {
      items.value = items.value.slice(-MAX_VISIBLE)
    }
    window.setTimeout(() => {
      items.value = items.value.filter((t) => t.id !== id)
    }, DURATION_MS)
  }

  function dismiss(id: number) {
    items.value = items.value.filter((t) => t.id !== id)
  }

  return {
    items,
    push,
    dismiss,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
    warning: (message: string) => push('warning', message),
  }
})

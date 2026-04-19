import { onMounted, onBeforeUnmount, ref } from 'vue'

export interface UsePollingOptions {
  interval: number
  immediate?: boolean
  pauseOnHidden?: boolean
}

export function usePolling(task: () => void | Promise<void>, options: UsePollingOptions) {
  const { interval, immediate = true, pauseOnHidden = true } = options
  const active = ref(true)
  let timer: number | null = null

  function tick() {
    void Promise.resolve().then(task).catch(() => {
      // 错误由业务自行处理，轮询自身不应因此停止
    })
  }

  function start() {
    stop()
    timer = window.setInterval(tick, interval)
  }

  function stop() {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }

  function handleVisibility() {
    if (document.visibilityState === 'hidden') {
      active.value = false
      stop()
    } else {
      active.value = true
      tick()
      start()
    }
  }

  onMounted(() => {
    if (immediate) tick()
    start()
    if (pauseOnHidden) document.addEventListener('visibilitychange', handleVisibility)
  })

  onBeforeUnmount(() => {
    stop()
    if (pauseOnHidden) document.removeEventListener('visibilitychange', handleVisibility)
  })

  return { active, start, stop }
}

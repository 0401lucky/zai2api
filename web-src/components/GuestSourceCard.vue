<script setup lang="ts">
import { computed } from 'vue'
import type { GuestSource } from '@/api/types'
import { formatTimestamp, guestStatusLabel } from '@/utils/format'
import Badge from './Badge.vue'

interface Props {
  source: GuestSource | null
}

const props = defineProps<Props>()

const tone = computed(() => {
  if (!props.source?.enabled) return 'muted'
  if (props.source.status === 'active') return 'active'
  if (props.source.status === 'cooldown' || props.source.status === 'error') return 'error'
  return 'idle'
})

const statusText = computed(() => {
  if (!props.source) return '未启用 · 未知'
  const enabledLabel = props.source.enabled ? '已启用' : '未启用'
  return `${enabledLabel} · ${guestStatusLabel(props.source.status)}`
})
</script>

<template>
  <article v-if="source" class="guest-card">
    <header>
      <Badge :tone="tone" dot>{{ statusText }}</Badge>
      <h4>游客来源</h4>
      <p class="subtitle">独立于持久化账号池的游客 session 来源</p>
    </header>
    <dl class="meta">
      <div>
        <dt>轮询状态</dt>
        <dd>{{ source.in_rotation ? '参与轮询' : '暂未参与轮询' }}</dd>
      </div>
      <div>
        <dt>最近刷新</dt>
        <dd>{{ formatTimestamp(source.last_refreshed_at) }}</dd>
      </div>
      <div>
        <dt>最近用户</dt>
        <dd>{{ source.last_user_id || '—' }}</dd>
      </div>
      <div>
        <dt>请求次数</dt>
        <dd>{{ source.request_count ?? 0 }}</dd>
      </div>
      <div class="wide">
        <dt>冷却截止</dt>
        <dd>{{ formatTimestamp(source.cooldown_until) }}</dd>
      </div>
      <div v-if="source.last_error" class="wide error">
        <dt>最近错误</dt>
        <dd>{{ source.last_error }}</dd>
      </div>
    </dl>
  </article>
</template>

<style scoped>
.guest-card {
  padding: 20px;
  border-radius: var(--radius-md);
  border: 1px dashed var(--line-strong);
  background: linear-gradient(135deg, rgba(13, 111, 99, 0.05), rgba(195, 138, 55, 0.05));
  display: grid;
  gap: 14px;
}

header {
  display: grid;
  gap: 6px;
}

h4 {
  margin-top: 8px;
  font-size: 17px;
}

.subtitle {
  color: var(--muted);
  font-size: 13px;
}

.meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 18px;
  margin: 0;
  font-size: 12.5px;
}

.meta .wide {
  grid-column: 1 / -1;
}

dt {
  color: var(--muted);
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 2px;
}

dd {
  margin: 0;
  line-height: 1.5;
  word-break: break-all;
}

.error dd {
  color: var(--danger);
}
</style>

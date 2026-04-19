<script setup lang="ts">
import { computed } from 'vue'
import type { Account } from '@/api/types'
import { formatTimestamp, accountStatusLabel } from '@/utils/format'
import Badge from './Badge.vue'
import Button from './Button.vue'

interface Props {
  account: Account
  busy?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  check: [id: number]
  toggle: [id: number, nextEnabled: boolean]
}>()

const title = computed(
  () => props.account.name || props.account.email || props.account.user_id || `账号 #${props.account.id}`,
)

const subtitle = computed(() => props.account.email || props.account.user_id || '暂无身份信息')

const tone = computed(() => {
  if (!props.account.enabled) return 'muted'
  if (props.account.status === 'active') return 'active'
  if (props.account.status === 'error' || props.account.status === 'invalid') return 'error'
  return 'idle'
})

const statusText = computed(
  () => `${props.account.enabled ? '已启用' : '已停用'} · ${accountStatusLabel(props.account.status)}`,
)
</script>

<template>
  <article class="account-card">
    <header>
      <Badge :tone="tone" dot>{{ statusText }}</Badge>
      <h4>{{ title }}</h4>
      <p class="subtitle">{{ subtitle }}</p>
    </header>

    <dl class="meta">
      <div>
        <dt>JWT</dt>
        <dd><code>{{ account.masked_jwt || '—' }}</code></dd>
      </div>
      <div>
        <dt>会话</dt>
        <dd><code>{{ account.masked_session_token || '—' }}</code></dd>
      </div>
      <div>
        <dt>调用次数</dt>
        <dd>{{ account.request_count ?? 0 }}</dd>
      </div>
      <div>
        <dt>失败次数</dt>
        <dd>{{ account.failure_count ?? 0 }}</dd>
      </div>
      <div class="wide">
        <dt>最近检查</dt>
        <dd>{{ formatTimestamp(account.last_checked_at) }}</dd>
      </div>
      <div v-if="account.last_error" class="wide error">
        <dt>最近错误</dt>
        <dd>{{ account.last_error }}</dd>
      </div>
    </dl>

    <footer>
      <Button size="sm" variant="ghost" :disabled="busy" @click="emit('check', account.id)">
        检测
      </Button>
      <Button
        size="sm"
        :variant="account.enabled ? 'danger' : 'outline'"
        :disabled="busy"
        @click="emit('toggle', account.id, !account.enabled)"
      >
        {{ account.enabled ? '禁用' : '启用' }}
      </Button>
    </footer>
  </article>
</template>

<style scoped>
.account-card {
  padding: 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.78);
  display: grid;
  gap: 14px;
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}

.account-card:hover {
  border-color: var(--line-strong);
  box-shadow: var(--shadow-sm);
}

header {
  display: grid;
  gap: 6px;
}

h4 {
  margin-top: 8px;
  font-size: 17px;
  word-break: break-word;
}

.subtitle {
  color: var(--muted);
  font-size: 13px;
  word-break: break-all;
}

.meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 18px;
  margin: 0;
  font-size: 12.5px;
}

.meta > div {
  min-width: 0;
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
  word-break: break-all;
  line-height: 1.5;
}

.error dd {
  color: var(--danger);
}

code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: rgba(47, 36, 19, 0.06);
  padding: 2px 6px;
  border-radius: 6px;
}

footer {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}
</style>

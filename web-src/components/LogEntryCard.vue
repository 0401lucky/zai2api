<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LogEntry } from '@/api/types'
import { formatRelative, formatTimestamp } from '@/utils/format'
import Badge from './Badge.vue'

interface Props {
  log: LogEntry
}

const props = defineProps<Props>()

const levelTone = computed(() => {
  switch (props.log.level) {
    case 'error':
      return 'error'
    case 'warning':
      return 'warning'
    case 'info':
      return 'info'
    case 'debug':
      return 'muted'
    default:
      return 'default'
  }
})

const detailsText = computed(() => {
  if (!props.log.details) return ''
  if (Object.keys(props.log.details).length === 0) return ''
  return JSON.stringify(props.log.details, null, 2)
})

const expanded = ref(false)
const hasDetails = computed(() => detailsText.value.length > 0)
</script>

<template>
  <article class="log">
    <header>
      <div class="badges">
        <Badge :tone="levelTone">{{ log.level }}</Badge>
        <Badge tone="muted">{{ log.category }}</Badge>
      </div>
      <time class="time" :title="formatTimestamp(log.created_at)">
        {{ formatRelative(log.created_at) }}
      </time>
    </header>
    <p class="message">{{ log.message }}</p>
    <div v-if="hasDetails" class="details">
      <button type="button" class="toggle" @click="expanded = !expanded">
        {{ expanded ? '收起详情' : '展开详情' }}
      </button>
      <pre v-if="expanded">{{ detailsText }}</pre>
    </div>
  </article>
</template>

<style scoped>
.log {
  padding: 16px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.74);
  display: grid;
  gap: 10px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.time {
  font-size: 12px;
  color: var(--muted);
}

.message {
  line-height: 1.55;
  color: var(--text);
  word-break: break-word;
}

.details {
  margin: 0;
}

.toggle {
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 12.5px;
  cursor: pointer;
  padding: 2px 0;
}

.toggle:hover {
  text-decoration: underline;
}

pre {
  margin-top: 6px;
}
</style>

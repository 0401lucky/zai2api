<script setup lang="ts">
type Tone = 'default' | 'active' | 'error' | 'idle' | 'info' | 'warning' | 'muted'

interface Props {
  tone?: Tone
  dot?: boolean
}

withDefaults(defineProps<Props>(), { tone: 'default', dot: false })
</script>

<template>
  <span :class="['badge', `badge-${$props.tone}`]">
    <span v-if="dot" class="dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.4;
  background: var(--panel-muted);
  border: 1px solid var(--line);
  color: var(--text);
  letter-spacing: 0.02em;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.badge-active {
  color: var(--success);
  background: var(--success-soft);
  border-color: rgba(28, 122, 56, 0.2);
}

.badge-error {
  color: var(--danger);
  background: var(--danger-soft);
  border-color: rgba(175, 59, 45, 0.22);
}

.badge-idle {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: rgba(13, 111, 99, 0.22);
}

.badge-info {
  color: var(--info);
  background: var(--info-soft);
  border-color: rgba(21, 79, 120, 0.22);
}

.badge-warning {
  color: var(--warning);
  background: var(--warning-soft);
  border-color: rgba(180, 122, 32, 0.26);
}

.badge-muted {
  color: var(--muted);
}
</style>

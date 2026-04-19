<script setup lang="ts">
type Tone = 'accent' | 'info' | 'muted' | 'warning'

interface Props {
  tone?: Tone
}

withDefaults(defineProps<Props>(), { tone: 'accent' })
</script>

<template>
  <span :class="['meta-pill', `tone-${$props.tone}`]">
    <slot />
  </span>
</template>

<style scoped>
.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 12.5px;
  letter-spacing: 0.02em;
  border: 1px solid transparent;
}

.tone-accent {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: rgba(13, 111, 99, 0.2);
}

.tone-info {
  color: var(--info);
  background: var(--info-soft);
  border-color: rgba(21, 79, 120, 0.2);
}

.tone-warning {
  color: var(--warning);
  background: var(--warning-soft);
  border-color: rgba(180, 122, 32, 0.25);
}

.tone-muted {
  color: var(--muted);
  background: var(--panel-muted);
  border-color: var(--line);
}
</style>

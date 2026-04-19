<script setup lang="ts" generic="T extends string">
interface Option<V extends string> {
  value: V
  label: string
  count?: number
}

interface Props {
  modelValue: T
  options: ReadonlyArray<Option<T>>
  ariaLabel?: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()
</script>

<template>
  <div class="chips" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue"
      :class="['chip', { active: option.value === modelValue }]"
      @click="emit('update:modelValue', option.value)"
    >
      <span class="label">{{ option.label }}</span>
      <span v-if="option.count !== undefined" class="count">{{ option.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel-muted);
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.chip:hover {
  color: var(--text);
  border-color: var(--line-strong);
}

.chip.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: rgba(13, 111, 99, 0.25);
}

.count {
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  font-size: 11.5px;
  line-height: 1.6;
}

.chip.active .count {
  background: rgba(13, 111, 99, 0.14);
}
</style>

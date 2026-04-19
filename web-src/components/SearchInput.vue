<script setup lang="ts">
interface Props {
  modelValue: string
  placeholder?: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function clear() {
  emit('update:modelValue', '')
}
</script>

<template>
  <label class="search">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
    <input
      type="search"
      :value="modelValue"
      :placeholder="placeholder ?? '搜索…'"
      @input="handleInput"
    />
    <button
      v-if="modelValue"
      type="button"
      class="clear"
      aria-label="清空搜索"
      @click="clear"
    >
      ×
    </button>
  </label>
</template>

<style scoped>
.search {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.82);
  min-width: 220px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.icon {
  width: 16px;
  height: 16px;
  color: var(--muted);
  flex-shrink: 0;
}

input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  color: var(--text);
  font-size: 13.5px;
}

input::placeholder {
  color: rgba(122, 102, 69, 0.7);
}

input::-webkit-search-cancel-button {
  display: none;
}

.clear {
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: var(--panel-muted);
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.clear:hover {
  color: var(--danger);
  background: var(--danger-soft);
}
</style>

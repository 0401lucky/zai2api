<script setup lang="ts">
interface Props {
  modelValue?: string
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  name?: string
  min?: string | number
  max?: string | number
  autocomplete?: string
  id?: string
}

withDefaults(defineProps<Props>(), {
  type: 'text',
  required: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <input
    :id="id"
    :type="type"
    :name="name"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :required="required"
    :disabled="disabled"
    :min="min"
    :max="max"
    :autocomplete="autocomplete"
    class="text-input"
    @input="handleInput"
  />
</template>

<style scoped>
.text-input {
  width: 100%;
  padding: 13px 15px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.9);
  color: var(--text);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  font-variant-numeric: tabular-nums;
}

.text-input::placeholder {
  color: rgba(122, 102, 69, 0.65);
}

.text-input:hover:not(:disabled) {
  border-color: var(--line-strong);
}

.text-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  background: #fff;
}

.text-input:disabled {
  background: rgba(255, 255, 255, 0.55);
  color: var(--muted);
  cursor: not-allowed;
}
</style>

<script setup lang="ts">
interface Props {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  required?: boolean
}

defineProps<Props>()
</script>

<template>
  <label :for="htmlFor" class="field">
    <span class="field-label">
      {{ label }}
      <span v-if="required" aria-hidden="true" class="required">*</span>
    </span>
    <slot />
    <p v-if="error" class="field-error">{{ error }}</p>
    <p v-else-if="hint" class="field-hint">{{ hint }}</p>
  </label>
</template>

<style scoped>
.field {
  display: grid;
  gap: 8px;
  font-size: 14px;
}

.field-label {
  color: var(--muted);
  font-size: 13px;
}

.required {
  color: var(--danger);
  margin-left: 4px;
}

.field-hint,
.field-error {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
}

.field-hint {
  color: var(--muted);
}

.field-error {
  color: var(--danger);
}
</style>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline' | 'subtle'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  block?: boolean
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'ghost',
  size: 'md',
  type: 'button',
  disabled: false,
  block: false,
  loading: false,
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="['btn', `btn-${variant}`, `btn-${size}`, { 'btn-block': block, 'btn-loading': loading }]"
  >
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <span class="content"><slot /></span>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-weight: 500;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  white-space: nowrap;
}

.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btn[disabled] {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-sm {
  padding: 8px 12px;
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.btn-md {
  padding: 12px 16px;
  font-size: 14px;
}

.btn-lg {
  padding: 13px 18px;
  font-size: 15px;
}

.btn-block {
  width: 100%;
}

.btn-primary {
  color: #fffbf4;
  background: linear-gradient(135deg, #0d6f63 0%, #154f78 100%);
  border-color: transparent;
  box-shadow: 0 8px 24px rgba(13, 111, 99, 0.26);
}

.btn-primary:hover:not([disabled]) {
  transform: translateY(-1px);
  box-shadow: 0 12px 32px rgba(13, 111, 99, 0.32);
}

.btn-ghost {
  color: var(--text);
  background: var(--panel-muted);
  border-color: var(--line);
}

.btn-ghost:hover:not([disabled]) {
  background: var(--panel-strong);
  border-color: var(--line-strong);
}

.btn-outline {
  color: var(--accent);
  background: transparent;
  border-color: var(--accent-soft);
}

.btn-outline:hover:not([disabled]) {
  background: var(--accent-soft);
}

.btn-subtle {
  color: var(--muted);
  background: transparent;
  border-color: transparent;
}

.btn-subtle:hover:not([disabled]) {
  color: var(--text);
  background: var(--panel-muted);
}

.btn-danger {
  color: var(--danger);
  background: transparent;
  border-color: rgba(175, 59, 45, 0.26);
}

.btn-danger:hover:not([disabled]) {
  background: var(--danger-soft);
}

.btn-loading .content {
  opacity: 0.75;
}

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

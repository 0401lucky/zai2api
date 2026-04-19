<script setup lang="ts">
interface Props {
  title: string
  description?: string
  icon?: string
}

defineProps<Props>()
</script>

<template>
  <div class="empty">
    <div class="icon" aria-hidden="true">{{ icon ?? '·' }}</div>
    <h4>{{ title }}</h4>
    <p v-if="description" class="muted">{{ description }}</p>
    <div v-if="$slots.default" class="actions"><slot /></div>
  </div>
</template>

<style scoped>
.empty {
  padding: 28px 20px;
  border-radius: var(--radius-md);
  border: 1px dashed var(--line-strong);
  background: rgba(255, 255, 255, 0.45);
  text-align: center;
  color: var(--text);
}

.icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  margin: 0 auto 12px;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent);
  font-family: var(--font-serif);
  font-size: 22px;
}

h4 {
  font-size: 16px;
}

.muted {
  margin-top: 8px;
  color: var(--muted);
  line-height: 1.6;
}

.actions {
  margin-top: 14px;
  display: flex;
  justify-content: center;
  gap: 10px;
}
</style>

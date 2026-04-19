<script setup lang="ts">
interface Props {
  title?: string
  eyebrow?: string
  padded?: boolean
  muted?: boolean
}

withDefaults(defineProps<Props>(), { padded: true, muted: false })
</script>

<template>
  <section :class="['card', { 'card-muted': muted, 'card-padded': padded }]">
    <header v-if="title || eyebrow || $slots.eyebrow || $slots.actions" class="card-header">
      <div class="card-head">
        <div v-if="eyebrow || $slots.eyebrow" class="eyebrow">
          <slot name="eyebrow">{{ eyebrow }}</slot>
        </div>
        <h3 v-if="title || $slots.title">
          <slot name="title">{{ title }}</slot>
        </h3>
      </div>
      <div v-if="$slots.actions" class="card-actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.card {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.card-padded {
  padding: 24px;
}

.card-muted {
  background: var(--panel-muted);
  box-shadow: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}

.card-head {
  min-width: 0;
}

.eyebrow {
  color: var(--muted);
  font-size: 11.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h3 {
  margin-top: 6px;
  font-size: 18px;
}

.card-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
</style>

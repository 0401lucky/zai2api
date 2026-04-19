<script setup lang="ts">
interface Props {
  rows?: number
}

withDefaults(defineProps<Props>(), { rows: 3 })
</script>

<template>
  <div class="skeleton">
    <div class="line line-sm" />
    <div class="line line-lg" />
    <div v-for="n in rows" :key="n" class="line line-md" />
  </div>
</template>

<style scoped>
.skeleton {
  padding: 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--panel-muted);
}

.line {
  height: 10px;
  border-radius: 6px;
  margin: 10px 0;
  background:
    linear-gradient(90deg,
      rgba(122, 102, 69, 0.08) 0%,
      rgba(122, 102, 69, 0.22) 50%,
      rgba(122, 102, 69, 0.08) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.line-sm { width: 38%; }
.line-md { width: 70%; }
.line-lg { width: 85%; height: 16px; }

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
</style>

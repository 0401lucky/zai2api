<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useBootstrapStore } from '@/stores/bootstrap'
import Sidebar from './Sidebar.vue'
import HeroCard from './HeroCard.vue'

const bootstrap = useBootstrapStore()
const { currentView } = storeToRefs(bootstrap)
</script>

<template>
  <div class="shell">
    <Sidebar />
    <main class="content">
      <HeroCard />
      <div class="view" :data-view="currentView">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  min-height: 100vh;
}

.content {
  padding: 28px;
  display: grid;
  gap: 20px;
  align-content: start;
}

.view {
  display: grid;
  gap: 20px;
}

@media (max-width: 980px) {
  .shell {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useToastStore } from '@/stores/toast'

const store = useToastStore()
const { items } = storeToRefs(store)
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack" role="status" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in items"
          :key="toast.id"
          :class="['toast', `toast-${toast.level}`]"
          @click="store.dismiss(toast.id)"
        >
          <span class="dot" aria-hidden="true" />
          <span class="message">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 90;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px 13px 14px;
  border-radius: var(--radius-md);
  max-width: 360px;
  background: rgba(47, 36, 19, 0.94);
  color: #fff8ec;
  box-shadow: 0 20px 60px rgba(47, 36, 19, 0.26);
  pointer-events: auto;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 14px;
  line-height: 1.45;
}

.dot {
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.1);
}

.toast-success {
  background: linear-gradient(135deg, #1c7a38 0%, #0d6f63 100%);
  color: #f3fff7;
}

.toast-error {
  background: linear-gradient(135deg, #af3b2d 0%, #6c2619 100%);
  color: #fff4ef;
}

.toast-info {
  background: linear-gradient(135deg, #154f78 0%, #0d6f63 100%);
  color: #eff7ff;
}

.toast-warning {
  background: linear-gradient(135deg, #b47a20 0%, #7a4f13 100%);
  color: #fff7e6;
}

.message {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.toast-enter-active,
.toast-leave-active {
  transition: transform 0.24s ease, opacity 0.24s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>

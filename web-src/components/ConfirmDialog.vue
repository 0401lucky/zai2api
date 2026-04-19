<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useConfirmStore } from '@/stores/confirm'
import AppButton from './Button.vue'

const store = useConfirmStore()
const { pending } = storeToRefs(store)

function onBackdrop(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    store.respond(false)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="pending" class="backdrop" role="presentation" @click="onBackdrop">
        <div
          class="dialog"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="'confirm-title'"
        >
          <header>
            <h3 id="confirm-title">{{ pending.title }}</h3>
            <p v-if="pending.message" class="muted">{{ pending.message }}</p>
          </header>
          <footer>
            <AppButton variant="subtle" @click="store.respond(false)">
              {{ pending.cancelLabel ?? '取消' }}
            </AppButton>
            <AppButton
              :variant="pending.variant === 'danger' ? 'danger' : 'primary'"
              @click="store.respond(true)"
            >
              {{ pending.confirmLabel ?? '确认' }}
            </AppButton>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(47, 36, 19, 0.36);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: 20px;
}

.dialog {
  width: min(440px, 100%);
  padding: 26px;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: var(--panel-strong);
  box-shadow: 0 36px 96px rgba(47, 36, 19, 0.24);
  display: grid;
  gap: 22px;
}

header {
  display: grid;
  gap: 8px;
}

h3 {
  font-size: 19px;
}

.muted {
  color: var(--muted);
  line-height: 1.6;
}

footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .dialog,
.fade-leave-active .dialog {
  transition: transform 0.22s ease;
}

.fade-enter-from .dialog {
  transform: translateY(12px) scale(0.98);
}
</style>

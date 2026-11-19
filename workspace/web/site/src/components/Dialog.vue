<script setup lang="ts">
import { useTemplateRef, watchEffect } from "vue";

const { title } = defineProps<{
  title?: string;
}>();

const isOpen = defineModel<boolean>({ default: false });

const dialogRef = useTemplateRef<HTMLDialogElement>("dialog");

watchEffect(() => {
  const el = dialogRef.value;
  if (!el) return;

  if (isOpen.value && !el.open) {
    el.showModal();
  } else if (!isOpen.value && el.open) {
    el.close();
  }
});

function handleBackdropClick(event: MouseEvent) {
  if (event.target === dialogRef.value) {
    isOpen.value = false;
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog"
    @close="isOpen = false"
    @click="handleBackdropClick"
  >
    <div class="dialog-inner">
      <div v-if="title || $slots.header" class="dialog-header">
        <slot name="header">
          <h2 class="dialog-title">{{ title }}</h2>
        </slot>
        <button
          type="button"
          class="dialog-close"
          aria-label="Close"
          @click="isOpen = false"
        >
          ✕
        </button>
      </div>

      <div class="dialog-body">
        <slot />
      </div>

      <div v-if="$slots.footer" class="dialog-footer">
        <slot name="footer" />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.dialog {
  padding: 0;
  border: 1px solid var(--main-bdr-color);
  border-radius: 8px;
  background-color: var(--card-color);
  color: var(--text-primary);
  max-width: 28rem;
  width: calc(100% - 2rem);
}

.dialog::backdrop {
  background-color: rgba(0, 0, 0, 0.6);
}

.dialog-inner {
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--button-secondary-background-bdr);
}

.dialog-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.dialog-close {
  appearance: none;
  background: none;
  border: none;
  padding: 0.25rem 0.5rem;
  font: inherit;
  color: inherit;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0.7;
}

.dialog-close:hover {
  opacity: 1;
}

.dialog-close:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.dialog-body {
  padding: 1.25rem;
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--button-secondary-background-bdr);
}
</style>

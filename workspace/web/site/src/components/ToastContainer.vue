<script setup lang="ts">
import { useToast } from "../composable/useToast";

const { toasts, removeToast } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast--${toast.type}`]"
        @click="removeToast(toast.id)"
      >
        {{ toast.message }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 9999;
}

.toast {
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  color: #fff;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.toast--warning {
  background-color: #d97706; /* Amber/Warning */
}
</style>

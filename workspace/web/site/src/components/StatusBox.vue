<script setup lang="ts">
import { watch, onUnmounted } from "vue";

export type StatusType = "info" | "success" | "warning" | "error";

interface Props {
  title?: string;
  message: string;
  type?: StatusType;
  dismissible?: boolean;
  duration?: number; // Auto-close after milliseconds (0 = persistent)
}

// Vue 3.5+ Reactive Props Destructure with defaults
const {
  title,
  message,
  type = "info",
  dismissible = true,
  duration = 0,
} = defineProps<Props>();

// Two-way binding for visibility using defineModel (Vue 3.4+)
const isVisible = defineModel<boolean>({ default: true });

let timer: ReturnType<typeof setTimeout> | null = null;

const close = () => {
  isVisible.value = false;
  if (timer) clearTimeout(timer);
};

// Handle auto-dismissal whenever the box becomes visible
watch(
  isVisible,
  (visible) => {
    if (timer) clearTimeout(timer);
    if (visible && duration > 0) {
      timer = setTimeout(close, duration);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (timer) clearTimeout(timer);
});

const icons: Record<StatusType, string> = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  error: "❌",
};
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isVisible"
      class="status-box"
      :class="`status-${type}`"
      role="alert"
      aria-live="polite"
    >
      <span class="status-icon">{{ icons[type] }}</span>

      <div class="status-content">
        <strong v-if="title" class="status-title">{{ title }}</strong>
        <p class="status-message">
          <slot>{{ message }}</slot>
        </p>
      </div>

      <button
        v-if="dismissible"
        type="button"
        class="status-close"
        aria-label="Close notification"
        @click="close"
      >
        ✕
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.status-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid;
  font-family: system-ui, sans-serif;
  margin-bottom: 1rem;
}

.status-content {
  flex: 1;
}

.status-title {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.95rem;
}

.status-message {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.status-close {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  opacity: 0.6;
  padding: 0 0.25rem;
}

.status-close:hover {
  opacity: 1;
}

/* Status Variants */
.status-info {
  background-color: #eff6ff;
  border-color: #3b82f6;
  color: #1e3a8a;
}

.status-success {
  background-color: #f0fdf4;
  border-color: #22c55e;
  color: #14532d;
}

.status-warning {
  background-color: #fefce8;
  border-color: #eab308;
  color: #713f12;
}

.status-error {
  background-color: #fef2f2;
  border-color: #ef4444;
  color: #7f1d1d;
}

/* Smooth Transition */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
